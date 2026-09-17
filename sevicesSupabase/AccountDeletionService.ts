import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import axiosApiSupabase, { SUPABASE_ANON_KEY } from "./axiosApiSupabase";
import { decodeJwtPayload, isJwtExpired, isUuidLike, looksLikeJwt } from "./cloudTenant";

export interface DeletedEmployeeSession {
  jwt: string;
  token: string | null;
}

const SESSION_KEYS = [
  "@token", "@supabase_jwt", "@cloud_profile", "@company_id", "@tenant_id",
  "@cloud_company_id", "@employee_id", "@user_company_id", "@branch_id",
  "@ma_nv", "@type_account", "@company_code", "maCTDK_UUID", "maCTDK", "tenCTDKVT",
];

async function assertSameSession(session: DeletedEmployeeSession, allowPartiallyCleared = false): Promise<void> {
  const jwt = await AsyncStorage.getItem("@supabase_jwt");
  const token = await AsyncStorage.getItem("@token");
  if ((jwt !== session.jwt && !(allowPartiallyCleared && jwt === null)) ||
      (token !== session.token && !(allowPartiallyCleared && token === null))) {
    throw new Error("Phiên đăng nhập đã thay đổi. Vui lòng tải lại màn hình.");
  }
}

/**
 * Giống web: chỉ DELETE hồ sơ dm_employees của phiên hiện tại.
 * Không xóa cloud_users, không thu hồi phiên trên thiết bị khác.
 * Kiểm tra client không thay thế cho phân quyền RLS phía máy chủ.
 */
export async function deleteCurrentEmployee(): Promise<DeletedEmployeeSession> {
  const jwt = (await AsyncStorage.getItem("@supabase_jwt")) || "";
  const token = await AsyncStorage.getItem("@token");
  const claims = decodeJwtPayload(jwt);
  if (!looksLikeJwt(jwt) || isJwtExpired(jwt) || !claims.sub ||
      !Number.isFinite(claims.exp) || !isUuidLike(claims.company_id)) {
    throw new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
  }
  // Không dùng sub (cloud_users.id) hay cache employee_id có thể thuộc phiên cũ.
  if (!isUuidLike(claims.employee_id)) {
    throw new Error("Phiên đăng nhập chưa có mã định danh nhân viên. Vui lòng đăng nhập lại.");
  }
  const session = { jwt, token };
  await assertSameSession(session);

  let response;
  try {
    // Gửi JWT cố định, không đi qua interceptor có fallback anon-key.
    response = await axios.delete(`${axiosApiSupabase.defaults.baseURL}/rest/v1/dm_employees`, {
      timeout: 30000,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${jwt}`,
        Prefer: "return=representation",
        Accept: "application/json",
      },
      params: {
        ma_ctdk: `eq.${claims.company_id}`,
        id: `eq.${claims.employee_id}`,
        select: "id",
      },
    });
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const code = error.response?.data?.code;
      if (status === 401) {
        throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      }
      if (status === 403 || code === "42501") {
        throw new Error("Bạn không có quyền xóa hồ sơ nhân viên này.");
      }
      if (code === "23503") {
        throw new Error("Hồ sơ nhân viên đang được dữ liệu khác sử dụng nên chưa thể xóa.");
      }
      if (!error.response) {
        throw new Error("Không nhận được xác nhận xóa từ máy chủ. Vui lòng kiểm tra kết nối và trạng thái hồ sơ trước khi thử lại.");
      }
    }
    throw new Error("Không xóa được hồ sơ nhân viên. Vui lòng thử lại hoặc liên hệ quản trị viên.");
  }
  if (!Array.isArray(response.data) || response.data.length !== 1 ||
      response.data[0]?.id !== claims.employee_id) {
    throw new Error("Không tìm thấy nhân viên cần xóa (hoặc không có quyền xóa).");
  }
  return session;
}

/** Chỉ gọi sau khi DELETE đã được xác nhận; không xóa phiên mới nếu đã đổi tài khoản. */
export async function clearDeletedEmployeeSession(session: DeletedEmployeeSession): Promise<void> {
  await assertSameSession(session, true);
  try {
    await AsyncStorage.multiRemove(SESSION_KEYS);
  } catch {
    // Retry theo từng khóa nếu thao tác batch thất bại.
    try {
      for (const key of SESSION_KEYS) await AsyncStorage.removeItem(key);
    } catch {
      throw new Error("Đã xóa hồ sơ nhưng chưa dọn được phiên trên thiết bị. Vui lòng thử đăng xuất lại.");
    }
  }
}
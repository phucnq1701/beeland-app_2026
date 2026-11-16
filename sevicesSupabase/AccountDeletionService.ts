import { callNv, errorMessage } from "@/services/nvApi";
import { clearSession, getJwt, getSessionToken } from "@/services/session";

/**
 * Tự xoá tài khoản (Apple 5.1.1(v)) — bộ API riêng app `fn_nv_app_xoa_tai_khoan` (user chốt 2026-11-16): máy chủ lấy nhân viên /
 * công ty từ JWT (không gửi id), xoá hồ sơ nhân viên như lõi xoá nhân viên của web; nhân viên còn chứng từ ⇒ KHOÁ tài khoản (không
 * đăng nhập được nữa); tài khoản quản trị / nhóm toàn quyền ⇒ máy chủ từ chối (liên hệ quản trị). Không còn DELETE thẳng
 * bảng dm_employees qua REST (web đã chặn tự xoá ở trigger — đường cũ luôn lỗi).
 */
export type DeletionResult = "xoa" | "khoa";

export interface DeletedEmployeeSession {
  jwt: string;
  token: string | null;
  result: DeletionResult;
}

async function assertSameSession(session: Pick<DeletedEmployeeSession, "jwt" | "token">, allowPartiallyCleared = false): Promise<void> {
  const jwt = (await getJwt()) || null;
  const token = (await getSessionToken()) || null;
  if ((jwt !== session.jwt && !(allowPartiallyCleared && jwt === null)) ||
      (token !== session.token && !(allowPartiallyCleared && token === null))) {
    throw new Error("Phiên đăng nhập đã thay đổi. Vui lòng tải lại màn hình.");
  }
}

/** Xoá (hoặc khoá) tài khoản đang đăng nhập. Lỗi ⇒ ném Error với lời máy chủ; phiên giữ nguyên. */
export async function deleteCurrentEmployee(): Promise<DeletedEmployeeSession> {
  const jwt = await getJwt();
  const token = (await getSessionToken()) || null;
  if (!jwt) throw new Error("Phiên đăng nhập không hợp lệ hoặc đã hết hạn. Vui lòng đăng nhập lại.");
  let r: any;
  try {
    r = await callNv<any>("fn_nv_app_xoa_tai_khoan", {});
  } catch (e) {
    throw new Error(errorMessage(e, "Không xóa được tài khoản. Vui lòng thử lại hoặc liên hệ quản trị viên."));
  }
  const result = r?.ket_qua;
  if (result !== "xoa" && result !== "khoa") throw new Error("Không nhận được xác nhận xóa từ máy chủ. Vui lòng thử lại.");
  return { jwt, token, result };
}

/** Chỉ gọi sau khi máy chủ đã xác nhận; không xoá phiên mới nếu đã đổi tài khoản. Phiên máy chủ: đăng xuất (bỏ qua lỗi). */
export async function clearDeletedEmployeeSession(session: DeletedEmployeeSession): Promise<void> {
  await assertSameSession(session, true);
  if (session.token) {
    await callNv("fn_nv_app_dang_xuat", { p_token: session.token }, { anonymous: true, timeout: 8000 }).catch(() => undefined);
  }
  try {
    await clearSession();
  } catch {
    throw new Error("Đã xóa tài khoản nhưng chưa dọn được phiên trên thiết bị. Vui lòng thử đăng xuất lại.");
  }
}

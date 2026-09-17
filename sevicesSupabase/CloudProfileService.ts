import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthSupabaseService } from "./AuthService";
import { decodeJwtPayload, isJwtExpired } from "./cloudTenant";

export const PROFILE_KEY = "@cloud_profile";

export interface CloudProfile {
  id: string;
  companyId: string;
  HoTen: string;
  Email: string;
  DiDong: string | null;
}

const text = (...values: unknown[]): string =>
  values.find((value): value is string => typeof value === "string" && !!value.trim())?.trim() ?? "";

export function normalizeCloudProfile(response: any): CloudProfile {
  const user = response?.data && typeof response.data === "object"
    ? response.data : response;
  const employee = user?.employee;
  const row = user?.employeeRow;
  const email = text(employee?.email, row?.email, user?.email);
  return {
    id: text(user?.id),
    companyId: text(user?.companyId),
    HoTen: text(employee?.hoTen, row?.ho_ten, user?.fullName, user?.hoTen, email),
    Email: email,
    DiDong: text(employee?.dienThoai, row?.dien_thoai, user?.phone) || null,
  };
}

function matches(profile: CloudProfile, jwt: string): boolean {
  const claims = decodeJwtPayload(jwt);
  return !!profile.id && !!profile.companyId &&
    profile.id === claims.sub && profile.companyId === claims.company_id;
}

/** Chỉ lưu các trường hiển thị, không lưu toàn bộ response chứa token/menu. */
export async function cacheCloudProfile(response: any, jwt: string): Promise<void> {
  const profile = normalizeCloudProfile(response);
  if (!matches(profile, jwt)) {
    await AsyncStorage.removeItem(PROFILE_KEY);
    return;
  }
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export const CloudProfileService = {
  userInfo: async (): Promise<{ data: CloudProfile }> => {
    const jwt = (await AsyncStorage.getItem("@supabase_jwt")) || "";
    const claims = decodeJwtPayload(jwt);
    if (!claims.sub || !claims.company_id) {
      throw new Error("Không xác định được phiên đăng nhập. Vui lòng đăng nhập lại.");
    }
    if (!isJwtExpired(jwt)) {
      const stored = await AsyncStorage.getItem(PROFILE_KEY);
      if (stored) {
        try {
          const profile = JSON.parse(stored);
          if (matches(profile, jwt)) return { data: profile };
        } catch {
          // Cache hỏng: khôi phục từ cloud-auth, không gọi API legacy.
        }
      }
    }

    const token = await AsyncStorage.getItem("@token");
    if (!token) {
      throw new Error("Phiên cũ chưa có hồ sơ Cloud. Vui lòng đăng nhập lại.");
    }

    let response: any;
    try {
      response = await AuthSupabaseService.login({ action: "verify", token });
    } catch {
      throw new Error("Không xác minh được phiên Cloud. Thử lại hoặc đăng nhập lại.");
    }
    if (response?.status !== 200) {
      throw new Error("Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.");
    }
    const profile = normalizeCloudProfile(response);
    if (!matches(profile, jwt)) {
      throw new Error("Hồ sơ không khớp phiên đăng nhập. Vui lòng đăng nhập lại.");
    }
    // Không ghi kết quả verify nếu người dùng vừa đổi tài khoản.
    if ((await AsyncStorage.getItem("@supabase_jwt")) !== jwt ||
        (await AsyncStorage.getItem("@token")) !== token) {
      throw new Error("Phiên đăng nhập đã thay đổi. Vui lòng tải lại.");
    }
    const body = response?.data && typeof response.data === "object" ? response.data : response;
    const refreshedJwt = text(response.jwt, response.cloud_jwt, response.supabase_jwt,
      response.cloudJwt, body.jwt, body.cloud_jwt, body.supabase_jwt, body.cloudJwt);
    if (refreshedJwt && matches(profile, refreshedJwt) && !isJwtExpired(refreshedJwt)) {
      await AsyncStorage.setItem("@supabase_jwt", refreshedJwt);
    } else if (isJwtExpired(jwt)) {
      throw new Error("Không làm mới được phiên Cloud. Vui lòng đăng nhập lại.");
    }
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return { data: profile };
  },
};
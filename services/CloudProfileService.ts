import { getFreshJwt, getUser } from "@/services/session";

export const PROFILE_KEY = "@cloud_profile";

export interface CloudProfile {
  id: string;
  companyId: string;
  HoTen: string;
  Email: string;
  DiDong: string | null;
}

/**
 * Hồ sơ người đang đăng nhập (màn Tài khoản / Hồ sơ) — lấy từ phiên do `fn_nv_app_dang_nhap` / `fn_nv_app_lam_moi_phien`
 * trả về (services/session.ts). JWT sắp / đã hết hạn thì tự làm mới trước (cập nhật luôn hồ sơ mới nhất).
 */
export const CloudProfileService = {
  userInfo: async (): Promise<{ data: CloudProfile }> => {
    const jwt = await getFreshJwt();
    if (!jwt) throw new Error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
    const u = await getUser();
    if (!u?.id || !u?.company_id) throw new Error("Phiên cũ chưa có hồ sơ. Vui lòng đăng nhập lại.");
    return {
      data: {
        id: u.id,
        companyId: u.company_id,
        HoTen: (u.ho_ten || u.email || "").trim(),
        Email: (u.email || "").trim(),
        DiDong: u.dien_thoai?.trim() || null,
      },
    };
  },
};

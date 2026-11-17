import { callNv, NvApiError } from "./nvApi";
import { clearSession, getSessionToken, saveSession, type NvSession } from "./session";

export type LoginType = "INTERNAL" | "AGENCY";

export interface LoginInput {
  loginType: LoginType;
  companyCode: string;
  username: string;
}

/** Kết quả đăng nhập cho màn hình: ok | rejected (sai MK, bị khoá… — có thông điệp máy chủ) | network. */
export type LoginResult =
  | { status: "ok"; session: NvSession }
  | { status: "rejected"; message: string }
  | { status: "network"; message: string };

function loginArgs(a: LoginInput, password: string) {
  return {
    p_ma_ctdk: a.companyCode.trim(),
    p_tai_khoan: a.username.trim(),
    p_mat_khau: password,
    p_loai_tk: a.loginType === "AGENCY" ? "AGENCY" : "SYSTEM",
  };
}

async function requestSession(a: LoginInput, password: string): Promise<LoginResult> {
  try {
    const s = await callNv<NvSession>("fn_nv_app_dang_nhap", loginArgs(a, password), { anonymous: true });
    if (!s?.jwt || !s?.token) return { status: "rejected", message: "Máy chủ không trả phiên đăng nhập, vui lòng thử lại" };
    return { status: "ok", session: s };
  } catch (e) {
    if (e instanceof NvApiError && e.status > 0 && e.status < 500) return { status: "rejected", message: e.message };
    return { status: "network", message: e instanceof Error ? e.message : "Không kết nối được máy chủ" };
  }
}

export const AuthApi = {
  /** Đăng nhập + lưu phiên. */
  async login(a: LoginInput, password: string): Promise<LoginResult> {
    const r = await requestSession(a, password);
    if (r.status === "ok") {
      await clearSession();
      await saveSession(r.session, a.companyCode.trim());
    }
    return r;
  },

  /**
   * Kiểm mật khẩu (bật Face ID): đăng nhập thử rồi thu hồi ngay phiên vừa cấp — KHÔNG đụng phiên đang dùng.
   * Lỗi mạng ⇒ ném.
   */
  async verifyPassword(a: LoginInput, password: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const r = await requestSession(a, password);
    if (r.status === "network") throw new Error(r.message);
    if (r.status === "rejected") return { ok: false, message: r.message || "Mật khẩu không đúng" };
    void callNv("fn_nv_app_dang_xuat", { p_token: r.session.token }, { anonymous: true }).catch(() => undefined);
    return { ok: true };
  },

  /** Đăng xuất: thu hồi phiên trên máy chủ (lỗi mạng bỏ qua) rồi xoá phiên trên máy. */
  async logout(): Promise<void> {
    const token = await getSessionToken();
    if (token) {
      await callNv("fn_nv_app_dang_xuat", { p_token: token }, { anonymous: true, timeout: 8000 }).catch(() => undefined);
    }
    await clearSession();
  },
};

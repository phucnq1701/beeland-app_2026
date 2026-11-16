/**
 * SHIM VIẾT TAY — thay `@/lib/session` của web (web đọc phiên đồng bộ từ localStorage) cho module web chép ở lib/web.
 * App lưu phiên bất đồng bộ ⇒ giữ bản sao trong bộ nhớ: gọi `await primeWebSession()` trước khi dùng module web
 * (màn phiếu tính giá gọi khi mở). Chỉ cung cấp các hàm module chép dùng (sessionCompanyId).
 */
import { getUser } from "@/services/session";

let companyId = "";

/** Nạp công ty đăng ký của phiên hiện tại (gọi lại sau khi đăng nhập tài khoản khác) */
export async function primeWebSession(): Promise<void> {
  companyId = String((await getUser())?.company_id ?? "");
}

/** Như web sessionCompanyId(): uuid công ty đăng ký, chưa có ⇒ "" */
export const sessionCompanyId = (): string => companyId;

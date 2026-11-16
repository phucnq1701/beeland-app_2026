/**
 * SHIM VIẾT TAY — thay web src/services/CodeGenService (sinh số phiếu xem trước bằng fn_generate_form_code).
 * App KHÔNG xem trước số (tránh đụng bộ đếm trên prod): máy chủ cấp số khi lưu (_price_sheet_write ⇒ _price_sheet_gen_code khi trống).
 * Form web gọi trong try/catch ⇒ lỗi ở đây = "để trống" đúng như web khi chưa cấu hình quy tắc đánh mã.
 */
export async function generateFormCode(): Promise<string> {
  throw new Error("App: số phiếu do máy chủ cấp khi lưu");
}
export async function getProjectCodeVars(): Promise<Record<string, unknown>> {
  return {};
}

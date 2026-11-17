/**
 * SHIM VIẾT TAY — thay web src/services/HeThongService (API cũ, không chép). Form web chỉ gọi CaiDat.get ở nhánh dự phòng
 * utils/codePattern.loadCodeRules (quy tắc đánh mã đọc phía máy khi máy chủ không trả số phiếu). App không đọc quy tắc phía máy:
 * số phiếu xem trước luôn lấy ở máy chủ (fn_nv_app_ma_phieu = fn_generate_form_code của web), máy chủ trống ⇒ cấp số khi lưu
 * ⇒ trả rỗng (web khi chưa cấu hình cũng rỗng). Hàm khác ⇒ lỗi "App không hỗ trợ".
 */
const make = (path: string): any =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === "then" ? undefined : make(`${path}.${String(k)}`)),
    apply: () => {
      console.log(`[lib/web shim] app không hỗ trợ ${path}`);
      return Promise.reject(new Error(`App không hỗ trợ ${path}`));
    },
  });

const rest = make("services/HeThongService.HeThongService");

export const HeThongService: any = new Proxy(
  { CaiDat: { get: async () => ({ status: 2000, data: [] }) } },
  { get: (t: any, k) => (k in t ? t[k] : rest[k]) }
);
export type HeThongService = any;

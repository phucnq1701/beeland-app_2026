// ⚠️ TỰ SINH (scripts/sync-web-pricing.cjs): stub cho web src/services/NhanVienService — module không thuần, app không chép.
// Gọi vào ⇒ log + lỗi "App không hỗ trợ" (thêm shim viết tay lib/web/_shims/services/NhanVienService.ts nếu luồng app cần).
// @ts-nocheck
const make = (path: string): any => new Proxy(function () {}, {
  get: (_t, k) => (k === "then" ? undefined : make(`${path}.${String(k)}`)),
  apply: () => { console.log(`[lib/web stub] app không hỗ trợ ${path}`); return Promise.reject(new Error(`App không hỗ trợ ${path}`)); },
});
export const NhanVienService: any = make("services/NhanVienService.NhanVienService");
export type NhanVienService = any;

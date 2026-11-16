// ⚠️ TỰ SINH (scripts/sync-web-pricing.cjs): stub cho web src/config/featureCatalog — module không thuần, app không chép.
// Gọi vào ⇒ log + lỗi "App không hỗ trợ" (thêm shim viết tay lib/web/_shims/config/featureCatalog.ts nếu luồng app cần).
// @ts-nocheck
const make = (path: string): any => new Proxy(function () {}, {
  get: (_t, k) => (k === "then" ? undefined : make(`${path}.${String(k)}`)),
  apply: () => { console.log(`[lib/web stub] app không hỗ trợ ${path}`); return Promise.reject(new Error(`App không hỗ trợ ${path}`)); },
});
export const suggestFeatures: any = make("config/featureCatalog.suggestFeatures");
export type suggestFeatures = any;

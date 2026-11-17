/**
 * SHIM VIẾT TAY — thay web src/services/Agency (API đại lý cũ, không chép). Form Đặt lịch ký web chỉ gọi DaiLy.getList (ô Đại lý phụ
 * trách) ⇒ sàn / đại lý của công ty qua fn_nv_app_san_list (dm_companies is_san, như web listSanGiaoDich), trả { status, data: [{ ID,
 * MaCTVT, TenCTVT, TenCT }] }. Hàm khác ⇒ lỗi "App không hỗ trợ".
 */
import { callNv } from "@/services/nvApi";

const make = (path: string): any =>
  new Proxy(function () {}, {
    get: (_t, k) => (k === "then" ? undefined : make(`${path}.${String(k)}`)),
    apply: () => {
      console.log(`[lib/web shim] app không hỗ trợ ${path}`);
      return Promise.reject(new Error(`App không hỗ trợ ${path}`));
    },
  });

const rest = make("services/Agency.AgencyService");

const DaiLy = new Proxy(
  {
    getList: async () => {
      const rows = await callNv<any[]>("fn_nv_app_san_list", {});
      const data = (Array.isArray(rows) ? rows : [])
        .filter((r: any) => r?.id)
        .map((r: any) => ({ ID: r.id, MaCTVT: r.id, TenCTVT: r.ten_ct_vt || r.ten_ct || "", TenCT: r.ten_ct || r.ten_ct_vt || "" }));
      return { status: 2000, data };
    },
  },
  { get: (t: any, k) => (k in t ? t[k] : rest.DaiLy[k]) }
);

export const AgencyService: any = new Proxy({ DaiLy }, { get: (t: any, k) => (k in t ? t[k] : rest[k]) });
export default AgencyService;

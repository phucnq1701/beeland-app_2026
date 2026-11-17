/**
 * SHIM VIẾT TAY — thay web src/services/Customer.js (service cũ) cho module web chép ở lib/web.
 * Chỉ các hàm ô chọn khách của form phiếu tính giá (thân CHÉP từ web: gọi CustomerCloudService — bản chép, đọc qua
 * fn_customer_picker / fn_customer_get_by_ids ⇒ fn_nv_app_khach_hang_*). Còn lại ⇒ lỗi "App không hỗ trợ".
 */
import { CustomerCloudService } from "../../services/CustomerCloudService";

const searchText = (payload: any) =>
  String(payload?.InputSearch ?? payload?.inputSearch ?? payload?.Keyword ?? payload?.keyword ?? "").trim();

const unsupported = (path: string) => async () => {
  console.log(`[lib/web shim] app không hỗ trợ CustomerService.${path}`);
  throw new Error(`App không hỗ trợ CustomerService.${path}`);
};
const guard = (obj: any, path: string): any =>
  new Proxy(obj, { get: (t, k) => (k in t ? t[k] : typeof k === "string" ? unsupported(`${path}${k}`) : undefined) });

export const CustomerService: any = guard(
  {
    filter: async (payload: any) => {
      const cloud = await CustomerCloudService.listCustomersFromCloud({
        keyword: searchText(payload),
        pageIndex: payload?.PageIndex,
        pageSize: payload?.PageSize,
      });
      return { status: 2000, data: cloud.rows, totalRow: cloud.total };
    },
    getById: async (payload: any) => {
      const id = payload?.MaKH ?? payload?.ID ?? payload;
      const found = await CustomerCloudService.getCustomerFromCloud(id);
      return { status: 2000, data: found || null };
    },
    getById2: async (maKH: any) => {
      const found = await CustomerCloudService.getCustomerFromCloud(maKH);
      return { status: 2000, data: found || null };
    },
    getList: async (payload: any) => {
      const cloud = await CustomerCloudService.listCustomersFromCloud({
        keyword: searchText(payload),
        pageIndex: payload?.PageIndex,
        pageSize: payload?.PageSize,
        isPersonal: payload?.IsPersonal ?? null,
        isNoxh: payload?.IsNoxh ?? null,
        companyId: payload?.CompanyId ?? null,
      });
      return { status: 2000, data: (cloud.rows || []).map((r: any) => ({ ...r, TotalRows: cloud.total })), totalRow: cloud.total };
    },
    // Danh mục "Quỹ danh" / "Ngân hàng" của form khách web (usePriceSheetCatalogs) — app không hiện ⇒ rỗng đúng dạng web
    getNganHang: async () => ({ status: 2000, data: [] }),
    DanhMuc: guard({ getQuyDanhList: async () => ({ status: 2000, data: [] }) }, "DanhMuc."),
  },
  ""
);
export default CustomerService;

/**
 * SHIM VIẾT TAY — thay web src/services/Project.js (service cũ) cho module web chép ở lib/web.
 * Chỉ ProjectService.CauHinh.{get, getDetailById, getDetailByIdByDetail} (thân hàm CHÉP từ web: chỉ gọi PricingConfigCloudService —
 * bản chép, đọc bảng cấu hình qua shim supabase ⇒ fn_nv_app_cau_hinh_tinh_gia_*). Còn lại ⇒ lỗi "App không hỗ trợ".
 */
import { PricingConfigCloudService } from "../../services/PricingConfigCloudService";

const unsupported = (path: string) => async () => {
  console.log(`[lib/web shim] app không hỗ trợ ProjectService.${path}`);
  throw new Error(`App không hỗ trợ ProjectService.${path}`);
};
const guard = (obj: any, path: string): any =>
  new Proxy(obj, { get: (t, k) => (k in t ? t[k] : typeof k === "string" ? unsupported(`${path}${k}`) : undefined) });

const CauHinh = {
  /* Cấu hình tính giá của dự án — Cloud-only, khoá theo uuid công ty + dự án */
  get: async (payload: any) => {
    const shared = await PricingConfigCloudService.listShared(payload?.FormCode).catch(() => []);
    const cloudRows = await PricingConfigCloudService.list(payload?.MaDA, payload?.FormCode);
    const has = new Set(cloudRows.map((r: any) => String(r?.ID ?? "")));
    const data = [...cloudRows, ...shared.filter((s: any) => !has.has(String(s?.ID ?? "")))];
    return { status: 2000, data, totalRow: data.length };
  },
  getDetailById: async (payload: any) => {
    const data = await PricingConfigCloudService.listRounds(payload?.ID ?? payload).catch(() => []);
    return { status: 2000, data };
  },
  getDetailByIdByDetail: async (payload: any) => {
    const found = await PricingConfigCloudService.getRound(payload?.ID ?? payload).catch(() => null);
    if (!found) return { status: 5000, message: "Không tìm thấy lần chiết khấu" };
    return {
      status: 2000,
      info: { ID: found.ID, Name: found.Name, LoaiCK: found.LoaiCK, OrderBy: found.OrderBy, CauHinhId: found.CauHinhId },
      details: found.Details,
    };
  },
};

export const ProjectService: any = guard({ CauHinh: guard(CauHinh, "CauHinh.") }, "");
export default ProjectService;

// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/ProjectDaCloudService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Đọc danh sách dự án từ bảng MỚI `public.da_projects`.
 *
 * - Không truyền ma_ctdk qua header/param nữa: tenant lấy từ TÀI KHOẢN ĐĂNG NHẬP
 *   (claim company_id trong token — uuid của bảng cloud_companies).
 * - Trả về dữ liệu đã map sang tên trường cũ (MaDA, TenDA, ...) để UI dùng lại.
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { sessionCompanyId } from "../_shims/lib/session";
import { SalesSettingsService } from "./SalesSettingsService";
import { clearDaProjectCache } from "./DaProjectCatalog";
import { clearApiCache } from "../lib/apiCache";
import { tenant } from "./CloudMirror";
import { cleanCompanyIds } from "../_extract/services/system/permitted-company";

export interface DaProjectQuery {
  InputSearch?: string;
  PageIndex?: number;
  PageSize?: number;
  /** Đường dẫn màn hình (để máy chủ áp phạm vi dữ liệu của nhóm quyền) */
  Form?: string;
  /** Công ty đang lọc (uuid) — máy chủ cắt theo trần phạm vi */
  CompanyIds?: string[];
}

const mapRow = (r: any) => ({
  id: r.id,
  MaDA: r.ma_da_code ?? r.id,
  MaDACode: r.ma_da_code ?? null,
  TenDA: r.ten_da ?? "",
  TenVietTat: r.ten_viet_tat ?? "",
  DiaChi: r.dia_chi ?? "",
  MaTT: r.ma_tt ?? null,
  TenTT: r.ten_tt ?? "",
  urinew: r.image_url ?? "",
  HinhThucPhanPhoi: r.hinh_thuc_phan_phoi ?? "qua_dai_ly",
  NgayNhap: r.created_at,
  NgaySua: r.updated_at,
  CompanyId: r.company_id ?? null,
  TenCongTy: r.ten_cong_ty ?? "",
  /** Công ty chủ đầu tư (da_projects.chu_dau_tu_id, manual 144) */
  ChuDauTuId: r.chu_dau_tu_id ?? null,
  TenChuDauTu: r.ten_chu_dau_tu ?? "",
});

/** Danh sách dự án theo tenant của tài khoản đang đăng nhập */
export const listProjectsFromDa = async (
  q: DaProjectQuery = {},
): Promise<{ data: any[]; total: number }> => {
  const companyId = sessionCompanyId();
  if (!companyId) return { data: [], total: 0 };

  const pageIndex = Math.max(1, Number(q.PageIndex ?? 1));
  const pageSize = Math.max(1, Number(q.PageSize ?? 20));
  const from = (pageIndex - 1) * pageSize;

  let query = supabase
    .from("da_projects" as any)
    .select("*", { count: "exact" })
    .eq("ma_ctdk", companyId);

  const kw = String(q.InputSearch ?? "").trim();
  if (kw) {
    const esc = kw.replace(/[%,]/g, " ");
    query = query.or(
      `ten_da.ilike.%${esc}%,ten_viet_tat.ilike.%${esc}%,dia_chi.ilike.%${esc}%`,
    );
  }

  const { data, error, count } = await query
    .order("ten_da", { ascending: true })
    .range(from, from + pageSize - 1);

  if (error) throw error;

  const total = count ?? 0;
  const rows = (data ?? []).map((r: any) => ({ ...mapRow(r), TotalRows: total }));
  return { data: rows, total };
};

// ============ Màn Quản lý dự án — RPC máy chủ (quyền form + phạm vi dự án được gán) ============

/** Lỗi PostgREST → Error mang thông điệp nghiệp vụ của máy chủ */
const rpcError = (error: any, fallback: string) =>
  new Error(String(error?.message || "").trim() || fallback);

/** Dự án có ghi thì nhớ đệm danh mục dự án ở các màn khác phải đọc lại */
const clearProjectCaches = () => {
  clearDaProjectCache();
  clearApiCache(`catalog:${tenant()}:du_an:`);
};

export interface ManagedProjectPayload {
  id?: string | null;
  ten_da?: string;
  ten_viet_tat?: string | null;
  dia_chi?: string | null;
  ten_tt?: string | null;
  image_url?: string | null;
  hinh_thuc_phan_phoi?: string;
  ma_da_code?: string | null;
  /** Công ty chủ đầu tư (công ty loại chu_dau_tu); null = bỏ CĐT, không gửi = giữ nguyên */
  chu_dau_tu_id?: string | null;
  images?: Partial<Record<"anh_icon" | "anh_so_do" | "anh_background" | "anh_so_do_3d", string>>;
}

/**
 * Danh sách dự án (`fn_da_project_list`, dùng chung cho mọi ô chọn dự án — không chặn theo form): chỉ trả dự án
 * người dùng được xem (full access/admin: mọi dự án công ty; còn lại: dự án được gán). `companyEmpty` =
 * công ty chưa có dự án nào (để gợi ý tạo dự án mẫu).
 */
export const listManagedProjects = async (
  q: DaProjectQuery = {},
): Promise<{ data: any[]; total: number; companyEmpty: boolean; cdtOptions: { id: string; ten: string }[] }> => {
  const { data, error } = await supabase.rpc("fn_da_project_list" as any, {
    p_keyword: String(q.InputSearch ?? "").trim() || null,
    p_page: Math.max(1, Number(q.PageIndex ?? 1)),
    p_size: Math.max(1, Number(q.PageSize ?? 50)),
    p_form: q.Form ?? null,
    p_company_ids: cleanCompanyIds(q.CompanyIds),
  } as any);
  if (error) throw rpcError(error, "Không thể tải danh sách dự án");
  const res: any = data ?? {};
  const total = Number(res.total ?? 0);
  const rows = (Array.isArray(res.rows) ? res.rows : []).map((r: any) => ({
    ...mapRow(r),
    ApDung: r.ap_dung ?? true,
    TotalRows: total,
  }));
  // cdt_options chỉ có khi gửi p_form (màn Quản lý dự án): ô "Công ty chủ đầu tư" của drawer Thêm / Sửa
  const cdtRaw: { id?: unknown; ten?: unknown }[] = Array.isArray(res.cdt_options) ? res.cdt_options : [];
  const cdtOptions = cdtRaw
    .filter((o) => o?.id)
    .map((o) => ({ id: String(o.id), ten: String(o.ten ?? "") }));
  return { data: rows, total, companyEmpty: res.company_empty === true, cdtOptions };
};

/** Thêm (không `id`) / sửa (có `id`) dự án + ảnh trong 1 giao dịch. Khoá có mặt mới ghi. */
export const saveManagedProject = async (
  payload: ManagedProjectPayload,
): Promise<{ id: string; ma_da_code: string | null; created: boolean }> => {
  const { data, error } = await supabase.rpc("fn_da_project_save" as any, { p: payload } as any);
  if (error) throw rpcError(error, "Không thể lưu dự án");
  clearProjectCaches();
  return data as any;
};

/** Xoá dự án; máy chủ chặn khi dự án còn dữ liệu liên quan */
export const deleteManagedProject = async (id: string): Promise<void> => {
  const { error } = await supabase.rpc("fn_da_project_delete" as any, { p_id: id } as any);
  if (error) throw rpcError(error, "Không thể xoá dự án");
  clearProjectCaches();
};

/** Import nhiều dự án 1 lần: trùng `ma_da_code` ⇒ sửa, không ⇒ thêm. `errors[].index` theo thứ tự `rows`. */
export const importManagedProjects = async (
  rows: ManagedProjectPayload[],
): Promise<{ created: number; updated: number; errors: { index: number; message: string }[] }> => {
  const { data, error } = await supabase.rpc("fn_da_project_import" as any, { p_rows: rows } as any);
  if (error) throw rpcError(error, "Không thể import dự án");
  clearProjectCaches();
  const res: any = data ?? {};
  return {
    created: Number(res.created ?? 0),
    updated: Number(res.updated ?? 0),
    errors: Array.isArray(res.errors) ? res.errors : [],
  };
};

/** Tiền cọc theo CÀI ĐẶT BÁN HÀNG hiệu lực (null nếu chưa cấu hình) */
export const getProjectDepositAmount = async (
  maDA: number | string | null | undefined,
): Promise<number | null> => {
  if (maDA == null || maDA === "") return null;
  const setting = await SalesSettingsService.resolve(maDA, new Date());
  const val = Number(setting?.tien_dat_coc);
  return Number.isFinite(val) && val > 0 ? val : null;
};

/** Số booking thiện chí tối đa/khách theo cài đặt bán hàng. Mặc định 1. */
export const getProjectBookingMax = async (
  maDA: number | string | null | undefined,
): Promise<number> => {
  if (maDA == null || maDA === "") return 1;
  const setting = await SalesSettingsService.resolve(maDA, new Date());
  const val = Number(setting?.so_booking_max);
  return Number.isFinite(val) && val > 0 ? val : 1;
};

/** Thời gian lock căn theo cài đặt bán hàng (PHÚT). Mặc định 30 phút. */
export const getProjectLockMinutes = async (
  maDA: number | string | null | undefined,
): Promise<number> => {
  if (maDA == null || maDA === "") return 30;
  const setting = await SalesSettingsService.resolve(maDA, new Date());
  const val = Number(setting?.thoi_gian_lock);
  return Number.isFinite(val) && val > 0 ? val : 30;
};

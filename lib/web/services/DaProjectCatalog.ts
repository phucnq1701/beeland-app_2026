// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/DaProjectCatalog.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * DANH MỤC DỰ ÁN — đã tách khỏi cloud_catalogs sang bảng riêng `public.da_projects`.
 *
 * - Tenant lưu bằng UUID công ty đăng ký (cloud_companies.id) lấy từ token đăng nhập.
 * - Giữ nguyên hình dạng dữ liệu cũ (MaDA, TenDA, ...) để UI không phải sửa.
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { sessionCompanyId } from "../_shims/lib/session";
import { memoAsync, clearApiCache } from "../lib/apiCache";

const str = (v: any) =>
  v === undefined || v === null || v === "" ? null : String(v);
const num = (v: any) => (v === undefined || v === null || v === "" ? null : Number(v));
const int = (v: any) => {
  const n = num(v);
  return n == null || Number.isNaN(n) ? null : Math.trunc(n);
};

export const projectCode = (row: any) => str(row?.MaDA ?? row?.ID ?? row?.id);

/** Chuyển 1 dòng da_projects về hình dạng cũ mà UI đang dùng */
export const mapDaProject = (r: any) => ({
  id: r.id,
  MaDA: r.ma_da_code ?? r.id,
  MaDACode: r.ma_da_code ?? null,
  TenDA: r.ten_da ?? "",
  TenVietTat: r.ten_viet_tat ?? "",
  DiaChi: r.dia_chi ?? "",
  MaTT: r.ma_tt ?? null,
  TenTT: r.ten_tt ?? "",
  urinew: r.image_url ?? "",
  ApDung: r.ap_dung ?? true,
  HinhThucPhanPhoi: r.hinh_thuc_phan_phoi ?? "qua_dai_ly",
  NgayNhap: r.created_at,
  NgaySua: r.updated_at,
});

const toRow = (ma_ctdk: string, row: any) => ({
  ma_ctdk,
  ma_da_code: projectCode(row),
  ten_da: str(row?.TenDA ?? row?.TenDuAn ?? row?.Name),
  ten_viet_tat: str(row?.TenVietTat),
  dia_chi: str(row?.DiaChi),
  ma_tt: str(row?.MaTT),
  ten_tt: str(row?.TenTT),
  image_url: str(row?.urinew ?? row?.uri),
  ap_dung: row?.ApDung === false ? false : true,
  hinh_thuc_phan_phoi: str(row?.HinhThucPhanPhoi) ?? "qua_dai_ly",
});

const tenantUid = () => {
  const id = sessionCompanyId();
  return id || null;
};

/** Đọc danh mục dự án của tenant hiện tại */
export const listDaProjects = async (): Promise<any[]> => {
  const ma_ctdk = tenantUid();
  if (!ma_ctdk) return [];
  const { data, error } = await supabase
    .from("da_projects" as any)
    .select("*")
    .eq("ma_ctdk", ma_ctdk)
    .order("ten_da", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapDaProject);
};

/** Ghi (mirror) nhiều dự án lên bảng da_projects */
export const saveDaProjects = async (rows: any[]) => {
  const ma_ctdk = tenantUid();
  if (!ma_ctdk || !rows?.length) return;

  const { data: existing } = await supabase
    .from("da_projects" as any)
    .select("id,ma_da_code")
    .eq("ma_ctdk", ma_ctdk);
  const byCode = new Map<string, any>();
  (existing ?? []).forEach((r: any) => {
    const code = str(r?.ma_da_code) ?? String(r.id);
    byCode.set(code, r);
  });

  const seen = new Set<string>();
  const payload = rows
    .map((r) => {
      const code = projectCode(r);
      if (!code || seen.has(code)) return null;
      seen.add(code);
      const prev = byCode.get(code);
      return {
        ...(prev?.id ? { id: prev.id } : {}),
        ...toRow(ma_ctdk, r),
      };
    })
    .filter(Boolean);
  if (!payload.length) return;
  const { error } = await supabase.from("da_projects" as any).upsert(payload as any);
  if (error) throw error;
  clearDaProjectCache();
};

/** Xoá 1 dự án theo mã cũ (MaDA) hoặc uuid */
export const removeDaProject = async (code: any) => {
  const ma_ctdk = tenantUid();
  if (!ma_ctdk || code == null) return;
  const key = String(code);
  const { data } = await supabase
    .from("da_projects" as any)
    .select("id,ma_da_code")
    .eq("ma_ctdk", ma_ctdk);
  const hit = (data ?? []).find(
    (r: any) => String(r?.ma_da_code ?? r.id) === key || String(r.id) === key
  );
  if (!hit) return;
  const { error } = await supabase
    .from("da_projects" as any)
    .delete()
    .eq("id", (hit as any).id);
  if (error) throw error;
};

/**
 * Bảng tra cứu dự án của tenant (id, ma_da_code, ten_da) — có nhớ đệm ngắn hạn để
 * một lượt mở form không phải tra bảng `da_projects` nhiều lần.
 */
const projectIndex = async (ma_ctdk: string): Promise<any[]> =>
  memoAsync(`daproj:index:${ma_ctdk}`, async () => {
    const { data } = await supabase
      .from("da_projects" as any)
      .select("id,ma_da_code,ten_da")
      .eq("ma_ctdk", ma_ctdk);
    return (data ?? []) as any[];
  });

/** Xóa nhớ đệm bảng tra cứu dự án (gọi sau khi ghi/xóa dự án) */
export const clearDaProjectCache = () => clearApiCache("daproj:index:");

/** Đọc 1 dòng dự án theo mã cũ hoặc uuid */
export const getDaProjectRaw = async (code: any): Promise<any | null> => {
  const ma_ctdk = tenantUid();
  if (!ma_ctdk || code == null) return null;
  const key = String(code);
  const rows = await projectIndex(ma_ctdk);
  const hit = rows.find(
    (r: any) => String(r?.ma_da_code ?? r.id) === key || String(r.id) === key
  );
  return hit ?? null;
};

/** Không còn cột raw trên da_projects — giữ hàm để tương thích lời gọi cũ */
export const patchDaProjectRaw = async (_code: any, _patch: Record<string, any>) => false;

export const DaProjectCatalog = {
  listDaProjects,
  saveDaProjects,
  removeDaProject,
  getDaProjectRaw,
  patchDaProjectRaw,
};

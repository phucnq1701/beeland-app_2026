/**
 * SHIM VIẾT TAY — thay web src/services/CodeGenService (sinh số phiếu theo quy tắc đánh mã cloud_code_rules).
 *  - generateFormCode: như web (bỏ biến rỗng, form viết hoa, lỗi / chưa cấu hình ⇒ null) qua fn_nv_app_ma_phieu (SP 76 = đúng
 *    fn_generate_form_code của web, công ty từ phiên). Chỉ XEM TRƯỚC: không ghi bộ đếm; lưu trùng số ⇒ máy chủ tự tăng.
 *  - getProjectCodeVars / projectTenDA: như web ({TenDA} = tên viết tắt dự án, trống mới dùng tên đầy đủ), đọc dự án qua shim
 *    bảng da_projects (fn_nv_app_du_an_list).
 * Form phiếu tính giá web không gọi các hàm này lúc mở form (máy chủ cấp số khi lưu); form booking web gọi khi mở form.
 */
import { callNv } from "@/services/nvApi";
import { supabase } from "../integrations/supabase/client";

type RenderVars = Record<string, string | number | null | undefined>;

export const NO_CODE_RULE = "Chưa cấu hình đánh mã";

export const generateFormCode = async (
  formCode: string,
  vars: RenderVars = {},
  opts: { keepEmpty?: boolean } = {}
): Promise<string | null> => {
  if (!formCode) return null;
  try {
    const cleanVars: Record<string, string> = {};
    Object.entries(vars || {}).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (opts.keepEmpty || String(v).trim() !== "") cleanVars[k] = String(v);
    });
    const data = await callNv<any>("fn_nv_app_ma_phieu", {
      p_form_code: String(formCode).trim().toUpperCase(),
      p_vars: cleanVars,
    });
    const code = String(data ?? "").trim();
    return code || null;
  } catch (e) {
    console.warn("[CodeGen] không sinh được mã cho form", formCode, e);
    return null;
  }
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getProjectCodeVars = async (projectId?: string | number | null): Promise<RenderVars> => {
  if (projectId == null || projectId === "") return {};
  try {
    const key = String(projectId);
    const q: any = supabase.from("da_projects").select("id, ten_da, ten_viet_tat, ma_da_code");
    const { data, error } = await (UUID_RE.test(key) ? q.eq("id", key) : q.eq("ma_da_code", key)).maybeSingle();
    if (error || !data) return {};
    const tenVietTat = String(data.ten_viet_tat ?? "").trim();
    const tenDA = String(data.ten_da ?? "").trim();
    const maDA = String(data.ma_da_code ?? data.id ?? "").trim();
    return { TenDA: tenVietTat || tenDA, MaDA: maDA };
  } catch (e) {
    console.warn("[CodeGen] không đọc được dự án", e);
    return {};
  }
};

export const projectTenDA = async (projectId?: string | number | null, fallback?: string | null): Promise<string> => {
  const v = await getProjectCodeVars(projectId);
  return String(v.TenDA || fallback || "").trim();
};

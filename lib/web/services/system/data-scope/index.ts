// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/system/data-scope/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../../../_shims/integrations/supabase/client";
import { sessionEmployeeId, sessionPermGroupUid } from "../../../_shims/lib/session";

/**
 * Phạm vi dữ liệu do MÁY CHỦ quyết định (Đợt 0-1 phân quyền dữ liệu):
 * - `fn_ds_company_tree()`: các công ty trong "trần" của người đăng nhập (kèm cha để dựng cây).
 * - `fn_ds_scope_info(p_form)`: nhóm quyền đặt form này theo COMPANY hay EMPLOYEE, có toàn quyền không.
 */

export interface DataScopeInfo {
  scope: "COMPANY" | "EMPLOYEE";
  full: boolean;
  /** số công ty trong trần; -1 = không giới hạn / không rõ */
  ceilingCount: number;
}

/** Dòng công ty thô từ `fn_ds_company_tree` */
export interface CompanyTreeRow {
  id: string;
  ten_ct: string | null;
  ten_ct_vt: string | null;
  parent_id: string | null;
  is_san: boolean | null;
}

export interface DsTreeNode {
  value: string;
  title: string;
  children?: DsTreeNode[];
}

const DEFAULT_INFO: DataScopeInfo = { scope: "COMPANY", full: false, ceilingCount: -1 };
const INFO_TTL_MS = 60_000;

let rowsCache: { key: string; data: Promise<CompanyTreeRow[]> } | null = null;
const infoCache = new Map<string, { at: number; data: Promise<DataScopeInfo> }>();

/** Dòng công ty trong trần (cache theo nhân viên đăng nhập; lỗi → [] và KHÔNG cache để lần sau thử lại) */
export const getCompanyTreeRows = (): Promise<CompanyTreeRow[]> => {
  const key = String(sessionEmployeeId() || "");
  if (rowsCache?.key === key) return rowsCache.data;
  const entry: { key: string; data: Promise<CompanyTreeRow[]> } = { key, data: null as any };
  entry.data = Promise.resolve(supabase.rpc("fn_ds_company_tree" as any))
    .then((r: any) => {
      if (r?.error) throw r.error;
      return ((r?.data as any[]) || []).map((c) => ({
        id: String(c.id),
        ten_ct: c.ten_ct ?? null,
        ten_ct_vt: c.ten_ct_vt ?? null,
        parent_id: c.parent_id ? String(c.parent_id) : null,
        is_san: c.is_san ?? null,
      })) as CompanyTreeRow[];
    })
    .catch(() => {
      if (rowsCache === entry) rowsCache = null;
      return [] as CompanyTreeRow[];
    });
  rowsCache = entry;
  return entry.data;
};

const rowLabel = (c: CompanyTreeRow) =>
  String(c.ten_ct || "").trim() || String(c.ten_ct_vt || "").trim() || c.id;

/** Cây công ty trong trần (gốc = công ty cao nhất người dùng thấy) */
export const getCompanyTree = async (): Promise<DsTreeNode[]> => {
  const rows = await getCompanyTreeRows();
  const nodeById = new Map<string, DsTreeNode>(
    rows.map((c) => [c.id, { value: c.id, title: rowLabel(c), children: [] }])
  );
  const tree: DsTreeNode[] = [];
  rows.forEach((c) => {
    const node = nodeById.get(c.id)!;
    const parent = c.parent_id ? nodeById.get(c.parent_id) : undefined;
    if (parent) parent.children!.push(node);
    else tree.push(node);
  });
  const sort = (nodes: DsTreeNode[]) => {
    nodes.sort((a, b) => a.title.localeCompare(b.title, "vi"));
    nodes.forEach((n) => {
      if (n.children?.length) sort(n.children);
      else delete n.children;
    });
  };
  sort(tree);
  return tree;
};

/** Phạm vi của nhóm quyền hiện tại với 1 form (cache 60 s theo nhân viên|nhóm|form; lỗi → mặc định, không chặn màn) */
export const getScopeInfo = (form: string): Promise<DataScopeInfo> => {
  const key = `${sessionEmployeeId() || ""}|${sessionPermGroupUid()}|${form}`;
  const hit = infoCache.get(key);
  if (hit && Date.now() - hit.at < INFO_TTL_MS) return hit.data;
  const data = Promise.resolve(supabase.rpc("fn_ds_scope_info" as any, { p_form: form }))
    .then((r: any) => {
      if (r?.error) throw r.error;
      const d = Array.isArray(r?.data) ? r.data[0] : r?.data;
      if (!d) return { ...DEFAULT_INFO };
      return {
        scope: d.scope === "EMPLOYEE" ? "EMPLOYEE" : "COMPANY",
        full: d.full === true,
        ceilingCount: Number.isFinite(Number(d.ceiling_count)) ? Number(d.ceiling_count) : -1,
      } as DataScopeInfo;
    })
    .catch(() => ({ ...DEFAULT_INFO }));
  infoCache.set(key, { at: Date.now(), data });
  return data;
};

export const resetDataScopeInfoCache = (): void => {
  infoCache.clear();
};

export const resetCompanyTreeCache = (): void => {
  rowsCache = null;
};

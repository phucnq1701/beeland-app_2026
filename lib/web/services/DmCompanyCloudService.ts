// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/DmCompanyCloudService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { table, safe } from "./CloudMirror";
import { tenantCompanyId } from "./DmTenantRef";
import { saveAgency, deleteAgency } from "./agencies/agency-list";

/**
 * Công ty nội bộ & Sàn/Đại lý đọc trực tiếp từ bảng public.dm_companies.
 *
 * - Khóa nhận diện duy nhất là `id` (uuid).
 * - Phạm vi dữ liệu: `tenant_company_id` = uuid công ty đăng ký lấy TỪ TOKEN.
 * - `is_san = true`  -> Đại lý / sàn giao dịch.
 * - `is_san != true` -> Công ty nội bộ (Hệ thống > Tổ chức).
 */

export interface DmCompanyRow {
  ID: string;
  /** uuid bản ghi dm_companies (khóa ngoại cho nhân viên) */
  Id: string;
  /** giữ tên cũ cho UI: nay là uuid bản ghi */
  MaCT: string;
  TenCT: string | null;
  TenCTVT: string | null;
  DiaChi: string | null;
  DienThoai: string | null;
  Fax: string | null;
  Email: string | null;
  MaSoThue: string | null;
  IsSan: boolean;
  State: boolean;
  /** 'cty_ban_hang' | 'dai_ly' */
  LoaiCT: string | null;
  /** mã công ty cũ (dữ liệu legacy) */
  MaCTCode: string | null;
  MaDL: string | null;
  /** uuid công ty cha (đa cấp) */
  ParentId: string | null;
}

const SELECT =
  "id, ten_ct, ten_ct_vt, dia_chi, dien_thoai, fax, email, ma_so_thue, ma_dl, is_san, ap_dung, parent_id, loai_cong_ty";

const toRow = (r: any): DmCompanyRow => {
  const id = String(r?.id ?? "");
  return {
    ID: id,
    Id: id,
    MaCT: id,
    TenCT: r?.ten_ct ?? null,
    TenCTVT: r?.ten_ct_vt ?? null,
    DiaChi: r?.dia_chi ?? null,
    DienThoai: r?.dien_thoai ?? null,
    Fax: r?.fax ?? null,
    Email: r?.email ?? null,
    MaSoThue: r?.ma_so_thue ?? null,
    IsSan: r?.is_san === true,
    // UI hiện tại dùng State=false là Hoạt động, State=true là Ngừng.
    // dm_companies.ap_dung có ý nghĩa ngược lại: true=Hoạt động, false=Ngừng.
    State: typeof r?.ap_dung === "boolean" ? !r.ap_dung : false,
    LoaiCT: r?.loai_cong_ty ?? null,
    MaCTCode: id,
    MaDL: r?.ma_dl ?? null,
    ParentId: r?.parent_id ?? null,
  };
};

const queryCompanies = async (opts: {
  keyword?: string;
  isSan: boolean;
}): Promise<DmCompanyRow[]> => {
  const tenantId = await tenantCompanyId();
  if (!tenantId) return [];
  const res = await safe(async () => {
    let q = table("dm_companies")
      .select(SELECT)
      .eq("tenant_company_id", tenantId);
    // Đại lý: is_san = true. Công ty nội bộ: is_san khác true (null hoặc false)
    q = opts.isSan ? q.eq("is_san", true) : q.or("is_san.is.null,is_san.eq.false");

    const kw = (opts.keyword || "").trim();
    if (kw) q = q.or(`ten_ct.ilike.%${kw}%,ten_ct_vt.ilike.%${kw}%`);

    const { data, error } = await q.order("ten_ct_vt", { ascending: true });
    if (error) throw error;
    return (data as any[]) || [];
  });

  return ((res as any[]) || []).map(toRow);
};

/** Danh sách công ty nội bộ (không phải sàn) */
export const listDmCompanies = async (
  opts: { keyword?: string } = {}
): Promise<DmCompanyRow[]> => queryCompanies({ ...opts, isSan: false });

/** Danh sách đại lý / sàn giao dịch (is_san = true) */
export const listDmAgencies = async (
  opts: { keyword?: string } = {}
): Promise<DmCompanyRow[]> => queryCompanies({ ...opts, isSan: true });

/** Mọi công ty/đại lý của công ty đăng ký (1 lần đọc) */
const readTenantCompanies = async (tenantId: string): Promise<DmCompanyRow[]> =>
  (((await safe(async () => {
    const { data, error } = await table("dm_companies")
      .select(SELECT)
      .eq("tenant_company_id", tenantId)
      .order("ten_ct_vt", { ascending: true });
    if (error) throw error;
    return (data as any[]) || [];
  })) as any[]) || []).map(toRow);

/** Lọc trong `rows` các công ty nhân viên đăng nhập được xem (toàn quyền → tất cả) */
const permittedAmong = async (rows: DmCompanyRow[]): Promise<DmCompanyRow[]> => {
  const { sessionEmployeeId, sessionIsFullAccess, sessionBranchId } =
    await import("@/lib/session");
  if (sessionIsFullAccess()) return rows;

  const empId = sessionEmployeeId();
  let allowed = new Set<string>();
  if (empId) {
    const emp = await safe(async () => {
      const { data, error } = await table("dm_employees")
        .select("company_id, company_ids")
        .eq("id", empId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    });
    const ids = [
      ...(Array.isArray((emp as any)?.company_ids) ? (emp as any).company_ids : []),
      (emp as any)?.company_id,
    ];
    allowed = new Set(ids.filter(Boolean).map(String));
  }
  const branch = sessionBranchId();
  if (branch) allowed.add(branch);
  // Không có quyền công ty/đại lý nào -> không hiển thị công ty nào
  if (!allowed.size) return [];
  return rows.filter((r) => allowed.has(r.ID));
};

/**
 * Danh sách công ty/đại lý mà nhân viên đăng nhập được xem
 * (dm_employees.company_ids + company_id). Toàn quyền → xem tất cả.
 */
export const listMyPermittedCompanies = async (): Promise<DmCompanyRow[]> => {
  const tenantId = await tenantCompanyId();
  if (!tenantId) return [];
  return permittedAmong(await readTenantCompanies(tenantId));
};

export interface CompanyTreeNode {
  value: string;
  title: string;
  selectable: boolean;
  children?: CompanyTreeNode[];
}

/** Dựng cây theo parent_id: node được phân quyền chọn được, tổ tiên ngoài quyền chỉ hiển thị */
const buildPermittedTree = (
  allRows: DmCompanyRow[],
  permitted: DmCompanyRow[]
): CompanyTreeNode[] => {
  const allowedIds = new Set(permitted.map((r) => String(r.ID)));
  if (!allowedIds.size) return [];

  const byId = new Map(allRows.map((r) => [String(r.ID), r]));
  // Bổ sung tổ tiên để hiển thị theo cấp (không cho chọn)
  const visible = new Set<string>(allowedIds);
  allowedIds.forEach((id) => {
    let cur = byId.get(id)?.ParentId ? String(byId.get(id)!.ParentId) : "";
    let guard = 0;
    while (cur && byId.has(cur) && guard++ < 20) {
      visible.add(cur);
      cur = byId.get(cur)?.ParentId ? String(byId.get(cur)!.ParentId) : "";
    }
  });

  const build = (parentId: string | null): CompanyTreeNode[] =>
    allRows
      .filter((r) => {
        const pid = r.ParentId ? String(r.ParentId) : null;
        const own = parentId === null ? !pid || !byId.has(pid) : pid === parentId;
        return own && visible.has(String(r.ID));
      })
      .map((r) => {
        const children = build(String(r.ID));
        return {
          value: String(r.ID),
          title: r.TenCT || r.TenCTVT || String(r.ID),
          selectable: allowedIds.has(String(r.ID)),
          ...(children.length ? { children } : {}),
        } as CompanyTreeNode;
      });

  return build(null);
};

/**
 * Cây công ty/đại lý theo cấp (parent_id) — chỉ node được phân quyền mới chọn được,
 * node cha ngoài phạm vi quyền chỉ hiển thị để thấy cấp bậc.
 */
export const listMyPermittedCompanyTree = async (): Promise<CompanyTreeNode[]> =>
  (await listMyPermittedCompanyFilter()).tree;

/** Danh sách + cây công ty được phân quyền cho ô lọc — đọc bảng công ty 1 lần */
export const listMyPermittedCompanyFilter = async (): Promise<{
  rows: DmCompanyRow[];
  tree: CompanyTreeNode[];
}> => {
  const tenantId = await tenantCompanyId();
  if (!tenantId) return { rows: [], tree: [] };
  const allRows = await readTenantCompanies(tenantId);
  const rows = await permittedAmong(allRows);
  return { rows, tree: buildPermittedTree(allRows, rows) };
};

export const DmCompanyCloudService = {
  list: listDmCompanies,
  listAgencies: listDmAgencies,
  listMyPermittedCompanies,
  listMyPermittedCompanyTree,
  listMyPermittedCompanyFilter,
};

export interface DmCompanyInput {
  /** uuid bản ghi khi cập nhật (bỏ trống khi thêm mới) */
  Id?: string | null;
  MaCT?: string | null;
  TenCTVT?: string | null;
  TenCT?: string | null;
  DiaChi?: string | null;
  DienThoai?: string | null;
  Fax?: string | null;
  Email?: string | null;
  MaSoThue?: string | null;
  /** UI: false = Hoạt động, true = Ngừng */
  State?: boolean;
  IsSan?: boolean;
  /** 'cty_ban_hang' = Công ty bán hàng, 'dai_ly' = Đại lý */
  LoaiCT?: string | null;
  MaCTCode?: string | null;
  /** uuid công ty cha (bỏ trống = cấp cao nhất) */
  ParentId?: string | null;
}

/**
 * Ghi công ty nội bộ: `@/services/system/company` (RPC fn_dm_company_*). saveDmCompany / deleteDmCompany
 * (REST thẳng bảng) đã gỡ 2026-10-13.
 */

/** Thêm/cập nhật đại lý (is_san = true) — RPC fn_dm_agency_save (quyền form + tenant ở máy chủ) */
export const saveDmAgency = async (input: DmCompanyInput) =>
  (
    await saveAgency({
      Id: input.Id || input.MaCT || null,
      TenCTVT: input.TenCTVT ?? "",
      TenCT: input.TenCT,
      DiaChi: input.DiaChi,
      DienThoai: input.DienThoai,
      Fax: input.Fax,
      State: input.State,
      LoaiCT: input.LoaiCT,
    })
  ).Id;

/** Xóa đại lý — RPC fn_dm_agency_delete (chặn khi còn nhân viên / đã phát sinh dữ liệu) */
export const deleteDmAgency = async (id: string) => deleteAgency(String(id));

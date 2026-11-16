// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/DataScopeService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * PHÂN QUYỀN DỮ LIỆU THEO NHÓM QUYỀN (sys_perm_group_forms.type_code)
 * -------------------------------------------------------------------
 * Mỗi chức năng (form) trong nhóm quyền có 1 phạm vi dữ liệu:
 *   - COMPANY  : xem toàn bộ dữ liệu của công ty (theo dự án đang lọc)
 *   - EMPLOYEE : chỉ xem dữ liệu do chính nhân viên đó tạo
 *
 * Chỉ áp dụng cho dữ liệu có gắn dự án (`da_projects`).
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { resetDataScopeInfoCache } from "./system/data-scope";
import {
  sessionEmployeeId,
  sessionIsFullAccess,
  sessionMaNV,
  sessionPermGroupUid,
  sessionClaims,
} from "../_shims/lib/session";

export type DataScope = "COMPANY" | "EMPLOYEE";

/** Cột "người tạo" của từng bảng có gắn dự án */
type OwnerKind = "uuid" | "text";
interface OwnerRule {
  column: string;
  kind: OwnerKind;
  /** Cột người nhập dạng chữ của dữ liệu cũ (chưa có UUID) */
  legacyText?: string;
}

const uuidOwner = (column: string, legacyText?: string): OwnerRule => ({
  column,
  kind: "uuid",
  legacyText,
});

/**
 * Mọi bảng dữ liệu có lọc theo dự án đều lưu người nhập bằng UUID trỏ
 * `dm_employees.id`.
 */
export const OWNER_COLUMNS: Record<string, OwnerRule> = {
  bds_products: uuidOwner("nguoi_nhap_id", "nguoi_nhap"),
  cloud_pre_bookings: uuidOwner("created_by_id"),
  cloud_booking_extra_payments: uuidOwner("created_by_id"),
  cloud_booking_merge_vouchers: uuidOwner("created_by_id"),
  cloud_booking_refund_vouchers: uuidOwner("created_by_id"),
  cloud_deposits: uuidOwner("nguoi_nhap_id"),
  cloud_contracts: uuidOwner("nguoi_nhap_id"),
  cloud_liquidations: uuidOwner("nguoi_nhap_id"),
  cloud_cash_vouchers: uuidOwner("nguoi_nhap"),
  cloud_pgc_phieu_giucho: uuidOwner("nguoi_nhap_id"),
  cloud_contract_transfers: uuidOwner("nguoi_nhap_id"),
  cloud_deposit_product_changes: uuidOwner("nguoi_nhap_id"),
  cloud_signing_appointments: uuidOwner("nguoi_nhap_id"),
  cloud_handovers: uuidOwner("nguoi_nhap_id"),
  cloud_debts: uuidOwner("nguoi_nhap_id"),
  da_sales_policies: uuidOwner("nguoi_nhap_id"),
  da_promotions: uuidOwner("nguoi_nhap_id"),
  priority_bookings: uuidOwner("nguoi_nhap_id"),
  price_sheets: uuidOwner("nguoi_nhap_id"),
  price_lists: uuidOwner("nguoi_nhap_id"),
  cloud_contract_appendices: uuidOwner("nguoi_nhap_id"),
  customer_info_appendices: uuidOwner("nguoi_nhap_id"),
};

const norm = (p?: string | null) =>
  String(p ?? "")
    .trim()
    .toLowerCase()
    .replace(/\/+$/, "");

let cache: { at: number; groupUid: string; map: Map<string, DataScope> } | null = null;
const CACHE_MS = 60_000;

export const resetDataScopeCache = () => {
  cache = null;
  resetDataScopeInfoCache();
};

/** Bản đồ đường dẫn form → phạm vi dữ liệu của nhóm quyền hiện tại */
export const loadDataScopes = async (): Promise<Map<string, DataScope>> => {
  const groupUid = sessionPermGroupUid();
  const now = Date.now();
  if (cache && cache.groupUid === groupUid && now - cache.at < CACHE_MS) {
    return cache.map;
  }
  const map = new Map<string, DataScope>();
  if (groupUid) {
    try {
      const { data, error } = await supabase
        .from("sys_perm_group_forms" as any)
        .select("type_code, has_permission, f:sys_forms!form_uid(form_path)")
        .eq("group_uid", groupUid);
      if (error) throw error;
      for (const r of (data || []) as any[]) {
        const path = norm(r?.f?.form_path);
        if (!path) continue;
        map.set(path, String(r?.type_code) === "EMPLOYEE" ? "EMPLOYEE" : "COMPANY");
      }
    } catch (e) {
      console.warn("[DataScopeService] loadDataScopes", e);
    }
  }
  cache = { at: now, groupUid, map };
  return map;
};

/** Phạm vi dữ liệu của 1 màn hình (mặc định COMPANY) */
export const currentFormPath = (): string => {
  try {
    return window.location.pathname || "";
  } catch {
    return "";
  }
};

export const scopeForPath = async (path?: string | null): Promise<DataScope> => {
  if (sessionIsFullAccess()) return "COMPANY";
  const key = norm(path ?? currentFormPath());
  if (!key) return "COMPANY";
  const map = await loadDataScopes();
  return map.get(key) ?? "COMPANY";
};

export const isEmployeeScope = async (path?: string | null) =>
  (await scopeForPath(path)) === "EMPLOYEE";

/** Các giá trị nhận dạng người dùng hiện tại (dạng text) */
export const ownerTextIdentities = (): string[] => {
  const out = new Set<string>();
  const add = (v: any) => {
    const s = String(v ?? "").trim();
    if (s) out.add(s);
  };
  const c = sessionClaims();
  add(c.email);
  add(sessionMaNV());
  try {
    const u = JSON.parse(localStorage.getItem("authUser") || "{}") || {};
    const d = u?.data || u;
    add(d?.UserName);
    add(d?.userName);
    add(d?.username);
    add(d?.TenDangNhap);
    add(d?.TenNV);
    add(d?.HoTen);
  } catch {
    /* phiên cũ không có dữ liệu */
  }
  return [...out];
};

/** uuid hồ sơ nhân viên hiện tại */
export const ownerEmployeeId = (): string => sessionEmployeeId();

/**
 * Gắn điều kiện "chỉ dữ liệu của tôi" vào truy vấn Supabase khi nhóm quyền
 * của màn hình đang là "Theo nhân viên".
 */
export const applyDataScope = async (
  table: string,
  formPath?: string | null,
): Promise<(query: any) => any> => {
  const rule = OWNER_COLUMNS[table];
  if (!rule) return (q: any) => q;
  if (!(await isEmployeeScope(formPath))) return (q: any) => q;

  if (rule.kind === "uuid") {
    const id = ownerEmployeeId() || "00000000-0000-0000-0000-000000000000";
    if (!rule.legacyText) return (q: any) => q.eq(rule.column, id);
    // Dữ liệu cũ chỉ có tên/mã người nhập dạng chữ ⇒ chấp nhận cả 2 cách
    const texts = ownerTextIdentities()
      .map((t) => t.replace(/[,()]/g, " ").trim())
      .filter(Boolean);
    const ors = [
      `${rule.column}.eq.${id}`,
      ...texts.map((t) => `${rule.legacyText}.eq.${t}`),
    ];
    return (q: any) => q.or(ors.join(","));
  }
  const ids = ownerTextIdentities();
  return (q: any) => q.in(rule.column, ids.length ? ids : ["__none__"]);
};

/**
 * Gắn UUID nhân viên đang đăng nhập vào bản ghi trước khi lưu (nếu bảng có
 * cột người nhập và bản ghi chưa có giá trị).
 */
export const stampOwner = <T extends Record<string, any>>(
  row: T,
  table: string,
): T => {
  const rule = OWNER_COLUMNS[table];
  if (!rule || rule.kind !== "uuid") return row;
  const id = ownerEmployeeId();
  if (!id) return row;
  const cur = (row as any)[rule.column];
  if (cur) return row;
  return { ...row, [rule.column]: id };
};

/** Gắn UUID nhân viên cho nhiều bản ghi */
export const stampOwnerAll = <T extends Record<string, any>>(
  rows: T[],
  table: string,
): T[] => (Array.isArray(rows) ? rows.map((r) => stampOwner(r, table)) : rows);

export const DataScopeService = {
  loadDataScopes,
  resetDataScopeCache,
  scopeForPath,
  isEmployeeScope,
  applyDataScope,
  stampOwner,
  stampOwnerAll,
  ownerTextIdentities,
  ownerEmployeeId,
  currentFormPath,
  OWNER_COLUMNS,
};

export default DataScopeService;

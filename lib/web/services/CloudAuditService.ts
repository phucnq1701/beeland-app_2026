// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/CloudAuditService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * CloudAuditService — nhật ký thao tác (audit log) cho các nghiệp vụ Cloud:
 * Đặt lịch ký, Đổi tên booking, Hoàn booking, Gộp booking.
 *
 * Ghi nhận: ai thực hiện, thời điểm, lý do và chi tiết thay đổi (trước → sau).
 * Dữ liệu tách theo mã công ty đăng ký (MaCTDK).
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { readCloudTenant } from "./cloudTenant";

const TBL = "cloud_audit_logs";

export type AuditModule =
  | "SIGNING"
  | "RENAME"
  | "REFUND"
  | "MERGE";

export const AUDIT_MODULE_LABEL: Record<string, string> = {
  SIGNING: "Đặt lịch ký",
  RENAME: "Đổi tên booking",
  REFUND: "Hoàn booking",
  MERGE: "Gộp booking",
};

export const AUDIT_ACTION_LABEL: Record<string, string> = {
  CREATE: "Tạo mới",
  UPDATE: "Cập nhật",
  DELETE: "Xóa",
  STATE: "Đổi trạng thái",
  APPROVE: "Duyệt",
  REJECT: "Từ chối",
  UNAPPROVE: "Hủy duyệt",
};

export interface AuditChange {
  field: string;
  label?: string;
  from: any;
  to: any;
}

const authUser = (): any => {
  try {
    return JSON.parse(localStorage.getItem("authUser") || "{}");
  } catch {
    return {};
  }
};

export const actor = () => {
  const u = authUser()?.data ?? {};
  return {
    id: String(u?.maNV ?? u?.id ?? ""),
    name: String(u?.hoTen ?? u?.tenNV ?? u?.userName ?? u?.email ?? ""),
  };
};

const norm = (v: any) =>
  v === undefined || v === null || v === "" ? null : v;

/** So sánh 2 object -> danh sách thay đổi (chỉ các field khác nhau). */
export const diffFields = (
  before: any,
  after: any,
  labels: Record<string, string> = {}
): AuditChange[] => {
  const out: AuditChange[] = [];
  const keys = Object.keys(after || {});
  keys.forEach((k) => {
    const a = norm(before?.[k]);
    const b = norm(after?.[k]);
    const sa = typeof a === "object" ? JSON.stringify(a) : String(a);
    const sb = typeof b === "object" ? JSON.stringify(b) : String(b);
    if (sa !== sb) out.push({ field: k, label: labels[k] || k, from: a, to: b });
  });
  return out;
};

export interface AuditInput {
  module: AuditModule;
  action: string;
  entityId?: any;
  entityCode?: string | null;
  entityName?: string | null;
  maDA?: number | null;
  reason?: string | null;
  changes?: AuditChange[];
  snapshot?: any;
  stateFrom?: string | null;
  stateTo?: string | null;
}

/** Ghi audit log (best-effort, không chặn nghiệp vụ nếu lỗi). */
export const writeAudit = async (input: AuditInput) => {
  try {
    const a = actor();
    await supabase.from(TBL as any).insert({
      ma_ctdk: readCloudTenant(),
      module: input.module,
      action: input.action,
      entity_id: input.entityId != null ? String(input.entityId) : null,
      entity_code: input.entityCode ?? null,
      entity_name: input.entityName ?? null,
      ma_da: input.maDA ?? null,
      reason: input.reason ?? null,
      changes: (input.changes ?? []) as any,
      snapshot: input.snapshot ?? null,
      state_from: input.stateFrom ?? null,
      state_to: input.stateTo ?? null,
      actor_id: a.id || null,
      actor_name: a.name || null,
    } as any);
  } catch {
    /* audit là best-effort */
  }
};

export const CloudAuditService = {
  writeAudit,
  diffFields,

  /** Danh sách nhật ký, lọc theo nghiệp vụ / hồ sơ / thời gian / từ khóa. */
  getList: async (payload: any = {}) => {
    const pageIndex = Number(payload.PageIndex) || 1;
    const pageSize = Number(payload.PageSize) || 50;
    let q = supabase
      .from(TBL as any)
      .select("*", { count: "exact" })
      .eq("ma_ctdk", readCloudTenant());

    if (payload.Module) q = q.eq("module", payload.Module);
    if (payload.EntityId) q = q.eq("entity_id", String(payload.EntityId));
    if (payload.MaDA) q = q.eq("ma_da", Number(payload.MaDA));
    if (payload.TuNgay) q = q.gte("created_at", payload.TuNgay);
    if (payload.DenNgay) q = q.lte("created_at", payload.DenNgay);
    if (payload.InputSearch) {
      const s = String(payload.InputSearch).replace(/[,%]/g, " ").trim();
      if (s)
        q = q.or(
          `entity_name.ilike.%${s}%,entity_code.ilike.%${s}%,actor_name.ilike.%${s}%,reason.ilike.%${s}%`
        );
    }
    const from = (pageIndex - 1) * pageSize;
    const { data, error, count } = await q
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) return { status: 5000, message: error.message, data: [] };
    return {
      status: 2000,
      data: ((data as any[]) || []).map((r) => ({
        ID: r.id,
        Module: r.module,
        ModuleName: AUDIT_MODULE_LABEL[r.module] || r.module,
        Action: r.action,
        ActionName: AUDIT_ACTION_LABEL[r.action] || r.action,
        EntityId: r.entity_id,
        EntityCode: r.entity_code,
        EntityName: r.entity_name,
        MaDA: r.ma_da,
        LyDo: r.reason,
        Changes: (r.changes as AuditChange[]) || [],
        Snapshot: r.snapshot,
        StateFrom: r.state_from,
        StateTo: r.state_to,
        NguoiThucHien: r.actor_name,
        MaNV: r.actor_id,
        ThoiDiem: r.created_at,
      })),
      totalCount: count ?? 0,
    };
  },
};

export default CloudAuditService;

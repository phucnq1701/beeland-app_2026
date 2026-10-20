import AsyncStorage from "@react-native-async-storage/async-storage";

import axiosApiSupabase from "./axiosApiSupabase";
import {
  decodeJwtPayload,
  getCompanyCode,
  getCompanyId,
  getEmployeeId,
  getMaNv,
  getTypeAccount,
  getValidSupabaseJwt,
} from "./cloudTenant";
import {
  CustomerDuplicateConfig,
  CustomerFormValues,
  DEFAULT_CUSTOMER_DUPLICATE,
  DUPLICATE_FIELDS,
  DuplicateField,
  DuplicateMode,
  DuplicateProtection,
  customerFormKey,
  duplicateValues,
  modeOf,
  normalizeDuplicateConfig,
  protectionFromStats,
  strictest,
} from "../lib/customerRules";

/**
 * Đọc/ghi Supabase cho luật khách hàng – chép từ web (chỉ đọc/ghi đúng bảng, cột web đang dùng):
 *  - Trùng khách: beeland/src/services/CustomerDuplicateService.ts, CustomerDuplicateConfigService.ts,
 *    CustomerDupRequestService.ts. Đợt 5 (ds_dot5, 2026-10-20) đã khoá đọc/ghi thẳng cloud_customers,
 *    cloud_customer_activities, cloud_customer_dup_requests/_logs ⇒ chỉ qua RPC: kiểm trùng `fn_customer_duplicate_check`
 *    (1 lời gọi: khớp + số liệu bảo vệ + người phụ trách), yêu cầu trùng `fn_customer_dup_request_*` / `fn_customer_dup_decide`
 *    (người gửi / công ty / nhật ký máy chủ tự lấy từ JWT).
 *  - Bắt buộc nhập / ẩn trường: RequiredFieldService.ts, FieldVisibilityService.ts
 *  - Khoá định danh: CustomerIdentityLockService.ts
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uid = (v: unknown): string | null => (UUID_RE.test(String(v ?? "")) ? String(v) : null);
const str = (v: unknown) => String(v ?? "").trim();

/** Mã công ty đăng ký dạng chữ thường – web `tenant()` (CloudMirror). */
async function tenantCode(): Promise<string> {
  return (await getCompanyCode()).trim().toLowerCase();
}

async function claims(): Promise<any> {
  const jwt = await getValidSupabaseJwt();
  return jwt ? decodeJwtPayload(jwt) : {};
}

/** Tên người đang đăng nhập (web currentUserName: họ tên, không có thì mã NV). */
export async function currentUserName(): Promise<string> {
  try {
    const raw = (await AsyncStorage.getItem("@user")) || (await AsyncStorage.getItem("user")) || "";
    const u = raw ? JSON.parse(raw) : {};
    const name = str(u?.ho_ten ?? u?.hoTen ?? u?.tenNV ?? u?.fullName ?? u?.data?.hoTen);
    if (name) return name;
  } catch {}
  return str(await getMaNv());
}

export type DuplicateMatch = {
  customerId: string;
  customerName: string;
  customerCode: string | null;
  isPersonal: boolean;
  email: string | null;
  phone: string | null;
  cccd: string | null;
  ownerId: string | null;
  ownerName: string | null;
  fields: DuplicateField[];
  values: Partial<Record<DuplicateField, string>>;
  protection: DuplicateProtection;
  isOwn: boolean;
  /** Khách ngoài phạm vi người nhập: máy chủ chỉ trả tên che + công ty (không người phụ trách / số liệu bảo vệ). */
  outOfScope: boolean;
  /** Chỉ thấy qua chứng từ: máy chủ che 4 số cuối CCCD (`limited`). */
  limited: boolean;
  /** Công ty sở hữu khách trùng. */
  companyName: string | null;
  mode: DuplicateMode;
};

export type DuplicateResult = { mode: DuplicateMode; matches: DuplicateMatch[] };

export type FormRules = {
  formKey: string;
  required: string[];
  hidden: Set<string>;
  readonly: Set<string>;
};

const NO_RULES = (formKey: string): FormRules => ({
  formKey,
  required: [],
  hidden: new Set(),
  readonly: new Set(),
});

const arr = (v: any): string[] => (Array.isArray(v) ? v.map(String) : []);

/** Tiêu chí máy chủ báo khách ngoài phạm vi (chỉ CCCD / SĐT – fn_customer_duplicate_check). */
const OUT_OF_SCOPE_FIELDS: DuplicateField[] = ["cccd", "phone"];

/** Yêu cầu trùng khách – web CustomerDupRequestService (DupRequestStatus / DupDecision / DupRequest / DupRequestLog). */
export type DupRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type DupDecision = "approve_new" | "use_existing" | "transfer" | "reject";
export type DupRequest = {
  id: string;
  ma_ctdk: string;
  company_id: string | null;
  trang_thai: DupRequestStatus;
  match_fields: string[];
  match_value: string | null;
  protection_level: string;
  protection_score: number;
  protection_detail: any;
  existing_customer_id: string | null;
  existing_customer_name: string | null;
  existing_owner_id: string | null;
  existing_owner_name: string | null;
  last_care_at: string | null;
  has_transaction: boolean;
  new_customer_payload: any;
  new_customer_name: string | null;
  requester_id: string | null;
  requester_name: string | null;
  requester_note: string | null;
  decided_by_id: string | null;
  decided_by_name: string | null;
  decision: DupDecision | null;
  decision_note: string | null;
  decided_at: string | null;
  created_at: string;
  /** Máy chủ trả: 'arbiter' (người phân xử) | 'requester' (người gửi). */
  access?: "arbiter" | "requester";
};
export type DupRequestLog = {
  id: string;
  request_id: string;
  hanh_dong: string;
  tu_trang_thai: string | null;
  den_trang_thai: string | null;
  nguoi_thuc_hien: string | null;
  ghi_chu: string | null;
  chi_tiet: any;
  created_at: string;
};

/** Gọi RPC; lỗi máy chủ (RAISE: quyền, ngoài phạm vi…) → Error(message) như web rpcRaw. */
async function dupRpc<T = any>(fn: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  try {
    const res = await axiosApiSupabase.post(`rest/v1/rpc/${fn}`, args);
    return res.data as T;
  } catch (e: any) {
    console.log(`ERROR ${fn}:`, e?.response?.data || e);
    throw new Error(String(e?.response?.data?.message || "").trim() || fallback);
  }
}

export const CustomerRulesService = {
  /** Cấu hình trùng khách (cloud_catalogs customer_duplicate/default theo uuid công ty); lỗi → mặc định web. */
  getDuplicateConfig: async (): Promise<CustomerDuplicateConfig> => {
    const companyId = await getCompanyId();
    if (!uid(companyId)) return DEFAULT_CUSTOMER_DUPLICATE;
    try {
      const res = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
        params: {
          select: "raw",
          ma_ctdk_uid: `eq.${companyId}`,
          catalog_type: "eq.customer_duplicate",
          item_code: "eq.default",
          limit: "1",
        },
      });
      const row = Array.isArray(res.data) ? res.data[0] : null;
      return row ? normalizeDuplicateConfig(row.raw) : DEFAULT_CUSTOMER_DUPLICATE;
    } catch (e) {
      console.log("ERROR getDuplicateConfig:", e);
      return DEFAULT_CUSTOMER_DUPLICATE;
    }
  },

  /**
   * Kiểm tra trùng như web checkCustomerDuplicate (beeland/src/services/CustomerDuplicateService.ts) – 1 RPC
   * `fn_customer_duplicate_check(p_values, p_fields, p_exclude_id)`: máy chủ khớp trong công ty (JWT), trả kèm số liệu bảo vệ
   * (txn_total / has_contract / has_deposit / has_booking / care_count / last_care_at / created_at) và owner_name.
   * excludeId: khách đang sửa. opts.scoped: màn Khách hàng lưu `scoped` (web CustomerFormModal `scopedSave`) ⇒ luôn dò
   * CCCD / SĐT và khách ngoài phạm vi tối thiểu "gửi yêu cầu" (chuyển giao).
   * Kết quả mode: allow → được lưu; request → phải gửi yêu cầu; block → không được lưu. Lỗi máy chủ ném Error(message).
   */
  checkDuplicate: async (
    values: CustomerFormValues,
    excludeId?: string | null,
    opts: { scoped?: boolean } = {}
  ): Promise<DuplicateResult> => {
    const empty: DuplicateResult = { mode: "allow", matches: [] };
    const config = await CustomerRulesService.getDuplicateConfig();
    const vals = duplicateValues(values);
    // Tiêu chí cần kiểm: có giá trị và cấu hình khác "cho phép" (scoped: luôn dò CCCD / SĐT để thấy khách ngoài phạm vi)
    const fields = DUPLICATE_FIELDS.map((f) => f.key).filter(
      (key) => !!vals[key] && (modeOf(config, key) !== "allow" || (!!opts.scoped && OUT_OF_SCOPE_FIELDS.includes(key)))
    );
    if (!fields.length) return empty;
    const scopeOnly = new Set(fields.filter((k) => modeOf(config, k) === "allow"));

    let data: any;
    try {
      const res = await axiosApiSupabase.post("rest/v1/rpc/fn_customer_duplicate_check", {
        p_values: vals,
        p_fields: fields,
        p_exclude_id: uid(excludeId) || null,
      });
      data = res.data;
    } catch (e: any) {
      console.log("ERROR checkDuplicate:", e?.response?.data || e);
      throw new Error(e?.response?.data?.message || "Không kiểm tra được trùng khách hàng");
    }

    const selfId = await getEmployeeId();
    const now = Date.now();
    const rows = (Array.isArray(data) ? data : []).filter(
      (r: any) =>
        r?.in_scope === false ||
        (Array.isArray(r?.fields) ? r.fields : []).some((k: DuplicateField) => fields.includes(k) && !scopeOnly.has(k))
    );
    const matches: DuplicateMatch[] = rows.map((r: any) => {
      const outOfScope = r.in_scope === false;
      const matched = ((Array.isArray(r.fields) ? r.fields : []) as DuplicateField[]).filter(
        (k) => fields.includes(k) && (outOfScope || !scopeOnly.has(k))
      );
      const ownerId = outOfScope ? null : uid(r.created_by_id);
      const name = str(r.ten_kh) || str(r.ten_cong_ty);
      const m: DuplicateMatch = {
        customerId: String(r.id),
        customerName: name || "(chưa có tên)",
        customerCode: str(r.ma_so_kh) || null,
        // Máy chủ không trả is_personal / email: chỉ có tên công ty (không họ tên) hoặc khớp MST ⇒ doanh nghiệp
        isPersonal: !(matched.includes("tax_code") || (!str(r.ten_kh) && !!str(r.ten_cong_ty))),
        email: null,
        phone: str(r.di_dong) || str(r.dien_thoai) || null,
        cccd: str(r.cccd) || null,
        ownerId,
        ownerName: outOfScope ? null : str(r.owner_name) || null,
        fields: matched,
        values: Object.fromEntries(matched.map((k) => [k, vals[k]])),
        protection: protectionFromStats(r, config, now),
        isOwn: !!selfId && !!ownerId && ownerId === selfId,
        outOfScope,
        limited: r.limited === true,
        companyName: str(r.company_name) || null,
        mode: matched.reduce<DuplicateMode>((acc, k) => strictest(acc, modeOf(config, k)), "allow"),
      };
      if (outOfScope) {
        // Không có số liệu bảo vệ; màn Khách hàng: máy chủ không cho tạo / gắn ⇒ chỉ còn gửi yêu cầu chuyển giao
        if (opts.scoped) m.mode = "request";
      } else if (m.isOwn) {
        m.mode = config.ownDuplicateMode;
        m.protection.reasons.unshift("Khách do chính bạn nhập trước đó");
      } else if (m.protection.ruleMode) {
        m.mode = strictest(m.mode, m.protection.ruleMode);
      }
      return m;
    });
    if (!matches.length) return empty;
    const mode = matches.reduce<DuplicateMode>((acc, m) => strictest(acc, m.mode), "allow");
    return { mode, matches };
  },

  /**
   * Gửi yêu cầu khi bị trùng ở chế độ "request" – web CustomerDupRequestService.create → `fn_customer_dup_request_create`.
   * Người gửi / công ty / nhật ký "create" máy chủ tự ghi từ JWT; gửi lại khi còn yêu cầu chờ ⇒ máy chủ trả yêu cầu cũ.
   */
  createDuplicateRequest: async (
    match: DuplicateMatch,
    values: CustomerFormValues,
    note?: string
  ): Promise<{ ok: boolean; id?: string; message?: string }> => {
    try {
      const r = await dupRpc<{ ok?: boolean; id?: string }>(
        "fn_customer_dup_request_create",
        {
          p_existing_customer_id: match.customerId,
          p_match_fields: match.fields,
          p_match_value: match.fields.map((f) => match.values[f]).filter(Boolean).join(", ") || null,
          p_protection: match.protection ?? null,
          p_new_payload: toWebCustomerPayload(values),
          p_note: note || null,
        },
        "Gửi yêu cầu không thành công"
      );
      return r?.ok ? { ok: true, id: str(r.id) } : { ok: false, message: "Gửi yêu cầu không thành công" };
    } catch (e: any) {
      return { ok: false, message: e?.message || "Gửi yêu cầu không thành công" };
    }
  },

  /** Danh sách yêu cầu trùng người gọi thấy (người gửi / người phân xử) – web list. Lỗi ném ra để màn báo. */
  listDuplicateRequests: async (params?: { status?: DupRequestStatus | "all"; keyword?: string }): Promise<DupRequest[]> => {
    const rows = await dupRpc<DupRequest[]>(
      "fn_customer_dup_request_list",
      {
        p_status: params?.status && params.status !== "all" ? params.status : null,
        p_keyword: str(params?.keyword) || null,
      },
      "Không tải được danh sách yêu cầu trùng khách"
    );
    return Array.isArray(rows) ? rows : [];
  },

  /** Nhật ký 1 yêu cầu trùng – web logs. */
  duplicateRequestLogs: async (requestId: string): Promise<DupRequestLog[]> => {
    const rows = await dupRpc<DupRequestLog[]>(
      "fn_customer_dup_request_logs",
      { p_id: requestId },
      "Không tải được nhật ký yêu cầu"
    );
    return Array.isArray(rows) ? rows : [];
  },

  /** Phân xử (quyền Sửa màn Khách hàng; chuyển giao làm trên máy chủ) – web decide → `fn_customer_dup_decide`. */
  decideDuplicateRequest: async (
    requestId: string,
    decision: DupDecision,
    note?: string
  ): Promise<{ ok: boolean; message?: string }> => {
    try {
      const r = await dupRpc<{ ok?: boolean }>(
        "fn_customer_dup_decide",
        { p_id: requestId, p_decision: decision, p_note: note || null },
        "Phân xử không thành công"
      );
      return r?.ok ? { ok: true } : { ok: false, message: "Phân xử không thành công" };
    } catch (e: any) {
      return { ok: false, message: e?.message || "Phân xử không thành công" };
    }
  },

  /** Bổ sung ý kiến / ghi chú thêm – web comment. */
  commentDuplicateRequest: async (requestId: string, note: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      await dupRpc("fn_customer_dup_request_comment", { p_id: requestId, p_note: note }, "Không ghi được ý kiến");
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.message || "Không ghi được ý kiến" };
    }
  },

  /** Người gửi rút yêu cầu đang chờ – web cancel. */
  cancelDuplicateRequest: async (requestId: string, note?: string): Promise<{ ok: boolean; message?: string }> => {
    try {
      await dupRpc("fn_customer_dup_request_cancel", { p_id: requestId, p_note: note || null }, "Huỷ yêu cầu không thành công");
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.message || "Huỷ yêu cầu không thành công" };
    }
  },

  /** Yêu cầu đã duyệt (cho tạo mới / chuyển giao) gần nhất của khách đang trùng – web findApprovalFor; lỗi → null. */
  findDuplicateApproval: async (customerId: string): Promise<DupRequest | null> => {
    try {
      return (
        (await dupRpc<DupRequest | null>("fn_customer_dup_request_find_approval", { p_customer_id: customerId }, "")) ||
        null
      );
    } catch {
      return null;
    }
  },

  /**
   * Cấu hình bắt buộc nhập + ẩn/chỉ đọc trường cho form khách (cá nhân / doanh nghiệp).
   * Lỗi đọc → không ràng buộc thêm (như web).
   */
  getFormRules: async (isPersonal: boolean): Promise<FormRules> => {
    const isAgency = (await getTypeAccount()) === "AGENCY";
    return CustomerRulesService.getRulesForForm(customerFormKey(isPersonal, isAgency));
  },

  /**
   * Cấu hình bắt buộc nhập + ẩn/chỉ đọc trường của 1 form theo `form_key` (web RequiredFieldService +
   * FieldVisibilityService). Lỗi đọc → không ràng buộc thêm.
   */
  getRulesForForm: async (formKey: string): Promise<FormRules> => {
    const code = await tenantCode();
    const c = await claims();
    let required: Record<string, any> = {};
    try {
      const res = await axiosApiSupabase.get("rest/v1/cloud_required_field_configs", {
        params: { select: "form_key,required_fields,is_active", ma_ctdk: `eq.${code}` },
      });
      for (const r of Array.isArray(res.data) ? res.data : []) required[r.form_key] = r;
    } catch (e) {
      console.log("ERROR getFormRules required:", e);
      required = {};
    }
    const rules = NO_RULES(formKey);
    const cfg = required[formKey];
    if (cfg && cfg.is_active !== false) rules.required = arr(cfg.required_fields);

    // Tài khoản toàn quyền không bị ẩn trường (web FieldVisibilityService.preload)
    if (c?.is_full_access) return rules;
    try {
      const groupUid = await permGroupUid(c);
      const res = await axiosApiSupabase.get("rest/v1/cloud_field_visibility_configs", {
        params: {
          select: "group_uid,form_key,hidden_fields,readonly_fields,is_active",
          ma_ctdk: `eq.${code}`,
          form_key: `eq.${formKey}`,
        },
      });
      const rows = (Array.isArray(res.data) ? res.data : [])
        .filter((r: any) => r.is_active !== false && (!r.group_uid || (groupUid && r.group_uid === groupUid)))
        // Cấu hình riêng của nhóm ghi đè cấu hình chung
        .sort((a: any, b: any) => (a.group_uid ? 1 : 0) - (b.group_uid ? 1 : 0));
      for (const r of rows) {
        rules.hidden = new Set(arr(r.hidden_fields));
        rules.readonly = new Set(arr(r.readonly_fields));
      }
    } catch (e) {
      console.log("ERROR getFormRules visibility:", e);
    }
    return rules;
  },

  /** Khách đã có lịch ký cá nhân → khoá Họ tên & CCCD (web hasPersonalSigningAppointment). */
  hasIdentityLock: async (customerId: string): Promise<boolean> => {
    const companyId = await getCompanyId();
    if (!uid(customerId) || !uid(companyId)) return false;
    try {
      const res = await axiosApiSupabase.get("rest/v1/cloud_signing_appointments", {
        params: {
          select: "seq",
          ma_ctdk_uid: `eq.${companyId}`,
          is_personal: "eq.true",
          khach_hang_id: `eq.${customerId}`,
          limit: "1",
        },
      });
      return Array.isArray(res.data) && res.data.length > 0;
    } catch {
      return false;
    }
  },
};

export const IDENTITY_LOCK_HINT =
  "Khách hàng đã có lịch ký — không sửa được Họ tên và Số CMND/CCCD (trừ khi xoá lịch ký)";

/** Dữ liệu khách dạng PascalCase như form web (để quản lý xem trong yêu cầu trùng). */
export function toWebCustomerPayload(v: CustomerFormValues): Record<string, any> {
  const s = (x: string) => str(x) || null;
  return {
    IsPersonal: v.isPersonal,
    TenKH: s(v.name),
    TenCongTy: v.isPersonal ? null : s(v.name),
    DiDong: s(v.phone),
    DiDong2: s(v.phone2),
    Email: s(v.email),
    SoCMND: v.isPersonal ? s(v.cccd) : null,
    MaSoThueCT: v.isPersonal ? null : s(v.taxCode),
    MaSoTTNCN: v.isPersonal ? s(v.taxCode) : null,
    DiaChi: s(v.diaChi),
    MaTT: s(v.statusId),
    MaNguon: s(v.sourceId),
  };
}

/** Nhóm quyền: claim per_id (uuid) → dm_employees.perm_group_uid (web resolveGroupUid, bỏ nhánh bảng phụ). */
async function permGroupUid(c: any): Promise<string> {
  const fromToken = uid(c?.per_id);
  if (fromToken) return fromToken;
  const employeeId = await getEmployeeId();
  if (!uid(employeeId)) return "";
  try {
    const res = await axiosApiSupabase.get("rest/v1/dm_employees", {
      params: { select: "perm_group_uid", id: `eq.${employeeId}`, limit: "1" },
    });
    const r = Array.isArray(res.data) ? res.data[0] : null;
    return uid(r?.perm_group_uid) || "";
  } catch {
    return "";
  }
}

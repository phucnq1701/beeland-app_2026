import AsyncStorage from "@react-native-async-storage/async-storage";

import axiosApiSupabase from "./axiosApiSupabase";
import {
  decodeJwtPayload,
  getBranchId,
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
  DUPLICATE_FIELD_COLUMNS,
  DUPLICATE_FIELDS,
  DuplicateField,
  DuplicateMode,
  DuplicateProtection,
  customerFormKey,
  duplicateValues,
  evaluateProtection,
  finalDuplicateMode,
  modeOf,
  normalizeDuplicateConfig,
  strictest,
} from "../lib/customerRules";

/**
 * Đọc/ghi Supabase cho luật khách hàng – chép từ web (chỉ đọc/ghi đúng bảng, cột web đang dùng):
 *  - Trùng khách: beeland/src/services/CustomerDuplicateService.ts, CustomerDuplicateConfigService.ts,
 *    CustomerDupRequestService.ts
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
  phone: string | null;
  cccd: string | null;
  ownerId: string | null;
  ownerName: string | null;
  fields: DuplicateField[];
  values: Partial<Record<DuplicateField, string>>;
  protection: DuplicateProtection;
  isOwn: boolean;
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
   * Kiểm tra trùng như web checkCustomerDuplicate. excludeId: khách đang sửa (không tự trùng với chính nó).
   * Kết quả mode: allow → được lưu; request → phải gửi yêu cầu; block → không được lưu.
   */
  checkDuplicate: async (values: CustomerFormValues, excludeId?: string | null): Promise<DuplicateResult> => {
    const empty: DuplicateResult = { mode: "allow", matches: [] };
    const companyId = await getCompanyId();
    if (!uid(companyId)) return empty;
    const config = await CustomerRulesService.getDuplicateConfig();
    const vals = duplicateValues(values);
    type Pending = DuplicateMatch & { fieldModes: DuplicateMode[]; createdAt: string | null };
    const found = new Map<string, Pending>();

    for (const { key } of DUPLICATE_FIELDS) {
      const fieldMode = modeOf(config, key);
      const value = vals[key];
      if (!value || fieldMode === "allow") continue;
      const clean = value.replace(/[,)]/g, "");
      const or = DUPLICATE_FIELD_COLUMNS[key].map((c) => `${c}.eq.${clean}`).join(",");
      const params: Record<string, string> = {
        select: "id,ten_kh,ten_cong_ty,ma_so_kh,di_dong,dien_thoai,cccd,created_by_id,created_at",
        ma_ctdk: `eq.${companyId}`,
        or: `(${or})`,
        limit: "10",
      };
      if (excludeId && uid(excludeId)) params.id = `neq.${excludeId}`;
      try {
        const res = await axiosApiSupabase.get("rest/v1/cloud_customers", { params });
        for (const r of Array.isArray(res.data) ? res.data : []) {
          const id = String(r.id);
          const prev = found.get(id);
          if (prev) {
            prev.fields.push(key);
            prev.values[key] = value;
            prev.fieldModes.push(fieldMode);
            continue;
          }
          found.set(id, {
            customerId: id,
            customerName: str(r.ten_kh) || str(r.ten_cong_ty) || "(chưa có tên)",
            customerCode: str(r.ma_so_kh) || null,
            phone: str(r.di_dong) || str(r.dien_thoai) || null,
            cccd: str(r.cccd) || null,
            ownerId: uid(r.created_by_id),
            ownerName: null,
            fields: [key],
            values: { [key]: value },
            protection: evaluateProtection(
              { stages: [], careCount: 0, lastCareAt: null, createdAt: null, now: Date.now() },
              config
            ),
            isOwn: false,
            mode: fieldMode,
            fieldModes: [fieldMode],
            createdAt: r.created_at ?? null,
          });
        }
      } catch (e) {
        console.log("ERROR checkDuplicate:", key, e);
      }
    }

    const pending = Array.from(found.values());
    if (!pending.length) return empty;

    const code = await tenantCode();
    const selfId = await getEmployeeId();
    const matches: DuplicateMatch[] = await Promise.all(
      pending.map(async ({ fieldModes, createdAt, ...m }) => {
        const [stages, care, owner] = await Promise.all([
          customerStages(m.customerId),
          careInfo(code, m.customerId),
          ownerName(m.ownerId),
        ]);
        const protection = evaluateProtection(
          { stages, careCount: care.count, lastCareAt: care.last, createdAt, now: Date.now() },
          config
        );
        const isOwn = !!selfId && !!m.ownerId && m.ownerId === selfId;
        if (isOwn) protection.reasons.unshift("Khách do chính bạn nhập trước đó");
        return { ...m, protection, ownerName: owner, isOwn, mode: finalDuplicateMode(fieldModes, protection, isOwn, config) };
      })
    );

    const mode = matches.reduce<DuplicateMode>((acc, m) => strictest(acc, m.mode), "allow");
    return { mode, matches };
  },

  /** Gửi yêu cầu khi bị trùng ở chế độ "request" – y hệt web CustomerDupRequestService.create. */
  createDuplicateRequest: async (
    match: DuplicateMatch,
    values: CustomerFormValues,
    note?: string
  ): Promise<{ ok: boolean; message?: string }> => {
    const ma_ctdk = await tenantCode();
    if (!ma_ctdk) return { ok: false, message: "Thiếu mã công ty đăng ký" };
    const [branchId, employeeId, userName] = await Promise.all([getBranchId(), getEmployeeId(), currentUserName()]);
    const payload = toWebCustomerPayload(values);
    const row = {
      ma_ctdk,
      company_id: uid(branchId),
      trang_thai: "pending",
      match_field: match.fields[0] ?? null,
      match_fields: match.fields,
      match_value: match.fields.map((f) => match.values[f]).filter(Boolean).join(", ") || null,
      protection_level: match.protection.level,
      protection_score: match.protection.score,
      protection_detail: match.protection,
      existing_customer_id: uid(match.customerId),
      existing_customer_name: match.customerName,
      existing_owner_id: uid(match.ownerId),
      existing_owner_name: match.ownerName,
      last_care_at: match.protection.lastCareAt,
      has_transaction: match.protection.hasTransaction,
      new_customer_payload: payload,
      new_customer_name: str(payload.TenCongTy || payload.TenKH) || null,
      requester_id: uid(employeeId),
      requester_name: userName || null,
      requester_note: note || null,
    };
    try {
      const res = await axiosApiSupabase.post("rest/v1/cloud_customer_dup_requests", row, {
        headers: { Prefer: "return=representation" },
      });
      const created = Array.isArray(res.data) ? res.data[0] : res.data;
      const id = str(created?.id);
      if (id) {
        try {
          await axiosApiSupabase.post("rest/v1/cloud_customer_dup_request_logs", {
            ma_ctdk,
            request_id: id,
            hanh_dong: "create",
            tu_trang_thai: null,
            den_trang_thai: "pending",
            nguoi_thuc_hien_id: uid(employeeId),
            nguoi_thuc_hien: userName || null,
            ghi_chu: note || null,
            chi_tiet: { protection: match.protection, fields: match.fields },
          });
        } catch {
          /* nhật ký không chặn nghiệp vụ (như web) */
        }
      }
      return { ok: true };
    } catch (e: any) {
      console.log("ERROR createDuplicateRequest:", e?.response?.data || e);
      return { ok: false, message: e?.response?.data?.message || "Gửi yêu cầu không thành công" };
    }
  },

  /**
   * Cấu hình bắt buộc nhập + ẩn/chỉ đọc trường cho form khách (cá nhân / doanh nghiệp).
   * Lỗi đọc → không ràng buộc thêm (như web).
   */
  getFormRules: async (isPersonal: boolean): Promise<FormRules> => {
    const code = await tenantCode();
    const [typeAccount, c] = await Promise.all([getTypeAccount(), claims()]);
    const isAgency = typeAccount === "AGENCY";
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
    const formKey = customerFormKey(isPersonal, isAgency, Object.keys(required));
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

/** Giai đoạn các phiếu của khách (web txnInfo). */
async function customerStages(customerId: string): Promise<string[]> {
  try {
    const res = await axiosApiSupabase.get("rest/v1/cloud_pgc_phieu_giucho", {
      params: { select: "giai_doan", khach_hang_id: `eq.${customerId}`, deleted_at: "is.null", limit: "200" },
    });
    return (Array.isArray(res.data) ? res.data : []).map((r: any) => str(r.giai_doan));
  } catch {
    return [];
  }
}

/** Nhật ký chăm sóc gần nhất (web careInfo – ma_ctdk là mã công ty). */
async function careInfo(code: string, customerId: string): Promise<{ count: number; last: string | null }> {
  try {
    const res = await axiosApiSupabase.get("rest/v1/cloud_customer_activities", {
      params: {
        select: "thoi_gian",
        ma_ctdk: `eq.${code}`,
        khach_hang_id: `eq.${customerId}`,
        order: "thoi_gian.desc",
        limit: "1",
      },
      headers: { Prefer: "count=exact" },
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    const range = String(res.headers?.["content-range"] ?? "");
    const total = range.includes("/") ? Number(range.split("/").pop()) : NaN;
    return { count: Number.isFinite(total) ? total : rows.length, last: rows[0]?.thoi_gian ? String(rows[0].thoi_gian) : null };
  } catch {
    return { count: 0, last: null };
  }
}

async function ownerName(ownerId: string | null): Promise<string | null> {
  if (!ownerId) return null;
  try {
    const res = await axiosApiSupabase.get("rest/v1/dm_employees", {
      params: { select: "ho_ten,ma_nv", id: `eq.${ownerId}`, limit: "1" },
    });
    const r = Array.isArray(res.data) ? res.data[0] : null;
    return str(r?.ho_ten) || str(r?.ma_nv) || null;
  } catch {
    return null;
  }
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

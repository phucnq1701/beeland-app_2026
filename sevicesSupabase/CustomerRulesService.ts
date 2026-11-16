import AsyncStorage from "@react-native-async-storage/async-storage";

import { getEmployeeId, getMaNv } from "./cloudTenant";
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
import { callNv, errorMessage } from "@/services/nvApi";
import { findFieldForm, fieldsForScope } from "@/lib/web/config/fieldConfigCatalog";
import { isReadonly, isRequired, isShown } from "@/lib/web/lib/fieldConfigRules";

/**
 * Luật khách hàng — bộ API riêng app (fn_nv_app_*, lõi chung: SP app bọc đúng SP web, công ty / nhân viên / nhóm quyền từ phiên):
 *  - Trùng khách (web CustomerDuplicateService / CustomerDuplicateConfigService / CustomerDupRequestService):
 *    cấu hình fn_nv_app_trung_cau_hinh (= fn_customer_dup_config_get), kiểm fn_nv_app_trung_kiem (= fn_customer_duplicate_check),
 *    gửi yêu cầu fn_nv_app_trung_yeu_cau_tao (= fn_customer_dup_request_create).
 *  - Bắt buộc / ẩn / chỉ xem (web useFieldConfig + FieldConfigService): cấu hình hiệu lực fn_nv_app_cau_hinh_truong
 *    (= fn_field_config_effective, theo nhóm quyền + phạm vi SYSTEM / AGENCY ở máy chủ) + luật web chép (lib/web fieldConfigRules / catalog).
 *  - Khoá sửa (web CustomerIdentityLockService): định danh fn_nv_app_khoa_dinh_danh, theo giao dịch fn_nv_app_khoa_giao_dich.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uid = (v: unknown): string | null => (UUID_RE.test(String(v ?? "")) ? String(v) : null);
const str = (v: unknown) => String(v ?? "").trim();

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

/** Như web useFieldConfig LOAD_FAILED: không tải được cấu hình ⇒ chặn lưu thay vì cho qua không ràng buộc */
export const FIELD_CONFIG_LOAD_FAILED = "Không tải được cấu hình bắt buộc nhập, vui lòng thử lại";

/** Cấu hình hiệu lực (web FieldConfigService: đệm 60 giây). Lỗi ném ra. */
let effCache: { at: number; value: { scope: "SYSTEM" | "AGENCY"; forms: Record<string, any> } } | null = null;
async function effectiveConfig(force = false) {
  if (!force && effCache && Date.now() - effCache.at < 60_000) return effCache.value;
  const data = await callNv<any>("fn_nv_app_cau_hinh_truong", {});
  if (!data || typeof data !== "object") throw new Error(FIELD_CONFIG_LOAD_FAILED);
  const value = { scope: data.scope === "AGENCY" ? "AGENCY" : "SYSTEM", forms: data.forms && typeof data.forms === "object" ? data.forms : {} } as const;
  effCache = { at: Date.now(), value: value as any };
  return effCache.value;
}
export function clearFieldConfigCache() {
  effCache = null;
}

/** Form web theo key app cũ: lịch ký đại lý / nội bộ cùng 1 form "signing" (phạm vi SYSTEM / AGENCY do máy chủ trả) */
const WEB_FORM_KEY: Record<string, string> = { agency_signing: "signing", agency_customer: "customer" };

const NO_RULES = (formKey: string): FormRules => ({
  formKey,
  required: [],
  hidden: new Set(),
  readonly: new Set(),
});

const arr = (v: any): string[] => (Array.isArray(v) ? v.map(String) : []);

/** Tiêu chí máy chủ báo khách ngoài phạm vi (chỉ CCCD / SĐT – fn_customer_duplicate_check). */
const OUT_OF_SCOPE_FIELDS: DuplicateField[] = ["cccd", "phone"];

/** Gọi bộ API riêng; lỗi máy chủ (RAISE: quyền, ngoài phạm vi…) → Error(message) như web rpcRaw. */
async function dupRpc<T = any>(fn: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  try {
    return await callNv<T>(fn, args);
  } catch (e: any) {
    console.log(`ERROR ${fn}:`, errorMessage(e));
    throw new Error(errorMessage(e, fallback) || fallback);
  }
}

export const CustomerRulesService = {
  /** Cấu hình trùng khách của công ty — fn_nv_app_trung_cau_hinh (= web CustomerDuplicateConfigService.load); lỗi → mặc định web. */
  getDuplicateConfig: async (): Promise<CustomerDuplicateConfig> => {
    try {
      const data = await callNv<any>("fn_nv_app_trung_cau_hinh", {});
      return data ? normalizeDuplicateConfig(data) : DEFAULT_CUSTOMER_DUPLICATE;
    } catch (e) {
      console.log("ERROR getDuplicateConfig:", errorMessage(e));
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

    const data = await dupRpc<any>(
      "fn_nv_app_trung_kiem",
      { p_values: vals, p_fields: fields, p_exclude_id: uid(excludeId) || null },
      "Không kiểm tra được trùng khách hàng"
    );

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
        "fn_nv_app_trung_yeu_cau_tao",
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

  /**
   * Cấu hình bắt buộc / ẩn / chỉ xem cho form khách (cá nhân "customer" / doanh nghiệp "customer_org" như web formKeyOf;
   * đại lý: cùng form, phạm vi AGENCY do máy chủ trả). Lỗi tải ném ra (màn lưu chặn như web).
   */
  getFormRules: async (isPersonal: boolean): Promise<FormRules> =>
    CustomerRulesService.getRulesForForm(customerFormKey(isPersonal, false)),

  /**
   * Bắt buộc / ẩn / chỉ xem của 1 form theo key (web useFieldConfig): cấu hình hiệu lực của người dùng phiên + luật web
   * (trường khoá luôn bắt buộc, không ẩn / chỉ xem; trường bị ẩn / chỉ xem không bắt buộc; trường ngoài danh mục form bỏ qua).
   * Trường có điều kiện (when — vd chỉ doanh nghiệp ở lịch ký) không đưa vào danh sách bắt buộc tĩnh. Lỗi tải ném ra.
   */
  getRulesForForm: async (formKey: string): Promise<FormRules> => {
    const key = WEB_FORM_KEY[formKey] ?? formKey;
    const rules = NO_RULES(key);
    const form = findFieldForm(key);
    if (!form) return rules;
    const eff = await effectiveConfig();
    const raw = eff.forms[key] || {};
    const rule = { required: arr(raw.required), hidden: arr(raw.hidden), readonly: arr(raw.readonly) };
    const fields = fieldsForScope(form, eff.scope);
    rules.required = fields.filter((f) => !f.when && isRequired(form, rule, eff.scope, f.key)).map((f) => f.key);
    rules.hidden = new Set(fields.filter((f) => !isShown(form, rule, eff.scope, f.key)).map((f) => f.key));
    rules.readonly = new Set(fields.filter((f) => isReadonly(form, rule, eff.scope, f.key)).map((f) => f.key));
    return rules;
  },

  /** Khách đã có lịch ký cá nhân → khoá Họ tên & CCCD — fn_nv_app_khoa_dinh_danh (= web hasPersonalSigningAppointment); lỗi → false. */
  hasIdentityLock: async (customerId: string): Promise<boolean> => {
    if (!uid(customerId)) return false;
    try {
      return (await callNv<any>("fn_nv_app_khoa_dinh_danh", { p_customer_id: customerId })) === true;
    } catch {
      return false;
    }
  },

  /**
   * Khoá sửa theo giao dịch (web hasCustomerTxLock, KG1–KG3): khách chính / đồng sở hữu của giao dịch ở 13 "Đặt cọc đã duyệt" /
   * 14 "HĐMB đã duyệt" ⇒ form Sửa chỉ xem. Không đệm; lỗi → false (máy chủ vẫn chặn khi lưu).
   */
  hasTxLock: async (customerId: string): Promise<boolean> => {
    if (!uid(customerId)) return false;
    try {
      return (await callNv<any>("fn_nv_app_khoa_giao_dich", { p_customer_id: customerId })) === true;
    } catch {
      return false;
    }
  },
};

/** Như web CUSTOMER_TX_LOCK_MESSAGE */
export const CUSTOMER_TX_LOCK_MESSAGE =
  "Khách hàng có giao dịch đang ở trạng thái Đặt cọc đã duyệt / HĐMB đã duyệt — không sửa được thông tin. Muốn thay đổi: lập phụ lục thay đổi thông tin khách hàng.";

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

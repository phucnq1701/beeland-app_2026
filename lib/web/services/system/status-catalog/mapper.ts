// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/system/status-catalog/mapper.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type {
  StatusCompany,
  StatusConfig,
  StatusConfigItem,
  StatusGroup,
  StatusItem,
  StatusItemInput,
  StatusItemRaw,
  StatusOverride,
  StatusType,
} from "./types";

const lower = (v: unknown) => String(v ?? "").toLowerCase();

export const toStatusItem = (r: StatusItemRaw): StatusItem => {
  const Ma = String(r?.item_code ?? "");
  const ID = Number(Ma) || 0;
  const Ten = String(r?.item_name ?? "").trim();
  const Mau = r?.color_code ?? null;
  return {
    ID,
    Ma,
    Uid: lower(r?.id),
    Ten,
    Mau,
    ApDung: r?.ap_dung !== false,
    MaTT: ID,
    TenTT: Ten,
    MauNen: Mau,
    ColorWeb: Mau,
    MauGoc: r?.color_goc ?? null,
    MauCty: r?.color_cty ?? null,
    NhomMa: r?.group_code ?? null,
    NhomTen: r?.group_name ?? null,
  };
};

/** undefined ⇒ null (máy chủ giữ nguyên); null ⇒ "" (máy chủ bỏ giá trị) */
const keepOrClear = (v: string | null | undefined) => (v === undefined ? null : v ?? "");

export const toSavePayload = (type: StatusType, i: StatusItemInput) => ({
  p_type: type,
  p_id: i.id ?? null,
  p_item_code: i.item_code ?? null,
  p_item_name: i.item_name ?? null,
  p_color: keepOrClear(i.color),
  p_ap_dung: i.ap_dung ?? null,
  p_group_code: keepOrClear(i.group_code),
});

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export const toStatusConfig = (r: Partial<StatusConfig> | null | undefined): StatusConfig => ({
  groups: arr<StatusGroup>(r?.groups),
  items: arr<StatusConfigItem>(r?.items).map((it) => ({
    ...it,
    id: lower(it?.id),
    ap_dung: it?.ap_dung !== false,
    overrides: arr<StatusOverride>(it?.overrides).map((o) => ({ ...o, company_id: lower(o?.company_id) })),
  })),
  companies: arr<StatusCompany>(r?.companies).map((c) => ({ ...c, id: lower(c?.id) })),
});

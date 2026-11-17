// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/expiryPick.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Ô chọn Phiếu tính giá / Chính sách bán hàng / Lịch thanh toán ở form chứng từ: ẩn mục hết hạn tại Ngày ký của form
 * (trống ⇒ hôm nay), giữ mục đang chọn (" (hết hạn)") và hiện mục có yêu cầu ngoại lệ đã duyệt của giao dịch (" (ngoại lệ)").
 * Cùng quy tắc với `_sales_config_expiry_guard` ở máy chủ: PTG hết hạn ⇔ ngay_het_han < ngày; CSBH / TĐTT ⇔ ngoài
 * [từ, đến], đầu mút trống = không giới hạn. Ngoại lệ PTG miễn luôn CSBH / TĐTT của chính phiếu đó.
 */
import { scheduleInEffect, toIsoDate, todayIsoDate } from "./tdttHieuLuc";

export type ExceptionLoai = "PTG" | "CSBH" | "TDTT";
export type ActiveException = { loai: ExceptionLoai; doi_tuong_id: string };

export const EXPIRED_SUFFIX = " (hết hạn)";
export const EXCEPTION_SUFFIX = " (ngoại lệ)";

const lc = (v: unknown): string => String(v ?? "").trim().toLowerCase();

/** Id (chữ thường) các đối tượng loại `loai` có ngoại lệ đã duyệt */
export const allowedIdsFor = (active: ActiveException[], loai: ExceptionLoai): Set<string> =>
  new Set((active || []).filter((a) => a?.loai === loai && lc(a.doi_tuong_id)).map((a) => lc(a.doi_tuong_id)));

/** CSBH / TĐTT được phép: ngoại lệ riêng + (phiếu `sheetId` có ngoại lệ PTG ⇒ MaCS / MaTDTT của phiếu) */
export const applyExceptionCascade = (
  active: ActiveException[],
  sheet: { MaCS?: string; MaTDTT?: string } | null,
  sheetId: string | null,
): { CSBH: Set<string>; TDTT: Set<string> } => {
  const CSBH = allowedIdsFor(active, "CSBH");
  const TDTT = allowedIdsFor(active, "TDTT");
  if (sheet && sheetId && allowedIdsFor(active, "PTG").has(lc(sheetId))) {
    if (lc(sheet.MaCS)) CSBH.add(lc(sheet.MaCS));
    if (lc(sheet.MaTDTT)) TDTT.add(lc(sheet.MaTDTT));
  }
  return { CSBH, TDTT };
};

const firstOf = (v: unknown): Record<string, unknown> | undefined =>
  Array.isArray(v) && v[0] && typeof v[0] === "object" ? (v[0] as Record<string, unknown>) : undefined;

const strOrUndef = (v: unknown): string | undefined => (v == null || String(v).trim() === "" ? undefined : String(v));

/**
 * Chi tiết phiếu (priceSheetService.get) → CSBH / TĐTT của phiếu như máy chủ đọc:
 * MaCS = TTHopDong.MaCS ?? ChinhSach[0].MaCS; TĐTT = LichThanhToan[0].MaTH ?? TTHopDong.MaTDTT.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sheetExceptionRefs = (sheet: any): { MaCS?: string; MaTDTT?: string } => {
  const payload = sheet?.payload || {};
  const tt = payload?.TTHopDong || sheet?.tt_hop_dong || {};
  const cs = firstOf(payload?.ChinhSach) ?? firstOf(sheet?.chinh_sach);
  const ltt = firstOf(payload?.LichThanhToan) ?? firstOf(sheet?.lich_thanh_toan);
  return { MaCS: strOrUndef(tt?.MaCS) ?? strOrUndef(cs?.MaCS), MaTDTT: strOrUndef(ltt?.MaTH) ?? strOrUndef(tt?.MaTDTT) };
};

export type PickOption = { value: string; label: string };

/**
 * Dòng còn hạn ⇒ giữ. Hết hạn ⇒ chỉ giữ khi thuộc `allowIds` (nhãn + " (ngoại lệ)") hoặc là mục đang chọn
 * (nhãn + `expiredSuffix`, mặc định " (hết hạn)"). So id không phân biệt hoa thường.
 */
export const pickOptions = <T>(
  rows: T[],
  opts: {
    getId(r: T): string;
    getLabel(r: T): string;
    inEffect(r: T): boolean;
    selectedId?: string | null;
    allowIds?: Set<string>;
    expiredSuffix?: string;
  },
): PickOption[] => {
  const selected = lc(opts.selectedId);
  const out: PickOption[] = [];
  for (const r of rows || []) {
    const value = opts.getId(r);
    const label = opts.getLabel(r);
    if (opts.inEffect(r)) out.push({ value, label });
    else if (opts.allowIds?.has(lc(value))) out.push({ value, label: label + EXCEPTION_SUFFIX });
    else if (selected && lc(value) === selected) out.push({ value, label: label + (opts.expiredSuffix ?? EXPIRED_SUFFIX) });
  }
  return out;
};

/** CSBH còn hiệu lực tại `ngay` (trống ⇒ hôm nay): trong [hieu_luc_tu, hieu_luc_den], đầu mút trống = không giới hạn */
export const policyInEffect = (row: { hieu_luc_tu?: unknown; hieu_luc_den?: unknown } | null | undefined, ngay: unknown): boolean =>
  scheduleInEffect({ tu_ngay: row?.hieu_luc_tu, den_ngay: row?.hieu_luc_den }, ngay);

/** PTG còn hạn tại `ngay` (trống ⇒ hôm nay): ngay_het_han trống hoặc ≥ ngày */
export const sheetInEffect = (row: { ngay_het_han?: unknown } | null | undefined, ngay: unknown): boolean => {
  const den = toIsoDate(row?.ngay_het_han);
  return !den || (toIsoDate(ngay) ?? todayIsoDate()) <= den;
};

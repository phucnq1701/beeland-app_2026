// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/finance/interest-rates/rule.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type { DonViLai, InterestOverride, ProjectInterestRate } from "./types";

/**
 * Quy tắc lãi quá hạn theo lãi suất dự án — PHẢI cùng kết quả với SQL (`_interest_charge_days`, chọn dòng theo ngày VN).
 */

/** Chỉ đúng chuỗi "nam" ⇒ năm; mọi giá trị khác / thiếu ⇒ ngày — như SQL */
export const toDonVi = (v: unknown): DonViLai => (v === "nam" ? "nam" : "ngay");

/** Mẫu số của tỷ lệ: năm ⇒ 365 (kể cả năm nhuận), ngày ⇒ 1 */
export const mauSo = (donVi: DonViLai | null | undefined): 1 | 365 => (donVi === "nam" ? 365 : 1);

export const DON_VI_LAI_OPTIONS: { value: DonViLai; label: string }[] = [
  { value: "ngay", label: "Ngày" },
  { value: "nam", label: "Năm" },
];

const NF_LAI = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 6 });
/** "0,5 %/ngày" | "18 %/năm"; chưa có tỷ lệ ⇒ "" */
export const fmtLaiSuat = (tyLe: number | null | undefined, donVi: DonViLai | null | undefined): string =>
  tyLe == null || !Number.isFinite(Number(tyLe)) ? "" : `${NF_LAI.format(Number(tyLe))} ${donVi === "nam" ? "%/năm" : "%/ngày"}`;

const VN_OFFSET_MS = 7 * 3600 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const NAIVE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

/** "YYYY-MM-DD" theo lịch giờ VN (không phụ thuộc múi giờ máy). Chuỗi không có múi giờ coi là giờ VN. */
export const vnDateKey = (v: string | Date | null | undefined): string | null => {
  if (v == null || v === "") return null;
  let ms: number;
  if (v instanceof Date) {
    ms = v.getTime();
  } else {
    const s = String(v).trim();
    if (DATE_ONLY.test(s)) return s;
    ms = NAIVE.test(s) ? Date.parse(`${s.replace(" ", "T")}+07:00`) : Date.parse(s);
  }
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + VN_OFFSET_MS).toISOString().slice(0, 10);
};

/** Dòng áp dụng của chính dự án có tuNgay ≤ ngày đến hạn ≤ denNgay (cả hai đầu); không có → null */
export const pickRate = (
  rates: ProjectInterestRate[],
  projectId: string | null | undefined,
  due: string | Date | null | undefined,
): ProjectInterestRate | null => {
  const key = vnDateKey(due);
  if (!key || !projectId) return null;
  let best: ProjectInterestRate | null = null;
  for (const r of rates || []) {
    if (r.apDung !== true || r.projectId !== projectId) continue;
    if (r.tuNgay > key || key > r.denNgay) continue;
    if (!best || r.tuNgay > best.tuNgay) best = r;
  }
  return best;
};

const DEC = /^\s*\d+(\.\d+)?\s*$/;
/** Số JSON hữu hạn, hoặc chuỗi chữ số thập phân "0.05" (không nhận "0,05", "NaN", "1e3") — như SQL _interest_override */
const overrideNum = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && DEC.test(v)) return Number(v);
  return null;
};

/**
 * Cài đặt lãi quá hạn riêng của hợp đồng — từ TTHopDong (`LaiQHTyLe`/`LaiQHSoNgayKhongTinh`) hoặc `lai_qh` của RPC
 * (`ty_le`/`so_ngay_khong_tinh_lai`/`don_vi`; TTHopDong: `LaiQHDonVi`). Tỷ lệ phải 0 < x ≤ 100, ngược lại null (theo dự án); N nguyên 0..36500, ngược lại 0.
 * PHẢI cùng kết quả với SQL `_interest_override` (bảng ca chung trong rule.test.ts / hd_lai_qua_han_rieng_01.sql).
 */
export const parseInterestOverride = (raw: unknown): InterestOverride | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const rpc = "ty_le" in o;
  const t = overrideNum(rpc ? o.ty_le : o.LaiQHTyLe);
  if (t == null || !(t > 0 && t <= 100)) return null;
  const n = overrideNum(rpc ? o.so_ngay_khong_tinh_lai : o.LaiQHSoNgayKhongTinh);
  return {
    tyLe: t,
    soNgayKhongTinhLai: n != null && n >= 0 && n <= 36500 ? Math.floor(n) : 0,
    donVi: toDonVi(rpc ? o.don_vi : o.LaiQHDonVi),
  };
};

/** Tham số lãi của 1 đợt: cài đặt HĐ trước, lãi suất dự án sau (pickRate); đợt không có ngày đến hạn → null */
export const pickRateFor = (
  ov: InterestOverride | null,
  rates: ProjectInterestRate[],
  projectId: string | null | undefined,
  due: string | Date | null | undefined,
): { tyLe: number; soNgayKhongTinhLai: number; donVi: DonViLai } | null => {
  if (!vnDateKey(due)) return null;
  return ov ?? pickRate(rates, projectId, due);
};

/** Số ngày tính lãi: số ngày quá hạn nếu > số ngày không tính lãi, ngược lại 0 */
export const chargeableDays = (days: number, grace: number): number => {
  const d = Number(days);
  if (!Number.isFinite(d) || d < 0) return 0;
  const g = Number(grace);
  const n = Number.isFinite(g) ? g : 0;
  return d > n ? d : 0;
};

/** Tiền lãi = round(số tiền × tyLe / 100 × số ngày tính lãi / mẫu số) — mẫu số 365 khi đơn vị "nam" */
export const calcInterest = (amount: number, tyLe: number, days: number, donVi: DonViLai = "ngay"): number =>
  Math.round((((Number(amount) || 0) * (Number(tyLe) || 0)) / 100 * (Number(days) || 0)) / mauSo(donVi));

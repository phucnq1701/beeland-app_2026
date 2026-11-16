// ⚠️ TỰ SINH — bản chép nguyên văn web src/pages/sales/giao-dich/dat-lich-ky/signingSource.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Nguồn lịch ký (luồng ký TTĐC — spec 2026-11-12-luong-ky-ttdc-trang-thai §2.2): lịch lập tại chứng từ cụ thể,
 * `DAT_COC` (phiếu đặt cọc đã duyệt) hoặc `HOP_DONG` (HĐMB / HĐ góp vốn). Máy chủ kiểm lại (usp_signing_appointment_upsert).
 */
import type { SigningSource, SigningSourceKind } from "./types";

export const NGUON_OPTIONS: { value: SigningSourceKind; label: string }[] = [
  { value: "DAT_COC", label: "Đặt cọc" },
  { value: "HOP_DONG", label: "Hợp đồng" },
];

/** "Đặt cọc · <số phiếu>" / "Hợp đồng · <số HĐ>" / "Chưa gán nguồn" (lịch cũ không gắn phiếu) */
export const nguonLabel = (r: { Nguon?: string | null; SoPhieu?: string | null; SoHopDong?: string | null }): string => {
  if (r?.Nguon === "DAT_COC") return r.SoPhieu ? `Đặt cọc · ${r.SoPhieu}` : "Đặt cọc";
  if (r?.Nguon === "HOP_DONG") return r.SoHopDong ? `Hợp đồng · ${r.SoHopDong}` : "Hợp đồng";
  return "Chưa gán nguồn";
};

/** Kiểm nguồn trước khi lưu; null = hợp lệ */
export const sourceError = (f: { Nguon?: string | null; HopDongId?: string | null; MaPGC?: string | null }): string | null => {
  if (f?.Nguon !== "DAT_COC" && f?.Nguon !== "HOP_DONG") return "Chọn nguồn lịch ký (Đặt cọc hoặc Hợp đồng)";
  if (f.Nguon === "HOP_DONG" && !f.HopDongId) return "Chọn hợp đồng";
  if (f.Nguon === "DAT_COC" && !f.MaPGC) return "Chọn phiếu đặt cọc";
  return null;
};

/** Mở form từ chứng từ: điền nguồn + phiếu giữ chỗ (+ HĐ) */
export const sourcePatch = (s: SigningSource) =>
  s.kind === "HOP_DONG"
    ? { Nguon: "HOP_DONG" as const, MaPGC: s.pgcId, HopDongId: s.contractId }
    : { Nguon: "DAT_COC" as const, MaPGC: s.pgcId, HopDongId: null };


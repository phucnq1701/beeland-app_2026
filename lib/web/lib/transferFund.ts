// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/transferFund.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * HĐ chuyển nhượng theo quỹ căn (spec docs/superpowers/specs/2026-11-10-hd-chuyen-nhuong-quy-design.md).
 * - Quỹ căn mã CHUYEN_NHUONG (dm_quy_can) là kênh bán chuyển nhượng.
 * - HĐ chuyển nhượng vẫn là HĐMB; máy chủ trả `loai_hd` = "HDCN" (quỹ CN hoặc sang tên có HĐ gốc) / "HDMB".
 * Hàm thuần, test ở __tests__/transferFund.test.ts.
 */
import { sameId } from "../components/Sales/salesConfig/unitFundPriceList";

export const TRANSFER_FUND_CODE = "CHUYEN_NHUONG";

const norm = (v: unknown): string => String(v ?? "").trim().toUpperCase();
const hasValue = (v: unknown): boolean => String(v ?? "").trim() !== "";

export const isTransferFundCode = (ma: unknown): boolean => norm(ma) === TRANSFER_FUND_CODE;

/** Mã quỹ (dm_quy_can.ma) theo id; không thấy ⇒ null */
export const fundCodeOf = (
  funds: readonly { id: string; ma?: string | null }[] | null | undefined,
  quyCanId: string | null | undefined
): string | null => (quyCanId ? (funds ?? []).find((f) => sameId(f.id, quyCanId))?.ma ?? null : null);

/** HĐ chuyển nhượng: máy chủ báo HDCN, hoặc có HĐ gốc (sang tên), hoặc phiếu thuộc quỹ CN (máy chủ cũ chưa trả loai_hd) */
export const isTransferContractDoc = (a: { loaiHD?: unknown; maHDGoc?: unknown; fundCode?: string | null }): boolean =>
  norm(a.loaiHD) === "HDCN" || hasValue(a.maHDGoc) || isTransferFundCode(a.fundCode);

/** Cột "Nguồn" của DS HĐ chuyển nhượng */
export const contractSourceLabel = (a: { loaiHD?: unknown; maHDGoc?: unknown }): "Sang tên" | "Quỹ chuyển nhượng" | "" => {
  if (hasValue(a.maHDGoc)) return "Sang tên";
  return norm(a.loaiHD) === "HDCN" ? "Quỹ chuyển nhượng" : "";
};

/** Cột "Loại HĐ" */
export const contractTypeLabel = (loaiHD: unknown): "HĐ chuyển nhượng" | "HĐMB" =>
  norm(loaiHD) === "HDCN" ? "HĐ chuyển nhượng" : "HĐMB";

export type TxKind = "pricesheet" | "booking" | "deposit" | "investment" | "contract";

const FUND_TX_LABEL: Partial<Record<TxKind, { from: string; to: string }>> = {
  booking: { from: "Booking", to: "Đặt mua chuyển nhượng" },
  contract: { from: "Hợp đồng", to: "Hợp đồng chuyển nhượng" },
  deposit: { from: "Đặt cọc", to: "Đặt cọc chuyển nhượng" },
};

/** Nhãn mục Giao dịch: quỹ CN đổi Booking / Đặt cọc / Hợp đồng, mục khác giữ `base` */
export const txLabelForFund = (kind: TxKind, fundCode: string | null | undefined, base: string): string =>
  isTransferFundCode(fundCode) && FUND_TX_LABEL[kind] ? FUND_TX_LABEL[kind]!.to : base;

/** Tiêu đề form Booking: quỹ CN ⇒ "Tạo / Sửa Đặt mua chuyển nhượng" */
export const bookingFormTitle = (isEdit: boolean, fundCode: string | null | undefined): string =>
  `${isEdit ? "Sửa" : "Tạo"} ${txLabelForFund("booking", fundCode, "Booking")}`;

/** Thông báo chặn căn không "Mở bán": thay nhãn cũ bằng nhãn quỹ CN (lần xuất hiện đầu) */
export const txBlockedMsgForFund = (kind: TxKind, fundCode: string | null | undefined, baseMsg: string): string => {
  const m = FUND_TX_LABEL[kind];
  return isTransferFundCode(fundCode) && m ? baseMsg.replace(m.from, m.to) : baseMsg;
};

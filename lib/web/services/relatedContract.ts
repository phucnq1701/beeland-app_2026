// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/relatedContract.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** HĐ liên quan của khách hàng (QH2–QH3) — kiểu + nhãn hiển thị, không phụ thuộc client máy chủ (dùng được ở tab Hồ sơ). */

/** Một dòng ô "HĐ liên quan" (QH3): HĐMB đã duyệt của công ty */
export interface RelatedContractOption {
  id: string;
  so_hdmb: string | null;
  ten_da: string | null;
  ten_khu: string | null;
  ten_kh: string | null;
  ky_hieu: string | null;
}

/** Nhãn 1 dòng: "HĐMB 01/2026 · Dự án A · Khu B · Nguyễn Văn A · Căn A-01" (bỏ phần trống) */
export const relatedContractLabel = (c: Partial<RelatedContractOption> | null | undefined): string =>
  c
    ? [c.so_hdmb || "(chưa có số HĐ)", c.ten_da, c.ten_khu, c.ten_kh, c.ky_hieu ? `Căn ${c.ky_hieu}` : null]
        .filter((x) => x != null && String(x).trim() !== "")
        .join(" · ")
    : "";


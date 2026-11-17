// ⚠️ TỰ SINH — bản chép nguyên văn web src/utils/contractValue.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Chuẩn hóa khối giá trị hợp đồng: luôn có "Đơn giá gồm VAT".
 * Nếu thiếu, tính từ Tổng gồm VAT / Diện tích thông thủy,
 * hoặc từ Đơn giá chưa VAT + tỷ lệ VAT.
 */
const toNum = (v: any): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const ensureDonGiaGomVAT = (gt: any): any => {
  if (!gt || typeof gt !== "object") return gt;
  const cur = toNum(gt.DonGiaGomVAT ?? gt.DonGiaDaVAT);
  if (cur != null && cur !== 0) {
    gt.DonGiaGomVAT = cur;
    return gt;
  }
  const dt = toNum(gt.DienTichThongThuy);
  const tong = toNum(gt.TongGomVAT);
  if (dt && tong != null) {
    gt.DonGiaGomVAT = tong / dt;
    return gt;
  }
  const dgChua = toNum(gt.DonGiaChuaVAT);
  const tyLe = toNum(gt.TyLeVAT);
  if (dgChua != null && tyLe != null) {
    gt.DonGiaGomVAT = dgChua * (1 + tyLe / 100);
    return gt;
  }
  if (cur != null) gt.DonGiaGomVAT = cur;
  return gt;
};

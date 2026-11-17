// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/PriceSheet/savedSheetPrices.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Các ô giá / diện tích của form phiếu tính giá, lưu nguyên vào `snapshot.formValues` để khi sửa nạp lại
 * đúng như lúc lưu (không tính lại theo công thức, không lấy lại giá của sản phẩm / bảng giá hiện tại).
 */
export const FORM_PRICE_KEYS = [
  "dienTichThongThuy",
  "dienTichTimTuong",
  "dienTichDat",
  "dienTichXD",
  "tongDTSanXD",
  "donGiaDat",
  "donGiaDatPhanBo",
  "donGiaXD",
  "donGiaSuDungDat",
  "tyLeVAT",
  "tyLePBT",
  "rawDonGiaChuaVAT",
  "rawDonGiaDaVAT",
  "rawTongGiaChuaVAT",
  "rawTongGiaDaVAT",
  "rawTienVAT",
  "rawTienPhiBaoTri",
  "rawTongGomPBT",
  "rawTienDatChuaVAT",
  "rawTienVATDat",
  "rawTongTienDatVAT",
  "rawTienSDDat",
  "rawThanhTienXD",
  "rawTienVATXD",
  "rawTongGiaXDVAT",
  "rawTongGiaTriHDMB",
  "rawTyLeVATXD",
] as const;

type FormPrices = Partial<Record<(typeof FORM_PRICE_KEYS)[number], unknown>>;
type Obj = Record<string, unknown>;
const asObj = (v: unknown): Obj | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : null;

/** Ô giá của form lúc lưu (bỏ khoá undefined) */
export function pickFormPrices(fd: Obj | null | undefined): FormPrices {
  const out: FormPrices = {};
  FORM_PRICE_KEYS.forEach((k) => {
    if (fd?.[k] !== undefined) out[k] = fd[k];
  });
  return out;
}

/**
 * Phiếu lưu trước khi có `formValues`: chỉ các trường GiaTriHopDong chép thẳng từ ô của form
 * (DonGiaChuaVAT / TongChuaVAT là số suy ra lúc lưu nên không lấy).
 */
const GIA_TRI_HD_TO_FORM: Record<string, (typeof FORM_PRICE_KEYS)[number]> = {
  DienTichThongThuy: "dienTichThongThuy",
  DonGiaGomVAT: "rawDonGiaDaVAT",
  TyLeVAT: "tyLeVAT",
  TienVAT: "rawTienVAT",
  TongGomVAT: "rawTongGiaDaVAT",
  TyLePhiBaoTri: "tyLePBT",
  TienPhiBaoTri: "rawTienPhiBaoTri",
  TongGiaGomVATPBT: "rawTongGomPBT",
  DonGiaDat: "donGiaDat",
  DGDatPB: "donGiaDatPhanBo",
  TienDatChuaVAT: "rawTienDatChuaVAT",
  TienVATDat: "rawTienVATDat",
  TongTienVATDat: "rawTongTienDatVAT",
  DonGiaXD: "donGiaXD",
  TienXDChuaVAT: "rawThanhTienXD",
  TienVATXD: "rawTienVATXD",
  TongTienXDGomVAT: "rawTongGiaXDVAT",
};

/** Ô giá cần nạp lại khi mở sửa phiếu đã lưu */
export function savedFormPrices(payload: unknown, snap: unknown): FormPrices {
  const fv = asObj(asObj(snap)?.formValues);
  if (fv) return pickFormPrices(fv);
  const gt = asObj(asObj(asObj(payload)?.TTHopDong)?.GiaTriHopDong);
  const out: FormPrices = {};
  if (!gt) return out;
  Object.entries(GIA_TRI_HD_TO_FORM).forEach(([src, key]) => {
    const v = gt[src];
    if (v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v))) out[key] = Number(v);
  });
  return out;
}

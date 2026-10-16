/**
 * Dữ liệu vào / ra của phiếu tính giá trên app – cùng định dạng web lưu để web mở lại / in được:
 *  - mapProductRow: beeland/src/services/BdsProductService.ts mapBdsProduct (kết quả fn_get_product_by_id)
 *  - formFromProduct / productDefaults / applyPriceListItem: PriceSheetForm (state ban đầu, getProductDefaults, handleBG)
 *  - PRICE_FIELD_MAP / applyPriceInputs: PriceSheetForm.handleProductPriceInputs (cấu hình tính giá sản phẩm)
 *  - buildPayload / buildSaveRow: PriceSheetForm.handleSave (type "pricesheet") + phieu-tinh-gia/index.handlePriceSheetSaved
 *  - formFromSheet: phieu-tinh-gia/index.handleEdit + PriceSheetForm (nạp lại phiếu đã lưu)
 * Không import gì ngoài các lib thuần để test nạp được.
 */
import { isLowRiseProduct } from "./bookingPrice";
import type { PriceCalc, PriceForm } from "./priceSheetCalc";
import type { PolicyDiscountRound } from "./priceSheetFormulas";
import { dueDateFor, type ScheduleRow } from "./priceSheetSchedule";

/* ================================ Sản phẩm ================================ */

const cat = (c: any) => {
  if (c == null) return { id: null, code: null, name: null };
  if (typeof c === "string") return { id: null, code: null, name: c };
  return { id: c?.id ?? null, code: c?.item_code ?? null, name: c?.item_name ?? null };
};

/** fn_get_product_by_id → hình dạng sản phẩm web dùng trong form + snapshot.product (mapBdsProduct) */
export function mapProductRow(r: any): any {
  if (!r) return null;
  const khu = cat(r?.khu);
  const pk = cat(r?.pk);
  const tang = cat(r?.tang);
  const lch = cat(r?.lch);
  const lhbds = cat(r?.lhbds);
  const pn = cat(r?.pn);
  const hcua = cat(r?.hcua);
  const hbc = cat(r?.hbc);
  const vw = cat(r?.vw);
  const vt = cat(r?.vt);
  const tt = cat(r?.tt);
  const da = r?.da;
  const tenDA = typeof da === "string" ? da : da?.ten_da ?? "";
  return {
    id: r.id,
    MaSP: r.ma_sp ?? r.id,
    KyHieu: r.ky_hieu,
    FormCode: r.form_code,
    MaDA: r.ma_da,
    TenDA: tenDA,
    MaKhu: khu.id,
    TenKhu: khu.name,
    Khu: khu.name,
    MaPK: pk.id,
    TenPK: pk.name,
    MaTang: tang.id,
    TenTang: tang.name,
    Tang: tang.name,
    MaLCH: lch.id,
    TenLoaiCanHo: lch.name,
    TenLoaiMau: lch.name,
    MaLHBDS: lhbds.id,
    TenLBDS: lhbds.name,
    MaSoPN: pn.id,
    TenLoaiPN: pn.name,
    SoPN: r.so_pn ?? pn.name,
    HuongCua: hcua.id,
    TenHuongCua: hcua.name,
    HuongBC: hbc.id,
    TenHuongBC: hbc.name,
    ViewID: vw.id,
    TenView: vw.name,
    TenVeiw: vw.name,
    ViTri: vt.id,
    TenViTri: vt.name,
    TenVT: vt.name,
    MaTT: tt.id ?? r?.ma_tt ?? null,
    TenTT: tt.name,
    MauTT: r?.tt?.color_code ?? null,
    MaCauHinhTinhGia: r.ma_cau_hinh_tinh_gia,
    MaMauNha: r.ma_mau_nha,
    MaLoaiDN: r.ma_loai_dn,
    MauNha: r.mau_nha,
    HoBoi: r.ho_boi,
    SoCanHo: r.so_can_ho,
    DienTich: r.dien_tich,
    DienTichThongThuy: r.dien_tich_thong_thuy,
    DTTimDuong: r.dt_tim_tuong,
    DTTimTuong: r.dt_tim_tuong,
    DienTichKV: r.dien_tich_kv,
    DienTichDat: r.dien_tich_dat,
    DienTichXD: r.dien_tich_xd,
    TongDTXD: r.tong_dt_xd,
    SoTang: r.so_tang,
    SoO: r.so_o,
    GhiChu: r.ghi_chu,
    ToaDo: r.toa_do,
    HinhAnh: r.hinh_anh,
    IsView: r.is_view,
    DGGomVAT: r.dg_gom_vat,
    GiaVaoHD: r.gia_vao_hd,
    DonGiaChuaVAT: r.don_gia_chua_vat,
    TongGiaChuaVAT: r.tong_gia_chua_vat,
    VAT: r.vat,
    TienVAT: r.tien_vat,
    TongGiaGomVAT: r.tong_gia_gom_vat,
    PBT: r.pbt,
    TienPBT: r.tien_pbt,
    TongGiaGomPBT: r.tong_gia_gom_pbt,
    TienDat: r.tien_dat,
    DonGia: r.don_gia,
    TongGia: r.tong_gia,
    DonGiaDaVAT: r.don_gia_da_vat,
    TongGiaDaVAT: r.tong_gia_da_vat,
    TongThanhToan: r.tong_thanh_toan,
    TyLeVAT: r.ty_le_vat,
    TyLePhiBaoTri: r.ty_le_phi_bao_tri,
    TienPhiBaoTri: r.tien_phi_bao_tri,
    TongGomPBT: r.tong_gom_pbt,
    DGDatPB: r.dg_dat_pb,
    TongTienSDD: r.tong_tien_sdd,
    DonGiaXayDung: r.don_gia_xay_dung,
    ThanhTienXD: r.thanh_tien_xd,
    DonGiaDat: r.don_gia_dat,
    TongGiaDat: r.tong_gia_dat,
    TongGiaTriHDMB: r.tong_gia_tri_hdmb,
    NgayNhap: r.ngay_nhap ?? r.created_at,
    NgaySua: r.ngay_sua ?? r.updated_at,
    NguoiNhap: r.nguoi_nhap,
    NguoiSua: r.nguoi_sua,
  };
}

export function productIsLowRise(product: any): boolean {
  return isLowRiseProduct({ product, maSP: product?.code || product?.KyHieu || product?.MaCan });
}

/* ================================ Form ================================ */

export interface SheetForm extends PriceForm {
  duAn: string;
  maSanPham: string;
  loaiSP: string;
  dienTichTimTuong: number;
  rawDonGiaChuaVAT?: number | null;
  rawDonGiaDaVAT?: number | null;
  rawTyLeVATXD?: number | null;
  ngayKy: Date | null;
  ngayBanGiao: Date | null;
  soPhieu: string;
  ghiChu: string;
  maNVKD: string | null;
  maSan: string | null;
}

/** State ban đầu của form web cho 1 sản phẩm (useState + effect "Reset form data when product changes") */
export function formFromProduct(p: any, now: Date = new Date()): SheetForm {
  p = p || {};
  const isLowRise = productIsLowRise(p);
  return {
    isLowRise,
    duAn: p.project_name || p.TenDA || "",
    maSanPham: p.code || p.KyHieu || "",
    loaiSP: p.product_type || "Chung cư",
    dienTichTimTuong: p.wall_area ?? p.DTTimDuong ?? p.area ?? 0,
    dienTichThongThuy: p.DienTichThongThuy ?? p.area ?? 0,
    donGiaDatPhanBo: p.DGDatPB ?? 0,
    dienTichDat: p.land_area ?? p.DienTichDat ?? 0,
    donGiaDat: p.land_unit_price ?? p.DonGiaDat ?? 0,
    dienTichXD: p.construction_area ?? p.DienTichXD ?? 0,
    tongDTSanXD: p.total_floor_area ?? p.TongDTSanXD ?? 0,
    donGiaXD: p.construction_unit_price ?? p.DonGiaXD ?? p.DonGiaXayDung ?? 0,
    donGiaSuDungDat: isLowRise
      ? p.land_unit_price ?? p.DonGiaDat ?? 0
      : p.unit_price_before_vat ?? p.DonGiaDaVAT ?? p.DonGiaChuaVAT ?? 0,
    tyLeVAT: p.TyLeVAT ?? 10,
    tyLePBT: p.TyLePhiBaoTri ?? 2,
    rawDonGiaChuaVAT: p.DonGiaChuaVAT ?? null,
    rawDonGiaDaVAT: p.DonGiaDaVAT ?? null,
    rawTongGiaChuaVAT: p.TongGiaChuaVAT ?? null,
    rawTongGiaDaVAT: p.TongGiaDaVAT ?? null,
    rawTienVAT: p.TienVAT ?? null,
    rawTienPhiBaoTri: p.TienPhiBaoTri ?? null,
    rawTongGomPBT: p.TongGomPBT ?? null,
    rawTienDatChuaVAT: p.rawTienDatChuaVAT ?? p.GiaDatKoVAT ?? p.GiaDatChuaVAT ?? null,
    rawTienVATDat: p.rawTienVATDat ?? p.VATDat ?? null,
    rawTongTienDatVAT: p.rawTongTienDatVAT ?? p.TongGiaDat ?? null,
    rawTienSDDat: p.rawTienSDDat ?? p.TienSDDat ?? null,
    rawThanhTienXD: p.rawThanhTienXD ?? p.ThanhTienXD ?? null,
    rawTienVATXD: p.rawTienVATXD ?? p.TienVATXayDung ?? null,
    rawTongGiaXDVAT: p.rawTongGiaXDVAT ?? p.ThanhTienVATXayDung ?? null,
    rawTongGiaTriHDMB: p.rawTongGiaTriHDMB ?? p.TongGiaTriHDMB ?? null,
    rawTyLeVATXD: p.rawTyLeVATXD ?? p.TyLeVATXayDung ?? null,
    ngayKy: now,
    ngayBanGiao: null,
    tienCoc: 50000000,
    soPhieu: "",
    ghiChu: "",
    maNVKD: null,
    maSan: null,
  };
}

/** getProductDefaults – giá gốc của sản phẩm khi bảng giá không có dòng cho căn */
export function productDefaults(p: any) {
  p = p || {};
  const isLow = productIsLowRise(p);
  return {
    dienTichThongThuy: p.DienTichThongThuy ?? p.area ?? 0,
    tyLeVAT: p.TyLeVAT ?? 10,
    tyLePBT: p.TyLePhiBaoTri ?? 2,
    dienTichDat: p.land_area ?? p.DienTichDat ?? 0,
    donGiaDat: p.land_unit_price ?? p.DonGiaDat ?? 0,
    dienTichXD: p.construction_area ?? p.DienTichXD ?? 0,
    donGiaXD: p.construction_unit_price ?? p.DonGiaXD ?? p.DonGiaXayDung ?? 0,
    donGiaSuDungDat: isLow
      ? p.land_unit_price ?? p.DonGiaDat ?? 0
      : p.unit_price_before_vat ?? p.DonGiaDaVAT ?? p.DonGiaChuaVAT ?? 0,
    rawDonGiaChuaVAT: p.DonGiaChuaVAT ?? null,
    rawDonGiaDaVAT: p.DonGiaDaVAT ?? null,
    rawTongGiaChuaVAT: p.TongGiaChuaVAT ?? null,
    rawTongGiaDaVAT: p.TongGiaDaVAT ?? null,
    rawTienVAT: p.TienVAT ?? null,
    rawTienPhiBaoTri: p.TienPhiBaoTri ?? null,
    rawTongGomPBT: p.TongGomPBT ?? null,
  };
}

/**
 * 1 dòng price_list_items → giá theo bảng giá (ProductService.getSPByBG + handleBG): mỗi trường lấy bảng giá,
 * thiếu (null) thì về giá sản phẩm gốc. Không có dòng (`item` null) ⇒ toàn bộ giá sản phẩm gốc.
 */
export function applyPriceListItem(form: SheetForm, item: any | null, product: any): SheetForm {
  const defaults = productDefaults(product);
  if (!item) return { ...form, ...defaults };
  const pick = <T>(v: any, fb: T): T => (v !== null && v !== undefined ? (v as T) : fb);
  const donGiaDat = pick(item.land_alloc_price, defaults.donGiaDat);
  return {
    ...form,
    tyLeVAT: pick(item.vat_rate, defaults.tyLeVAT),
    tyLePBT: pick(item.maintenance_rate, defaults.tyLePBT),
    donGiaDat,
    donGiaXD: pick(item.construction_unit_price, defaults.donGiaXD),
    donGiaSuDungDat: form.isLowRise ? donGiaDat : pick(item.unit_price_vat, defaults.donGiaSuDungDat),
    rawDonGiaChuaVAT: pick(item.unit_price, defaults.rawDonGiaChuaVAT),
    rawDonGiaDaVAT: pick(item.unit_price_vat, defaults.rawDonGiaDaVAT),
    rawTongGiaChuaVAT: pick(item.total_before_vat, defaults.rawTongGiaChuaVAT),
    rawTongGiaDaVAT: pick(item.total_after_vat, defaults.rawTongGiaDaVAT),
    rawTienVAT: pick(item.vat_amount, defaults.rawTienVAT),
    rawTienPhiBaoTri: pick(item.maintenance_amount, defaults.rawTienPhiBaoTri),
    rawTongGomPBT: pick(item.total_payment, defaults.rawTongGomPBT),
  };
}

/** Mã trường cấu hình tính giá sản phẩm ↔ trường form (thứ tự giữ như web – trùng đích thì mã sau thắng) */
export const PRICE_FIELD_MAP: Record<string, string> = {
  DonGiaChuaVAT: "rawDonGiaChuaVAT",
  DonGiaDaVAT: "rawDonGiaDaVAT",
  TongGiaChuaVAT: "rawTongGiaChuaVAT",
  TongGiaDaVAT: "rawTongGiaDaVAT",
  TienVAT: "rawTienVAT",
  TienPhiBaoTri: "rawTienPhiBaoTri",
  TongGomPBT: "rawTongGomPBT",
  TongGiaTriHDMB: "rawTongGiaTriHDMB",
  GiaDatKoVAT: "rawTienDatChuaVAT",
  VATDat: "rawTienVATDat",
  TongGiaDat: "rawTongTienDatVAT",
  TienSDDat: "rawTienSDDat",
  ThanhTienXD: "rawThanhTienXD",
  TienVATXayDung: "rawTienVATXD",
  ThanhTienVATXayDung: "rawTongGiaXDVAT",
  TyLeVATXayDung: "rawTyLeVATXD",
  TyLeVAT: "tyLeVAT",
  TyLePhiBaoTri: "tyLePBT",
  DienTichTimTuong: "dienTichTimTuong",
  DienTichThongThuy: "dienTichThongThuy",
  DienTichDat: "dienTichDat",
  DonGiaDat: "donGiaDat",
  DGDatPB: "donGiaDatPhanBo",
  DienTichXD: "dienTichXD",
  TongDTSanXD: "tongDTSanXD",
  DonGiaXD: "donGiaXD",
  TongThanhToan: "rawTongGomPBT",
  TongGiaTriHD: "rawTongGomPBT",
  PhiBaoTri: "rawTienPhiBaoTri",
  DonGiaSuDungDat: "donGiaSuDungDat",
  DonGiaSDDat: "donGiaSuDungDat",
  TongTienDatVAT: "rawTongTienDatVAT",
  TongGiaXDVAT: "rawTongGiaXDVAT",
  DTTimTuong: "dienTichTimTuong",
  DTThongThuy: "dienTichThongThuy",
};

/** Giá trị hiện tại của form quy về mã trường cấu hình (priceCodeValues) */
export function priceCodeValues(form: SheetForm): Record<string, number> {
  const o: Record<string, number> = {};
  Object.entries(PRICE_FIELD_MAP).forEach(([code, key]) => {
    const v = (form as any)[key];
    if (v !== undefined && v !== null && v !== "") o[code] = Number(v) || 0;
  });
  return o;
}

/** Kết quả computeAllFormulas → form (handleProductPriceInputs) */
export function applyPriceInputs(form: SheetForm, next: Record<string, any>): SheetForm {
  const patch: any = {};
  Object.entries(next).forEach(([code, val]) => {
    const target = PRICE_FIELD_MAP[code];
    if (target) patch[target] = val;
  });
  if (next.DonGiaChuaVAT != null && !form.isLowRise) patch.donGiaSuDungDat = next.DonGiaChuaVAT;
  if (next.DonGiaDat != null) patch.donGiaSuDungDat = patch.donGiaSuDungDat ?? next.DonGiaDat;
  return { ...form, ...patch };
}

/* ============================ Khách hàng ============================ */

export interface SheetCustomer {
  MaKH: string | null;
  IsPersonal: boolean;
  TenKH?: string | null;
  SoCMND?: string | null;
  DiDong?: string | null;
  Email?: string | null;
  DiaChi?: string | null;
  ThuongTru?: string | null;
  NgaySinh?: string | null;
  NgayCap?: string | null;
  NoiCap?: string | null;
  MaQD?: string | null;
  TenCongTy?: string | null;
  MaSoThueCT?: string | null;
  DiaChiCT?: string | null;
  EmailCT?: string | null;
  DienThoaiCT?: string | null;
  NguoiDaiDienPL?: string | null;
  ChucVu?: string | null;
  SoGPKD?: string | null;
}

/**
 * Dòng cloud_customers (CustomerService.normalizeCustomerRow) → khách của phiếu – PriceSheetForm.handleCustomerSelect
 * (cá nhân: thông tin cá nhân; doanh nghiệp: thông tin công ty, người đại diện).
 */
export function customerFromRow(c: any): SheetCustomer {
  const isPersonal = c?.is_personal !== false;
  if (!isPersonal) {
    return {
      MaKH: c?.id ?? null,
      IsPersonal: false,
      TenCongTy: c?.ten_cong_ty || c?.tenKH || null,
      MaSoThueCT: c?.ma_so_thue_ct || null,
      DiaChiCT: c?.dia_chi_ct || null,
      EmailCT: c?.email_ct || null,
      DienThoaiCT: c?.dien_thoai_ct || null,
      NguoiDaiDienPL: c?.nguoi_dai_dien_pl || c?.ten_kh || null,
      ChucVu: c?.chuc_vu || null,
      SoGPKD: c?.so_gpkd || null,
    };
  }
  return {
    MaKH: c?.id ?? null,
    IsPersonal: true,
    TenKH: c?.ten_kh || c?.tenKH || null,
    SoCMND: c?.so_cmnd || c?.cccd || null,
    DiDong: c?.di_dong || c?.dien_thoai || null,
    Email: c?.email || null,
    DiaChi: c?.dia_chi || null,
    ThuongTru: c?.thuong_tru || null,
    NgaySinh: c?.ngay_sinh || null,
    NgayCap: c?.ngay_cap || null,
    NoiCap: c?.noi_cap || null,
    MaQD: c?.ma_qd || null,
  };
}

/** Tên / SĐT hiển thị của khách trên phiếu */
export function customerLabel(c: SheetCustomer | null): { name: string; phone: string } {
  if (!c) return { name: "", phone: "" };
  return c.IsPersonal
    ? { name: c.TenKH || "", phone: c.DiDong || "" }
    : { name: c.TenCongTy || c.TenKH || "", phone: c.DienThoaiCT || c.DiDong || "" };
}

/** Ngày giờ gửi máy chủ như DateHelper.ToApiDateTime (giờ máy, không múi giờ) */
export function toApiDateTime(v: any): string | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return null;
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/* ============================ Bản nháp + lưu ============================ */

export interface SheetPromotion {
  ID: string;
  TenQuaTang: string;
  SoLuong: number;
  GiaTri: number;
}

export interface SheetDraft {
  product: any;
  form: SheetForm;
  priceListId: string | null;
  policyId: string | null;
  policyName: string;
  /** uuid cấu hình tính giá CSCAOTANG/CSTHAPTANG (MaCSTong / CauHinhTinhGiaID) */
  policyConfigId: string | null;
  /** chi tiết chính sách (đã chuẩn hoá) – lấy MaCK theo vị trí như web */
  policyDetails: any[];
  rounds: PolicyDiscountRound[];
  templateId: string | null;
  templateName: string;
  schedule: ScheduleRow[];
  promotions: SheetPromotion[];
  customer: SheetCustomer | null;
}

const num = (v: any) => (v === null || v === undefined || v === "" ? null : Number(v));

/** payload + snapshot đúng như PriceSheetForm.handleSave (type "pricesheet") */
export function buildPayload(d: SheetDraft, calc: PriceCalc): { payload: any; snapshot: any } {
  const fd: any = d.form;
  const p: any = d.product || {};
  const c: any = calc || {};
  const isLow = !!fd.isLowRise;

  const dienTichThongThuy = num(fd.dienTichThongThuy) ?? num(p.DienTichThongThuy) ?? num(p.area);
  const donGiaDaVAT = num(fd.rawDonGiaDaVAT) ?? num(p.DonGiaDaVAT);
  const tongGiaDaVAT = num(fd.rawTongGiaDaVAT) ?? num(p.TongGiaDaVAT);
  const tyLeVAT = num(fd.tyLeVAT) ?? num(p.TyLeVAT);
  const tienVAT = num(fd.rawTienVAT) ?? num(p.TienVAT);
  const donGiaChuaVAT =
    donGiaDaVAT !== null && tyLeVAT !== null && tyLeVAT !== 0 ? donGiaDaVAT / (1 + tyLeVAT / 100) : num(p.DonGiaChuaVAT);
  const tongGiaChuaVAT =
    tongGiaDaVAT !== null && tyLeVAT !== null && tyLeVAT !== 0 ? tongGiaDaVAT / (1 + tyLeVAT / 100) : num(p.TongGiaChuaVAT);
  const tyLePhiBaoTri = num(fd.tyLePBT) ?? num(p.TyLePhiBaoTri);
  const tienPhiBaoTri = num(fd.rawTienPhiBaoTri) ?? num(p.TienPhiBaoTri);
  const tongGiaGomVATPBT = num(fd.rawTongGomPBT) ?? num(p.TongGomPBT) ?? fd.rawTongGiaTriHDMB ?? c.tongGiaTriHDMB;

  const GiaTriHopDong = {
    DienTichThongThuy: dienTichThongThuy,
    DonGiaChuaVAT: donGiaChuaVAT,
    DonGiaGomVAT: donGiaDaVAT,
    TongChuaVAT: tongGiaChuaVAT,
    TyLeVAT: tyLeVAT,
    TienVAT: tienVAT,
    TongGomVAT: tongGiaDaVAT,
    TyLePhiBaoTri: tyLePhiBaoTri,
    TienPhiBaoTri: tienPhiBaoTri,
    TongGiaGomVATPBT: tongGiaGomVATPBT,
    DonGiaDat: num(fd.donGiaDat) ?? num(p.land_unit_price),
    DGDatPB: num(fd.donGiaDatPhanBo) ?? num(p.DGDatPB),
    TienDatChuaVAT: num(fd.rawTienDatChuaVAT) ?? num(p.rawTienDatChuaVAT),
    TienVATDat: num(fd.rawTienVATDat) ?? num(p.rawTienVATDat),
    TongTienVATDat: num(fd.rawTongTienDatVAT),
    DonGiaXD: num(fd.donGiaXD),
    TienXDChuaVAT: num(fd.rawThanhTienXD) ?? num(p.rawThanhTienXD),
    TienVATXD: num(fd.rawTienVATXD) ?? num(p.rawTienVATXD),
    TongTienXDGomVAT: num(fd.rawTongGiaXDVAT) ?? num(p.rawTongGiaXDVAT),
    TongGiaGomDatXD: num(fd.rawTongTienDatVAT) ?? num(p.rawTongTienDatVAT),
  };

  const hasCK =
    (d.rounds || []).some((r) => r?.enabled && ((num(r.discountPercent) ?? 0) > 0 || (num(r.tienCK) ?? 0) > 0)) ||
    (c.tienChietKhau && c.tienChietKhau > 0);
  const GiaTriHopDongSauCK = hasCK
    ? {
        DienTichThongThuy: dienTichThongThuy,
        DonGiaChuaVAT: dienTichThongThuy && c.giaTriSauCK ? c.giaTriSauCK / dienTichThongThuy : null,
        DonGiaGomVAT: dienTichThongThuy && num(c.tongGomVAT) ? num(c.tongGomVAT)! / dienTichThongThuy : null,
        TongChuaVAT: num(c.giaTriSauCK),
        TyLeVAT: tyLeVAT,
        TienVAT: num(c.tienVAT),
        TongGomVAT: num(c.tongGomVAT),
        TyLePhiBaoTri: tyLePhiBaoTri,
        TienPhiBaoTri: num(c.phiBaoTri),
        TongGiaGomVATPBT: num(c.tongGiaTriHD ?? c.tongGiaTriHDMB) ?? fd.rawTongGiaTriHDMB ?? c.tongGiaTriHDMB,
        DonGiaDat: num(fd.donGiaDat) ?? num(p.land_unit_price),
        DGDatPB: num(c.donGiaDatPhanBo),
        TienDatChuaVAT: num(c.tienDatChuaVAT),
        TienVATDat: num(c.tienVATDat),
        TongTienVATDat: num(c.tongTienDatVAT),
        DonGiaXD: num(fd.donGiaXD),
        TienXDChuaVAT: num(c.thanhTienXDSauCK ?? c.thanhTienXD),
        TienVATXD: num(c.tienVATXD),
        TongTienXDGomVAT: num(c.tongGiaXDVAT),
        TongGiaGomDatXD: num(c.tongGiaTriHDMB),
      }
    : Object.fromEntries(Object.keys(GiaTriHopDong).map((k) => [k, null]));

  const roundResults: any[] = c.roundResults || [];
  const ChinhSach = (d.rounds || [])
    .map((round, idx) => {
      if (!round?.enabled) return null;
      if (!((num(round.discountPercent) ?? 0) > 0 || (num(round.tienCK) ?? 0) > 0)) return null;
      const rr = roundResults[idx] || {};
      const det = d.policyDetails[idx] || {};
      const tongChuaVAT = num(rr.tongChuaVAT ?? rr.tongGiaDat);
      const roundKeyAsNumber = Number(round.key);
      return {
        MaPGC: null,
        MaCS: d.policyId || null,
        CKDonGia: num(round.tienCK) || null,
        CKPT: num(round.discountPercent) || null,
        MaCK: round.maCK ?? det?.MaCK ?? (Number.isFinite(roundKeyAsNumber) ? roundKeyAsNumber : null),
        MaKTT: round.maKTT ?? det?.MaKTT ?? null,
        MaCSTong: d.policyConfigId || null,
        CKTien: num(rr.tongCK ?? rr.tienCK) || null,
        TongGiaChuaVAT: tongChuaVAT,
        VAT: num(rr.vat ?? rr.vatXD),
        TongGiaGomVAT: num(rr.tongGomVAT ?? rr.tienXDGomVAT),
        PhiBaoTri: num(isLow ? 0 : (tongChuaVAT ?? 0) * ((num(fd.tyLePBT) ?? 0) / 100)),
        TongGiaTriHDMB: num(rr.tongGiaTriHD ?? rr.tongGiaTriHDMB),
        TongGiaDatChuaVAT: num(rr.giaDatChuaVAT),
        TienVATDat: num(rr.vatDat),
        TongGiaDat: num(rr.tongGiaDat),
        TienXDTruocVAT: num(rr.tienXDChuaVAT),
        VATXD: num(rr.vatXD),
        TienXDCoVAT: num(rr.tienXDGomVAT),
      };
    })
    .filter(Boolean);

  const LichThanhToan = (d.schedule || []).map((row) => ({
    MaPGC: null,
    MaTH: d.templateId,
    DotTT: row.dot,
    DotTTText: row.kieuThanhToan,
    NgayTT: dueDateFor(row, fd.ngayKy),
    TyLeTT: num(row.tyLeTT),
    TuongUng: num(row.soTien),
    TyLeVAT: isLow ? 0 : num(row.tyLeVAT),
    ThueVAT: isLow ? 0 : num(row.tienVAT),
    TyLePBT: isLow ? 0 : num(row.tyLePBT),
    PhiBT: isLow ? 0 : num(row.tienBaoTri),
    SoTien: num(row.tongGiaTri),
    // Thấp tầng: cột "Tiền XD" = tienBaoTri / tyLeXD (= web helpers.toSavedScheduleItem)
    TyLePXD: isLow ? num(row.tyLeXD) : 0,
    TienXD: isLow ? num(row.tienBaoTri) : 0,
    TyLeVATDat: isLow ? num(row.tyLeVAT) : 0,
    TienVATDat: isLow ? num(row.tienVAT) : 0,
    DienGiai: row.dienGiai ?? row.ghiChu ?? "",
  }));

  const KhuyenMai = (d.promotions || []).map((g) => ({
    MaPGC: null,
    PromotionID: g.ID,
    SoLuong: num(g.SoLuong),
    TieuDe: g.TenQuaTang,
    SoTien: num(g.GiaTri),
  }));

  const kh: any = d.customer || {};
  const payload: any = {
    TTHopDong: {
      MaPGC: null,
      MaSP: p?.MaSP ?? null,
      NgayKy: toApiDateTime(fd.ngayKy),
      NgayBanGiaoKH: toApiDateTime(fd.ngayBanGiao),
      MaNVKD: fd.maNVKD,
      SoPhieu: fd.soPhieu,
      TienCoc: num(fd.tienCoc),
      GhiChu: fd.ghiChu,
      MaCan: p?.KyHieu || fd.maSanPham || null,
      MaDA: p?.MaDA ?? null,
      MaSan: fd.maSan || null,
      MaPDK: null,
      MaCS: d.policyId || null,
      MaDotGia: d.priceListId || null,
      CauHinhTinhGiaID: d.policyConfigId,
      GiaTriHopDong,
      GiaTriHopDongSauCK,
    },
    GiaGocSanPham: {
      DonGiaChuaVAT: num(p?.DonGiaChuaVAT),
      TongChuaVAT: num(p?.TongGiaChuaVAT),
      TongGomVAT: num(p?.TongGiaGomVAT ?? p?.TongGiaDaVAT),
      TienVAT: num(p?.TienVAT),
      TienPhiBaoTri: num(p?.TienPBT ?? p?.TienPhiBaoTri),
      TongGiaGomVATPBT: num(p?.TongGiaTriHDMB ?? p?.TongGiaGomPBT ?? p?.TongGomPBT),
      DonGiaDat: num(p?.DonGiaDat),
      DGDatPB: num(p?.DGDatPB),
      TienDatChuaVAT: num(p?.TongGiaDat),
      DonGiaXD: num(p?.DonGiaXayDung),
      TienXDChuaVAT: num(p?.ThanhTienXD),
    },
    TTKhachHang: {
      MaKH: kh.MaKH ?? null,
      IsPersonal: d.customer ? kh.IsPersonal !== false : true,
      TenKH: kh.TenKH ?? null,
      MaQD: kh.MaQD ?? null,
      DiDong: kh.DiDong ?? null,
      DiDong2: null,
      Email: kh.Email ?? null,
      Email2: null,
      MaSoTTNCN: null,
      SoTaiKhoan: null,
      TenNganHang: null,
      ThuongTru: kh.ThuongTru ?? null,
      DiaChi: kh.DiaChi ?? null,
      NgaySinh: toApiDateTime(kh.NgaySinh),
      SoCMND: kh.SoCMND ?? null,
      NgayCap: toApiDateTime(kh.NgayCap),
      NoiCap: kh.NoiCap ?? null,
      TenCongTy: kh.TenCongTy ?? null,
      MaSoThueCT: kh.MaSoThueCT ?? null,
      SoDKKD: null,
      DiaChiCT: kh.DiaChiCT ?? null,
      DienThoaiCT: kh.DienThoaiCT ?? null,
      EmailCT: kh.EmailCT ?? null,
      NguoiDaiDienPL: kh.NguoiDaiDienPL ?? null,
      NgayCapGPKD: null,
      NoiCapGPKD: null,
      SoGPKD: kh.SoGPKD ?? null,
      ChucVu: kh.ChucVu ?? null,
      ListKhachHang: [],
    },
    TT360KhachHang: {},
    ChinhSach,
    LichThanhToan,
    KhuyenMai,
  };

  const snapshot = {
    product: d.product ? { ...d.product } : null,
    projectName: fd.duAn || p?.TenDA || p?.project_name || "",
    productCode: p?.KyHieu || fd.maSanPham || "",
    productType: p?.TenLoaiBDS || fd.loaiSP || "",
    isLowRise: isLow,
    view: p?.TenView || p?.Huong || "",
    area: num(fd.dienTichThongThuy) || num(p?.DienTichThongThuy) || 0,
    policyName: d.policyName || "",
    scheduleName: d.templateName || "",
    policyDate: fd.ngayKy ? new Date(fd.ngayKy).toISOString() : null,
    customerName: kh.TenKH || "",
    customerPhone: kh.DiDong || "",
    customer360: {},
    policyRounds: (d.rounds || []).map((r) => ({
      key: r?.key,
      name: r?.name,
      enabled: r?.enabled !== false,
      discountPercent: num(r?.discountPercent) || 0,
      heSo: num(r?.heSo) || 1,
      tienCK: num(r?.tienCK) || 0,
      maCK: r?.maCK ?? null,
      maKTT: r?.maKTT ?? null,
    })),
    discounts: (d.rounds || [])
      .filter((r) => r?.enabled !== false)
      .map((r, i) => ({
        name: r?.name || `Chiết khấu ${i + 1}`,
        rate: num(r?.discountPercent) || 0,
        amount: num(c.roundResults?.[i]?.tongCK) || num(r?.tienCK) || 0,
      })),
    promotions: (d.promotions || []).map((g) => ({ name: g.TenQuaTang, quantity: num(g.SoLuong), amount: num(g.GiaTri) })),
    schedule: (d.schedule || []).map((row, i) => ({
      index: row?.dot ?? i + 1,
      name: row?.kieuThanhToan || row?.dienGiai || `Đợt ${i + 1}`,
      ratio: num(row?.tyLeTT),
      dueDate: row?.ngayTT ?? null,
      amount: num(row?.tongGiaTri) || num(row?.soTien),
    })),
    totals: {
      totalListedPrice: num(fd.rawTongGomPBT),
      unitPriceVAT: null,
      totalContractValue: num(c.tongGiaTriHD),
      totalWithVATNoMaintenance: num(c.tongGomVAT),
      totalNoVAT: num(c.tongChuaVAT),
      vatAmount: num(c.tienVAT),
      maintenanceFee: num(c.phiBaoTri),
      discountAmount: num(c.tienChietKhau),
      discountPercent: num(c.totalDiscountPercent),
    },
  };

  return { payload: { ...payload, _snapshot: snapshot }, snapshot };
}

/** Dòng gửi fn_price_sheet_save – phieu-tinh-gia/index.handlePriceSheetSaved */
export function buildSaveRow(
  payload: any,
  snapshot: any,
  ctx: { id?: string | null; sheetCode?: string | null; product?: any }
): any {
  const tt = payload?.TTHopDong || {};
  const t = snapshot?.totals || {};
  const area = Number(snapshot.area ?? ctx.product?.DienTichThongThuy ?? ctx.product?.area ?? 0);
  const row: any = {
    sheet_code: tt.SoPhieu || ctx.sheetCode || "",
    product_code: snapshot.productCode || tt.MaCan || ctx.product?.KyHieu || "",
    product_name: snapshot.productType || ctx.product?.TenLoaiBDS || null,
    product_type: snapshot.isLowRise ? "Thấp tầng" : "Cao tầng",
    area,
    unit_price: Number(t.unitPriceVAT || 0),
    base_price: Number(t.totalContractValue ?? 0),
    vat_rate: 10,
    maintenance_rate: 2,
    policy_name: snapshot.policyName || null,
    payload,
    snapshot,
  };
  if (ctx.id) row.id = ctx.id;
  return row;
}

/* ============================ Sửa phiếu ============================ */

/**
 * App chỉ sửa phiếu "đơn giản" – phần còn lại sửa trên web để không ghi đè dữ liệu app không quản lý.
 * Trả lý do không sửa được (null = sửa được).
 */
export function appEditBlockReason(sheet: any): string | null {
  if (!sheet) return "Không tải được phiếu";
  if (sheet.deleted_at) return "Phiếu đã xoá";
  if (String(sheet.status || "draft") !== "draft") return "Chỉ sửa được phiếu nháp";
  const payload = sheet.payload || {};
  const tt = payload.TTHopDong || {};
  if (sheet.pgc_id || tt.MaPGC) return "Phiếu tạo từ chứng từ – sửa trên web";
  const co = payload.TTKhachHang?.ListKhachHang;
  if (Array.isArray(co) && co.length) return "Phiếu có người đồng sở hữu – sửa trên web";
  const ir = payload.UuDaiLaiSuat;
  if (ir && typeof ir === "object" && Object.keys(ir).length) return "Phiếu có ưu đãi lãi suất – sửa trên web";
  const c360 = payload.TT360KhachHang;
  if (c360 && typeof c360 === "object" && Object.values(c360).some((v) => v !== null && v !== "" && v !== undefined))
    return "Phiếu có thông tin 360 khách hàng – sửa trên web";
  if (!sheet.snapshot?.product && !sheet.san_pham_id) return "Phiếu thiếu dữ liệu sản phẩm – sửa trên web";
  return null;
}

const has = (v: unknown) => v !== null && v !== undefined && v !== "";
const pickV = (v: unknown, fb: unknown) => (has(v) ? v : fb);
const divV = (a: unknown, b: unknown) => (Number(a) && Number(b) ? Number(a) / Number(b) : undefined);

/**
 * Sản phẩm dựng lại khi SỬA phiếu – bản sao web src/components/PriceSheet/productFromSavedSheet.ts (test so trực tiếp):
 * giá lấy đúng GiaTriHopDong đã lưu (đầu vào thật của lần tính), thiếu mới về giá căn trong snapshot.product.
 */
export function productFromSavedSheet(full: any): any {
  const sheet = full || {};
  const snap: any = sheet.snapshot || sheet.payload?._snapshot || {};
  const tt: any = sheet.payload?.TTHopDong || {};
  const g: any = tt.GiaTriHopDong || {};
  const saved: any = snap.product || {};
  const area = pickV(g.DienTichThongThuy, saved.DienTichThongThuy ?? saved.DienTichTT ?? snap.area ?? sheet.area);
  return {
    ...saved,
    MaSP: saved.MaSP ?? tt.MaSP ?? null,
    MaDA: saved.MaDA ?? tt.MaDA ?? null,
    code: saved.code || sheet.product_code,
    KyHieu: saved.KyHieu || sheet.product_code || snap.productCode,
    TenDA: saved.TenDA || snap.projectName,
    project_name: saved.project_name || sheet.project_name || sheet.projects?.name || snap.projectName,
    TenLoaiBDS: saved.TenLoaiBDS || snap.productType || sheet.product_name,
    product_type: saved.product_type || sheet.product_type,
    TenView: saved.TenView || snap.view,
    area: saved.area ?? sheet.area ?? area,
    DienTichThongThuy: area,
    DTTimDuong: saved.DTTimDuong ?? saved.DTTimTuong ?? undefined,
    TyLeVAT: pickV(g.TyLeVAT, saved.TyLeVAT),
    TyLePhiBaoTri: pickV(g.TyLePhiBaoTri, saved.TyLePhiBaoTri),
    DonGiaChuaVAT: pickV(g.DonGiaChuaVAT, saved.DonGiaChuaVAT ?? divV(g.TongChuaVAT, area)),
    DonGiaDaVAT: pickV(g.DonGiaGomVAT, saved.DonGiaDaVAT ?? divV(g.TongGomVAT, area)),
    TongGiaChuaVAT: pickV(g.TongChuaVAT, saved.TongGiaChuaVAT),
    TongGiaDaVAT: pickV(g.TongGomVAT, saved.TongGiaDaVAT),
    TienVAT: pickV(g.TienVAT, saved.TienVAT),
    TienPhiBaoTri: pickV(g.TienPhiBaoTri, saved.TienPhiBaoTri),
    TongGomPBT: pickV(g.TongGiaGomVATPBT, saved.TongGomPBT),
    DGDatPB: pickV(g.DGDatPB, saved.DGDatPB),
    DonGiaDat: pickV(g.DonGiaDat, saved.DonGiaDat),
    DonGiaXD: pickV(g.DonGiaXD, saved.DonGiaXD ?? saved.DonGiaXayDung),
    rawTienDatChuaVAT: pickV(g.TienDatChuaVAT, saved.rawTienDatChuaVAT),
    rawTienVATDat: pickV(g.TienVATDat, saved.rawTienVATDat),
    rawTongTienDatVAT: pickV(g.TongTienVATDat, saved.rawTongTienDatVAT),
    rawThanhTienXD: pickV(g.TienXDChuaVAT, saved.rawThanhTienXD),
    rawTienVATXD: pickV(g.TienVATXD, saved.rawTienVATXD),
    rawTongGiaXDVAT: pickV(g.TongTienXDGomVAT, saved.rawTongGiaXDVAT),
  };
}

/**
 * Phiếu đã lưu → form, đúng đường web: productFromSavedSheet → state ban đầu của form → effect "nạp lại phiếu"
 * (số phiếu, ngày ký, tiền cọc, ghi chú…; diện tích = diện tích của lần tính đã lưu).
 */
export function formFromSheet(sheet: any): SheetForm {
  const payload = sheet?.payload || {};
  const snap = sheet?.snapshot || payload._snapshot || {};
  const tt = payload.TTHopDong || {};
  const base = formFromProduct(productFromSavedSheet(sheet));
  const toDate = (v: any) => (v ? new Date(v) : null);
  return {
    ...base,
    soPhieu: tt.SoPhieu || "",
    ngayKy: toDate(tt.NgayKy) || base.ngayKy,
    ngayBanGiao: toDate(tt.NgayBanGiaoKH),
    maSanPham: tt.MaCan || snap.productCode || base.maSanPham,
    maNVKD: tt.MaNVKD ?? null,
    maSan: tt.MaSan ?? null,
    tienCoc: Number(tt.TienCoc) || 0,
    ghiChu: tt.GhiChu || "",
    duAn: snap.projectName || base.duAn,
    loaiSP: snap.productType || base.loaiSP,
    dienTichThongThuy: tt.GiaTriHopDong?.DienTichThongThuy ?? (Number(snap.area) || base.dienTichThongThuy),
  };
}

/** Khách hàng đã lưu trong payload → khách của bản nháp */
export function customerFromSheet(sheet: any): SheetCustomer | null {
  const kh = sheet?.payload?.TTKhachHang || {};
  if (!kh.MaKH && !kh.TenKH && !kh.TenCongTy) return null;
  return {
    MaKH: kh.MaKH ?? null,
    IsPersonal: kh.IsPersonal !== false,
    TenKH: kh.TenKH ?? null,
    SoCMND: kh.SoCMND ?? null,
    DiDong: kh.DiDong ?? null,
    Email: kh.Email ?? null,
    DiaChi: kh.DiaChi ?? null,
    ThuongTru: kh.ThuongTru ?? null,
    NgaySinh: kh.NgaySinh ?? null,
    NgayCap: kh.NgayCap ?? null,
    NoiCap: kh.NoiCap ?? null,
    MaQD: kh.MaQD ?? null,
    TenCongTy: kh.TenCongTy ?? null,
    MaSoThueCT: kh.MaSoThueCT ?? null,
    DiaChiCT: kh.DiaChiCT ?? null,
    EmailCT: kh.EmailCT ?? null,
    DienThoaiCT: kh.DienThoaiCT ?? null,
    NguoiDaiDienPL: kh.NguoiDaiDienPL ?? null,
    ChucVu: kh.ChucVu ?? null,
    SoGPKD: kh.SoGPKD ?? null,
  };
}

/**
 * Vòng CK đã lưu (snapshot.policyRounds) ghép công thức từ khung cấu hình theo `key`
 * (key = id vòng cấu hình, dòng dư "<key>_extra_<i>" dùng khung vòng cuối).
 */
export function roundsFromSheet(sheet: any, template: PolicyDiscountRound[]): PolicyDiscountRound[] {
  const saved: any[] = sheet?.snapshot?.policyRounds || sheet?.payload?._snapshot?.policyRounds || [];
  if (!saved.length || !template.length) return [];
  return saved.map((r, i) => {
    const baseKey = String(r?.key ?? "").replace(/_extra_\d+$/, "");
    const tpl = template.find((t) => t.key === baseKey) ?? template[i] ?? template[template.length - 1];
    return {
      ...tpl,
      key: String(r?.key ?? tpl.key),
      name: r?.name || tpl.name,
      enabled: r?.enabled !== false,
      discountPercent: Number(r?.discountPercent) || 0,
      heSo: Number(r?.heSo) || 1,
      tienCK: Number(r?.tienCK) || 0,
      maCK: r?.maCK ?? null,
      maKTT: r?.maKTT ?? null,
    };
  });
}

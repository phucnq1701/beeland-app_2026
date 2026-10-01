/**
 * Mở chi tiết từ báo cáo (file thuần, không import – test nạp trực tiếp).
 *  - Đợt tiến độ (Sắp đến hạn / Quá hạn) → chi tiết phiếu chứa đợt: đặt cọc (DATCOC) hoặc hợp đồng (HDGV/HDMB).
 *    Web DebtProgressReport không có click-through; app thêm, dùng lại màn chi tiết cọc / hợp đồng
 *    (cả hai tải lịch thanh toán + phiếu thu theo uuid phiếu giữ chỗ như web ContractDetail).
 *  - Phiếu thu → chi tiết phiếu thu (web VoucherDetailDrawer: fn_cash_voucher_get_by_id → CashVoucherService.toUi).
 */

type ProgressLike = {
  maPGC: string | null;
  giaiDoan: string;
  tenDA: string;
  kyHieu: string;
  soHD: string;
  hoTenKH: string;
  trangThai: string;
  tongGiaTri: number;
  daThuHD: number;
  diDong: string;
};

export type DocLink = { pathname: '/contract/[id]' | '/deposit/[id]'; params: { id: string; data: string } };

/** Đợt tiến độ → màn chi tiết phiếu (null khi không có uuid phiếu giữ chỗ). */
export function progressDocLink(row: ProgressLike): DocLink | null {
  const pgc = row.maPGC ? String(row.maPGC) : '';
  if (!pgc) return null;
  const common = {
    PhieuGiuChoId: pgc,
    MaPGC: pgc,
    TenDA: row.tenDA || null,
    TenTT: row.trangThai || null,
    TongGiaTriHDMB: row.tongGiaTri || null,
    DaThu: row.daThuHD,
    DiDong: row.diDong || null,
  };
  if (row.giaiDoan === 'DATCOC') {
    return {
      pathname: '/deposit/[id]',
      params: {
        id: pgc,
        data: JSON.stringify({ ...common, SoPhieu: row.soHD, KhachHang: row.hoTenKH, MaSanPham: row.kyHieu }),
      },
    };
  }
  return {
    pathname: '/contract/[id]',
    params: {
      id: pgc,
      data: JSON.stringify({ ...common, SoHDMB: row.soHD, TenKH: row.hoTenKH, KyHieu: row.kyHieu }),
    },
  };
}

/** Hình thức thanh toán → chữ (web AccountingCloudService.hinhThucText). */
export function hinhThucText(v: unknown): string | null {
  if (v == null || v === '') return null;
  if (typeof v === 'boolean') return v ? 'Chuyển khoản' : 'Tiền mặt';
  const s = String(v).trim().toLowerCase();
  if (['true', '1', 'ck', 'chuyển khoản', 'chuyen khoan'].includes(s)) return 'Chuyển khoản';
  if (['false', '0', 'tm', 'tiền mặt', 'tien mat'].includes(s)) return 'Tiền mặt';
  return String(v).trim();
}

export type VoucherLine = {
  id: string;
  kyHieu: string;
  dotTT: string;
  loai: string;
  nguon: string;
  ngay: string | null;
  soTien: number;
  dienGiai: string;
  soGiaoDich: string;
  pgcId: string | null;
};

export type VoucherDetail = {
  id: string;
  soPhieu: string;
  ngay: string | null;
  nguoiNop: string;
  tenKH: string;
  dienThoai: string;
  tenDA: string;
  diaChi: string;
  hinhThuc: string | null;
  chungTuGoc: string;
  dienGiai: string;
  soTien: number;
  nguoiNhap: string;
  ngayNhap: string | null;
  lines: VoucherLine[];
};

const num = (v: unknown) => Number(v || 0) || 0;
const str = (v: unknown) => (v == null ? '' : String(v));

/** JSON phiếu (_cv_json của fn_cash_voucher_get_by_id) → dữ liệu màn chi tiết; dòng con theo sort_order. */
export function toVoucherDetail(r: any): VoucherDetail | null {
  if (!r || !r.id) return null;
  const kh = r.khach || {};
  const lines: VoucherLine[] = (Array.isArray(r.chi_tiet) ? [...r.chi_tiet] : [])
    .sort((a: any, b: any) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0))
    .map((d: any) => ({
      id: str(d.id),
      kyHieu: str(d.ky_hieu),
      dotTT: d.dot_tt != null && d.dot_tt !== '' ? `Đợt ${d.dot_tt}` : '',
      loai: str(d.ten_loai),
      nguon: str(d.ten_nguon),
      ngay: d.ngay_thu_chi ?? null,
      soTien: num(d.so_tien),
      dienGiai: str(d.dien_giai),
      soGiaoDich: str(d.so_gd),
      pgcId: d.pgc_id ? String(d.pgc_id) : null,
    }));
  return {
    id: String(r.id),
    soPhieu: str(r.so_phieu),
    ngay: r.ngay_phieu ?? null,
    nguoiNop: str(r.nguoi_nop),
    tenKH: str(kh.ten_kh || kh.ten_cong_ty),
    dienThoai: str(kh.dien_thoai),
    tenDA: str(r.du_an?.ten_da),
    diaChi: str(r.dia_chi),
    hinhThuc: hinhThucText(r.hinh_thuc),
    chungTuGoc: str(r.chung_tu_goc),
    dienGiai: str(r.dien_giai),
    soTien: num(r.so_tien),
    nguoiNhap: str(r.ten_nguoi_nhap),
    ngayNhap: r.ngay_nhap ?? null,
    lines,
  };
}

export interface Deposit {
  maDC: string;
  soPhieu: string;
  ngayDatCoc: string;
  tenKH: string;
  maSP: string;
  soTienCoc: number;
  trangThai: string;
  tenDA: string;
  colorTT: string;
}

export interface DepositPaymentHistory {
  ngayThu: string;
  soTien: number;
  ghiChu: string;
  hinhThuc: string;
}

export interface DepositDetail extends Deposit {
  soCMND: string;
  diDong: string;
  email: string;
  diaChi: string;
  loaiSP: string;
  dienTich: string;
  donGia: number;
  ghiChu: string;
  nguoiTao: string;
  ngayTao: string;
  lichSuDongTien: DepositPaymentHistory[];
  tongDaDong: number;
  tongConLai: number;
}

export const DEMO_DEPOSITS: Deposit[] = [
  {
    maDC: "DC-001",
    soPhieu: "PDC-2025-000123",
    ngayDatCoc: "2025-06-10",
    tenKH: "Nguyễn Văn An",
    maSP: "A-12-08",
    soTienCoc: 200000000,
    trangThai: "Đã thanh toán",
    tenDA: "Bee Land Tower",
    colorTT: "#10B981",
  },
  {
    maDC: "DC-002",
    soPhieu: "PDC-2025-000456",
    ngayDatCoc: "2025-06-15",
    tenKH: "Trần Thị Bích Ngọc",
    maSP: "B-05-02",
    soTienCoc: 300000000,
    trangThai: "Chờ thanh toán",
    tenDA: "Bee Land Riverside",
    colorTT: "#F59E0B",
  },
  {
    maDC: "DC-003",
    soPhieu: "PDC-2025-000789",
    ngayDatCoc: "2025-07-01",
    tenKH: "Lê Hoàng Minh",
    maSP: "C-03-11",
    soTienCoc: 150000000,
    trangThai: "Đã thanh toán",
    tenDA: "Bee Land Garden",
    colorTT: "#10B981",
  },
  {
    maDC: "DC-004",
    soPhieu: "PDC-2025-001012",
    ngayDatCoc: "2025-07-05",
    tenKH: "Phạm Quốc Bảo",
    maSP: "A-08-15",
    soTienCoc: 250000000,
    trangThai: "Đã hủy",
    tenDA: "Bee Land Tower",
    colorTT: "#EF4444",
  },
  {
    maDC: "DC-005",
    soPhieu: "PDC-2025-001345",
    ngayDatCoc: "2025-07-12",
    tenKH: "Võ Thị Hương",
    maSP: "B-10-06",
    soTienCoc: 180000000,
    trangThai: "Chờ thanh toán",
    tenDA: "Bee Land Riverside",
    colorTT: "#F59E0B",
  },
  {
    maDC: "DC-006",
    soPhieu: "PDC-2025-001678",
    ngayDatCoc: "2025-08-01",
    tenKH: "Đặng Văn Tùng",
    maSP: "C-07-03",
    soTienCoc: 350000000,
    trangThai: "Đã thanh toán",
    tenDA: "Bee Land Garden",
    colorTT: "#10B981",
  },
  {
    maDC: "DC-007",
    soPhieu: "PDC-2025-002001",
    ngayDatCoc: "2025-08-10",
    tenKH: "Bùi Thanh Tâm",
    maSP: "A-15-20",
    soTienCoc: 220000000,
    trangThai: "Đã thanh toán",
    tenDA: "Bee Land Tower",
    colorTT: "#10B981",
  },
  {
    maDC: "DC-008",
    soPhieu: "PDC-2025-002334",
    ngayDatCoc: "2025-08-18",
    tenKH: "Hoàng Thị Mai",
    maSP: "B-02-14",
    soTienCoc: 280000000,
    trangThai: "Chờ thanh toán",
    tenDA: "Bee Land Riverside",
    colorTT: "#F59E0B",
  },
  {
    maDC: "DC-009",
    soPhieu: "PDC-2025-002667",
    ngayDatCoc: "2025-09-02",
    tenKH: "Trịnh Quang Huy",
    maSP: "C-11-09",
    soTienCoc: 160000000,
    trangThai: "Đã hủy",
    tenDA: "Bee Land Garden",
    colorTT: "#EF4444",
  },
  {
    maDC: "DC-010",
    soPhieu: "PDC-2025-003000",
    ngayDatCoc: "2025-09-15",
    tenKH: "Ngô Minh Châu",
    maSP: "A-20-05",
    soTienCoc: 400000000,
    trangThai: "Đã thanh toán",
    tenDA: "Bee Land Tower",
    colorTT: "#10B981",
  },
];

export const DEMO_DEPOSIT_DETAILS: Record<string, DepositDetail> = {
  "DC-001": {
    maDC: "DC-001",
    soPhieu: "PDC-2025-000123",
    ngayDatCoc: "2025-06-10",
    tenKH: "Nguyễn Văn An",
    maSP: "A-12-08",
    soTienCoc: 200000000,
    trangThai: "Đã thanh toán",
    tenDA: "Bee Land Tower",
    colorTT: "#10B981",
    soCMND: "079201001234",
    diDong: "0901234567",
    email: "nguyenvanan@gmail.com",
    diaChi: "123 Nguyễn Huệ, Q.1, TP.HCM",
    loaiSP: "Căn hộ 2PN",
    dienTich: "75.5 m²",
    donGia: 65000000,
    ghiChu: "Khách hàng VIP, cần ưu tiên",
    nguoiTao: "Admin Bee Land",
    ngayTao: "2025-06-10",
    lichSuDongTien: [
      { ngayThu: "2025-06-10", soTien: 100000000, ghiChu: "Đặt cọc lần 1", hinhThuc: "Chuyển khoản" },
      { ngayThu: "2025-06-20", soTien: 100000000, ghiChu: "Đặt cọc lần 2", hinhThuc: "Chuyển khoản" },
    ],
    tongDaDong: 200000000,
    tongConLai: 0,
  },
  "DC-002": {
    maDC: "DC-002",
    soPhieu: "PDC-2025-000456",
    ngayDatCoc: "2025-06-15",
    tenKH: "Trần Thị Bích Ngọc",
    maSP: "B-05-02",
    soTienCoc: 300000000,
    trangThai: "Chờ thanh toán",
    tenDA: "Bee Land Riverside",
    colorTT: "#F59E0B",
    soCMND: "079301005678",
    diDong: "0912345678",
    email: "bichngoc.tran@gmail.com",
    diaChi: "456 Lê Lợi, Q.3, TP.HCM",
    loaiSP: "Căn hộ 3PN",
    dienTich: "95.2 m²",
    donGia: 72000000,
    ghiChu: "",
    nguoiTao: "Admin Bee Land",
    ngayTao: "2025-06-15",
    lichSuDongTien: [
      { ngayThu: "2025-06-15", soTien: 150000000, ghiChu: "Đặt cọc lần 1", hinhThuc: "Tiền mặt" },
    ],
    tongDaDong: 150000000,
    tongConLai: 150000000,
  },
};

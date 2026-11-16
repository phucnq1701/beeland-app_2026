// ⚠️ TỰ SINH — kiểu trích nguyên văn (module không thuần) từ web src/pages/customers/quan-ly/khach-hang/types.ts (scripts/sync-web-pricing.cjs): CustomerFormModalHandle. KHÔNG SỬA TAY.
export interface Customer {
  /** uuid khách hàng (cloud_customers.id) */
  MaKH: string | null;
  MaSoKH: string | null;
  /** uuid công ty/đại lý sở hữu (dm_companies.id) */
  CompanyId?: string | null;
  TenCongTyQuanLy?: string | null;
  IsAgency?: boolean | null;
  IsNoxh?: boolean | null;
  MaTT: number | null;
  TenKH: string | null;
  MaQD: number | null;
  DiDong: string | null;
  Email: string | null;
  ThuongTru: string | null;
  NgaySinh: string | null;
  SoCMND: string | null;
  NgayCap: string | null;
  NoiCap: string | null;
  MaNguon: number | null;
  IsPersonal: boolean | null;
  TenCongTy: string | null;
  MaSoThueCT: string | null;
  DiaChiCT: string | null;
  EmailCT: string | null;
  DienThoaiCT: string | null;
  NguoiDaiDienPL: string;
  ChucVu: string | null;
  VanBanUQ: string | null;

  /** Tỉnh/TP + Phường/Xã thường trú (id danh mục tb_dm_tinh / tb_dm_xa — GET /api/fn/dia-gioi, cột ma_tinh / ma_xa — QH5) */
  MaTinh?: string | null;
  MaXa?: string | null;
  /** HĐ liên quan (cloud_contracts.id) + nhãn máy chủ trả khi đọc (QH2–QH3) */
  HdLienQuanId?: string | null;
  HdLienQuan?: any | null;
  /** Mối quan hệ (danh mục moi_quan_he_kh) — độc lập với HĐ liên quan (QH1) */
  MoiQuanHeId?: string | null;
  TenMoiQuanHe?: string | null;
}

export interface NotifyRecipient {
  key: string;
  HoTen: string;
  DienThoai1: string;
  Email1: string;
  DienThoai2: string;
  Email2: string;
  NhanEmail: boolean;
  NhanSMS: boolean;
  NhanZalo: boolean;
}

/** Người được ủy quyền của khách hàng doanh nghiệp (cho phép nhiều người) */
export interface AuthorizedPerson {
  key: string;
  HoTen: string;
  ChucVu: string;
  DienThoai: string;
  Email: string;
  SoCCCD: string;
  NgayCap: string | null;
  NoiCap: string;
  ThuongTru: string;
  DiaChiLH: string;
  /** Văn bản ủy quyền: tên/số văn bản + tệp đính kèm (nếu có) */
  VanBanUQ: string;
  VanBanUQFile?: { name: string; url: string; path?: string } | null;
}

export interface NewCustomerData {
  
  TenNganHang: string | null;
  MaKH: number | null;
  MaSoKH: number | null;
  MaTT: number | null;
  TenKH: string | null;
  MaQD: number | null;
  DiDong: string | null;
  Email: string | null;
  ThuongTru: string | null;
  DiaChi: string | null;
  NgaySinh: string | null;
  SoCMND: string | null;
  NgayCap: string | null;
  NoiCap: string | null;
  MaNguon: number | null;
  IsPersonal: boolean | null;
  TenCongTy: string | null;
  MaSoThueCT: string | null;
  DiaChiCT: string | null;
  EmailCT: string | null;
  DienThoaiCT: string | null;
  NguoiDaiDienPL: string;
  ChucVu: string | null;
  SoGPKD: string | null;
  NoiCapGDKKD: string | null;
  NgayCapGDKKD: string | null;

  /** Doanh nghiệp: số fax */
  FaxCT?: string | null;

  /** Người đại diện pháp luật – thông tin cá nhân */
  NDDDienThoai?: string | null;
  NDDEmail?: string | null;
  NDDSoCCCD?: string | null;
  NDDNgayCap?: string | null;
  NDDNoiCap?: string | null;
  NDDThuongTru?: string | null;
  NDDDiaChiLH?: string | null;
  /** Văn bản ủy quyền của người đại diện pháp luật */
  VanBanUQ?: string | null;

  /** Danh sách người được ủy quyền */
  NguoiUyQuyenList?: AuthorizedPerson[];

  /** Tỉnh/TP + Phường/Xã thường trú (id danh mục tb_dm_tinh / tb_dm_xa — GET /api/fn/dia-gioi, cột ma_tinh / ma_xa — QH5) */
  MaTinh?: string | null;
  MaXa?: string | null;
  /** HĐ liên quan (cloud_contracts.id) + nhãn máy chủ trả khi đọc (QH2–QH3) */
  HdLienQuanId?: string | null;
  HdLienQuan?: any | null;
  /** Mối quan hệ (danh mục moi_quan_he_kh) — độc lập với HĐ liên quan (QH1) */
  MoiQuanHeId?: string | null;
  TenMoiQuanHe?: string | null;


  DiDong2: string | null;
  Email2: string | null;
  MaSoTTNCN: string | null;
  SoTaiKhoan: string | null;
  MaNH: number | null;

  // Người nhận thông báo
  NguoiNhanTB: string | null;
  NNDienThoai1: string | null;
  NNEmail1: string | null;
  NNDienThoai2: string | null;
  NNEmail2: string | null;
  NhanEmail: boolean | null;
  NhanSMS: boolean | null;
  NhanZalo: boolean | null;

  /** Danh sách người nhận thông báo (cho phép nhiều người) */
  NguoiNhanTBList?: NotifyRecipient[];

  /** Ảnh CCCD/CMND đã tải lên */
  AnhCCCDTruoc?: string | null;
  AnhCCCDSau?: string | null;
}

export interface CustomerFormModalHandle {
  openAdd: (activeTab: string) => void;
  openEdit: (customer: Customer, activeTab: string) => void;
  openAddCoOwner: (activeTab?: string) => void;
  /** Luồng độc lập: thêm KH và trả về dữ liệu cho caller, KHÔNG ảnh hưởng onSuccess chung */
  openAddWithCallback: (
    activeTab: string,
    onDone: (customer: Customer) => void,
    /** Điền sẵn vào form trống (vd. thông tin khách khai trong BeeChat) */
    prefill?: Partial<Pick<NewCustomerData, "TenKH" | "DiDong" | "Email">>
  ) => void;
  /** Luồng độc lập: sửa KH và trả về dữ liệu cho caller, KHÔNG ảnh hưởng onSuccess chung */
  openEditWithCallback: (
    customer: Customer,
    activeTab: string,
    onDone: (customer: Customer) => void,
    /** Khoá Họ tên / Số CMND-CCCD (dùng khi sửa khách hàng chính của lịch ký) */
    opts?: { lockIdentity?: boolean }
  ) => void;
}

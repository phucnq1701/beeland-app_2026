// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/signing-shift-config/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Đối tượng áp dụng của một hồ sơ trong loại thủ tục (DK7) */
export type DoiTuongHoSo = "ALL" | "CA_NHAN" | "VO_CHONG" | "DOANH_NGHIEP";

/** Hồ sơ gán vào loại thủ tục (id = Danh mục hồ sơ) */
export interface HoSoRef {
  id: string;
  doiTuong: DoiTuongHoSo;
  /** Ghi chú riêng của thủ tục (vd. "2 bản sao công chứng") */
  ghiChu?: string | null;
}

/** Loại thủ tục ký (cloud_signing_procedures) */
export interface ProcedureType {
  /** Ký hiệu loại thủ tục (duy nhất trong một bộ cấu hình) */
  code: string;
  /** uuid bản ghi (rỗng khi thêm mới) */
  id?: string;
  name: string;
  order: number;
  active: boolean;
  /** Hồ sơ khách cần chuẩn bị; undefined = không gửi (máy chủ giữ hồ sơ đang lưu) */
  hoSo?: HoSoRef[];
}

/** Ca làm việc đặt lịch (cloud_signing_shifts) */
export interface WorkShift {
  /** Ký hiệu ca */
  code: string;
  /** uuid bản ghi (rỗng khi thêm mới) */
  id?: string;
  name: string;
  /** Giờ bắt đầu "HH:mm" */
  from: string;
  /** Giờ kết thúc "HH:mm" */
  to: string;
  /** Mã loại thủ tục áp dụng. Rỗng = áp dụng MỌI thủ tục của bộ (lịch ký, bàn giao, cổng khách) */
  procedures: string[];
  /** uuid loại thủ tục áp dụng như máy chủ lưu (chỉ đọc) */
  procedureIds?: string[];
  /** Số lượng khách tối đa được đặt lịch trong ca */
  capacity: number;
  order: number;
  active: boolean;
}

/**
 * Một bộ cấu hình (Dự án, Quỹ, Điểm ký); `isCustom` false = chưa có bộ (nơi gọi cũ đọc theo dự án).
 * `quyId` null = tất cả quỹ; `diemKyId` null = bộ cũ chưa gán điểm ký.
 */
export interface SigningConfig {
  projectId: string | null;
  isCustom: boolean;
  configId: string | null;
  quyId: string | null;
  diemKyId: string | null;
  isActive: boolean;
  procedures: ProcedureType[];
  shifts: WorkShift[];
}

/** Khoá của bộ khi lưu */
export interface ConfigKey {
  configId?: string | null;
  projectId: string | null;
  quyId: string | null;
  diemKyId: string | null;
  isActive?: boolean;
}

/** Dòng bảng Cấu hình ca làm việc (fn_signing_config_list) */
export interface ConfigRow {
  id: string;
  projectId: string | null;
  tenDA: string | null;
  quyId: string | null;
  quyTen: string | null;
  diemKyId: string | null;
  diemKyTen: string | null;
  diemKyDiaChi: string | null;
  diemKyActive: boolean | null;
  isActive: boolean;
  soThuTuc: number;
  soThuTucBat: number;
  soCa: number;
  soCaBat: number;
  tongCho: number;
  nguoiSua: string | null;
  updatedAt: string | null;
}

/** Dữ liệu `fn_signing_config_get` / `_save` */
export interface SigningConfigRaw {
  project_id: string | null;
  is_custom: boolean;
  config_id?: string | null;
  quy_id?: string | null;
  diem_ky_id?: string | null;
  is_active?: boolean | null;
  procedures:
    | {
        id: string;
        code: string;
        name: string;
        order: number;
        active: boolean;
        ho_so?: { id: string; doi_tuong?: string | null; ghi_chu?: string | null }[] | null;
      }[]
    | null;
  shifts:
    | {
        id: string;
        code: string;
        name: string;
        from: string | null;
        to: string | null;
        procedure_ids: string[] | null;
        capacity: number | null;
        order: number | null;
        active: boolean;
      }[]
    | null;
}

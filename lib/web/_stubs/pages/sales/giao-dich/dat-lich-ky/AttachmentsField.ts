// ⚠️ TỰ SINH — kiểu trích nguyên văn (module không thuần) từ web src/pages/sales/giao-dich/dat-lich-ky/AttachmentsField.tsx (scripts/sync-web-pricing.cjs): SigningAttachment. KHÔNG SỬA TAY.
export interface SigningAttachment {
  /** Tên tệp hiển thị */
  fileName: string;
  /** Đường dẫn tệp trên kho lưu trữ */
  url: string;
  /** Thời điểm tải lên (ISO) */
  uploadedAt?: string;
  /** Tệp của hồ sơ nào (Danh mục hồ sơ) — trống = tài liệu khác (DK15) */
  hoSoId?: string | null;
  /** Tên hồ sơ lúc tải lên (để vẫn hiện đúng khi thủ tục đổi danh sách hồ sơ) */
  hoSoTen?: string | null;
  /** Số lịch ký đã nộp tệp này (thừa hưởng từ kho hồ sơ của giao dịch — DK31–DK35) */
  tuLichKy?: number | null;
  /** Cờ tạm trên form: tệp lấy từ kho hồ sơ của giao dịch đang chọn (bỏ trước khi lưu) */
  _kho?: boolean;
}

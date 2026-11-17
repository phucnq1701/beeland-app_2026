// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/dataSourceMode.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Chế độ nguồn dữ liệu toàn hệ thống: Cloud (mặc định) hoặc Beeland API.
 * - "cloud": chỉ đọc dữ liệu từ Cloud (không để API ghi đè lên UI)
 * - "beeland": đọc từ API Beeland như luồng cũ
 */
export type DataSourceMode = "cloud" | "beeland";

const KEY = "dataSourceMode";
export const DATA_SOURCE_MODE_EVENT = "data-source-mode-change";

// 2026-10-01: bỏ nguồn Beeland API (không dùng nữa) + bỏ nút chọn ở menu tài
// khoản → luôn Cloud. Giá trị "beeland" còn lưu ở trình duyệt cũ bị bỏ qua.
export const getDataSourceMode = (): DataSourceMode => "cloud";

export const isCloudMode = () => getDataSourceMode() === "cloud";

export const setDataSourceMode = (mode: DataSourceMode) => {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(DATA_SOURCE_MODE_EVENT, { detail: mode }));
};

export const DATA_SOURCE_LABEL: Record<DataSourceMode, string> = {
  cloud: "Cloud",
  beeland: "Beeland",
};

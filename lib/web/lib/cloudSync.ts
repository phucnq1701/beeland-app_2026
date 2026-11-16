// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/cloudSync.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Điều khiển việc ĐỒNG BỘ (mirror) dữ liệu API cũ → Cloud.
 *
 * Mặc định: KHÔNG tự động đồng bộ khi API cũ đang bật.
 * Việc mirror chỉ chạy khi:
 *  - Người dùng bấm nút "Đồng bộ lên Cloud" (bọc trong runManualSync), hoặc
 *  - Người dùng bật cờ tự động đồng bộ trong cài đặt (autoCloudSync = "on").
 */

const KEY = "autoCloudSync";
export const AUTO_CLOUD_SYNC_EVENT = "auto-cloud-sync-change";

/** Cờ cấu hình: tự động mirror khi đọc dữ liệu từ API cũ (mặc định TẮT) */
export const isAutoCloudSyncEnabled = () => {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
};

export const setAutoCloudSync = (enabled: boolean) => {
  try {
    localStorage.setItem(KEY, enabled ? "on" : "off");
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent(AUTO_CLOUD_SYNC_EVENT, { detail: enabled }));
  } catch {
    /* ignore */
  }
};

/** Số tác vụ đồng bộ thủ công đang chạy */
let manualDepth = 0;

/** Thời điểm bắt đầu một phiên đồng bộ thủ công (cho phép mirror trong 2 phút) */
let manualUntil = 0;
const MANUAL_WINDOW_MS = 2 * 60 * 1000;

/** Đánh dấu: người dùng vừa chủ động bấm đồng bộ */
export const markManualSync = () => {
  manualUntil = Date.now() + MANUAL_WINDOW_MS;
};

export const isManualSyncActive = () => manualDepth > 0 || Date.now() < manualUntil;

/** Có được phép mirror lên Cloud tại thời điểm này không */
export const shouldMirror = () => isManualSyncActive() || isAutoCloudSyncEnabled();

/** Bọc một tác vụ đồng bộ thủ công (do người dùng bấm nút) */
export const runManualSync = async <T>(fn: () => Promise<T> | T): Promise<T> => {
  manualDepth += 1;
  try {
    return await fn();
  } finally {
    manualDepth = Math.max(0, manualDepth - 1);
  }
};

/** Chỉ chạy hàm mirror khi được phép */
export const mirrorIfAllowed = async (fn: () => Promise<any> | any) => {
  if (!shouldMirror()) return;
  try {
    await fn();
  } catch (e) {
    console.warn("[cloudSync] bỏ qua lỗi đồng bộ:", e);
  }
};

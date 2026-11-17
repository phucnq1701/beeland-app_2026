/**
 * Cập nhật OTA (EAS Update / expo-updates) khi mở app — phần logic thuần, không phụ thuộc RN để test được.
 * Màn chờ: components/OtaUpdateScreen.tsx (gọi từ components/UpdateManager.tsx). Tài liệu: docs/ota-update.md. Cùng logic với beeland-app-KH/lib/otaUpdate.ts.
 *
 * Luồng: hỏi máy chủ (có giới hạn thời gian) → có bản mới thì báo hiện màn chờ → tải → reload (bắt buộc).
 * Mạng lỗi / máy chủ lỗi / hết thời gian ở bất kỳ bước nào → vào app bằng bản đang có, không kẹt ở màn chờ.
 */

export interface OtaDeps {
  check: () => Promise<{ isAvailable: boolean }>;
  fetch: () => Promise<unknown>;
  reload: () => Promise<void>;
  /** Gọi khi đã biết có bản mới, trước khi tải — để hiện màn chờ. */
  onUpdating: () => void;
}

export interface OtaOptions {
  checkTimeoutMs?: number;
  fetchTimeoutMs?: number;
}

export type OtaResult = 'none' | 'reloading' | 'error';

export const OTA_CHECK_TIMEOUT_MS = 8_000;
export const OTA_FETCH_TIMEOUT_MS = 90_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export async function runOtaUpdate(deps: OtaDeps, options: OtaOptions = {}): Promise<OtaResult> {
  const { checkTimeoutMs = OTA_CHECK_TIMEOUT_MS, fetchTimeoutMs = OTA_FETCH_TIMEOUT_MS } = options;
  try {
    const result = await withTimeout(deps.check(), checkTimeoutMs);
    if (!result.isAvailable) return 'none';
    deps.onUpdating();
    await withTimeout(deps.fetch(), fetchTimeoutMs);
    await deps.reload();
    return 'reloading';
  } catch {
    return 'error';
  }
}

const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Giờ + ngày cho màn chờ: { time: "08:05", date: "Thứ ba, 21 tháng 10, 2026" } (không dựa vào Intl của Hermes). */
export function formatUpdatingClock(d: Date): { time: string; date: string } {
  return {
    time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
    date: `${WEEKDAYS[d.getDay()]}, ${d.getDate()} tháng ${d.getMonth() + 1}, ${d.getFullYear()}`,
  };
}

/** 8 ký tự đầu của mã bản OTA đang chạy; bản đóng gói sẵn trong build (chưa nhận OTA) → "gốc". */
export function shortBundleId(updateId: string | null | undefined, isEmbedded: boolean): string {
  if (isEmbedded || !updateId) return 'gốc';
  return updateId.replace(/-/g, '').slice(0, 8);
}

/** Phần trăm tải (0..100) từ downloadProgress (0..1) của expo-updates; chưa có số → null. */
export function progressPercent(progress: number | null | undefined): number | null {
  if (progress == null || Number.isNaN(progress)) return null;
  return Math.round(Math.min(1, Math.max(0, progress)) * 100);
}

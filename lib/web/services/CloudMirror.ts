// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/CloudMirror.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../_shims/integrations/supabase/client";
import { currentMaCTDK } from "./InterestDetailService";
import { isCloudMode } from "../lib/dataSourceMode";
import { shouldMirror } from "../lib/cloudSync";

/**
 * Helper dùng chung cho mọi module chuyển lên Cloud.
 * - tenant(): mã công ty đăng ký (lowercase)
 * - safe(): bỏ qua lỗi cloud để không chặn nghiệp vụ chính
 * - cloudFirst(): đọc Cloud trước, sau đó gọi API nền để làm mới + mirror
 */
export const tenant = () => (currentMaCTDK() || "").toLowerCase();

export const table = (name: string) => supabase.from(name as any);

export const safe = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch (e) {
    console.warn("[CloudMirror] bỏ qua lỗi đồng bộ:", e);
    return null;
  }
};

export interface CloudFirstOptions<T> {
  /** Đọc dữ liệu từ Cloud */
  readCloud: () => Promise<T[]>;
  /** Gọi API gốc (beesky) */
  fetchApi: () => Promise<T[]>;
  /** Ghi dữ liệu API lên Cloud (move dữ liệu cũ lên cloud) */
  mirror?: (rows: T[]) => Promise<void> | void;
  /** Callback cập nhật UI mỗi khi có dữ liệu mới */
  onData: (rows: T[], source: "cloud" | "api") => void;
}

/**
 * Đọc Cloud trước → hiển thị ngay → làm mới từ API → mirror lên Cloud.
 * Trả về dữ liệu cuối cùng đang hiển thị.
 */
export const cloudFirst = async <T>({
  readCloud,
  fetchApi,
  mirror,
  onData,
}: CloudFirstOptions<T>): Promise<T[]> => {
  let current: T[] = [];
  const cloudOnly = isCloudMode();

  const cloudRows = (await safe(readCloud)) || [];
  if (cloudRows.length || cloudOnly) {
    current = cloudRows;
    onData(cloudRows, "cloud");
  }

  // Chế độ Cloud: chỉ hiển thị dữ liệu Cloud, API chỉ chạy nền để mirror
  if (cloudOnly) {
    // Cloud là nguồn dữ liệu duy nhất trong chế độ Cloud. Không gọi API cũ nền:
    // thao tác đồng bộ chủ động sẽ tự gọi fetchApi/mirror ở luồng riêng.
    return current;
  }

  try {
    const apiRows = (await fetchApi()) || [];
    if (apiRows.length) {
      current = apiRows;
      onData(apiRows, "api");
      if (mirror && shouldMirror()) await safe(async () => mirror(apiRows));
    }
  } catch (e) {
    if (!cloudRows.length) onData([], "cloud");
  }

  return current;
};

/**
 * Dùng cho tầng service (không có callback UI):
 * - Có dữ liệu Cloud → trả về ngay, đồng thời làm mới + mirror từ API ở nền.
 * - Chưa có dữ liệu Cloud → chờ API, mirror rồi trả về.
 */
export const cloudFirstOnce = async <T>({
  readCloud,
  fetchApi,
  mirror,
}: {
  readCloud: () => Promise<T[]>;
  fetchApi: () => Promise<T[]>;
  mirror?: (rows: T[]) => Promise<void> | void;
}): Promise<T[]> => {
  const cloudRows = (await safe(readCloud)) || [];
  const cloudOnly = isCloudMode();

  const refresh = async () => {
    const apiRows = (await fetchApi()) || [];
    if (apiRows.length && mirror && shouldMirror()) await safe(async () => mirror(apiRows));
    return apiRows;
  };

  if (cloudRows.length || cloudOnly) {
    if (!cloudOnly) void safe(refresh);
    return cloudRows;
  }

  try {
    return await refresh();
  } catch {
    return [];
  }
};

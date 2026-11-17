// ⚠️ TỰ SINH — bản chép nguyên văn web src/pages/sales/giao-dich/dat-lich-ky/khoHoSo.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type { SigningAttachment } from "../../../../_stubs/pages/sales/giao-dich/dat-lich-ky/AttachmentsField";

/** Một tệp trong kho hồ sơ của giao dịch (fn_signing_deposit_search(p_id) → ho_so, bảng cloud_pgc_ho_so). */
export interface KhoHoSoItem {
  fileName?: string | null;
  url: string;
  uploadedAt?: string | null;
  hoSoId?: string | null;
  hoSoTen?: string | null;
  /** Số lịch ký đã lưu tệp này gần nhất */
  tuLichKy?: number | null;
}

/**
 * Hồ sơ thừa hưởng khi đặt lịch ký mới cho một giao dịch (DK31–DK35):
 * bỏ các tệp thừa hưởng của giao dịch trước (cờ `_kho`), giữ tệp đã tải ở form này, thêm tệp trong kho chưa có (theo url).
 */
export function mergeKhoHoSo(list: SigningAttachment[] | undefined | null, kho: KhoHoSoItem[] | undefined | null): SigningAttachment[] {
  const cur = Array.isArray(list) ? list : [];
  const own = cur.filter((f) => !f?._kho);
  const urls = new Set(own.map((f) => f.url));
  const add: SigningAttachment[] = (Array.isArray(kho) ? kho : [])
    .filter((k) => k?.url && !urls.has(k.url) && (urls.add(k.url), true))
    .map((k) => ({
      fileName: k.fileName || "Tệp",
      url: k.url,
      ...(k.uploadedAt ? { uploadedAt: k.uploadedAt } : {}),
      hoSoId: k.hoSoId ?? null,
      hoSoTen: k.hoSoTen ?? null,
      tuLichKy: k.tuLichKy ?? null,
      _kho: true,
    }));
  if (!add.length && own.length === cur.length) return cur;
  return [...add, ...own];
}

/** Bỏ cờ tạm `_kho` trước khi lưu (giữ `tuLichKy` để biết tệp nộp từ lịch nào). */
export function stripKhoFlag(list: SigningAttachment[] | undefined | null): SigningAttachment[] {
  return (Array.isArray(list) ? list : []).map(({ _kho, ...f }) => f);
}

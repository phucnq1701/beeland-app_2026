// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/priorOptionState.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
/**
 * Trạng thái đã lưu của chứng từ để form miễn kiểm như máy chủ (R-8, fix-wave F3; `_sp_option_quota_guard` B1/B2).
 * Hàm thuần: form chỉ gọi `priorDocOf` khi nạp chứng từ và trộn `priorOptionCtx` vào OptionCtx.
 */
import type { OptionCtx } from "./optionConditions";

export type PriorDoc = {
  /** Chính sách của chứng từ đang lưu */
  policyId: string | null;
  /** ID mức đã chọn (LuaChonDaChon) trên chứng từ đang lưu */
  pickIds: string[];
  congTyId: string | null;
  /** Chứng từ đang lưu chiếm suất: giai đoạn cọc / HĐ (phiếu tính giá: luôn true) */
  holdsSlot: boolean;
};

export const NO_PRIOR_DOC: PriorDoc = Object.freeze({ policyId: null, pickIds: [], congTyId: null, holdsSlot: false }) as PriorDoc;

/**
 * Giai đoạn chiếm suất như `_sp_option_usage_rows` (DATCOC / HDMB / HDGV). "HOPDONG" là `__docType` của đường đọc cũ.
 * Không xét trạng thái hủy / thanh lý / chuyển nhượng (form không có mã trạng thái); chứng từ như vậy máy chủ vẫn kiểm khi lưu.
 */
const HOLD_STAGES = new Set(["DATCOC", "HDMB", "HDGV", "HOPDONG"]);
const lc = (v: unknown) => String(v ?? "").trim().toLowerCase();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

/** Đọc từ ChinhSach / TTHopDong / giai đoạn của chứng từ đang lưu */
export function priorDocOf(chinhSach: unknown, tt: Loose, stage: string | null | undefined, isPriceSheet = false): PriorDoc {
  const rows: Loose[] = Array.isArray(chinhSach) ? chinhSach : chinhSach ? [chinhSach] : [];
  const ids = rows
    .flatMap((r) => (Array.isArray(r?.LuaChonDaChon) ? r.LuaChonDaChon : []))
    .map((p: Loose) => p?.ID)
    .filter((v: unknown) => v != null && v !== "")
    .map(String);
  const policy = tt?.MaCS || rows[0]?.MaCS;
  const holds = isPriceSheet || HOLD_STAGES.has(String(stage ?? "").toUpperCase());
  if (!ids.length && !policy && !tt?.CongTyBanHangId && !holds) return NO_PRIOR_DOC;
  return { policyId: policy ? String(policy) : null, pickIds: [...new Set(ids)], congTyId: tt?.CongTyBanHangId ? String(tt.CongTyBanHangId) : null, holdsSlot: holds };
}

/** Phiếu tính giá đang sửa (`initialSheet`); phiếu mới ⇒ không có gì */
export function priorDocOfSheet(sheet: Loose): PriorDoc {
  if (!sheet) return NO_PRIOR_DOC;
  const payload = sheet.payload || sheet;
  return priorDocOf(payload?.ChinhSach, payload?.TTHopDong || sheet.tt_hop_dong, null, true);
}

/**
 * Phần OptionCtx theo chính sách đang chọn. Cọc / HĐ: thời gian miễn cho mọi mức đã lưu; phân bổ chỉ khi giữ suất CÙNG chính sách.
 * Phiếu tính giá: đổi chính sách ⇒ không miễn gì (máy chủ dùng '[]').
 */
export function priorOptionCtx(
  p: PriorDoc,
  policyId: string | null | undefined,
  isPriceSheet = false,
): Pick<OptionCtx, "priorPickIds" | "priorCongTyId" | "priorHoldsSlot" | "isPriceSheet"> {
  const same = !!p.policyId && lc(p.policyId) === lc(policyId);
  if (isPriceSheet) return { priorPickIds: same ? p.pickIds : [], priorCongTyId: p.congTyId, priorHoldsSlot: true, isPriceSheet: true };
  return { priorPickIds: p.pickIds, priorCongTyId: p.congTyId, priorHoldsSlot: p.holdsSlot && same, isPriceSheet: false };
}

/** Chứng từ nguồn của phiếu tính giá (máy chủ loại trừ chứng từ này khi đếm suất): MaPGC nạp, pgc_id, TTHopDong.MaPGC; chỉ nhận uuid */
export function priceSheetSourcePgc(loadDocMaPGC: unknown, sheet: Loose): string | null {
  const c = [loadDocMaPGC, sheet?.pgc_id, sheet?.payload?.TTHopDong?.MaPGC].map((v) => String(v ?? "").trim());
  return c.find((v) => UUID_RE.test(v)) ?? null;
}

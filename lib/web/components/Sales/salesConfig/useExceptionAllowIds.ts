// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Sales/salesConfig/useExceptionAllowIds.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Ngoại lệ đã duyệt của giao dịch đang mở (fn_exception_request_active) → id được phép chọn dù đã hết hạn, theo loại.
 * Phiếu tính giá đang chọn có ngoại lệ PTG ⇒ CSBH / TĐTT của phiếu cũng được phép (như máy chủ). Không có pgc ⇒ rỗng.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { exceptionRequestService } from "../../../services/contracts/exception-request";
import { priceSheetService } from "../../../services/products/price-sheet";
import { allowedIdsFor, applyExceptionCascade, sheetExceptionRefs, type ActiveException } from "../../../lib/expiryPick";

type SheetRefs = { id: string; refs: { MaCS?: string; MaTDTT?: string } };

const lc = (v: unknown) => String(v ?? "").trim().toLowerCase();

export type ExceptionAllowIds = {
  PTG: Set<string>;
  CSBH: Set<string>;
  TDTT: Set<string>;
  /** Form vừa nạp chi tiết phiếu (chọn PTG) ⇒ ghi lại CSBH / TĐTT của phiếu, khỏi đọc lại */
  rememberSheet: (sheetId: string, sheet: unknown) => void;
};

export function useExceptionAllowIds(pgcId: string | null | undefined, sheetId?: string | null): ExceptionAllowIds {
  const [active, setActive] = useState<ActiveException[]>([]);
  const [sheetRefs, setSheetRefs] = useState<SheetRefs | null>(null);

  useEffect(() => {
    let alive = true;
    setActive([]);
    if (pgcId) void exceptionRequestService.active(pgcId).then((rows) => alive && setActive(rows));
    return () => {
      alive = false;
    };
  }, [pgcId]);

  const ptg = useMemo(() => allowedIdsFor(active, "PTG"), [active]);
  const sheetKey = lc(sheetId);
  const needSheet = !!sheetKey && ptg.has(sheetKey) && lc(sheetRefs?.id) !== sheetKey;

  // Mở chứng từ đã gắn phiếu có ngoại lệ PTG: đọc phiếu để biết CSBH / TĐTT của phiếu
  useEffect(() => {
    if (!needSheet || !sheetId) return;
    let alive = true;
    priceSheetService
      .get(sheetId)
      .then((s: unknown) => alive && s && setSheetRefs({ id: sheetId, refs: sheetExceptionRefs(s) }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [needSheet, sheetId]);

  const rememberSheet = useCallback((id: string, sheet: unknown) => setSheetRefs({ id, refs: sheetExceptionRefs(sheet) }), []);

  return useMemo(() => {
    const refs = sheetKey && lc(sheetRefs?.id) === sheetKey ? sheetRefs!.refs : null;
    const c = applyExceptionCascade(active, refs, sheetId ?? null);
    return { PTG: ptg, CSBH: c.CSBH, TDTT: c.TDTT, rememberSheet };
  }, [active, ptg, sheetKey, sheetId, sheetRefs, rememberSheet]);
}

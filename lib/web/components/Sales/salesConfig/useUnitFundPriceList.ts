// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Sales/salesConfig/useUnitFundPriceList.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listPriceListUnitFunds, type PriceListUnitFund } from "../../../services/products/price-list";
import {
  pickInitialPriceList,
  pickPriceListForUnitFund,
  priceListOptionsForUnitFund,
  resolveInitialUnitFund,
  sameId,
  unitFundOfPriceList,
  UNIT_FUND_LOCK_REASON_DEFAULT,
  UNIT_FUND_LOCK_REASON_NEW,
  UNIT_FUND_LOCK_REASON_SAVED,
  type UnitFundPreset,
  type UnitFundPriceListOption,
  type UnitFundPriceListRow,
} from "./unitFundPriceList";

interface Args {
  open: boolean;
  /** Phiếu mới: tự chọn Quỹ CĐT + bảng giá; bắt buộc có quỹ căn khi lưu */
  isNewDoc: boolean;
  /** Bảng giá đang áp dụng của dự án (đã sắp theo ưu tiên); null = chưa nạp xong */
  priceLists: UnitFundPriceListRow[] | null;
  selectedPriceListId?: string | null;
  /** Áp bảng giá cho form; null = không có bảng giá phù hợp ⇒ giá gốc của căn */
  onPick: (priceListId: string | null) => void;
  /**
   * Khóa quỹ căn (Đặt cọc / Góp vốn / Hợp đồng / Booking, chủ dự án 2026-11-06): phiếu mới luôn là quỹ căn mặc định (Quỹ CĐT),
   * không đổi được kể cả khi áp phiếu tính giá; phiếu đã lưu hiện quỹ căn đã lưu. Phiếu tính giá không khóa.
   */
  locked?: boolean;
  /**
   * Quỹ căn + bảng giá theo bộ lọc lưới (spec 2026-11-09-quy-can-theo-bo-loc-luoi): chỉ dùng khi tự chọn cho phiếu mới.
   * Không có ⇒ Quỹ CĐT. Chốt lúc mở form; đổi về sau (trong lúc form mở) không chọn lại.
   */
  preset?: UnitFundPreset;
}

export interface UnitFundPriceList {
  funds: PriceListUnitFund[];
  /** Đã nạp xong danh mục quỹ căn trong lần mở này (lỗi tải ⇒ funds = [] nhưng vẫn true); đóng form ⇒ false */
  fundsLoaded: boolean;
  quyCanId: string | null;
  /** Mở phiếu đã lưu: MaQuyCan đã lưu, không có thì quỹ căn của bảng giá đã lưu. Không áp lại bảng giá */
  restore: (savedQuyCanId: string | null | undefined, savedPriceListId: string | null | undefined) => void;
  /** Người dùng đổi quỹ căn: chọn lại bảng giá theo quỹ căn mới */
  change: (quyCanId: string) => void;
  priceListOptions: UnitFundPriceListOption[];
  /** Phiếu mới chưa có quỹ căn (danh mục có dữ liệu) ⇒ chặn lưu */
  missing: boolean;
  /** Ô Quỹ căn chỉ xem */
  locked: boolean;
  /** Tooltip lý do khóa ô Quỹ căn; null khi không khóa */
  lockReason: string | null;
}

/** Ô Quỹ căn đứng trước ô Bảng giá ở form chứng từ (spec 2026-11-06-quy-can-bang-gia-form) */
export function useUnitFundPriceList({ open, isNewDoc, priceLists, selectedPriceListId, onPick, locked = false, preset }: Args): UnitFundPriceList {
  const [funds, setFunds] = useState<PriceListUnitFund[]>([]);
  const [fundsLoaded, setFundsLoaded] = useState(false);
  const [quyCanId, setQuyCanId] = useState<string | null>(null);
  /** Đã khôi phục từ phiếu đã lưu / phiếu tính giá: giữ theo phiếu đó, không chặn lưu khi phiếu chưa có quỹ căn */
  const [restored, setRestored] = useState(false);
  /** Đã khôi phục phiếu / người dùng đã chọn quỹ căn trong lần mở này ⇒ không tự chọn nữa */
  const settledRef = useRef(false);
  /** Kết quả tự chọn gần nhất ("quỹ căn|bảng giá"): bảng giá nạp lại (vd có thêm has_product) thì chọn lại nếu khác */
  const lastAutoRef = useRef<string | undefined>(undefined);
  const selectedRef = useRef(selectedPriceListId);
  selectedRef.current = selectedPriceListId;
  /** restore() gọi khi bảng giá chưa về: chờ để suy ra quỹ căn từ bảng giá đã lưu */
  const pendingRef = useRef<string | null | undefined>(undefined);
  /** change() gọi khi bảng giá chưa về: chờ để chọn bảng giá theo quỹ căn vừa đổi */
  const pendingPickRef = useRef<string | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const presetRef = useRef(preset);
  presetRef.current = preset;
  /** Preset chốt lúc mở form: bảng giá nạp lại thì tự chọn lại theo preset này, không theo bộ lọc đổi về sau */
  const openPresetRef = useRef<UnitFundPreset | undefined>(undefined);
  /** Preset dùng cho lần mở này (chưa chốt kịp ở render đầu thì lấy giá trị hiện tại) */
  const activePreset = () => (openPresetRef.current ?? presetRef.current);
  const rowsRef = useRef(priceLists);
  rowsRef.current = priceLists;

  useEffect(() => {
    if (!open) {
      setQuyCanId(null);
      setRestored(false);
      setFundsLoaded(false);
      settledRef.current = false;
      lastAutoRef.current = undefined;
      pendingRef.current = undefined;
      pendingPickRef.current = null;
      openPresetRef.current = undefined;
      return;
    }
    openPresetRef.current = presetRef.current;
    let alive = true;
    listPriceListUnitFunds()
      .catch(() => [] as PriceListUnitFund[])
      .then((rows) => {
        if (!alive) return;
        setFunds(rows);
        setFundsLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !isNewDoc || settledRef.current || !fundsLoaded || priceLists == null) return;
    const q = resolveInitialUnitFund(funds, activePreset()?.quyCanId);
    if (!q) return;
    const pick = pickInitialPriceList(priceLists, q, activePreset()?.priceListId);
    const key = `${q}|${pick ?? ""}`;
    if (key === lastAutoRef.current) return;
    lastAutoRef.current = key;
    setQuyCanId(q);
    // Chưa có bảng giá nào được chọn mà cũng không có bảng giá phù hợp ⇒ form đang ở giá gốc, không cần áp lại
    if (pick || selectedRef.current) onPickRef.current(pick);
  }, [open, isNewDoc, fundsLoaded, funds, priceLists]);

  useEffect(() => {
    if (priceLists == null) return;
    if (pendingRef.current !== undefined) {
      setQuyCanId(unitFundOfPriceList(priceLists, pendingRef.current));
      pendingRef.current = undefined;
    }
    if (pendingPickRef.current) {
      const q = pendingPickRef.current;
      pendingPickRef.current = null;
      onPickRef.current(pickPriceListForUnitFund(priceLists, q));
    }
  }, [priceLists]);

  /** Khóa + phiếu mới: quỹ căn luôn là quỹ căn ban đầu (preset của lưới / Quỹ CĐT), không theo restore / change */
  const fixedDefault = locked && isNewDoc;
  const fixedRef = useRef(fixedDefault);
  fixedRef.current = fixedDefault;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;
  // Khóa + phiếu đã lưu đã có quỹ căn ⇒ áp phiếu tính giá / nạp lại không đổi quỹ (máy chủ chặn đổi quỹ 23514, hd-chuyen-nhuong-quy)
  const savedLockRef = useRef(false);
  savedLockRef.current = locked && !isNewDoc && !!quyCanId;

  const restore = useCallback<UnitFundPriceList["restore"]>((savedQuyCanId, savedPriceListId) => {
    settledRef.current = true;
    pendingRef.current = undefined;
    pendingPickRef.current = null;
    if (fixedRef.current) return; // giữ bảng giá của phiếu tính giá, quỹ căn vẫn là quỹ căn ban đầu
    if (savedLockRef.current) return; // phiếu đã lưu có quỹ căn: quỹ không đổi theo phiếu tính giá
    setRestored(true);
    if (savedQuyCanId) {
      setQuyCanId(String(savedQuyCanId));
      return;
    }
    const rows = rowsRef.current;
    if (rows) setQuyCanId(unitFundOfPriceList(rows, savedPriceListId));
    else pendingRef.current = savedPriceListId ?? null;
  }, []);

  const change = useCallback((q: string) => {
    if (lockedRef.current) return;
    settledRef.current = true;
    pendingRef.current = undefined;
    setQuyCanId(q);
    const rows = rowsRef.current;
    if (rows) onPickRef.current(pickPriceListForUnitFund(rows, q));
    else pendingPickRef.current = q;
  }, []);

  // Đã tự chọn thì giữ đúng quỹ căn đó (preset đổi về sau không làm đổi ô); chưa tự chọn thì tính từ preset
  const shownQuyCanId = fixedDefault ? quyCanId ?? resolveInitialUnitFund(funds, activePreset()?.quyCanId) : quyCanId;
  const priceListOptions = useMemo(
    () => priceListOptionsForUnitFund(priceLists ?? [], shownQuyCanId, selectedPriceListId),
    [priceLists, shownQuyCanId, selectedPriceListId]
  );

  return {
    funds,
    fundsLoaded,
    quyCanId: shownQuyCanId,
    restore,
    change,
    priceListOptions,
    missing: isNewDoc && !restored && funds.length > 0 && !shownQuyCanId,
    locked,
    lockReason: !locked
      ? null
      : !isNewDoc
        ? UNIT_FUND_LOCK_REASON_SAVED
        : funds.some((f) => sameId(f.id, activePreset()?.quyCanId))
          ? UNIT_FUND_LOCK_REASON_NEW
          : UNIT_FUND_LOCK_REASON_DEFAULT,
  };
}

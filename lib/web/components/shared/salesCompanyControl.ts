// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/shared/salesCompanyControl.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Ô "Công ty bán hàng" theo tài khoản đang gọi (spec phan-bo-ctbh-chi-tiet-ck, fix-wave F1), dùng chung cho Phiếu tính giá và Cọc / HĐ.
 * Nhân viên CTBH / đại lý có CTBH liên kết (`fn_caller_sales_company` forced) chỉ chọn được công ty của mình; tài khoản không có công ty nào
 * để chọn thì không khóa chính sách và không bắt buộc công ty khi lưu (máy chủ vẫn đòi công ty khi chọn mức có phân bổ).
 */
import { useEffect, useMemo, useState } from "react";
import { loadCallerSalesCompany, type CallerSalesCompany } from "../../services/sales/caller-sales-company";
import { useSalesCompanyOptions, type SalesCompanyOption } from "./salesCompany";
import type { OptionViewer } from "../Products/ContractForm/optionConditions";

export type SalesCompanyControl = {
  options: SalesCompanyOption[];
  /** Chỉ có 1 công ty hợp lệ và ô đang giữ đúng công ty đó */
  disabled: boolean;
  /** false: tài khoản không có công ty nào để chọn ⇒ không khóa chính sách, không bắt buộc khi lưu */
  required: boolean;
  /** Công ty tự gán khi ô đang trống (tài khoản bị khóa vào đúng 1 công ty) */
  autoId: string | null;
  /** Chỉ có (true) khi tải danh sách thường lỗi và tài khoản không bị khóa công ty: ô chọn không dùng được */
  loadFailed?: true;
};

const lc = (v: unknown) => String(v ?? "").trim().toLowerCase();

/**
 * Hàm thuần quyết định ô Công ty bán hàng. `caller` null = đang tải (giữ hành vi cũ); `normal` = danh sách thường (`useSalesCompanyOptions`).
 * - forced: chỉ các công ty của tài khoản; chứng từ đang giữ công ty khác thì vẫn hiện công ty đó (không chọn lại được);
 * - không forced, danh sách thường đã tải THÀNH CÔNG mà rỗng: không bắt buộc;
 * - còn lại (kể cả tải danh sách thường lỗi, `normalFailed`, coi như đang tải): như cũ, bắt buộc.
 */
export function resolveSalesCompanyControl(i: {
  caller: CallerSalesCompany | null;
  normal: SalesCompanyOption[];
  normalLoading: boolean;
  /** Tải `fn_company_agency_map` lỗi: không phải danh sách rỗng, vẫn bắt buộc công ty (cổng R-5 khóa) */
  normalFailed?: boolean;
  currentId?: string | null;
  currentName?: string | null;
}): SalesCompanyControl {
  const { caller, normal, currentId } = i;
  const normalLabel = (id: string) => normal.find((o) => lc(o.value) === lc(id))?.label.replace(/ \((ngừng hoạt động|không còn là Công ty bán hàng)\)$/, "");
  if (caller?.forced && caller.companies.length > 0) {
    const cur = lc(currentId);
    const options: SalesCompanyOption[] = caller.companies.map((c) => ({
      // Giữ đúng chuỗi id đang lưu để ô hiện nhãn (CustomSelect so khớp phân biệt hoa thường)
      value: cur && cur === c.id ? String(currentId) : c.id,
      label: c.ten || normalLabel(c.id) || c.id,
    }));
    if (cur && !caller.companies.some((c) => c.id === cur)) {
      options.push({ value: String(currentId), label: `${i.currentName || normalLabel(String(currentId)) || currentId} (không thuộc tài khoản)`, disabled: true });
    }
    const single = caller.companies.length === 1;
    return { options, disabled: single && cur === caller.companies[0].id, required: true, autoId: single ? caller.companies[0].id : null };
  }
  if (caller && !i.normalLoading && !i.normalFailed && normal.length === 0) return { options: [], disabled: true, required: false, autoId: null };
  return { options: normal, disabled: false, required: true, autoId: null, ...(i.normalFailed ? { loadFailed: true as const } : {}) };
}

/** Nạp `fn_caller_sales_company` một lần mỗi lần gắn; null khi đang tải */
export function useCallerSalesCompany(): CallerSalesCompany | null {
  const [caller, setCaller] = useState<CallerSalesCompany | null>(null);
  useEffect(() => {
    let alive = true;
    void loadCallerSalesCompany().then((c) => alive && setCaller(c));
    return () => {
      alive = false;
    };
  }, []);
  return caller;
}

/** Thay `useSalesCompanyOptions` trên form chứng từ: options + nameOf + các cờ của ô Công ty bán hàng */
export function useSalesCompanyControl(currentId?: string | null, currentName?: string | null) {
  const caller = useCallerSalesCompany();
  const base = useSalesCompanyOptions(currentId, currentName);
  const ctl = useMemo(
    () => resolveSalesCompanyControl({ caller, normal: base.options, normalLoading: base.loading, normalFailed: base.failed, currentId, currentName }),
    [caller, base.options, base.loading, base.failed, currentId, currentName],
  );
  const nameOf = (id?: string | null): string | null =>
    (id ? caller?.companies.find((c) => c.id === lc(id))?.ten : null) || base.nameOf(id);
  return { ...ctl, nameOf, agenciesOf: base.agenciesOf, viewer: optionViewerOf(caller) };
}

/**
 * Người xem ô Chi tiết CK (spec chi-tiet-ck-theo-phan-bo): tài khoản có nguồn CTBH / đại lý hoặc bị khóa công ty ⇒ "CTBH" (chỉ thấy phân bổ của
 * công ty mình); không ⇒ "CDT" (thấy hết). Đang tải (null) ⇒ "CTBH" để không lộ mức của công ty khác trong lúc chờ.
 */
export function optionViewerOf(caller: CallerSalesCompany | null): OptionViewer {
  return !caller || caller.forced || caller.source !== null ? "CTBH" : "CDT";
}

/** Ô đang trống mà tài khoản chỉ có 1 công ty ⇒ tự gán (không đánh dấu đã sửa). `enabled`: form mở và được sửa */
export function useAutoSalesCompany(autoId: string | null, currentId: string | null | undefined, set: (id: string) => void, enabled: boolean) {
  useEffect(() => {
    if (enabled && autoId && !currentId) set(autoId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, autoId, currentId]);
}

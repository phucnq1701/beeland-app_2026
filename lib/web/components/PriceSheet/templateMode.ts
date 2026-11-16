// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/PriceSheet/templateMode.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Chế độ soạn của PriceSheetForm.
 * - "sheet": phiếu tính giá thường (mặc định, giữ nguyên hành vi cũ).
 * - "template": soạn phiếu tính giá mẫu — không có khách hàng, liên kết PGC,
 *   hạn phiếu, duyệt / phiên bản / tư vấn 360, Công ty bán hàng, kiểm điều kiện mức chiết khấu; bắt buộc "Tên mẫu".
 */
export type PriceSheetFormMode = "sheet" | "template";

export interface TemplateModeSections {
  customer: boolean;
  pgcLink: boolean;
  expiry: boolean;
  approval: boolean;
  advisor360: boolean;
  /** Ô Công ty bán hàng (mẫu không gắn công ty — người lập phiếu thật tự chọn) */
  salesCompany: boolean;
  /**
   * Kiểm điều kiện của mức chiết khấu / quà tặng (thời gian, số suất, phân bổ CTBH, điều kiện căn — `matchOption`).
   * Mẫu không kiểm: mọi mức của chính sách tick được; phiếu thật lập từ mẫu kiểm lại theo căn + CTBH thật (`tickTemplateOptions`).
   */
  optionChecks: boolean;
  templateName: boolean;
}

export function templateModeSections(mode: PriceSheetFormMode | undefined): TemplateModeSections {
  const isSheet = mode !== "template";
  return {
    customer: isSheet,
    pgcLink: isSheet,
    expiry: isSheet,
    approval: isSheet,
    advisor360: isSheet,
    salesCompany: isSheet,
    optionChecks: isSheet,
    templateName: !isSheet,
  };
}

/** Bước của form theo chế độ: mẫu bỏ bước "customer" (Khách hàng) và "customer360" (360 + tư vấn) */
export function templateModeSteps<T extends { id: string }>(
  steps: readonly T[],
  sections: TemplateModeSections
): readonly T[] {
  if (sections.customer && sections.advisor360) return steps;
  return steps.filter(
    (s) => (s.id !== "customer" || sections.customer) && (s.id !== "customer360" || sections.advisor360)
  );
}

/**
 * Ô Công ty bán hàng theo chế độ. Phiếu thường: giữ nguyên theo tài khoản (`required` từ useSalesCompanyControl; bắt buộc ⇒
 * chính sách / bảng giá / lịch TT khoá tới khi chọn công ty; tự điền công ty của tài khoản bị khoá). Mẫu: ẩn ô, không bắt buộc,
 * không khoá các ô cấu hình, không tự điền.
 */
export function salesCompanyRules(
  sections: TemplateModeSections,
  required: boolean
): { show: boolean; required: boolean; gateReadOnly: boolean; autoFill: boolean } {
  if (!sections.salesCompany) return { show: false, required: false, gateReadOnly: true, autoFill: false };
  return { show: true, required, gateReadOnly: !required, autoFill: true };
}

export const TEMPLATE_NAME_REQUIRED = "Vui lòng nhập tên mẫu";

export type TemplateNameCheck = { ok: true; name: string } | { ok: false; error: string };

export function validateTemplateName(name: string | null | undefined): TemplateNameCheck {
  const trimmed = (name ?? "").trim();
  return trimmed ? { ok: true, name: trimmed } : { ok: false, error: TEMPLATE_NAME_REQUIRED };
}

/**
 * Lưu lỗi khi dựng payload: phiếu tính giá thường vẫn giao payload dự phòng tối thiểu để không chặn việc lưu.
 * Chế độ mẫu thì không — payload dự phòng thiếu chính sách / lịch TT / quỹ căn sẽ ghi đè cả dòng mẫu; để form báo lỗi và mở tiếp.
 */
export function allowsSaveFallback(type: string | undefined, sections: TemplateModeSections, handedOff: boolean): boolean {
  return type === "pricesheet" && !handedOff && !sections.templateName;
}

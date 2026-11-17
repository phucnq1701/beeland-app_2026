// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/products/price-sheet-template/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { rpcRaw } from "../../_core/rpc";
import type { PriceSheetOpenStep } from "../price-sheet";

/**
 * Phiếu tính giá mẫu (bảng price_sheet_templates) — chỉ đọc/ghi qua hàm máy chủ fn_price_sheet_template_*.
 * Công ty / tenant lấy từ JWT; phạm vi theo dự án được gán. Mẫu chỉ giữ cấu hình (chính sách, bảng giá, lịch TT…),
 * khi lập phiếu tính giá thì `pick` danh sách mẫu đang dùng + đã duyệt và `checkUnit` kiểm căn có áp được mẫu không.
 */
export type PriceSheetTemplateStatus = "dang_dung" | "ngung_dung";

/**
 * Trạng thái duyệt (manual 161, tách khỏi Đang dùng / Ngừng dùng): Nháp → Đang duyệt (quy trình PRICE_SHEET_TEMPLATE)
 * → Đã duyệt / Từ chối. Chỉ mẫu Đã duyệt + Đang dùng mới được chọn khi lập phiếu tính giá.
 */
export type PriceSheetTemplateApprovalStatus = "draft" | "sent" | "approved" | "rejected";

export interface PriceSheetTemplate {
  id: string;
  ma_mau: string;
  ten_mau: string;
  da_project_id: string;
  project_name?: string | null;
  product_type: string;
  ma_quy_can: string | null;
  ten_quy_can?: string | null;
  cong_ty_ban_hang_id: string | null;
  sales_policy_id: string | null;
  policy_name: string | null;
  price_list_id: string | null;
  ten_bang_gia?: string | null;
  payment_schedule_id: string | null;
  ten_lich_tt?: string | null;
  san_pham_id: string | null;
  product_code: string | null;
  base_price: number | null;
  notes: string | null;
  trang_thai: PriceSheetTemplateStatus;
  /** Trạng thái duyệt — máy chủ cũ (chưa chạy manual 161) không trả ⇒ coi như Đã duyệt */
  trang_thai_duyet?: PriceSheetTemplateApprovalStatus | null;
  wf_submission_id?: string | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  reject_reason?: string | null;
  /** Các cấp đang mở khi Đang duyệt theo quy trình (cùng dạng phiếu tính giá) */
  wf_dang_duyet?: PriceSheetOpenStep[] | null;
  nguoi_tao_ten?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  /** Chỉ có ở bản đầy đủ (get / save) */
  payload?: any;
  snapshot?: any;
  /** Cột khác máy chủ trả kèm (company_id, nguoi_nhap_id, chinh_sach, lich_thanh_toan, khuyen_mai, uu_dai_lai_suat…) */
  [k: string]: any;
}

export interface PriceSheetTemplatePick extends PriceSheetTemplate {
  toa_ids: string[];
  bang_gia_ids: string[];
  chinh_sach_het_han: boolean;
  lich_tt_het_han: boolean;
}

export interface TemplateUnitCheck {
  ok: boolean;
  ly_do: string[];
  price_list_id: string | null;
}

export interface PriceSheetTemplateListParams {
  daProjectId?: string | null;
  keyword?: string;
  productType?: string;
  trangThai?: PriceSheetTemplateStatus | "all";
  trangThaiDuyet?: PriceSheetTemplateApprovalStatus | "all";
  deleted?: boolean;
  pageIndex?: number;
  pageSize?: number;
}

const call = <T = any>(fn: string, args: Record<string, any>, fallback: string): Promise<T> =>
  rpcRaw<T>(fn, args, { fallback });

const allOrNull = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s && s !== "all" ? s : null;
};

/** Trường chỉ để hiển thị / do máy chủ gán — không gửi lên khi lưu */
const SAVE_OMIT = [
  "created_at", "updated_at", "deleted_at", "deleted_by",
  "project_name", "ten_quy_can", "ten_bang_gia", "ten_lich_tt", "nguoi_tao_ten",
  // trạng thái duyệt do quy trình / duyệt trực tiếp đổi, không ghi qua save
  "trang_thai_duyet", "wf_submission_id", "approved_at", "rejected_at", "reject_reason", "wf_dang_duyet",
];

const ids = (v: string[]) => (Array.isArray(v) ? v.filter(Boolean) : []);

export const priceSheetTemplateService = {
  async list(params: PriceSheetTemplateListParams = {}) {
    const res =
      (await call(
        "fn_price_sheet_template_list",
        {
          p: {
            project_id: allOrNull(params.daProjectId),
            keyword: String(params.keyword || "").trim() || null,
            product_type: allOrNull(params.productType),
            trang_thai: allOrNull(params.trangThai),
            trang_thai_duyet: allOrNull(params.trangThaiDuyet),
            deleted: !!params.deleted,
            page_index: Number(params.pageIndex) > 0 ? Number(params.pageIndex) : 1,
            page_size: Number(params.pageSize) > 0 ? Number(params.pageSize) : 20,
          },
        },
        "Không thể tải danh sách phiếu tính giá mẫu"
      )) || {};
    return {
      rows: (res.rows || []) as PriceSheetTemplate[],
      total: Number(res.total ?? 0),
      stats: {
        dang_dung: Number(res.stats?.dang_dung ?? 0),
        ngung_dung: Number(res.stats?.ngung_dung ?? 0),
        draft: Number(res.stats?.draft ?? 0),
        sent: Number(res.stats?.sent ?? 0),
        approved: Number(res.stats?.approved ?? 0),
        rejected: Number(res.stats?.rejected ?? 0),
      },
    };
  },

  async get(id: string): Promise<PriceSheetTemplate | null> {
    const r = await call("fn_price_sheet_template_get", { p_id: id }, "Không thể tải phiếu tính giá mẫu");
    return r || null;
  },

  async save(row: Partial<PriceSheetTemplate> & { ten_mau: string }): Promise<PriceSheetTemplate> {
    const p_row: Record<string, any> = { ...row };
    for (const k of SAVE_OMIT) delete p_row[k];
    return call("fn_price_sheet_template_save", { p_row }, "Không thể lưu phiếu tính giá mẫu");
  },

  async setActive(idList: string[], active: boolean): Promise<PriceSheetTemplate[]> {
    const p_ids = ids(idList);
    if (!p_ids.length) return [];
    const r = await call("fn_price_sheet_template_set_active", { p_ids, p_active: !!active }, "Không thể đổi trạng thái phiếu tính giá mẫu");
    return Array.isArray(r) ? r : [];
  },

  /** Duyệt / từ chối trực tiếp (chỉ khi dự án chưa cài quy trình duyệt phiếu tính giá mẫu — máy chủ chặn [55000]) */
  async setStatus(idList: string[], status: "approved" | "rejected", reason?: string | null): Promise<PriceSheetTemplate[]> {
    const p_ids = ids(idList);
    if (!p_ids.length) return [];
    const r = await call(
      "fn_price_sheet_template_set_status",
      { p_ids, p_status: status, p_reason: reason?.trim() || null },
      "Không thể cập nhật trạng thái duyệt phiếu tính giá mẫu"
    );
    return Array.isArray(r) ? r : [];
  },

  /** Mẫu đã duyệt (dự án có quy trình) ⇒ mở phiên bản mới: về Nháp để sửa rồi gửi duyệt lại */
  async openNewVersion(id: string, reason: string): Promise<PriceSheetTemplate> {
    return call("fn_price_sheet_template_mo_phien_ban", { p_id: id, p_ly_do: reason }, "Không thể mở phiên bản mới");
  },

  async remove(idList: string[]): Promise<void> {
    const p_ids = ids(idList);
    if (!p_ids.length) return;
    await call("fn_price_sheet_template_delete", { p_ids }, "Không thể xóa phiếu tính giá mẫu");
  },

  async restoreDeleted(idList: string[]): Promise<void> {
    const p_ids = ids(idList);
    if (!p_ids.length) return;
    await call("fn_price_sheet_template_restore", { p_ids }, "Không thể khôi phục phiếu tính giá mẫu");
  },

  async purge(idList: string[]): Promise<void> {
    const p_ids = ids(idList);
    if (!p_ids.length) return;
    await call("fn_price_sheet_template_purge", { p_ids }, "Không thể xóa vĩnh viễn phiếu tính giá mẫu");
  },

  async pick(daProjectId: string, productType?: string | null): Promise<PriceSheetTemplatePick[]> {
    if (!daProjectId) return [];
    const r = await call(
      "fn_price_sheet_template_pick",
      { p_project_id: daProjectId, p_product_type: allOrNull(productType) },
      "Không thể tải danh sách phiếu tính giá mẫu"
    );
    return Array.isArray(r) ? r : [];
  },

  async checkUnit(templateId: string, sanPhamId: string): Promise<TemplateUnitCheck> {
    return call(
      "fn_price_sheet_template_can_check",
      { p_template_id: templateId, p_san_pham_id: sanPhamId },
      "Không thể kiểm tra căn với phiếu tính giá mẫu"
    );
  },
};

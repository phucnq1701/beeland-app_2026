// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/projects/gift-warehouse/policyKho.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Kiểu dữ liệu nối Chính sách bán hàng với Kho quà tặng (spec chinh-sach-theo-kho). RPC:
 *   fn_sales_policy_warehouse_options → { kho: PolicyKhoOption[] }   (Chi tiết giá: kho còn áp dụng → dòng quà thuộc nhóm)
 *   fn_gift_warehouse_stock_for_policy → PolicyKhoStock[]            (form chứng từ: tồn theo mức option.ID)
 *   fn_gift_warehouse_documents → { total, rows: GiftWhDocument[] }  (màn Kho: chứng từ đang dùng)
 */

/** Nguồn số lượng của chiết khấu: KHO = chọn từ kho; không có khóa = tự nhập */
export const GIFT_SOURCE = { KHO: "KHO" } as const;

export interface PolicyKhoLine {
  line_id: string;
  /** Nhóm quà cấp 1 của dòng */
  group_id?: string;
  ten_nhom?: string;
  item_id: string | null;
  ten_qua: string;
  ten_dvt: string | null;
  gia_tri: number;
  /** Còn lại = sl_nhap − sl_xuat − chứng từ chiếm suất */
  con_lai: number;
  /** Sức chứa = sl_nhap − sl_xuat (trần phân bổ CTBH) */
  suc_chua: number;
  nguong: number;
}

export interface PolicyKhoOption {
  kho_id: string;
  ten: string;
  tu_ngay: string;
  den_ngay: string | null;
  lines: PolicyKhoLine[];
}

/** Tồn theo mức (option.ID) cho form chứng từ */
export interface PolicyKhoStock {
  option_id: string;
  line_id: string;
  kho_id: string;
  kho_ten: string;
  con_lai: number;
  suc_chua: number;
  nguong: number;
  tu_ngay: string;
  den_ngay: string | null;
  kho_active: boolean;
  pham_vi: { da_project_id: string; toa_id: string | null }[];
}

export interface GiftWhDocument {
  pgc_id: string;
  so_chung_tu: string | null;
  ma_sp: string | null;
  ctbh_ten: string | null;
  policy_ten: string;
  option_ten: string;
  giai_doan: string | null;
  nhom: string | null;
  chiem_suat: boolean;
  line_id: string;
}

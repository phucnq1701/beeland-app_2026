// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/projects/gift-warehouse/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * KHO QUÀ TẶNG (form 9148 `/projects/gift-warehouses`, manual 156): hạn mức số lượng quà của Danh mục quà tặng (9142)
 * theo phạm vi Dự án → Tòa + từ / đến ngày, có sổ kho. Kiểu dữ liệu đúng hợp đồng API của spec
 * `docs/superpowers/specs/2026-11-13-kho-qua-tang-design.md` (RPC `fn_gift_warehouse_*` → `dbo.usp_gift_warehouse_*`).
 * Ngày dạng `yyyy-MM-dd`. Số lượng là số nguyên (suất).
 */
import type { GiftLoai } from "../gift-catalog/types";

/** Trạng thái hiệu lực (máy chủ tính, không lưu) */
export type GiftWhStatus = "NGUNG" | "SAP_HIEU_LUC" | "HET_HAN" | "DANG_HIEU_LUC";
/** GIU / HUY_GIU dành cho đợt C (chứng từ giữ chỗ) — đợt A không ghi được qua RPC */
export type GiftWhMoveLoai = "NHAP" | "DIEU_CHINH" | "XUAT" | "HOAN" | "GIU" | "HUY_GIU";

/** Một dòng phạm vi: toa_id null = cả dự án (gồm tòa thêm sau) */
export interface GiftWhScope {
  da_project_id: string;
  ten_du_an: string;
  toa_id: string | null;
  ten_toa: string | null;
}

/** Dòng quà trong kho. item_id null chỉ khi nhóm không có quà con. con_lai = sl_nhap − sl_giu − sl_xuat */
export interface GiftWhLine {
  id: string;
  group_id: string;
  item_id: string | null;
  ten_nhom: string;
  ten_qua: string | null;
  loai: GiftLoai;
  ten_dvt: string | null;
  /** false khi nhóm hoặc quà đã ngưng / xóa ở danh mục */
  danh_muc_active: boolean;
  sl_nhap: number;
  sl_giu: number;
  /** Chứng từ (Đặt cọc / HĐ) đang chiếm suất của dòng — tồn tính động (chinh-sach-theo-kho D5) */
  sl_chung_tu: number;
  sl_xuat: number;
  /** Còn lại của chính dòng: riêng (quà có số) / còn lại nhóm (dòng nhóm); null = quà dùng chung hạn mức nhóm */
  con_lai: number | null;
  /** Còn lại dùng cho chứng từ: riêng / nhóm / min (spec 2026-11-16-kho-han-muc-nhom); null = quà không giới hạn */
  con_lai_hieu_luc: number | null;
  nguong_canh_bao: number;
  thu_tu: number;
  is_active: boolean;
  /** Từng có XUAT / GIU ⇒ không bỏ khỏi kho được, chỉ ngưng */
  co_xuat: boolean;
  /** Quà con không có số riêng, dùng chung hạn mức của dòng nhóm */
  dung_chung: boolean;
  /** Dòng nhóm (item_id null, nhóm có quà con trong kho): giữ hạn mức nhóm */
  la_dong_nhom: boolean;
  /** Quà không giới hạn (spec 2026-11-17-kho-khong-gioi-han): con_lai / con_lai_hieu_luc null, không chặn, không cảnh báo */
  khong_gioi_han: boolean;
}

/** Sửa một dòng quà (fn_gift_warehouse_line_update, không nhom). dat_so_luong / khong_gioi_han đi một mình (spec 2026-11-17-kho-khong-gioi-han) */
export interface GiftWhLinePatch {
  nguong_canh_bao?: number;
  is_active?: boolean;
  bo?: boolean;
  /** Quà không giới hạn ⇒ có số (≥ số đã dùng) */
  dat_so_luong?: number;
  /** Quà có số riêng (nhóm không có hạn mức) ⇒ không giới hạn */
  khong_gioi_han?: true;
}

/** Thao tác cả nhóm quà trong kho (fn_gift_warehouse_line_update với nhom = true): áp cho mọi quà con của nhóm, nguyên tử */
export interface GiftWhGroupPatch {
  is_active?: boolean;
  /** Bỏ mọi quà con khỏi kho (máy chủ chặn nếu có quà đã xuất / đang được chính sách dùng) */
  bo?: boolean;
  /** Ngưỡng từng quà con; dòng không có trong mảng giữ ngưỡng */
  nguong?: { line_id: string; nguong_canh_bao: number }[];
  /** Hạn mức nhóm: số ⇒ đặt (qua sổ kho), null ⇒ bỏ hạn mức nhóm */
  so_luong_nhom?: number | null;
  nguong_nhom?: number;
  /** Số riêng từng quà con: null ⇒ dùng chung hạn mức nhóm */
  so_luong?: { line_id: string; so_luong: number | null }[];
}

export interface GiftWarehouse {
  id: string;
  ten: string;
  tu_ngay: string;
  den_ngay: string | null;
  mo_ta: string | null;
  is_active: boolean;
  trang_thai: GiftWhStatus;
  pham_vi: GiftWhScope[];
  lines: GiftWhLine[];
}

/** Dòng lưới kho */
export interface GiftWarehouseRow {
  id: string;
  ten: string;
  tu_ngay: string;
  den_ngay: string | null;
  is_active: boolean;
  trang_thai: GiftWhStatus;
  pham_vi: GiftWhScope[];
  so_dong: number;
  /** Số dòng 0 < còn lại ≤ ngưỡng */
  so_sap_het: number;
  /** Số dòng còn lại = 0 */
  so_het: number;
}

export interface GiftWhOptions {
  projects: { id: string; ten: string; toa: { id: string; ten: string }[] }[];
  groups: { id: string; ten: string; loai: GiftLoai; items: { id: string; ten: string; ten_dvt: string | null }[] }[];
  /** Dòng đang có trong kho (khi sửa) */
  da_co: { group_id: string; item_id: string | null }[];
}

export interface GiftWhScopeInput {
  da_project_id: string;
  toa_id: string | null;
}

export interface GiftWhLineInput {
  group_id: string;
  item_id: string | null;
  /** Số lượng ban đầu ≥ 0 (> 0 ⇒ ghi NHAP); null ở quà con = dùng chung hạn mức nhóm (cần phần tử nhóm item_id null) */
  so_luong: number | null;
  nguong_canh_bao: number;
}

export interface GiftWarehouseInput {
  ten: string;
  tu_ngay: string;
  den_ngay: string | null;
  mo_ta: string | null;
  is_active: boolean;
  pham_vi: GiftWhScopeInput[];
  /** Chỉ dùng khi thêm kho; sửa kho bỏ qua */
  lines?: GiftWhLineInput[];
}

export interface GiftWhMoveInput {
  loai: "NHAP" | "DIEU_CHINH" | "XUAT" | "HOAN";
  /** > 0; máy chủ tự đặt dấu */
  so_luong: number;
  /** DIEU_CHINH: true = tăng, false = giảm */
  tang?: boolean;
  ngay: string;
  /** HOAN: phiếu XUAT gốc */
  ref_move_id?: string | null;
  so_chung_tu?: string | null;
  bds_product_id?: string | null;
  ly_do?: string | null;
}

export interface GiftWhMoveResult {
  move_id: string;
  /** null = quà không giới hạn */
  con_lai: number | null;
  nguong_canh_bao: number;
  canh_bao: boolean;
}

export interface GiftWhMove {
  id: string;
  line_id: string;
  ten_nhom: string;
  ten_qua: string | null;
  loai: GiftWhMoveLoai;
  /** Có dấu */
  so_luong: number;
  con_lai_sau: number;
  ngay: string;
  ref_move_id: string | null;
  so_chung_tu: string | null;
  ma_sp: string | null;
  ly_do: string | null;
  nguoi_nhap_ten: string | null;
  ngay_nhap: string;
  /** Chỉ với XUAT: tổng đã hoàn */
  sl_da_hoan: number | null;
}

export interface GiftWhLedgerPage {
  total: number;
  rows: GiftWhMove[];
}

export interface GiftWhProduct {
  id: string;
  ma_sp: string;
  ten_du_an: string;
  ten_toa: string | null;
}

export const GIFT_WH_STATUS_LABEL: Record<GiftWhStatus, string> = {
  NGUNG: "Ngưng dùng",
  SAP_HIEU_LUC: "Sắp hiệu lực",
  HET_HAN: "Hết hạn",
  DANG_HIEU_LUC: "Đang hiệu lực",
};

export const GIFT_WH_MOVE_LABEL: Record<GiftWhMoveLoai, string> = {
  NHAP: "Nhập kho",
  DIEU_CHINH: "Điều chỉnh",
  XUAT: "Xuất",
  HOAN: "Hoàn",
  GIU: "Giữ chỗ",
  HUY_GIU: "Nhả giữ chỗ",
};

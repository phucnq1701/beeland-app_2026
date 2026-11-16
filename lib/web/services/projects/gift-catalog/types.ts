// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/projects/gift-catalog/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * DANH MỤC QUÀ TẶNG / CHIẾT KHẤU 2 CẤP theo Công ty đăng ký (form 9142 `/projects/gift-catalog`, manual 152).
 * Kiểu dữ liệu đúng hợp đồng API của spec `docs/superpowers/specs/2026-11-12-danh-muc-qua-tang-cong-ty-design.md`
 * (RPC `fn_gift_catalog_*` → `dbo.usp_gift_catalog_*`). Đợt 1 không dùng ở Chính sách bán hàng.
 */

/** percentage = chiết khấu %, fixed_amount = số tiền (VNĐ) */
export type GiftLoai = "percentage" | "fixed_amount";
export type GiftKind = "group" | "item";

/** Quà chi tiết (cấp 2) */
export interface GiftItem {
  id: string;
  group_id: string;
  ten: string;
  /** Giá trị mặc định: % (0–100) với nhóm percentage, số tiền nguyên với nhóm fixed_amount */
  gia_tri: number;
  /** Đơn vị tính gõ tự do (≤ 100 ký tự) */
  ten_dvt: string | null;
  thu_tu: number;
  is_active: boolean;
}

/** Nhóm (cấp 1) của công ty đăng ký */
export interface GiftGroup {
  id: string;
  ten: string;
  loai: GiftLoai;
  he_so: number;
  khong_tru_gia_hd: boolean;
  moc_tinh: boolean;
  moc_ty_le: boolean;
  khong_can_phan_bo: boolean;
  mo_ta: string | null;
  thu_tu: number;
  is_active: boolean;
  items: GiftItem[];
}

export interface GiftCatalogData {
  groups: GiftGroup[];
}

export interface GiftGroupInput {
  ten: string;
  loai: GiftLoai;
  he_so: number | null;
  khong_tru_gia_hd: boolean;
  moc_tinh: boolean;
  moc_ty_le: boolean;
  khong_can_phan_bo: boolean;
  mo_ta: string | null;
  /** null = máy chủ gán MAX + 1 */
  thu_tu: number | null;
  is_active: boolean;
}

export interface GiftItemInput {
  ten: string;
  gia_tri: number | null;
  ten_dvt: string | null;
  thu_tu: number | null;
  is_active: boolean;
}

/** Cùng nhãn với ô Loại của form "Sửa chiết khấu" (PolicySection DISCOUNT_TYPE_OPTIONS) */
export const GIFT_LOAI_LABEL: Record<GiftLoai, string> = {
  percentage: "Theo % (Phần trăm)",
  fixed_amount: "Theo VNĐ (Số tiền)",
};

/** Nhãn thẻ cờ của nhóm, như danh sách chiết khấu của chính sách */
export const GIFT_FLAG_LABEL = {
  khong_tru_gia_hd: "Không trừ giá HĐ",
  moc_tinh: "Mốc tổng chưa VAT",
  moc_ty_le: "Mốc tỷ lệ",
  khong_can_phan_bo: "Không cần phân bổ",
} as const;

export type GiftFlag = keyof typeof GIFT_FLAG_LABEL;

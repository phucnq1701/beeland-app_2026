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
  /** Còn lại = sl_nhap − sl_xuat − chứng từ chiếm suất; null = quà không giới hạn */
  con_lai: number | null;
  /** Sức chứa = sl_nhap − sl_xuat (trần phân bổ CTBH); null = quà không giới hạn */
  suc_chua: number | null;
  nguong: number | null;
  /** Hạn mức nhóm (spec 2026-11-16-kho-han-muc-nhom): con_lai / suc_chua ở trên là giá trị hiệu lực */
  dung_chung: boolean;
  /** Quà không giới hạn (spec 2026-11-17-kho-khong-gioi-han): không kiểm sức chứa / còn lại kho */
  khong_gioi_han: boolean;
  group_line_id: string | null;
  con_lai_nhom: number | null;
  suc_chua_nhom: number | null;
}

export interface PolicyKhoOption {
  kho_id: string;
  ten: string;
  tu_ngay: string;
  den_ngay: string | null;
  lines: PolicyKhoLine[];
  /** Phạm vi theo tòa (CSBH đợt 2): chỉ dự án của chính sách, đã bung tòa (cả dự án ⇒ mọi tòa), giao toa_ids của chính sách */
  pham_vi?: { da_project_id: string; ten_du_an: string; toa: { id: string; ten: string }[] }[];
}

/** Cây Dự án → Tòa cho điều kiện «Tòa» của mức theo kho (nút dự án `da:<id>` chỉ để tick cả dự án, giá trị lưu chỉ gồm tòa) */
export function khoToaTree(kho: PolicyKhoOption | null | undefined): { title: string; value: string; children: { title: string; value: string }[] }[] {
  return (kho?.pham_vi ?? []).map((p) => ({
    title: p.ten_du_an,
    value: `da:${p.da_project_id}`,
    children: p.toa.map((t) => ({ title: t.ten, value: t.id })),
  }));
}

/**
 * Tối đa Số lượng (SoLuongTong) của chiết khấu theo kho cho nhóm `groupId` (spec 2026-11-16-csbh-so-luong-kho-tab-khach, như _sp_kho_validate 8d):
 * có dòng nhóm ⇒ min(sức chứa nhóm, có quà dùng chung ? ∞ : Σ quà con); không dòng nhóm ⇒ Σ quà con (TH2); nhóm không quà con ⇒ dòng lá.
 * `suc_chua` của quà riêng đã là min(riêng, nhóm) nên Σ rồi min với nhóm cho cùng kết quả. Không có dòng của nhóm ⇒ null (không giới hạn).
 * Có quà không giới hạn (spec 2026-11-17-kho-khong-gioi-han; luôn là nhóm không dòng nhóm / dòng lá) ⇒ null.
 */
export function khoCapacity(lines: PolicyKhoLine[], groupId: string): number | null {
  const ls = lines.filter((l) => l.group_id === groupId);
  if (ls.length === 0 || ls.some((l) => l.khong_gioi_han)) return null;
  const tong = ls.reduce((s, l) => s + (Number(l.suc_chua) || 0), 0);
  const g = ls.find((l) => l.group_line_id && l.suc_chua_nhom != null);
  if (!g) return tong;
  const nhom = Number(g.suc_chua_nhom) || 0;
  return ls.some((l) => l.dung_chung) ? nhom : Math.min(nhom, tong);
}

/** Tồn theo mức (option.ID) cho form chứng từ */
export interface PolicyKhoStock {
  option_id: string;
  line_id: string;
  kho_id: string;
  kho_ten: string;
  /** null = quà không giới hạn */
  con_lai: number | null;
  suc_chua: number | null;
  nguong: number | null;
  tu_ngay: string;
  den_ngay: string | null;
  kho_active: boolean;
  pham_vi: { da_project_id: string; toa_id: string | null }[];
  /** Hạn mức nhóm (spec 2026-11-16-kho-han-muc-nhom): con_lai / suc_chua ở trên là giá trị hiệu lực */
  dung_chung: boolean;
  /** Quà không giới hạn (spec 2026-11-17-kho-khong-gioi-han) */
  khong_gioi_han: boolean;
  group_line_id: string | null;
  con_lai_nhom: number | null;
  suc_chua_nhom: number | null;
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

/** Hậu tố nhãn tồn của quà dùng chung hạn mức nhóm (spec 2026-11-16-kho-han-muc-nhom) — ô chọn quà / cột Tồn kho của chính sách */
export const dungChungSuffix = (l: { dung_chung?: boolean }) => (l.dung_chung ? " · dùng chung nhóm" : "");

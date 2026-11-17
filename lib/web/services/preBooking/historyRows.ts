// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/preBooking/historyRows.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Dòng lịch sử ở drawer Chi tiết booking.
 * - Đổi tên: `fn_pre_booking_rename_history` trả bản chụp khách cũ / mới lúc lập yêu cầu (`cu` / `moi`, khách ngoài phạm vi đã che ở
 *   máy chủ — `limited`). Bảng `cloud_pre_booking_renames` đọc thẳng phải dùng `RENAME_COLS`: cột `thong_tin_kh` không cấp SELECT.
 * - Thao tác: `cloud_pre_booking_logs`.
 */

/** Mọi cột của `cloud_pre_booking_renames` trừ `thong_tin_kh` (migration 20261101303500 — `select("*")` sẽ bị từ chối). */
export const RENAME_COLS =
  "id, seq, booking_id, dien_giai, tai_lieus, state, ngay_duyet, created_at, updated_at, deleted_at, ma_ctdk, ma_kh_cu, " +
  "ma_kh_moi, created_by_id, updated_by_id, deleted_by_id, nguoi_duyet_id, phieu_giu_cho_id, loai_ct, company_id, " +
  "dong_so_huu_cu, dong_so_huu_moi";

/** Khách trong bản chụp (đã che ở máy chủ khi `limited`). */
export interface RenameSnapCustomer {
  id?: string | null;
  ma_so_kh?: string | null;
  ten_kh?: string | null;
  di_dong?: string | null;
  email?: string | null;
  cccd?: string | null;
  ngay_cap?: string | null;
  noi_cap?: string | null;
  limited?: boolean;
}

/** 1 phần tử của `fn_pre_booking_rename_history`. */
export interface RenameHistoryRpcRow {
  seq: number | string;
  state?: string | null;
  dien_giai?: string | null;
  tai_lieus?: unknown;
  created_at?: string | null;
  nguoi_tao?: string | null;
  ngay_duyet?: string | null;
  nguoi_duyet?: string | null;
  chup_luc?: string | null;
  nguon?: string | null;
  cu?: RenameSnapCustomer | null;
  moi?: RenameSnapCustomer | null;
  /** Người đồng đứng tên lúc lập / sau đổi tên (migration 20261101304100); null = yêu cầu cũ, không đổi đồng đứng tên. */
  dsh_cu?: { id?: string | null; ten_kh?: string | null; limited?: boolean }[] | null;
  dsh_moi?: { id?: string | null; ten_kh?: string | null; limited?: boolean }[] | null;
}

const dshNames = (list: RenameHistoryRpcRow["dsh_cu"]) =>
  Array.isArray(list) ? list.map((c) => c?.ten_kh || "—").join(", ") : null;

/** 1 dòng `cloud_pre_booking_logs`. */
export interface ActionLogDbRow {
  id?: string;
  action?: string | null;
  noi_dung?: string | null;
  state_from?: string | null;
  state_to?: string | null;
  created_at?: string | null;
  created_by_id?: string | null;
}

export const mapRenameHistoryRow = (r: RenameHistoryRpcRow, maBooking: number) => ({
  ID: Number(r.seq),
  MaBooking: maBooking,
  State: r.state,
  DienGiai: r.dien_giai ?? null,
  TaiLieus: (Array.isArray(r.tai_lieus) ? r.tai_lieus : []) as Record<string, string>[],
  NguoiTao: r.nguoi_tao ?? null,
  NgayTao: r.created_at ?? null,
  NguoiDuyet: r.nguoi_duyet ?? null,
  NgayDuyet: r.ngay_duyet ?? null,
  NguonChup: r.nguon ?? null,
  ChupLuc: r.chup_luc ?? null,
  MaKHCu: r.cu?.id ?? null,
  MaSoKHCu: r.cu?.ma_so_kh ?? null,
  TenKHCu: r.cu?.ten_kh ?? null,
  DiDongKHCu: r.cu?.di_dong ?? null,
  EmailKHCu: r.cu?.email ?? null,
  SoCMNDKHCu: r.cu?.cccd ?? null,
  NgayCapKHCu: r.cu?.ngay_cap ?? null,
  NoiCapKHCu: r.cu?.noi_cap ?? null,
  LimitedKHCu: r.cu?.limited === true,
  MaKHMoi: r.moi?.id ?? null,
  MaSoKHMoi: r.moi?.ma_so_kh ?? null,
  TenKHMoi: r.moi?.ten_kh ?? null,
  DiDongKHMoi: r.moi?.di_dong ?? null,
  EmailKHMoi: r.moi?.email ?? null,
  SoCMNDKHMoi: r.moi?.cccd ?? null,
  NgayCapKHMoi: r.moi?.ngay_cap ?? null,
  NoiCapKHMoi: r.moi?.noi_cap ?? null,
  LimitedKHMoi: r.moi?.limited === true,
  DongSoHuuCu: dshNames(r.dsh_cu),
  DongSoHuuMoi: dshNames(r.dsh_moi),
});

export const mapActionLogRow = (r: ActionLogDbRow, names: Record<string, string>) => {
  const ten = names[String(r.created_by_id ?? "")] ?? null;
  return {
    ID: r.id,
    TypeHandle: r.action,
    Action: r.action,
    DienGiai: r.noi_dung ?? null,
    NoiDung: r.noi_dung ?? null,
    StateTu: r.state_from ?? null,
    StateDen: r.state_to ?? null,
    NgayTao: r.created_at ?? null,
    CreatedAt: r.created_at ?? null,
    HoTen: ten,
    NguoiTao: ten,
  };
};

export type RenameHistoryItem = ReturnType<typeof mapRenameHistoryRow>;

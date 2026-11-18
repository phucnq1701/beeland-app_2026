/**
 * Thông báo nhân viên — hộp thư "thông báo theo kịch bản" của chính người đăng nhập (tb_nb_hop_thu), CÙNG nguồn với chuông web
 * từ 2026-11-15 (beeland ModuleLayout.tsx: CHI_THONG_BAO_THEO_KICH_BAN — bảng notifications cũ đã chặn). Máy chủ lọc theo người.
 * Chỉ hàm thuần (không import) để test nạp trực tiếp.
 */

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  /** form_code của màn sinh thông báo (web mở /thong-bao/mo?fc=&id=) */
  formCode: number | null;
  /** id bản ghi (ban_ghi_id) */
  relatedId: string | null;
  /** mã thao tác hiển thị (vd 15-03) */
  action: string | null;
};

const str = (v: unknown) => (v == null ? '' : String(v).trim());

/** Dòng fn_nv_app_thong_bao_list (= fn_tb_nb_hop_thu_list) ⇒ AppNotification. */
export function mapHopThu(rows: any[]): AppNotification[] {
  return (Array.isArray(rows) ? rows : []).filter((h) => h?.id).map((h) => {
    const fc = Number(h.form_code);
    return {
      id: String(h.id),
      title: str(h.tieu_de) || 'Thông báo',
      message: h.noi_dung == null ? '' : String(h.noi_dung),
      createdAt: str(h.created_at),
      isRead: h.da_doc === true || h.da_doc === 1,
      formCode: Number.isFinite(fc) && fc > 0 ? fc : null,
      relatedId: str(h.ban_ghi_id) || null,
      action: str(h.ma_thao_tac) || null,
    };
  });
}

/**
 * Màn app mở khi bấm thông báo — như web (form_code ⇒ màn, ?id= bản ghi) nhưng chỉ các màn app CÓ và tải được theo id.
 * Màn web không có trên app (giỏ hàng, phụ lục…) / đặt cọc, hợp đồng (màn app cần dòng danh sách) ⇒ null: chỉ đánh dấu đã đọc.
 */
// ban_ghi_id của các thao tác ở các màn này = id bản ghi chính (đã đối chiếu _tb_nb_phat). Không mở: Booking (ban_ghi = phiếu giữ chỗ,
// màn app theo id booking), Phiếu thu (màn app chưa có chi tiết thật).
const FORM_ROUTES: Record<number, string> = {
  804: '/price-sheet/[id]', // Phiếu tính giá
  824: '/customer/[id]', // Khách hàng
  832: '/request/[id]', // Yêu cầu khách hàng
  815: '/reports/receipt/[id]', // Phiếu thu (ban_ghi_id = id phiếu thu; vd "Phiếu thu PT-…: duyệt")
  9002: '/signing/[id]', // Đặt lịch ký
};

export function notificationRoute(n: Pick<AppNotification, 'formCode' | 'relatedId'>): { pathname: string; params: { id: string } } | null {
  const path = n.formCode != null ? FORM_ROUTES[n.formCode] : undefined;
  const id = str(n.relatedId);
  if (!path || !id) return null;
  return { pathname: path, params: { id } };
}

/** "Vừa xong" / "x phút trước" / "x giờ trước" / "Hôm qua" / "x ngày trước" / dd/mm/yyyy. */
export function relativeTime(value: string, now: Date = new Date()): string {
  if (!value) return '';
  const date = new Date(value);
  const t = date.getTime();
  if (Number.isNaN(t)) return '';
  const diff = Math.max(0, now.getTime() - t);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  if (hours < 24) return `${hours} giờ trước`;
  if (days === 1) return 'Hôm qua';
  if (days < 7) return `${days} ngày trước`;
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

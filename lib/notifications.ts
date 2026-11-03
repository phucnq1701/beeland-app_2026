/**
 * Thông báo nhân viên — bảng `notifications` trên Cloud, cùng cách lọc với chuông thông báo của web
 * (beeland-dotnet/src/components/Layout/ModuleLayout.tsx › fetchCloudNotifications).
 * Chỉ hàm thuần (không import) để test nạp trực tiếp.
 */

export type AppNotification = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
  type: string | null;
  relatedId: string | null;
};

const str = (v: unknown) => (v == null ? '' : String(v).trim());

/**
 * Bộ lọc `or` cho rest/v1/notifications: thông báo chung + của công ty (mã công ty chữ thường, vd `msr`) + của tài khoản.
 * Không có mã công ty → null (web cũng không tải).
 */
export function notificationOrFilter(companyCode: string, maNV: string): string | null {
  const code = str(companyCode).toLowerCase();
  if (!code) return null;
  const parts = ['is_global.eq.true', `ma_ctdk.eq.${code}`];
  const nv = str(maNV);
  if (nv) parts.push(`account_id.eq.${nv}`);
  return `(${parts.join(',')})`;
}

/**
 * Lọc lại như web: có account_id → chỉ đúng tài khoản; có ma_ctdk → đúng công ty; còn lại phải là thông báo chung.
 */
export function visibleNotifications(rows: any[], companyCode: string, maNV: string): AppNotification[] {
  const code = str(companyCode).toLowerCase();
  const nv = str(maNV);
  return (rows || [])
    .filter((n) => {
      if (n?.account_id) return nv ? String(n.account_id) === nv : false;
      if (n?.ma_ctdk) return String(n.ma_ctdk).toLowerCase() === code;
      return !!n?.is_global;
    })
    .map((n) => ({
      id: String(n.id),
      title: str(n.title) || 'Thông báo',
      message: n.message == null ? '' : String(n.message),
      createdAt: str(n.created_at),
      isRead: !!n.is_read,
      type: n.type ?? null,
      relatedId: n.related_id ?? null,
    }));
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

/**
 * Phân quyền như web (ma trận nhóm quyền: công ty / gói → nhóm quyền → chức năng → tính năng).
 * Không import gì để test nạp trực tiếp được.
 *
 * - MENU: module app hiện khi được mở ÍT NHẤT 1 màn web tương ứng, theo đúng luật `getMenuPermission` của web
 *   (src/lib/menuPermissions.ts): danh sách form người dùng được cấp (`menu`) giao danh sách form công ty đăng ký (`menu_cong_ty`),
 *   lấy từ phiên đăng nhập (cloud-auth, như localStorage menu / menu_congty của web).
 * - NÚT: tính năng của người dùng ở từng màn (`fn_nv_app_quyen_man` = luật fn_perm_form_features của web usePerm).
 * Tài khoản đại lý: giữ như cũ (danh sách module cố định AGENCY_FEATURE_IDS, nút không ẩn theo đợt này) — user chốt 2026-11-17.
 */

/** Màn web tương ứng từng module app (id tính năng ở lib/featureConfig) — user chốt 2026-11-17. */
export const MODULE_FORMS: Record<string, string[]> = {
  '1': ['/projects/management'],
  '2': ['/products/high-rise', '/products/low-rise'],
  '4': ['/sales/locks'],
  '5': ['/sales/bookings'],
  '6': ['/customers/list'],
  '8': ['/contracts/list'],
  // Báo cáo app = "Tổng hợp công nợ & tiến độ TT" của web (/reports/debt-progress dùng chung FormID 862 với /reports/debt-interest)
  '9': ['/reports/debt-interest'],
  '13': ['/sales/deposits'],
  '14': ['/sales/signing-appointments'],
  '15': ['/customers/requests'],
  // Tin nhắn ('16') KHÔNG gắn màn: web để nút chat ở thanh trên cho mọi người (ModuleLayout "Chat - Hộp thư"), không theo menu
  '17': ['/products/price-sheet'],
};

/** Các màn app hỏi tính năng (nút) — gửi 1 lần cho fn_nv_app_quyen_man. */
export const FORM = {
  projects: '/projects/management',
  highRise: '/products/high-rise',
  lowRise: '/products/low-rise',
  locks: '/sales/locks',
  bookings: '/sales/bookings',
  deposits: '/sales/deposits',
  contracts: '/contracts/list',
  customers: '/customers/list',
  requests: '/customers/requests',
  signings: '/sales/signing-appointments',
  priceSheet: '/products/price-sheet',
} as const;

export const APP_FORMS: string[] = Array.from(new Set([...Object.values(MODULE_FORMS).flat(), ...Object.values(FORM)]));

export interface MenuSource {
  /** Đường dẫn form người dùng được cấp (web localStorage `menu`). null = phiên cũ chưa có dữ liệu. */
  menu: string[] | null | undefined;
  /** Đường dẫn form công ty đăng ký (web `menu_congty`). */
  menuCongTy: string[] | null | undefined;
  /** Nhóm "Toàn quyền truy cập" (web `full_access`). */
  fullAccess: boolean;
}

/**
 * Luật getMenuPermission của web cho tài khoản nội bộ ⇒ hàm "form này có trong menu không".
 * Chưa có dữ liệu (2 danh sách rỗng / phiên cũ) ⇒ cho hết như web (tránh khoá trắng); toàn quyền ⇒ form công ty;
 * có cả 2 ⇒ giao; chỉ 1 danh sách ⇒ danh sách đó.
 */
export function menuFormGate(src: MenuSource): (form: string) => boolean {
  const menu = new Set((src.menu ?? []).map(String));
  const ct = new Set((src.menuCongTy ?? []).map(String));
  if (menu.size === 0 && ct.size === 0) return () => true;
  if (src.fullAccess && ct.size === 0) return () => true;
  let allowed: Set<string>;
  if (src.fullAccess) allowed = ct;
  else if (menu.size > 0 && ct.size > 0) allowed = new Set([...menu].filter((f) => ct.has(f)));
  else if (menu.size > 0) allowed = menu;
  else allowed = ct;
  return (form) => allowed.has(form);
}

/** Module app có hiện không (module chưa gắn màn web ⇒ hiện). */
export function moduleAllowed(featureId: string, formGate: (form: string) => boolean): boolean {
  const forms = MODULE_FORMS[featureId];
  if (!forms || forms.length === 0) return true;
  return forms.some((f) => formGate(f));
}

/** Kết quả fn_nv_app_quyen_man: { "<form>": ["VIEW","ADD",…] } */
export type FormFeatures = Record<string, string[]>;

/** Người dùng có tính năng `feature` ở màn `form` không (so mã không phân biệt hoa thường, như web canWith). */
export function hasFeature(data: FormFeatures | null | undefined, form: string, feature: string): boolean {
  const codes = data?.[form];
  if (!Array.isArray(codes)) return false;
  const f = String(feature ?? '').toUpperCase();
  return codes.some((c) => String(c).toUpperCase() === f);
}

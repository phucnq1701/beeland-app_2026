import AsyncStorage from '@react-native-async-storage/async-storage';
import { sanitizeMenuTabIds, visibleFeatureIds } from '@/lib/featureConfig';
import { features } from '@/mocks/features';
import { getScopedKey } from './accountScope';

/**
 * Cấu hình 2 tab menu ở giữa tab bar (giữa Home và Tài khoản).
 * Người dùng chọn tối đa 2 mục trong màn "Tất cả quản lý" → tab "Cấu hình menu".
 * Mặc định: lấy 2 mục đầu tiên trong danh sách features (Dự án, Sản phẩm).
 */
export const MENU_TABS_STORAGE_KEY = '@menu_tabs_config';
export const MAX_MENU_TABS = 2;

/**
 * Các feature đủ điều kiện làm tab menu (có màn hình tương ứng).
 * '7' (Hoa hồng) chưa có route nên không cho chọn.
 */
export const MENU_TAB_FEATURE_IDS: string[] = [
  '1', // Dự án
  '2', // Sản phẩm
  '3', // Lịch hẹn
  '4', // Lock căn
  '5', // Booking
  '6', // Khách hàng
  '8', // Hợp đồng
  '9', // Báo cáo
  '13', // Đặt cọc
];

export const DEFAULT_MENU_TAB_IDS: string[] = features
  .slice(0, MAX_MENU_TABS)
  .map((f) => f.id);

/**
 * Đọc cấu hình tab menu từ AsyncStorage.
 * Luôn trả về đúng MAX_MENU_TABS id được phép với tài khoản hiện tại: bỏ tính năng đang ẩn
 * (vd Hoa hồng) và mục ngoài quyền đại lý còn sót trong bộ nhớ cũ, rồi bù bằng mặc định.
 */
export async function loadMenuTabIds(): Promise<string[]> {
  // Chưa đọc được loại tài khoản → giới hạn như đại lý cho an toàn
  let allowed = visibleFeatureIds(
    features.map((f) => f.id),
    { isAgency: true, menuOnly: true, menuEligible: MENU_TAB_FEATURE_IDS }
  );
  try {
    const isAgency = (await AsyncStorage.getItem('@type_account')) === 'AGENCY';
    allowed = visibleFeatureIds(
      features.map((f) => f.id),
      { isAgency, menuOnly: true, menuEligible: MENU_TAB_FEATURE_IDS }
    );
    const stored = await AsyncStorage.getItem(await getScopedKey(MENU_TABS_STORAGE_KEY));
    if (stored) {
      const config = JSON.parse(stored);
      return sanitizeMenuTabIds(config?.selectedIds, allowed, DEFAULT_MENU_TAB_IDS, MAX_MENU_TABS);
    }
  } catch (error) {
    console.log(
      '[MenuTabs] Load config error:',
      error instanceof Error ? error.message : String(error)
    );
  }
  return sanitizeMenuTabIds([], allowed, DEFAULT_MENU_TAB_IDS, MAX_MENU_TABS);
}

/** Lưu cấu hình tab menu (tối đa MAX_MENU_TABS mục, bỏ trùng lặp). */
export async function saveMenuTabIds(ids: string[]): Promise<void> {
  const unique = ids
    .filter((id, index) => ids.indexOf(id) === index)
    .slice(0, MAX_MENU_TABS);
  await AsyncStorage.setItem(
    await getScopedKey(MENU_TABS_STORAGE_KEY),
    JSON.stringify({ selectedIds: unique })
  );
}
import AsyncStorage from '@react-native-async-storage/async-storage';
import { features } from '@/mocks/features';

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
 * Luôn trả về đúng MAX_MENU_TABS id hợp lệ (tự pad bằng mặc định nếu thiếu/rỗng/lỗi).
 */
export async function loadMenuTabIds(): Promise<string[]> {
  try {
    const stored = await AsyncStorage.getItem(MENU_TABS_STORAGE_KEY);
    if (stored) {
      const config = JSON.parse(stored);
      const ids = Array.isArray(config?.selectedIds) ? config.selectedIds : [];
      const valid = ids.filter(
        (id: unknown) =>
          typeof id === 'string' && features.some((f) => f.id === id)
      );
      const padded = [...valid];
      for (const defaultId of DEFAULT_MENU_TAB_IDS) {
        if (padded.length >= MAX_MENU_TABS) break;
        if (!padded.includes(defaultId)) padded.push(defaultId);
      }
      return padded.slice(0, MAX_MENU_TABS);
    }
  } catch (error) {
    console.log(
      '[MenuTabs] Load config error:',
      error instanceof Error ? error.message : String(error)
    );
  }
  return [...DEFAULT_MENU_TAB_IDS];
}

/** Lưu cấu hình tab menu (tối đa MAX_MENU_TABS mục, bỏ trùng lặp). */
export async function saveMenuTabIds(ids: string[]): Promise<void> {
  const unique = ids
    .filter((id, index) => ids.indexOf(id) === index)
    .slice(0, MAX_MENU_TABS);
  await AsyncStorage.setItem(
    MENU_TABS_STORAGE_KEY,
    JSON.stringify({ selectedIds: unique })
  );
}
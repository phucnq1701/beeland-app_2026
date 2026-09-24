import FeatureTabScreen from '@/components/FeatureTabScreen';

/**
 * Tab menu thứ hai (cạnh Tài khoản - bên phải).
 * Nội dung do người dùng cấu hình trong "Tất cả quản lý" → "Cấu hình menu".
 * Mặc định: mục thứ hai (Sản phẩm).
 */
export default function FeatureTab2() {
  return <FeatureTabScreen slot={1} />;
}
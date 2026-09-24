import FeatureTabScreen from '@/components/FeatureTabScreen';

/**
 * Tab menu thứ nhất (cạnh Home - bên trái).
 * Nội dung do người dùng cấu hình trong "Tất cả quản lý" → "Cấu hình menu".
 * Mặc định: mục đầu tiên (Dự án).
 */
export default function FeatureTab1() {
  return <FeatureTabScreen slot={0} />;
}
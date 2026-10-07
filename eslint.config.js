const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

// File đã theo design system: màu chỉ được lấy từ @/theme (spec 4.1).
// Mỗi giai đoạn migrate thêm màn vào danh sách này.
const UI_STRICT_FILES = [
  'components/ui/**/*.{ts,tsx}',
  'lib/**/*.{ts,tsx}',
  'app/dev/**/*.{ts,tsx}',
  // Giai đoạn 1 – booking & thanh toán
  'app/bookings.tsx',
  'app/booking/**/*.{ts,tsx}',
  'components/booking/**/*.{ts,tsx}',
  'components/FilterPanel.tsx',
  // Giai đoạn 2 – điều hướng & trang chủ
  'app/(tabs)/_layout.tsx',
  'app/(tabs)/home.tsx',
  'app/(tabs)/account.tsx',
  'app/all-management.tsx',
  'app/profile.tsx',
  'components/home/**/*.{ts,tsx}',
  // Giai đoạn 3 – sản phẩm & dự án
  'app/projects.tsx',
  'app/project/**/*.{ts,tsx}',
  'app/products.tsx',
  'app/product/**/*.{ts,tsx}',
  'app/locked-units.tsx',
  'app/locked/**/*.{ts,tsx}',
  'app/diagram/**/*.{ts,tsx}',
  'components/product/**/*.{ts,tsx}',
  // Giai đoạn 4 – khách hàng
  'app/customers.tsx',
  'app/customer/**/*.{ts,tsx}',
  'app/contacts.tsx',
  'components/customer/**/*.{ts,tsx}',
  // Giai đoạn 5 – cọc, hợp đồng, báo cáo
  'app/deposits.tsx',
  'app/deposit/**/*.{ts,tsx}',
  'app/contracts.tsx',
  'app/contract/**/*.{ts,tsx}',
  'app/reports/**/*.{ts,tsx}',
  'components/sales/**/*.{ts,tsx}',
  'components/reports/**/*.{ts,tsx}',
  // Đặt lịch ký
  'app/signings.tsx',
  'app/signing/**/*.{ts,tsx}',
  'components/signing/**/*.{ts,tsx}',
  // Yêu cầu khách hàng
  'app/requests.tsx',
  'app/request/**/*.{ts,tsx}',
  'components/request/**/*.{ts,tsx}',
  // Giai đoạn 6 – đăng nhập, media
  'app/login.tsx',
  'app/register.tsx',
  'app/forgot-password.tsx',
  'app/reset-password.tsx',
  'app/verify-otp.tsx',
  'app/folders/**/*.{ts,tsx}',
  'app/documents/[[]folderId].tsx',
  'app/photo-gallery.tsx',
  'app/video/**/*.{ts,tsx}',
  'app/videos/[[]folderId].tsx',
  'components/media/**/*.{ts,tsx}',
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    files: UI_STRICT_FILES,
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]', message: 'Dùng token trong @/theme thay vì mã hex.' },
        { selector: 'Literal[value=/^rgba?\\(/]', message: 'Dùng token trong @/theme thay vì rgba().' },
      ],
    },
  },
]);

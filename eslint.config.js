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

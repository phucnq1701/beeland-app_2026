# Trang chủ, điều hướng, tính năng

## Màn

| Màn | File |
|---|---|
| Tab bar: Trang chủ · 2 tab tính năng động · Tài khoản (`ai-chat` ẩn bằng `href: null`) | `app/(tabs)/_layout.tsx` |
| 2 tab động (nội dung theo cấu hình) | `app/(tabs)/feature-1.tsx`, `feature-2.tsx` → `components/FeatureTabScreen.tsx` |
| Trang chủ | `app/(tabs)/home.tsx` + `components/home/*` |
| Tất cả quản lý (chọn tính năng trang chủ / tab menu) | `app/all-management.tsx` |
| Thông báo (API cũ `api/admin/get-notifications`) | `app/notifications.tsx` |

## Tính năng và quyền

Danh mục tính năng: `mocks/features.ts` (id 1–13). Logic chung: `lib/featureConfig.ts` (có test `tests/feature-config.test.cjs`).

| id | Tính năng | Route | Đại lý |
|---|---|---|---|
| 1 | Dự án | `/projects` | ✓ |
| 2 | Sản phẩm | `/products` | ✓ |
| 3 | Lịch hẹn | `/appointments` | **ẩn mọi nơi** (`HIDDEN_FEATURE_IDS`) |
| 4 | Căn đã lock | `/locked-units` | |
| 5 | Booking | `/bookings` | ✓ |
| 6 | Khách hàng | `/customers` | |
| 7 | Hoa hồng | – (chưa có màn → ẩn) | |
| 8 | Hợp đồng | `/contracts` | |
| 9 | Báo cáo | `/reports` | |
| 13 | Đặt cọc | `/deposits` | ✓ |

- `visibleFeatureIds`: bỏ id không có route, id trong `HIDDEN_FEATURE_IDS`, id ngoài quyền đại lý (`AGENCY_FEATURE_IDS`).
- Cấu hình người dùng lưu `@home_features_config` (khoá theo tài khoản qua `getScopedKey`); đọc lại bằng
  `resolveHomeFeatureIds` / `sanitizeMenuTabIds` (id cũ không hợp lệ bị bỏ, thiếu thì bù mặc định).
- Không đọc được loại tài khoản → coi như đại lý (an toàn).
- Màn tính năng nhận prop `embedded` khi nằm trong tab (ẩn nút back, chừa chỗ tab bar `TAB_BAR_SPACE = 100`).
- Trang chủ tải song song: dự án, booking gần đây, đặt cọc (`DatCocService.get`), khách hàng.

## Màn mẫu / chưa có API (không redesign, chỉ dùng token theme)

`app/(tabs)/ai-chat.tsx`, `app/chat/*`, `app/contacts.tsx` (danh bạ chat), `app/receipts.tsx`, `app/receipt/[id].tsx`,
`app/handovers.tsx`, `app/handover/[id].tsx`, `app/price-calculator/[id].tsx` (nút "Tính giá" ở chi tiết căn đã ẩn),
`app/appointments.tsx` (thật nhưng đang ẩn, gọi API cũ). Dữ liệu mẫu ở `mocks/`.

## Tồn đọng

- Bật lại Lịch hẹn: bỏ `'3'` khỏi `HIDDEN_FEATURE_IDS`; màn còn gọi API cũ (`sevices/CongViecService`, `sevices/CustomerService`).
- Thông báo dùng API cũ – **chưa kiểm chứng** còn dữ liệu khi web đã Cloud-only.

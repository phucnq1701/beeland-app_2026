# Trang chủ, điều hướng, tính năng

## Màn

| Màn | File |
|---|---|
| Tab bar: Trang chủ · 2 tab tính năng động · Tài khoản (`ai-chat` ẩn bằng `href: null`). Thanh nổi kiểu Instagram: viên thuốc kính xanh xám mờ căn giữa (mỗi tab rộng 64, cao 54, `BlurView` tint light 95 (Android `dimezisBlurView`) + lớp phủ `colors.frosted` + viền `frostedBorder`), chỉ icon 20 (`inverse`), viên `frostedActive` + icon `primary` trượt theo tab đang chọn; tab hiện trên thanh lấy theo `VISIBLE_ROUTES` – thêm tab mới phải thêm vào đó. Màn trong tab chừa đáy `TAB_BAR_SPACE` = 100 | `app/(tabs)/_layout.tsx`, `components/home/FloatingTabBar.tsx` |
| 2 tab động (nội dung theo cấu hình) | `app/(tabs)/feature-1.tsx`, `feature-2.tsx` → `components/FeatureTabScreen.tsx` |
| Trang chủ | `app/(tabs)/home.tsx` + `components/home/*` |
| Tất cả quản lý (chọn tính năng trang chủ / tab menu). Kiểu bo tròn: header/thanh chọn `soft`, danh sách đã chọn trong card bo `radius.xxl`, "Tất cả các mục" là `FeatureGrid columns={4} compact` (ô nhỏ 84, icon 40, chữ 12; ô thường ở trang chủ 92, icon 44, chữ 13 – cùng bo 20, khoảng cách 10) | `app/all-management.tsx` |
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
- Giao diện trang chủ (phong cách bo tròn, 2026-10-01): lề ngang 20 (`space.xl`), khoảng cách giữa các khối 28; tiêu đề khối
  `HomeSectionHeader` (heading, chữ thường + nút viên thuốc "Xem tất cả"); ô tính năng bo `radius.xl` (92, icon 44), card gần đây bo `radius.xxl` + bóng
  `elevation.soft`, không viền; mỗi dòng "gần đây" là một card riêng, avatar tròn 44; carousel dự án rộng theo màn hình
  (chừa 36 để ló card sau), ảnh tràn card + gradient `showcase.scrim`, bo `radius.x3`. `FeatureTile`/`FeatureGrid` dùng chung
  với Tất cả quản lý và Tài khoản nên đổi theo.
- Trang chủ tải song song: dự án, booking gần đây, đặt cọc (`DatCocService.get`), khách hàng.

## Màn mẫu / chưa có API (không redesign, chỉ dùng token theme)

`app/(tabs)/ai-chat.tsx`, `app/chat/*`, `app/contacts.tsx` (danh bạ chat), `app/receipts.tsx`, `app/receipt/[id].tsx`,
`app/handovers.tsx`, `app/handover/[id].tsx`, `app/price-calculator/[id].tsx` (nút "Tính giá" ở chi tiết căn đã ẩn),
`app/appointments.tsx` (thật nhưng đang ẩn, gọi API cũ). Dữ liệu mẫu ở `mocks/`.

## Tồn đọng

- Bật lại Lịch hẹn: bỏ `'3'` khỏi `HIDDEN_FEATURE_IDS`; màn còn gọi API cũ (`sevices/CongViecService`, `sevices/CustomerService`).
- Thông báo dùng API cũ – **chưa kiểm chứng** còn dữ liệu khi web đã Cloud-only.

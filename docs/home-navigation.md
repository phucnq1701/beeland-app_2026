# Trang chủ, điều hướng, tính năng

## Màn

| Màn | File |
|---|---|
| Tab bar: Trang chủ · 2 tab tính năng động · Tài khoản (`ai-chat` ẩn bằng `href: null`). Thanh nổi kiểu Instagram: viên thuốc kính xanh xám mờ căn giữa (mỗi tab rộng 64, cao 54, `BlurView` tint light 95 (Android `dimezisBlurView`) + lớp phủ `colors.frosted` + viền `frostedBorder`), chỉ icon 20 (`inverse`), viên `frostedActive` + icon `primary` trượt theo tab đang chọn; tab hiện trên thanh lấy theo `VISIBLE_ROUTES` – thêm tab mới phải thêm vào đó. Màn trong tab chừa đáy `TAB_BAR_SPACE` = 100 | `app/(tabs)/_layout.tsx`, `components/home/FloatingTabBar.tsx` |
| 2 tab động (nội dung theo cấu hình) | `app/(tabs)/feature-1.tsx`, `feature-2.tsx` → `components/FeatureTabScreen.tsx` |
| Trang chủ | `app/(tabs)/home.tsx` + `components/home/*` |
| Tất cả quản lý (chọn tính năng trang chủ / tab menu). Kiểu bo tròn: header/thanh chọn `soft`, danh sách đã chọn trong card bo `radius.xxl`, "Tất cả các mục" là `FeatureGrid columns={4} compact` (ô nhỏ 84, icon 40, chữ 12; ô thường ở trang chủ 92, icon 44, chữ 13 – cùng bo 20, khoảng cách 10) | `app/all-management.tsx` |
| Thông báo: hộp thư "thông báo theo kịch bản" như chuông web (từ 15/11/2026) – mục **Thông báo** dưới | `app/notifications.tsx`, `services/NotificationService.ts`, `lib/notifications.ts` |

## Tính năng và quyền

Danh mục tính năng: `mocks/features.ts` (id 1–17). Logic chung: `lib/featureConfig.ts` (có test `tests/feature-config.test.cjs`).
Lịch hẹn (id 3) đã bỏ hẳn 2026-11-17 (màn gọi API .NET cũ) – không có route; làm lại thì theo web + API riêng.

| id | Tính năng | Route | Đại lý |
|---|---|---|---|
| 1 | Dự án | `/projects` | ✓ |
| 2 | Sản phẩm | `/products` | ✓ |
| 4 | Căn đã lock | `/locked-units` | |
| 5 | Booking | `/bookings` | ✓ |
| 6 | Khách hàng | `/customers` | |
| 7 | Hoa hồng | – (chưa có màn → ẩn) | |
| 8 | Hợp đồng | `/contracts` | |
| 9 | Báo cáo | `/reports` | |
| 13 | Đặt cọc | `/deposits` | ✓ |
| 14 | Đặt lịch ký | `/signings` (`docs/signing.md`) | ✓ **chỉ đại lý** – nội bộ ẩn (`AGENCY_ONLY_FEATURE_IDS`) |
| 15 | Yêu cầu KH | `/requests` (`docs/requests.md`) | |
| 16 | Tin nhắn | `/chat` (`docs/chat.md`) – chọn được làm tab menu (`embedded`: ẩn nút quay lại, chừa thanh tab) | ✓ (khu chat Đại lý) |
| 17 | Phiếu tính giá | `/price-sheets` (`docs/price-sheets.md`) – chọn được làm tab menu | – (chỉ nội bộ) |

- `visibleFeatureIds`: bỏ id không có route (`FEATURE_ROUTES`), id trong `HIDDEN_FEATURE_IDS` (hiện rỗng), id ngoài quyền đại lý (`AGENCY_FEATURE_IDS`),
  và với tài khoản nội bộ bỏ id chỉ dành cho đại lý (`AGENCY_ONLY_FEATURE_IDS` = `14`). Kiểm 1 id: `isFeatureAllowed(id, isAgency)`.
- Cấu hình người dùng lưu `@home_features_config` (khoá theo tài khoản qua `getScopedKey`); đọc lại bằng
  `resolveHomeFeatureIds` / `sanitizeMenuTabIds` (id cũ không hợp lệ bị bỏ, thiếu thì bù mặc định).
- Loại tài khoản: `getSessionInfo().isAgency` (`services/session.ts`). Không đọc được → coi như đại lý (an toàn).
- Màn tính năng nhận prop `embedded` khi nằm trong tab (ẩn nút back, chừa chỗ tab bar `TAB_BAR_SPACE = 100`).
- Giao diện trang chủ (phong cách bo tròn, 2026-10-01): lề ngang 20 (`space.xl`), khoảng cách giữa các khối 28; tiêu đề khối
  `HomeSectionHeader` (heading, chữ thường + nút viên thuốc "Xem tất cả"); ô tính năng bo `radius.xl` (92, icon 44), card gần đây bo `radius.xxl` + bóng
  `elevation.soft`, không viền; mỗi dòng "gần đây" là một card riêng, avatar tròn 44; carousel dự án rộng theo màn hình
  (chừa 36 để ló card sau), ảnh tràn card + gradient `showcase.scrim`, bo `radius.x3`. `FeatureTile`/`FeatureGrid` dùng chung
  với Tất cả quản lý và Tài khoản nên đổi theo.
- Trang chủ tải song song: dự án, booking gần đây, đặt cọc (`DatCocService.get`), khách hàng. Lối vào Chat: nút Tin nhắn ở
  header (`docs/chat.md`); chuông → `/notifications`.
- Không còn màn mẫu / dữ liệu mock (đã xoá 2026-11-17: Lịch hẹn, Phiếu thu `receipts` / `receipt/[id]`, Bàn giao `handovers` /
  `handover/[id]`). Chi tiết phiếu thu thật: `app/reports/receipt/[id].tsx` (`docs/reports.md`).

## Thông báo (`services/NotificationService.ts`, logic thuần `lib/notifications.ts`, test `tests/notifications.test.cjs`)

Cùng nguồn chuông web từ 15/11/2026 (hộp thư `tb_nb_hop_thu`; bảng `notifications` cũ web đã chặn, app không đọc nữa).

| Việc | Endpoint |
|---|---|
| 50 tin mới nhất của chính người đăng nhập (máy chủ lọc) + số chưa đọc | `fn_nv_app_thong_bao_list { p_payload: { so_dong: 50 } }` (= `fn_tb_nb_hop_thu_list`) → `mapHopThu` |
| Đánh dấu đã đọc 1 tin / "Đánh dấu tất cả" | `fn_nv_app_thong_bao_doc { p_payload: { id } }` / `{ p_payload: {} }` (= `fn_tb_nb_doc`) |
| Tin mới | realtime kênh private `tb:u:<employee_id>`, sự kiện `tb_moi` ⇒ tải lại |

- Bấm tin: đánh dấu đã đọc (như web, xong mới cập nhật dòng) + mở màn app theo `form_code` / `ban_ghi_id` (`notificationRoute`)
  – **chỉ** 804 Phiếu tính giá, 824 Khách hàng, 832 Yêu cầu KH, 9002 Đặt lịch ký. Màn khác (booking: `ban_ghi_id` là phiếu giữ
  chỗ; đặt cọc / hợp đồng cần dòng danh sách; màn web không có trên app) ⇒ chỉ đánh dấu đã đọc.

## Tồn đọng

- Chuông ở Trang chủ chưa có số chưa đọc (web có; `list()` đã trả `unread`).

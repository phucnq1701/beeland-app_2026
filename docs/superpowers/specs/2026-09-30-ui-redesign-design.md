# Thiết kế lại giao diện Beeland Sales (beeland-app_2026)

- Ngày: 2026-09-30
- Nhánh: `devhuan2` (tách từ `devhuan` @ `346e70c0`)
- Phạm vi: chỉ app mobile Expo `beeland-app_2026`. Web CRM `beeland` nằm ngoài phạm vi.
- Trạng thái: đã duyệt từng phần trong buổi brainstorming.

## 0. Nguyên tắc: Web là chuẩn nghiệp vụ (bổ sung 2026-09-30)

- Web `beeland` (cùng workspace) đã hoàn thiện và là **CHUẨN về nghiệp vụ và luồng**.
- App phải cho **kết quả đúng và đồng bộ với web**: cùng trạng thái, cùng số tiền, cùng điều kiện
  được phép thao tác (lock, booking, cọc…).
- **Giao diện và cách thao tác** được tối ưu cho mobile, không cần giống web.
- Gặp nghiệp vụ chưa rõ: **đọc code web và làm theo**, không tự đoán. Chỉ hỏi người dùng khi web và app
  mâu thuẫn, hoặc web cũng không có quy định.
- Khi làm theo web, ghi rõ nguồn (file web) trong chú thích code của app.
- **BẮT BUỘC – không sửa phía server** trong toàn bộ redesign: không đụng hàm SQL, migration, edge function,
  bảng, trigger, RLS hay dữ liệu Supabase. **Chỉ sửa code app (client).** Lỗi nằm ở server → ghi vào mục 0.2
  và báo người dùng, không tự sửa.

### 0.1 Trạng thái căn (theo web)

Nguồn: `beeland/src/services/ProductTransactionStatus.ts` (mã), `src/pages/Products/FloorPlanOverview.tsx`
(4 nhóm sơ đồ), `src/utils/productSaleStatus.ts` (điều kiện thao tác), `src/utils/productStatusColor.ts` (màu).

- **Nhãn** = tên trong danh mục `cloud_catalogs` (`bds_trang_thai.item_name`). **Màu** = màu của sản phẩm
  (`MauNen`) → màu danh mục (`color_code`) → xám.
- **Nhóm** (tóm tắt sơ đồ): Mở bán · Giữ chỗ · Đã bán · Khóa. **Lấy sơ đồ web làm chuẩn**: app chép nguyên
  `mapStatus` của `FloorPlanOverview.tsx` (`lib/productStatus.ts` → `webUnitStatus`), không tự "sửa cho hợp lý":
  1. Theo tên (chữ thường, có dấu): "đã bán" / "đã ký" / "hợp đồng" → Đã bán; "giữ chỗ" / "booking" / "đặt cọc" /
     "cọc" → Giữ chỗ; "khóa" / "ngừng" / "bảo trì" → Khóa; "mở bán" / "sẵn" / "trống" → Mở bán.
  2. Không khớp tên → theo `MaTT`: 2 → Mở bán, 3 → Giữ chỗ, 4/5 → Đã bán, còn lại (kể cả uuid, rỗng) → Khóa.
  3. Tên dùng để xét = tên trên căn, không có thì tên danh mục.
  Hệ quả (giống web): HĐMB, Bàn giao, Cấp sổ đỏ, Góp vốn, "ĐC chờ duyệt"… → **Khóa**. Muốn đổi thì đổi web trước.
- **Lock căn**: chỉ khi căn ở **mã 2 – Mở bán**; hệ thống từ chối (`fn_product_transaction` lỗi) → **dừng, không
  tạo phiếu lock** (web: `CloudWriteService.lockProductCloudFirst`).
- **Booking**: gọi `fn_booking_create` như web (`src/services/Product.js` → `addBookingAPI`). Máy chủ chỉ nhận
  **mã 2**, hoặc **mã 18 kèm phiếu lock còn hạn**; từ chối → dừng, không tạo gì, báo lỗi của máy chủ.

Bảng dưới: cột Nhóm tính theo tên danh mục chuẩn; nếu tên thực tế trong `bds_trang_thai` khác thì nhóm theo tên thực tế.

| Mã | Tên (danh mục) | Nhóm (như sơ đồ web) | Lock | Booking |
|---|---|---|---|---|
| 0 | Thanh lý chờ duyệt | Khóa | – | – |
| 1 | Chưa bán | Khóa | – | – |
| 2 | Mở bán | Mở bán | ✓ | ✓ |
| 3 | Booking | Giữ chỗ | – | – |
| 5 | Đã đặt cọc | Giữ chỗ | – | – |
| 6 | HĐMB | Khóa | – | – |
| 7 | Giữ chỗ | Giữ chỗ | – | – |
| 8 | Bàn giao | Khóa | – | – |
| 9 | Cấp sổ đỏ | Khóa | – | – |
| 10 | Góp vốn | Khóa | – | – |
| 11 | Booking chờ duyệt | Giữ chỗ | – | **App giữ tắt** – xem 0.2 |
| 12 | ĐC (đặt cọc) chờ duyệt | Khóa nếu tên là "ĐC…", Giữ chỗ nếu tên có "cọc" | – | – |
| 13 | Góp vốn chờ duyệt | Khóa | – | – |
| 14 | HĐMB chờ duyệt | Khóa | – | – |
| 15 | Bàn giao chờ duyệt | Khóa | – | – |
| 16 | Khác | Khóa | – | – |
| 17 | Giữ chỗ ưu tiên | Giữ chỗ | – | – |
| 18 | Đã Lock | Khóa | – | chỉ khi có phiếu lock còn hạn (từ màn Lock căn) |
| khác | (mã lạ, gồm 4, 19–22) | Khóa | – | – |

### 0.2 Lỗi / mâu thuẫn phía web cần báo đội web

App giữ đúng như web ở các điểm dưới đây cho tới khi đội web / nghiệp vụ quyết định; không tự sửa riêng ở app.

1. **Booking căn "Booking chờ duyệt" (mã 11) – chờ nghiệp vụ quyết.** Giao diện web bật nút Booking
   (`src/hooks/useProductTransactionGuard.ts` → `isBookingPending`, `components/project-viewer/TransactionActions.tsx`,
   `pages/Products/FloorPlanOverview.tsx`), nhưng máy chủ `fn_booking_create`
   (`supabase/migrations/20260921120000_fn_booking_create_unique_code.sql`) chỉ nhận mã 2 hoặc mã 18 có lock
   còn hạn → luôn báo "Sản phẩm đang ở trạng thái … nên không lập được phiếu giữ chỗ". **App giữ tắt nút này.**
   Khi nghiệp vụ chốt cho phép booking ưu tiên: sửa máy chủ trước, rồi bật ở app (`app/product/[id].tsx`).
2. **Sơ đồ web: nhóm "Đã bán" gần như luôn bằng 0.** `mapStatus` trong `FloorPlanOverview.tsx` chỉ xếp "Đã bán"
   khi tên có "đã bán" / "đã ký" / "hợp đồng", hoặc `MaTT` là số 4/5. Tên danh mục chuẩn (HĐMB, HĐMB chờ duyệt,
   Bàn giao, Cấp sổ đỏ, Góp vốn…) không khớp và `MaTT` trên Cloud là uuid → rơi vào "Khóa". Thêm nữa, nhánh số
   coi mã 5 (Đã đặt cọc) là "Đã bán" và mã 4 không tồn tại – lệch với bảng mã `ProductTransactionStatus.ts`.
   **App giữ như web** (spec 0.1); đề xuất đội web xếp nhóm theo `item_code` của danh mục.

3. **Yêu cầu trùng khách đã được duyệt vẫn bị chặn.** Web có `CustomerDupRequestService.findApprovalFor`
   (yêu cầu "Cho tạo khách hàng mới"/"Chuyển giao" đã duyệt) nhưng **không nơi nào gọi** → nhân viên được duyệt nhập
   lại vẫn bị `checkCustomerDuplicate` chặn / bắt gửi yêu cầu lần nữa. **App làm giống web** (GĐ4); đề xuất đội web
   bỏ qua khách trùng đã có yêu cầu được duyệt cho đúng nhân viên đó.

## 1. Mục tiêu và bối cảnh

**Người dùng:** nhân viên kinh doanh / đại lý bất động sản, dùng app hằng ngày trên điện thoại, thường khi đang
di chuyển hoặc đang ngồi cùng khách: tra căn, lock căn, tạo booking, thu tiền booking qua QR, theo dõi cọc/hợp đồng, xem báo cáo.

**Mục tiêu:**
1. Giao diện nhất quán, hiện đại, dễ đọc: một design system duy nhất thay cho style viết tay từng màn.
2. Rút ngắn luồng chính Booking → Thu tiền QR.
3. Mọi màn có đủ trạng thái loading / rỗng / lỗi; phản hồi thao tác bằng toast thay vì Alert.
4. Đạt WCAG AA về tương phản, chạm tối thiểu 44×44, có nhãn trợ năng cho nút chỉ có icon.

**Thành công khi:**
- Không còn mã hex viết cứng trong `app/` và `components/` (trừ `theme/`), lint chặn được.
- Luồng tạo booking → màn QR không cần quay về danh sách để tìm lại.
- Mọi màn danh sách có skeleton, empty state, error + thử lại, kéo để làm mới.
- `Alert.alert` chỉ còn cho thao tác phá huỷ và lỗi chặn.

**Ràng buộc:**
- Tạm dừng phát triển tính năng trong thời gian redesign (không có người khác sửa cùng màn).
- **Không đổi logic nghiệp vụ và lời gọi service/API.** Chỉ đổi giao diện và điều hướng.
- Không thêm thư viện UI (không NativeWind/Tamagui/gluestack). Chỉ React Native `StyleSheet` + các gói Expo đã có.
- Chỉ commit local trên `devhuan2`, mỗi giai đoạn 1 commit. Không push, không PR, không `eas update`.

**Stack:** Expo 54, React Native 0.81, expo-router 6, TanStack Query 5, lucide-react-native, expo-haptics (đã cài, chưa dùng),
test bằng `node:test` (`tests/*.test.cjs`).

## 2. Hiện trạng (audit)

### 2.1 Màn hình (67 file, 13 module)

| Module | Màn hình | Ưu tiên |
|---|---|---|
| Auth | login, register, forgot-password, verify-otp, reset-password | Trung bình |
| Tabs | (tabs)/home, feature-1/2 (menu động), ai-chat, account | Cao |
| Booking & Thanh toán | bookings, booking/create, booking/[id], booking/qr-payment, booking/payment-method, payment/[id], receipts, receipt/[id] | Cao nhất |
| Sản phẩm & Dự án | projects, project/[id], products, product/[id], product/BlockGrid, price-calculator/[id], diagram/[mada] | Cao (phong cách trưng bày) |
| Lock căn | locked-units, locked/[id] | Cao |
| Khách hàng | customers, customer/new, customer/[id], customer/[id]/edit, customer/[id]/contracts, contacts | Cao |
| Cọc – HĐ – Bàn giao | deposits, deposit/[id], contracts, contract/[id], handovers, handover/[id] | Trung bình |
| Báo cáo | reports/index, contract, payment, payment-due, overdue | Trung bình |
| Lịch hẹn | appointments | Trung bình |
| Tài liệu & Media | folders, documents/[folderId], documents/viewer, photos/[folderId], photo-gallery, videos/[folderId], video/[projectId], videos/viewer | Thấp |
| Chat | chat/[id], chat/create-group, chat/manage-members/[groupId] | Thấp |
| Khác | notifications, profile, all-management, manage-features, +not-found | Thấp |

Component dùng chung hiện có (6, đều là component nghiệp vụ): `FilterPanel`, `ReportFilterBar`, `PriceStatusTable`,
`ImageViewerModal`, `FeatureTabScreen`, `UpdateManager`. Không có Button/Input/Card/Header chuẩn.

### 2.2 Vấn đề chính

- **Màu/chữ/khoảng cách:** 153 mã hex khác nhau viết cứng; 20 cỡ chữ (9–56); 15 giá trị bo góc; 2 kiểu header lẫn lộn,
  26 cách viết nút back; icon tính năng 9 màu cầu vồng; emoji làm icon; Be Vietnam Pro chỉ có trên web.
- **Tương phản:** cam `#E86F25` + chữ trắng = 3.12:1 (không đạt AA 4.5:1); 68 chỗ chữ < 12px.
- **Phản hồi:** 128 `Alert.alert`; 0 toast; 0 skeleton; spinner toàn màn với 10 câu chữ khác nhau; chỉ 3 màn có pull-to-refresh;
  nhiều màn chi tiết không có trạng thái lỗi.
- **Luồng:** tạo booking xong `router.replace("/bookings")` → phải tự tìm lại booking để thu tiền. `booking/payment-method`
  không được màn nào điều hướng tới. `payment/[id]` dùng dữ liệu mock và trùng chức năng với `booking/qr-payment`.
- **Trợ năng/chạm:** 6 `accessibilityLabel` trong toàn app; 60 file dùng `TouchableOpacity`, phản hồi chạm không đồng nhất.
- **Code ảnh hưởng UI:** màn 1.000–1.850 dòng; `formatCurrency`/`formatDate` bị viết lại khoảng 18 lần.
- **Điểm tốt cần giữ:** màu trạng thái lấy từ `color_code` của dữ liệu (`components/utils/statusColor.ts`);
  màn QR đã tự kiểm tra thanh toán 5 giây/lần và có đếm ngược theo `het_han_luc`.

## 3. Quyết định đã chốt

| # | Quyết định |
|---|---|
| D1 | Cách làm: tự xây design system trên `StyleSheet` (token + component trong `components/ui/`), migrate theo module. |
| D2 | Màn làm việc dùng bảng màu **A – Slate Pro**; màn giới thiệu dự án/căn hộ dùng **chế độ trưng bày** navy + cam sáng (từ phương án B). |
| D3 | **Một màu nút chính cho toàn app: `#C9501A`** (kể cả trên màn trưng bày). `#E86F25` chỉ dùng trang trí, không làm nền cho chữ. |
| D4 | Không làm dark mode đợt này. `userInterfaceStyle` → `"light"` (cần build store); token tổ chức sẵn để thêm dark sau. |
| D5 | Be Vietnam Pro trên mọi nền tảng, file TTF trong `assets/fonts/`, nạp bằng `expo-font` `useFonts` (OTA được). |
| D6 | Body 15/22, caption 14/20, cỡ chữ nhỏ nhất 12. |
| D7 | Toast cho thông báo thường; Alert/`confirm()` chỉ cho thao tác phá huỷ (xoá, huỷ) và lỗi chặn. Lỗi form hiện dưới ô nhập. |
| D8 | Tạo booking xong → vào thẳng chi tiết booking. |
| D9 | Xoá `booking/payment-method` và `payment/[id]`. `receipts`, `receipt/[id]` nằm ngoài đợt này. |
| D10 | Giữ nút **tạo QR thủ công** (chưa rõ giới hạn/phí ngân hàng), làm nổi bật. Nếu booking đã có QR cũ hết hạn → hỏi xác nhận trước khi tạo QR mới. Không bao giờ tự tạo QR ngầm. |
| D11 | Màn chạy dữ liệu mock (`receipts`, `receipt/[id]`, `chat/*`, `handover*`) không tái cấu trúc; chỉ nhận màu mới qua shim. |

## 4. Design system

### 4.1 Cấu trúc thư mục

```
theme/
  colors.ts        palette gốc → token ngữ nghĩa (work) + showcase
  typography.ts    7 kiểu chữ + fontFamily theo weight
  spacing.ts       space, radius, elevation, motion, hitSlop
  index.ts         export chung
lib/
  format.ts        formatVND, formatVNDShort, formatDate, formatDateTime, formatCountdown, maskPhone
components/ui/     component chuẩn (mục 4.6)
assets/fonts/      BeVietnamPro-{Regular,Medium,SemiBold,Bold}.ttf
```

`constants/colors.ts` giữ lại làm **shim**: các tên cũ (`primary`, `text`, `textSecondary`, `accent.*`, …) trỏ sang token mới,
để màn chưa migrate vẫn chạy và tự nhận màu mới. Xoá shim ở Giai đoạn 6.

### 4.2 Màu (đã kiểm tra tương phản WCAG)

| Token | Giá trị | Dùng cho | Tương phản |
|---|---|---|---|
| `primary` | `#C9501A` | Nút chính, link, viền focus | chữ trắng 4.52:1 |
| `primaryPressed` | `#A84314` | Nút chính khi nhấn | chữ trắng 6.04:1 |
| `brand` | `#E86F25` | Icon, thanh tiến độ, trang trí | không dùng làm nền chữ |
| `primarySubtle` / `onPrimarySubtle` | `#FFF1E8` / `#9A3412` | Chip chọn, badge thương hiệu | 6.6:1 |
| `bg` | `#F6F7F9` | Nền màn hình | |
| `surface` | `#FFFFFF` | Card, sheet, header | |
| `surfaceMuted` | `#F1F5F9` | Nền input phụ, skeleton | |
| `border` / `borderStrong` | `#E4E7EC` / `#CBD5E1` | Viền card / viền input, nút phụ | |
| `text` | `#0F172A` | Chữ chính | |
| `textSecondary` | `#475569` | Chữ phụ | 7.58:1 trên trắng |
| `textTertiary` | `#64748B` | Placeholder, meta. **Chỉ đặt trên nền trắng** | 4.76:1 |
| `inverse` / `onInverse` | `#1E293B` / `#FFFFFF` | Khối tổng tiền, toast tối, chip đang chọn | 14.6:1 |
| `success` / `successSubtle` / `onSuccessSubtle` | `#15803D` / `#DCFCE7` / `#166534` | Đã thanh toán, thành công | 6.49:1 |
| `warning` / `warningSubtle` / `onWarningSubtle` | `#B45309` / `#FEF3C7` / `#92400E` | Chờ thanh toán, đếm ngược | |
| `danger` / `dangerSubtle` / `onDangerSubtle` | `#B91C1C` / `#FEE2E2` / `#991B1B` | Lỗi, huỷ, hết hạn | 6.8:1 |
| `info` / `infoSubtle` | `#1D4ED8` / `#DBEAFE` | Thông tin | 5.49:1 |
| `showcase.bg` | `#16233B` | Nền màn dự án/căn hộ | |
| `showcase.surface` | `#243556` | Card trên nền navy | |
| `showcase.accent` | `#F59E6B` | Giá, điểm nhấn trên navy | 7.46:1 |
| `showcase.paper` | `#F7F5F2` | Nền sáng ấm của khu nội dung màn trưng bày | |
| `showcase.textMuted` | `#CBD5E1` | Chữ phụ trên navy | 10.6:1 |

Màu trạng thái nghiệp vụ lấy từ `color_code` của dữ liệu. `StatusBadge` dùng lại `statusTextColorOf()` để tính màu chữ.

### 4.3 Typography – Be Vietnam Pro

| Kiểu | Cỡ/dòng · weight | Dùng cho |
|---|---|---|
| `display` | 28/36 · 700 | Số tiền lớn |
| `title` | 22/28 · 700 | Tên dự án/căn, tiêu đề khối lớn |
| `heading` | 17/24 · 600 | Tiêu đề header |
| `subhead` | 15/22 · 600 | Tiêu đề dòng/card |
| `body` | 15/22 · 400 | Nội dung mặc định |
| `caption` | 14/20 · 400 | Thông tin phụ (tăng từ 13/18 sau thử nghiệm 2026-09-30) |
| `label` | 12/16 · 600 | Nhãn section (in hoa, letterSpacing 0.4), label tab bar |

- React Native không chọn weight theo `fontWeight` với font tuỳ chỉnh → `typography.ts` ánh xạ weight sang tên font
  (`BeVietnamPro-SemiBold`, …). Component `Text` là nơi duy nhất đặt `fontFamily`.
- Số liệu: `fontVariant: ['tabular-nums']` qua prop `numeric` của `Text`.
- `maxFontSizeMultiplier = 1.3`.

### 4.4 Spacing, bo góc, đổ bóng, chuyển động

- **space (lưới 4pt):** `xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · x3 32 · x4 40`. Lề màn 16, padding card 16, khoảng cách card 12.
- **radius:** `sm 8` · `md 12` · `lg 16` · `xl 20` · `full 999`.
- **elevation:** card phẳng + viền (không bóng). `raised` (thanh hành động đáy), `overlay` (toast, bottom sheet), `modal`.
  Mỗi mức có giá trị iOS (`shadow*`), Android (`elevation`) và web (`boxShadow`).
- **motion:** nhấn 100ms (opacity 0.85 / scale 0.98), vào 200ms, ra 150ms, bottom sheet dùng spring. Tôn trọng
  `AccessibilityInfo.isReduceMotionEnabled` (bỏ animation, hiện ngay trạng thái cuối).
- **haptics:** chỉ khi tạo booking thành công, nhận thanh toán, và lỗi.
- **chạm:** tối thiểu 44×44; `hitSlop` 10 cho icon nhỏ; dùng `Pressable` thay `TouchableOpacity` ở màn đã migrate.

### 4.5 Quy tắc phản hồi (D7)

| Tình huống | Cách hiển thị |
|---|---|
| Thành công (sao chép, lưu, tạo) | Toast success, 3 giây |
| Lỗi không chặn (tải ảnh lỗi, mất mạng tạm thời) | Toast error, có nút hành động tuỳ chọn ("Thử lại") |
| Thông tin | Toast info |
| Lỗi validation form | Chữ đỏ ngay dưới ô nhập, không Alert |
| Xoá, huỷ booking, huỷ QR, tạo QR mới thay QR hết hạn | `confirm()` (Alert 2 nút, nút phá huỷ style `destructive`) |
| Lỗi chặn (hết phiên đăng nhập, thiếu quyền camera/ảnh, booking hết hạn giữ chỗ) | Alert, hoặc trạng thái ngay trên màn |
| Tải dữ liệu màn | Skeleton; lỗi → `ErrorState` + "Thử lại"; rỗng → `EmptyState` + CTA |

Toast hiện ở phía dưới, ngay trên `BottomActionBar` của màn đang xem (không có thanh thì trên safe-area đáy) – đổi sau thử nghiệm 2026-09-30 vì toast phía trên che tiêu đề header. Tối đa 1 toast cùng lúc (toast mới thay toast cũ).

### 4.6 Component chuẩn (`components/ui/`)

| Component | Props / hành vi chính |
|---|---|
| `Text` | `variant` (7 kiểu), `color` (token), `numeric`, `numberOfLines`. Nơi duy nhất đặt fontFamily. |
| `Screen` | SafeArea + nền `bg`; `scroll`, `refreshing`/`onRefresh`, `keyboardAware`, `tone: 'work' \| 'showcase'`. |
| `AppHeader` | `title`, `subtitle`, back mặc định (`router.back`, fallback về Home nếu không có lịch sử), `actions` (IconButton), `variant: 'light' \| 'dark' \| 'transparent'`. |
| `Button` | `variant: primary \| secondary \| ghost \| danger`, `size: md 44 \| lg 52`, `loading` (spinner + chặn bấm lặp), `disabled`, `icon`, `fullWidth`. |
| `IconButton` | 44×44, `icon`, `accessibilityLabel` **bắt buộc** (kiểu TypeScript). |
| `TextField` | `label` luôn ở trên, `helper`, `error`, `prefix`/`suffix`, `required` (dấu *). Viền focus `primary`, viền lỗi `danger`. |
| `MoneyField` | Như TextField, tự định dạng `50.000.000` khi gõ, trả về số. |
| `SelectField` | Hiển thị như ô nhập, bấm mở `BottomSheet` danh sách (có tìm kiếm khi > 8 mục). |
| `DateField` | Bọc `@react-native-community/datetimepicker` (`themeVariant="light"`). |
| `SearchBar` | Icon kính lúp, nút xoá, debounce 300ms. |
| `Card` | `padding`, `onPress` tuỳ chọn (có phản hồi nhấn), `tone`. |
| `ListItem` | `leading` (Avatar/icon), `title`, `subtitle`, `meta`, `trailing`, `chevron`, cao tối thiểu 64. `React.memo`. |
| `Avatar` | Chữ viết tắt trên nền `primarySubtle`, hoặc ảnh. |
| `SectionHeader` | `title` (kiểu label), `action` (link "Xem tất cả"). |
| `KeyValueRow` | `label`, `value`, `copyable` (chạm để sao chép + toast). |
| `MoneyText` | Định dạng qua `lib/format.ts`, `short` → "3,48 tỷ". |
| `Badge` | `tone: neutral \| brand \| success \| warning \| danger \| info`. |
| `StatusBadge` | `color` (color_code dữ liệu), `label`; màu chữ từ `statusTextColorOf()`. |
| `Chip` | `selected`, `count`, dùng cho bộ lọc ngang. |
| `BottomActionBar` | Cố định đáy, tính safe-area, bóng `raised`, chứa 1–2 Button. |
| `BottomSheet` | Dựa trên RN `Modal` + `Animated`; thanh kéo, chạm nền để đóng, `title`. Không thêm thư viện. |
| `Toast` / `ToastProvider` / `useToast()` | `show({ type, message, action? })`. |
| `confirm()` | `confirm({ title, message, confirmText, destructive }) → Promise<boolean>`, bọc `Alert.alert`. |
| `Skeleton` | Khối nhấp nháy (tắt khi reduce motion); preset `SkeletonList`, `SkeletonDetail`. |
| `EmptyState` | `icon`, `title`, `description`, `action`. |
| `ErrorState` | `title`, `description`, `onRetry`. |
| `ProgressSteps` | `steps: string[]`, `current: number`. |
| `CountdownPill` | `expiresAt`; vàng, chuyển đỏ khi < 3 phút, "Đã hết hạn" khi về 0; gọi `onExpire`. |

Icon: chỉ dùng `lucide-react-native`, không emoji. Icon trang trí đặt `accessibilityElementsHidden`/`importantForAccessibility="no"`.

### 4.7 Chế độ trưng bày (màn dự án/căn hộ)

Áp dụng cho `projects`, `project/[id]`, `product/[id]`, `products` (khi xem theo dự án), `BlockGrid`, `price-calculator`, `diagram`.
Ảnh lớn ở đầu màn (tỉ lệ cố định, có placeholder khi đang tải), header trong suốt đè lên ảnh rồi chuyển nền
`showcase.bg` khi cuộn, giá dùng `showcase.accent`, nút chính vẫn `primary #C9501A`.

## 5. Luồng Booking → Thanh toán QR

### 5.1 Luồng mới

```
product/[id] hoặc locked/[id]
  → ① booking/create
  → (thành công) haptic + toast + router.replace('/booking/{id}')
  → ② booking/[id]
  → ③ booking/qr-payment
  → ④ kết quả trên chính màn QR → quay về ②
```

`BookingService.createBooking` đã trả về `id` (`{ status: 2000, id, soPhieu, maPGC }`) → không cần đổi backend.
Nếu thiếu `id` (dự phòng), điều hướng tới `/bookings` và hiện toast.

### 5.2 ① Tạo booking (`app/booking/create.tsx`)

- Một màn duy nhất. Card căn hộ ghim trên cùng (ảnh, ký hiệu, dự án, giá rút gọn).
- **Khách hàng:** `SearchBar` (tên, SĐT, mã KH), danh sách dạng radio; ô tìm kiếm rỗng → hiện danh sách tải sẵn như hiện tại.
  "Thêm khách hàng mới" → `customer/new`, quay lại với KH mới đã được chọn (giữ cơ chế param `newCustomer`).
- **Sàn giao dịch:** `SelectField` (bottom sheet), tự chọn như logic hiện tại.
- Tiền giữ chỗ hiển thị ngay trên `BottomActionBar`; nút "Tạo booking" có `loading`.
- Validation (chưa chọn KH, KH thiếu mã) hiện dưới mục Khách hàng, không Alert.
- Thất bại → toast lỗi, giữ nguyên lựa chọn.

### 5.3 ② Chi tiết booking (`app/booking/[id].tsx`)

Thứ tự: `CountdownPill` (khi chưa thu tiền và còn hạn) → khối "Tiền booking cần thu" (nền `inverse`) → card Tiến độ
(`ProgressSteps` + `StatusBadge`) → thông tin KH/sàn (`KeyValueRow`) → các mục thu gọn được: giá theo bảng giá, quà tặng, chứng từ.

**Tiến độ 4 bước** suy ra từ dữ liệu, không từ tên trạng thái catalog:

Dữ liệu dùng (đã có trong `BookingService.getBookingEditDetail`, không gọi thêm API): `giaiDoan`
(`GIUCHO` → `DATCOC` → `HDMB`, của phiếu giữ chỗ), `daThu`, `tienGiuCho`, `state` (`PENDING` / `APPROVED` / `CANCELLED`), `hetHanLuc`.

| Bước | Điều kiện hoàn thành |
|---|---|
| Giữ chỗ | Luôn hoàn thành khi booking tồn tại |
| Đã thu tiền | `tienGiuCho > 0 && daThu >= tienGiuCho`, hoặc `giaiDoan` là `DATCOC`/`HDMB` |
| Đặt cọc | `giaiDoan` là `DATCOC` hoặc `HDMB` |
| Hợp đồng | `giaiDoan === 'HDMB'` |

`state === 'CANCELLED'` → `ProgressSteps` hiển thị mờ (trạng thái `cancelled`), không có bước hiện tại.
Tên và màu trạng thái hiển thị riêng bằng `StatusBadge` từ catalog `pgc_trang_thai` như hiện tại.
Logic viết thành hàm thuần `lib/bookingProgress.ts` → `{ current: 0..3, paid: boolean, cancelled: boolean, expired: boolean }`, có test.

**`BottomActionBar` theo trạng thái:**

| Trạng thái | Nút |
|---|---|
| `isActiveBooking` (điều kiện hiện có trong màn, giữ nguyên) và chưa thu đủ tiền | [Chứng từ] [**Thu tiền QR**] |
| Còn lại (đã thu, đã duyệt, huỷ, hết hạn, đã sang cọc/HĐ) | [Chứng từ] |

(Chưa có màn tạo đặt cọc trong app nên không có nút "Tạo đặt cọc".)

Tải chứng từ: `BottomSheet` "Chụp ảnh / Chọn từ thư viện" thay Alert 3 nút. Ảnh có skeleton khi tải, lỗi từng ảnh có nút thử lại.
Tải lại dữ liệu bằng `useFocusEffect` (giữ như hiện tại) để quay về từ QR thấy trạng thái mới.

### 5.4 ③ Thanh toán QR (`app/booking/qr-payment.tsx`)

- `CountdownPill` trên cùng; số tiền lớn (`display`).
- **Chưa có QR:** nút lớn **"Tạo mã QR"** (`Button primary lg fullWidth`) nằm giữa khối QR, mô tả ngắn phía dưới. Không tự tạo.
- **Có QR cũ đã hết hạn:** bấm "Tạo mã QR mới" → `confirm({ title: 'Tạo mã QR mới?', message: 'Mã QR cũ đã hết hạn và sẽ bị thay thế.' })` → mới gọi tạo.
- **Có QR còn hạn:** hiện QR + chỉ báo "Đang chờ tiền về · tự cập nhật" (thể hiện polling 5 giây đang có).
- Thông tin tài khoản: `KeyValueRow copyable` cho số TK và nội dung chuyển khoản.
- `BottomActionBar`: [Lưu QR] [**Gửi QR cho khách**] (share sheet).
- "Huỷ mã QR để tạo lại" chuyển vào menu ⋯ của header, qua `confirm(destructive)`.
- Giữ nguyên toàn bộ logic gọi `PaymentGatewayService`, polling, xử lý hết hạn.

### 5.5 ④ Kết quả (trên màn QR)

- **Đã thu:** icon check xanh, "Đã nhận {số tiền}", thời điểm; haptic success; nút [Xem chi tiết booking] (`router.back()`).
- **Hết hạn giữ chỗ:** icon cảnh báo đỏ, giải thích ngắn, nút [Về chi tiết booking].
- Không dùng Alert cho hai trạng thái này.

### 5.6 Màn bị xoá

- `app/booking/payment-method.tsx`, `app/payment/[id].tsx`: xoá file; kiểm tra không còn tham chiếu (route, `Stack.Screen`, import).
  `mocks/bookings.ts` chỉ xoá nếu không còn nơi nào import.

## 6. Quy tắc chung cho màn danh sách

Áp dụng khi migrate `bookings`, `customers`, `deposits`, `contracts`, `locked-units`, `projects`, `products`, `reports/*`, `appointments`, `notifications`:

- 4 trạng thái: skeleton → dữ liệu / rỗng (có CTA) / lỗi (có thử lại).
- `FlatList` + `ListItem` memo, pull-to-refresh, tải thêm khi cuộn (nếu service hỗ trợ phân trang).
- Lọc: hàng `Chip` ngang có số đếm + `BottomSheet` cho bộ lọc nâng cao (`FilterPanel` hiện có được dựng lại bằng component mới, giữ nguyên API props).
- `SearchBar` cố định trên đầu danh sách, debounce 300ms.
- Mọi tiền/ngày/SĐT định dạng qua `lib/format.ts`.

## 7. Kế hoạch triển khai theo giai đoạn

Mỗi giai đoạn = 1 commit local trên `devhuan2` (có thể nhiều commit nhỏ trong lúc làm, nhưng mỗi giai đoạn kết thúc
bằng một commit tổng kết có message `feat(ui): phase N – …` để dễ quay lại).

| GĐ | Phạm vi |
|---|---|
| 0 · Nền tảng | `theme/`, `lib/format.ts`, font TTF + `useFonts` trong `app/_layout.tsx`, toàn bộ `components/ui/`, `ToastProvider`, `confirm()`, shim `constants/colors.ts`, lint chặn hex, màn `app/dev/ui-gallery.tsx` (chỉ `__DEV__`), `StatusBar` tối + `DateTimePicker` sáng. |
| 1 · Booking & thanh toán | `bookings`, `booking/create`, `booking/[id]`, `booking/qr-payment`, CTA trên `product/[id]` và `locked/[id]`, `lib/bookingProgress.ts`, xoá `booking/payment-method` và `payment/[id]`. |
| 2 · Điều hướng & Home | tab bar, `(tabs)/home`, `all-management`, `manage-features`, `(tabs)/account`, `profile`, `notifications`, dùng `AppHeader` toàn app. |
| 3 · Sản phẩm & dự án | `projects`, `project/[id]`, `products`, `product/[id]`, `product/BlockGrid`, `price-calculator/[id]`, `diagram/[mada]`, `locked-units`, `locked/[id]`. |
| 4 · Khách hàng | `customers`, `customer/new`, `customer/[id]`, `customer/[id]/edit`, `customer/[id]/contracts`, `contacts`. |
| 5 · Cọc, HĐ, báo cáo, lịch hẹn | `deposits`, `deposit/[id]`, `contracts`, `contract/[id]`, `reports/*` (5 màn), `appointments`, `components/ReportFilterBar`, `components/PriceStatusTable`. |
| 6 · Auth, media, dọn dẹp | 5 màn auth, tài liệu/ảnh/video, xoá shim `constants/colors.ts`, rà Alert cuối, rà trợ năng, `userInterfaceStyle: "light"` trong `app.json`. |

Ngoài đợt này: `receipts`, `receipt/[id]`, `chat/*`, `handovers`, `handover/[id]`, `(tabs)/ai-chat` (dữ liệu mock).

## 8. Kiểm thử và tiêu chí hoàn thành mỗi giai đoạn

- **Tự động:** `npx tsc --noEmit` và `npx expo lint` sạch cho file đã migrate; `node --test tests/` pass.
  Test mới (`node:test`, cùng kiểu `tests/*.test.cjs`): `lib/format.ts`, `lib/bookingProgress.ts`, logic đếm ngược.
- **Thủ công (người dùng tự chạy trên máy thật):** iPhone nhỏ 375pt và Android 360dp, cỡ chữ hệ thống lớn;
  mỗi màn kiểm 4 trạng thái (loading, rỗng, lỗi khi bật chế độ máy bay, có dữ liệu).
- **Giai đoạn 1 thêm:** tạo booking → vào thẳng chi tiết → tạo QR → chuyển khoản thử → màn chuyển "Đã nhận" → chi tiết
  cập nhật tiến độ; trường hợp QR cũ hết hạn (có hỏi xác nhận); trường hợp hết hạn giữ chỗ.
- Mỗi commit giai đoạn kèm danh sách màn đã đổi để người dùng tự kiểm.

## 9. Rủi ro

| Rủi ro | Cách xử lý |
|---|---|
| Màn 1.000+ dòng dễ vỡ khi migrate | Tách sub-component trong cùng thư mục màn; không đổi logic nghiệp vụ và lời gọi service. |
| Màu trạng thái từ dữ liệu không đủ tương phản | `StatusBadge` giữ `statusTextColorOf()`. |
| Font tuỳ chỉnh chưa nạp xong khi mở app | Giữ splash đến khi `useFonts` xong (splash đã `preventAutoHideAsync`), có timeout dự phòng dùng font hệ thống. |
| Đổi `userInterfaceStyle` cần build native | Làm ở GĐ6; trước đó ép `StatusBar` và `DateTimePicker` sáng bằng JS. |
| Nhân viên bỡ ngỡ với luồng mới | Người dùng tự viết ghi chú thay đổi khi phát hành (ngoài phạm vi code). |

# Booking và thu tiền QR

## Màn

| Màn | File |
|---|---|
| Danh sách booking (`fn_nv_app_booking_list` = `fn_booking_list`; tìm, lọc dự án, phân trang). **Chỉ 3 trạng thái booking** (người dùng chốt 2026-10-16, nội bộ + đại lý): tab Tất cả · Chờ duyệt · Đã duyệt · Huỷ booking lọc ở máy chủ (`p_states`), số trên tab = tổng máy chủ theo bộ lọc; nhãn thẻ / chi tiết / Booking gần đây ở trang chủ theo `cloud_bookings.state` (`lib/bookingState.ts`: rỗng/PENDING ⇒ Chờ duyệt cam, APPROVED ⇒ Đã duyệt xanh, còn lại – hết hạn, huỷ, từ chối, chờ hoàn – ⇒ Huỷ booking xám, như cột "Trạng thái booking" web). Bộ lọc bỏ mục trạng thái vòng đời phiếu. Kiểu bo tròn: header/ô tìm/chip `soft`, mỗi booking là card riêng bo `radius.xxl`, avatar tròn, trạng thái trên – tiền dưới | `app/bookings.tsx` |
| Tạo booking – luồng app (từ căn / phiếu lock; chọn khách, "+ Thêm mới" sang màn tạo khách rồi quay về; lưu xong vào thẳng chi tiết để thu tiền), logic = form web (mục dưới). Kiểu bo tròn: header `soft`, căn đang book là card navy (số phiếu, tổng giá HĐ, thời gian / tiền giữ chỗ); khách trong khung trắng bo `radius.xxl` cuộn bên trong; khối Thông tin phiếu (Công ty bán hàng, Đại lý phân phối), Chính sách & cấu hình bán hàng (Quỹ căn khoá, Chính sách, Bảng giá), Giá theo bảng giá; nút dạng viên | `app/booking/create.tsx`, `components/booking/useWebBooking.ts` |
| Chi tiết booking (tiến độ 4 bước, giá, quà, ảnh chứng từ, đếm ngược giữ chỗ). Kiểu bo tròn: header `soft`, lề 20, khối tiền navy bo `radius.x3`, card + `CollapsibleSection` bo `radius.xxl` bóng nhẹ, nút dưới dạng viên | `app/booking/[id].tsx` + `components/booking/*` |
| Thu tiền QR (VA ngân hàng) | `app/booking/qr-payment.tsx` + `components/booking/QrResult.tsx` |

Mở tạo booking từ: chi tiết căn (`product/[id]`, căn Mở bán) hoặc chi tiết lock (`locked/[id]`, còn hạn, kèm `LockId`).
Param `dataBooking` = JSON sản phẩm (`normalizeProduct`). Tạo xong → `router.replace('/booking/[id]')`.

## Luồng tạo booking – logic form web chép (`lib/web` `BookingFormDialog` ⇒ `useWebBookingForm`)

- `useWebBooking`: đọc lại căn đầy đủ theo uuid (`getBdsProductById`), giữ `LockId` khi đi từ phiếu lock; toast của module web ⇒ toast app.
- Form web: số phiếu xem trước theo quy tắc đánh mã (`fn_nv_app_ma_phieu`, chỉ đọc – máy chủ cấp số khi lưu), khách
  (`fn_customer_picker`, ≥ 2 ký tự), Công ty bán hàng (bắt buộc theo tài khoản) → Đại lý phân phối lọc theo CTBH, Quỹ căn (khoá),
  Chính sách trước bảng giá (lọc theo quỹ / tòa / hạn), Bảng giá theo chính sách, giá căn theo bảng giá (`fn_nv_app_gia_can_bang_gia`),
  tiền + thời gian giữ chỗ theo chính sách / cài đặt bán hàng. Tên hàm web → endpoint app qua `RPC_MAP` (`docs/data-access.md`).
- Lưu = `handleSubmit` web → shim `addBookingAPI` (`lib/web/_shims/services/Product.ts`) → **`fn_nv_app_booking_tao`** (bọc
  `usp_booking_create`): máy chủ điền công ty / người nhập / ngày, tiền + hạn giữ chỗ theo thứ tự web (chính sách > cài đặt) dù
  app gửi số sai; chỉ nhận căn mã 2, hoặc 18 có phiếu lock còn hạn; căn → 11, khép lock. Lỗi → lời máy chủ, không ghi gì.
  Xong → `router.replace('/booking/[id]')`.
- Tạo khách mới: `customer/new?returnToBooking=1` → lưu xong `router.dismissTo('/booking/create', { newCustomer })` → chọn sẵn
  như web `handleCustomerSaved`.
- **Khác web có chủ đích:** ô CTBH trước Đại lý; căn chưa có tổng giá HĐ ⇒ hiển thị giá trị HĐ theo bảng giá (lưu không đổi);
  không có sửa booking; không chạy quy trình bán hàng sau booking (`triggerSalesProcess`).

## Tài khoản đại lý

- Đại lý phân phối = sàn của tài khoản, ô **khoá** (`agencyLocked`, hook web `useAgencySan`) – như web `BookingFormDialog`.
- Ô chọn khách: máy chủ chỉ trả khách trong phạm vi của sàn.
- Chi tiết booking của app chỉ có Thu tiền QR và chứng từ – tập con của menu đại lý web; không có duyệt / xoá nên không thừa quyền.

## Chi tiết booking

- Dữ liệu: `BookingService.getBookingEditDetail` → **1 lời gọi** `fn_nv_app_booking_chi_tiet` (phạm vi + che trường khách =
  `fn_sales_doc_get` web; kèm phiếu giữ chỗ, căn + giá, sàn, chính sách, bảng giá, lịch TT, cài đặt, `quyen.payment_qr`,
  `doi_can_cho_duyet`). Lỗi ⇒ màn báo lỗi tải.
- Tiến độ 4 bước: `lib/bookingProgress.ts` (Giữ chỗ → Đã thu tiền → Đặt cọc → Hợp đồng), đếm ngược `lib/countdown.ts`.
- Ảnh chứng từ: `uploadBookingImage` (`fn_nv_app_tai_tep`, thư mục `booking`) → `addBookingImages`
  (`fn_nv_app_booking_chung_tu_them`); đọc `getListImageGC` (`fn_nv_app_booking_chung_tu_list`).
  - Bẫy HEIC (iOS): `expo-image-picker` mặc định (`preferredAssetRepresentationMode: current`) giữ nguyên HEIC
    kể cả khi `quality < 1` → ảnh lưu dạng `.heic` không hiển thị (ô ↻). Chọn thư viện phải dùng `Compatible`
    để iOS chuyển sang JPEG. Ảnh HEIC đã lưu trước bản sửa vẫn lỗi hiển thị.

## Thu tiền QR (`services/PaymentGatewayService.ts` → `fn_nv_app_cong_thanh_toan { p_action }`, lõi chung web)

Máy chủ bọc `PaymentGatewayEdgeService` của web ⇒ VA tạo ở app hay web là một. Lỗi ⇒ HTTP 400 kèm lời máy chủ.

0. Nút "Thu tiền QR" chỉ hiện khi booking chờ duyệt, còn hạn, chưa thu **và** có quyền `PAYMENT_QR` của màn Booking
   (`quyen.payment_qr`) **và** không đang chờ duyệt đổi căn – như web (user chốt 2026-11-16). Màn QR khoá tạo + báo lý do.
1. Số tiền cần thu: `BookingService.resolveBookingAmount(projectId, ngày booking)` = `tien_booking` của cài đặt bán hàng
   (`fn_nv_app_cai_dat_ban_hang` = `fn_sales_setting_resolve`).
2. Tài khoản cấu hình: `p_action: accounts` (theo dự án) → tạo VA: `create` (`module: BOOKING`, `expires_at` = hạn giữ chỗ).
3. Kiểm tra đã thu: `list` theo phiếu giữ chỗ mỗi 5 giây (`paid_amount > 0` → đã nhận).
4. VA hết hạn: `expire_sweep`; xoá VA: `delete`.
- Trạng thái màn: `lib/qrPaymentState.getQrScreenState` (loading/error/paid/noDeadline/expired/mismatch/active/needsNewQr/needsQr)
  – có test. `mismatch` = số tiền VA khác số tiền cần thu → yêu cầu tạo QR mới.
- Màn QR đặt cọc dùng chung `getQrScreenState` với `requiresDeadline: false` – xem `docs/deposits-contracts.md`.

## Bẫy đã gặp

- `SanPhamId` phải đọc `ID` của sản phẩm (bản cũ đọc `id` → luôn null).
- Camera iOS sau BottomSheet: phải chờ `onClosed` (Modal `onDismiss`) rồi mới mở camera.

## Tồn đọng / chưa kiểm chứng

- **Số tiền QR** lấy từ cài đặt bán hàng, còn tiền giữ chỗ khi tạo booking ưu tiên chính sách → có thể lệch khi chính sách
  khai báo tiền booking riêng. Chưa đối chiếu web.
- Prod chưa có VA nào ⇒ chưa thử `create` / `delete` VA thật qua endpoint app.
- Booking căn mã 11 (ưu tiên): chờ nghiệp vụ, xem `docs/products-lock.md`.

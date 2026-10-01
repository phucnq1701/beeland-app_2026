# Booking và thu tiền QR

## Màn

| Màn | File |
|---|---|
| Danh sách booking (tìm, lọc dự án/trạng thái, phân trang). Kiểu bo tròn: header/ô tìm/chip `soft`, mỗi booking là card riêng bo `radius.xxl`, avatar tròn, trạng thái trên – tiền dưới | `app/bookings.tsx` |
| Tạo booking (chọn khách, sàn; tạo khách mới). Kiểu bo tròn: header `soft`, căn đang book là card navy, ô tìm `soft`, mỗi khách là card bo `radius.xxl` (chọn: viền + nền cam nhạt, viền luôn dày 2 để không nhảy), chọn sàn `SelectField raised`, nút dạng viên | `app/booking/create.tsx` |
| Chi tiết booking (tiến độ 4 bước, giá, quà, ảnh chứng từ, đếm ngược giữ chỗ). Kiểu bo tròn: header `soft`, lề 20, khối tiền navy bo `radius.x3`, card + `CollapsibleSection` bo `radius.xxl` bóng nhẹ, nút dưới dạng viên | `app/booking/[id].tsx` + `components/booking/*` |
| Thu tiền QR (VA ngân hàng) | `app/booking/qr-payment.tsx` + `components/booking/QrResult.tsx` |

Mở tạo booking từ: chi tiết căn (`product/[id]`, căn Mở bán) hoặc chi tiết lock (`locked/[id]`, còn hạn, kèm `LockId`).
Param `dataBooking` = JSON sản phẩm (`normalizeProduct`). Tạo xong → `router.replace('/booking/[id]')`.

## Luồng tạo booking

1. Mở màn: `BookingService.getBookingSalesConfig(product)` (như web `BookingFormDialog` + `useSalesConfigOptions`):
   loại BĐS `lib/bookingPrice.isLowRiseProduct` → `fn_get_current_price_lists` (p_type "Chung cư"/"Thấp tầng") → bảng giá
   **priority nhỏ nhất** (`sortPriceLists`) → chính sách `fn_get_sales_policies` (theo `sales_policy_id` của bảng giá) →
   dòng giá `fn_get_price_list_item_by_product` → `mapPriceListItem`. Không có/lỗi → null (dùng giá sản phẩm).
2. Bấm Tạo: `lib/bookingPayload.buildBookingPayload(product, customer, san, sales)` – mỗi khoản giá lấy bảng giá,
   rỗng/0 thì giá sản phẩm (`pickPrice`, web `pick`); kèm `MaDotGia/MaCS/MaCSTong/MaTDTT`, `TienGiuCho` = tiền booking của
   chính sách (`policyBookingAmount`), `SanPhamId` = `ID`, `LockId`.
3. `BookingService.createBooking`: đổi mã KH → uuid (`cloud_customers.ma_so_kh`), tiền giữ chỗ = chính sách, không có thì
   cài đặt bán hàng (`tien_booking`, trống thì `tien_dat_coc`; `pickSalesSetting`), hạn = `thoi_gian_booking` phút →
   RPC **`fn_booking_create`** (`p_payload` như web `Product.addBookingAPI`). Máy chủ: chỉ nhận căn mã 2, hoặc 18 có phiếu
   lock còn hạn; ghi phiếu giữ chỗ + booking, căn → 11, giải phóng lock. Lỗi → trả nguyên lời báo máy chủ, không ghi gì.
4. Tạo khách mới từ màn này: `customer/new?returnToBooking=1` → lưu xong `router.dismissTo('/booking/create', { newCustomer })`
   → `create.tsx` chuẩn hoá bằng `normalizeCustomer` và chọn sẵn.

## Chi tiết booking

- Dữ liệu: `BookingService.getBookingEditDetail` (booking + phiếu giữ chỗ + giá `price_list_items` + quà + cài đặt).
- Tiến độ 4 bước: `lib/bookingProgress.ts` (Giữ chỗ → Đã thu tiền → Đặt cọc → Hợp đồng), đếm ngược `lib/countdown.ts`.
- Ảnh chứng từ: `uploadBookingImage` (edge function `upload-file`) → `addBookingImages`; đọc `getListImageGC`.

## Thu tiền QR (`sevicesSupabase/PaymentGatewayService.ts` → edge function `payment-gateway`, dùng chung với web)

1. Số tiền cần thu: `BookingService.resolveBookingAmount(projectId, ngày booking)` = `cloud_sales_settings.tien_booking`.
2. Tài khoản cấu hình: action `accounts` (theo dự án) → tạo VA: action `create` (`module: BOOKING`, `expires_at` = hạn giữ chỗ).
3. Kiểm tra đã thu: action `list` theo phiếu giữ chỗ mỗi 5 giây (`paid_amount > 0` → đã nhận).
4. VA hết hạn: action `expire_sweep`; xoá VA: action `delete`.
- Trạng thái màn: `lib/qrPaymentState.getQrScreenState` (loading/error/paid/noDeadline/expired/mismatch/active/needsNewQr/needsQr)
  – có test. `mismatch` = số tiền VA khác số tiền cần thu → yêu cầu tạo QR mới.

## Bẫy đã gặp

- `SanPhamId` phải đọc `ID` của sản phẩm (bản cũ đọc `id` → luôn null → tra theo `ma_sp`).
- Booking phải qua `fn_booking_create` (bản cũ tự insert rồi mới gọi RPC đổi trạng thái → vẫn tạo booking khi bị từ chối).
- Gửi đủ `DonGiaChuaVAT`, `TongGiaChuaVAT`, `TienVAT` như web.
- Camera iOS sau BottomSheet: phải chờ `onClosed` (Modal `onDismiss`) rồi mới mở camera.

## Tồn đọng / chưa kiểm chứng

- **Số tiền QR** lấy từ cài đặt bán hàng, còn tiền giữ chỗ khi tạo booking ưu tiên chính sách → có thể lệch khi chính sách
  khai báo tiền booking riêng. Chưa đối chiếu web.
- Kết quả trả về của các hàm bảng giá chỉ có trên server – **chưa kiểm chứng** với dữ liệu thật.
- Booking căn mã 11 (ưu tiên): chờ nghiệp vụ, xem `docs/products-lock.md`.

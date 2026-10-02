# Dự án, sản phẩm, trạng thái căn, lock căn

## Màn

| Màn | File |
|---|---|
| Danh sách dự án / chi tiết (trưng bày navy; card danh sách cùng kiểu carousel trang chủ: ảnh tràn + `showcase.scrim`, bo `radius.x3`; chi tiết: tên dự án đè trên ảnh, khối nội dung bo góc trên trồi lên ảnh, nút quay lại `IconButton variant="glass"`, mỗi chức năng là card riêng) | `app/projects.tsx`, `app/project/[id].tsx` |
| Sản phẩm: 3 chế độ Danh sách / Lưới / Tổng quan, bộ lọc, realtime. Giao diện kiểu bo tròn: header/ô tìm/thanh chế độ `soft`, mỗi sản phẩm là card riêng (`ProductListItem`, không icon); nút Bộ lọc + khung lọc (`FilterPanel`, dùng chung booking/lock căn/chứng từ) dạng viên thuốc, bóng nhẹ | `app/products.tsx` + `components/product/*`, `components/FilterPanel.tsx` |
| Chi tiết sản phẩm: ảnh cao 340, khối nội dung bo góc trên trồi đè lên ảnh (`ImageCarousel bottomInset` đẩy chấm/bộ đếm lên), ký hiệu căn + giá (màu `primary`) trên nền sáng, trạng thái là `StatusBadge` cạnh tên dự án (nền `ColorTT` = `color_code` trạng thái, cùng màu ô ngoài lưới; đã bỏ card "Thông tin căn"), card bo `radius.xxl` + `elevation.soft`, nút quay lại `glass`, nút Lock/Tạo booking dạng viên | `app/product/[id].tsx`, `components/product/PriceBreakdown.tsx` |
| Chi tiết căn (giá, Lock căn, Tạo booking) | `app/product/[id].tsx` + `components/product/PriceBreakdown.tsx`, `ImageCarousel.tsx` |
| Căn đã lock / chi tiết lock (đếm ngược, Tạo booking). Danh sách kiểu bo tròn: header/ô tìm/chip `soft`, card bo `radius.xxl` + bóng nhẹ, icon tròn nền theo trạng thái; hết hạn chỉ hiện badge (không lặp chữ "Hết hạn"), chân card: giờ lock + nút ›. Chi tiết lock cùng kiểu chi tiết sản phẩm (ảnh + khối nội dung trồi lên, ô đếm ngược/hết hạn dạng viên) | `app/locked-units.tsx`, `app/locked/[id].tsx` |
| Sơ đồ phân lô (WebView) | `app/diagram/[mada].tsx` |

## Dữ liệu

| Việc | Service | Nguồn |
|---|---|---|
| Dự án | `ProjectService.getProjects` | `da_projects` (MaDA = `ma_da_code`, thiếu thì uuid) |
| Sản phẩm, chi tiết, ảnh | `ProductService.getProducts / getDetailProducts / getBannerProduct` → `normalizeProduct` | `bds_products` |
| Danh mục trạng thái căn | `FilterService.getStatusSP` | `cloud_catalogs` `bds_trang_thai`, `ma_ctdk=global` (MaTT = uuid, `_raw.item_code` = mã số) |
| Lưới khu/tầng/vị trí | `PriceServices.getBlock` | `bds_products` + `cloud_catalogs` |
| Giá theo bảng giá (chi tiết căn) | `PriceServices.getActivePriceForProduct` | RPC `get_active_price_for_product` |
| Realtime | SignalR `https://api-beeland.beesky.vn/signalr-beeland`, sự kiện `ChangeTable` (`app/products.tsx`) | cập nhật ô bằng `lib/productRealtime.applyRealtimeChange` |

## Quy tắc trạng thái căn (web là chuẩn – có test `tests/product-status.test.cjs`, `product-realtime.test.cjs`)

- **Nhóm hiển thị** = chép nguyên `mapStatus` của `../beeland/src/pages/Products/FloorPlanOverview.tsx`:
  `lib/productStatus.webUnitStatus` – luật tên (chữ thường): "đã bán/đã ký/hợp đồng" → Đã bán; "giữ chỗ/booking/đặt cọc/cọc"
  → Giữ chỗ; "khóa/ngừng/bảo trì" → Khóa; "mở bán/sẵn/trống" → Mở bán; không khớp → switch `MaTT` (2 Mở bán, 3 Giữ chỗ,
  4/5 Đã bán, còn lại Khóa). Hệ quả như web: HĐMB, Bàn giao… hiện **Khóa**; nhóm Đã bán gần như luôn 0 (spec 0.2 #2).
- Tên dùng để xét: tên trên căn, thiếu thì tên danh mục (`lib/productRealtime.unitStatusOf`). Màu ô: `MauNen`/`ColorTT` của dữ liệu.
- **Được Lock / Booking:** `isOpenForSale` (web `src/utils/productSaleStatus.ts`) – chỉ mã **2** hoặc tên "Mở bán".
  Chi tiết căn tính `canTransact` theo mã số nếu có, không thì theo tên.
- Booking căn **"Booking chờ duyệt" (11)**: web bật nút nhưng máy chủ từ chối → app **tắt** (spec 0.2 #1, chờ nghiệp vụ).
- Mã trạng thái (web `ProductTransactionStatus.ts`): 2 Mở bán · 11 Booking chờ duyệt · 18 Đã Lock · bảng đầy đủ ở spec mục 0.1.

## Luồng lock căn (`BookingService`)

1. `createLock({ maSP, kyHieu, maDA, minutes? })`: tra `bds_products` → thời gian lock = `minutes` > 0, không thì
   `cloud_sales_settings.thoi_gian_lock` (dòng dự án ưu tiên dòng chung, trong khoảng ngày, `ap_dung`), mặc định 30 phút.
2. Số phiếu `KyHieu/YYYY/MM/STT`, STT = số phiếu LOCK trong tháng **theo giờ VN** (`lockVoucherMonth`) + 1.
3. RPC `fn_product_transaction` (`LOCK_CREATE`, cần mã 2 → 18). **Lỗi → dừng, không tạo phiếu**, trả lời báo của máy chủ.
4. Insert `cloud_bookings` (`loai_ct=LOCK`, `state=LOCKED`, `het_han_luc`).
- Huỷ: `releaseLock` → state RELEASED/EXPIRED + `fn_product_transaction` `LOCK_RELEASE` (18 → 2).
- Hết hạn: `sweepExpiredLocks` (gọi khi mở màn / đếm ngược về 0) chỉ đổi phiếu sang EXPIRED.
- Màn chi tiết căn/lock: chặn bấm lặp bằng ref; đếm ngược về 0 → sweep đúng một lần rồi tải lại.

## Bẫy đã gặp

- Cột diện tích tim tường là **`dt_tim_tuong`** (app từng đọc `dt_tim_duong` không tồn tại → luôn trống). Field app: `DTTimDuong`.
- uuid sản phẩm nằm ở **`ID`** của `normalizeProduct`, không phải `id`.
- Số phiếu lock phải đếm tháng theo giờ VN (đếm theo UTC từng trùng số 7 giờ đầu tháng → unique lỗi sau khi căn đã sang 18).
- `fn_product_transaction` lỗi phải dừng cả luồng (bản cũ vẫn tạo phiếu khi bị từ chối).

## Tồn đọng / chưa kiểm chứng

- Web hết hạn lock còn gọi `LOCK_RELEASE` trả căn về Mở bán (`ProductLockService.closeLockRow`) + tác vụ nền
  `expire_product_locks` (5 phút). App sweep **chỉ đổi phiếu** → căn có thể còn "Đã Lock" tới khi tác vụ nền chạy. Lệch web, chưa sửa.
- SignalR: web `useSignalR` **JoinGroup** theo `tenCTDKVT + maNV`; app không join group → app có nhận `ChangeTable` hay không **chưa kiểm chứng**.
- Booking căn mã 11 chờ quyết định nghiệp vụ (cần sửa server trước).

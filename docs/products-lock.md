# Dự án, sản phẩm, trạng thái căn, lock căn

## Màn

| Màn | File |
|---|---|
| Danh sách dự án / chi tiết (trưng bày navy; ảnh đầu trang chi tiết cao 213 + status bar; card danh sách cùng kiểu carousel trang chủ: ảnh tràn + `showcase.scrim`, bo `radius.x3`; chi tiết: tên dự án đè trên ảnh, khối nội dung bo góc trên trồi lên ảnh, nút quay lại `IconButton variant="glass"`, mỗi chức năng là card riêng) | `app/projects.tsx`, `app/project/[id].tsx` |
| Sản phẩm: 3 chế độ Danh sách / Lưới / Tổng quan, bộ lọc, realtime. Giao diện kiểu bo tròn: header/ô tìm/thanh chế độ `soft`, mỗi sản phẩm là card riêng (`ProductListItem`, không icon); nút Bộ lọc + khung lọc (`FilterPanel`, dùng chung booking/lock căn/chứng từ) dạng viên thuốc, bóng nhẹ | `app/products.tsx` + `components/product/*`, `components/FilterPanel.tsx` |
| Chi tiết sản phẩm: ảnh cao 227 (+ status bar), khối nội dung bo góc trên trồi đè lên ảnh (`ImageCarousel bottomInset` đẩy chấm/bộ đếm lên), ký hiệu căn + giá (màu `primary`) trên nền sáng, trạng thái là `StatusBadge` cạnh tên dự án (nền `ColorTT` = `color_code` trạng thái, cùng màu ô ngoài lưới; đã bỏ card "Thông tin căn"), card bo `radius.xxl` + `elevation.soft`, nút quay lại `glass`, nút Lock/Tạo booking dạng viên | `app/product/[id].tsx`, `components/product/PriceBreakdown.tsx` |
| Chi tiết căn (giá, Lock căn, Tạo booking) | `app/product/[id].tsx` + `components/product/PriceBreakdown.tsx`, `ImageCarousel.tsx` |
| Căn đã lock / chi tiết lock (đếm ngược, Tạo booking). Danh sách kiểu bo tròn: header/ô tìm/chip `soft`, card bo `radius.xxl` + bóng nhẹ, icon tròn nền theo trạng thái; hết hạn chỉ hiện badge (không lặp chữ "Hết hạn"), chân card: giờ lock + nút ›. Chi tiết lock cùng kiểu chi tiết sản phẩm (ảnh + khối nội dung trồi lên, ô đếm ngược/hết hạn dạng viên) | `app/locked-units.tsx`, `app/locked/[id].tsx` |
| Sơ đồ phân lô (WebView) | `app/diagram/[mada].tsx` |

## Dữ liệu

| Việc | Service | Nguồn |
|---|---|---|
| Dự án (dùng chung cho mọi ô chọn dự án trong app) | `ProjectService.getProjects` | RPC `fn_da_project_list` (như web `listManagedProjects`), app giữ thêm lọc `ap_dung = true`; MaDA = `ma_da_code`, thiếu thì uuid |
| Danh sách sản phẩm (màn Sản phẩm, chọn căn ở Đặt lịch / Phiếu tính giá) | `ProductService.getProducts` → `normalizeProduct` | RPC `fn_bds_product_list` (như web Cao tầng / Thấp tầng) lấy id + thứ tự + tổng, rồi REST `bds_products?id=in.(…)` đọc đủ cột |
| Chi tiết, ảnh sản phẩm | `ProductService.getDetailProducts / getBannerProduct` | `bds_products` (REST) |
| Danh mục trạng thái căn | `FilterService.getStatusSP` | `cloud_catalogs` `bds_trang_thai`, `ma_ctdk=global` (MaTT = uuid, `_raw.item_code` = mã số) |
| Lưới khu/tầng/vị trí | `PriceServices.getBlock` | `bds_products` + `cloud_catalogs` |
| Giá theo bảng giá (chi tiết căn) | `PriceServices.getActivePriceForProduct` | RPC `get_active_price_for_product` |
| Realtime | SignalR `https://api-beeland.beesky.vn/signalr-beeland`, sự kiện `ChangeTable` (`app/products.tsx`) | cập nhật ô bằng `lib/productRealtime.applyRealtimeChange` |

## Phạm vi dự án / sản phẩm (máy chủ quyết định, app không tự lọc)

Logic thuần + test: `lib/projectScope.ts`, `tests/project-scope.test.cjs`. Nguồn web: `docs-claude/08-features/projects.md` mục 1b,
migration `20261014121500_da_project_scope_agency`, `20261014100000_bds_product_rpc`.

- **Nhân viên đại lý** (công ty của nhân viên là `dm_companies` `is_san`): dự án = dự án gán cho **đại lý** ở tab **Đại lý**
  trong chi tiết dự án web (bảng `da_project_agencies`). Thêm nhân viên đại lý vào "Quản lý nhân viên" của dự án **không** có tác dụng.
  Danh sách sản phẩm = chỉ căn trong **giỏ hàng** đang hiệu lực có cả đại lý lẫn nhân viên đó — không theo dự án.
- **Nhân viên nội bộ:** dự án được gán (`dm_employee_projects`); nhóm full access / admin ⇒ mọi dự án công ty.
  Danh sách sản phẩm = căn thuộc các dự án đó.
- Lưới / Tổng quan (`PriceServices.getBlock`) đọc REST `bds_products`. Với **đại lý**, RLS REST còn trả cả căn sàn từng
  giao dịch (rộng hơn danh sách) ⇒ app lọc lại bằng RPC `app_agency_product_ids(p_include_docs := false)` — đúng tập
  `fn_bds_product_list` dùng — để cả 3 chế độ Danh sách / Lưới / Tổng quan chỉ hiện căn trong giỏ hàng (chủ dự án chốt
  2026-10-16). RPC trả `null` cho nội bộ ⇒ không lọc; lỗi gọi + tài khoản AGENCY ⇒ không hiện căn nào.
  (Sơ đồ tổng quan web `so-do-tong-quan` chưa lọc như vậy — đại lý trên web vẫn thấy căn sàn đã giao dịch.)
- Đại lý muốn thấy căn của giỏ: trên web **Sản phẩm › Giỏ hàng › Quản lý nhân viên** phải thêm **từng nhân viên đại lý**.
  Dialog "Sản phẩm của đại lý" (Danh sách đại lý) liệt kê mọi căn giỏ có đại lý, **không** xét nhân viên ⇒ có thể nhiều hơn
  những gì một nhân viên đại lý thấy.

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

- Phạm vi dự án đại lý từng đọc `cloud_generic_records` endpoint `admin/du-an/dai-ly`. Web chuyển sang `da_project_agencies`
  và **xoá** endpoint này 2026-10-14 ⇒ mọi tài khoản đại lý thấy 0 dự án. Đã chuyển sang `fn_da_project_list` (2026-10-16).
- Danh sách sản phẩm từng đọc thẳng REST `bds_products`: đại lý chưa ở giỏ nào vẫn thấy các căn sàn đã giao dịch
  (RLS REST rộng hơn danh sách web), nhân viên nội bộ chưa gán dự án thấy mọi căn công ty. Đã chuyển sang `fn_bds_product_list`.

- Cột diện tích tim tường là **`dt_tim_tuong`** (app từng đọc `dt_tim_duong` không tồn tại → luôn trống). Field app: `DTTimDuong`.
- uuid sản phẩm nằm ở **`ID`** của `normalizeProduct`, không phải `id`.
- Số phiếu lock phải đếm tháng theo giờ VN (đếm theo UTC từng trùng số 7 giờ đầu tháng → unique lỗi sau khi căn đã sang 18).
- `fn_product_transaction` lỗi phải dừng cả luồng (bản cũ vẫn tạo phiếu khi bị từ chối).

## Tồn đọng / chưa kiểm chứng

- Web hết hạn lock còn gọi `LOCK_RELEASE` trả căn về Mở bán (`ProductLockService.closeLockRow`) + tác vụ nền
  `expire_product_locks` (5 phút). App sweep **chỉ đổi phiếu** → căn có thể còn "Đã Lock" tới khi tác vụ nền chạy. Lệch web, chưa sửa.
- SignalR: web `useSignalR` **JoinGroup** theo `tenCTDKVT + maNV`; app không join group → app có nhận `ChangeTable` hay không **chưa kiểm chứng**.
- Booking căn mã 11 chờ quyết định nghiệp vụ (cần sửa server trước).
- **Đại lý – phạm vi theo giỏ (2026-10-16):** nhân viên đại lý chỉ thấy căn của giỏ có tên mình trong "Quản lý nhân viên".
  Nếu nghiệp vụ muốn **mọi nhân viên của sàn** tự thấy mọi căn giỏ của sàn (như dialog "Sản phẩm của đại lý") ⇒ phải đổi
  `app_agency_product_ids` / `fn_bds_product_list` ở **máy chủ** (ảnh hưởng web) – chưa làm, chờ quyết định.
- Sơ đồ tổng quan web chưa lọc đại lý theo giỏ (app đã lọc) – spec 0.2 #11. Dữ liệu giỏ có dòng nhân viên là id đại lý – spec 0.2 #12.
- Màn chi tiết căn đã lock (`app/locked/[id].tsx`) ảnh đầu trang vẫn cao 320, chưa giảm 2/3 như chi tiết sản phẩm / dự án.
- 4 test so sánh với code web hỏng vì web đã đổi chỗ file khi cấu trúc lại (`payment-math` → `Reports/DebtProgressReport.tsx`,
  `price-sheet-calc` → `ContractForm/calculations.ts`, `scheduleRowsFromTemplate`, `productFromSavedSheet`) – cần trỏ lại đường dẫn.

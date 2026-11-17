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

## Dữ liệu (bộ API riêng, `services/SanPhamApi.ts` + map `lib/nvSanPham.ts`, test `tests/nv-san-pham.test.cjs`)

| Việc | Service | Endpoint (lõi chung web) |
|---|---|---|
| Dự án (dùng chung cho mọi ô chọn dự án) | `ProjectService.getProjects` → `DuAnApi.list` | `fn_nv_app_du_an_list` (= `fn_da_project_list`, chỉ dự án đang áp dụng, kèm ảnh); MaDA = `ma_da_code`, thiếu thì uuid |
| Danh sách sản phẩm (màn Sản phẩm, chọn căn ở Phiếu tính giá) | `ProductService.getProducts` → `SanPhamApi.list` | `fn_nv_app_san_pham_list` (= `fn_bds_product_list`: dự án, khu, trạng thái, loại, từ khoá, trang) |
| Ô lọc khu + danh mục trạng thái (màu theo công ty) | `ProductService.getKhuVuc`, `FilterService.getStatusSP` | `fn_nv_app_san_pham_bo_loc` |
| Lưới / Tổng quan khu → tầng → căn | `PriceServices.getBlock` → `SanPhamApi.grid` | `fn_nv_app_so_do` |
| Chi tiết căn + ảnh + giá đang áp dụng + phiếu lock + quyền Lock / Booking / Lập phiếu tính giá | `SanPhamApi.detail` (`loadProductDetail`, `getDetailProducts`, `getBannerProduct`, `PriceServices.getActivePriceForProduct`) | `fn_nv_app_san_pham_chi_tiet` (1 lời gọi; giá = lõi `get_active_price_for_product`) |
| Realtime | `subscribeTableChanges` (`services/realtimeHub.ts`): UPDATE `bds_products` lọc `ma_ctdk=eq.<uuid công ty>` – như web `useProductStatusRealtime` (`app/products.tsx`) | `lib/productRealtime.rowToRealtimeChange` → `applyRealtimeChange` (khớp căn theo `MaSP`, sự kiện cũ theo `MaVT`); danh sách đổi MaTT/TenTT/ColorTT |

## Phạm vi dự án / sản phẩm (máy chủ quyết định, app không tự lọc)

Logic thuần + test: `lib/projectScope.ts`, `tests/project-scope.test.cjs`. Nguồn web: `docs-claude/08-features/projects.md` mục 1b,
migration `20261014121500_da_project_scope_agency`, `20261014100000_bds_product_rpc`.

- **Nhân viên đại lý** (công ty của nhân viên là `dm_companies` `is_san`): dự án = dự án gán cho **đại lý** ở tab **Đại lý**
  trong chi tiết dự án web (bảng `da_project_agencies`). Thêm nhân viên đại lý vào "Quản lý nhân viên" của dự án **không** có tác dụng.
  Danh sách sản phẩm = chỉ căn trong **giỏ hàng** đang hiệu lực có cả đại lý lẫn nhân viên đó — không theo dự án.
- **Nhân viên nội bộ:** dự án được gán (`dm_employee_projects`); nhóm full access / admin ⇒ mọi dự án công ty.
  Danh sách sản phẩm = căn thuộc các dự án đó.
- Cả 3 chế độ Danh sách / Lưới / Tổng quan: máy chủ áp cùng tập căn (`app_agency_product_ids`) ⇒ đại lý chỉ thấy căn trong giỏ
  hàng (chủ dự án chốt 2026-10-16); app không tự lọc. (Sơ đồ tổng quan web `so-do-tong-quan` chưa lọc như vậy.)
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
  Chi tiết căn tính `canTransact` theo mã số nếu có, không thì theo tên. Nút Lock / Tạo booking còn theo quyền nhóm (LOCK /
  BOOKING của màn sản phẩm) do `fn_nv_app_san_pham_chi_tiet` trả (`perms.lock` / `perms.booking`) – như web.
- Booking căn **"Booking chờ duyệt" (11)**: web bật nút nhưng máy chủ từ chối → app **tắt** (spec 0.2 #1, chờ nghiệp vụ).
- Mã trạng thái (web `ProductTransactionStatus.ts`): 2 Mở bán · 11 Booking chờ duyệt · 18 Đã Lock · bảng đầy đủ ở spec mục 0.1.

## Luồng lock căn (`BookingService`)

- `createLock({ sanPhamId | maSP })` → **1 lời gọi** `fn_nv_app_lock_tao { p_san_pham_id }`: máy chủ lấy phút lock theo cài đặt
  bán hàng, cấp số phiếu không trùng, đổi căn 2 → 18 + ghi phiếu LOCK trong cùng giao dịch. Lỗi → lời máy chủ, không tạo gì.
- Danh sách / chi tiết phiếu lock: `listProductLocks` (`fn_nv_app_lock_list` = `fn_product_lock_list` web: phạm vi chứng từ
  `/sales/locks` + dự án được gán; nhiều dự án ⇒ gọi từng dự án rồi gộp), `getLockDetailCloud` (`fn_nv_app_lock_chi_tiet`). Máy
  chủ tính `con_lai` (chỉ LOCKED còn hạn > 0).
- Hết hạn: `sweepExpiredLocks` (`fn_nv_app_lock_het_han` = `fn_product_lock_expire_due` web; gọi khi mở màn / đếm ngược về 0):
  phiếu LOCKED quá hạn → EXPIRED **và trả căn về trạng thái thực tế** như web; job nền 5 phút vẫn chạy.
- Màn chi tiết căn/lock: chặn bấm lặp bằng ref; đếm ngược về 0 → sweep đúng một lần rồi tải lại.

## Bẫy đã gặp

- Phạm vi dự án đại lý từng đọc `cloud_generic_records` endpoint `admin/du-an/dai-ly` – web xoá endpoint 2026-10-14 ⇒ đại lý
  thấy 0 dự án. Nay theo `fn_nv_app_du_an_list` (lõi `fn_da_project_list`).
- Cột diện tích tim tường là **`dt_tim_tuong`** (app từng đọc `dt_tim_duong` không tồn tại). Field app: `DTTimDuong`.
- uuid sản phẩm nằm ở **`ID`**, không phải `id`.

## Tồn đọng / chưa kiểm chứng

- Realtime trạng thái căn: chưa thử trên máy với dữ liệu thật (cần đổi trạng thái một căn – thao tác ghi).
- Booking căn mã 11 chờ quyết định nghiệp vụ (cần sửa server trước).
- **Đại lý – phạm vi theo giỏ (2026-10-16):** nhân viên đại lý chỉ thấy căn của giỏ có tên mình trong "Quản lý nhân viên".
  Nếu nghiệp vụ muốn **mọi nhân viên của sàn** tự thấy mọi căn giỏ của sàn (như dialog "Sản phẩm của đại lý") ⇒ phải đổi
  `app_agency_product_ids` / `fn_bds_product_list` (đối tượng web) – chưa làm, chờ quyết định.
- Sơ đồ tổng quan web chưa lọc đại lý theo giỏ (app đã lọc) – spec 0.2 #11. Dữ liệu giỏ có dòng nhân viên là id đại lý – spec 0.2 #12.
- Màn chi tiết căn đã lock (`app/locked/[id].tsx`) ảnh đầu trang vẫn cao 320, chưa giảm 2/3 như chi tiết sản phẩm / dự án.

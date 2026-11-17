# Đặt cọc, hợp đồng, lịch thanh toán, phiếu thu

## Màn

| Màn | File |
|---|---|
| Danh sách đặt cọc / hợp đồng (khung chung: tìm, lọc dự án, chip trạng thái, phân trang). Kiểu bo tròn: header/ô tìm/chip `soft`, khung tự bọc mỗi dòng thành card bo `radius.xxl`; cột phải dùng `DocTrailing` (trạng thái trên, tiền rút gọn dưới), avatar tròn | `app/deposits.tsx`, `app/contracts.tsx` + `components/sales/SalesDocList.tsx` |
| Chi tiết đặt cọc / hợp đồng (tổng tiền, thông tin, lịch, phiếu thu). Kiểu bo tròn: header `soft`, card navy bo `radius.x3` gộp khách + trạng thái + tổng tiền (`MoneySummary children`); thông tin / lịch / phiếu thu là card bo `radius.xxl`, mỗi đợt có badge Còn nợ/Đã đủ và khung số liệu nền xám | `app/deposit/[id].tsx`, `app/contract/[id].tsx` + `components/sales/SalesDocDetail.tsx`, `PaymentBlocks.tsx` |

Mở chi tiết với params `{ id, data: JSON dòng danh sách }` (trang chủ cũng mở chi tiết cọc kiểu này).

Chi tiết đặt cọc có nút **"Đặt lịch ký"** (chỉ tài khoản đại lý – `isFeatureAllowed("14")`) → `signing/form` với `pgcId` = `PhieuGiuChoId`
(khoá ô chọn phiếu). Còn nút "Thu tiền cọc QR" thì nút lịch ký thu gọn bên trái. Xem `docs/signing.md`.

## Thu tiền cọc QR (như web `dat-coc/index.tsx` + `BookingVAQRDialog` `module="DATCOC"`)

| Việc | App |
|---|---|
| Điều kiện hiện nút "Thu tiền cọc QR" (chi tiết đặt cọc) | `lib/depositQr.canOfferDepositQr`: quyền `PAYMENT_QR` màn Đặt cọc (`QuyenQR` từ `fn_nv_app_dat_coc_chi_tiet`; lỗi / thiếu ⇒ ẩn, fail-closed) **và** `canCreateDepositQr`: phiếu **chờ duyệt** (`isPendingDeposit`: tên "Đặt cọc chờ duyệt"/"ĐC chờ duyệt"/"Chờ duyệt"/"Chờ xử lý"/trống, hoặc mã 8 – tên "đã duyệt" luôn thắng), còn tiền cọc phải thu, không đang chờ duyệt đổi căn / hoàn cọc |
| Số tiền QR | `depositQrAmount` = `max(0, TienCoc − DaThu)` (dòng `fn_deposit_list`) |
| Màn QR | `app/deposit/qr-payment.tsx` (params `data` = JSON đầu phiếu): `fn_nv_app_cong_thanh_toan` `p_action: create` với `module: DATCOC`, `expires_at: null`, `pgc_id` = uuid phiếu giữ chỗ; mở lại dùng VA `DATCOC` đang `ACTIVE`; kiểm tra `paid_amount` mỗi 5 giây / khi quay lại app. Kiểu bo tròn như chi tiết đặt cọc: header `soft` (nút ⋯ `soft`), lề 20, card bo `radius.xxl` bóng nhẹ, ô chưa có QR nền xám nhạt, chọn tài khoản `SelectField raised`, nút dưới dạng viên; thẻ kết quả `QrResult` bo `radius.xxl` (dùng chung với QR booking) |
| Sau khi thu | Máy chủ `fn_payment_webhook_apply`: tạo phiếu thu; tổng thu ≥ `tien_coc` → `fn_deposit_approve` (tự duyệt). Quay về chi tiết → nạp lại, trạng thái đọc lại từ `fn_nv_app_dat_coc_chi_tiet` (dòng danh sách mới nhất) |

- Trạng thái màn: `getQrScreenState` với `requiresDeadline: false` (không hết hạn, không cần hạn giữ chỗ). Web không đối chiếu lại
  số tiền VA đặt cọc đang mở → app cũng không có trạng thái `mismatch` cho đặt cọc.
- `MaTT` đọc bằng `statusCodeNum` (bỏ ký tự không phải số trong `item_code`, như bộ lọc `fn_deposit_list`); `Number()` ra NaN khi mã lẫn chữ.

## Dữ liệu (bộ API riêng, lõi chung web; công ty / phạm vi / che trường từ phiên)

| Việc | App | Endpoint (= SP web) | Web đối chiếu |
|---|---|---|---|
| Danh sách cọc | `DatCocService.get` | `fn_nv_app_dat_coc_list` (= `fn_deposit_list` màn Đặt cọc, bỏ phiếu chuyển nhượng; `p_du_an_id` 1 uuid, `p_tu_khoa`, ngày, trang; nhiều dự án ⇒ gọi từng dự án rồi gộp) | `services/DepositListService.ts` |
| Danh sách HĐMB (gốc) | `HopDongService.get` | `fn_nv_app_hop_dong_list` (= `fn_sale_contract_list`, bỏ chuyển nhượng; như trên) | `contracts/contract-list` `listSaleContractPage` |
| Trạng thái (chip) | `DatCocService.getTT`, `HopDongService.getTT` → `listPgcStatuses` | `fn_nv_app_trang_thai_list { p_loai: pgc_trang_thai }` (= `fn_status_catalog_list`, màu theo công ty); `MaTT` = `item_code` | |
| Đầu phiếu cọc (khách, giá, loại căn, hướng, cờ QR) | `DatCocService.getDepositDetail` | `fn_nv_app_dat_coc_chi_tiet` (dòng danh sách mới nhất + chứng từ `fn_sales_doc_get` + `quyen.payment_qr`, `doi_can_cho_duyet`) | web `DepositCloudService` |
| Lịch thanh toán 1 phiếu | `PaymentProgressService.getSchedule(pgcId)` | `fn_nv_app_lich_tt_phieu { p_id }` (= `fn_contract_payment_schedule`; nhận id phiếu giữ chỗ / HĐ / cọc) | `services/ContractScheduleService.ts` |
| Phiếu thu 1 phiếu | `PaymentProgressService.getReceipts(pgcId)` | `fn_nv_app_phieu_thu_phieu { p_id }` (= `fn_cash_vouchers_by_pgc`, THU) | `components/Sales/PgcCashVouchersTab.tsx` |

## Quy tắc tiền (`lib/paymentMath.ts`, test `tests/payment-math.test.cjs` so trực tiếp code web)

- Mọi lịch / phiếu thu theo **uuid phiếu giữ chỗ** (`PhieuGiuChoId`, thiếu thì `MaPGC`), không phải uuid cọc/hợp đồng.
- "Đã thu" ở tổng quan = cột `da_thu` máy chủ trả trong danh sách. Lịch: lấy nguyên Đã thu / Còn lại / PBT từ hàm máy chủ.
- Phiếu thu hiển thị/cộng **`so_tien_pgc`** (phần thuộc phiếu này), không phải tổng cả tờ.
- Không còn lịch dự phòng dựng ở máy (web cũng bỏ): máy chủ tự đọc lịch lưu `lich_tt_hd`, phân bổ phiếu thu, số tiền điều chỉnh.
  Lỗi tải lịch ⇒ báo lỗi, không coi là "chưa có lịch".
- Đại lý xem cọc: chỉ dự án được gán; phạm vi rỗng / chọn ngoài phạm vi → không có dữ liệu.

## Bẫy đã gặp

- Kết quả danh sách đọc bằng `listResult` / `rpcRows` (`{ rows, total }` hoặc mảng) – chỉ nhận mảng thì danh sách **rỗng**.
- Lọc ngày: không lọc gửi `null`, có lọc gửi biên giờ VN (`vnDayBound`).
- `TongGiaTriHDMB` = `gia_tri_hd_sau_ck ?? gia_tri_hd`.
- Tab "Tài liệu" cũ của chi tiết HĐ là dữ liệu mẫu → đã bỏ.

## Tồn đọng

- Chi tiết HĐ mở bằng deep link chỉ có `id` (không có `data`) → đầu phiếu trống (lịch/phiếu thu vẫn tải).
- Hợp đồng góp vốn (`fn_capital_contract_list`), chuyển nhượng, thanh lý: chưa có trên app.

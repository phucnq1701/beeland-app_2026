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
| Điều kiện hiện nút "Thu tiền cọc QR" (chi tiết đặt cọc) | `lib/depositQr.canCreateDepositQr`: phiếu **chờ duyệt** (`isPendingDeposit`: tên "Đặt cọc chờ duyệt"/"ĐC chờ duyệt"/"Chờ duyệt"/"Chờ xử lý"/trống, hoặc mã 8 – tên "đã duyệt" luôn thắng) và còn tiền cọc phải thu |
| Số tiền QR | `depositQrAmount` = `max(0, TienCoc − DaThu)` (dòng `fn_deposit_list`) |
| Màn QR | `app/deposit/qr-payment.tsx` (params `data` = JSON đầu phiếu): `payment-gateway` `create` với `module: DATCOC`, `expires_at: null`, `pgc_id` = uuid phiếu giữ chỗ; mở lại dùng VA `DATCOC` đang `ACTIVE`; kiểm tra `paid_amount` mỗi 5 giây / khi quay lại app. Kiểu bo tròn như chi tiết đặt cọc: header `soft` (nút ⋯ `soft`), lề 20, card bo `radius.xxl` bóng nhẹ, ô chưa có QR nền xám nhạt, chọn tài khoản `SelectField raised`, nút dưới dạng viên; thẻ kết quả `QrResult` bo `radius.xxl` (dùng chung với QR booking) |
| Sau khi thu | Máy chủ `fn_payment_webhook_apply`: tạo phiếu thu; tổng thu ≥ `tien_coc` → `fn_deposit_approve` (tự duyệt). Quay về chi tiết → nạp lại, trạng thái đọc lại từ `cloud_pgc_phieu_giucho.trang_thai_id` |

- Trạng thái màn: `getQrScreenState` với `requiresDeadline: false` (không hết hạn, không cần hạn giữ chỗ). Web không đối chiếu lại
  số tiền VA đặt cọc đang mở → app cũng không có trạng thái `mismatch` cho đặt cọc.
- `MaTT` đọc bằng `statusCodeNum` (bỏ ký tự không phải số trong `item_code`, như bộ lọc `fn_deposit_list`); `Number()` ra NaN khi mã lẫn chữ.

## Dữ liệu (đều như web)

| Việc | App | Máy chủ | Web đối chiếu |
|---|---|---|---|
| Danh sách cọc | `DatCocService.get` | RPC `fn_deposit_list` | `services/DepositListService.ts` |
| Danh sách HĐMB (gốc) | `HopDongService.get` | RPC `fn_contract_list` (`p_loai_ct HDMB`, `p_transfer_only false`) | `services/ContractListService.ts` |
| Trạng thái (chip) | `DatCocService.getTT`, `HopDongService.getTT` | `cloud_catalogs` `pgc_trang_thai`, `ma_ctdk=global` | |
| Lịch thanh toán 1 phiếu | `PaymentProgressService.getSchedule(pgcId)` | RPC `fn_contract_payment_schedule(p_ma_ctdk_uid, p_pgc_id)` | `services/ContractScheduleService.ts` |
| Phiếu thu 1 phiếu | `PaymentProgressService.getReceipts(pgcId)` | RPC `fn_cash_vouchers_by_pgc(…, 'THU')` | `components/Sales/PgcCashVouchersTab.tsx` |
| Thông tin thêm của cọc (email, CCCD, loại căn) | `DatCocService.getDepositDetail` | `cloud_pgc_phieu_giucho`, `cloud_customers`, `bds_products` | |

## Quy tắc tiền (`lib/paymentMath.ts`, test `tests/payment-math.test.cjs` so trực tiếp code web)

- Mọi lịch / phiếu thu theo **uuid phiếu giữ chỗ** (`PhieuGiuChoId`, thiếu thì `MaPGC`), không phải uuid cọc/hợp đồng.
- "Đã thu" ở tổng quan = cột `da_thu` máy chủ trả trong danh sách. Lịch: lấy nguyên Đã thu / Còn lại / PBT từ hàm máy chủ.
- Phiếu thu hiển thị/cộng **`so_tien_pgc`** (phần thuộc phiếu này), không phải tổng cả tờ.
- Lịch dự phòng (hàm máy chủ rỗng, như web `ContractDetail`): lịch lưu `cloud_catalogs` `lich_tt_hd` (`parent_code` = uuid
  phiếu giữ chỗ, `ma_ctdk` = mã chữ thường) + `allocatePaidToSchedule` (hết gốc từng đợt rồi mới sang PBT) với **tổng cả tờ
  phiếu thu** (giống web, spec 0.2 #4); phiếu thu lỗi → hiện lịch lưu không phân bổ.
- Đại lý xem cọc: chỉ dự án được gán; phạm vi rỗng / chọn ngoài phạm vi → không có dữ liệu.

## Bẫy đã gặp

- Hàm máy chủ trả `{ rows, total_count }` (bản mới) – chỉ nhận mảng thì danh sách **rỗng** (dùng `rpcRows`).
- Lọc ngày: không lọc gửi `null`, có lọc gửi biên giờ VN (`vnDayBound`).
- `TongGiaTriHDMB` = `gia_tri_hd_sau_ck ?? gia_tri_hd`.
- Tab "Tài liệu" cũ của chi tiết HĐ là dữ liệu mẫu → đã bỏ.

## Tồn đọng

- Chi tiết HĐ mở bằng deep link chỉ có `id` (không có `data`) → đầu phiếu trống (lịch/phiếu thu vẫn tải).
- Hợp đồng góp vốn (`fn_capital_contract_list`), chuyển nhượng, thanh lý: chưa có trên app.

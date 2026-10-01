# Đặt cọc, hợp đồng, lịch thanh toán, phiếu thu

## Màn

| Màn | File |
|---|---|
| Danh sách đặt cọc / hợp đồng (khung chung: tìm, lọc dự án, chip trạng thái, phân trang). Kiểu bo tròn: header/ô tìm/chip `soft`, khung tự bọc mỗi dòng thành card bo `radius.xxl`; cột phải dùng `DocTrailing` (trạng thái trên, tiền rút gọn dưới), avatar tròn | `app/deposits.tsx`, `app/contracts.tsx` + `components/sales/SalesDocList.tsx` |
| Chi tiết đặt cọc / hợp đồng (tổng tiền, thông tin, lịch, phiếu thu). Kiểu bo tròn: header `soft`, card navy bo `radius.x3` gộp khách + trạng thái + tổng tiền (`MoneySummary children`); thông tin / lịch / phiếu thu là card bo `radius.xxl`, mỗi đợt có badge Còn nợ/Đã đủ và khung số liệu nền xám | `app/deposit/[id].tsx`, `app/contract/[id].tsx` + `components/sales/SalesDocDetail.tsx`, `PaymentBlocks.tsx` |

Mở chi tiết với params `{ id, data: JSON dòng danh sách }` (trang chủ cũng mở chi tiết cọc kiểu này).

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

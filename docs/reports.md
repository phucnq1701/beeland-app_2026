# Báo cáo

## Màn

| Màn | File |
|---|---|
| Tổng quan 4 chỉ số (kỳ + dự án). Kiểu bo tròn: header `soft`, 4 card bo `radius.xxl` bóng nhẹ, icon tròn nền theo màu chỉ số, nút ↗ | `app/reports/index.tsx` |
| Thu tiền / Hợp đồng / Sắp đến hạn / Đợt quá hạn | `app/reports/payment.tsx`, `contract.tsx`, `payment-due.tsx`, `overdue.tsx` |
| Chi tiết phiếu thu (mở từ Thu tiền): số tiền, thông tin phiếu, dòng chi tiết | `app/reports/receipt/[id].tsx` |
| Khung chung (kiểu bo tròn: chip kỳ `soft` tràn mép – màn cha phải có lề `space.xl`; chọn dự án `SelectField variant="raised"`; thẻ tổng bo `radius.x3`; mỗi dòng là card bo `radius.xxl`) | `components/reports/ReportList.tsx`, `ReportFilters.tsx`, `ProgressRowItem.tsx` |

Kỳ: Hôm nay / Tuần này (thứ Hai–CN) / Tháng này / Năm nay / Tuỳ chọn – `lib/reportPeriod.ts` (test `tests/report-period.test.cjs`).
Tổng quan mở chi tiết kèm params `period, customFrom, customTo, projectId`.

### Chạm một dòng → màn chi tiết (`lib/reportDetail.ts`, test `tests/report-detail.test.cjs`)

| Báo cáo | Mở | Ghi chú |
|---|---|---|
| Thu tiền | `/reports/receipt/[id]` (id = uuid phiếu) | RPC `fn_cash_voucher_get_by_id` → `toVoucherDetail` – như web `VoucherDetailDrawer` (`ReceiptsPay.Receipts.getByID` → `CashVoucherService.getVoucher`). Màn cũ `app/receipt/[id].tsx` là màn mẫu (dữ liệu mock), không dùng. |
| Hợp đồng | `/contract/[id]` với dòng `fn_contract_list` | Dòng cùng dạng danh sách hợp đồng → dùng lại nguyên màn chi tiết HĐ. |
| Sắp đến hạn / Quá hạn | `progressDocLink`: giai đoạn `DATCOC` → `/deposit/[id]`, `HDGV`/`HDMB` → `/contract/[id]`, truyền `PhieuGiuChoId` = `MaPGC` của đợt | **App thêm, web không có** (DebtProgressReport không có click). Hai màn đích tải lịch thanh toán + phiếu thu theo uuid phiếu giữ chỗ như web ContractDetail. Đầu phiếu lấy từ dòng tiến độ (`ProgressRow.giaiDoan/tongGiaTri/daThuHD/diDong`; `DaThuHD` giữ riêng vì `buildInstallments` ghi đè `DaThu` theo đợt); màn cọc tự bổ sung thêm từ `cloud_pgc_phieu_giucho`, màn HĐ chỉ có các trường từ dòng tiến độ (thiếu ngày ký, đơn giá…). |

## Nguồn (tất cả tính trên Cloud – `sevicesSupabase/ReportService.ts`; không còn gọi API cũ `api/bao-cao/*`)

| Báo cáo | Cách tính | Web đối chiếu |
|---|---|---|
| Thu tiền | RPC `fn_cash_voucher_list` (`p_loai THU`, kỳ dạng `YYYY-MM-DD`, `p_contract_type GOC`, trang 5000) – tổng = cộng `so_tien` | `services/CashVoucherService.listVouchers`, `pages/Finance/revenue` |
| Hợp đồng | `HopDongService.get` (`fn_contract_list`) theo ngày ký trong kỳ – tổng giá trị = cộng `TongGiaTriHDMB`, số HĐ = `totalRows` | `services/ContractListService.ts` |
| Tiến độ theo đợt | Dựng từ vòng đời phiếu: `cloud_pgc_phieu_giucho` (giai đoạn DATCOC/HDGV/HDMB, chưa xoá, **`ma_hd_goc is null`**), bỏ huỷ/thanh lý/từ chối; đã thu = dòng chi tiết phiếu thu (`cloud_cash_voucher_details`, PBT tách riêng, ghép alias HĐ/cọc) phân bổ luỹ tiến theo đợt (`buildInstallments`) | `services/AccountingCloudService.ts` (`listDebtSummaryFromLifecycle`, `listInstallmentsFromLifecycle`, `sumReceiptsByPgc`), `pages/Reports/DebtProgressReport.tsx` (mặc định GOC) |
| Quá hạn | đợt có `agingOf` = d30/d60/d90/d90p (còn nợ > 0 và quá hạn), **không lọc kỳ** | `DebtProgressReport.agingOf` |
| Sắp đến hạn | đợt còn nợ, `agingOf` = current, ngày TT trong kỳ (đợt chưa có ngày vẫn giữ) | |
| Tổng quan | 4 số lấy đúng từ 4 nguồn trên (`getOverview`) | |

## Bẫy đã gặp

- Không đọc bảng mirror `cloud_debts` (dữ liệu cũ chép từ API cũ) – web màn tiến độ mặc định GOC cũng không đọc.
- Tra bảng phụ theo id phải chia nhóm (`byIds`/`byPgc`, 100 id/lần) và **báo lỗi** khi lỗi – lỗi im lặng làm mất bộ lọc
  huỷ/thanh lý → đếm sai quá hạn.
- `legacy_api_mode` toàn hệ thống đang `off` (web Cloud-only) – xem `docs/data-access.md`.

## Tồn đọng / chưa kiểm chứng

- Tiền lãi quá hạn (bảng lãi suất dự án) chưa hiển thị trên app.
- Hiệu năng: tiến độ tải toàn bộ phiếu (≤5000) và toàn bộ dòng phiếu thu (≤50000) như web – có thể chậm trên điện thoại.
- Tổng thu cộng tối đa 5000 phiếu trong kỳ (chưa dùng `sums` máy chủ trả).
- Số liệu chưa đối chiếu với web trên dữ liệu thật (đang chờ phiên test có đăng nhập).
- Chi tiết phiếu thu chưa thử trên máy thật; dạng trả về của `fn_cash_voucher_get_by_id` lấy theo `scripts/selfhost/0112_fn_cash_voucher_rpc.sql` của web (bản trên máy chủ có thể khác).
- Mở HĐ từ dòng tiến độ: đầu phiếu thiếu ngày ký / đơn giá / chính sách (dòng tiến độ không có; `fn_contract_list` không lọc được theo id).

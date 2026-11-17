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
| Thu tiền | `/reports/receipt/[id]` (id = uuid phiếu) | `fn_nv_app_phieu_thu_chi_tiet` (= `fn_cash_voucher_get_by_id`) → `toVoucherDetail` – như web `VoucherDetailDrawer`. Đây là màn chi tiết phiếu thu duy nhất (màn mẫu `app/receipt/[id].tsx` đã xoá). |
| Hợp đồng | `/contract/[id]` với dòng `fn_nv_app_hop_dong_list` | Dòng cùng dạng danh sách hợp đồng → dùng lại nguyên màn chi tiết HĐ. |
| Sắp đến hạn / Quá hạn | `progressDocLink`: giai đoạn `DATCOC` → `/deposit/[id]`, `HDGV`/`HDMB` → `/contract/[id]`, truyền `PhieuGiuChoId` = `MaPGC` của đợt | **App thêm, web không có** (DebtProgressReport không có click). Hai màn đích tải lịch thanh toán + phiếu thu theo uuid phiếu giữ chỗ như web ContractDetail. Đầu phiếu lấy từ dòng tiến độ (`ProgressRow.giaiDoan/tongGiaTri/daThuHD/diDong`; `DaThuHD` giữ riêng vì `buildInstallments` ghi đè `DaThu` theo đợt); màn cọc tự bổ sung thêm từ `fn_nv_app_dat_coc_chi_tiet`, màn HĐ chỉ có các trường từ dòng tiến độ (thiếu ngày ký, đơn giá…). |

## Nguồn (`services/ReportService.ts`, bộ API riêng, lõi chung web)

| Báo cáo | Cách tính | Web đối chiếu |
|---|---|---|
| Thu tiền | `fn_nv_app_phieu_thu_list` (= `fn_cash_voucher_list` loại THU, hợp đồng gốc; kỳ `YYYY-MM-DD`, trang 1 × 5000) – tổng = cộng `so_tien` | `services/CashVoucherService.listVouchers`, `pages/Finance/revenue` |
| Hợp đồng | `HopDongService.get` (`fn_nv_app_hop_dong_list` = `fn_sale_contract_list`) theo ngày ký trong kỳ – tổng giá trị = cộng `TongGiaTriHDMB`, số HĐ = `totalRows` | `services/ContractListService.ts` |
| Tiến độ theo đợt | Phiếu gốc `fn_nv_app_bao_cao_tien_do { p_du_an_id }` (máy chủ lọc phạm vi, nối trạng thái / căn / dự án / số chứng từ); bỏ huỷ / thanh lý / từ chối và HĐ gốc đã chuyển nhượng (`daChuyenNhuong`); đã thu `fn_nv_app_da_thu_phieu` (= `fn_pgc_collected`: PBT riêng, bí danh HĐ/cọc, bỏ tiền lãi; phiếu không có khoá ⇒ `da_thu` trên phiếu) phân bổ luỹ tiến theo đợt (`buildInstallments`, `lib/paymentMath.ts`); khách `customerMapByIds` (`fn_nv_app_khach_hang_theo_id`) | `services/AccountingCloudService.ts`, `pages/Reports/DebtProgressReport.tsx` (mặc định GOC) |
| Quá hạn | đợt có `agingOf` = d30/d60/d90/d90p (còn nợ > 0 và quá hạn), **không lọc kỳ** | `DebtProgressReport.agingOf` |
| Sắp đến hạn | đợt còn nợ, `agingOf` = current, ngày TT trong kỳ (đợt chưa có ngày vẫn giữ) | |
| Tổng quan | 4 số lấy đúng từ 4 nguồn trên (`getOverview`) | |

## Bẫy đã gặp

- Quá hạn từng lọc `agingOf(...).startsWith("d")` ⇒ lẫn đợt đã tất toán (`"done"`); nay so đúng tập d30/d60/d90/d90p.
- Lỗi tải phải **báo lỗi** (`error: true`), không im lặng – lỗi im lặng làm mất bộ lọc huỷ/thanh lý → đếm sai quá hạn.

## Tồn đọng / chưa kiểm chứng

- Tiền lãi quá hạn (bảng lãi suất dự án) chưa hiển thị trên app.
- Hiệu năng: tiến độ tải toàn bộ phiếu gốc của phạm vi + đã thu (≤ 20.000 phiếu / lần) – có thể chậm trên điện thoại.
- Tổng thu cộng tối đa 5000 phiếu trong kỳ (chưa dùng tổng máy chủ trả).
- Mở HĐ từ dòng tiến độ: đầu phiếu thiếu ngày ký / đơn giá / chính sách (dòng tiến độ không có).

# Redesign UI Beeland Sales – Giai đoạn 5 (Cọc, hợp đồng, báo cáo) – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa Đặt cọc, Hợp đồng, Báo cáo sang design system; **mọi số tiền, trạng thái, điều kiện thao tác giống web**. Ẩn Lịch hẹn.

**Architecture:** Phần tính tiền chép từ web vào hàm thuần `lib/paymentMath.ts` (có test, một số test so trực tiếp với code web). Đọc dữ liệu bằng đúng hàm máy chủ / bảng web đang dùng: `sevicesSupabase/PaymentProgressService.ts` (lịch thanh toán + phiếu thu của 1 phiếu), `sevicesSupabase/ReportService.ts` (4 báo cáo + tổng quan). Màn hình chỉ hiển thị.

**Tech Stack:** như GĐ0–4. **Spec:** `docs/superpowers/specs/2026-09-30-ui-redesign-design.md` (mục 0, 0.2, 6, 7 dòng GĐ5).

## Global Constraints

- Nhánh `devhuan2`, commit local; không push/PR/eas; **không sửa server**.
- Ưu tiên đổi giao diện; chỉ sửa logic khi app lệch web – mỗi chỗ ghi nguồn web trong chú thích và liệt kê trong báo cáo.
- Commit giai đoạn `feat(ui): phase 5 – cọc, hợp đồng, báo cáo`; sửa theo review commit riêng.
- Lịch hẹn: ẩn khỏi Trang chủ / Tất cả quản lý / tab menu; không xoá file, không đổi logic màn appointments.

## Nghiệp vụ web (nguồn) và chỗ app lệch

| # | Web (chuẩn) | App hiện tại | Sửa |
|---|---|---|---|
| L1 | Danh sách cọc `fn_deposit_list` trả `{ rows, total_count }` (vẫn nhận mảng); ngày lọc `vnDayStart/vnDayEnd`, không lọc → null; `MaPGC = pgc_id`; giá trị HĐ = `gia_tri_hd_sau_ck ?? gia_tri_hd` (`services/DepositListService.ts`) | Chỉ nhận mảng (server trả object → **danh sách rỗng**); mặc định 2000–2100; `MaPGC = id cọc`; giá trị thiếu → 0 | Theo web |
| L2 | Danh sách HĐ `fn_contract_list` (`p_loai_ct HDMB`, `p_transfer_only false`), "Đã thu" tính dưới DB (`services/ContractListService.ts`) | Tự query `cloud_contracts` + embed, "đã thu" = cột `da_thu` | Gọi `fn_contract_list` |
| L3 | Lịch thanh toán 1 phiếu: `fn_contract_payment_schedule(p_ma_ctdk_uid, p_pgc_id)` (Đã thu/Còn lại từng đợt, tách PBT); rỗng → lịch `lich_tt_hd` (parent = **uuid phiếu giữ chỗ**) + phân bổ tổng đã thu: hết gốc từng đợt rồi mới sang PBT (`ContractScheduleService.ts`, `ContractDetail.tsx allocatePaidToSchedule`) | Tự đọc `lich_tt_hd` (cọc: parent = **id cọc**) và tự phân bổ | Theo web |
| L4 | Phiếu thu của 1 phiếu: `fn_cash_vouchers_by_pgc(p_ma_ctdk_uid, p_pgc_id, 'THU')`, số tiền hiển thị/cộng = `so_tien_pgc` (phần thuộc phiếu này) (`CashVoucherService.listVouchersByPgc`, `PgcCashVouchersTab`) | Cộng **toàn bộ** số tiền phiếu thu có dòng gắn phiếu (sai khi 1 phiếu thu nhiều HĐ) | Theo web |
| L5 | Báo cáo tính trên Cloud (`DashboardService`, `AccountingCloudService`, `CashVoucherService` – "không còn gọi API cũ") | 5 màn báo cáo gọi API cũ `api-beeland.beesky.vn/api/bao-cao/*` | Tính trên Cloud như web (R1–R4) |
| L6 | Tiến độ thanh toán (đợt): `cloud_debts` nhóm `TIENDO:` nếu có, không thì dựng từ vòng đời phiếu (DATCOC/HDGV/HDMB, bỏ huỷ/thanh lý/từ chối), đã thu = chi tiết phiếu thu (không gồm PBT) phân bổ luỹ tiến theo đợt; quá hạn theo `agingOf` (còn nợ > 0 và quá ngày) (`AccountingCloudService.listDebtsCloudFirst/listInstallmentsFromLifecycle`, `DebtProgressReport.tsx`) | API cũ | Port |

## Quyết định mặc định (theo web, ghi báo cáo)

| # | Điểm | Mặc định |
|---|---|---|
| R1 | Báo cáo "Thu tiền" | Danh sách phiếu thu `fn_cash_voucher_list(p_loai THU, kỳ, dự án)` như màn Phiếu thu web; tổng = cộng `so_tien` các phiếu trong kỳ |
| R2 | Báo cáo "Hợp đồng" | `fn_contract_list` (HĐMB gốc) theo ngày ký trong kỳ; tổng = cộng giá trị HĐ |
| R3 | "Sắp đến hạn" / "Quá hạn" | Dòng tiến độ (L6): sắp đến hạn = đợt còn nợ, chưa quá hạn, ngày TT trong kỳ lọc; quá hạn = `agingOf` bắt đầu bằng `d` (không lọc kỳ – như cột "Nợ quá hạn" web) |
| R4 | Tổng quan | 4 số lấy từ đúng nguồn R1–R3 (tổng thu, tổng giá trị HĐ, số đợt sắp đến hạn, số đợt quá hạn) |
| R5 | Web có cờ toàn hệ thống `cloud_global_settings.legacy_api_mode`: "on" thì vài màn web còn thử API cũ trước | App luôn tính trên Cloud (đường mà web đang chuyển sang toàn bộ); ghi spec 0.2 |
| R6 | Tiền lãi quá hạn (bảng lãi suất dự án) | App không hiển thị lãi (màn app không có cột lãi) – không port `loadInterestRates` |

## Review Focus

1. Phiếu thu một tờ cho nhiều hợp đồng → chi tiết HĐ/cọc chỉ cộng phần của phiếu đó (L4) – test Task 1/2.
2. Server trả `{ rows, total_count }` hoặc mảng → danh sách không rỗng, tổng đúng (L1/L2) – test Task 2.
3. Phân bổ đã thu: hết gốc → PBT; đợt không có số → thứ tự ổn định (L3) – test so với web Task 1.
4. Báo cáo quá hạn / sắp đến hạn tại biên ngày (đúng hôm nay, giờ VN) – test Task 1.
5. Đại lý (AGENCY) không thấy dự án ngoài phạm vi ở cọc (giữ lọc hiện có).

## Tasks

- **Task 1 – `lib/paymentMath.ts`**: `allocatePaidToSchedule` (chép web), `mapScheduleRpcRow`, `voucherPgcTotal`, `agingOf`/`AGING_LABEL`, `buildInstallments(parents, now)` (chép `listInstallmentsFromLifecycle` phần tính, bỏ lãi), `isDroppedStatus`, `classifyReceiptsByPgc` (chép `sumReceiptsByPgc` phần cộng). Test `tests/payment-math.test.cjs` (allocate + agingOf so trực tiếp code web).
- **Task 2 – services**: `PaymentProgressService.getSchedule(pgcId)` / `getReceipts(pgcId)`; `DatCocService.get` (L1), `getDepositDetail` dùng PaymentProgress (L3/L4); `HopDongService.get` → `fn_contract_list` (L2), `getDetailLTT/LST` dùng PaymentProgress; `ReportService` (R1–R4, L6). Test `tests/payment-services.test.cjs`.
- **Task 3 – Đặt cọc**: `deposits.tsx`, `deposit/[id].tsx` (Screen/AppHeader/SearchBar/Chip trạng thái/ListItem; chi tiết: thông tin, giá, lịch thanh toán từng đợt, phiếu thu).
- **Task 4 – Hợp đồng**: `contracts.tsx`, `contract/[id].tsx` (cùng khuôn).
- **Task 5 – Báo cáo**: `reports/index.tsx` + 4 màn + `components/ReportFilterBar.tsx` (kỳ + dự án, dựng lại bằng component mới).
- **Task 6 – Ẩn Lịch hẹn**: `lib/featureConfig.ts` `HIDDEN_FEATURE_IDS = ['3']` (route giữ nguyên để bật lại) + test; Trang chủ bỏ tải lịch hẹn không dùng.
- **Task 7**: `UI_STRICT_FILES`, spec 0.2 (R5), check chuẩn, commit, review agent, sửa Critical/Important commit riêng.

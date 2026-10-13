# Phiếu tính giá

Tính năng **17** – chỉ tài khoản nội bộ (không có trong `AGENCY_FEATURE_IDS`). Web chuẩn: `../beeland/src/pages/products/gia-gio-hang/phieu-tinh-gia/index.tsx`
(danh sách) + `src/components/PriceSheet/PriceSheetForm.tsx` (form 5 bước, ~7.150 dòng). Máy chủ: RPC `fn_price_sheet_*`
(migration web `20261014130000_price_sheet_rpc.sql` – công ty / nhân viên lấy từ JWT, phạm vi dự án ở máy chủ, lưu = 1 RPC
ghi phiên bản + giá gốc căn). App **không sửa máy chủ**.

## Màn

| Màn | File | Ghi chú |
|---|---|---|
| Danh sách | `app/price-sheets.tsx` | `fn_price_sheet_list`: tìm (mã phiếu / mã căn / sản phẩm), lọc dự án (uuid, 1 dự án), loại (Cao tầng / Thấp tầng), chip trạng thái kèm số đếm (`stats` máy chủ), cuộn tải thêm 20. Nút + chỉ hiện khi có quyền ADD. Nhúng được làm tab menu (`embedded`). |
| Chi tiết | `app/price-sheet/[id].tsx` | `fn_price_sheet_get`; hiện **số đã lưu** (snapshot / payload – không tính lại). Chia sẻ PDF, menu: Duyệt / Từ chối (APPROVE, từ chối bắt buộc lý do), Sửa (EDIT + `appEditBlockReason`), Xoá mềm (DELETE). |
| Lịch sử | `app/price-sheet/history/[id].tsx` | `fn_price_sheet_versions` – chỉ xem (khôi phục phiên bản làm trên web). |
| Lập / sửa | `app/price-sheet/new.tsx` | Wizard 4 bước: Căn hộ → Chính sách → Thanh toán → Khách & quà. Params `productId` (căn có sẵn) / `sheetId` (sửa). Không param ⇒ chọn căn ngay ở bước 1 (`ProductPicker`: dự án + loại + tìm). Lối vào khác: chi tiết căn (`app/product/[id].tsx`) nút "Lập phiếu tính giá" ở khối Chi tiết giá – chỉ nội bộ có quyền ADD. |

Khối dùng chung: `components/priceSheet/` (`usePriceSheetDraft` điều phối, `PriceSheetBlocks`, `RoundEditor`, `ProductPicker`,
`CustomerPicker`, `sharePriceSheetPdf`). Service: `sevicesSupabase/PriceSheetService.ts`.

## Luồng lập phiếu (giống web)

1. `fn_get_product_by_id` → `lib/priceSheetPayload.mapProductRow` (= `mapBdsProduct` web) → `formFromProduct`.
2. Cấu hình tính giá **sản phẩm** (`cloud_pricing_configs` CAOTANG/THAPTANG của dự án; ưu tiên cấu hình gắn căn → `status` → đầu
   danh sách) → `computeAllFormulas(priceCodeValues)` → `applyPriceInputs` (= `useProductPriceConfig.recomputeFrom`).
3. Bảng giá ưu tiên cao nhất (`fn_get_current_price_lists`, `sortPriceLists`) → dòng `price_list_items` của căn (theo `product_id`,
   dữ liệu cũ dò mã căn) → `applyPriceListItem` (= `getSPByBG` + `handleBG`; thiếu dòng ⇒ giá sản phẩm).
4. Bảng giá có `sales_policy_id` (và chính sách có trong danh sách) ⇒ tự chọn chính sách: `fn_get_byid_sales_policy` → chi tiết
   CK (`normalizePolicyDetail`) + `pricing_config_id` (không có ⇒ cấu hình CSBH mặc định `status`/đầu danh sách) →
   `cloud_pricing_config_rounds` → `buildRoundTemplate` → `applyPolicyDetailsToRounds` (dòng dư dùng khung vòng cuối).
   Chính sách có `payment_schedule_id` ⇒ tự chọn tiến độ.
5. Tiến độ `fn_get_byid_payment_schedule` → `scheduleRowsFromTemplate` → `recalcPaymentScheduleSequential` (tính lại mỗi khi giá đổi).
6. Lưu: `buildPayload` (= `handleSave` type "pricesheet") + `buildSaveRow` (= `handlePriceSheetSaved`) → `fn_price_sheet_save`
   (`p_host_form` null). Phiếu mới về chi tiết; sửa thì quay lại.

Người dùng sửa được: bảng giá, chính sách, từng vòng (bật/tắt, % CK, CK tiền mặt; hệ số chỉ hiện), tiến độ, ngày ký, tiền cọc
(mặc định 50.000.000 như web), khách (không bắt buộc – tìm trong kho), quà tặng, ghi chú. **Không có trên app:** người đồng sở hữu,
ưu đãi lãi suất, 360 khách hàng, sửa tay dòng lịch, chọn cấu hình CSBH khác, sửa giá trường cấu hình sản phẩm, nhân viên KD / sàn
(máy chủ tự gán sàn của nhân viên khi tạo), tạo phiếu từ chứng từ, thư mục, thùng rác / khôi phục / xoá vĩnh viễn.

## Tính tiền (lib thuần, có test)

| File | Nguồn web | Test |
|---|---|---|
| `lib/formulaEval.ts` | thay `new Function` (Hermes + an toàn) – giữ hành vi JS strict (`--`, số 0 đứng đầu, dấu phẩy) | `tests/price-sheet-formulas.test.cjs` |
| `lib/priceSheetFormulas.ts` | `ContractForm/formulas.ts` (ROUND, evaluateRoundFormula), `helpers.mapApiDetailsToFormulas`, `utils/pricingEngine.ts` | so trực tiếp code web, 5.000 biểu thức ngẫu nhiên |
| `lib/priceSheetCalc.ts` | **bản sao** web `ContractForm/calculations.ts` (dùng chung form Phiếu tính giá + Đặt cọc / Hợp đồng): không công thức dự phòng, thấp tầng % VAT XD /100 | `tests/price-sheet-calc.test.cjs` – so trực tiếp tệp web trên 2.000 bộ ngẫu nhiên + phiếu thật BRG |
| `lib/priceSheetSchedule.ts` | `helpers.ts` lịch thanh toán + `scheduleRowsFromTemplate` (tên đợt MoTa → TenDot) + NgayTT | so trực tiếp `helpers.ts` web |
| `lib/priceSheetPayload.ts` | `handleSave`, `handlePriceSheetSaved`, `mapBdsProduct`, `getSPByBG`/`handleBG`, `PRICE_FIELD_MAP` | `tests/price-sheet-payload.test.cjs` |
| `lib/priceSheetPrint.ts` | `printPriceSheetRecord` + `printPriceSheetHighRise` (mẫu Excel PTG) | như trên |
| `lib/priceSheetStatus.ts` | nhãn / màu Tag trạng thái, điều kiện Duyệt / Từ chối | như trên |

Kiểm chứng 13/10/2026 (đọc DB, JWT giả lập trong transaction chỉ đọc): toàn chuỗi app trên dữ liệu thật phiếu B2-701 (PTG-0007)
khớp 100% GiaTriHopDong / totals / 4 đợt (cả NgayTT); tham số app gửi `fn_price_sheet_list/get`, `fn_get_current_price_lists`,
`app_has_perm_any` chạy đúng.

## Quy tắc

- **Quyền:** `app_has_perm_any(['/products/price-sheet'], ADD|EDIT|DELETE|APPROVE)` chỉ để ẩn/hiện nút (lỗi mạng ⇒ hiện,
  máy chủ vẫn chặn). Danh sách / chi tiết không cần quyền VIEW (máy chủ chỉ lọc theo phạm vi dự án).
- **Sửa trên app** chỉ phiếu nháp "đơn giản" (`appEditBlockReason`): không xoá, `status = draft`, không gắn phiếu giữ chỗ,
  không đồng sở hữu / ưu đãi lãi suất / 360 khách, có dữ liệu sản phẩm. Còn lại báo "sửa trên web" (app không quản các khối đó,
  lưu đè sẽ làm mất). Web cho sửa mọi trạng thái.
- **Sửa phiếu:** giá gốc lấy đúng `GiaTriHopDong` đã lưu (`productFromSavedSheet` – bản sao web, web cùng cách từ 2026-10-13), vòng CK từ `snapshot.policyRounds` + công thức cấu hình hiện tại
  (`roundsFromSheet` theo `key`). Tính lại lệch số đã lưu > 1đ ⇒ hiện cảnh báo (cấu hình / chính sách đã đổi).
- Vòng không cài công thức cho trường nào ⇒ trường đó = 0 (như web cả 2 form, không công thức dự phòng – web PT5).
- Danh sách / chi tiết luôn hiện số đã lưu, không tính lại.
- Chia sẻ PDF: `expo-print` → `expo-sharing` (không có chia sẻ ⇒ hộp in hệ thống).

## Bẫy / dữ liệu

- 13/10/2026 tìm thấy và sửa (migration web `20261015020100_fix_brg_price_data`, backup `~/backups/20261015_brg_price_fix_*`):
  chính sách "Chính sách bán hàng tháng 9" (BRG) gắn nhầm cấu hình CAOTANG (0 vòng) ⇒ chuyển sang CSCAOTANG `fa70cbbe` (5 vòng);
  bảng giá 06/2026, 8/2026 (import ghép nhầm cột) chép lại cột từ căn; CT01 % VAT = 0, % PBT chứa số tiền ⇒ 10 / 2.
  Nguyên nhân gốc (web, đã sửa): ghép cột import dạng chuỗi con + 1 cột cho nhiều trường; import ghi % = 0 khi thiếu.
- Căn B2-809 (BRG, dự án `3329abf7…`): dữ liệu căn tự lệch (tổng gồm VAT + PBT ≠ tổng thanh toán ~61.000đ) – chưa sửa, cần
  người phụ trách kiểm tra.
- Mẫu chung cấu hình tính giá (`la_mau_chung`) của công ty khác bị RLS chặn đọc – app (như web) chỉ thấy cấu hình của công ty mình.

## Tồn đọng

- Thấp tầng chưa có phiếu thật để đối chiếu – kiểm bằng test tự dựng + so trực tiếp code web.
- Chưa chạy thử trên máy thật (lưu phiếu ghi dữ liệu thật – không có môi trường test).

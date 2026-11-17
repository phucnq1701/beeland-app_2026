# Phiếu tính giá

Tính năng **17** – chỉ tài khoản nội bộ (không có trong `AGENCY_FEATURE_IDS`). Web chuẩn: `../beeland/src/pages/products/gia-gio-hang/phieu-tinh-gia/index.tsx`
(danh sách) + `src/components/PriceSheet/PriceSheetForm.tsx` (form). Máy chủ: endpoint app `fn_nv_app_ptg_*` bọc đúng
`fn_price_sheet_*` của web (công ty / nhân viên từ phiên, phạm vi dự án ở máy chủ). **Duyệt / từ chối chỉ làm trên web.**

## Màn

| Màn | File | Ghi chú |
|---|---|---|
| Danh sách | `app/price-sheets.tsx` | `fn_nv_app_ptg_list`: tìm (mã phiếu / mã căn / sản phẩm), lọc dự án (uuid, 1 dự án), loại (Cao tầng / Thấp tầng), chip trạng thái kèm số đếm (`stats` máy chủ), cuộn tải thêm 20. Nút + chỉ hiện khi có quyền ADD. Nhúng được làm tab menu (`embedded`). |
| Chi tiết | `app/price-sheet/[id].tsx` | `fn_nv_app_ptg_chi_tiet`; hiện **số đã lưu** (snapshot / payload – không tính lại). Chia sẻ PDF; menu: Sửa (quyền EDIT; máy chủ chặn phiếu đang / đã duyệt), Xoá mềm (DELETE, `fn_nv_app_ptg_xoa`). |
| Lịch sử | `app/price-sheet/history/[id].tsx` | `fn_nv_app_ptg_phien_ban` – chỉ xem (khôi phục phiên bản làm trên web). |
| Lập / sửa | `app/price-sheet/new.tsx` | 3 bước: Căn & chính sách → Lịch thanh toán → Khách hàng. Params `productId` (căn có sẵn) / `sheetId` (sửa). Không param ⇒ chọn căn ở bước 1 (`ProductPicker`: dự án + loại + tìm). Lối vào khác: chi tiết căn (`app/product/[id].tsx`) nút "Lập phiếu tính giá" – chỉ nội bộ có quyền ADD (`fn_nv_app_san_pham_chi_tiet` trả). |

Khối dùng chung: `components/priceSheet/` (`useWebPriceSheet`, `WebRoundCard`, `PriceSheetBlocks`, `ProductPicker`,
`sharePriceSheetPdf`). Service: `services/PriceSheetService.ts`. Cờ `PRICE_SHEET_CREATE_LOCKED` (`lib/featureConfig.ts`) = `false`
(bật ⇒ khoá Lập / Sửa trên app, báo "lập trên web").

## Form = logic web chép nguyên văn (`lib/web`)

- `scripts/sync-web-pricing.cjs` chép **nguyên văn** các module thuần của web vào `lib/web/` (chỉ đổi đường dẫn import), trích
  thân `PriceSheetForm.tsx` thành hook `useWebPriceSheetForm` (`lib/web/components/PriceSheet/PriceSheetForm.hook.ts`) và
  handleEdit / handlePriceSheetSaved của trang danh sách (`lib/web/pages/products/gia-gio-hang/phieu-tinh-gia/saveRow`). Module
  không thuần ⇒ stub kiểu (`_stubs`) hoặc shim viết tay (`_shims`: supabase ⇒ `RPC_MAP`, sonner, session, service web).
  **Không sửa tay `lib/web`** (trừ `_shims`); web đổi ⇒ chạy lại script, `tests/web-pricing.test.cjs` (`--check`) báo lệch.
- `useWebPriceSheet` làm phần "trang" của web: lập mới – căn `getBdsProductById` (`fn_nv_app_san_pham_tinh_gia`), loại cao /
  thấp tầng theo căn; sửa – handleEdit web (bản mới nhất, dựng lại sản phẩm từ ảnh chụp + giá đã lưu); lưu – handlePriceSheetSaved
  web → `fn_price_sheet_save` → **`fn_nv_app_ptg_luu`** (máy chủ cấp số phiếu khi trống).
- Luồng như web: quỹ căn ⇒ bảng giá, công ty bán hàng, chính sách (trước bảng giá, lọc tòa / quỹ / hạn), tùy chọn chiết khấu theo
  điều kiện / phân bổ / tồn kho quà, tiến độ thanh toán, ngày tính / ngày hết hạn (≤ hạn chính sách), tính giá.
- Endpoint đọc dùng qua `RPC_MAP`: `fn_nv_app_bang_gia_hien_hanh`, `_chinh_sach_list`, `_chinh_sach_chi_tiet`, `_lich_tt_list`,
  `_lich_tt_chi_tiet`, `_khuyen_mai_list`, `_quy_can_list`, `_cong_ty_ban_hang_cua_toi`, `_cong_ty_dai_ly`, `_tuy_chon_da_dung`,
  `_ton_kho_qua`, `_ngoai_le_hieu_luc`, `_khach_hang_chon` / `_theo_id` (bảng đầy đủ: `lib/web/_shims/integrations/supabase/client.ts`).
- **Khác web có chủ đích:** số phiếu không xem trước (máy chủ cấp khi lưu); không có bước 360 khách hàng / người đồng sở hữu
  (giữ nguyên dữ liệu phiếu cũ khi sửa); không có "Lưu & gửi duyệt" (duyệt trên web).

## Lib app còn lại (thuần, có test)

| File | Nguồn web | Test |
|---|---|---|
| `lib/priceSheetPrint.ts` | `printPriceSheetRecord` + `printPriceSheetHighRise` (mẫu Excel PTG) | `tests/price-sheet-print.test.cjs` |
| `lib/priceSheetStatus.ts` | nhãn / màu Tag trạng thái | |

## Quy tắc

- **Quyền:** `PriceSheetService.perms()` → `fn_nv_app_quyen { p_form: "/products/price-sheet", p_chuc_nang: [ADD, EDIT, DELETE, APPROVE] }`
  (lõi `app_has_perm`) chỉ để ẩn/hiện nút; lỗi ⇒ không có quyền (fail-closed như web), máy chủ vẫn chặn khi thao tác.
- Danh sách / chi tiết luôn hiện số đã lưu, không tính lại.
- Chia sẻ PDF: `expo-print` → `expo-sharing` (không có chia sẻ ⇒ hộp in hệ thống).

## Bẫy / dữ liệu

- Căn B2-809 (BRG, dự án `3329abf7…`): dữ liệu căn tự lệch (tổng gồm VAT + PBT ≠ tổng thanh toán ~61.000đ) – chưa sửa, cần
  người phụ trách kiểm tra.
- Mẫu chung cấu hình tính giá (`la_mau_chung`) của công ty khác: app (như web) chỉ thấy cấu hình của công ty mình.
- Hàm web mới chưa có trong `RPC_MAP` ⇒ log "app không hỗ trợ" – thêm endpoint app rồi thêm vào map.

## Tồn đọng

- Đã thử trên máy ảo lập (C6-2301) + sửa (S4-1401, đúng số đã lưu) và lưu trong ROLLBACK; **chưa bấm Lưu thật** (ghi prod).
- Thấp tầng chưa có phiếu thật để đối chiếu.

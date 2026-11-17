# Đặt lịch ký

Đặt lịch ký cho giao dịch đặt cọc / hợp đồng theo **luồng web mới** (user chốt 2026-11-16): Nguồn → chứng từ → Quỹ → Điểm ký →
Loại thủ tục → ngày → Ca, hồ sơ cần chuẩn bị. Như web `beeland/src/pages/sales/giao-dich/dat-lich-ky/*` +
`services/sales/signing-appointment`. Tính năng id **14** (`/signings`) cho **mọi tài khoản** (sếp 2026-11-17: có module Đặt lịch ký +
đặt từ Đặt cọc; 2026-10-02 → 11-16 chỉ đại lý). Quyền thật do máy chủ kiểm.

## Màn

| Màn | File |
|---|---|
| Danh sách: tất cả lịch (không tách Cá nhân / Doanh nghiệp — 2026-11-17), xếp lịch sắp tới gần nhất trước rồi lịch đã qua (`sortForAgenda`), ô tìm `soft` (mã căn, tên KH, SĐT, giấy tờ), chip trạng thái, lọc 1 dự án (`FilterPanel`), nút đổi **Danh sách / Lịch**; nút nổi "Thêm lịch ký" (viên cam, chừa tab bar khi nhúng). Mỗi lịch ký là card bo `radius.xxl` (`SigningRowItem`: mã căn, khách · dự án, ngày · ca · đại lý; phải: trạng thái + giờ) | `app/signings.tsx`, `components/signing/SigningRowItem.tsx` |
| Chế độ Lịch: lưới tháng gọn (`SigningCalendar` mode `events`, số lịch ký mỗi ngày) + danh sách của ngày chọn | `components/signing/SigningCalendar.tsx` |
| Chi tiết: khối navy bo `radius.x3` (giờ ký lớn, thứ ngày, ca · thủ tục, trạng thái); card Thông tin book ký / Khách hàng (+ đồng sở hữu) / Thanh toán / Hồ sơ đính kèm. Nút dưới: "Sửa lịch ký"; menu ⋯: sửa, xoá (`confirm`). **App không cập nhật trạng thái** (xác nhận / từ chối làm trên web – yêu cầu người dùng 2026-10-02), chỉ hiển thị | `app/signing/[id].tsx`, `components/signing/AttachmentList.tsx` |
| Thêm / sửa (params `id` \| `kind`, `projectId`, `pgcId`) – logic form web chép (mục dưới), giao diện riêng app | `app/signing/form.tsx`, `components/signing/PickerSheets.tsx` |
| Lối vào từ chi tiết đặt cọc: nút "Đặt lịch ký" (mọi tài khoản) → form với `pgcId` = `PhieuGiuChoId`, khoá ô chọn phiếu | `app/deposit/[id].tsx` |

## Dữ liệu

Màn Danh sách / Chi tiết / ô tìm phiếu cọc: `services/SigningService.ts`. Form: logic web chép nguyên văn trong `lib/web`
(`SigningDrawer` ⇒ `useWebSigningForm`, `ShiftPickerFields` ⇒ `useWebShiftPicker`, `SigningFundField` ⇒ `useWebSigningFund`,
`services/sales/signing-appointment`), gọi tên hàm web → shim `RPC_MAP` đổi sang endpoint app. Mọi SP app bọc đúng SP web
`fn_signing_*`; công ty / phạm vi dự án, đại lý / người thao tác lấy từ phiên.

| Việc | App | Endpoint (= SP web) |
|---|---|---|
| Danh sách | `SigningService.list` (`p_is_personal`, `p_state`, `p_search`, `p_project_id`, trang 1 × 500) | `fn_nv_app_lich_ky_list` (`fn_signing_appointment_list`) |
| Chi tiết (uuid \| seq) | `SigningService.get` | `fn_nv_app_lich_ky_chi_tiet` (`fn_signing_appointment_get`) |
| Xoá | `SigningService.remove` | `fn_nv_app_lich_ky_xoa` (`fn_signing_appointment_delete`) |
| Lưu (thêm / sửa) | submit form web | `fn_nv_app_lich_ky_luu` (`fn_signing_appointment_upsert`: kiểm ca + ghi nhật ký) |
| Tìm phiếu cọc / HĐ | `SigningService.searchDeposits` (`DepositPickerSheet`) / `SigningAppointmentCloudService.searchContracts` | `fn_nv_app_lich_ky_tim_coc` / `fn_nv_app_lich_ky_tim_hd` |
| Quỹ, điểm ký, thủ tục theo chứng từ | form web | `fn_nv_app_lich_ky_tuy_chon` (`fn_signing_book_options`) |
| Chỗ trống theo ngày / ca còn lượt | form web | `fn_nv_app_lich_ky_cho_trong` (`fn_signing_availability`) / `fn_nv_app_lich_ky_ca` (`fn_signing_shift_slots`) |
| Phương án TT (nhãn ở chi tiết) | `SigningService.plans`: `phuong_an_tt_ky`, không có thì `phuong_an_tt` | `fn_nv_app_danh_muc_ma` (mã chữ công ty phiên) |
| Khách / đồng sở hữu | `CustomerService.getCustomerById`, `SigningService.customersByIds` | `fn_nv_app_khach_hang_theo_id` (khách công ty khác ⇒ bản giới hạn, CCCD che) |
| Bắt buộc nhập / ẩn trường | form web (`useFieldConfig`, cả trường có điều kiện) | `fn_nv_app_cau_hinh_truong` (`fn_field_config_effective`) |
| Tệp theo hồ sơ | `uploadTenantFile(file, "signing")` → `tai_lieu` `[{fileName, url, uploadedAt, hoSoId, hoSoTen}]` | `fn_nv_app_tai_tep` |
| Duyệt / từ chối | **không có** – chỉ web (shim trả `APP_UNSUPPORTED`) | |

## Quy tắc (theo form web)

- Nguồn **Đặt cọc / Hợp đồng** (`NGUON_OPTIONS`); mở từ chi tiết đặt cọc ⇒ khoá nguồn + phiếu, loại khách (cá nhân / DN) theo
  khách của phiếu (form không có nút chọn Cá nhân / Doanh nghiệp: loại khách tự lấy theo khách của chứng từ đã chọn). Chọn chứng từ ⇒ form web nạp lại đầy đủ theo uuid (khách, đại lý, đồng sở hữu, lịch TT, kho hồ sơ).
- Quỹ → Điểm ký → Loại thủ tục → ngày (dải 14 ngày tới + "Trống gần nhất" + lịch tháng, theo chỗ còn) → Ca còn lượt; đổi bước
  trước thì bỏ lựa chọn sau (`RESET_THEO_QUY`…). Tóm tắt lịch hẹn: `buildAppointmentText`.
- Hồ sơ cần chuẩn bị theo phân loại khách; tệp gắn theo từng hồ sơ ("Tài liệu khác" cho tệp lẻ); tệp có sẵn trong kho hồ sơ
  của giao dịch được dùng lại.
- Phương án thanh toán: giao dịch có lịch TT ⇒ khoá theo lịch TT.
- Khách khoá theo chứng từ (không có "Đổi khách"); "Sửa hồ sơ" → `customer/[id]/edit` rồi nạp lại; "Thêm người đồng sở hữu"
  (`CustomerPickerSheet`) hoặc tạo khách mới → `customer/new` với `returnToSigning=1`, `newCustomerFor=owner`, quay về kèm `newCustomer`.
- Đại lý phụ trách: tài khoản đại lý ⇒ sàn của tài khoản, khoá ô (`agencySan` của hook web `useAgencySan`).
- Lưu = submit web: bắt buộc nhập theo cấu hình (thiếu ⇒ toast "Vui lòng nhập: …"), kiểm lại chỗ của ca. Thêm mới xong ⇒ mở chi
  tiết; sửa ⇒ quay lại. Trạng thái: `PENDING` Chờ xác nhận · `CONFIRMED` Đã xác nhận · `REJECTED` Từ chối (`lib/signing.ts`, app chỉ đọc).
- Giờ: lưu `YYYY-MM-DDTHH:mm:ss+07:00`, đọc ra giờ VN naive (`lib/signing.toVNStore` / `fromVNStore`).

## Tồn đọng

- Chưa có Xuất Excel, chọn nhiều để đổi trạng thái hàng loạt, cấu hình cột (web có) – không hợp mobile.
- Đã thử form trên máy ảo + lưu trong ROLLBACK (payload đúng, PENDING); **chưa bấm Lưu thật** (ghi prod), chưa thấy tận mắt toast
  thiếu trường trên máy ảo.

# Đặt lịch ký

Đặt lịch ký hợp đồng / đặt cọc cho phiếu đặt cọc, chọn ca làm việc còn lượt. Như web
`beeland/src/pages/sales/giao-dich/dat-lich-ky/*` + `services/SigningAppointmentCloudService.ts` +
`services/SigningShiftConfigService.ts`. Tính năng id **14** (`/signings`), **chỉ dành cho tài khoản đại lý** – nội bộ không thấy ở menu và không có nút ở chi tiết đặt cọc
(`AGENCY_ONLY_FEATURE_IDS`, yêu cầu người dùng 2026-10-02).

## Màn

| Màn | File |
|---|---|
| Danh sách: tab Cá nhân / Doanh nghiệp (`SegmentedControl soft`), ô tìm `soft` (mã căn, tên KH, SĐT, giấy tờ), chip trạng thái, lọc 1 dự án (`FilterPanel`), nút đổi **Danh sách / Lịch**; nút nổi "Thêm lịch ký" (viên cam, chừa tab bar khi nhúng). Mỗi lịch ký là card bo `radius.xxl` (`SigningRowItem`: mã căn, khách · dự án, ngày · ca · đại lý; phải: trạng thái + giờ) | `app/signings.tsx`, `components/signing/SigningRowItem.tsx` |
| Chế độ Lịch: lưới tháng gọn (`SigningCalendar` mode `events`, số lịch ký mỗi ngày) + danh sách của ngày chọn | `components/signing/SigningCalendar.tsx` |
| Chi tiết: khối navy bo `radius.x3` (giờ ký lớn, thứ ngày, ca · thủ tục, trạng thái); card Thông tin book ký / Khách hàng (+ đồng sở hữu) / Thanh toán / Hồ sơ đính kèm. Nút dưới: "Trạng thái" (sheet chọn 3 trạng thái + ghi chú) và "Sửa lịch ký"; menu ⋯: sửa, xoá (`confirm`) | `app/signing/[id].tsx`, `components/signing/StatusSheet.tsx`, `AttachmentList.tsx` |
| Thêm / sửa (params `id` \| `kind`, `projectId`, `pgcId`) | `app/signing/form.tsx`, `components/signing/PickerSheets.tsx` |
| Lối vào từ chi tiết đặt cọc: nút "Đặt lịch ký" (chỉ tài khoản đại lý) → form với `pgcId` = `PhieuGiuChoId`, khoá ô chọn phiếu | `app/deposit/[id].tsx` |

## Dữ liệu (như web, khoá uuid)

| Việc | App (`sevicesSupabase/SigningService.ts`) | Máy chủ |
|---|---|---|
| Danh sách | `list` | RPC `fn_signing_appointment_list` (`p_is_personal`, `p_state`, `p_input_search`, `p_project_id`, limit 500) |
| Chi tiết | `get(uuid \| seq)` | RPC `fn_signing_appointment_get` |
| Thêm / sửa | `upsert` → `p_payload` = `lib/signing.buildUpsertPayload` (web `toRow` + `upcert`) | RPC `fn_signing_appointment_upsert` (máy chủ kiểm tra ca + ghi nhật ký) |
| Đổi trạng thái / xoá | `setState`, `remove` | RPC `fn_signing_appointment_set_state`, `fn_signing_appointment_delete` (kèm `actor_id` = mã NV, `actor_name`) |
| Tìm phiếu đặt cọc / đọc 1 phiếu | `searchDeposits`, `getDeposit` | RPC `fn_signing_deposit_search` (`p_id` để đọc theo uuid) |
| Loại thủ tục | `procedures` | `cloud_signing_procedures` (`ma_ctdk` = uuid công ty, `is_active`) |
| Ca còn lượt 1 ngày | `slots(day, procedureId, pgcId)` | RPC `fn_signing_shift_slots` (máy chủ bỏ ca chính phiếu này đã đặt trong ngày) |
| Lượt trống theo ngày | `availability` → `lib/signing.availabilityFrom` | `cloud_signing_shifts` + `cloud_signing_appointments` (không tính Từ chối) |
| Phương án TT | `plans`: `phuong_an_tt_ky` (Cài đặt danh mục), không có thì `phuong_an_tt` | `cloud_catalogs` (`ma_ctdk` = mã công ty chữ thường) |
| Phân loại KH | `customerTypes` (`phan_loai_kh`), rỗng → `PHAN_LOAI_ALL` (1 cá nhân, 2 đồng sở hữu vợ chồng, 3 doanh nghiệp) | `cloud_catalogs` |
| Đại lý phụ trách | `agencies` = `ProductService.getSanGiaoDichAPI`; đại lý đăng nhập: `agencySanId` = `branch_id` trong token, khoá ô | `dm_companies is_san` |
| Đồng sở hữu | `customersByIds(dong_so_huu_ids)` | `cloud_customers` |
| Tệp đính kèm | `uploadTenantFile(file, "signing")` (`BookingService.ts`, dùng chung với ảnh chứng từ booking) → cột `tai_lieu` `[{fileName,url,uploadedAt}]` | edge function `upload-file` |
| Bắt buộc nhập / ẩn trường | `CustomerRulesService.getRulesForForm("signing" \| "agency_signing")` + `lib/signing.missingRequired(requiredValues(form, khách))` | `cloud_required_field_configs`, `cloud_field_visibility_configs` |

## Quy tắc (logic thuần `lib/signing.ts`, test `tests/signing.test.cjs`)

- Trạng thái: `PENDING` Chờ xác nhận · `CONFIRMED` Đã xác nhận · `REJECTED` Từ chối (mặc định PENDING).
- Giờ: lưu `YYYY-MM-DDTHH:mm:ss+07:00` (`toVNStore`), đọc ra giờ VN naive (`fromVNStore`) → hiển thị đúng giờ đã nhập.
- Chọn phiếu: điền căn, dự án, khách, đại lý (trừ tài khoản đại lý), đồng đứng tên (`co_owners` của phiếu),
  phân loại (`phanLoaiFromDeposit`: có đồng đứng tên → 2, khách doanh nghiệp → 3, còn lại 1); luôn đọc lại phiếu
  đầy đủ từ máy chủ. Mở từ chi tiết đặt cọc thì loại khách (cá nhân/DN) theo khách của phiếu; chọn trong form giữ tab.
- Ngày/ca: đổi loại thủ tục hoặc ngày → bỏ ca đã chọn. Ca chỉ hiện khi đủ phiếu + thủ tục + ngày (`canQuerySlots`),
  chỉ ca còn lượt (+ ca đang chọn), ca còn ≤ 20% tô vàng (`isLowSlot`). Chọn ca → giờ ký = giờ bắt đầu ca.
  Dải 14 ngày tới + "Trống gần nhất" + lịch tháng (`SigningCalendar mode="slots"`, `disablePast`). Làm mới ca mỗi 20 giây.
- Lưu: phiếu bắt buộc → cấu hình bắt buộc nhập → bắt buộc loại thủ tục + ca → đọc lại lượt của ca (hết thì bỏ ca, báo) →
  upsert. `dong_so_huu_ids` chỉ lưu khi khách cá nhân + phân loại 2 (`coOwnerIdsToSave`). Thêm mới xong → mở chi tiết.
- Khách hàng: lịch ký chỉ lưu uuid; tên/SĐT/CCCD lấy theo hồ sơ khách. Form có "Sửa hồ sơ" (`customer/[id]/edit`,
  quay về nạp lại), "Đổi khách" / "Thêm người đồng sở hữu" (`CustomerPickerSheet`, tìm `CustomerService.getCustomers`),
  thêm khách mới → `customer/new` với `returnToSigning=1`, `newCustomerFor` (main | owner), `signingParams`;
  lưu xong `dismissTo('/signing/form')` kèm `newCustomer`.
- Đại lý: danh sách / tìm phiếu chỉ giữ dự án được gán (`ProjectService.getProjects`), dòng không rõ dự án vẫn giữ (như web).

## Bẫy

- Các ô thông tin doanh nghiệp trên form web (Số ĐKKD, trụ sở, văn bản uỷ quyền…) **không được lưu** vào lịch ký
  (web `toRow` không có) → app không hiện ô nhập, chỉ hiện hồ sơ khách (spec 0.2 mục 6).
- Mã phương án TT lưu bằng `num()` → mã chữ của danh mục `phuong_an_tt_ky` thành `null` (như web, spec 0.2 mục 7).
- Cấu hình bắt buộc `MaHinhThucTT` / `MaBaoLanh` luôn báo thiếu (form lưu `LaChuyenKhoan` / `CoBaoLanh`) – như web.
- `availability` lọc giờ bằng mốc UTC (00:00 giờ VN = 17:00Z hôm trước) để `+07:00` không bị mã hoá sai trong URL.

## Tồn đọng

- Chưa có Xuất Excel, chọn nhiều để đổi trạng thái hàng loạt, cấu hình cột (web có) – không hợp mobile.
- Chưa kiểm chứng trên máy thật với dữ liệu công ty có cấu hình ca/thủ tục.

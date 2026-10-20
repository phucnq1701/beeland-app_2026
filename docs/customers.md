# Khách hàng

## Màn

| Màn | File |
|---|---|
| Danh sách (tìm, Cá nhân/DN, chip trạng thái, Gọi/Zalo, SĐT che). Kiểu bo tròn: header/ô tìm/thanh loại/chip `soft`, mỗi khách là card bo `radius.xxl`, avatar tròn; cột phải cao bằng khối chữ: trạng thái ngang dòng tên (`StatusBadge size="sm"`, màu theo `color_code` danh mục `trang_thai_kh` – web lưu tên preset antd), nút Gọi/Zalo tròn nền nhạt ngang dòng cuối | `app/customers.tsx` + `components/customer/CustomerListItem.tsx` |
| Chi tiết khách (kiểu bo tròn): card đầu bo `radius.x3` gồm avatar tròn, tên, nhãn, hàng nút tròn Gọi/Zalo/Email; card thông tin + card "Ghi chú" (`ghi_chu`, ẩn khi trống) + card "Giao dịch" bo `radius.xxl`; header `soft` (Sửa/Xoá nút tròn) | `app/customer/[id]/index.tsx` |
| Thêm / sửa khách (kiểu bo tròn): `CustomerForm` chia card theo nhóm (Thông tin chung – ô Ghi chú nằm dưới địa chỉ / Phân loại / Người đại diện), ô nhập + ô chọn `variant="soft"`, nút lưu dạng viên, header `soft` | `app/customer/new.tsx`, `app/customer/[id]/edit.tsx`, `components/customer/CustomerForm.tsx` |
| Thêm / sửa (form chung). `customer/new` quay về màn gọi khi mở từ tạo booking (`returnToBooking=1` → `booking/create`) hoặc form lịch ký (`returnToSigning=1`, `newCustomerFor`, `signingParams`, `personal=0` để mở sẵn doanh nghiệp → `signing/form`), kèm `newCustomer` | `app/customer/new.tsx`, `app/customer/[id]/edit.tsx` + `components/customer/CustomerForm.tsx` |
| Hộp trùng khách | `components/customer/DuplicateSheet.tsx` |
| Chi tiết, xoá | `app/customer/[id]/index.tsx` |
| Giao dịch của khách (kiểu bo tròn như danh sách cọc/HĐ): header/ô tìm `soft`, mỗi giao dịch là card bo `radius.xxl`, cột phải `DocTrailing` (trạng thái trên, tiền rút gọn dưới). Chạm → chi tiết theo giai đoạn (`transactionTarget` trong `lib/customerRules.ts`): giữ chỗ → `booking/[id]` (id phiếu giữ chỗ, tra theo `ma_pgc_id`); `DATCOC` → `deposit/[id]`, `HDMB/HDGV/THANHLY` → `contract/[id]` – hai màn này cần dòng danh sách nên tìm trong `fn_deposit_list`/`fn_sale_contract_list` theo số phiếu rồi ký hiệu căn, khớp `PhieuGiuChoId`; không tìm thấy (vd đại lý ngoài phạm vi, HĐ không thuộc danh sách HĐMB) thì mở chi tiết booking |  `app/customer/[id]/contracts.tsx` |
| Danh bạ chat (dữ liệu mẫu) | `app/contacts.tsx` |

## Dữ liệu

| Việc | Hàm | Nguồn |
|---|---|---|
| Danh sách | `CustomerService.getCustomers` | RPC `fn_customer_list` bản mới (`p_search`, `p_page`, `p_size`, `p_ma_tt_id`, `p_is_personal`; công ty + nhân viên từ JWT, phạm vi `_customer_scope_ids`; offset lệch trang ⇒ `pageWindow`) – như web `CustomerCloudService.listCustomerPage` |
| Chi tiết (màn Khách hàng › chi tiết / sửa) | `CustomerService.getCustomerDetailCloud` | RPC `fn_customer_get(p_id)` (web `getCustomerScoped`; cần quyền xem màn Khách hàng, theo phạm vi; trả jsonb hoặc null, `trang_thai` / `nguon` / `cty` / `creator` / `updater` lồng). Nhận cả mã KH: `fn_customer_get_by_ids(p_refs)` lấy uuid trước. Null ⇒ "Không tìm thấy"; lỗi máy chủ ⇒ màn hiện nguyên `message`. Bản giới hạn (`limited`, chỉ thấy qua chứng từ): CCCD che ở `cccd_masked`, màn ẩn Sửa/Xoá, màn sửa từ chối |
| Lưu (tạo/sửa) | `CustomerService.saveCustomerCloud` | RPC `fn_customer_save(p_row, p_scoped = true)` (web `saveCustomerToCloud` màn Khách hàng): máy chủ kiểm quyền thêm/sửa + phạm vi, chống trùng CCCD/SĐT (trùng ⇒ ghép vào khách cũ), **cấp mã khách** (app không tự sinh `KH-xxxxxx` nữa), tự đặt `id`, `ma_ctdk`, `company_id` (sàn đại lý ‖ công ty NV), người tạo/sửa, `ngay_sua`. Trả uuid ⇒ đọc lại bằng `fn_customer_get`. Sửa: `p_row` = `id` + cột `APP_EDIT_COLUMNS` |
| Xoá | `CustomerService.deleteCustomer` | RPC `fn_customer_delete(p_id)` (web `removeCustomerFromCloud`): máy chủ kiểm phạm vi + quyền xoá, chặn khi còn `cloud_pre_bookings` / `cloud_bookings` / chứng từ – thông báo máy chủ hiện nguyên |
| Giao dịch | `CustomerService.getHopDong` → `getCustomerTransactions` | `cloud_pgc_phieu_giucho` + tra `bds_products`, `da_projects`, `cloud_catalogs` |
| Ghi chú khách | `customerSavePayload` (`ghiChu`) → `saveCustomerCloud` | cột `cloud_customers.ghi_chu` (qua `fn_customer_save`) (text, người dùng thêm 2026-10-02; **chỉ app dùng, web chưa hiển thị**). Ô "Ghi chú" có ở cả tạo và sửa; trống → `null`. Nơi gọi `saveCustomerCloud` không gửi `ghiChu` thì giữ nguyên ghi chú cũ. Trước đây ghi chú lúc tạo khách lưu thành nhật ký chăm sóc – nay không còn |
| Nhật ký chăm sóc | `CustomerService.getCustomerActivities` / `addCustomerActivity` / `deleteCustomerActivity` | RPC `fn_customer_activity_list(p_khach_hang_id)` / `fn_customer_activity_save(p)` / `fn_customer_activity_delete(p_id)` (web `services/customers/customer-activity`); công ty (`ma_ctdk_uid`) máy chủ đặt, `nguoi_thuc_hien` = tên người nhập |
| Ô chọn khách ở màn khác (tạo booking, lịch ký, phiếu tính giá, gắn hội thoại chat) | `CustomerService.pickCustomers` | RPC `fn_customer_picker` (web `listCustomerPicker`, qua `customerLookup.pickCustomers`): không cần quyền màn Khách hàng, từ khoá **≥ 2 ký tự** (ngắn hơn ⇒ rỗng, màn nhắc "nhập ít nhất 2 ký tự"), ≤ 50 dòng |
| Một khách cho màn khác (form lịch ký, chọn khách trùng khi quay về booking/lịch ký) | `CustomerService.getCustomerById` | `fn_customer_get_by_ids` (web `getCustomerFromCloud`); bản giới hạn ⇒ CCCD trống, che ở `cccd_masked` |
| Luật trùng / bắt buộc / ẩn trường / khoá định danh | `sevicesSupabase/CustomerRulesService.ts` | xem dưới |

## Quy tắc (chép web – logic thuần `lib/customerRules.ts`, test `tests/customer-rules*.test.cjs`)

| Luật | App | Web đối chiếu |
|---|---|---|
| Trùng khách: cấu hình `cloud_catalogs` `customer_duplicate/default` (theo `ma_ctdk_uid`), mặc định **block** mọi tiêu chí. Kiểm trùng = **1 RPC `fn_customer_duplicate_check(p_values, p_fields, p_exclude_id)`** (Đợt 5 đã khoá đọc thẳng `cloud_customers` / `cloud_customer_activities`): máy chủ khớp trong công ty (JWT), trả kèm số liệu bảo vệ (`txn_total`, `has_contract/deposit/booking`, `care_count`, `last_care_at`, `created_at`) + `owner_name` → `protectionFromStats` (HĐ/cọc → block, giữ chỗ/chăm sóc gần → request…); khách do chính mình tạo → `ownDuplicateMode`. Khách **ngoài phạm vi** (`in_scope=false`): chỉ tên che + công ty (`outOfScope`, `companyName`, không người phụ trách / bảo vệ); `limited` = chỉ thấy qua chứng từ (CCCD che 4 số). Tham số `opts.scoped` (web `scopedSave` màn Khách hàng): luôn dò CCCD/SĐT, khách ngoài phạm vi ⇒ `request` (chuyển giao). Kết quả allow (lưu) / request (gửi `fn_customer_dup_request_create` – người gửi/công ty/nhật ký máy chủ tự lấy từ JWT) / block (không lưu). Lỗi máy chủ ném `Error(message)`. Sửa khách bỏ qua chính nó (`p_exclude_id`). Doanh nghiệp chỉ kiểm MST. **Không kiểm trùng họ tên / tên công ty** (khác web – nhiều người trùng tên, spec 0.2 #8). Có sẵn hàm theo web (chưa màn nào dùng): `listDuplicateRequests`, `duplicateRequestLogs`, `decideDuplicateRequest` (`fn_customer_dup_decide`), `commentDuplicateRequest`, `cancelDuplicateRequest`, `findDuplicateApproval`. | `CustomerRulesService.checkDuplicate`, `createDuplicateRequest`, `lib/customerRules.ts` `protectionFromStats` | `services/CustomerDuplicateService.ts`, `CustomerDuplicateConfigService.ts`, `CustomerDupRequestService.ts`, `components/Customers/DuplicateGuardModal.tsx` |
| Bắt buộc nhập: `cloud_required_field_configs` (form `customer` / `customer_org`; đại lý cá nhân `agency_customer`), bỏ trường bị ẩn và key ngoài danh mục form web. Trường app không có trên form → chặn lưu, hướng dẫn nhập trên web. | `getFormRules` + `checkRequired` | `services/RequiredFieldService.ts`, `config/requiredFieldCatalog.ts` |
| Ẩn / chỉ đọc trường: `cloud_field_visibility_configs` chung + theo nhóm quyền (claim `per_id`, rồi `dm_employees.perm_group_uid`); `is_full_access` không bị ẩn | `getFormRules` | `services/FieldVisibilityService.ts` |
| Khoá định danh khi có lịch ký cá nhân (`cloud_signing_appointments`): tên + CCCD (DN: tên + MST) | `hasIdentityLock` | `services/CustomerIdentityLockService.ts` |
| Xoá: máy chủ chặn khi có `cloud_pre_bookings` / booking / chứng từ (`fn_customer_delete`, thông báo như web) | `deleteCustomer` | `pages/customers/quan-ly/khach-hang/index.tsx` |

- Sửa khách chỉ gửi các cột form app quản lý (`APP_EDIT_COLUMNS`) cho `fn_customer_save` – máy chủ ghép lên bản ghi cũ, không ghi đè dữ liệu chỉ nhập trên web.
- Từ 2026-10-20 (Đợt 5) app **không đọc/ghi thẳng** `cloud_customers`, `cloud_customer_activities`, `customer_work_history`, `cloud_customer_dup_requests(_logs)` – chỉ qua RPC (`sevicesSupabase/customerLookup.ts` + `CustomerService`). Ảnh CCCD (`fn_customer_images_get`) và lịch sử làm việc (`fn_customer_work_history_*`) app chưa dùng.
- Danh sách che SĐT như web (`maskPhone`); chi tiết hiện đủ.

## Bẫy đã gặp

- `cloud_pgc_phieu_giucho` **không có** cột `tong_gia_tri`, `tien_giu_cho` (dùng `gia_tri_hd`, `gia_tri_hd_sau_ck`, `tien_coc`).
- Tạo khách từ booking: phải trả param **`newCustomer`** (không phải `createdCustomer`) và dùng `router.dismissTo`.
- Đổi Cá nhân ↔ DN: CCCD chỉ gửi khi cá nhân; MST TNCN và MST DN giữ riêng từng loại (`customerSavePayload`).

## Tồn đọng

- Nhật ký chăm sóc trên chi tiết khách: đang ẩn (chưa làm lại).
- Web có `findApprovalFor` (RPC `fn_customer_dup_request_find_approval`) nhưng không dùng → người được duyệt vẫn bị chặn (spec 0.2 #3). App có hàm `findDuplicateApproval` nhưng cũng chưa dùng (giống web).
- Máy chủ `fn_customer_duplicate_check` không trả `is_personal` / `email`: `DuplicateMatch.isPersonal` suy từ (khớp MST hoặc chỉ có tên công ty), `email` = null.
- Hộp trùng (`DuplicateSheet`) chưa xử lý khách ngoài phạm vi (`outOfScope`): nút "dùng khách đã có" vẫn hiện, máy chủ sẽ từ chối gắn. `CustomerForm` chưa truyền `{ scoped: true }` (web màn Khách hàng có).
- Nhánh tra nhóm quyền qua bảng phụ của web (`PermissionMatrixService.resolveGroupUid` bước 3) chưa port.

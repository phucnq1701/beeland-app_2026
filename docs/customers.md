# Khách hàng

## Màn

| Màn | File |
|---|---|
| Danh sách (tìm, Cá nhân/DN, chip trạng thái, Gọi/Zalo, SĐT che). Kiểu bo tròn: header/ô tìm/thanh loại/chip `soft`, mỗi khách là card bo `radius.xxl`, avatar tròn; cột phải cao bằng khối chữ: trạng thái ngang dòng tên (`StatusBadge size="sm"`, màu theo `color_code` danh mục `trang_thai_kh` – web lưu tên preset antd), nút Gọi/Zalo tròn nền nhạt ngang dòng cuối | `app/customers.tsx` + `components/customer/CustomerListItem.tsx` |
| Chi tiết khách (kiểu bo tròn): card đầu bo `radius.x3` gồm avatar tròn, tên, nhãn, hàng nút tròn Gọi/Zalo/Email; card thông tin + card "Ghi chú" (`ghi_chu`, ẩn khi trống) + card "Giao dịch" bo `radius.xxl`; header `soft` (Sửa/Xoá nút tròn) | `app/customer/[id]/index.tsx` |
| Thêm / sửa khách (kiểu bo tròn): `CustomerForm` chia card theo nhóm (Thông tin chung / Phân loại / Người đại diện / Ghi chú), ô nhập + ô chọn `variant="soft"`, nút lưu dạng viên, header `soft` | `app/customer/new.tsx`, `app/customer/[id]/edit.tsx`, `components/customer/CustomerForm.tsx` |
| Thêm / sửa (form chung). `customer/new` quay về màn gọi khi mở từ tạo booking (`returnToBooking=1` → `booking/create`) hoặc form lịch ký (`returnToSigning=1`, `newCustomerFor`, `signingParams`, `personal=0` để mở sẵn doanh nghiệp → `signing/form`), kèm `newCustomer` | `app/customer/new.tsx`, `app/customer/[id]/edit.tsx` + `components/customer/CustomerForm.tsx` |
| Hộp trùng khách | `components/customer/DuplicateSheet.tsx` |
| Chi tiết, xoá | `app/customer/[id]/index.tsx` |
| Giao dịch của khách (kiểu bo tròn như danh sách cọc/HĐ): header/ô tìm `soft`, mỗi giao dịch là card bo `radius.xxl`, cột phải `DocTrailing` (trạng thái trên, tiền rút gọn dưới). Chạm → chi tiết theo giai đoạn (`transactionTarget` trong `lib/customerRules.ts`): giữ chỗ → `booking/[id]` (id phiếu giữ chỗ, tra theo `ma_pgc_id`); `DATCOC` → `deposit/[id]`, `HDMB/HDGV/THANHLY` → `contract/[id]` – hai màn này cần dòng danh sách nên tìm trong `fn_deposit_list`/`fn_contract_list` theo số phiếu rồi ký hiệu căn, khớp `PhieuGiuChoId`; không tìm thấy (vd đại lý ngoài phạm vi, HĐ không thuộc danh sách HĐMB) thì mở chi tiết booking |  `app/customer/[id]/contracts.tsx` |
| Danh bạ chat (dữ liệu mẫu) | `app/contacts.tsx` |

## Dữ liệu

| Việc | Hàm | Nguồn |
|---|---|---|
| Danh sách | `CustomerService.getCustomers` | RPC `fn_customer_list` |
| Chi tiết | `CustomerService.getCustomerDetailCloud` | `cloud_customers` |
| Lưu (tạo/sửa) | `CustomerService.saveCustomerCloud` | POST/PATCH `cloud_customers` |
| Xoá | `CustomerService.deleteCustomer` | DELETE `cloud_customers` (`return=representation`) |
| Giao dịch | `CustomerService.getHopDong` → `getCustomerTransactions` | `cloud_pgc_phieu_giucho` + tra `bds_products`, `da_projects`, `cloud_catalogs` |
| Ghi chú khách | `customerSavePayload` (`ghiChu`) → `saveCustomerCloud` | cột `cloud_customers.ghi_chu` (text, người dùng thêm 2026-10-02; **chỉ app dùng, web chưa hiển thị**). Ô "Ghi chú" có ở cả tạo và sửa; trống → `null`. Nơi gọi `saveCustomerCloud` không gửi `ghiChu` thì giữ nguyên ghi chú cũ. Trước đây ghi chú lúc tạo khách lưu thành nhật ký chăm sóc – nay không còn |
| Nhật ký chăm sóc | `CustomerService.addCustomerActivity` | `cloud_customer_activities` (`ma_ctdk` = mã chữ thường, `nguoi_thuc_hien` = tên) |
| Luật trùng / bắt buộc / ẩn trường / khoá định danh | `sevicesSupabase/CustomerRulesService.ts` | xem dưới |

## Quy tắc (chép web – logic thuần `lib/customerRules.ts`, test `tests/customer-rules*.test.cjs`)

| Luật | App | Web đối chiếu |
|---|---|---|
| Trùng khách: cấu hình `cloud_catalogs` `customer_duplicate/default` (theo `ma_ctdk_uid`), mặc định **block** mọi tiêu chí; mức bảo vệ (HĐ/cọc → block, giữ chỗ/chăm sóc gần → request…); khách do chính mình tạo → `ownDuplicateMode`. Kết quả allow (lưu) / request (gửi `cloud_customer_dup_requests` + log) / block (không lưu). Sửa khách bỏ qua chính nó. Doanh nghiệp chỉ kiểm MST. **Không kiểm trùng họ tên / tên công ty** (khác web – nhiều người trùng tên, spec 0.2 #8). | `CustomerRulesService.checkDuplicate`, `createDuplicateRequest` | `services/CustomerDuplicateService.ts`, `CustomerDuplicateConfigService.ts`, `CustomerDupRequestService.ts`, `components/Customers/DuplicateGuardModal.tsx` |
| Bắt buộc nhập: `cloud_required_field_configs` (form `customer` / `customer_org`; đại lý cá nhân `agency_customer`), bỏ trường bị ẩn và key ngoài danh mục form web. Trường app không có trên form → chặn lưu, hướng dẫn nhập trên web. | `getFormRules` + `checkRequired` | `services/RequiredFieldService.ts`, `config/requiredFieldCatalog.ts` |
| Ẩn / chỉ đọc trường: `cloud_field_visibility_configs` chung + theo nhóm quyền (claim `per_id`, rồi `dm_employees.perm_group_uid`); `is_full_access` không bị ẩn | `getFormRules` | `services/FieldVisibilityService.ts` |
| Khoá định danh khi có lịch ký cá nhân (`cloud_signing_appointments`): tên + CCCD (DN: tên + MST) | `hasIdentityLock` | `services/CustomerIdentityLockService.ts` |
| Xoá: chặn khi có `cloud_pre_bookings` (thông báo như web) + giữ chặn khi có phiếu giữ chỗ/booking; xoá 0 dòng → báo lỗi | `deleteCustomer` | `pages/Customers/CustomerList/index.tsx` |

- Sửa khách chỉ PATCH các cột form app quản lý (`APP_EDIT_COLUMNS`) – không ghi đè dữ liệu chỉ nhập trên web.
- Danh sách che SĐT như web (`maskPhone`); chi tiết hiện đủ.

## Bẫy đã gặp

- `cloud_pgc_phieu_giucho` **không có** cột `tong_gia_tri`, `tien_giu_cho` (dùng `gia_tri_hd`, `gia_tri_hd_sau_ck`, `tien_coc`).
- Tạo khách từ booking: phải trả param **`newCustomer`** (không phải `createdCustomer`) và dùng `router.dismissTo`.
- Đổi Cá nhân ↔ DN: CCCD chỉ gửi khi cá nhân; MST TNCN và MST DN giữ riêng từng loại (`customerSavePayload`).

## Tồn đọng

- Nhật ký chăm sóc trên chi tiết khách: đang ẩn (chưa làm lại).
- Web có `findApprovalFor` (yêu cầu trùng đã duyệt) nhưng không dùng → người được duyệt vẫn bị chặn (spec 0.2 #3). App làm giống web.
- Nhánh tra nhóm quyền qua bảng phụ của web (`PermissionMatrixService.resolveGroupUid` bước 3) chưa port.

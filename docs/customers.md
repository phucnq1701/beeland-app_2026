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

## Dữ liệu

Service `services/CustomerService.ts`, `services/CustomerRulesService.ts`, `services/customerLookup.ts`. SP app bọc đúng SP web;
công ty / nhân viên / nhóm quyền / phạm vi (`_customer_scope_ids`) lấy từ phiên. Lỗi máy chủ ⇒ hiện nguyên `message`.

| Việc | Hàm | Endpoint (= SP web) |
|---|---|---|
| Danh mục trạng thái / nguồn của công ty | `getTrangThaiCatalogs`, `getNguonCatalogs` | `fn_nv_app_danh_muc { p_loai: trang_thai_kh \| nguon_kh }` (như web `listCatalogFromCloud`) |
| Danh sách | `getCustomers` | `fn_nv_app_khach_hang_list` (`fn_customer_list`: tìm, cá nhân / DN, trạng thái, trang) |
| Chi tiết (màn Khách hàng › chi tiết / sửa) | `getCustomerDetailCloud` | `fn_nv_app_khach_hang_chi_tiet` (`fn_customer_get`: cần quyền xem màn Khách hàng, theo phạm vi; nhận cả mã KH). Null ⇒ "Không tìm thấy". Bản giới hạn (`limited`, chỉ thấy qua chứng từ): CCCD che ở `cccd_masked`, ẩn Sửa/Xoá |
| Lưu (tạo / sửa) | `saveCustomerCloud` | `fn_nv_app_khach_hang_luu` (`fn_customer_save(p_row, p_scoped = true)`): quyền + phạm vi, chống trùng, khoá sửa theo giao dịch, **cấp mã khách**, tự đặt id / công ty (sàn đại lý ‖ công ty NV) / người tạo-sửa. Trả uuid ⇒ đọc lại chi tiết. Sửa chỉ gửi `id` + cột `APP_EDIT_COLUMNS` |
| Xoá | `deleteCustomer` | `fn_nv_app_khach_hang_xoa` (`fn_customer_delete`: phạm vi + quyền xoá, chặn khi còn booking / HĐ / chứng từ) |
| Giao dịch của khách | `getHopDong` → `getCustomerTransactions` | `fn_nv_app_khach_hang_giao_dich` (phiếu theo phạm vi giao dịch web, kèm ký hiệu căn / dự án / trạng thái) |
| Ghi chú khách | `customerSavePayload` (`ghiChu`) → `saveCustomerCloud` | cột `ghi_chu` (người dùng thêm 2026-10-02; **chỉ app dùng, web chưa hiển thị**). Có ở cả tạo và sửa; trống → `null`; nơi gọi không gửi `ghiChu` thì giữ nguyên |
| Ô chọn khách ở màn khác (booking, lịch ký, phiếu tính giá, chat) | `pickCustomers` | `fn_nv_app_khach_hang_chon` (`fn_customer_picker`): không cần quyền màn Khách hàng, từ khoá **≥ 2 ký tự**, ≤ 50 dòng |
| Một khách cho màn khác (form lịch ký, khách trùng khi quay về booking / lịch ký) | `getCustomerById` | `fn_nv_app_khach_hang_theo_id` (`fn_customer_get_by_ids`); bản giới hạn ⇒ CCCD trống, che ở `cccd_masked` |
| Luật trùng / bắt buộc / ẩn / khoá | `CustomerRulesService` | bảng dưới |

## Quy tắc (chép web – logic thuần `lib/customerRules.ts`, test `tests/customer-rules*.test.cjs`)

| Luật | App | Endpoint (= SP web) |
|---|---|---|
| Trùng khách: cấu hình công ty, **tiêu chí chưa cài = không kiểm** (như web 2026-11; BRG: CCCD chặn). Kiểm = 1 lời gọi (máy chủ khớp trong công ty, trả số liệu bảo vệ `txn_total`, `has_contract/deposit/booking`, `care_count`, `last_care_at`, `created_at` + `owner_name` → `protectionFromStats`); khách do chính mình tạo → `ownDuplicateMode`. Ngoài phạm vi (`in_scope=false`) ⇒ chỉ tên che + công ty (`outOfScope`); `limited` = chỉ thấy qua chứng từ. Form Khách hàng gửi `{ scoped: true }` (luôn dò CCCD/SĐT, ngoài phạm vi ⇒ `request`). Kết quả allow / request (gửi yêu cầu – người gửi / nhật ký máy chủ tự ghi) / block. Sửa khách bỏ qua chính nó. Doanh nghiệp chỉ kiểm MST. **Không kiểm trùng họ tên / tên công ty** (khác web, spec 0.2 #8) | `getDuplicateConfig`, `checkDuplicate`, `createDuplicateRequest`, `components/customer/DuplicateSheet.tsx` | `fn_nv_app_trung_cau_hinh` (`fn_customer_dup_config_get`), `fn_nv_app_trung_kiem` (`fn_customer_duplicate_check`), `fn_nv_app_trung_yeu_cau_tao` (`fn_customer_dup_request_create`) |
| Bắt buộc / ẩn / chỉ xem: cấu hình hiệu lực của người dùng phiên (theo nhóm quyền, phạm vi SYSTEM / AGENCY) + luật web chép (`lib/web` `fieldConfigRules` / catalog: trường khoá luôn bắt buộc; ẩn / chỉ xem thì không bắt buộc; trường ngoài danh mục form bỏ qua). Form `customer` / `customer_org`. Tải lỗi lúc lưu ⇒ **chặn** như web (`FIELD_CONFIG_LOAD_FAILED`). Đệm 60 s | `getFormRules`, `getRulesForForm` | `fn_nv_app_cau_hinh_truong` (`fn_field_config_effective`) |
| Khoá định danh khi có lịch ký cá nhân: tên + CCCD (DN: tên + MST) | `hasIdentityLock` | `fn_nv_app_khoa_dinh_danh` |
| Khoá sửa theo giao dịch: khách chính / đồng sở hữu của giao dịch "Đặt cọc đã duyệt" (13) / "HĐMB đã duyệt" (14) ⇒ màn Sửa chỉ xem + `CUSTOMER_TX_LOCK_MESSAGE` | `hasTxLock` | `fn_nv_app_khoa_giao_dich` (`fn_customer_tx_lock`) |
| Xoá: máy chủ chặn khi còn booking / chứng từ | `deleteCustomer` | `fn_nv_app_khach_hang_xoa` |

- Sửa khách chỉ gửi các cột form app quản lý (`APP_EDIT_COLUMNS`) – máy chủ ghép lên bản ghi cũ, không ghi đè dữ liệu chỉ nhập trên web.
- Danh sách che SĐT như web (`maskPhone`); chi tiết hiện đủ.

## Bẫy đã gặp

- Tạo khách từ booking: phải trả param **`newCustomer`** (không phải `createdCustomer`) và dùng `router.dismissTo`.
- Đổi Cá nhân ↔ DN: CCCD chỉ gửi khi cá nhân; MST TNCN và MST DN giữ riêng từng loại (`customerSavePayload`).

## Tồn đọng

- Nhật ký chăm sóc, ảnh CCCD, lịch sử làm việc: app chưa có (đã bỏ hàm cũ).
- Web có `findApprovalFor` (yêu cầu trùng đã duyệt) nhưng không dùng → người được duyệt vẫn bị chặn (spec 0.2 #3). App cũng chưa có.
- Máy chủ kiểm trùng không trả `is_personal` / `email`: `DuplicateMatch.isPersonal` suy từ (khớp MST hoặc chỉ có tên công ty), `email` = null.
- Trường có điều kiện (`when`, vd chỉ doanh nghiệp) không vào danh sách bắt buộc tĩnh của form khách.

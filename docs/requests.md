# Yêu cầu khách hàng

Nhân viên tiếp nhận / xử lý yêu cầu, phản ánh của khách. Như web menu **Khách hàng › Tiếp nhận yêu cầu › Yêu cầu khách hàng**
(`beeland/src/pages/customers/tiep-nhan-yeu-cau/yeu-cau-khach-hang/*` + `services/CustomerRequest.js`; tài liệu web
`beeland/docs-claude/08-features/customer-requests.md`). Tính năng id **15** (`/requests`), **chỉ tài khoản nội bộ** (như Khách hàng,
không có trong `AGENCY_FEATURE_IDS`). Yêu cầu khách tự gửi từ **app khách hàng** (`beeland-app-KH`, nguồn "App khách hàng") / web khách
hàng nằm chung bảng nên hiện ngay ở đây; nội dung nhân viên "Cập nhật xử lý" hiện cho khách trong mục "Phản hồi từ chủ đầu tư".

## Màn

| Màn | File |
|---|---|
| Danh sách: ô tìm `soft` (mã YC, khách, SĐT, email, tiêu đề), chip trạng thái (danh mục công ty), Bộ lọc: Thời gian tiếp nhận (mặc định **Tháng này** như web; Tất cả / Hôm nay / Tuần / Năm), Dự án, Nguồn, Mức ưu tiên. Tải 30 dòng/trang, cuộn để tải thêm. Card bo `radius.xxl` (`RequestRowItem`): mã YC · nguồn \| trạng thái; tiêu đề 2 dòng; khách · SĐT; ngày tiếp nhận · người xử lý \| số tệp, ưu tiên hoặc "Quá hạn". Nút nổi "Tiếp nhận" | `app/requests.tsx`, `components/request/RequestRowItem.tsx` |
| Chi tiết: khối navy (mã · nguồn, trạng thái, tiêu đề, giờ tiếp nhận, hạn/Quá hạn, ưu tiên, loại); card Khách hàng (nút gọi, sao chép SĐT/email, dự án, hợp đồng/phiếu); Phân loại & phân công; Nội dung + Ghi chú nội bộ (nền vàng, "khách không thấy"); Hình ảnh & tài liệu; Lịch sử xử lý (dòng thời gian). Nút dưới: "Sửa" + "Cập nhật xử lý"; menu ⋯: sửa, xoá (`confirm`) | `app/request/[id].tsx`, `components/request/RequestTimeline.tsx` |
| Cập nhật xử lý: chọn trạng thái mới (không chọn = giữ nguyên, đánh dấu "Hiện tại") + nội dung xử lý (bắt buộc, ≤ 2000) | `app/request/process.tsx` |
| Tiếp nhận / sửa: card Khách hàng (chọn từ danh sách khách → khoá tên/SĐT/email, nút X để nhập tay), Dự án & hợp đồng, Nội dung yêu cầu, Phân loại & phân công (nguồn, ưu tiên, trạng thái, hạn ngày + giờ, người tiếp nhận, người xử lý, ghi chú nội bộ), Hình ảnh / tài liệu. Thêm mới xong → mở chi tiết | `app/request/form.tsx` |

## Dữ liệu (`services/CustomerRequestService.ts`)

SP app bọc đúng SP web `fn_customer_request_*`; công ty / người thao tác máy chủ lấy từ phiên – app không gửi.

| Việc | Hàm | Endpoint (= SP web) |
|---|---|---|
| Danh sách | `list` | `fn_nv_app_yeu_cau_list` (`p_keyword`, `p_ma_da`, `p_nguon`, `p_trang_thai`, `p_uu_tien`, `p_tu_ngay`/`p_den_ngay` `YYYY-MM-DD` giờ VN, `p_page`, `p_size`; phạm vi máy chủ cắt) → `{rows, total}` |
| Chi tiết / lưu / xoá | `get`, `save`, `remove` | `fn_nv_app_yeu_cau_chi_tiet` (kèm `SoHD` = số phiếu của HĐ liên quan), `fn_nv_app_yeu_cau_luu` (JSON kiểu cũ MaKH/TieuDe/State…, **lưu đè toàn bộ trường**), `fn_nv_app_yeu_cau_xoa` (xoá mềm) |
| Cập nhật xử lý / lịch sử | `process`, `logs` | `fn_nv_app_yeu_cau_xu_ly`, `fn_nv_app_yeu_cau_nhat_ky` |
| Danh mục loại / nguồn / ưu tiên / trạng thái | `catalogs` | `fn_nv_app_danh_muc` (`dm_*_yeu_cau` của công ty) – **chỉ đọc**; rỗng/lỗi → bộ cố định của web |
| Người tiếp nhận / xử lý | `employees` | `fn_nv_app_nhan_vien_list` (như web `NhanVienService.getList`); giá trị = `ma_nv` |
| Hợp đồng / phiếu của khách | `CustomerService.getCustomerTransactions` | `fn_nv_app_khach_hang_giao_dich`; lưu uuid phiếu vào `MaHD` (máy chủ gán `pgc_id`) – như app khách hàng gửi |
| Nhãn hợp đồng | `contractLabel(contractId, SoHD)` | `SoHD` máy chủ trả; mã cũ (không phải uuid) giữ nguyên; uuid không có số ⇒ hiện mã |
| Xem tệp khách gửi (`drive-files:<path>`, kho riêng tư) | `resolveAttachments` | `fn_nv_app_yeu_cau_tep_ky { p_id, p_path }` → link 1 giờ (máy chủ chỉ ký khi yêu cầu xem được + tệp thuộc yêu cầu); URL ký nội bộ `…/storage/v1/…` đổi về `API_URL` (`toPublicStorageUrl`); link khác → `fileUrl` |
| Thêm tệp | `upload` | `uploadTenantFile(file, "yeu-cau")` (`fn_nv_app_tai_tep`) → luôn lưu **URL tuyệt đối** (web hiển thị trực tiếp) |

Tài khoản không có quyền "Yêu cầu khách hàng" (vd MSR) ⇒ lời máy chủ hiện nguyên.

## Quy tắc (logic thuần `lib/customerRequest.ts`, test `tests/customer-request.test.cjs`)

- Mã danh mục: `ID = raw.ID ?? item_code ?? raw[MaLoai|MaNguon|MucUuTien|State] ?? raw.Code` – cùng khoá `_ccr_json` trả về; bỏ trùng,
  mục cố định (`consult…`, `hotline…`, `low…`, `new…`) lên đầu. Màu = `raw.Color` (preset antd) → `StatusBadge`.
- Bắt buộc như web: Dự án, Tên khách hàng, Tiêu đề. Ô chọn danh mục có "Không chọn"; mã đang lưu không còn trong danh mục vẫn hiện để lưu lại không mất.
- Dự án: ô chọn dùng uuid; mở yêu cầu cũ đổi `MaDA` (mã hoặc uuid) → uuid (`projectValueOf`, như web `projectCodeOf`); lưu gửi `ma_da_code`
  (thiếu thì uuid). Dự án cũ không còn trong danh sách → vẫn lưu giá trị cũ, ô hiện tên cũ làm gợi ý.
- **Yêu cầu khách tự gửi – giữ nguyên nội dung khách gửi** (người dùng yêu cầu 2026-10-07): máy chủ đánh dấu `created_by = 'PORTAL'`
  nhưng `_ccr_json` không trả cột này (app không đọc bảng) ⇒ `createdBy` = null, nhận biết theo **nguồn `app`/`website`**
  (`isCustomerSubmitted`; yêu cầu nhân viên nhập với nguồn Website cũng bị khoá nội dung – nghiêng về an toàn).
  Form sửa hiện băng "Yêu cầu do khách gửi…" và ô khoá (`LockedValue`, viền nét đứt + biểu tượng khoá) cho: tên / SĐT / email khách,
  hợp đồng, tiêu đề, nội dung, nguồn; dự án và loại chỉ khoá khi khách đã có (trống thì nhân viên bổ sung – dự án bắt buộc).
  Tệp khách tải lên (`drive-files:`) không xoá được, nhân viên vẫn thêm / xoá tệp của mình. Khi lưu, các trường khoá luôn gửi lại
  **giá trị gốc** (không lấy từ form) vì máy chủ ghi đè toàn bộ trường (`lockedFields`, `isLockedAttachment`). Sửa được: trạng thái,
  ưu tiên, hạn, người tiếp nhận / xử lý, ghi chú nội bộ. Chi tiết hiện nhãn "Khách tự gửi", card "Nội dung khách gửi".
- Hợp đồng chỉ chọn được khi khách được chọn từ danh sách (cần uuid khách); đổi khách → bỏ hợp đồng; chọn hợp đồng → tự đặt dự án của phiếu.
- Hạn xử lý: ngày + giờ (30 phút, mặc định 17:00; chọn giờ khi chưa có ngày → hôm nay); lưu `…+07:00`, đọc ra giờ VN (`splitDue`).
- Quá hạn: có hạn, đã qua, trạng thái không phải `completed`/`closed`/`cancelled` (như báo cáo web).
- Tệp đính kèm khi lưu đổi URL ký về `drive-files:<path>` (`toStored`, như web) để không lưu link hết hạn.
- **Khác web:** tiếp nhận mới mặc định trạng thái `new`, ưu tiên `normal`, người tiếp nhận = mã NV đăng nhập (nếu có trong danh sách).
  Web chọn hợp đồng bằng tìm toàn bộ HĐ (`ReceiptsPay.DanhMuc.getHDMB`) và tự điền khách; app làm ngược lại (chọn khách → giao dịch của khách).
  Hạn xử lý gửi kèm múi giờ (spec 0.2 mục 9).

## Bẫy

- Lưu (`fn_customer_request_save`) ghi đè **mọi** cột khi sửa → form sửa phải nạp đủ và gửi lại mọi trường (kể cả mã danh mục lạ, hợp đồng mã cũ).
- `DateField` có `variant="soft"` (thêm cho form này); `CustomerPickerSheet` trả thêm `email`, `onAddNew` không bắt buộc (không truyền → ẩn nút thêm khách).

## Tồn đọng

- Cần máy chủ trả `created_by` (hoặc cờ "khách gửi") trong `_ccr_json` để nhận biết chính xác yêu cầu khách tự gửi (hiện đoán theo nguồn).
- Khoá nội dung khách gửi mới làm ở app; web và máy chủ (`fn_customer_request_save`) vẫn cho sửa (spec 0.2 mục 10).

- Chưa có Báo cáo yêu cầu (web `bao-cao-yeu-cau`), màn Danh mục / Cấu hình tổng đài – làm trên web.
- Chưa báo (push) cho nhân viên khi khách gửi yêu cầu mới (web cũng chưa có).
- Đã thử trên máy ảo (danh sách + chi tiết) với API chạy máy; chưa thử thêm tệp / lưu thật (ghi prod).

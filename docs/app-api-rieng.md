# App nhân viên — bộ API riêng (.NET + SQL Server)

Bắt đầu 2026-11-16. Người dùng giao toàn quyền làm từ đầu đến cuối (BE + app), điều kiện: **không ảnh hưởng luồng web** — chỗ nào
phải đụng SP/bảng/endpoint web đang dùng thì DỪNG hỏi.

## Quyết định đã chốt (2026-11-16)
1. Phạm vi: rà + làm lại TOÀN BỘ app, cả đọc lẫn ghi.
2. **Lõi chung**: SP app dùng chung hàm lõi với web (phạm vi `app_agency_product_ids`, `_da_project_scope`, `_ds_*`, quyền
   `_perm_guard`/`app_has_perm`, che trường `_fm_*`, trạng thái…). Đọc: SP app tự chọn ít cột, trả đúng dạng app cần.
   Ghi: SP app gọi lại SP ghi của web (không viết lại nghiệp vụ).
3. Tên: route `api/app-nhan-vien/fn_nv_app_*` ↔ `dbo.usp_nv_app_*`, thư mục `database/sp/63_app_nhan_vien/`,
   C# module `AppNhanVien`.
4. Bỏ hẳn Supabase: không `rest/v1`, `functions/v1`, `storage/v1`, `apikey`, không gọi API cũ `api-beeland.beesky.vn`.
5. Claude viết cả SP + C# + app; người dùng build/deploy API.

## Nhánh / thư mục
- BE: `_wt/be-app-nv` nhánh `app-nhan-vien` (từ origin/main 40145206).
- App: `_wt/app-nv` nhánh `app-nhan-vien-api` (từ devhuan2 d1cfbd32).
- Web tham chiếu (chỉ đọc): `_wt/web-ref` = origin/main web 71720aeb.
- Script thử: `_wt/app_nv_scripts/q.py` (mọi thứ trong 1 lô BEGIN TRAN … ROLLBACK; `--as login@ma_ctdk` giả lập phiên).

## Quy tắc thử trên BEELAND26 (prod duy nhất)
- Đọc/nạp thử SP: chỉ qua q.py (rollback). Không chạy lặp bộ nạp lớn (log đầy 9002).
- Triển khai thật: chỉ đối tượng MỚI (`usp_nv_app_*`, `_nv_app_*`), không ALTER đối tượng web.

## Thứ tự làm — THEO LUỒNG (16-11: user dặn làm liền mạch từng luồng, không rời rạc; giữ nguyên luồng app, không thêm luồng web mới)
App chủ yếu dùng để bán hàng (lock → booking → đặt cọc). Mỗi luồng làm trọn: SP (lõi chung) → so với web → C# → app → test
xuyên luồng trên máy ảo, xong mới sang luồng sau.

| # | Luồng | Gồm | Trạng thái |
|---|---|---|---|
| L0 | Đăng nhập & phiên | đăng nhập / làm mới / đăng xuất / hết phiên, Face ID kiểm MK, hồ sơ | XONG (chờ deploy API) |
| L1 | Bán hàng từ căn | Dự án → Sản phẩm (DS / lưới / tổng quan) → Chi tiết căn ✔ · Lock căn → Căn đã lock → Tạo booking (chọn / tạo khách, sàn, giá theo bảng giá & chính sách, ảnh chứng từ, QR thanh toán) → DS / chi tiết Booking → Đặt cọc (DS / chi tiết / QR) → Hợp đồng + tiến độ TT · Phiếu tính giá: xem / xoá / lịch sử (duyệt: web; lập / sửa: tạm khoá, viết lại form khớp web ở cuối luồng) | ĐANG LÀM (DA/SP xong; BE phiếu tính giá + cấu hình bán hàng xong) |
| L2 | Khách hàng | DS / chi tiết / thêm / sửa, trùng khách, yêu cầu KH, luật nhập | |
| L3 | Lịch ký & báo cáo | đặt lịch ký (đại lý), lịch hẹn (ẩn), báo cáo | |
| L4 | Liên lạc & tài khoản | chat, thông báo, tài liệu / ảnh, đổi-quên MK, xoá TK, realtime, upload chung | |
| L5 | Dọn & test toàn bộ | bỏ sevicesSupabase / sevices cũ, đổi khoá lưu, kịch bản e2e toàn app | |

Bảng kê chi tiết từng lệnh gọi (2026-11-16): xem `docs/app-api-inventory/` (A sản phẩm, B bán hàng, C khách hàng, D lõi).

## Nhật ký
### 2026-11-16 — Phần 0 + 1
- BE (`_wt/be-app-nv`): module `AppNhanVien` — `NvAppAuthController` (fn_nv_app_dang_nhap / lam_moi_phien / dang_xuat, bọc
  CloudAuthService: lỗi ⇒ HTTP thật) + `NvAppSanPhamController` (5 endpoint) + SP `63_app_nhan_vien/10–14`. Unit test 7/7.
- SP đã triển khai BEELAND26 (5 đối tượng mới, `_wt/app_nv_scripts/deploy.py`, gỡ: `--rollback`). API CHƯA deploy.
- So sánh với SP web trên 19 tài khoản (BRG/MSR/Mega/mgltest, đại lý / nội bộ / toàn quyền) — `cmp.py du_an|san_pham_list|so_do|
  chi_tiet|khoa|bo_loc`: ĐẠT hết (danh sách: cùng thứ tự id + tổng ở 172 ca).
- App (`_wt/app-nv`): `services/` (config, session, nvApi, AuthApi, SanPhamApi) + `lib/jwt.ts`, `lib/nvSanPham.ts`; Login/Đăng xuất/
  Hồ sơ/Face ID kiểm MK chuyển API riêng; phiên tự làm mới (JWT < 1 ngày / 401), hết phiên ⇒ SessionGuard về Đăng nhập;
  Dự án / Sản phẩm (danh sách, khu, trạng thái, sơ đồ, chi tiết + ảnh + giá + lock) qua API riêng. Test 304 đạt, tsc sạch.
- Lệch web chờ quyết định: nút Lock / Booking ở chi tiết căn — web ẩn theo nhóm quyền (LOCK/BOOKING của /products/high-rise|low-rise),
  app đang hiện cho mọi người khi căn "Mở bán". API đã trả `quyen`.

### 2026-11-16 — L1: phiếu tính giá + cấu hình bán hàng (BE)
- 16 SP mới đã lên BEELAND26 (20–22, 24–36; bỏ 23 duyệt — duyệt để web). BE commit 67c7a037. So HTTP app ↔ web (5 tài khoản): giống hệt.
- Quyết định user: duyệt phiếu tính giá tạm để web; lập / sửa phiếu tạm khoá trên app ("lập trên web") tới khi form khớp web.

### 2026-11-16 — L1: lock căn + booking (BE xong, app đang nối)
- App: phiếu tính giá chuyển API riêng (commit 11a3d219): bỏ Duyệt / Từ chối (duyệt trên web), khoá Lập / Sửa
  (`PRICE_SHEET_CREATE_LOCKED` trong lib/featureConfig.ts) — mở lại khi viết lại form khớp web (cuối L1).
- BE 4c5a197e: SP 40–43 lock (tạo 1 giao dịch, list, chi tiết, hết hạn = fn_product_lock_expire_due trả căn về 2),
  50 booking_tao (máy chủ điền công ty / người nhập / ngày / tiền giữ chỗ / hạn như web), 51 booking_chi_tiet (1 lời gọi,
  phạm vi + che = fn_sales_doc_get), 52 booking_list. Đã lên BEELAND26; thử rollback: lock 2→18, hết hạn 18→2, booking
  tiền / hạn đúng cài đặt dù app gửi số sai.
- Việc tiếp (app): BookingService createLock / listProductLocks / getLockDetailCloud / sweepExpiredLocks / createBooking /
  listBookings / getBookingEditDetail ⇒ fn_nv_app_*; rồi: chứng từ booking (ảnh), QR thanh toán (payment-gateway), sàn GD,
  cấu hình bán hàng của form booking, Đặt cọc (list / chi tiết / QR), Hợp đồng, Tiến độ TT, chọn / tạo khách trong booking.

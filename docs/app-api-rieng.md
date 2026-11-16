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

## Các phần (làm lần lượt, xong phần nào test kỹ phần đó)
| # | Phần | Trạng thái |
|---|---|---|
| 0 | Hạ tầng: client app gọi `/api/app-nhan-vien/*`, đăng nhập/làm mới phiên/đăng xuất, khung C# + SP | XONG code + test (chờ deploy API) |
| 1 | Dự án + Sản phẩm (danh sách, bộ lọc, sơ đồ, chi tiết, ảnh, đếm ngược khoá, giá đang áp dụng) | XONG; SP đã lên BEELAND26 16-11; chờ deploy API; sàn GD chuyển sang phần 3 |
| 2 | Phiếu tính giá | |
| 3 | Booking / Khoá căn / Đặt cọc / Hợp đồng / Tiến độ TT / Cổng thanh toán | |
| 4 | Lịch ký / Lịch hẹn / Báo cáo | |
| 5 | Khách hàng / Yêu cầu KH / Luật nhập / Trùng khách | |
| 6 | Tài liệu / Thông báo / Hồ sơ / Đổi-quên MK / Xoá tài khoản | |
| 7 | Chat / Upload / Kho tệp / Realtime | |
| 8 | Dọn code chết + test toàn bộ | |

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

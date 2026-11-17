# Phân quyền như web (menu + nút)

Đợt 2026-11-17, nhánh `app-nv-phan-quyen` (commit 0e93ac35). User chốt: (1) bảng module ↔ màn web dưới đây, (2) máy chủ chặn
**như web** (không thêm chặn mới ở SP app), (3) **đại lý giữ như cũ**.

## Trước / sau

| | Trước | Sau |
|---|---|---|
| Dữ liệu được xem | Theo web (SP app gọi lõi web: công ty / sàn đại lý, dự án, "chỉ của mình", giỏ đại lý, che trường) | Không đổi |
| Module ở menu | Cố định, chỉ tách đại lý / nội bộ | Nội bộ: theo nhóm quyền đúng luật menu web. Đại lý: như cũ |
| Nút trong màn | Chỉ Chi tiết căn (Lock/Booking/Cọc/HĐ/PTG), Phiếu tính giá, QR hỏi quyền | Thêm: KH, Yêu cầu, Lịch ký, Đặt lịch ký từ cọc, Tạo booking từ lock |

## Menu — luật `getMenuPermission` của web (src/lib/menuPermissions.ts)

Nguồn: phiên đăng nhập / làm mới (`fn_nv_app_dang_nhap` / `fn_nv_app_lam_moi_phien`) trả `nguoi_dung.menu` (đường dẫn form người
dùng được cấp = localStorage `menu` của web) và `nguoi_dung.menu_cong_ty` (form công ty đăng ký = `menu_congty`).
Code: `lib/permissions.ts` (`menuFormGate`, `moduleAllowed`, `MODULE_FORMS`); `services/session.ts getSessionInfo()` đặt cổng cho
`lib/featureConfig.ts` (`setMenuGate` → `isFeatureAllowed`) — Trang chủ (lưới + mục gần đây), Tất cả quản lý, tab menu, Tài khoản.

- 2 danh sách rỗng / phiên cũ không có ⇒ **hiện hết** (như web khi chưa có dữ liệu).
- Toàn quyền ⇒ form công ty; có cả 2 ⇒ giao; chỉ 1 ⇒ danh sách đó (người chưa gán nhóm ⇒ thấy form công ty, như web).
- Module hiện khi ÍT NHẤT 1 màn tương ứng được mở:

| id | Module | Màn web |
|---|---|---|
| 1 | Dự án | /projects/management |
| 2 | Sản phẩm | /products/high-rise, /products/low-rise |
| 4 | Lock căn | /sales/locks |
| 5 | Booking | /sales/bookings |
| 6 | Khách hàng | /customers/list |
| 8 | Hợp đồng | /contracts/list |
| 9 | Báo cáo | /reports/debt-interest (FormID 862, dùng chung với /reports/debt-progress) |
| 13 | Đặt cọc | /sales/deposits |
| 14 | Đặt lịch ký | /sales/signing-appointments |
| 15 | Yêu cầu KH | /customers/requests |
| 16 | Tin nhắn | **không gắn** — luôn hiện (web để nút chat ở thanh trên cho mọi người) |
| 17 | Phiếu tính giá | /products/price-sheet |

Ảnh hưởng thấy ngay (tính 17-11 trên dữ liệu thật): BRG không đăng ký `/sales/locks` ⇒ **mất module Lock căn** (web BRG cũng không có
menu này; lock từ chi tiết căn vẫn dùng được). MSR chỉ còn Dự án / Sản phẩm / KH / Cọc / Lịch ký / Tin nhắn.

## Nút — như web `usePerm(form)`

`services/PermissionService.ts`: `usePerm(form)` → `can("ADD")`… từ `fn_nv_app_quyen_man` (1 lời gọi cho mọi màn ở `APP_FORMS`,
giữ 10 phút theo công ty | nhóm quyền | nhân viên; mở màn ⇒ nạp lại nếu quá hạn). Luật máy chủ = `fn_perm_form_features` của web.

| Màn | Nút | Mã (màn web) |
|---|---|---|
| Khách hàng (danh sách / chi tiết) | Thêm / Sửa / Xoá | ADD / EDIT / DELETE (/customers/list) |
| Yêu cầu KH | Tiếp nhận / Sửa + Cập nhật xử lý / Xoá | ADD / EDIT / DELETE (/customers/requests) |
| Lịch ký | Thêm / Sửa / Xoá | ADD / EDIT / DELETE (/sales/signing-appointments) |
| Chi tiết đặt cọc | Đặt lịch ký | SIGNING (/sales/deposits) + phiếu đã cọc (MaTT 13/24/25) |
| Chi tiết căn đã lock | Tạo booking | BOOKING (/sales/locks); đại lý: như cũ (BOOKING theo loại căn) |

- Đang tải / lỗi mạng ⇒ ẩn nút (như web, máy chủ vẫn chặn). **Máy chủ chưa có endpoint (404) ⇒ không ẩn gì** (hành vi cũ).
- Đại lý ⇒ `can()` luôn đúng (như cũ).

## Kiểm

`tests/permissions.test.cjs` (luật menu từng nhánh, module, mã tính năng, cổng featureConfig). Máy ảo trỏ API prod (chưa deploy) ⇒
không đổi gì (đã thử 17-11). Endpoint gọi thử qua API local với 5 tài khoản thật (admin BRG đủ mã, nhóm Đại lý MSR đúng mã nhóm, người
chưa gán nhóm rỗng).

## Quay lại (rollback)

- **Nhanh, không cần phát hành app:** bỏ 2 trường `menu` / `menu_cong_ty` khỏi `NvAppAuthService.Map` (BE) và/hoặc gỡ endpoint
  `fn_nv_app_quyen_man` (`DROP PROCEDURE dbo.usp_nv_app_quyen_man`, xoá NvAppPhanQuyen*) ⇒ app tự về như cũ (không có menu ⇒ hiện hết;
  endpoint 404 ⇒ không ẩn nút). Người dùng phải đăng nhập lại / chờ làm mới phiên để mất trường menu cũ đã lưu.
- **Trong app:** `git revert 0e93ac35` (nhánh này), hoặc tạm `setMenuGate` không đặt trong `getSessionInfo` + `canNow` trả true.
- Đổi ánh xạ module ↔ màn: chỉ sửa `MODULE_FORMS` / `FORM` trong `lib/permissions.ts` (+ test).

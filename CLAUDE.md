# Beeland Sales – app mobile (beeland-app_2026)

App bán hàng bất động sản cho **nhân viên kinh doanh nội bộ và đại lý**: xem dự án/căn, lock căn, tạo booking,
thu tiền booking qua QR, theo dõi khách hàng, đặt cọc, hợp đồng, báo cáo. Đăng nhập theo mã công ty (đa công ty).

- **Stack:** Expo 54, React Native 0.81 (old arch), expo-router 6, TypeScript strict, lucide-react-native,
  TanStack Query (ít dùng), SignalR (`ChangeTable`), Supabase self-host qua REST/RPC (axios), một số màn còn gọi API .NET cũ.
- **Web cùng workspace:** `../beeland` (React + Vite) – **chuẩn nghiệp vụ**.
- **Server dữ liệu:** `https://api-beelandv2.beesky.vn` (cố định trong `sevicesSupabase/axiosApiSupabase.ts`, không có môi
  trường test riêng → mọi thao tác ghi là **dữ liệu thật**). API cũ: `https://api-beeland.beesky.vn` (`sevices/axiosApi.ts`).

## Lệnh

| Việc | Lệnh |
|---|---|
| Chạy (thiết bị / tunnel) | `npx expo start --tunnel` · web: `npx expo start --web` |
| Test (node:test) | `node --test tests/` |
| Kiểu | `npx tsc --noEmit` (còn 4 lỗi cũ ở `components/UpdateManager.tsx`) |
| Lint | `npx expo lint` (còn 2 lỗi cũ ở `app/receipts.tsx` – màn mẫu) |
| Kiểm bundle | `npx expo export --platform ios --output-dir .expo/export-check` (xong xoá thư mục) |
| Build / OTA | `eas build …`, `eas update …` – **chỉ chạy khi người dùng yêu cầu rõ** |

Test: `tests/*.test.cjs`, nạp TS bằng `tests/helpers/loadTs.cjs` (file thuần không import) hoặc harness vm tự chứa
(xem `tests/booking-write.test.cjs`) khi cần giả axios/AsyncStorage. So sánh object khác realm qua `JSON.parse(JSON.stringify())`.

## Quy tắc bắt buộc

1. **Web `../beeland` là chuẩn nghiệp vụ.** Số tiền, trạng thái, điều kiện thao tác (lock/booking/cọc…) phải giống web.
   Chưa rõ → đọc code web và làm theo, không đoán. Web mâu thuẫn hoặc không có quy định → làm theo web, ghi vào
   `docs/superpowers/specs/2026-09-30-ui-redesign-design.md` mục **0.2** và báo người dùng. Ghi nguồn file web trong chú thích.
2. **Không sửa phía server:** không đụng hàm SQL, migration, edge function, bảng, trigger, RLS, dữ liệu Supabase.
   Chỉ sửa code app. Lỗi server → ghi spec 0.2 + báo.
3. **Giao diện:** chỉ dùng token trong `@/theme` (`colors`, `space`, `radius`, `typography`, `fontStyleFor`) và component
   trong `components/ui` (import `@/components/ui`). File trong `UI_STRICT_FILES` (`eslint.config.js`) bị lint chặn mã hex/rgba;
   màn mới thì thêm vào danh sách đó. Chi tiết: `docs/design-system.md`.
4. **Phản hồi thao tác:** toast (`useToast`) cho thành công/lỗi thường; lỗi nhập hiện dưới trường; `confirm()` cho thao
   tác phá huỷ; `Alert` chỉ cho lỗi nghiêm trọng/chặn (thiếu tenant, xin quyền camera…).
5. **Chống bấm lặp** với mọi thao tác ghi: `ref` + `Button loading`.
6. **Git:** chỉ commit local trên nhánh đang làm (hiện `devhuan2`); **không push, không PR, không `eas update`/`eas build`**
   trừ khi người dùng yêu cầu. Mỗi giai đoạn/tính năng một commit, sửa sau review commit riêng. Cuối message:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
7. **Tài liệu đi cùng code:** sửa luồng hoặc thêm tính năng thì **PHẢI cập nhật file `docs/` tương ứng trong cùng commit**
   (màn, luồng, quy tắc, bẫy, tồn đọng). Không tạo tài liệu song song ở nơi khác.
8. Viết test trước (TDD) cho logic nghiệp vụ; logic tính tiền/trạng thái đặt ở `lib/*.ts` thuần (không import) để test nạp được.

## Mục lục tài liệu – việc gì đọc file nào

| Việc | Đọc |
|---|---|
| Truy cập dữ liệu, tenant (uuid vs mã), JWT, API cũ, quy ước service | `docs/data-access.md` |
| Đăng nhập, phiên, quên mật khẩu, tài khoản | `docs/auth.md` |
| Trang chủ, tab menu, Tất cả quản lý, tính năng ẩn, màn mẫu | `docs/home-navigation.md` |
| Dự án, sản phẩm, trạng thái căn, sơ đồ, realtime, lock căn | `docs/products-lock.md` |
| Tạo booking, giá theo bảng giá, chi tiết booking, QR thu tiền | `docs/booking-payment.md` |
| Khách hàng: trùng khách, bắt buộc nhập, sửa/xoá, giao dịch | `docs/customers.md` |
| Đặt cọc, hợp đồng, lịch thanh toán, phiếu thu | `docs/deposits-contracts.md` |
| Báo cáo (thu tiền, HĐ, sắp đến hạn, quá hạn) | `docs/reports.md` |
| Tài liệu / ảnh / video dự án | `docs/media.md` |
| Token, component UI, quy tắc màn danh sách, lint | `docs/design-system.md` |
| Lịch sử redesign, quyết định D1–D11, mâu thuẫn web (0.2) | `docs/superpowers/specs/2026-09-30-ui-redesign-design.md` |

## Cấu trúc thư mục

| Thư mục | Nội dung |
|---|---|
| `app/` | Màn (expo-router). `(tabs)/` = tab bar; `[id]` = tham số route |
| `components/ui/` | Bộ component dùng chung (design system) |
| `components/<module>/` | Khối dùng chung theo module (booking, product, customer, sales, reports, media, home) |
| `lib/` | Logic thuần có test (trạng thái căn, giá, tiền, luật khách, định dạng…) |
| `sevicesSupabase/` | Service gọi Supabase (REST/RPC/edge function) – nơi chính |
| `sevices/` | Service gọi API .NET cũ – chỉ còn vài màn dùng (xem `docs/data-access.md`) |
| `theme/` | Token màu, chữ, khoảng cách |
| `mocks/` | Dữ liệu mẫu cho các màn chưa có API thật |
| `tests/` | Test node:test |
| `docs/superpowers/` | Spec + plan redesign (lịch sử quyết định) |

Tên thư mục `sevices`/`sevicesSupabase` viết sai chính tả nhưng giữ nguyên (nhiều import phụ thuộc).

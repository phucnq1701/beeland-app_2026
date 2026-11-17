# Beeland Admin – app mobile (beeland-app_2026)

App bán hàng bất động sản cho **nhân viên kinh doanh nội bộ và đại lý**: xem dự án/căn, lock căn, tạo booking,
thu tiền booking qua QR, theo dõi khách hàng, đặt cọc, hợp đồng, báo cáo. Đăng nhập theo mã công ty (đa công ty).

- **Stack:** Expo 54, React Native 0.81 (old arch), expo-router 6, TypeScript strict, lucide-react-native,
  TanStack Query (ít dùng), axios gọi bộ API riêng app (`services/nvApi.ts`), realtime SignalR `/api/realtime`
  (`services/realtimeHub.ts`).
- **Web cùng workspace:** `../beeland` (React + Vite) – **chuẩn nghiệp vụ**.
- **Server dữ liệu:** `https://api-beeland26.beesky.vn` (API .NET + SQL Server; `API_URL` trong `services/config.ts`, thử API
  chạy máy bằng `EXPO_PUBLIC_API_URL`). App chỉ gọi `POST /api/app-nhan-vien/fn_nv_app_*` (JWT phiên) – không còn cú pháp
  Supabase, không còn API cũ `api-beeland.beesky.vn`. Không có môi trường test riêng → mọi thao tác ghi là **dữ liệu thật**.
  Chi tiết: `docs/data-access.md`; kế hoạch + nhật ký từng SP: `docs/app-api-rieng.md`.

## Lệnh

| Việc | Lệnh |
|---|---|
| Chạy (thiết bị / tunnel) | `npx expo start --tunnel` · web: `npx expo start --web` |
| Test (node:test) | `node --test tests/` |
| Kiểu | `npx tsc --noEmit` (sạch) |
| Lint | `npx expo lint` (0 lỗi, còn vài cảnh báo biến thừa) |
| Kiểm bundle | `npx expo export --platform ios --output-dir .expo/export-check` (xong xoá thư mục) |
| Build / OTA | `eas build …`, `eas update …` – **chỉ chạy khi người dùng yêu cầu rõ** |

Test: `tests/*.test.cjs`, nạp TS bằng `tests/helpers/loadTs.cjs` (file thuần không import) hoặc harness vm tự chứa
(xem `tests/booking-write.test.cjs`) khi cần giả `callNv`/AsyncStorage. `tests/web-pricing.test.cjs` chạy
`scripts/sync-web-pricing.cjs --check` (cần repo web ở `../beeland`). So sánh object khác realm qua `JSON.parse(JSON.stringify())`.

## Quy tắc bắt buộc

1. **Web `../beeland` là chuẩn nghiệp vụ.** Số tiền, trạng thái, điều kiện thao tác (lock/booking/cọc…) phải giống web.
   Chưa rõ → đọc code web và làm theo, không đoán. Web mâu thuẫn hoặc không có quy định → làm theo web, ghi vào
   `docs/superpowers/specs/2026-09-30-ui-redesign-design.md` mục **0.2** và báo người dùng. Ghi nguồn file web trong chú thích.
2. **Phía server chỉ thêm đối tượng của app:** việc máy chủ của app làm ở repo BE `_wt/be-app-nv` (nhánh `app-nhan-vien`):
   SP `dbo.usp_nv_app_*` (`database/sp/63_app_nhan_vien/`) + endpoint C# module `AppNhanVien`. **Không đụng đối tượng web**
   (SP / bảng / trigger / endpoint web đang dùng) – cần đụng thì dừng hỏi. Thử SP chỉ trong giao dịch ROLLBACK; người dùng
   build/deploy API. Lỗi nghiệp vụ phía web → ghi spec 0.2 + báo.
3. **Giao diện:** chỉ dùng token trong `@/theme` (`colors`, `space`, `radius`, `typography`, `fontStyleFor`) và component
   trong `components/ui` (import `@/components/ui`). File trong `UI_STRICT_FILES` (`eslint.config.js`) bị lint chặn mã hex/rgba;
   màn mới thì thêm vào danh sách đó. Chi tiết: `docs/design-system.md`.
4. **Phản hồi thao tác:** toast (`useToast`) cho thành công/lỗi thường; lỗi nhập hiện dưới trường; `confirm()` cho thao
   tác phá huỷ; `Alert` chỉ cho lỗi nghiêm trọng/chặn (tài khoản thiếu công ty, xin quyền camera…).
5. **Chống bấm lặp** với mọi thao tác ghi: `ref` + `Button loading`.
6. **Git:** chỉ commit local trên nhánh đang làm; **không push, không PR, không `eas update`/`eas build`**
   trừ khi người dùng yêu cầu. Mỗi giai đoạn/tính năng một commit, sửa sau review commit riêng. Cuối message:
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
7. **Tài liệu đi cùng code:** sửa luồng hoặc thêm tính năng thì **PHẢI cập nhật file `docs/` tương ứng trong cùng commit**
   (màn, luồng, quy tắc, bẫy, tồn đọng). Không tạo tài liệu song song ở nơi khác.
8. Viết test trước (TDD) cho logic nghiệp vụ; logic tính tiền/trạng thái đặt ở `lib/*.ts` thuần (không import) để test nạp được.

## Mục lục tài liệu – việc gì đọc file nào

| Việc | Đọc |
|---|---|
| Truy cập dữ liệu: bộ API riêng `fn_nv_app_*`, phiên JWT, lỗi, realtime, tải tệp, quy ước service | `docs/data-access.md` |
| Danh sách SP / endpoint app, quyết định, nhật ký chuyển API | `docs/app-api-rieng.md` |
| Đăng nhập, phiên, quên mật khẩu, tài khoản | `docs/auth.md` |
| Trang chủ, tab menu, Tất cả quản lý, tính năng, thông báo | `docs/home-navigation.md` |
| Dự án, sản phẩm, trạng thái căn, sơ đồ, realtime, lock căn | `docs/products-lock.md` |
| Tạo booking, giá theo bảng giá, chi tiết booking, QR thu tiền | `docs/booking-payment.md` |
| Khách hàng: trùng khách, bắt buộc nhập, sửa/xoá, giao dịch | `docs/customers.md` |
| Đặt cọc, hợp đồng, lịch thanh toán, phiếu thu | `docs/deposits-contracts.md` |
| Đặt lịch ký (nguồn, quỹ, điểm ký, thủ tục, ca, hồ sơ) | `docs/signing.md` |
| Yêu cầu khách hàng (tiếp nhận, xử lý, lịch sử, tệp khách gửi) | `docs/requests.md` |
| Tin nhắn: BeeChat khách (kể cả kênh app khách hàng), chat nội bộ / đại lý, tệp, realtime | `docs/chat.md` |
| Báo cáo (thu tiền, HĐ, sắp đến hạn, quá hạn) | `docs/reports.md` |
| Phiếu tính giá (lập / sửa / duyệt / PDF, công thức chiết khấu, lịch thanh toán) | `docs/price-sheets.md` |
| Tài liệu / ảnh / video dự án | `docs/media.md` |
| Token, component UI, quy tắc màn danh sách, lint | `docs/design-system.md` |
| Cập nhật OTA khi mở app (màn "đang cập nhật dữ liệu mới"), mã bản, đẩy / rollback bản | `docs/ota-update.md` |
| Lịch sử redesign, quyết định D1–D11, mâu thuẫn web (0.2) | `docs/superpowers/specs/2026-09-30-ui-redesign-design.md` |

## Cấu trúc thư mục

| Thư mục | Nội dung |
|---|---|
| `app/` | Màn (expo-router). `(tabs)/` = tab bar; `[id]` = tham số route |
| `components/ui/` | Bộ component dùng chung (design system) |
| `components/<module>/` | Khối dùng chung theo module (booking, product, customer, sales, reports, media, home, signing, request, chat) |
| `lib/` | Logic thuần có test (trạng thái căn, giá, tiền, luật khách, định dạng…) |
| `lib/web/` | Logic form web chép nguyên văn (phiếu tính giá, booking, lịch ký) – sinh bằng `scripts/sync-web-pricing.cjs`, **không sửa tay**; shim viết tay ở `lib/web/_shims` |
| `services/` | Mọi service: `nvApi.ts` (gọi API), `session.ts` (phiên), `config.ts`, `realtimeHub.ts`, `TepApi.ts` + service theo module |
| `theme/` | Token màu, chữ, khoảng cách |
| `mocks/` | Chỉ còn danh mục tính năng (`features.ts`) + bản giả quên mật khẩu (`staffResetPassword.ts`) |
| `scripts/` | `sync-web-pricing.cjs` (chép logic web vào `lib/web`) |
| `tests/` | Test node:test |
| `docs/superpowers/` | Spec + plan redesign (lịch sử quyết định) |

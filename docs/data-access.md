# Truy cập dữ liệu

## Một nguồn: bộ API riêng của app nhân viên

| Thành phần | File | Ghi chú |
|---|---|---|
| Địa chỉ | `services/config.ts` | `API_URL` = `https://api-beeland26.beesky.vn` (thử API chạy máy: `EXPO_PUBLIC_API_URL`, vd `http://localhost:5117`); `NV_API_BASE` = `${API_URL}/api/app-nhan-vien` |
| Gọi API | `services/nvApi.ts` | `callNv(fn, args, opt)` = `POST {NV_API_BASE}/<fn>` body JSON `{ p_x: … }`, Bearer JWT; `postFormNv(fn, makeForm)` = multipart (tải tệp) |
| Phiên | `services/session.ts` | JWT + token phiên, tự làm mới, `getSessionInfo()` – xem `docs/auth.md` |
| Realtime | `services/realtimeHub.ts` | SignalR `/api/realtime` (mục dưới) |
| Tải tệp | `services/TepApi.ts` | `uploadFile` → `fn_nv_app_tai_tep` (mục dưới) |

- Mỗi lệnh `fn_nv_app_<tên>` ↔ SP `dbo.usp_nv_app_<tên>` + action C# (repo BE `_wt/be-app-nv`, `database/sp/63_app_nhan_vien/`,
  module `AppNhanVien`). **Lõi chung:** SP app gọi lại SP / hàm lõi của web (phạm vi, quyền, che trường, trạng thái); đọc thì chọn
  cột app cần, ghi thì gọi đúng SP ghi của web. Danh sách SP + nhật ký: `docs/app-api-rieng.md`, bảng kê: `docs/app-api-inventory/`.
- **Máy chủ lấy công ty / nhân viên / nhóm quyền / phạm vi từ JWT** – app không gửi mã công ty, id nhân viên, người thao tác.
  Tham số endpoint đặt tên tiếng Việt (`p_du_an_id`, `p_tu_khoa`, `p_trang`, `p_so_dong`…); dự án luôn gửi **uuid**.
- Ngoài BEELAND chỉ còn: phiên bản app trên store `services/UserService.checkVersion` → `https://api-bms.beesky.vn/api/app/get-version`.
- Không có môi trường test riêng: mọi thao tác ghi đi vào dữ liệu thật.

## Quy tắc

1. **Không gọi bảng trực tiếp, không cú pháp Supabase** (`rest/v1`, `rpc`, `functions/v1`, `storage/v1`, `apikey`/anon key) và
   không gọi API cũ `api-beeland.beesky.vn`. `tests/locked-tables.test.cjs` chặn các service đã chuyển dùng lại.
2. **Cần dữ liệu mới ⇒ thêm 1 endpoint** `fn_nv_app_*` (SP mới bọc lõi web + action C#) ở repo BE, không sửa đối tượng web
   (CLAUDE.md quy tắc 2). Thêm tham số cho SP đã có ⇒ API phải restart mới nhận.
3. Logic form chép từ web (`lib/web`) gọi tên hàm web; shim `lib/web/_shims/integrations/supabase/client.ts` đổi sang endpoint
   app qua `RPC_MAP` (`.from(bảng)` chỉ vài bảng đọc khai trong `TABLES`). Hàm chưa có trong `RPC_MAP` ⇒ trả `{ error }`
   "app không hỗ trợ" + log – thêm endpoint rồi thêm vào map.

## Lỗi

- Mọi lỗi ⇒ `NvApiError` (`status` HTTP, `code`, `message` = lời máy chủ). Mất mạng / quá giờ ⇒ `status 0`, `code "NETWORK"`.
  Hiển thị bằng `errorMessage(e, fallback)`. Không nuốt lỗi thành danh sách rỗng: service danh sách trả `{ data: [], error }`
  hoặc ném, màn báo lỗi (toast / EmptyState).
- 401 ⇒ làm mới phiên 1 lần rồi gửi lại; làm mới bị từ chối ⇒ xoá phiên, `SessionGuard` về màn Đăng nhập.
- `opt.anonymous` chỉ cho đăng nhập / đăng xuất (token phiên trong body); quên mật khẩu gọi axios riêng (chưa đăng nhập).

## Realtime (`services/realtimeHub.ts`)

Hub SignalR `{API_URL}/api/realtime`, chỉ WebSocket, giao thức như web `realtimeShim.ts` (`Join` / `Leave` / `Broadcast`, nhận
`broadcast`). Xác thực bằng JWT phiên qua `access_token` (không anon key); đổi JWT ⇒ `syncRealtimeAuth()` nối lại. Mỗi topic Join
một lần (đếm tham chiếu), tự nối lại + Join lại khi rớt.

| Hàm | Dùng | Kênh |
|---|---|---|
| `joinChannel(name, { private })` | Chat (`docs/chat.md`), Thông báo (`docs/home-navigation.md`) | private `chat:u:<employee_id>`, `chat:c:<id>`, `tb:u:<employee_id>`; công khai `chatv:<channel_key>` |
| `subscribeTableChanges(name, changes, cb)` | Trạng thái căn (`app/products.tsx`) | UPDATE `bds_products` lọc `ma_ctdk=eq.<uuid công ty>`; nhận `{ eventType, new, old (chỉ khoá chính) }` |

Máy chủ chỉ cho tài khoản đăng nhập, tự lọc công ty + quyền.

## Tải tệp

| Việc | Endpoint | Ghi chú |
|---|---|---|
| Tệp chung (ảnh chứng từ booking `"booking"`, hồ sơ lịch ký `"signing"`, tệp yêu cầu KH `"yeu-cau"`) | `fn_nv_app_tai_tep` (multipart `file`, `folder`) qua `TepApi.uploadFile` / `BookingService.uploadTenantFile` | lõi `UploadFileService` web: kho theo cấu hình công ty, ≤ 50 MB; trả link nội bộ (`provider DOTNET` ⇒ `link`) hoặc URL R2/S3 |
| Tệp chat | `fn_nv_app_chat_tep_tai` (1 bước) / link xem `fn_nv_app_chat_tep_link` | `docs/chat.md` |
| Tệp khách gửi (`drive-files:<path>`) | `fn_nv_app_yeu_cau_tep_ky` | `docs/requests.md` |

Đường dẫn tương đối của dữ liệu cũ ⇒ ghép `https://upload.beesky.vn/` (`lib/nvSanPham.absUrl`, `DocumentService.resolveUploadUrl`).

## Phạm vi dữ liệu – máy chủ quyết định

SP app dùng chung hàm phạm vi của web: trần công ty + "chỉ dữ liệu của tôi" của chứng từ (`_ds_txn_scope`), dự án
(`_da_project_scope`: đại lý ⇒ dự án gán cho đại lý; nội bộ ⇒ dự án được gán; toàn quyền ⇒ tất cả), sản phẩm đại lý theo giỏ
(`app_agency_product_ids`, `docs/products-lock.md`), khách (`_customer_scope_ids`), che trường theo nhóm (`_fm_*`).
⇒ App **không tự lọc phạm vi** phía client, chỉ gọi đúng endpoint.

## Quy ước service

- Service trả shape PascalCase cũ cho màn (`MaSP`, `TenTT`…); map từ dòng máy chủ trong service / `lib/nvSanPham.ts`.
- Danh sách: kết quả `{ rows, total }` đọc bằng `lib/listRpc.ts` (`listResult`, `pageArgs`); máy chủ nhận 1 dự án / lần ⇒ chọn
  nhiều dự án thì gọi từng dự án rồi `mergeProjectPages`. Bản trả `{ rows, total_count }` / mảng dòng: `rpcRows()` (`DatCocService.ts`).
- Ngày lọc theo giờ VN: `vnDayBound()` (`DatCocService.ts`) = `YYYY-MM-DDT00:00:00.000+07:00` / `…T23:59:59.999+07:00`;
  không lọc → `null`.
- Sản phẩm: uuid ở **`ID`** (không phải `id`/`Id`); `MaSP` = `ma_sp`.
- Dự án: `MaDA` = `ma_da_code` (mã cũ), thiếu thì uuid (`lib/nvSanPham.mapProject`); đổi sang uuid bằng `DuAnApi.resolveId`
  (`services/SanPhamApi.ts`) trước khi gọi.
- Khách trên chứng từ: `services/customerLookup.ts` – `getCustomersByIds` / `customerMapByIds` (`fn_nv_app_khach_hang_theo_id`,
  ≤ 500 id; khách công ty khác chỉ thấy qua chứng từ ⇒ bản giới hạn `limited: true`, CCCD che), `getCustomersByRefs` (mã KH /
  SĐT → dòng), `pickCustomers` (`fn_nv_app_khach_hang_chon`, ô chọn khách ở màn khác). Lỗi ở `customerMapByIds` ⇒ thiếu tên
  khách, không chặn màn.

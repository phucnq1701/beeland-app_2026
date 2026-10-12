# Tin nhắn (BeeChat khách hàng + chat nội bộ / đại lý)

Cùng dữ liệu và luật với web (`../beeland`: `src/services/chat/*`, `src/pages/customers/quan-ly/beechat/`,
`src/components/Chat/*`; spec `docs/superpowers/specs/2026-10-08-chat-realtime-design.md`,
`2026-10-12-chat-app-khach-design.md`). App chỉ gọi RPC / edge có sẵn – không sửa server.

## Màn

| Màn | File | Ghi chú |
|---|---|---|
| Hộp thư | `app/chat/index.tsx` | Tab theo `khu` của `fn_chat_inbox`: **Khách hàng** (`beechat`) · **Nội bộ** (`noi_bo`) · **Đại lý** (`dai_ly`, chỉ NV nội bộ có cờ `is_chat_dai_ly`). NV đại lý chỉ có tab Đại lý (hội thoại có NV đại lý luôn mang `san_id`; BeeChat khách chỉ cho nội bộ). Tìm (debounce 300ms, server `q`), kéo làm mới, tải thêm theo `next_cursor`. Nút header: Tạo nhóm · Nhắn tin mới |
| Cuộc trò chuyện | `app/chat/[id].tsx` | Danh sách đảo ngược (mới nhất ở đáy, kéo lên tải tin cũ `before`), ô soạn dính đáy. Hội thoại khách mình chưa là thành viên: chỉ xem + **"Tham gia để trả lời"** khi `canJoinCustomer` (admin nội bộ, hoặc kênh **app** – mọi NV nội bộ vào được BeeChat; server kiểm `app_has_perm('/customers/beechat')`). Thành viên hội thoại khách: nút Đóng / Mở lại trên header (đóng có `confirm`) |
| Thành viên / thông tin | `app/chat/manage-members/[groupId].tsx` | Khách: tên, kênh (App có icon điện thoại xanh), hồ sơ KH đã gắn (mở `customer/[id]`), SĐT, email + NV xử lý. Nhóm: thành viên + vai trò. Thêm (`ContactPicker` chọn nhiều) / xoá / rời theo `_chat_can` (xem dưới) |
| Nhắn tin mới | `app/contacts.tsx` | Danh bạ `fn_chat_danh_ba` → `fn_chat_direct_open` → mở chat (thay màn) |
| Tạo nhóm | `app/chat/create-group.tsx` | Tên (≤ 100) + ≥ 2 người → `fn_chat_group_create` (server áp luật một sàn / cờ chat đại lý, lỗi tiếng Việt → toast) |

Lối vào: nút tròn **Tin nhắn** ở header Trang chủ (`HomeHeader`, chấm cam khi có hội thoại chưa đọc – `useChatUnreadCount`,
đếm `fn_chat_inbox {khu:tat_ca, chua_doc}` bỏ hội thoại tắt tiếng, làm mới mỗi lần về Trang chủ). Tab ẩn cũ
`app/(tabs)/ai-chat.tsx` chuyển hướng sang `/chat`.

## Quyền (server quyết định, app chỉ ẩn / hiện nút)

- Nhóm: thêm / xoá người khi mình là `owner`/`admin`; không xoá `owner`. Hội thoại khách: thành viên thêm được NV xử lý,
  chỉ xoá người thêm tay (`nguon_them = thu_cong`). Ai cũng rời được (owner rời → server chuyển owner).
- Tài khoản không có hồ sơ NV (`employee_id` null trong JWT) → `_chat_me` báo "Phiên đăng nhập không hợp lệ" → app hiện
  "Tài khoản chưa có hồ sơ nhân viên nên chưa dùng được chat".

## Dữ liệu

- Service `sevicesSupabase/ChatService.ts`: RPC qua `axiosApiSupabase` (`rest/v1/rpc`, JWT tự gắn), trả `{data}`|`{error}` →
  `Error(message)`. Logic thuần + kiểu: `lib/chat.ts` (test `tests/chat.test.cjs`).
- **Tệp:** edge `chat-files` cần **JWT ứng dụng** – interceptor axios gắn `@token` cho `functions/v1` nên gọi bằng `fetch`
  riêng. `upload_url {conversation_id, ten_tep, mime, kich_thuoc}` → `{attachment_id, path, token}` → PUT multipart (XHR) lên
  `storage/v1/object/upload/sign/chat-files/<path>?token=` → gửi tin kèm `attachment_ids`. `file_url` → link 300 s (cache 240 s),
  mở bằng `expo-web-browser`. Bucket: ảnh / PDF / Office / txt / csv / zip, ≤ 20 MB (nginx máy chủ cho tới 25 MB từ 2026-10-12;
  trước đó > 1 MB bị 413). iOS chọn ảnh: `preferredAssetRepresentationMode: Compatible` (HEIC → JPEG).
- **Gửi lạc quan:** tin tạm `local-<client_msg_id>` hiện ngay; lỗi → "Chưa gửi được · Thử lại · Xoá" (gửi lại cùng
  `client_msg_id` → server không tạo trùng, tệp đã tải không tải lại).
- **Realtime:** `@supabase/supabase-js` `RealtimeClient` (+ `react-native-url-polyfill`), kênh private `chat:u:<employee_id>`
  (`setAuth(JWT)`), 5 sự kiện như web. Một kênh dùng chung (đếm tham chiếu `useChatSession`). Dự phòng: realtime chưa nối,
  hoặc xem hội thoại chưa tham gia → làm mới 15 s khi màn đang mở; tab Khách hàng làm mới 30 s (hội thoại chưa tham gia
  không phát `chat:u`). Mở lại app → tải bù.
- **Đã đọc:** đang mở + là thành viên + có tin mới → `fn_chat_mark_read`. "Đã xem" dưới tin cuối của mình = có người khác
  (hoặc khách – `contact_last_read_at`) đọc tới.

## Giao diện

Kiểu bo tròn mềm (header `soft`, card trắng bo `xxl` bóng nhẹ). Tin của mình: phải, nền `primary` chữ trắng; người khác:
trái, card trắng, avatar ở tin cuối cụm, tên ở tin đầu cụm (nhóm / khách – khách ghi "· Khách hàng"). Cụm = cùng người gửi,
≤ 5 phút, cùng ngày. Vạch ngày "Hôm nay / Hôm qua / Thứ…, dd/MM/yyyy"; tin hệ thống chữ nhỏ căn giữa (`systemText`).
Hội thoại khách kênh app: chip **App** xanh lá + huy hiệu điện thoại ở avatar (giống web BeeChat).

## Thao tác trên tin (giống menu web MessageItem)

Nhấn giữ bong bóng (chỉ khi là thành viên) → sheet: **Trả lời** (thanh "Đang trả lời …" trên ô soạn, gửi `reply_to_id`;
bong bóng hiện khung trích dẫn `reply_to`) · **Sao chép** (`expo-clipboard`) · **Sửa** (ô soạn điền sẵn, nút gửi = lưu,
`fn_chat_edit`) · **Thu hồi** (`confirm`, `fn_chat_recall`). Sửa / thu hồi: tin của mình, đã lên máy chủ, chưa thu hồi,
≤ 24 giờ (`canModifyMessage`, server kiểm lại). Tin đã sửa ghi "(đã sửa)", đã thu hồi "Tin nhắn đã được thu hồi".

**@nhắc tên** (nhóm / hội thoại khách có NV khác): gõ `@` → gợi ý thành viên phía trên ô soạn (lọc không dấu), chọn → chèn
"@Tên "; khi gửi, `mentions` = người đã chọn mà "@Tên" còn trong nội dung (như web Composer).

**Đang gõ:** hội thoại khách – kênh công khai `chatv:<channel_key>` (nghe `from: 'visitor'`, mình gõ phát `from: 'agent'` →
app khách / widget hiện "đang soạn tin"); nội bộ / nhóm – kênh private `chat:c:<id>` (`{employee_id}`), ≤ 1 lần / 3 s,
ẩn sau 4 s. Dòng "<Tên> đang gõ…" ngay trên ô soạn ("Khách đang gõ…" với hội thoại khách).

## Màn thông tin (`manage-members/[groupId]`, mở từ nút người ở header – mọi loại hội thoại)

- **Ghim / Tắt thông báo** (công tắc, `fn_chat_pref`) – thành viên.
- Hội thoại khách: **Gắn hồ sơ khách hàng** (`CustomerLinkSheet`: gợi ý `goi_y_khach_hang` khớp SĐT/email + tìm qua
  `CustomerService.getCustomers` → `fn_chat_customer_link`), **Bỏ gắn** (confirm). **Kênh app không đổi / bỏ gắn được**
  (hồ sơ là khoá nhận diện khách đăng nhập – server chặn, migration web `20261013130000_chat_app_khong_doi_kh`).
  **Nhãn** (thêm / bỏ, ≤ 20 × 50 ký tự, `fn_chat_customer_tags`). **Xin thông tin liên hệ** khi khách chưa có SĐT / email
  (`fn_chat_request_info`).
- Nhóm / khách: thành viên, thêm / xoá / rời như trên. Hội thoại 1-1: chỉ ghim / tắt thông báo.

Hội thoại khách: mọi tin NV nằm bên phải (như web BeeChat – thấy NV nào trả lời khách), tin đồng nghiệp ghi tên.

Chấm chưa đọc ở Trang chủ: tải khi về Trang chủ + tải lại ngầm khi có sự kiện realtime `chat:u` (debounce 600 ms).

## Tồn đọng

- Chưa có (web có): tìm trong tin nhắn (`fn_chat_search`), đổi tên / ảnh nhóm, đổi vai trò thành viên, tạo hồ sơ khách mới
  từ hội thoại, trạng thái online (presence).

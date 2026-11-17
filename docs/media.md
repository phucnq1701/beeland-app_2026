# Tài liệu, ảnh, video dự án

## Màn

| Màn | File | Nguồn |
|---|---|---|
| Thư mục tài liệu dự án (params `projectId` = uuid dự án, `parentId` = thư mục con, `title`) | `app/folders/[projectId].tsx` | `DocumentService.entries("DOCUMENT", …)` |
| Tệp trong thư mục (tìm kiếm máy chủ, chờ 500ms; có từ khoá ⇒ tìm cả thư mục con như web) | `app/documents/[folderId].tsx` | `DocumentService.files("DOCUMENT", …)` |
| Xem tài liệu (PDF/Office/ảnh/TXT, WebView) | `app/documents/viewer.tsx` | `components/utils/documentLinks.ts` |
| Thư viện ảnh (album, params như trên) / ảnh trong album | `app/photo-gallery.tsx`, `app/photos/[folderId].tsx` | `DocumentService.entries / files("GALLERY", …)` |
| Khung chung (kiểu bo tròn: header/ô tìm/chip `soft`, mỗi thư mục / tệp là card bo `radius.xxl`, icon tệp trong vòng tròn nền nhạt theo loại, nút chia sẻ / › tròn) | `components/media/FolderListScreen.tsx`, `FileListScreen.tsx`, `lib/shareText.ts` | |

Lối vào: chi tiết dự án (`app/project/[id].tsx`) → `/folders/[projectId]`, `/photo-gallery?projectId=` với **uuid dự án**.
Không có thư viện video riêng (như web) – video là tệp trong thư mục.

## Dữ liệu – cây thư mục như web (`services/DocumentService.ts`)

| Việc | Endpoint |
|---|---|
| Cây thư mục của màn (mọi dự án trong phạm vi) | `fn_nv_app_tai_lieu_cay { p_form_id }` (= `fn_doc_tree` web `services/projects/doc-tree`: quyền Xem của màn, phạm vi dự án, thư mục giới hạn người xem – máy chủ lọc) |
| Tệp nằm thẳng trong 1 thư mục / tìm cả cây con | `fn_nv_app_tai_lieu_tep { p_form_id, p_folder_id, p_search, p_recursive }` (= `fn_doc_file_list`) |

- `form_id`: **488** Tài liệu, **323** Thư viện ảnh (`DOC_FORM`).
- Mỗi dự án có 1 thư mục gốc / màn, thư mục con nhiều cấp. `entriesAt(folders, projectId, parentId)`: không `parentId` ⇒ con
  của thư mục gốc dự án; có ⇒ con của thư mục đó; thư mục đang xem có tệp nằm thẳng bên trong ⇒ thêm ô đầu "Tài liệu chung
  của dự án" / "Tài liệu trong thư mục này" (`filesOf`). Sắp theo tên. Thư mục còn con ⇒ đi xuống cấp dưới; hết con ⇒ mở tệp.
- Link tệp / ảnh bìa không phải http → thêm `https://upload.beesky.vn/` (`resolveUploadUrl`).

## Mở / chia sẻ

- Tài liệu: Office luôn qua `documents/viewer`; PDF/ảnh/TXT trên điện thoại qua viewer; còn lại / web mở link ngoài.
- Video: web mở tab mới; điện thoại qua viewer (link encode). Chia sẻ: YouTube/video chia sẻ link; tệp → tải về
  `FileSystem.cacheDirectory` rồi `Sharing.shareAsync` (MIME theo đuôi); web không có `navigator.share` → chép link.

### Xem ảnh toàn màn hình

Hai trình xem: `components/ImageViewerModal.tsx` (ảnh căn / dự án qua `ImageCarousel`, ảnh chứng từ booking qua
`BookingDocuments`) và modal trong `app/photos/[folderId].tsx` (thư viện ảnh). Cả hai dùng `useViewerChrome`
(export từ `ImageViewerModal.tsx`): chạm ảnh → nút đóng / tiến-lùi / bộ đếm / chú thích mờ dần và ẩn (không bắt chạm),
chạm lần nữa → hiện lại; mở lại trình xem thì luôn hiện. Ẩn bằng opacity nên ảnh không nhảy bố cục.
Trình xem thêm mới phải dùng hook này cho đồng bộ.

## Tồn đọng

- Biểu mẫu (`form_id` 801 `FORMS` trên web) chưa có trên app.

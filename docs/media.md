# Tài liệu, ảnh, video dự án

## Màn

| Màn | File | Nguồn |
|---|---|---|
| Thư mục tài liệu dự án | `app/folders/[projectId].tsx` | `sevicesSupabase/DocumentService.get` (`TypeDocument: DOCUMENT`) |
| Tệp trong thư mục (tìm kiếm máy chủ, chờ 500ms) | `app/documents/[folderId].tsx` | `DocumentService.getDetail` |
| Xem tài liệu (PDF/Office/ảnh/TXT, WebView) | `app/documents/viewer.tsx` | `components/utils/documentLinks.ts` |
| Thư viện ảnh (album) / ảnh trong album | `app/photo-gallery.tsx`, `app/photos/[folderId].tsx` | `DocumentService.get` (`GALLERY`) |
| Thư mục video / video trong thư mục | `app/video/[projectId].tsx`, `app/videos/[folderId].tsx`, `app/videos/viewer.tsx` | **API cũ** `sevices/DocumentService.getFolderVideo` / `getDetailVideo` |
| Khung chung | `components/media/FolderListScreen.tsx`, `FileListScreen.tsx`, `lib/shareText.ts` | |

Lối vào: chi tiết dự án (`app/project/[id].tsx`) → `/folders/${MaDA}`, `/photo-gallery?projectId=${MaDA}`, `/video/${MaDA}`.

## Bảng `cloud_doc_folders` / `cloud_doc_files` (đã kiểm chứng trong `sevicesSupabase/DocumentService.ts`)

- Lọc: `ma_ctdk` = **uuid công ty**, `form_id` (**488** tài liệu, **323** thư viện ảnh), `doc_type` (`DOCUMENT`/`GALLERY`).
- Lọc dự án: `ma_da` = **uuid dự án** – `resolveProjectUuid(MaDA)` (uuid giữ nguyên; mã cũ → `da_projects.ma_da_code`;
  số → thử `da_projects.id`). Không đổi được → trả `[]` (fail-closed).
- Đếm tệp: 1 lượt lấy thư mục + 1 lượt thống kê `cloud_doc_files` theo `folder_seq` (tránh N+1). Khoá 2 bảng là `seq`.
- Link tệp: không phải http → thêm `https://upload.beesky.vn/`.

## Mở / chia sẻ

- Tài liệu: Office luôn qua `documents/viewer`; PDF/ảnh/TXT trên điện thoại qua viewer; còn lại / web mở link ngoài.
- Video: web mở tab mới; điện thoại qua viewer (link encode). Chia sẻ: YouTube/video chia sẻ link; tệp → tải về
  `FileSystem.cacheDirectory` rồi `Sharing.shareAsync` (MIME theo đuôi); web không có `navigator.share` → chép link.

## Bẫy

- Màn truyền `MaDA: Number(projectId)`; `MaDA` của dự án là `ma_da_code`, thiếu thì uuid → dự án **không có mã cũ** sẽ ra
  `NaN` → danh sách rỗng. **Chưa kiểm chứng** có dự án như vậy.
- `DocumentService.add/edit/delete` gọi `api/duan/documents` trên client Supabase (đường dẫn không tồn tại) – không màn nào dùng.

## Tồn đọng

- Video dùng API cũ (`api-beeland.beesky.vn`) – còn dữ liệu khi web Cloud-only hay không: **chưa kiểm chứng**.
- Biểu mẫu (`form_id` 801 `FORMS` trên web) chưa có trên app.

import { callNv } from "@/services/nvApi";

/**
 * Tài liệu dự án (488) / Thư viện ảnh (323) — bộ API riêng app, CÙNG dữ liệu màn cây thư mục của web (beeland
 * services/projects/doc-tree): fn_nv_app_tai_lieu_cay (= fn_doc_tree: quyền Xem của màn, phạm vi dự án, thư mục giới hạn người
 * xem — máy chủ lọc) và fn_nv_app_tai_lieu_tep (= fn_doc_file_list). Mỗi dự án có 1 thư mục gốc / màn, thư mục con nhiều cấp.
 * App giữ luồng cũ (Dự án → thư mục → tệp / ảnh), đi xuống thư mục con như web; không đọc thẳng bảng cloud_doc_* nữa.
 */
export type DocModule = "DOCUMENT" | "GALLERY";
export const DOC_FORM: Record<DocModule, number> = { DOCUMENT: 488, GALLERY: 323 };

export type DocFolder = {
  id: string;
  parentId: string | null;
  projectId: string | null;
  name: string;
  note: string;
  isRoot: boolean;
  folderCount: number;
  fileCount: number;
  cover: string | null;
};

/** Ô trong danh sách thư mục: thư mục con, hoặc "tệp nằm thẳng trong thư mục đang xem" (`filesOf`). */
export type DocEntry = DocFolder & { filesOf?: boolean };

export type DocFile = { id: string; name: string; type: string; size: number; link: string; note: string; createdAt: string };

const str = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** Link tương đối ⇒ máy chủ tệp (như app cũ / web formatImageUrl khi công ty chưa cấu hình kho riêng). */
export function resolveUploadUrl(raw?: string | null): string {
  const link = str(raw);
  if (!link) return "";
  if (/^https?:\/\//i.test(link)) return link;
  return `https://upload.beesky.vn/${link.replace(/^\/+/, "")}`;
}

export function mapFolder(r: any): DocFolder {
  return {
    id: str(r?.id),
    parentId: str(r?.parent_id) || null,
    projectId: str(r?.ma_da).toLowerCase() || null,
    name: str(r?.name) || "Không có tên",
    note: str(r?.ghi_chu),
    isRoot: r?.is_root === true,
    folderCount: num(r?.folder_count),
    fileCount: num(r?.file_count),
    cover: r?.cover_link ? resolveUploadUrl(r.cover_link) : null,
  };
}

/**
 * Thư mục hiển thị ở 1 cấp: `parentId` trống ⇒ cấp đầu của dự án (con của thư mục gốc dự án); có ⇒ con của thư mục đó.
 * Thư mục đang xem (gốc dự án / `parentId`) có tệp nằm thẳng bên trong ⇒ thêm ô `filesOf` đứng đầu để mở các tệp đó.
 * Thứ tự như web: theo tên.
 */
export function entriesAt(folders: DocFolder[], projectId: string | null, parentId: string | null): DocEntry[] {
  const pid = str(projectId).toLowerCase();
  const parents = parentId
    ? folders.filter((f) => f.id === String(parentId))
    : folders.filter((f) => f.isRoot && !!pid && f.projectId === pid);
  const ids = new Set(parents.map((p) => p.id));
  const kids = folders
    .filter((f) => f.parentId && ids.has(f.parentId))
    .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  const own: DocEntry[] = parents.filter((p) => p.fileCount > 0).map((p) => ({ ...p, filesOf: true }));
  return [...own, ...kids];
}

export function mapFile(r: any): DocFile {
  return {
    id: str(r?.id),
    name: str(r?.name),
    type: str(r?.type),
    size: num(r?.size),
    link: resolveUploadUrl(r?.link),
    note: str(r?.ghi_chu),
    createdAt: str(r?.created_at),
  };
}

export const DocumentService = {
  /** Cây thư mục của màn (mọi dự án trong phạm vi — lọc dự án ở `entriesAt`). */
  tree: async (module: DocModule): Promise<DocFolder[]> => {
    const r = await callNv<any>("fn_nv_app_tai_lieu_cay", { p_form_id: DOC_FORM[module] });
    return (Array.isArray(r?.folders) ? r.folders : []).map(mapFolder).filter((f: DocFolder) => f.id);
  },

  /** Thư mục ở 1 cấp của dự án (xem `entriesAt`). */
  entries: async (module: DocModule, projectId: string | null, parentId: string | null): Promise<DocEntry[]> =>
    entriesAt(await DocumentService.tree(module), projectId, parentId),

  /** Tệp nằm thẳng trong thư mục (`search` có ⇒ tìm cả thư mục con như web). */
  files: async (module: DocModule, folderId: string, search = ""): Promise<DocFile[]> => {
    const q = str(search);
    const r = await callNv<any>("fn_nv_app_tai_lieu_tep", {
      p_form_id: DOC_FORM[module],
      p_folder_id: Number(folderId),
      p_search: q || null,
      p_recursive: !!q,
    });
    return (Array.isArray(r) ? r : []).map(mapFile);
  },
};

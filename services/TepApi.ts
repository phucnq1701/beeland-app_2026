import { postFormNv } from "./nvApi";

export interface RnFile {
  uri: string;
  name?: string;
  type?: string;
}

/**
 * Tải 1 tệp lên kho của công ty (fn_nv_app_tai_tep — lõi UploadFileService của web: công ty theo phiên, kho theo cấu hình
 * công ty, ≤ 50 MB, kiểu tệp như web). Trả đường dẫn tệp (link nội bộ BEELAND hoặc URL công khai R2/S3). Lỗi ⇒ ném (có thông điệp).
 * Không còn lùi về máy chủ tệp cũ upload.beesky.vn (không xác thực).
 */
export async function uploadFile(file: RnFile, folder: string): Promise<string> {
  const name = file.name || `tep-${Date.now()}.jpg`;
  const type = file.type || "image/jpeg";
  const out = await postFormNv<{ url?: string; link?: string; provider?: string }>("fn_nv_app_tai_tep", () => {
    const fd = new FormData();
    fd.append("file", { uri: file.uri, name, type } as any);
    fd.append("folder", folder);
    return fd;
  });
  const value = out?.provider === "DOTNET" ? out?.link : out?.url || out?.link;
  if (typeof value === "string" && value.trim()) return value.trim();
  throw new Error("Máy chủ không trả về đường dẫn tệp");
}

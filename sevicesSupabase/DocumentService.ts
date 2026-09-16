import axiosApi from "./axiosApi";
import axiosApiSupabase from "./axiosApiSupabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getValidSupabaseJwt } from "./cloudTenant";

/**
 * Chuẩn hoá link file: giữ nguyên nếu đã là URL đầy đủ,
 * ngược lại prefix upload.beesky.vn (giống app gốc — KHÔNG dùng fils-beeland).
 */
function resolveUploadUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const link = String(raw).trim();
  if (!link) return null;
  if (/^https?:\/\//i.test(link)) return link;
  return `https://upload.beesky.vn/${link.replace(/^\/+/, "")}`;
}

/** Các đuôi file Office cần mở qua Microsoft Office Online Viewer */
const OFFICE_EXTS = ["doc", "docx", "xls", "xlsx", "ppt", "pptx"];

/**
 * QUY TẮC BẮT BUỘC: file Office (.docx/.xlsx/...) KHÔNG được trả URL gốc.
 * Phải đóng gói thành Microsoft Office Online Viewer:
 *   https://view.officeapps.live.com/op/view.aspx?src=<URL_FILE_GOC_DA_URL_ENCODE>
 * (src được encodeURIComponent; không encode toàn bộ URL Viewer)
 */
function toOfficeViewerUrl(fileUrl: string | null): string | null {
  if (!fileUrl) return null;

  // Nếu đã là Office Viewer URL thì giữ nguyên (tránh double-wrap)
  if (fileUrl.includes("view.officeapps.live.com")) return fileUrl;

  const ext = fileUrl.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() || "";
  if (!OFFICE_EXTS.includes(ext)) return fileUrl;

  return `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileUrl)}`;
}

/**
 * Lấy ma_ctdk (text cũ, ví dụ "1") từ AsyncStorage.
 * Chỉ dùng maCTDK (mã cũ) — @company_code/tenCTDKVT là company code (vd "msr"),
 * không phải ma_ctdk text cũ của cloud_doc_folders/files.
 */
async function getMaCtdkText(): Promise<string> {
  const raw = (await AsyncStorage.getItem("maCTDK")) || "1";
  return raw;
}

/**
 * Đếm số tệp + ảnh đại diện (file cũ nhất) cho 1 thư mục.
 * Gọi cloud_doc_files theo folder_seq rồi group.
 */
async function getFolderStats(
  folderSeqs: number[],
  formId: number,
  maCtdk: string
): Promise<Record<number, { count: number; firstFile: string | null }>> {
  const stats: Record<number, { count: number; firstFile: string | null }> = {};
  if (folderSeqs.length === 0) return stats;

  const params: Record<string, string> = {
    select: "folder_seq,link,created_at",
    ma_ctdk: `eq.${maCtdk}`,
    form_id: `eq.${formId}`,
    folder_seq: `in.(${folderSeqs.join(",")})`,
    order: "created_at.asc",
    limit: "1000",
  };

  const res = await axiosApiSupabase.get("rest/v1/cloud_doc_files", { params });
  const rows = Array.isArray(res.data) ? res.data : [];

  for (const r of rows) {
    const seq = Number(r.folder_seq);
    if (!stats[seq]) stats[seq] = { count: 0, firstFile: null };
    stats[seq].count += 1;
    if (!stats[seq].firstFile && r.link) {
      stats[seq].firstFile = resolveUploadUrl(r.link);
    }
  }

  return stats;
}

export const DocumentService = {
  getStatusSP: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApiSupabase
      .post("api/admin/san-pham/trang-thai", dataInit)
      .then((res) => res.data);
  },

  // ===== DOCUMENT =====
  /**
   * Danh sách thư mục tài liệu — cloud (cloud_doc_folders).
   * payload: { MaDA (ma_da_code), TypeDocument: "DOCUMENT" | "GALLERY" }
   * Trả shape cũ: { data: [{ ID, Name, Color, Icon, SoLuong, FirstFile, GhiChu }] }
   */
  get: async (payload: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Document] chưa có cloud_jwt, bỏ qua cloud_doc_folders");
      return { data: [] };
    }

    try {
      const maDA = payload?.MaDA ?? payload?.maDA;
      const type = payload?.TypeDocument ?? "DOCUMENT";
      const formId = type === "GALLERY" ? 323 : 488;
      const docType = type === "GALLERY" ? "GALLERY" : "DOCUMENT";
      const maCtdk = await getMaCtdkText();

      const params: Record<string, string> = {
        select: "seq,id,name,color,icon,ghi_chu,ma_da,created_at",
        ma_ctdk: `eq.${maCtdk}`,
        form_id: `eq.${formId}`,
        doc_type: `eq.${docType}`,
        order: "created_at.desc",
        limit: "200",
      };

      if (maDA != null && maDA !== "" && maDA !== -1) {
        params.ma_da = `eq.${maDA}`;
      }

      const res = await axiosApiSupabase.get("rest/v1/cloud_doc_folders", {
        params,
      });
      const rows = Array.isArray(res.data) ? res.data : [];

      // Đếm file + ảnh đại diện cho tất cả thư mục trong 1 lần gọi
      const seqs = rows.map((r: any) => Number(r.seq)).filter((n: number) => !isNaN(n));
      const stats = await getFolderStats(seqs, formId, maCtdk);

      const data = rows.map((r: any) => {
        const seq = Number(r.seq);
        const st = stats[seq] || { count: 0, firstFile: null };
        return {
          ID: seq,
          Name: r.name ?? "Không có tên",
          Color: r.color || "#888888",
          Icon: r.icon || "folder",
          SoLuong: st.count,
          FirstFile: st.firstFile,
          GhiChu: r.ghi_chu ?? "",
          MaDA: r.ma_da,
        };
      });

      return { data };
    } catch (error) {
      console.log("ERROR DocumentService.get (cloud_doc_folders):", error);
      return { data: [] };
    }
  },

  add: async (payload: any = {}) => {
    const dataInit = { ...payload };
    return await axiosApiSupabase
      .post("api/duan/documents", dataInit)
      .then((res) => res.data);
  },

  edit: async (payload: any = {}) => {
    const dataInit = { ...payload };
    return await axiosApiSupabase
      .put("api/duan/documents", dataInit)
      .then((res) => res.data);
  },

  delete: async (id: string | number) => {
    return await axiosApiSupabase
      .delete(`api/duan/documents/${id}`)
      .then((res) => res.data);
  },

  // ===== DOCUMENT DETAIL =====
  /**
   * Danh sách tệp trong 1 thư mục — cloud (cloud_doc_files).
   * payload: { DocumentID (folder_seq), InputSearch }
   * Trả shape cũ: { data: [{ ID, Name, Type, Size, CreatedAt, Link, GhiChu }] }
   */
  getDetail: async (payload: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Document] chưa có cloud_jwt, bỏ qua cloud_doc_files");
      return { data: [] };
    }

    try {
      const folderSeq = payload?.DocumentID ?? payload?.folderSeq;
      const keyword = payload?.InputSearch ?? payload?.keyword;
      const maCtdk = await getMaCtdkText();

      const params: Record<string, string> = {
        select: "seq,id,name,type,size,link,ghi_chu,created_at",
        ma_ctdk: `eq.${maCtdk}`,
        folder_seq: `eq.${folderSeq}`,
        order: "sort_order.asc,created_at.asc",
        limit: "1000",
      };

      if (keyword && String(keyword).trim()) {
        params.name = `ilike.*${String(keyword).trim()}*`;
      }

      const res = await axiosApiSupabase.get("rest/v1/cloud_doc_files", {
        params,
      });
      const rows = Array.isArray(res.data) ? res.data : [];

      const data = rows.map((r: any) => ({
        ID: r.seq,
        Name: r.name ?? "",
        Type: r.type ?? "",
        Size: r.size ?? 0,
        CreatedAt: r.created_at ?? new Date().toISOString(),
        // Flow: path tương đối → URL gốc (upload.beesky.vn) → file Office
        // (.docx/.xlsx/...) đóng gói thành Office Online Viewer URL.
        // KHÔNG trả URL .docx gốc cho frontend.
        Link: toOfficeViewerUrl(resolveUploadUrl(r.link)),
        GhiChu: r.ghi_chu ?? "",
      }));

      return { data };
    } catch (error) {
      console.log("ERROR DocumentService.getDetail (cloud_doc_files):", error);
      return { data: [] };
    }
  },

  addDetail: async (payload: any = {}) => {
    const dataInit = { ...payload };
    return await axiosApiSupabase
      .post("api/duan/documents/detail", dataInit)
      .then((res) => res.data);
  },

  editDetail: async (payload: any = {}) => {
    const dataInit = { ...payload };
    return await axiosApiSupabase
      .put("api/duan/documents/detail", dataInit)
      .then((res) => res.data);
  },

  deleteDetail: async (id: string | number) => {
    return await axiosApiSupabase
      .delete(`api/duan/documents/detail/${id}`)
      .then((res) => res.data);
  },

  getDocument: async (maKieuFile: any) => {
    return await axiosApiSupabase
      .get(`api/admin/danhmuc/loaitailieu/${maKieuFile}`)
      .then((res) => res.data);
  },
  getDetailDocument: async (payload: any) => {
    return await axiosApiSupabase
      .post("api/admin/du-an/tai-lieu/list", payload)
      .then((res) => res.data);
  },
  getDetailVideo: async (payload: any) => {
    return await axiosApiSupabase
      .post("api/admin/danhmuc/thuvienvideo/list", payload)
      .then((res) => res.data);
  },

  getIMG: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";
    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApiSupabase
      .post("api/beeland/get-ThuVienHinhAnh", dataInit)
      .then((res) => res.data);
  },
  getVideo: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";
    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApiSupabase
      .post("api/beeland/get-ThuVienVideo", dataInit)
      .then((res) => res.data);
  },
  getFolderVideo: async (payload: any = {}) => {
    const tenCTDKVT = (await AsyncStorage.getItem("tenCTDKVT")) || "beesky";
    const dataInit = {
      TenCTDKVT: tenCTDKVT,
      ...payload,
    };
    return await axiosApiSupabase
      .post("api/duan/documents/get-list", dataInit)
      .then((res) => res.data);
  },
};

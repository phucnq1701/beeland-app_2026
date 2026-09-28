import axiosApi from "./axiosApi";
import axiosApiSupabase from "./axiosApiSupabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getValidSupabaseJwt, getCompanyId } from "./cloudTenant";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Map ma_da_code (text, vd "132") hoặc ID → da_projects.id (uuid).
 * cloud_doc_folders.ma_da hiện tại là UUID FK da_projects(id).
 */
async function resolveProjectUuid(maDA: any): Promise<string | null> {
  if (maDA == null || maDA === "" || maDA === -1) return null;
  const value = String(maDA).trim();
  if (UUID_RE.test(value)) return value;
  try {
    const res = await axiosApiSupabase.get("rest/v1/da_projects", {
      params: { select: "id", ma_da_code: `eq.${value}`, limit: "1" },
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    if (rows.length > 0 && rows[0].id) return rows[0].id;

    if (/^\d+$/.test(value)) {
      const resById = await axiosApiSupabase.get("rest/v1/da_projects", {
        params: { select: "id", id: `eq.${value}`, limit: "1" },
      });
      const rowsById = Array.isArray(resById.data) ? resById.data : [];
      if (rowsById.length > 0 && rowsById[0].id) return rowsById[0].id;
    }
    return null;
  } catch (error) {
    console.log("ERROR resolveProjectUuid (da_projects):", error);
    return null;
  }
}

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
 * Đếm số tệp + ảnh đại diện (file cũ nhất) cho 1 thư mục.
 * Gọi cloud_doc_files theo folder_seq rồi group.
 */
async function getFolderStats(
  folderSeqs: number[],
  formId: number,
  companyId: string
): Promise<Record<number, { count: number; firstFile: string | null }>> {
  const stats: Record<number, { count: number; firstFile: string | null }> = {};
  if (folderSeqs.length === 0) return stats;

  const params: Record<string, string> = {
    select: "folder_seq,link,created_at",
    form_id: `eq.${formId}`,
    folder_seq: `in.(${folderSeqs.join(",")})`,
    order: "created_at.asc",
    limit: "1000",
  };

  if (companyId && UUID_RE.test(companyId)) {
    params.ma_ctdk = `eq.${companyId}`;
  }

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
   * payload: { MaDA (ma_da_code/id), TypeDocument: "DOCUMENT" | "GALLERY" }
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
      const companyId = await getCompanyId();

      if (!companyId || !UUID_RE.test(companyId)) {
        console.log("[Document] bỏ qua cloud_doc_folders vì company_id không phải UUID");
        return { data: [] };
      }

      const params: Record<string, string> = {
        select: "seq,id,name,color,icon,ghi_chu,ma_da,created_at",
        ma_ctdk: `eq.${companyId}`,
        form_id: `eq.${formId}`,
        doc_type: `eq.${docType}`,
        order: "created_at.desc",
        limit: "200",
      };

      if (maDA != null && maDA !== "" && maDA !== -1) {
        const projectUuid = await resolveProjectUuid(maDA);
        if (projectUuid) {
          params.ma_da = `eq.${projectUuid}`;
        } else {
          // Lọc theo dự án nhưng không tìm thấy UUID -> trả về rỗng (fail-closed)
          return { data: [] };
        }
      }

      const res = await axiosApiSupabase.get("rest/v1/cloud_doc_folders", {
        params,
      });
      const rows = Array.isArray(res.data) ? res.data : [];

      // Đếm file + ảnh đại diện cho tất cả thư mục trong 1 lần gọi
      const seqs = rows.map((r: any) => Number(r.seq)).filter((n: number) => !isNaN(n));
      const stats = await getFolderStats(seqs, formId, companyId);

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
          MaDA: payload?.MaDA ?? r.ma_da,
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
      const companyId = await getCompanyId();

      if (!companyId || !UUID_RE.test(companyId)) {
        console.log("[Document] bỏ qua cloud_doc_files vì company_id không phải UUID");
        return { data: [] };
      }

      const params: Record<string, string> = {
        select: "seq,id,name,type,size,link,ghi_chu,created_at",
        ma_ctdk: `eq.${companyId}`,
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
};

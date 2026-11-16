/**
 * Yêu cầu khách hàng (nhân viên) — bộ API riêng app (fn_nv_app_*, lõi chung: SP app bọc đúng SP web `fn_customer_request_*`
 * của beeland/src/services/CustomerRequest.js; công ty / người thao tác máy chủ lấy từ phiên):
 *  - danh sách / chi tiết / lưu / xoá / xử lý / nhật ký: fn_nv_app_yeu_cau_list / chi_tiet / luu / xoa / xu_ly / nhat_ky
 *    (chi tiết kèm `SoHD` = số phiếu của HĐ liên quan — không còn đọc thẳng cloud_pgc_phieu_giucho).
 *  - Danh mục loại / nguồn / ưu tiên / trạng thái: fn_nv_app_danh_muc (của công ty); trống ⇒ bộ cố định của web.
 *  - Nhân viên (người tiếp nhận / xử lý): fn_nv_app_nhan_vien_list (như web NhanVienService.getList), giá trị = `ma_nv`.
 *  - Tệp khách gửi lưu `drive-files:<path>` (kho riêng tư) → link xem 1 giờ fn_nv_app_yeu_cau_tep_ky (chỉ tệp của yêu cầu xem được).
 *  - Tệp nhân viên thêm: fn_nv_app_tai_tep (`uploadTenantFile`, như ảnh chứng từ booking / hồ sơ lịch ký).
 * Yêu cầu khách tự gửi (app khách hàng) nằm chung bảng → hiện ở đây.
 */
import { uploadTenantFile } from "./BookingService";
import { fetchCatalogList } from "./CustomerService";
import {
  attachmentName,
  fromApiItem,
  isStoredFile,
  mapCatalog,
  mapLog,
  storedPath,
  toApiPayload,
  YC_CATALOG_TYPES,
  type CustomerRequest,
  type RequestForm,
  type RequestLog,
  type YcCat,
  type YcCatalogType,
} from "../lib/customerRequest";
import { fileUrl, isImageFile, uid } from "../lib/signing";
import { callNv, errorMessage, NvApiError } from "@/services/nvApi";
import { API_URL } from "@/services/config";

async function rpc<T = any>(fn: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  try {
    return await callNv<T>(fn, args);
  } catch (e) {
    if (e instanceof NvApiError) throw e;
    throw new Error(errorMessage(e, fallback));
  }
}

export type RequestCatalogs = Record<YcCatalogType, YcCat[]>;
export type EmployeeOption = { value: string; label: string; description?: string };
export type ResolvedAttachment = { stored: string; url: string; fileName: string; image: boolean };

/** URL ký nội bộ (…/storage/v1/…) → địa chỉ công khai của máy chủ API (web `toPublicStorageUrl`); URL kho ngoài giữ nguyên. */
const toPublicStorageUrl = (u: string) => {
  const i = u.indexOf("/storage/v1/");
  return i < 0 ? u : `${API_URL}${u.slice(i)}`;
};

async function signDriveFile(requestId: string, path: string): Promise<string> {
  const res = await callNv<{ url?: string }>("fn_nv_app_yeu_cau_tep_ky", { p_id: requestId, p_path: path });
  const url = toPublicStorageUrl(String(res?.url || ""));
  if (!/^https?:\/\//i.test(url)) throw new Error("Không mở được tệp");
  return url;
}

export const CustomerRequestService = {
  /** Danh sách (lọc + phân trang trên máy chủ, mới nhất trước). Ngày `YYYY-MM-DD` theo giờ VN. */
  list: async (filter: {
    keyword?: string;
    projectCode?: string | null;
    source?: string | null;
    status?: string | null;
    priority?: string | null;
    from?: string | null;
    to?: string | null;
    page?: number;
    size?: number;
  }): Promise<{ rows: CustomerRequest[]; total: number }> => {
    const res = await rpc<any>(
      "fn_nv_app_yeu_cau_list",
      {
        p_keyword: String(filter.keyword || "").trim() || null,
        p_ma_da: filter.projectCode || null,
        p_nguon: filter.source || null,
        p_trang_thai: filter.status || null,
        p_uu_tien: filter.priority || null,
        p_tu_ngay: filter.from || null,
        p_den_ngay: filter.to || null,
        p_page: filter.page ?? 1,
        p_size: filter.size ?? 30,
      },
      "Không tải được danh sách yêu cầu",
    );
    const rows = Array.isArray(res?.rows) ? res.rows : [];
    return { rows: rows.map(fromApiItem), total: Number(res?.total ?? rows.length) };
  },

  /**
   * Chi tiết – web getById → `fn_customer_request_get` (null = không thấy / ngoài phạm vi).
   * Đợt 5 (ds_dot5, 2026-10-20) đã khoá đọc thẳng bảng yêu cầu và `_ccr_json` không trả `created_by`
   * ⇒ `createdBy` = null: nhận biết yêu cầu khách tự gửi theo nguồn `app` / `website` (`isCustomerSubmitted`).
   */
  get: async (id: string): Promise<CustomerRequest> => {
    const res = await rpc<any>("fn_nv_app_yeu_cau_chi_tiet", { p_id: id }, "Không tải được yêu cầu");
    const d = Array.isArray(res) ? res[0] : res;
    if (!d) throw new Error("Không tìm thấy yêu cầu");
    return { ...fromApiItem(d), createdBy: null };
  },

  /** Thêm (không `id`) hoặc sửa – máy chủ ghi đè toàn bộ trường, tự cấp số phiếu, người tiếp nhận mặc định = người đăng nhập. */
  save: async (form: RequestForm): Promise<CustomerRequest> => {
    const res = await rpc<any>("fn_nv_app_yeu_cau_luu", { p: toApiPayload(form) }, "Lưu yêu cầu thất bại");
    return fromApiItem(res);
  },

  /** Xoá mềm. */
  remove: async (id: string): Promise<void> => {
    await rpc("fn_nv_app_yeu_cau_xoa", { p_id: id }, "Xoá yêu cầu thất bại");
  },

  /** Ghi nhận xử lý: thêm 1 dòng lịch sử, có trạng thái thì đổi trạng thái yêu cầu. */
  process: async (id: string, status: string | null, note: string): Promise<void> => {
    await rpc(
      "fn_nv_app_yeu_cau_xu_ly",
      { p_id: id, p_trang_thai: status || null, p_noi_dung: note.trim() || null },
      "Không ghi nhận được",
    );
  },

  logs: async (id: string): Promise<RequestLog[]> => {
    const res = await rpc<any>("fn_nv_app_yeu_cau_nhat_ky", { p_id: id }, "Không tải được lịch sử xử lý");
    return (Array.isArray(res) ? res : []).map(mapLog);
  },

  /** 4 danh mục của công ty (chỉ đọc). Lỗi / chưa có mục → bộ cố định của web. */
  catalogs: async (): Promise<RequestCatalogs> => {
    const lists = await Promise.all(
      YC_CATALOG_TYPES.map(async (type) => {
        try {
          return mapCatalog(await fetchCatalogList(type), type);
        } catch {
          return mapCatalog([], type);
        }
      }),
    );
    return Object.fromEntries(YC_CATALOG_TYPES.map((t, i) => [t, lists[i]])) as RequestCatalogs;
  },

  /** Nhân viên của công ty (giá trị = mã NV, như ô chọn web; app xếp theo tên cho dễ tìm). */
  employees: async (): Promise<EmployeeOption[]> => {
    const rows = await callNv<any[]>("fn_nv_app_nhan_vien_list", {});
    const seen = new Set<string>();
    return (Array.isArray(rows) ? rows : [])
      .filter((e) => {
        const code = String(e?.ma_nv ?? "").trim();
        if (!code || seen.has(code)) return false;
        seen.add(code);
        return true;
      })
      .map((e) => ({
        value: String(e.ma_nv).trim(),
        label: String(e.ho_ten || `NV ${e.ma_nv}`),
        description: [e.ten_cv, e.ma_nv].filter(Boolean).join(" · ") || undefined,
      }))
      .sort((x, y) => x.label.localeCompare(y.label, "vi"));
  },

  /**
   * Nhãn hợp đồng / phiếu: `known` = `SoHD` máy chủ trả trong chi tiết (số phiếu của uuid phiếu giữ chỗ); mã cũ (không phải uuid)
   * giữ nguyên; uuid mà máy chủ không trả số ⇒ null (màn hiện mã).
   */
  contractLabel: async (contractId: string | null, known?: string | null): Promise<string | null> => {
    if (!contractId) return null;
    if (known) return known;
    return uid(contractId) ? null : contractId;
  },

  /** Giá trị lưu → link xem: `drive-files:` ký 1 giờ (chỉ tệp của yêu cầu `requestId`); link .NET tương đối gắn máy chủ upload. */
  resolveAttachments: async (stored: string[], requestId: string): Promise<ResolvedAttachment[]> =>
    Promise.all(
      stored.map(async (v) => {
        const fileName = attachmentName(v);
        let url = "";
        if (isStoredFile(v)) {
          url = await signDriveFile(requestId, storedPath(v)).catch(() => "");
        } else {
          url = fileUrl(v);
        }
        return { stored: v, url, fileName, image: isImageFile(fileName) };
      }),
    ),

  /**
   * Tải 1 tệp nhân viên đính kèm (fn_nv_app_tai_tep) → URL lưu vào `dinh_kem`.
   * Luôn lưu URL tuyệt đối: web hiển thị `dinh_kem` trực tiếp (web cũng lưu `https://upload.beesky.vn/<path>`).
   */
  upload: async (file: { uri: string; name?: string; type?: string }): Promise<string> =>
    fileUrl(await uploadTenantFile(file, "yeu-cau")),
};

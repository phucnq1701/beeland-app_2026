/**
 * Yêu cầu khách hàng (nhân viên) – cùng dữ liệu / hàm máy chủ với web
 * `beeland/src/services/CustomerRequest.js` (menu Khách hàng › Tiếp nhận yêu cầu):
 *  - RPC fn_customer_request_list / get / save / delete / process / logs (tenant = claim `company_id` trong JWT,
 *    người thao tác = claim `ma_nv` – máy chủ tự lấy, app không gửi).
 *  - Danh mục loại / nguồn / ưu tiên / trạng thái: `cloud_catalogs` (`ma_ctdk_uid`), chỉ đọc.
 *  - Nhân viên (người tiếp nhận / xử lý): `dm_employees` (`ma_ctdk` = uuid công ty), giá trị = `ma_nv`.
 *  - Tệp khách gửi từ app/web khách hàng lưu `drive-files:<path>` (kho riêng tư) → ký link xem qua edge `storage-broker`.
 *  - Tệp nhân viên thêm: edge `upload-file` (`uploadTenantFile`, như ảnh chứng từ booking / hồ sơ lịch ký).
 * Yêu cầu khách tự gửi (app khách hàng `fn_portal_request_create`) nằm chung bảng → hiện ở đây.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import axiosApiSupabase from "./axiosApiSupabase";
import { uploadTenantFile } from "./BookingService";
import { getCompanyId, getValidSupabaseJwt } from "./cloudTenant";
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

const API_URL = "https://api-beelandv2.beesky.vn";

const errMsg = (e: any, fallback: string): string =>
  e?.response?.data?.message || e?.response?.data?.hint || (e instanceof Error && e.message) || fallback;

async function requireSession(): Promise<void> {
  if (!(await getValidSupabaseJwt())) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
}

async function rpc<T = any>(fn: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  await requireSession();
  try {
    const res = await axiosApiSupabase.post(`rest/v1/rpc/${fn}`, args);
    return res.data as T;
  } catch (e) {
    throw new Error(errMsg(e, fallback));
  }
}

export type RequestCatalogs = Record<YcCatalogType, YcCat[]>;
export type EmployeeOption = { value: string; label: string; description?: string };
export type ResolvedAttachment = { stored: string; url: string; fileName: string; image: boolean };

/** Đổi URL ký nội bộ của storage-broker (http://api-gw:8000/storage/v1/…) về địa chỉ công khai (web `toPublicStorageUrl`). */
const toPublicStorageUrl = (u: string) => {
  const i = u.indexOf("/storage/v1/");
  return i < 0 ? u : `${API_URL}${u.slice(i)}`;
};

async function signDriveFile(path: string): Promise<string> {
  const token = ((await AsyncStorage.getItem("@token")) || "").trim();
  if (!token) throw new Error("Phiên đăng nhập đã hết hạn");
  const res = await axiosApiSupabase.post(
    "functions/v1/storage-broker",
    { action: "sign-download", bucket: "drive-files", path, expiresIn: 3600, token },
    { headers: { "x-cloud-token": token } },
  );
  if (res.data?.error) throw new Error(String(res.data.error));
  const url = toPublicStorageUrl(String(res.data?.data?.signedUrl || ""));
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
      "fn_customer_request_list",
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

  get: async (id: string): Promise<CustomerRequest> => {
    const res = await rpc<any>("fn_customer_request_get", { p_id: id }, "Không tải được yêu cầu");
    const d = Array.isArray(res) ? res[0] : res;
    if (!d) throw new Error("Không tìm thấy yêu cầu");
    return fromApiItem(d);
  },

  /** Thêm (không `id`) hoặc sửa – máy chủ ghi đè toàn bộ trường, tự cấp số phiếu, người tiếp nhận mặc định = người đăng nhập. */
  save: async (form: RequestForm): Promise<CustomerRequest> => {
    const res = await rpc<any>("fn_customer_request_save", { p: toApiPayload(form) }, "Lưu yêu cầu thất bại");
    return fromApiItem(res);
  },

  /** Xoá mềm. */
  remove: async (id: string): Promise<void> => {
    await rpc("fn_customer_request_delete", { p_id: id }, "Xoá yêu cầu thất bại");
  },

  /** Ghi nhận xử lý: thêm 1 dòng lịch sử, có trạng thái thì đổi trạng thái yêu cầu. */
  process: async (id: string, status: string | null, note: string): Promise<void> => {
    await rpc(
      "fn_customer_request_process",
      { p_id: id, p_trang_thai: status || null, p_noi_dung: note.trim() || null },
      "Không ghi nhận được",
    );
  },

  logs: async (id: string): Promise<RequestLog[]> => {
    const res = await rpc<any>("fn_customer_request_logs", { p_id: id }, "Không tải được lịch sử xử lý");
    return (Array.isArray(res) ? res : []).map(mapLog);
  },

  /** 4 danh mục của công ty (chỉ đọc). Lỗi / chưa có mục → bộ cố định của web. */
  catalogs: async (): Promise<RequestCatalogs> => {
    const tenant = uid(await getCompanyId());
    const lists = await Promise.all(
      YC_CATALOG_TYPES.map(async (type) => {
        if (!tenant) return mapCatalog([], type);
        try {
          const res = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
            params: {
              select: "id,item_code,item_name,raw,created_at",
              catalog_type: `eq.${type}`,
              ma_ctdk_uid: `eq.${tenant}`,
              order: "created_at.asc",
              limit: "200",
            },
          });
          return mapCatalog(Array.isArray(res.data) ? res.data : [], type);
        } catch {
          return mapCatalog([], type);
        }
      }),
    );
    return Object.fromEntries(YC_CATALOG_TYPES.map((t, i) => [t, lists[i]])) as RequestCatalogs;
  },

  /** Nhân viên của công ty (giá trị = mã NV, như ô chọn web). */
  employees: async (): Promise<EmployeeOption[]> => {
    const tenant = uid(await getCompanyId());
    if (!tenant) return [];
    const res = await axiosApiSupabase.get("rest/v1/dm_employees", {
      params: { select: "id,ma_nv,ho_ten,ten_cv", ma_ctdk: `eq.${tenant}`, order: "ho_ten.asc", limit: "1000" },
    });
    const rows: any[] = Array.isArray(res.data) ? res.data : [];
    const seen = new Set<string>();
    return rows
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
      }));
  },

  /** Nhãn hợp đồng / phiếu: uuid phiếu giữ chỗ → số phiếu (web `withContractCode`); mã cũ giữ nguyên. */
  contractLabel: async (contractId: string | null): Promise<string | null> => {
    if (!contractId) return null;
    if (!uid(contractId)) return contractId;
    try {
      const res = await axiosApiSupabase.get("rest/v1/cloud_pgc_phieu_giucho", {
        params: { select: "so_phieu_gc", id: `eq.${contractId}`, limit: "1" },
      });
      const row = Array.isArray(res.data) ? res.data[0] : null;
      return row?.so_phieu_gc ? String(row.so_phieu_gc) : null;
    } catch {
      return null;
    }
  },

  /** Giá trị lưu → link xem: `drive-files:` ký 1 giờ qua storage-broker; link .NET tương đối gắn máy chủ upload. */
  resolveAttachments: async (stored: string[]): Promise<ResolvedAttachment[]> =>
    Promise.all(
      stored.map(async (v) => {
        const fileName = attachmentName(v);
        let url = "";
        if (isStoredFile(v)) {
          url = await signDriveFile(storedPath(v)).catch(() => "");
        } else {
          url = fileUrl(v);
        }
        return { stored: v, url, fileName, image: isImageFile(fileName) };
      }),
    ),

  /**
   * Tải 1 tệp nhân viên đính kèm (edge `upload-file`, lỗi thì API .NET) → URL lưu vào `dinh_kem`.
   * Luôn lưu URL tuyệt đối: web hiển thị `dinh_kem` trực tiếp (web cũng lưu `https://upload.beesky.vn/<path>`).
   */
  upload: async (file: { uri: string; name?: string; type?: string }): Promise<string> =>
    fileUrl(await uploadTenantFile(file, "yeu-cau")),
};

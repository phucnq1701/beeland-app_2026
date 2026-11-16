import {
  buildGrid, mapFilters, mapProductDetail, mapProductPerms, mapProductRow, mapProject, productImages,
} from "@/lib/nvSanPham";

import { callNv } from "./nvApi";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (x: unknown) => typeof x === "string" && UUID_RE.test(x.trim());

/* ---------------- Dự án ---------------- */

let projectCache: { at: number; rows: ReturnType<typeof mapProject>[] } | null = null;
const PROJECT_TTL_MS = 60_000;

export const DuAnApi = {
  /** Dự án đang áp dụng trong phạm vi người dùng (máy chủ tự áp công ty + dự án được gán / đại lý). */
  async list(opts: { keyword?: string; page?: number; size?: number } = {}) {
    const res = await callNv<{ rows: any[]; total: number }>("fn_nv_app_du_an_list", {
      p_tu_khoa: opts.keyword?.trim() || null,
      p_trang: opts.page ?? 1,
      p_so_dong: opts.size ?? 200,
    });
    const rows = (res?.rows ?? []).map(mapProject);
    if (!opts.keyword && (opts.page ?? 1) === 1 && (opts.size ?? 200) >= 200) projectCache = { at: Date.now(), rows };
    return { rows, total: Number(res?.total ?? rows.length) };
  },

  /** uuid dự án từ uuid / mã dự án (ma_da_code) — tra trong danh sách dự án người dùng được xem (đệm 60 giây). */
  async resolveId(codeOrId: unknown): Promise<string | null> {
    const key = String(codeOrId ?? "").trim();
    if (!key || key === "-1" || key === "null") return null;
    if (isUuid(key)) return key;
    const find = (rows: any[]) => rows.find((p) => String(p.ma_da_code ?? "") === key)?.id ?? null;
    if (projectCache && Date.now() - projectCache.at < PROJECT_TTL_MS) {
      const hit = find(projectCache.rows);
      if (hit) return hit;
    }
    const { rows } = await DuAnApi.list({ size: 1000 });
    return find(rows);
  },

  /** Xoá đệm (đăng nhập tài khoản khác). */
  clearCache() {
    projectCache = null;
  },
};

/* ---------------- Sản phẩm ---------------- */

export interface ProductListFilter {
  projectId?: string | null;
  zoneId?: string | null;
  statusId?: string | null;
  formCode?: string | null;
  keyword?: string | null;
  page?: number;
  size?: number;
}

export const SanPhamApi = {
  /** Ô lọc màn Sản phẩm: khu của dự án + danh mục trạng thái (màu theo công ty). */
  async filters(projectId: string | null) {
    if (!projectId) {
      const r = await callNv("fn_nv_app_san_pham_bo_loc", { p_du_an_id: null });
      return mapFilters(r);
    }
    return mapFilters(await callNv("fn_nv_app_san_pham_bo_loc", { p_du_an_id: projectId }));
  },

  /** Danh sách căn (máy chủ áp phạm vi: đại lý ⇒ căn trong giỏ; nội bộ ⇒ dự án được gán). */
  async list(f: ProductListFilter) {
    const res = await callNv<{ rows: any[]; total: number }>("fn_nv_app_san_pham_list", {
      p_du_an_id: f.projectId || null,
      p_khu_id: isUuid(f.zoneId) ? f.zoneId : null,
      p_trang_thai_id: isUuid(f.statusId) ? f.statusId : null,
      p_loai: f.formCode || null,
      p_tu_khoa: f.keyword?.trim() || null,
      p_trang: f.page ?? 1,
      p_so_dong: f.size ?? 50,
    });
    return { data: (res?.rows ?? []).map(mapProductRow), total: Number(res?.total ?? 0) };
  },

  /** Sơ đồ căn của dự án (dạng lưới khu → tầng → căn). */
  async grid(projectId: string) {
    return buildGrid(await callNv("fn_nv_app_so_do", { p_du_an_id: projectId }));
  },

  /** Chi tiết căn theo uuid / mã SP / ký hiệu: căn + ảnh + giá đang áp dụng + quyền giao dịch. null = không thấy. */
  async detail(key: string) {
    const r = await callNv<any>("fn_nv_app_san_pham_chi_tiet", { p_id: String(key ?? "").trim() });
    if (!r) return null;
    return {
      product: mapProductDetail(r)!,
      images: productImages(r.anh),
      lockSeconds: Math.max(0, Number(r?.khoa?.so_giay_con_lai) || 0),
      activePrice: r.gia ?? null,
      perms: mapProductPerms(r),
    };
  },
};

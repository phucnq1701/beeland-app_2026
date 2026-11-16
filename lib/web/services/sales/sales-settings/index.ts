// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/sales-settings/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { rpcRaw } from "../../_core/rpc";
import { sessionCompanyId } from "../../../_shims/lib/session";
import { resolveProjectUid } from "../../salesDocsCloud";

/**
 * Cài đặt bán hàng theo dự án + khoảng thời gian.
 * Lưu ở bảng RIÊNG `cloud_sales_settings` (khóa UUID):
 *  - ma_ctdk  -> cloud_companies.id (công ty đăng ký của phiên đăng nhập)
 *  - ma_da    -> da_projects.id (null = áp dụng chung cho mọi dự án)
 */
export interface SalesSetting {
  id?: string;
  /** UUID dự án (null = áp dụng chung) */
  ma_da?: string | null;
  /** Tên dự án (chỉ để hiển thị, lấy từ join) */
  ten_da?: string | null;
  tu_ngay?: string | null;
  den_ngay?: string | null;
  tien_dat_coc?: number | null;
  tien_booking_thien_chi?: number | null;
  tien_booking?: number | null;
  /** Số booking thiện chí tối đa 1 khách hàng được tạo trong 1 dự án */
  so_booking_max?: number | null;
  so_ngay_han_booking?: number | null;
  /** Thời gian lock căn (phút) */
  thoi_gian_lock?: number | null;
  /** Thời gian giữ chỗ booking (phút) */
  thoi_gian_booking?: number | null;
  /** Hạn đặt cọc (ngày) */
  thoi_gian_dat_coc?: number | null;
  so_booking_uu_tien?: number | null;
  booking_uu_tien?: boolean;
  tu_dong_huy_booking?: boolean;
  /** Tự huỷ đặt cọc quá hạn */
  tu_dong_huy_dat_coc?: boolean;
  /** Duyệt ràng buộc thu tiền cọc: bật ⇒ chỉ duyệt đặt cọc khi đã thu ≥ phải cọc (máy chủ mặc định bật) */
  duyet_rang_buoc_thu_coc?: boolean;
  /** Số ngày ký TTĐC tính từ ngày đủ cọc (api manual 184); null = không đặt hạn */
  so_ngay_ky_ttdc?: number | null;
  /** Thời hạn hợp đồng (ngày) */
  thoi_han_hop_dong?: number | null;
  is_enable_job?: boolean;
  /** Đang áp dụng */
  is_active?: boolean;
  note?: string | null;
}


/** Toàn bộ đọc/ghi qua hàm máy chủ fn_sales_setting_* (công ty lấy từ token). */
let cache: { ctdk: string; at: number; rows: SalesSetting[] } | null = null;
const resolveCache = new Map<string, { at: number; p: Promise<{ has_scope: boolean; setting: SalesSetting | null }> }>();

const norm = (v: any) => (v == null || v === "" ? "" : String(v).trim());
/** Ngày theo giờ máy (VN), không dùng toISOString — UTC lệch sang ngày hôm trước từ 0h–7h. */
const ymd = (d?: Date) => {
  const x = d ?? new Date();
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
};
const num = (v: any) => (v == null || v === "" ? null : Number(v));
const isUuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

const rpc = (fn: string, args: Record<string, any>) => rpcRaw<any>(fn, args, { fallback: `${fn} lỗi` });

const projectUid = async (maDA: any): Promise<string | null> => {
  const v = norm(maDA);
  if (!v) return null;
  return isUuid(v) ? v : await resolveProjectUid(v);
};

const fromRow = (r: any): SalesSetting => ({
  id: r?.id,
  ma_da: r?.ma_da ?? null,
  ten_da: r?.ten_da ?? null,
  tu_ngay: r?.tu_ngay ?? null,
  den_ngay: r?.den_ngay ?? null,
  tien_dat_coc: num(r?.tien_dat_coc),
  tien_booking_thien_chi: num(r?.tien_booking_thien_chi),
  tien_booking: num(r?.tien_booking),
  so_booking_max: num(r?.so_booking_max),
  so_ngay_han_booking: num(r?.so_ngay_han_booking),
  thoi_gian_lock: num(r?.thoi_gian_lock),
  thoi_gian_booking: num(r?.thoi_gian_booking),
  thoi_gian_dat_coc: num(r?.thoi_gian_dat_coc),
  so_booking_uu_tien: num(r?.so_booking_uu_tien),
  booking_uu_tien: r?.booking_uu_tien === true,
  tu_dong_huy_booking: r?.tu_dong_huy_booking === true,
  tu_dong_huy_dat_coc: r?.tu_dong_huy_dat_coc === true,
  duyet_rang_buoc_thu_coc: r?.duyet_rang_buoc_thu_coc !== false,
  so_ngay_ky_ttdc: num(r?.so_ngay_ky_ttdc),
  thoi_han_hop_dong: num(r?.thoi_han_hop_dong),
  is_enable_job: r?.is_enable_job !== false,
  is_active: r?.ap_dung !== false,
  note: r?.ghi_chu ?? null,
});

const invalidate = () => {
  cache = null;
  resolveCache.clear();
};

const resolveRaw = (uid: string | null, day: string) => {
  const key = `${sessionCompanyId()}|${uid ?? ""}|${day}`;
  const hit = resolveCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.p;
  const p = rpc("fn_sales_setting_resolve", { p_ma_da: uid, p_at: day }).then((d: any) => ({
    has_scope: d?.has_scope === true,
    setting: d?.setting ? fromRow(d.setting) : null,
  }));
  p.catch(() => resolveCache.delete(key));
  resolveCache.set(key, { at: Date.now(), p });
  return p;
};

export const SalesSettingsService = {
  /** Danh sách cài đặt (JSON từ fn_sales_setting_list), tùy chọn lọc theo dự án */
  async list(force = false, maDA?: any): Promise<SalesSetting[]> {
    const ctdk = sessionCompanyId();
    if (!ctdk) return [];
    if (norm(maDA)) {
      const uid = await projectUid(maDA);
      const data = await rpc("fn_sales_setting_list", { p_ma_da: uid });
      return (Array.isArray(data) ? data : []).map(fromRow);
    }
    if (!force && cache && cache.ctdk === ctdk && Date.now() - cache.at < 60_000) return cache.rows;
    const data = await rpc("fn_sales_setting_list", { p_ma_da: null });
    const rows = (Array.isArray(data) ? data : []).map(fromRow);
    cache = { ctdk, at: Date.now(), rows };
    return rows;
  },

  async save(setting: SalesSetting): Promise<SalesSetting> {
    const ma_da = await projectUid(setting.ma_da);
    const data = await rpc("fn_sales_setting_save", { p_data: { ...setting, ma_da } });
    invalidate();
    return fromRow(data);
  },

  async remove(setting: Pick<SalesSetting, "id">): Promise<void> {
    if (!setting.id) throw new Error("Không xác định được cài đặt cần xoá");
    await rpc("fn_sales_setting_delete", { p_id: setting.id });
    invalidate();
  },

  clearCache() {
    invalidate();
  },

  /** Phạm vi đã có cài đặt nhưng không có cài đặt hiệu lực tại `at` → ok = false */
  async checkEffective(
    maDA?: any,
    at?: Date
  ): Promise<{ ok: boolean; setting: SalesSetting | null; message?: string }> {
    try {
      const r = await resolveRaw(await projectUid(maDA), ymd(at));
      if (r.setting || !r.has_scope) return { ok: true, setting: r.setting };
    } catch {
      return { ok: true, setting: null };
    }
    return {
      ok: false,
      setting: null,
      message: `Ngày ${ymd(at)} không nằm trong khoảng ngày áp dụng của cài đặt bán hàng. Vui lòng cập nhật cài đặt bán hàng cho dự án.`,
    };
  },

  /** Cài đặt hiệu lực (ưu tiên riêng dự án, sau đó áp dụng chung) — 1 lần gọi máy chủ */
  async resolve(maDA?: any, at?: Date): Promise<SalesSetting | null> {
    try {
      return (await resolveRaw(await projectUid(maDA), ymd(at))).setting;
    } catch {
      return null;
    }
  },
};

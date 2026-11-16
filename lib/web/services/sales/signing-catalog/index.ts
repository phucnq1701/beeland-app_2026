// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/signing-catalog/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Danh mục dùng cho Đặt lịch ký (Bán hàng › Cài đặt › Cài đặt danh mục) — cấp công ty, qua RPC:
 *   - Điểm ký: fn_signing_location_list / _save / _delete — theo DỰ ÁN (1 điểm = 1 dự án, DK16); tên, địa chỉ, SĐT, hướng dẫn
 *   - Danh mục hồ sơ: fn_signing_ho_so_list / _save (khớp theo mã, ghi đè cả danh mục) — mỗi hồ sơ có quỹ (trống = tất cả, DK17)
 */
import { rpcRaw } from "../../_core/rpc";

export interface SigningLocation {
  id: string;
  /** Dự án của điểm ký (bắt buộc) */
  projectId: string;
  tenDA: string | null;
  ten: string;
  diaChi: string | null;
  viDo: number | null;
  kinhDo: number | null;
  dienThoai: string | null;
  huongDan: string | null;
  order: number;
  active: boolean;
  /** Số bộ cấu hình ca đang dùng điểm này */
  soCauHinh: number;
}

export type SigningLocationInput = Omit<SigningLocation, "id" | "soCauHinh" | "projectId" | "tenDA"> & {
  id?: string | null;
  projectId: string | null;
};

export interface HoSoItem {
  id?: string;
  code: string;
  name: string;
  note?: string;
  order: number;
  active: boolean;
  /** Quỹ áp dụng; null = tất cả quỹ */
  quyId?: string | null;
  quyTen?: string | null;
}

const numOrNull = (v: unknown) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export const toLocation = (r: any): SigningLocation => ({
  id: String(r.id).toLowerCase(),
  projectId: r.project_id ? String(r.project_id).toLowerCase() : "",
  tenDA: r.ten_da ?? null,
  ten: r.ten ?? "",
  diaChi: r.dia_chi ?? null,
  viDo: numOrNull(r.vi_do),
  kinhDo: numOrNull(r.kinh_do),
  dienThoai: r.dien_thoai ?? null,
  huongDan: r.huong_dan ?? null,
  order: Number(r.order) || 0,
  active: r.active !== false,
  soCauHinh: Number(r.so_cau_hinh) || 0,
});

const toHoSoItem = (r: any): HoSoItem => ({
  id: r.id ? String(r.id).toLowerCase() : undefined,
  code: String(r.code),
  name: r.name ?? "",
  note: r.note ?? "",
  order: Number(r.order) || 0,
  active: r.active !== false,
  quyId: r.quy_id ? String(r.quy_id).toLowerCase() : null,
  quyTen: r.quy_ten ?? null,
});

export const SigningLocationService = {
  /** `all` = cả điểm đã tắt (màn cài đặt); `projectId` ⇒ chỉ điểm của dự án đó (lọc cả ở trình duyệt — API cũ bỏ qua tham số lạ) */
  list: async (all = false, projectId?: string | null): Promise<SigningLocation[]> => {
    const r = await rpcRaw<{ rows?: unknown[] }>("fn_signing_location_list", { p_all: all, ...(projectId ? { p_project_id: projectId } : {}) });
    const rows = (r?.rows ?? []).map(toLocation);
    return projectId ? rows.filter((x) => x.projectId === projectId.toLowerCase()) : rows;
  },
  save: async (d: SigningLocationInput): Promise<SigningLocation> => {
    const r = await rpcRaw<{ row?: unknown }>("fn_signing_location_save", {
      p_data: {
        id: d.id ?? null,
        project_id: d.projectId,
        ten: d.ten.trim(),
        dia_chi: d.diaChi?.trim() || null,
        vi_do: d.viDo,
        kinh_do: d.kinhDo,
        dien_thoai: d.dienThoai?.trim() || null,
        huong_dan: d.huongDan?.trim() || null,
        order: d.order,
        active: d.active,
      },
    });
    return toLocation(r?.row);
  },
  remove: async (id: string): Promise<void> => {
    await rpcRaw("fn_signing_location_delete", { p_id: id });
  },
};

export const SigningHoSoService = {
  list: async (all = false): Promise<HoSoItem[]> => {
    const r = await rpcRaw<{ rows?: unknown[] }>("fn_signing_ho_so_list", { p_all: all });
    return (r?.rows ?? []).map(toHoSoItem);
  },
  save: async (items: HoSoItem[]): Promise<HoSoItem[]> => {
    const r = await rpcRaw<{ rows?: unknown[] }>("fn_signing_ho_so_save", {
      p_items: items.map((i) => ({
        code: i.code,
        name: i.name.trim(),
        note: i.note?.trim() || null,
        quy_id: i.quyId || null,
        order: i.order,
        active: i.active,
      })),
    });
    return (r?.rows ?? []).map(toHoSoItem);
  },
};

/**
 * Tách toạ độ từ link / chuỗi Google Maps (DK5) — không gọi dịch vụ ngoài.
 * Nhận: "21.0285, 105.8542", ".../@21.0285,105.8542,17z", "...?q=21.02,105.85", "...!3d21.02!4d105.85". Link rút gọn (maps.app.goo.gl) không có toạ độ ⇒ null.
 */
export const parseLatLng = (text: string): { lat: number; lng: number } | null => {
  const s = decodeURIComponent(String(text || "").trim());
  const pats = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/,
  ];
  for (const re of pats) {
    const m = s.match(re);
    if (m) {
      const lat = Number(m[1]);
      const lng = Number(m[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat: round6(lat), lng: round6(lng) };
    }
  }
  return null;
};

export const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/** Link mở Google Maps chỉ đường tới điểm (ưu tiên toạ độ, không có thì theo địa chỉ) */
export const googleMapsLink = (p: { viDo?: number | null; kinhDo?: number | null; diaChi?: string | null }) =>
  p.viDo != null && p.kinhDo != null
    ? `https://www.google.com/maps/search/?api=1&query=${p.viDo},${p.kinhDo}`
    : p.diaChi
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.diaChi)}`
      : null;

// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/preBooking/context.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * BOOKING THIỆN CHÍ — nền tảng dùng chung cho toàn bộ nghiệp vụ.
 *
 * Bảng `public.cloud_pre_bookings` chỉ lưu KHÓA UUID:
 *  - ma_ctdk_uid     → cloud_companies.id (công ty đăng ký, lấy từ token)
 *  - da_project_id   → da_projects.id
 *  - khach_hang_id   → cloud_customers.id
 *  - san_pham_id     → bds_products.id
 *  - phieu_giu_cho_id→ cloud_pgc_phieu_giucho.id
 *  - khoang_gia_id / khoang_dt_id → cloud_catalogs.id
 *  - san_id          → dm_companies.id (is_san = true)
 *  - created_by_id / updated_by_id / deleted_by_id / nguoi_duyet_id → dm_employees.id
 *
 * Mọi thông tin hiển thị (tên khách, tên dự án, ký hiệu căn…) được JOIN khi đọc,
 * không lưu bản sao chữ trong bảng booking.
 */
import { supabase } from "../../_shims/integrations/supabase/client";
import {
  sessionCompanyId,
  sessionBranchId,
  sessionEmployeeId,
} from "../../_shims/lib/session";
import { agencySanIdSync } from "../../lib/agencySan";
import { readCloudTenant } from "../cloudTenant";
import { getDaProjectRaw } from "../DaProjectCatalog";
import { customerMapByIds } from "../customers/customer-lookup";

export const TBL = "cloud_pre_bookings" as any;

/* ------------------------------------------------------------------ */
/* Phiên đăng nhập                                                     */
/* ------------------------------------------------------------------ */

export const authUser = (): any => {
  try {
    return JSON.parse(localStorage.getItem("authUser") || "{}");
  } catch {
    return {};
  }
};

/** Mã công ty đăng ký dạng chữ — chỉ dùng cho các bảng phụ chưa chuyển UUID. */
export const bookingMaCTDK = (): string => readCloudTenant();

/** UUID công ty đăng ký (nguồn chuẩn cho bảng booking). */
export const tenantUid = (): string => sessionCompanyId() || "";

/** Tài khoản đang đăng nhập có phải đại lý không. */
export const isAgencyAccount = (): boolean => {
  const u = authUser();
  const t = String(
    u?.typeAccount ?? u?.n ?? u?.data?.typeAccount ?? u?.data?.n ?? ""
  ).toUpperCase();
  if (t) return t === "AGENCY";
  try {
    return String(localStorage.getItem("n") || "").toUpperCase() === "AGENCY";
  } catch {
    return false;
  }
};

/** Mã sàn của đại lý đang đăng nhập (null nếu là tài khoản hệ thống). */
export const agencyMaSan = (): string | number | null => {
  if (!isAgencyAccount()) return null;
  const cached = agencySanIdSync();
  if (cached) return cached;
  const branch = sessionBranchId();
  if (branch) return branch;
  const u = authUser();
  const raw = String(
    u?.data?.maSan ?? u?.data?.MaSan ?? u?.maSan ?? u?.MaSan ?? ""
  ).trim();
  return raw || null;
};

/** Giữ nguyên mã sàn (uuid hoặc số), không ép kiểu số gây NaN */
export const sanValue = (v: any): string | number | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" || s === "0" ? null : s;
};

export const currentUserName = (): string => {
  const root = authUser() ?? {};
  const u = root?.data ?? {};
  const pick = (o: any) =>
    o?.hoTen ??
    o?.HoTen ??
    o?.fullName ??
    o?.full_name ??
    o?.tenNV ??
    o?.TenNV ??
    o?.userName ??
    o?.email;
  return String(pick(u) ?? pick(root) ?? "");
};

/** UUID nhân viên đang đăng nhập (dm_employees.id). */
export const currentEmployeeId = (): string | null => uid(sessionEmployeeId());

/* ------------------------------------------------------------------ */
/* Tiện ích chung                                                      */
/* ------------------------------------------------------------------ */

export const ok = (data: any, extra: Record<string, any> = {}): any => ({
  status: 2000,
  data,
  ...extra,
});
export const fail = (message: string, code?: string | null): any => ({
  status: 5000,
  message,
  data: null,
  ...(code ? { code } : {}),
});

/** Lỗi RPC (PreBookingActionError) ⇒ `fail` giữ nguyên thông điệp máy chủ + `code` (55000 / 22023 / 42501 / P0002…) */
export const failFrom = (e: unknown, fallback: string) => {
  const err = (e ?? {}) as { message?: unknown; code?: unknown };
  return fail(String(err.message || fallback), typeof err.code === "string" ? err.code : null);
};

export const num = (v: any): number | null => {
  const n = Number(v);
  return Number.isFinite(n) && v !== null && v !== "" ? n : null;
};

export const str = (v: any): string | null => {
  const s = String(v ?? "").trim();
  return s ? s : null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trả về chuỗi uuid hợp lệ, ngược lại null (tránh lỗi 22P02). */
export function uid(v: any): string | null {
  const s = String(v ?? "").trim();
  return UUID_RE.test(s) ? s : null;
}

export const isUuid = (v: any) => uid(v) != null;

/** Bộ lọc **Hoạt động / Đã xóa** dùng chung cho các danh sách. */
export const applyDeletedFilter = (q: any, payload: any = {}) =>
  payload?.Deleted ? q.not("deleted_at", "is", null) : q.is("deleted_at", null);

/** Thông tin xóa mềm (bảng booking chính còn cột tên người xóa). */
export const softDeletePatch = () => ({
  deleted_at: new Date().toISOString(),
  deleted_by: currentUserName(),
  deleted_by_id: currentEmployeeId(),
});

/** Thông tin xóa mềm cho các bảng chứng từ chỉ dùng UUID. */
export const softDeletePatchUid = () => ({
  deleted_at: new Date().toISOString(),
  deleted_by_id: currentEmployeeId(),
});

/** UUID sàn của đại lý đang đăng nhập (chỉ khi là uuid hợp lệ). */
export const agencySanUid = (): string | null => uid(agencyMaSan());

/** Tên nhân viên theo danh sách UUID (dùng để hiển thị người tạo/duyệt). */
export const employeeNames = async (
  ids: any[]
): Promise<Record<string, string>> => {
  const list = Array.from(new Set(ids.map(uid).filter(Boolean) as string[]));
  const out: Record<string, string> = {};
  if (!list.length) return out;
  const { data } = await supabase
    .from("dm_employees" as any)
    .select("id, ho_ten")
    .in("id", list);
  ((data as any[]) || []).forEach((e) => {
    out[String(e.id)] = e?.ho_ten ?? "";
  });
  return out;
};

/** Ghi nhật ký thao tác của phiếu booking (best-effort). */
export const writeLog = async (
  bookingId: string,
  action: string,
  noiDung: string,
  stateFrom?: string | null,
  stateTo?: string | null
) => {
  try {
    await supabase.from("cloud_pre_booking_logs" as any).insert({
      ma_ctdk: tenantUid(),
      booking_id: bookingId,
      action,
      noi_dung: noiDung,
      state_from: stateFrom ?? null,
      state_to: stateTo ?? null,
      created_by_id: currentEmployeeId(),
    } as any);
  } catch {
    /* logs are best-effort */
  }
};


/* ------------------------------------------------------------------ */
/* Bộ giải mã tham chiếu (mã cũ / uuid → uuid)                         */
/* ------------------------------------------------------------------ */

const memo = new Map<string, { at: number; value: any }>();
const MEMO_TTL = 5 * 60 * 1000;

const cached = async <T>(key: string, loader: () => Promise<T>): Promise<T> => {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < MEMO_TTL) return hit.value as T;
  const value = await loader();
  memo.set(key, { at: Date.now(), value });
  return value;
};

export const resetPreBookingCache = () => memo.clear();

/** uuid dự án theo MaDA cũ hoặc uuid. */
export const resolveProjectId = async (maDA: any): Promise<string | null> => {
  if (maDA == null || maDA === "") return null;
  const direct = uid(maDA);
  if (direct) return direct;
  return cached(`prj|${maDA}`, async () => {
    try {
      const row: any = await getDaProjectRaw(maDA);
      return row?.id ? String(row.id) : null;
    } catch {
      return null;
    }
  });
};

export interface ProjectMeta {
  id: string;
  MaDA: any;
  TenDA: string;
}

/** Thông tin hiển thị của nhiều dự án theo uuid. */
export const projectMetaByIds = async (
  ids: string[]
): Promise<Record<string, ProjectMeta>> => {
  const list = Array.from(new Set(ids.map(uid).filter(Boolean) as string[]));
  const out: Record<string, ProjectMeta> = {};
  if (!list.length) return out;
  const { data } = await supabase
    .from("da_projects" as any)
    .select("id, ten_da, ma_da_code")
    .in("id", list);
  ((data as any[]) || []).forEach((r) => {
    out[String(r.id)] = {
      id: String(r.id),
      MaDA: r?.ma_da_code ?? r.id,
      TenDA: r?.ten_da ?? "",
    };
  });
  return out;
};

/** uuid sản phẩm theo uuid / ký hiệu / mã sản phẩm cũ, trong phạm vi dự án. */
export const resolveProductId = async (input: {
  MaSP?: any;
  KyHieu?: any;
  projectId?: string | null;
}): Promise<string | null> => {
  const direct = uid(input.MaSP) ?? uid(input.KyHieu);
  if (direct) return direct;
  const refs = [input.KyHieu, input.MaSP]
    .map((v) => str(v))
    .filter(Boolean) as string[];
  if (!refs.length) return null;
  const tenant = tenantUid();
  if (!tenant) return null;

  for (const ref of refs) {
    let q = supabase
      .from("bds_products" as any)
      .select("id")
      .eq("ma_ctdk", tenant)
      .or(`ky_hieu.eq.${ref},ma_sp.eq.${ref}`)
      .limit(2);
    const pid = uid(input.projectId);
    if (pid) q = q.eq("ma_da", pid);
    const { data } = await q;
    const rows = (data as any[]) || [];
    if (rows.length === 1) return String(rows[0].id);
  }
  return null;
};

export interface ProductMeta {
  id: string;
  MaSP: any;
  KyHieu: string | null;
  projectId: string | null;
}

export const productMetaByIds = async (
  ids: string[]
): Promise<Record<string, ProductMeta>> => {
  const list = Array.from(new Set(ids.map(uid).filter(Boolean) as string[]));
  const out: Record<string, ProductMeta> = {};
  if (!list.length) return out;
  const { data } = await supabase
    .from("bds_products" as any)
    .select("id, ma_sp, ky_hieu, ma_da")
    .in("id", list);
  ((data as any[]) || []).forEach((r) => {
    out[String(r.id)] = {
      id: String(r.id),
      MaSP: r.ma_sp ?? null,
      KyHieu: r.ky_hieu ?? null,
      projectId: r.ma_da ? String(r.ma_da) : null,
    };
  });
  return out;
};

/** uuid phiếu giữ chỗ theo uuid hoặc số phiếu. */
export const resolvePgcId = async (ref: any): Promise<string | null> => {
  const direct = uid(ref);
  if (direct) return direct;
  const code = str(ref);
  if (!code) return null;
  const tenant = tenantUid();
  if (!tenant) return null;
  const { data } = await supabase
    .from("cloud_pgc_phieu_giucho" as any)
    .select("id")
    .eq("ma_ctdk_uid", tenant)
    .eq("so_phieu_gc", code)
    .limit(1);
  const row = ((data as any[]) || [])[0];
  return row?.id ? String(row.id) : null;
};

/** uuid danh mục (khoảng giá / diện tích…) theo uuid hoặc mã cũ. */
export const resolveCatalogId = async (
  catalogType: string,
  ref: any,
  projectId?: string | null
): Promise<string | null> => {
  const direct = uid(ref);
  if (direct) return direct;
  const code = str(ref);
  if (!code) return null;
  const tenant = tenantUid();
  if (!tenant) return null;
  return cached(`cat|${catalogType}|${projectId ?? ""}|${code}`, async () => {
    let q = supabase
      .from("cloud_catalogs" as any)
      .select("id")
      .eq("ma_ctdk_uid", tenant)
      .eq("catalog_type", catalogType)
      .eq("item_code", code)
      .limit(1);
    const pid = uid(projectId);
    if (pid) q = q.eq("da_project_id", pid);
    const { data } = await q;
    const row = ((data as any[]) || [])[0];
    return row?.id ? String(row.id) : null;
  });
};

export const catalogNameByIds = async (
  ids: string[]
): Promise<Record<string, string>> => {
  const list = Array.from(new Set(ids.map(uid).filter(Boolean) as string[]));
  const out: Record<string, string> = {};
  if (!list.length) return out;
  const { data } = await supabase
    .from("cloud_catalogs" as any)
    .select("id, item_name, item_code")
    .in("id", list);
  ((data as any[]) || []).forEach((r) => {
    out[String(r.id)] = r.item_name || r.item_code || "";
  });
  return out;
};

/** uuid sàn giao dịch (dm_companies.is_san) — đại lý luôn ép theo token. */
export const resolveSanId = async (ref: any): Promise<string | null> => {
  const forced = uid(agencyMaSan());
  if (forced) return forced;
  const direct = uid(ref);
  if (direct) return direct;
  const code = str(ref);
  if (!code) return null;
  const tenant = tenantUid();
  if (!tenant) return null;
  return cached(`san|${code}`, async () => {
    const { data } = await supabase
      .from("dm_companies" as any)
      .select("id")
      .eq("tenant_company_id", tenant)
      .eq("is_san", true)
      .or(`ma_dl.eq.${code},ten_ct.eq.${code}`)
      .limit(2);
    const rows = (data as any[]) || [];
    return rows.length === 1 ? String(rows[0].id) : null;
  });
};

export const companyNameByIds = async (
  ids: string[]
): Promise<Record<string, string>> => {
  const list = Array.from(new Set(ids.map(uid).filter(Boolean) as string[]));
  const out: Record<string, string> = {};
  if (!list.length) return out;
  const { data } = await supabase
    .from("dm_companies" as any)
    .select("id, ten_ct")
    .in("id", list);
  ((data as any[]) || []).forEach((r) => {
    out[String(r.id)] = r.ten_ct || "";
  });
  return out;
};

export const employeeNameByIds = async (
  ids: string[]
): Promise<Record<string, string>> => {
  const list = Array.from(new Set(ids.map(uid).filter(Boolean) as string[]));
  const out: Record<string, string> = {};
  if (!list.length) return out;
  const { data } = await supabase
    .from("dm_employees" as any)
    .select("id, ho_ten")
    .in("id", list);
  ((data as any[]) || []).forEach((r) => {
    out[String(r.id)] = r.ho_ten || "";
  });
  return out;
};

export interface CustomerMeta {
  id: string;
  TenKH: string | null;
  DiDong: string | null;
  Email: string | null;
  SoCMND: string | null;
  NgayCap: string | null;
  NoiCap: string | null;
  MaSoKH: string | null;
}

export const customerMetaByIds = async (
  ids: string[]
): Promise<Record<string, CustomerMeta>> => {
  const list = Array.from(new Set(ids.map(uid).filter(Boolean) as string[]));
  const out: Record<string, CustomerMeta> = {};
  if (!list.length) return out;
  // fn_customer_get_by_ids (bảng khách đã khoá đọc thẳng); khách công ty khác trên chứng từ ⇒ bản giới hạn (CCCD che)
  const data = Array.from((await customerMapByIds(list)).values());
  data.forEach((r) => {
    out[String(r.id)] = {
      id: String(r.id),
      TenKH:
        String(r.ten_kh ?? "").trim() ||
        String(r.ten_cong_ty ?? "").trim() ||
        null,
      DiDong: r.dien_thoai ?? null,
      Email: r.email ?? null,
      SoCMND: r.cccd ?? null,
      // Bản giới hạn (khách công ty khác) máy chủ trả null các trường giấy tờ
      NgayCap: r.ngay_cap ?? null,
      NoiCap: r.noi_cap ?? null,
      MaSoKH: r.ma_so_kh ?? null,
    };
  });
  return out;
};

export const pgcCodeByIds = async (
  ids: string[]
): Promise<Record<string, string>> => {
  const list = Array.from(new Set(ids.map(uid).filter(Boolean) as string[]));
  const out: Record<string, string> = {};
  if (!list.length) return out;
  const { data } = await supabase
    .from("cloud_pgc_phieu_giucho" as any)
    .select("id, so_phieu_gc")
    .in("id", list);
  ((data as any[]) || []).forEach((r) => {
    out[String(r.id)] = r.so_phieu_gc || "";
  });
  return out;
};

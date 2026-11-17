// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/SalesDocListService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * SalesDocListService — DANH SÁCH CHỨNG TỪ BÁN HÀNG THEO GIAI ĐOẠN VÒNG ĐỜI
 *
 * Nguồn gốc duy nhất là `cloud_pgc_phieu_giucho`. Cột `giai_doan` quyết định
 * phiếu đang nằm ở màn hình nào:
 *
 *   GIUCHO -> Giữ chỗ / booking
 *   DATCOC -> Đặt cọc
 *   HDGV   -> Hợp đồng góp vốn
 *   HDMB   -> Hợp đồng mua bán
 *
 * NGUYÊN TẮC TRUY VẤN (bản mới):
 *  - Lọc dự án theo NHIỀU dự án: `project_id in (...)` (trước đây chỉ lấy 1).
 *  - PHÂN TRANG TRÊN MÁY CHỦ: dùng `range()` + `count: exact`, không tải
 *    2000 dòng rồi cắt ở trình duyệt.
 *  - Giai đoạn DATCOC/HDGV/HDMB truy vấn thẳng bảng chứng từ tương ứng
 *    (`cloud_deposits` / `cloud_contracts`) và inner-join dòng vòng đời, nhờ đó
 *    lọc ngày chứng từ + sắp xếp + đếm tổng đều chạy dưới máy chủ.
 *  - Giai đoạn GIUCHO truy vấn thẳng bảng vòng đời.
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { applyDataScope } from "./DataScopeService";
import { memoAsync, clearApiCache } from "../lib/apiCache";
import {
  PGC_SELECT,
  isUuid,
  mapContractRow,
  mapDepositRow,
  mapSalesDoc,
  resolveProjectUid,
  salesTenantUid,
} from "./salesDocsCloud";
import type { SalesStage } from "./SalesLifecycleCloudService";
import { vnDayStart, vnDayEnd } from "../utils/vnDate";
import { searchDocCustomerIds, withCustomers } from "./customers/customer-lookup";
import { applyStatusColors } from "./system/status-catalog";

export interface SalesDocListFilter {
  /** Giai đoạn cần lấy (1 hoặc nhiều) */
  stage: SalesStage | SalesStage[];
  /** Loại hợp đồng khi stage là HDGV / HDMB */
  loaiCT?: "HDGV" | "HDMB";
  /** 1 dự án, mảng dự án, hoặc chuỗi "a,b,c" */
  maDA?: any;
  tuNgay?: any;
  denNgay?: any;
  keyword?: string;
  pageIndex?: number;
  pageSize?: number;
  limit?: number;
  /**
   * true  → chỉ lấy HỢP ĐỒNG CHUYỂN NHƯỢNG (có hợp đồng gốc)
   * false → chỉ lấy hợp đồng gốc (không phải chuyển nhượng)
   */
  transferOnly?: boolean;
  /** Lọc theo uuid công ty/sàn (cloud_pgc_phieu_giucho.san_id) */
  companyIds?: string[];
}

/** Trần an toàn khi màn hình không truyền cỡ trang */
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 5000;

const CAT = "cloud_catalogs!trang_thai_id(id,item_code,item_name,color_code)";
const EMP_IN = "dm_employees!nguoi_nhap_id(id,ma_nv,ho_ten)";
const EMP_UP = "dm_employees!nguoi_sua_id(id,ma_nv,ho_ten)";

/**
 * Select GỌN cho màn hình danh sách: chỉ lấy đúng cột đang hiển thị.
 * KHÔNG lấy `*` (kéo theo `payload`, `lich_su_chuyen_doi`, `uu_dai_lai_suat`…
 * là các cột JSON rất nặng) và KHÔNG lấy `da_projects.raw` — chỉ rút mã dự án
 * bằng `ma_da_code`. Đây là nguyên nhân chính khiến danh sách trả về chậm.
 */
export const PGC_LIST_SELECT = [
  "id,giai_doan,so_phieu_gc,ngay_giu_cho,ngay_nhap,created_at,updated_at,ma_hd_goc",
  "dien_tich,don_gia_gom_vat,gia_tri_hd,gia_tri_hd_sau_ck,tien_coc,da_thu,phi_bao_tri",
  "tt_hop_dong,chinh_sach,lich_thanh_toan:lich_tt", // lịch từ bảng cloud_pgc_dot_thanh_toan
  "trang_thai_id,san_pham_id,project_id,khach_hang_id,san_id",
  "sp:bds_products!san_pham_id(id,ma_sp,ky_hieu,ma_da)",
  "da:da_projects!project_id(id,ten_da,ma_da:ma_da_code)",
  // khách: không embed cloud_customers (đã khoá đọc thẳng) — gắn `kh` bằng withCustomers sau khi đọc
  "san:dm_companies!san_id(id,ten_ct,ten_ct_vt)",
  `tt:${CAT}`,
].join(",");

const PGC_EMBED = `pgc:cloud_pgc_phieu_giucho!phieu_giu_cho_id!inner(${PGC_LIST_SELECT})`;
const DA_EMBED = "da:da_projects!da_project_id(id,ten_da,ma_da:ma_da_code)";
void PGC_SELECT;

const DEPOSIT_ROW_SELECT = `id, so_phieu, ngay_coc, so_tien_coc, ngay_nhap, ngay_sua, phieu_giu_cho_id, da_project_id, ${DA_EMBED}, tt:${CAT}, nn:${EMP_IN}, ns:${EMP_UP}, ${PGC_EMBED}`;

const CONTRACT_ROW_SELECT = `id, so_hdmb, loai_ct, ngay_ky, so_tien, ghi_chu, ngay_nhap, ngay_sua, phieu_giu_cho_id, da_project_id, ${DA_EMBED}, tt:${CAT}, nn:${EMP_IN}, ns:${EMP_UP}, ${PGC_EMBED}`;

const iso = (v: any): string | null => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};

const safe = async <T>(fn: () => Promise<T>, fallback: T): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    console.warn("[SalesDocList] lỗi:", e);
    return fallback;
  }
};

const stageList = (s: SalesStage | SalesStage[]): SalesStage[] =>
  Array.isArray(s) ? s : [s];

/** Chuẩn hóa danh sách dự án đầu vào về mảng chuỗi */
const projectKeys = (maDA: any): string[] => {
  if (maDA == null || maDA === "") return [];
  const arr = Array.isArray(maDA)
    ? maDA
    : String(maDA)
        .split(",")
        .map((v) => v.trim());
  return Array.from(
    new Set(arr.filter((v: any) => v != null && String(v).trim() !== "").map(String))
  );
};

/** Đổi danh sách mã dự án (uuid hoặc mã cũ) sang danh sách uuid */
const resolveProjectUids = async (maDA: any): Promise<string[]> => {
  const keys = projectKeys(maDA);
  if (!keys.length) return [];
  const uids = await Promise.all(keys.map((k) => resolveProjectUid(k)));
  return Array.from(new Set(uids.filter(Boolean).map(String)));
};

/** Bỏ ký tự phá vỡ cú pháp bộ lọc PostgREST */
const cleanKeyword = (kw?: string) =>
  (kw || "").trim().replace(/[(),*]/g, " ").replace(/\s+/g, " ").trim();

/**
 * Tìm trước các dòng vòng đời khớp từ khóa (số phiếu giữ chỗ, khách hàng,
 * mã căn) để bộ lọc chính vẫn chạy hoàn toàn trên máy chủ.
 */
const keywordPgcIds = async (
  uid: string,
  stages: SalesStage[],
  projectIds: string[],
  kw: string
): Promise<string[]> =>
  safe(async () => {
    const like = `%${kw}%`;
    const [cusIds, prod] = await Promise.all([
      // Khách khớp từ khoá: fn_sales_doc_customer_ids (① ∪ khách trên chứng từ thấy được, ≤ 500)
      searchDocCustomerIds(kw, 500),
      supabase
        .from("bds_products" as any)
        .select("id")
        .eq("ma_ctdk", uid)
        .or(`ky_hieu.ilike.${like},ma_sp.ilike.${like}`)
        .limit(500),
    ]);
    const prodIds = ((prod.data as any[]) || []).map((r) => String(r.id));

    const or = [`so_phieu_gc.ilike.${like}`];
    if (cusIds.length) or.push(`khach_hang_id.in.(${cusIds.join(",")})`);
    if (prodIds.length) or.push(`san_pham_id.in.(${prodIds.join(",")})`);

    let q = supabase
      .from("cloud_pgc_phieu_giucho" as any)
      .select("id")
      .eq("ma_ctdk_uid", uid)
      .in("giai_doan", stages)
      .is("deleted_at", null)
      .or(or.join(","));
    if (projectIds.length) q = q.in("project_id", projectIds);
    const { data, error } = await q.limit(5000);
    if (error) throw error;
    return ((data as any[]) || []).map((r) => String(r.id));
  }, [] as string[]);

/** Dòng chứng từ "ảo" khi chỉ có dòng vòng đời (giai đoạn giữ chỗ). */
const virtualDepositRow = (pgc: any) => ({
  id: pgc.id,
  so_phieu: pgc.so_phieu_gc ?? null,
  ngay_coc: pgc.ngay_giu_cho ?? pgc.ngay_nhap ?? pgc.created_at,
  so_tien_coc: pgc.tien_coc ?? null,
  ngay_nhap: pgc.ngay_nhap ?? pgc.created_at,
  ngay_sua: pgc.updated_at ?? null,
  phieu_giu_cho_id: pgc.id,
});

/** Nạp phiếu đặt cọc gốc cho các hợp đồng của TRANG hiện tại. */
const loadDeposits = async (pgcIds: string[]): Promise<Map<string, any>> => {
  const map = new Map<string, any>();
  if (!pgcIds.length) return map;
  await safe(async () => {
    const { data, error } = await supabase
      .from("cloud_deposits" as any)
      .select("id, so_phieu, ngay_coc, so_tien_coc, phieu_giu_cho_id")
      .in("phieu_giu_cho_id", pgcIds);
    if (error) throw error;
    (data as any[])?.forEach((r) => map.set(String(r.phieu_giu_cho_id), r));
    return true;
  }, false);
  return map;
};

const pageBounds = (f: SalesDocListFilter) => {
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(f.pageSize || f.limit || DEFAULT_PAGE_SIZE))
  );
  const pageIndex = Math.max(1, Number(f.pageIndex || 1));
  const start = (pageIndex - 1) * pageSize;
  return { pageSize, pageIndex, start, end: start + pageSize - 1 };
};

/** Giai đoạn GIUCHO: đọc thẳng bảng vòng đời. */
const listLifecycleStage = async (
  f: SalesDocListFilter,
  uid: string,
  stages: SalesStage[],
  projectIds: string[]
): Promise<any[]> => {
  const { start, end } = pageBounds(f);
  const from = vnDayStart(f.tuNgay);
  const to = vnDayEnd(f.denNgay);
  const kw = cleanKeyword(f.keyword);

  const res = await safe(async () => {
    let q = supabase
      .from("cloud_pgc_phieu_giucho" as any)
      .select(PGC_LIST_SELECT, { count: "exact" })
      .eq("ma_ctdk_uid", uid)
      .in("giai_doan", stages)
      .is("deleted_at", null);
    if (projectIds.length) q = q.in("project_id", projectIds);
    // Phân quyền dữ liệu theo nhóm quyền của màn hình hiện tại
    q = (await applyDataScope("cloud_pgc_phieu_giucho"))(q);
    if (from && to) {
      q = q.or(
        `and(ngay_giu_cho.gte.${from},ngay_giu_cho.lte.${to}),and(ngay_giu_cho.is.null,created_at.gte.${from},created_at.lte.${to})`
      );
    } else if (from) {
      q = q.or(
        `ngay_giu_cho.gte.${from},and(ngay_giu_cho.is.null,created_at.gte.${from})`
      );
    } else if (to) {
      q = q.or(
        `ngay_giu_cho.lte.${to},and(ngay_giu_cho.is.null,created_at.lte.${to})`
      );
    }
    if (kw) {
      const ids = await keywordPgcIds(uid, stages, projectIds, kw);
      q = ids.length
        ? q.in("id", ids)
        : q.ilike("so_phieu_gc", `%${kw}%`);
    }
    const { data, error, count } = await q
      .order("ngay_giu_cho", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .range(start, end);
    if (error) throw error;
    return { rows: await applyStatusColors(await withCustomers((data as any[]) || []), "tt"), total: count ?? 0 };
  }, { rows: [] as any[], total: 0 });

  return res.rows.map((pgc: any, i: number) => {
    const mapped = mapSalesDoc(pgc);
    const m = mapDepositRow(
      { ...virtualDepositRow(pgc), pgc, da: pgc.da },
      res.total
    );
    void mapped;
    return {
      ...m,
      PhieuGiuChoId: String(pgc.id),
      GiaiDoan: pgc.giai_doan,
      STT: start + i + 1,
      TotalRows: res.total,
    };
  });
};

/** Giai đoạn DATCOC / HDGV / HDMB: đọc thẳng bảng chứng từ. */
const listDocStage = async (
  f: SalesDocListFilter,
  uid: string,
  stages: SalesStage[],
  projectIds: string[]
): Promise<any[]> => {
  const wantContract = stages.some((s) => s === "HDGV" || s === "HDMB");
  const table = wantContract ? "cloud_contracts" : "cloud_deposits";
  const select = wantContract ? CONTRACT_ROW_SELECT : DEPOSIT_ROW_SELECT;
  const dateCol = wantContract ? "ngay_ky" : "ngay_coc";
  const docCol = wantContract ? "so_hdmb" : "so_phieu";
  const loaiCT =
    f.loaiCT ??
    (wantContract && stages.length === 1 ? (stages[0] as any) : undefined);

  const { start, end } = pageBounds(f);
  const from = vnDayStart(f.tuNgay);
  const to = vnDayEnd(f.denNgay);
  const kw = cleanKeyword(f.keyword);

  const res = await safe(async () => {
    let q: any = (supabase.from(table as any) as any)
      .select(select, { count: "exact" })
      .eq("pgc.ma_ctdk_uid", uid)
      .in("pgc.giai_doan", stages)
      .is("pgc.deleted_at", null);
    if (projectIds.length) q = q.in("pgc.project_id", projectIds);
    // Lọc theo công ty/sàn được phân quyền cho nhân viên
    const companyIds = (f.companyIds || []).map(String).filter(Boolean);
    if (companyIds.length) q = q.in("pgc.san_id", companyIds);
    // Tách hợp đồng gốc / hợp đồng chuyển nhượng
    if (wantContract && f.transferOnly === true)
      q = q.not("pgc.ma_hd_goc", "is", null);
    if (wantContract && f.transferOnly === false)
      q = q.is("pgc.ma_hd_goc", null);
    // Phân quyền dữ liệu theo nhóm quyền của màn hình hiện tại
    q = (await applyDataScope(String(table)))(q);
    if (loaiCT) q = q.eq("loai_ct", loaiCT);
    if (from) q = q.gte(dateCol, from);
    if (to) q = q.lte(dateCol, to);
    if (kw) {
      const ids = await keywordPgcIds(uid, stages, projectIds, kw);
      const or = [`${docCol}.ilike.%${kw}%`];
      if (ids.length) or.push(`phieu_giu_cho_id.in.(${ids.join(",")})`);
      q = q.or(or.join(","));
    }
    const { data, error, count } = await q
      .order(dateCol, { ascending: false, nullsFirst: false })
      .order("ngay_nhap", { ascending: false })
      .range(start, end);
    if (error) throw error;
    return { rows: await applyStatusColors(await withCustomers((data as any[]) || []), "tt"), total: count ?? 0 };
  }, { rows: [] as any[], total: 0 });

  if (!res.rows.length) return [];

  if (!wantContract) {
    return res.rows.map((r: any, i: number) => {
      const m = mapDepositRow(
        { ...r, pgc: r.pgc, da: r.da ?? r.pgc?.da },
        res.total
      );
      return {
        ...m,
        PhieuGiuChoId: String(r.phieu_giu_cho_id),
        GiaiDoan: r.pgc?.giai_doan,
        STT: start + i + 1,
        TotalRows: res.total,
      };
    });
  }

  const depositMap = await loadDeposits(
    res.rows.map((r: any) => String(r.phieu_giu_cho_id)).filter(isUuid)
  );

  return res.rows.map((r: any, i: number) => {
    const key = String(r.phieu_giu_cho_id);
    const dep = depositMap.get(key) || null;
    const m = mapContractRow(
      { ...r, pgc: r.pgc, da: r.da ?? r.pgc?.da },
      res.total
    );
    return {
      ...m,
      PhieuGiuChoId: key,
      GiaiDoan: r.pgc?.giai_doan,
      MaHDGoc: r.pgc?.ma_hd_goc ?? null,
      // Dữ liệu phiếu cọc gốc để đối chiếu (không mất dấu khi chuyển giai đoạn)
      SoPhieuDatCoc: dep?.so_phieu ?? null,
      NgayCocGoc: dep?.ngay_coc ?? null,
      TienCoc: dep?.so_tien_coc ?? m.TienCoc ?? null,
      MaDC: dep?.id ?? null,
      STT: start + i + 1,
      TotalRows: res.total,
    };
  });
};

/**
 * Hàm lõi: lấy 1 TRANG chứng từ theo giai đoạn vòng đời (đã lọc dự án, ngày,
 * từ khóa dưới máy chủ). Mỗi dòng kèm `TotalRows` để màn hình dựng phân trang.
 */
export const listSalesDocs = async (
  f: SalesDocListFilter
): Promise<any[]> => {
  const uid = salesTenantUid();
  if (!uid) return [];
  const stages = stageList(f.stage);
  const projectIds = await resolveProjectUids(f.maDA);
  // Có chọn dự án nhưng không đổi ra được uuid nào → không có dữ liệu hợp lệ
  if (projectKeys(f.maDA).length && !projectIds.length) return [];

  const onlyLifecycle = stages.every((s) => s === "GIUCHO");
  return onlyLifecycle
    ? listLifecycleStage(f, uid, stages, projectIds)
    : listDocStage(f, uid, stages, projectIds);
};

const cached = (key: string, f: SalesDocListFilter) =>
  memoAsync(
    `salesdocs:${salesTenantUid()}:${key}:${JSON.stringify(f)}`,
    () => listSalesDocs(f),
    15_000
  );

/** Danh sách phiếu giữ chỗ / booking. */
export const listBookingDocs = (f: Omit<SalesDocListFilter, "stage"> = {}) =>
  cached("booking", { ...f, stage: "GIUCHO" });

/** Danh sách phiếu đặt cọc (ẩn phiếu đã chuyển lên hợp đồng). */
export const listDepositDocs = (f: Omit<SalesDocListFilter, "stage"> = {}) =>
  cached("deposit", { ...f, stage: "DATCOC" });

/** Danh sách hợp đồng góp vốn. */
export const listCapitalContractDocs = (
  f: Omit<SalesDocListFilter, "stage"> = {}
) => cached("hdgv", { ...f, stage: "HDGV", loaiCT: "HDGV" });

/** Danh sách hợp đồng mua bán (gốc, không gồm hợp đồng chuyển nhượng). */
export const listSaleContractDocs = (
  f: Omit<SalesDocListFilter, "stage"> = {}
) =>
  cached("hdmb", {
    ...f,
    stage: "HDMB",
    loaiCT: "HDMB",
    transferOnly: f.transferOnly ?? false,
  });

/** Danh sách HỢP ĐỒNG CHUYỂN NHƯỢNG (hợp đồng có hợp đồng gốc). */
export const listTransferContractDocs = (
  f: Omit<SalesDocListFilter, "stage"> = {}
) =>
  cached("hdcn", {
    ...f,
    stage: "HDMB",
    loaiCT: "HDMB",
    transferOnly: true,
  });

/**
 * Dọn bộ nhớ đệm danh sách chứng từ (giữ chỗ / cọc / góp vốn / mua bán).
 * Gọi ngay sau mọi thao tác duyệt, hủy duyệt, tạo, sửa, xóa — nếu không màn
 * hình tải lại sẽ nhận đúng dữ liệu cũ còn trong bộ đệm 15 giây.
 */
export const clearSalesDocsCache = () => {
  clearApiCache(`salesdocs:${salesTenantUid()}:`);
  clearApiCache("salesdocs:");
};

export const SalesDocListService = {
  listSalesDocs,
  listBookingDocs,
  listDepositDocs,
  listCapitalContractDocs,
  listSaleContractDocs,
  listTransferContractDocs,
  clearSalesDocsCache,
};

export default SalesDocListService;

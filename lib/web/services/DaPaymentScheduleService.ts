// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/DaPaymentScheduleService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
/**
 * TIẾN ĐỘ THANH TOÁN — bảng riêng `public.da_payment_schedules`
 * (đã tách khỏi cloud_catalogs.catalog_type = 'tien_do_tt').
 *
 * - `ma_ctdk`    : uuid công ty đăng ký (cloud_companies.id) lấy từ token đăng nhập
 * - `company_id` : uuid dự án (da_projects.id)
 * - `form_code`  : CAOTANG | THAPTANG
 * - `details`    : danh sách đợt thanh toán (jsonb)
 *
 * Ngoài lưới chỉ đọc danh sách (không lấy `details`); chi tiết chỉ nạp khi mở drawer.
 *
 * Danh sách / ghi qua RPC `fn_payment_schedule_*` (migration 20261013120400): công ty từ JWT, phạm vi dự án
 * `_da_project_scope()`; hàm ghi kiểm quyền form `/projects/payment-schedule`, so_dot/tong_tt và phiên bản
 * tính trên máy chủ; hàm đọc dùng chung không chặn theo form. `authenticated` không còn ghi bảng qua REST.
 * Chi tiết 1 mẫu giữ `fn_get_byid_payment_schedule` (Phiếu tính giá / Hợp đồng dùng chung).
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { sessionCompanyId } from "../_shims/lib/session";
import { cleanCompanyIds } from "../_extract/services/system/permitted-company";
import { loaiThoiGian } from "../lib/tdttThoiHan";
import { giaoDichKey } from "../lib/tdttGiaoDich";
import { loaiTienDoKey } from "../lib/tdttLoaiTienDo";
import { toIsoDate } from "../lib/tdttHieuLuc";

const TABLE = "da_payment_schedules";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type TdttDbFormCode = "CAOTANG" | "THAPTANG";

/** TDTTTHAPTANG | THAPTANG | ... -> THAPTANG/CAOTANG (giá trị lưu DB) */
export const toDbFormCode = (v: any): TdttDbFormCode =>
  String(v ?? "")
    .toUpperCase()
    .includes("THAP")
    ? "THAPTANG"
    : "CAOTANG";

/** THAPTANG -> TDTTTHAPTANG (mã form dùng cho danh mục trường tính giá / UI) */
export const toUiFormCode = (v: any) =>
  toDbFormCode(v) === "THAPTANG" ? "TDTTTHAPTANG" : "TDTTCAOTANG";

const tenant = () => sessionCompanyId() || null;

/* ------------------------------ Dự án (da_projects) ----------------------------- */

let projectCache: { tenant: string; rows: any[] } | null = null;

const loadProjects = async () => {
  const ma_ctdk = tenant();
  if (!ma_ctdk) return [];
  if (projectCache?.tenant === ma_ctdk) return projectCache.rows;
  const { data, error } = await supabase
    .from("da_projects" as any)
    .select("id, ten_da, ma_da_code")
    .eq("ma_ctdk", ma_ctdk)
    .order("ten_da", { ascending: true });
  if (error) throw error;
  const rows = (data as any[]) ?? [];
  projectCache = { tenant: ma_ctdk, rows };
  return rows;
};

export const clearProjectCache = () => {
  projectCache = null;
};

/** Danh sách dự án cho ô chọn: value = uuid, label = tên dự án */
export const listScheduleProjects = async () => {
  const rows = await loadProjects();
  return rows.map((r: any) => ({
    id: r.id,
    MaDA: r.id,
    MaDALegacy: r?.ma_da_code ?? null,
    TenDA: r.ten_da ?? "",
  }));
};

/** Nhận uuid dự án hoặc mã dự án cũ (MaDA) -> uuid da_projects */
export const resolveProjectId = async (maDA: any): Promise<string | null> => {
  if (maDA == null || String(maDA) === "") return null;
  const key = String(maDA);
  if (UUID_RE.test(key)) return key;
  const rows = await loadProjects();
  const hit = rows.find((r: any) => String(r?.ma_da_code ?? "") === key);
  return hit?.id ?? null;
};

const projectInfo = async (id: any) => {
  if (!id) return { TenDA: "", MaDALegacy: null };
  const rows = await loadProjects();
  const hit = rows.find((r: any) => String(r.id) === String(id));
  return {
    TenDA: hit?.ten_da ?? "",
    MaDALegacy: hit?.ma_da_code ?? null,
  };
};

/* ------------------------------- Ánh xạ dữ liệu ------------------------------- */

const mapRow = (r: any, extra: { TenDA?: string; MaDALegacy?: any } = {}) => ({
  MaTH: r.id,
  ID: r.id,
  TenTH: r.name,
  MaDA: r.company_id,
  MaDAUid: r.company_id,
  MaDALegacy: extra.MaDALegacy ?? null,
  TenDA: extra.TenDA ?? "",
  FormCode: toUiFormCode(r.form_code),
  SoDot: r.so_dot ?? 0,
  TongTyLeTT: Number(r.tong_tt ?? 0),
  OwnerCompanyId: r.owner_company_id ?? null,
  status: (r.status as "pending" | "approved" | undefined) ?? "pending",
  // Quỹ căn (manual 108): null = mẫu cũ chưa gắn
  MaQuyCan: r.ma_quy_can ?? null,
  TenQuyCan: r.ten_quy_can ?? null,
  // Hiệu lực (manual 110): 'YYYY-MM-DD' | null — Từ ngày trống = không giới hạn đầu, Đến ngày trống = vô hạn
  TuNgay: toIsoDate(r.tu_ngay),
  DenNgay: toIsoDate(r.den_ngay),
  // Chính sách bán hàng (manual 122): null = mẫu cũ chưa gắn; TenCS chỉ có ở danh sách / dòng vừa lưu (_ps_out)
  MaCS: (r.sales_policy_id as string | null | undefined) ?? null,
  TenCS: (r.ten_cs as string | null | undefined) ?? null,
  // Tiến độ HĐMB liên kết (manual 145): máy chủ chỉ trả khi còn hiệu lực (cùng dự án + loại); tên chỉ có ở danh sách / dòng vừa lưu
  MaTDHDMB: (r.hdmb_schedule_id as string | null | undefined) ?? null,
  TenTDHDMB: (r.ten_hdmb_schedule as string | null | undefined) ?? null,
});

/** Dòng RPC (_ps_out) → dòng màn hình (kèm tên dự án) */
export const fromRpcRow = (r: any) => mapRow(r, { TenDA: r?.ten_da ?? "" });

const normalizeDetails = (list: any[], formCode: TdttDbFormCode) =>
  (Array.isArray(list) ? list : []).map((d: any, i: number) => {
    const base: any = {
      MaLTT: d?.MaLTT ?? `LTT-${i + 1}`,
      DotTT: d?.DotTT ?? i + 1,
      TenDot: d?.TenDot ?? `Đợt ${i + 1}`,
      SoNgay: Number(d?.SoNgay ?? 0),
      LoaiThoiGian: loaiThoiGian(d),
      SoThang: d?.SoThang == null || d?.SoThang === "" ? null : Number(d.SoThang),
      // Loại ngày: bỏ chọn ⇒ null (Ngày TT để trống, thời hạn vẫn giữ); mẫu cũ thiếu khoá ⇒ 1 (Ngày đặt cọc)
      MaLoai: d && "MaLoai" in d ? (d.MaLoai == null || d.MaLoai === "" ? null : d.MaLoai) : 1,
      TyLeTT: Number(d?.TyLeTT ?? 0),
      TyLeVAT: Number(d?.TyLeVAT ?? 0),
      TyLeVonTuCo: Number(d?.TyLeVonTuCo ?? 0),
      TyLeVayNH: Number(d?.TyLeVayNH ?? 0),
      TienCoc: Number(d?.TienCoc ?? 0),
      TuongUng: d?.TuongUng ?? "",
      TienVAT: d?.TienVAT ?? "",
      TongCong: d?.TongCong ?? "",
      FormulaConfig: d?.FormulaConfig ?? null,
      // Cấu hình công thức (kho mẫu) đã chép vào đợt — chỉ để ghi nhớ, tính giá đọc các chuỗi công thức
      MaCongThuc: d?.MaCongThuc ?? null,
      // Giao dịch của đợt: "BAN_GIAO" | "SO_DO" | null (src/lib/tdttGiaoDich.ts)
      GiaoDich: giaoDichKey(d?.GiaoDich),
      MocCvId: d?.MocCvId || null,
      // Loại tiến độ "HDMB" | "HDCN" | null = chưa cấu hình (src/lib/tdttLoaiTienDo.ts) + 2 diễn giải (manual 110)
      LoaiTienDo: loaiTienDoKey(d?.LoaiTienDo),
      DienGiaiTyLeTT: d?.DienGiaiTyLeTT ?? "",
      DienGiaiThoiHanTT: d?.DienGiaiThoiHanTT ?? "",
    };
    if (formCode === "THAPTANG") {
      base.TyLeXD = Number(d?.TyLeXD ?? 0);
      base.TienXayDung = d?.TienXayDung ?? "";
      base.VATDat = d?.VATDat ?? "";
      base.VATXayDung = d?.VATXayDung ?? "";
    } else {
      base.TyLePBT = Number(d?.TyLePBT ?? 0);
      base.PhiBaoTri = d?.PhiBaoTri ?? "";
      base.VonTuCo = d?.VonTuCo ?? "";
      base.VayNH = d?.VayNH ?? "";
    }
    return base;
  });

/* --------------------------------- Truy vấn --------------------------------- */

/**
 * Danh sách ngoài lưới — KHÔNG lấy details. `fn_payment_schedule_list`: hàm đọc dùng chung
 * (Tiến độ thanh toán, Chính sách bán hàng…), máy chủ lọc công ty + phạm vi dự án, trả kèm tên dự án.
 */
export const listSchedules = async (filter: any = {}) => {
  const { data, error } = await (supabase as any).rpc("fn_payment_schedule_list", {
    p_project_id: await resolveProjectId(filter?.MaDA),
    p_form_code: filter?.FormCode ?? null,
    p_search: String(filter?.InputSearch ?? "").trim() || null,
    p_form: filter?.Form ?? null,
    p_company_ids: cleanCompanyIds(filter?.CompanyIds),
    // Chỉ gửi khi lọc: SP cũ chưa có tham số này
    ...(filter?.MaQuyCan && UUID_RE.test(String(filter.MaQuyCan)) ? { p_ma_quy_can: String(filter.MaQuyCan) } : {}),
  });
  if (error) throw error;
  return ((data as any[]) ?? []).map((r) => mapRow(r, { TenDA: r?.ten_da ?? "" }));
};

/**
 * Chi tiết 1 mẫu — lấy qua hàm máy chủ `fn_get_byid_payment_schedule`
 * (uuid lấy từ `fn_get_payment_schedules`). Chấp nhận cả dạng TABLE (mảng)
 * lẫn dạng jsonb {ok,row}; chỉ đọc thẳng bảng khi hàm máy chủ lỗi.
 */
export const getScheduleById = async (id: any) => {
  const ma_ctdk = tenant();
  if (!ma_ctdk || !id) return { status: 2000, data: null, detail: [] };

  let row: any = null;
  const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
    "fn_get_byid_payment_schedule",
    { p_id: String(id) },
  );
  if (!rpcErr) {
    row = Array.isArray(rpcData)
      ? rpcData[0] ?? null
      : rpcData?.row ?? (rpcData?.ok === false ? null : rpcData ?? null);
  } else {
    console.error("fn_get_byid_payment_schedule failed", rpcErr);
    const { data, error } = await supabase
      .from(TABLE as any)
      .select("*")
      .eq("ma_ctdk", ma_ctdk)
      .eq("id", String(id))
      .maybeSingle();
    if (error) throw error;
    row = (data as any) ?? null;
  }

  if (!row?.id) return { status: 2000, data: null, detail: [] };
  const info = await projectInfo(row.company_id);
  return {
    status: 2000,
    data: mapRow(row, info),
    detail: normalizeDetails(row.details, toDbFormCode(row.form_code)),
  };
};

/** Lỗi RPC → { status: 5000, code, message } (code vd 55000 = bản đã duyệt / đã đổi trạng thái) */
const rpcFail = (error: any) => ({
  status: 5000,
  code: error?.code as string | undefined,
  message: error?.message || "Không thể xử lý tiến độ thanh toán",
});

/** RPC trả 1 dòng (_ps_out) → { status, MaTH, data } */
const rpcRow = async (fn: string, args: Record<string, any>) => {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) return rpcFail(error);
  const row = fromRpcRow(data);
  return { status: 2000, MaTH: row.MaTH, data: row, mocBoQua: Number(data?.moc_bo_qua ?? 0) || 0 };
};

/**
 * Thêm mới / cập nhật 1 mẫu tiến độ thanh toán — `fn_payment_schedule_save` (máy chủ ghi phiên bản).
 * Có khóa `MaQuyCan` ⇒ gửi `ma_quy_can` (máy chủ bắt buộc có giá trị); không có khóa ⇒ máy chủ giữ quỹ căn đang lưu.
 * Tương tự `TuNgay` / `DenNgay` ⇒ `tu_ngay` / `den_ngay` ('YYYY-MM-DD' | null = không giới hạn),
 * `MaCS` ⇒ `sales_policy_id` (có khóa ⇒ máy chủ bắt buộc chính sách cùng dự án / quỹ căn / loại hình).
 * `MaTDHDMB` ⇒ `hdmb_schedule_id` (null = bỏ liên kết; máy chủ bắt buộc cùng dự án + loại, khác chính mẫu).
 */
export const saveSchedule = async (payload: any, note?: string) => {
  const formCode = toDbFormCode(payload?.FormCode);
  const company_id = await resolveProjectId(payload?.MaDA);
  if (!company_id) return { status: 5000, message: "Chưa chọn dự án hợp lệ" };
  const id = payload?.MaTH ?? payload?.ID ?? null;
  return rpcRow("fn_payment_schedule_save", {
    p_row: {
      id: id && UUID_RE.test(String(id)) ? String(id) : null,
      name: String(payload?.TenTH ?? "").trim(),
      company_id,
      form_code: formCode,
      details: normalizeDetails(payload?.ListChiTiet ?? [], formCode),
      ...(payload && "MaQuyCan" in payload ? { ma_quy_can: payload.MaQuyCan || null } : {}),
      ...(payload && "TuNgay" in payload ? { tu_ngay: toIsoDate(payload.TuNgay) } : {}),
      ...(payload && "DenNgay" in payload ? { den_ngay: toIsoDate(payload.DenNgay) } : {}),
      ...(payload && "MaCS" in payload ? { sales_policy_id: payload.MaCS || null } : {}),
      ...(payload && "MaTDHDMB" in payload ? { hdmb_schedule_id: payload.MaTDHDMB || null } : {}),
    },
    p_note: note ?? null,
  });
};

export const deleteSchedule = async (id: any) => {
  if (!id || !UUID_RE.test(String(id))) return { status: 2000 };
  const { error } = await (supabase as any).rpc("fn_payment_schedule_delete", { p_id: String(id) });
  if (error) return rpcFail(error);
  return { status: 2000 };
};

/** Nhân bản mẫu (kèm toàn bộ đợt) sang `projectId` (bỏ trống ⇒ dự án của mẫu gốc; khác dự án ⇒ máy chủ bỏ mốc + công thức ghi nhớ) */
export const duplicateSchedule = async (id: any, projectId?: string | null) => {
  if (!id || !UUID_RE.test(String(id))) return { status: 5000, message: "Không tìm thấy tiến độ thanh toán" };
  const args: Record<string, string> = { p_id: String(id) };
  if (projectId && UUID_RE.test(String(projectId))) args.p_project_id = String(projectId);
  return rpcRow("fn_payment_schedule_duplicate", args);
};

/** Lịch sử phiên bản (mới nhất trước) */
export const listScheduleVersions = async (id: any) => {
  if (!id || !UUID_RE.test(String(id))) return [];
  const { data, error } = await (supabase as any).rpc("fn_payment_schedule_versions", { p_id: String(id) });
  if (error) throw error;
  return (data as any[]) || [];
};

/** Khôi phục mẫu về 1 phiên bản */
export const restoreScheduleVersion = async (id: any, versionId: any) =>
  rpcRow("fn_payment_schedule_restore", { p_id: String(id ?? ""), p_version_id: String(versionId ?? "") });

/* ------------------------- Mốc tiến độ thi công (Gantt) ------------------------ */

export interface MocOption {
  id: string;
  ten: string;
  maHienThi: string | null;
  ngayKeHoach: string | null;
  pct: number;
  daXong: boolean;
}

/** Mốc của dự án để gắn vào đợt thanh toán — `fn_payment_schedule_moc_options` (null/uuid sai → [] không gọi RPC) */
export const listMocOptions = async (projectId: string | null): Promise<MocOption[]> => {
  if (!projectId || !UUID_RE.test(String(projectId))) return [];
  const { data, error } = await (supabase as any).rpc("fn_payment_schedule_moc_options", {
    p_da_project_id: String(projectId),
  });
  if (error) throw new Error(error.message || "Không tải được mốc tiến độ");
  return ((data?.data as any[]) ?? []).map((m) => ({
    id: m.id,
    ten: m.ten ?? "",
    maHienThi: m.ma_hien_thi ?? null,
    ngayKeHoach: m.ngay_ke_hoach ?? null,
    pct: Number(m.pct_hoan_thanh ?? 0) || 0,
    daXong: !!m.da_xong,
  }));
};

/* --------------------- Danh mục biến công thức (sys_pricing_fields_default) -------------------- */

const fieldCache = new Map<string, Promise<any[]>>();

/**
 * Biến dùng trong modal "Công thức tính" — lấy từ sys_pricing_fields_default
 * theo form_code TDTTCAOTANG / TDTTTHAPTANG. Toán tử & làm tròn fix cứng ở UI.
 */
export const loadTdttFormulaFields = (formCode: any): Promise<any[]> => {
  const code = toUiFormCode(formCode);
  const cached = fieldCache.get(code);
  if (cached) return cached;
  const p = (async () => {
    const { data, error } = await supabase
      .from("sys_pricing_fields_default" as any)
      .select("id, form_code, name, code, group_code, created_at")
      .eq("form_code", code)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ((data as any[]) ?? []).map((f) => ({
      ID: f.id,
      FieldId: f.id,
      Code: f.code,
      Name: f.name,
      GroupCode: f.group_code,
      FormCode: f.form_code,
    }));
  })().catch((e) => {
    fieldCache.delete(code);
    throw e;
  });
  fieldCache.set(code, p);
  return p;
};

export const DaPaymentScheduleService = {
  listSchedules,
  getScheduleById,
  saveSchedule,
  deleteSchedule,
  duplicateSchedule,
  listScheduleVersions,
  restoreScheduleVersion,
  listScheduleProjects,
  resolveProjectId,
  listMocOptions,
  loadTdttFormulaFields,
  toDbFormCode,
  toUiFormCode,
};

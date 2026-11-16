// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/DaSalesPolicyService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
/**
 * CHÍNH SÁCH BÁN HÀNG — bảng riêng `public.da_sales_policies`
 * (thay cho bảng cũ `cloud_sales_policies` đã bỏ).
 *
 * Cột chính: ten_cs, mo_ta, hieu_luc_tu, hieu_luc_den, ap_dung_booking,
 * so_luong_ap_dung, form_code (CAOTANG|THAPTANG), pricing_config_id
 * (cloud_pricing_configs), payment_schedule_id (da_payment_schedules)
 * và `detail` (jsonb) lưu danh sách chiết khấu.
 *
 * Đọc danh sách / ghi đi qua RPC `fn_sales_policy_*` (migration 20261013120000…120300): công ty lấy từ JWT,
 * phạm vi dự án theo `_da_project_scope()`; hàm ghi kiểm quyền form `/projects/sales-policy`
 * (hàm đọc dùng chung, không chặn theo form), phiên bản ghi trong cùng giao dịch. `authenticated` không còn quyền ghi bảng qua REST.
 * `getPolicyById` giữ `fn_get_byid_sales_policy` (Phiếu tính giá / Hợp đồng dùng chung).
 */
import type { AllocationSubmit } from "../_stubs/services/projects/sales-policy-allocation/types";
import { supabase } from "../_shims/integrations/supabase/client";
import { resolveProjectId, listScheduleProjects } from "./DaPaymentScheduleService";
import { cleanCompanyIds } from "../_extract/services/system/permitted-company";

const TABLE = "da_sales_policies";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const uid = (v: any) => (UUID_RE.test(String(v ?? "")) ? String(v) : null);

/** CAOTANG | THAPTANG */
export const toPolicyFormCode = (v: any) =>
  String(v ?? "").toUpperCase().includes("THAP") ? "THAPTANG" : "CAOTANG";

/**
 * Một mức chi tiết của chiết khấu (vd "1 chỉ" = 15.000.000; dòng % thì GiaTri là số phần trăm).
 * MaDVT / DonViTinh: đơn vị tính (danh mục dự án) và tên chụp lại lúc lưu, chỉ để mô tả.
 */
export type PolicyDiscountOption = {
  ID?: string;
  Ten: string;
  GiaTri: number;
  MaDVT?: string;
  DonViTinh?: string;
  /** Điều kiện áp dụng của mức (chỉ có khi có ít nhất 1 dòng) */
  DieuKien?: OptionCondition;
  /** Số suất tối đa (số cọc / hợp đồng còn hiệu lực được dùng mức); không có = không giới hạn */
  SoLuong?: number;
  /** Khoảng ngày áp dụng YYYY-MM-DD, tính cả 2 đầu; không có = không giới hạn */
  TuNgay?: string;
  DenNgay?: string;
  /** Phân bổ số suất theo Công ty bán hàng ĐANG HIỆU LỰC (guard / form dùng); không có = không phân bổ chi tiết */
  PhanBo?: PolicyOptionAllocation[];
  /** Phân bổ CHỜ DUYỆT (spec phan-bo-ctbh-duyet); [] = đề xuất bỏ hết; chỉ đổi qua `saveAllocation` / `approveAllocation` */
  PhanBoCho?: PolicyOptionAllocation[];
  /** Chiết khấu theo kho (spec chinh-sach-theo-kho D2): kho, dòng kho, quà danh mục (null = nhóm không có quà con) */
  MaKho?: string;
  MaDongKho?: string;
  MaDanhMucCT?: string | null;
};

/** Một dòng phân bổ số suất của mức cho một Công ty bán hàng */
export type PolicyOptionAllocation = { CongTyId: string; TenCongTy?: string; SoLuong: number };

/**
 * Tiêu chí điều kiện của mức chiết khấu (cao tầng). QUY_CAN (Quỹ) chỉ Chính sách CTBH / hoa hồng dùng (máy chủ chỉ nhận ở đó).
 * PHONG_NGU (Phòng ngủ) / VI_TRI (Vị trí, theo tòa) / TANG (Tầng, theo tòa): danh mục dự án, so với ma_so_pn / vi_tri / ma_tang của căn.
 */
export type ConditionField =
  | "LOAI_CAN" | "TOA" | "LICH_TT" | "GIA_GOM_VAT" | "QUY_CAN" | "PHONG_NGU" | "VI_TRI" | "TANG"
  /** Chỉ Chính sách hoa hồng (2026-11-14): trạng thái phiếu (ID = mã pgc_trang_thai) + tỷ lệ thanh toán / tổng giá trị HĐMB (%) */
  | "TRANG_THAI" | "TY_LE_TT_HD";
export type ConditionOp = "IN" | "NOT_IN" | "GTE" | "LTE" | "GT" | "LT" | "EQ" | "BETWEEN";
/** Giá trị danh mục: so theo ID, Ten chụp lại để hiển thị */
export type CatalogRef = { ID: string; Ten: string };
/** Một dòng điều kiện: LOAI_CAN dùng mảng tên, TOA / LICH_TT / QUY_CAN dùng CatalogRef[], GIA_GOM_VAT dùng số (BETWEEN có GiaTriDen) */
export type ConditionRow = {
  Bat: boolean;
  Truong: ConditionField;
  ToanTu: ConditionOp;
  GiaTri: string[] | CatalogRef[] | number;
  GiaTriDen?: number;
};
export type OptionCondition = { KetHop: "AND" | "OR"; Dong: ConditionRow[] };

export type PolicyDiscount = {
  ID: string;
  /** Số thứ tự người dùng nhập (nguyên ≥ 1, không trùng trong 1 chính sách); null = để máy chủ tự gán */
  STT: number | null;
  TenChietKhau: string;
  HeSo: number;
  /** percentage | fixed_amount */
  Loai: string;
  GiaTri: number;
  IsKhongTruGiaHD?: boolean;
  /** Dòng mốc tính (tối đa 1 dòng mỗi chính sách) */
  IsMocTinh?: boolean;
  /** Mốc tính tỷ lệ chiết khấu (chỉ dòng %, nhiều dòng được tick) */
  IsMocTinhTyLe?: boolean;
  /** Không cần phân bổ CTBH (R-2d): dòng dùng được cho mọi Công ty bán hàng dù chính sách bật "Áp dụng phân bổ CTBH"; máy chủ chỉ lưu khi true */
  KhongCanPhanBo?: boolean;
  /**
   * Ô "Áp dụng phân bổ CTBH" của CHÍNH SÁCH chứa dòng, chép vào từng dòng khi đọc (`mapRow`) để phiếu tính giá / hợp đồng biết mức nào phải
   * phân bổ từ chính danh sách chi tiết (`allocationRequiredIds`). Chính sách thấp tầng luôn false (chưa hỗ trợ, như máy chủ).
   * Chỉ đọc: `normalizeDiscount` không chép, nên không bao giờ gửi lại máy chủ.
   */
  ApDungPhanBo?: boolean;
  /** Nguồn số lượng (spec chinh-sach-theo-kho D1): "KHO" = mức chọn từ Kho quà tặng; không có = tự nhập (SoLuong) */
  NguonSoLuong?: "KHO" | "TU_NHAP";
  /** Nhóm quà trong Danh mục quà tặng (da_gift_catalog_groups.id) — bắt buộc khi NguonSoLuong = "KHO" */
  MaDanhMuc?: string;
  /** Kho chọn ở cấp chiết khấu (mọi mức cùng kho) */
  MaKho?: string;
  /** Số lượng cấp chiết khấu (chủ dự án 2026-11-14): số chứng từ cọc / hợp đồng được dùng chiết khấu; Σ SoLuong các mức ≤ tổng. Không có = không giới hạn */
  SoLuongTong?: number | null;
  /** Chi tiết giá (mọi loại); GiaTri của dòng luôn 0 khi có chi tiết */
  LuaChon?: PolicyDiscountOption[];
  /** Người / giờ gửi phân bổ chờ duyệt của dòng (spec phan-bo-ctbh-duyet); chỉ đọc, máy chủ bỏ qua khi lưu chiết khấu */
  PhanBoGui?: AllocationSubmit | null;
};

const genId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

/** STT: số nguyên ≥ 1, còn lại → null */
const toStt = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 1 ? n : null;
};

/** Chuẩn hoá 1 dòng chiết khấu (nhận cả dữ liệu cũ CKPT/CKTien) */
const normalizeDiscount = (d: any): PolicyDiscount => {
  const loai =
    d?.Loai ??
    (Number(d?.CKTien) > 0 ? "fixed_amount" : "percentage");
  const giaTri =
    d?.GiaTri ??
    (loai === "fixed_amount" ? Number(d?.CKTien ?? 0) : Number(d?.CKPT ?? 0));
  const out: PolicyDiscount = {
    ID: String(d?.ID ?? genId()),
    STT: toStt(d?.STT),
    TenChietKhau: String(d?.TenChietKhau ?? d?.Ten ?? ""),
    HeSo: Number(d?.HeSo ?? 0),
    Loai: loai,
    GiaTri: Number(giaTri ?? 0),
    IsKhongTruGiaHD: !!d?.IsKhongTruGiaHD,
    IsMocTinh: !!d?.IsMocTinh,
    IsMocTinhTyLe: loai === "percentage" && !!d?.IsMocTinhTyLe,
    KhongCanPhanBo: !!d?.KhongCanPhanBo,
  };
  // Chiết khấu theo kho: giữ khóa (thiếu ⇒ máy chủ giữ nguồn đang lưu — _sp_kho_keep); "TU_NHAP" gửi rõ để chuyển dòng KHO về tự nhập (D10)
  if (d?.NguonSoLuong === "KHO") {
    out.NguonSoLuong = "KHO";
    if (d?.MaDanhMuc) out.MaDanhMuc = String(d.MaDanhMuc);
    if (d?.MaKho) out.MaKho = String(d.MaKho);
  } else if (d?.NguonSoLuong === "TU_NHAP") out.NguonSoLuong = "TU_NHAP";
  // Số lượng cấp chiết khấu: chỉ giữ khi là số nguyên ≥ 1 (thiếu khóa ⇒ máy chủ giữ giá trị đang lưu — _sp_kho_keep)
  const slt = Number(d?.SoLuongTong);
  if (d?.SoLuongTong != null && d?.SoLuongTong !== "" && Number.isInteger(slt) && slt >= 1) out.SoLuongTong = slt;
  // Chỉ giữ khóa khi là mảng: sửa bằng màn cũ (không gửi LuaChon) thì máy chủ giữ nguyên các mức hiện có (mức giữ nguyên mọi khóa, kể cả khóa kho)
  if (Array.isArray(d?.LuaChon)) out.LuaChon = d.LuaChon;
  if (d?.PhanBoGui?.GuiLuc) out.PhanBoGui = d.PhanBoGui;
  return out;
};

/** Mức gửi khi lưu chiết khấu: bỏ phân bổ (A-6 — phân bổ chỉ đổi qua RPC phân bổ, máy chủ cũng bỏ qua) */
const withoutAllocation = (o: PolicyDiscountOption): PolicyDiscountOption => {
  const { PhanBo, PhanBoCho, ...rest } = o;
  return rest;
};

/** Bổ sung CKPT/CKTien để màn hình cũ hiển thị không phải sửa; `apDungPhanBo` = ô "Áp dụng phân bổ CTBH" của chính sách (R-2d) */
const toUiDiscount = (d: PolicyDiscount, apDungPhanBo = false) => ({
  ...d,
  ApDungPhanBo: apDungPhanBo,
  MaCK: d.ID,
  CKPT: d.Loai === "fixed_amount" ? 0 : Number(d.GiaTri || 0),
  CKTien: d.Loai === "fixed_amount" ? Number(d.GiaTri || 0) : 0,
});


/** Mảng uuid từ cột JSON (máy chủ trả mảng; đường REST dự phòng có thể trả chuỗi JSON); null / sai dạng ⇒ [] */
export const idList = (v: unknown): string[] => {
  let x = v;
  if (typeof x === "string") {
    try {
      x = JSON.parse(x);
    } catch {
      return [];
    }
  }
  return Array.isArray(x) ? x.map((i) => String(i ?? "").trim()).filter(Boolean) : [];
};

const mapRow = (r: any, tenDA = "") => {
  const detail = (Array.isArray(r?.detail) ? r.detail : []).map(normalizeDiscount);
  // Chủ dự án 2026-11-15 (spec chi-tiet-ck-theo-phan-bo): mọi chính sách cao tầng BẮT BUỘC phân bổ CTBH, bỏ qua cột ap_dung_phan_bo
  // (như _sp_option_quota_guard); thấp tầng chưa hỗ trợ ⇒ luôn tắt
  const apDungPhanBo = toPolicyFormCode(r?.form_code) !== "THAPTANG";
  const rowsAllocation = apDungPhanBo;
  return {
    ID: r.id,
    MaCSBH: r.id,
    TenChinhSach: r.ten_cs,
    DienGiai: r.mo_ta ?? "",
    MaDA: r.da_project_id,
    TenDA: tenDA,
    TuNgay: r.hieu_luc_tu,
    DenNgay: r.hieu_luc_den,
    IsApDung: !!r.ap_dung_booking,
    SoLuongApDung: Number(r.so_luong_ap_dung ?? 0),
    LoaiHinh: toPolicyFormCode(r.form_code),
    FormCode: toPolicyFormCode(r.form_code),
    MaCauHinhTinhGia: r.pricing_config_id,
    CauHinhId: r.pricing_config_id,
    MaTruonghopTT: r.payment_schedule_id,
    TienBooking: r.tien_booking == null ? null : Number(r.tien_booking),
    /** Áp dụng phân bổ CTBH: luôn true với cao tầng (2026-11-15), false với thấp tầng */
    ApDungPhanBo: apDungPhanBo,
    /** Quỹ căn (manual 120): null = chưa gắn ⇒ không hiện ở form chứng từ */
    MaQuyCan: (r.ma_quy_can as string | null | undefined) ?? null,
    TenQuyCan: (r.ten_quy_can as string | null | undefined) ?? null,
    /** Bảng giá áp dụng (manual 121): rỗng = mọi bảng giá của quỹ căn */
    BangGiaIds: idList(r.bang_gia_ids),
    /** Tòa áp dụng (manual 121): rỗng = mọi tòa */
    ToaIds: idList(r.toa_ids),
    ListChiTiet: detail.map((d: PolicyDiscount) => toUiDiscount(d, rowsAllocation)),
    SoChietKhau: detail.length,
    CompanyId: r.company_id ?? null,
    status: (r.status as "pending" | "approved" | undefined) ?? "pending",
  };
};

const projectName = async (id: any) => {
  if (!id) return "";
  const list = await listScheduleProjects().catch(() => []);
  return (list as any[]).find((p) => String(p.id) === String(id))?.TenDA ?? "";
};

/** Lỗi RPC → { status: 5000, code, message } (thông điệp nghiệp vụ / thiếu quyền từ máy chủ; code vd 55000 = bản đã duyệt) */
const rpcFail = (error: any) => ({
  status: 5000,
  code: error?.code as string | undefined,
  message: error?.message || "Không thể xử lý chính sách bán hàng",
});

/** Dòng RPC (_sp_out) → dòng màn hình */
export const fromRpcRow = (r: any) => mapRow(r, r?.ten_da ?? "");

const rpcRow = async (fn: string, args: Record<string, any>) => {
  const { data, error } = await (supabase as any).rpc(fn, args);
  if (error) return rpcFail(error);
  const row = fromRpcRow(data);
  return { status: 2000, data: row, detail: row.ListChiTiet };
};

/**
 * Danh sách chính sách theo dự án (+ tìm kiếm theo tên) — `fn_sales_policy_list`: hàm đọc dùng chung
 * (Chính sách bán hàng, Báo cáo…), máy chủ lọc công ty (JWT) + phạm vi dự án của nhân viên.
 */
export const listPolicies = async (filter: any = {}) => {
  const { data, error } = await (supabase as any).rpc("fn_sales_policy_list", {
    p_project_id: await resolveProjectId(filter?.MaDA),
    p_search: String(filter?.inputSearch ?? filter?.InputSearch ?? "").trim() || null,
    p_form: filter?.Form ?? null,
    p_company_ids: cleanCompanyIds(filter?.CompanyIds),
  });
  if (error) throw error;
  return ((data as any[]) || []).map(fromRpcRow);
};

/**
 * Chi tiết 1 chính sách bán hàng theo uuid — gọi hàm máy chủ
 * `fn_get_byid_sales_policy` (fail closed theo công ty trong phiên đăng nhập).
 * Chỉ khi RPC lỗi kết nối mới đọc thẳng bảng như đường dự phòng.
 */
export const getPolicyById = async (id: any) => {
  const key = uid(id);
  // notFound: chính sách không còn, khác với lỗi tải (thử lại được)
  if (!key) return { status: 5000, message: "Không tìm thấy chính sách", notFound: true };

  let raw: any = null;
  const { data: rpcData, error: rpcErr } = await (supabase as any).rpc(
    "fn_get_byid_sales_policy",
    { p_id: key },
  );
  if (!rpcErr) {
    // Hàm máy chủ có thể trả mảng 1 dòng (dạng TABLE) hoặc {ok, row} (jsonb)
    raw = Array.isArray(rpcData)
      ? rpcData[0]
      : rpcData?.row ?? (rpcData?.ok === false ? null : rpcData);
    if (!raw?.id)
      return {
        status: 5000,
        message: rpcData?.message || "Không tìm thấy chính sách",
        notFound: true,
      };
  } else {

    console.error("fn_get_byid_sales_policy failed", rpcErr);
    const { data, error } = await supabase
      .from(TABLE as any)
      .select("*")
      .eq("id", key)
      .maybeSingle();
    if (error || !data)
      return { status: 5000, message: "Không tìm thấy chính sách", notFound: !error };
    raw = data;
  }

  const tenDA = await projectName((raw as any).da_project_id);
  const row = mapRow(raw, tenDA);
  return { status: 2000, data: row, detail: row.ListChiTiet };
};


const toDate = (v: any) => {
  if (!v) return null;
  const s = String(v);
  return s.length >= 10 ? s.slice(0, 10) : null;
};

/**
 * Thêm/sửa chính sách (payload dùng tên trường của màn hình) — `fn_sales_policy_save`.
 * Chỉ gửi `detail` khi payload có `ListChiTiet`, `tien_booking` khi có `TienBooking`, `ma_quy_can` khi có `MaQuyCan`, `ap_dung_phan_bo` khi `ApDungPhanBo` là boolean
 * (sửa thông tin chung không ghi đè chiết khấu người khác vừa sửa; không gửi thì máy chủ: thêm mới bật, sửa giữ nguyên). Máy chủ ghi phiên bản.
 */
export const savePolicy = async (payload: any, note?: string) => {
  const row: any = {
    id: uid(payload?.ID),
    da_project_id: await resolveProjectId(payload?.MaDA),
    ten_cs: String(payload?.TenChinhSach ?? "").trim(),
    mo_ta: payload?.DienGiai ?? null,
    hieu_luc_tu: toDate(payload?.TuNgay),
    hieu_luc_den: toDate(payload?.DenNgay),
    ap_dung_booking: !!payload?.IsApDung,
    so_luong_ap_dung:
      Number(payload?.SoLuongApDung) > 0 ? Number(payload.SoLuongApDung) : 0,
    form_code: toPolicyFormCode(payload?.LoaiHinh ?? payload?.FormCode),
    pricing_config_id: uid(payload?.MaCauHinhTinhGia ?? payload?.CauHinhId),
    payment_schedule_id: uid(payload?.MaTruonghopTT),
  };
  if (Array.isArray(payload?.ListChiTiet))
    row.detail = payload.ListChiTiet.map(normalizeDiscount);
  if ("TienBooking" in (payload ?? {}))
    row.tien_booking =
      payload.TienBooking == null || payload.TienBooking === ""
        ? null
        : Number(payload.TienBooking);
  if (typeof payload?.ApDungPhanBo === "boolean") row.ap_dung_phan_bo = payload.ApDungPhanBo;
  // Quỹ căn: chỉ gửi khi payload có khóa MaQuyCan (gửi null ⇒ máy chủ báo "Vui lòng chọn quỹ căn"; không gửi ⇒ sửa giữ nguyên)
  if ("MaQuyCan" in (payload ?? {})) row.ma_quy_can = uid(payload.MaQuyCan);
  // Bảng giá / tòa áp dụng: chỉ gửi khi payload có khóa; [] ⇒ không giới hạn
  if ("BangGiaIds" in (payload ?? {})) row.bang_gia_ids = idList(payload.BangGiaIds);
  if ("ToaIds" in (payload ?? {})) row.toa_ids = idList(payload.ToaIds);
  return rpcRow("fn_sales_policy_save", { p_row: row, p_note: note ?? null });
};

export const deletePolicy = async (id: any) => {
  const key = uid(id?.ID ?? id);
  if (!key) return { status: 2000 };
  const { error } = await (supabase as any).rpc("fn_sales_policy_delete", { p_id: key });
  if (error) return rpcFail(error);
  return { status: 2000 };
};

/** Nhân bản chính sách (kèm chiết khấu) */
export const duplicatePolicy = async (id: any) => {
  const key = uid(id);
  if (!key) return { status: 5000, message: "Không tìm thấy chính sách" };
  return rpcRow("fn_sales_policy_duplicate", { p_id: key });
};

/* ----------------------------- Chiết khấu ----------------------------- */

/** Thêm/sửa 1 dòng chiết khấu (theo ID dòng) — trả về chính sách sau khi lưu */
export const savePolicyDiscount = async (payload: any) => {
  const policyId = uid(payload?.ChinhSachId ?? payload?.PolicyId);
  if (!policyId) return { status: 5000, message: "Thiếu chính sách" };
  const item = normalizeDiscount({
    ...payload,
    ID: payload?.ID ?? undefined,
    Loai:
      payload?.Loai ??
      (Number(payload?.CKTien) > 0 ? "fixed_amount" : "percentage"),
  });
  const { PhanBoGui, ...sent } = item;
  if (Array.isArray(sent.LuaChon)) sent.LuaChon = sent.LuaChon.map(withoutAllocation);
  return rpcRow("fn_sales_policy_discount_save", {
    p_policy_id: policyId,
    p_item: sent,
  });
};

/** Xoá 1 dòng chiết khấu (theo ID dòng) — trả về chính sách sau khi xoá */
export const deletePolicyDiscount = async (payload: any) => {
  const policyId = uid(payload?.ChinhSachId);
  if (!policyId) return { status: 5000, message: "Thiếu chính sách" };
  return rpcRow("fn_sales_policy_discount_delete", {
    p_policy_id: policyId,
    p_item_id: String(payload?.ID ?? ""),
  });
};

/** Sắp xếp lại chiết khấu: gửi toàn bộ ID theo thứ tự mới — trả về chính sách sau khi đánh lại STT */
export const reorderPolicyDiscounts = async (policyId: any, itemIds: string[]) =>
  rpcRow("fn_sales_policy_discount_reorder", {
    p_policy_id: uid(policyId),
    p_item_ids: itemIds,
  });

/* ----------------------------- Phiên bản ----------------------------- */

/** Lịch sử phiên bản (mới nhất trước) */
export const listPolicyVersions = async (id: any) => {
  const key = uid(id);
  if (!key) return [];
  const { data, error } = await (supabase as any).rpc("fn_sales_policy_versions", { p_id: key });
  if (error) throw error;
  return (data as any[]) || [];
};

/** Khôi phục chính sách về 1 phiên bản */
export const restorePolicyVersion = async (id: any, versionId: any) =>
  rpcRow("fn_sales_policy_restore", { p_id: uid(id), p_version_id: uid(versionId) });

export default {
  listPolicies,
  getPolicyById,
  savePolicy,
  deletePolicy,
  duplicatePolicy,
  savePolicyDiscount,
  deletePolicyDiscount,
  reorderPolicyDiscounts,
  listPolicyVersions,
  restorePolicyVersion,
};

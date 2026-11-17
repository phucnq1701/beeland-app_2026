// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/CustomerCloudService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../_shims/integrations/supabase/client";
import {
  sessionCompanyCode,
  sessionCompanyId,
  sessionEmployeeId,
  sessionMaNV,
} from "../_shims/lib/session";

import { memoAsync } from "../lib/apiCache";
import { RpcError } from "../lib/rpcError";
import { getCustomersByIds, getCustomersByRefs } from "./customers/customer-lookup";

/**
 * BƯỚC 2 – KHÁCH HÀNG (CRM) TRÊN CLOUD
 * Bảng public.cloud_customers — Đợt 5: KHÔNG đọc / ghi thẳng bảng (đã khoá quyền PostgREST). Danh sách màn Khách hàng
 * `fn_customer_list`, ô chọn khách ở màn khác `fn_customer_picker`, đọc theo id / mã `fn_customer_get_by_ids`, lưu
 * `fn_customer_save` — tenant, phạm vi công ty / sàn / nhân viên lấy từ JWT ở máy chủ.
 */

const str = (v: any) =>
  v == null || v === ""
    ? null
    : v instanceof Date
      ? v.toISOString()
      : String(v);
const bool = (v: any) => (v == null || v === "" ? null : !!v);


/** Công ty (sàn) của người đang đăng nhập.
 * Trả về { companyId (uuid dm_companies), maCT (mã sàn cũ) }.
 * Nhân viên nội bộ -> lấy company_id trong dm_employees theo mã nhân viên.
 * Đại lý           -> đối chiếu dm_companies (is_san = true).
 */
export const resolveCurrentCompany = async (): Promise<{
  companyId: string | null;
  maCT: string | null;
}> => {
  const empty = { companyId: null as string | null, maCT: null as string | null };
  try {
    const u = JSON.parse(localStorage.getItem("authUser") || "{}");
    const d = u?.data ?? u ?? {};
    const type = String(d.typeAccount ?? u.typeAccount ?? "").toUpperCase();
    const tenantId = sessionCompanyId();

    if (type !== "AGENCY") {
      const maNV = String(d.maNV ?? d.MaNV ?? u?.maNV ?? u?.MaNV ?? "").trim();
      if (maNV && tenantId) {
        const { data } = await supabase
          .from("dm_employees" as any)
          .select("company_id, ma_ct")
          .eq("ma_ctdk", tenantId)
          .eq("ma_nv", maNV)
          .maybeSingle();
        const emp: any = data;
        if (emp) {
          return {
            companyId: emp.company_id ? String(emp.company_id) : null,
            maCT: emp.ma_ct ? String(emp.ma_ct) : null,
          };
        }
      }
      return { companyId: null, maCT: sessionCompanyCode() || null };
    }

    const aliases = new Set<string>();
    [d.maCT, d.MaCT, d.maSan, d.MaSan, d.maNV, d.MaNV, d.tenCT, d.TenCT, d.tenCTVT, d.TenCTVT, u.maCT, u.MaCT].forEach(
      (v) => {
        const s = String(v ?? "").trim().toLowerCase();
        if (s) aliases.add(s);
      }
    );

    if (!tenantId) return { companyId: null, maCT: String(d.maCT ?? d.MaCT ?? "").trim() || null };

    const { data } = await supabase
      .from("dm_companies" as any)
      .select("id, ten_ct, ten_ct_vt, ma_dl")
      .eq("tenant_company_id", tenantId)
      .eq("is_san", true);

    const rows = (data as any[]) || [];
    const hit =
      rows.find((a: any) => {
        const cand = [a?.id, a?.ten_ct, a?.ten_ct_vt, a?.ma_dl].map(
          (v) => String(v ?? "").trim().toLowerCase()
        );
        return cand.some((v) => v && aliases.has(v));
      }) || rows[0];

    if (!hit) return { companyId: null, maCT: String(d.maCT ?? d.MaCT ?? "").trim() || null };
    return {
      companyId: hit.id ? String(hit.id) : null,
      maCT: String(hit.ma_dl ?? "").trim() || String(d.maCT ?? d.MaCT ?? "").trim() || null,
    };
  } catch {
    return empty;
  }
};

/** Ánh xạ cột DB ⇄ khóa dữ liệu kiểu cũ */
const TEXT_MAP: Record<string, string[]> = {
  company_id: ["CompanyId"],

  ten_kh: ["TenKH"],

  di_dong: ["DiDong"],
  di_dong2: ["DiDong2"],
  email2: ["Email2"],
  thuong_tru: ["ThuongTru"],
  so_cmnd: ["SoCMND", "CCCD", "CMND"],
  ngay_cap: ["NgayCap"],
  noi_cap: ["NoiCap"],
  ngay_sinh: ["NgaySinh"],
  ma_so_kh: ["MaSoKH", "MaKHVT"],
  // Trạng thái & nguồn khách hàng: liên kết uuid tới cloud_catalogs
  ma_tt_id: ["MaTT"],
  ma_nguon_id: ["MaNguon"],
  ma_qd: ["MaQD"],
  ten_qd: ["TenQD"],
  chuc_vu: ["ChucVu"],
  ten_cong_ty: ["TenCongTy"],
  ma_so_thue_ct: ["MaSoThueCT"],
  dien_thoai_ct: ["DienThoaiCT"],
  dia_chi_ct: ["DiaChiCT"],
  email_ct: ["EmailCT"],
  email_ct2: ["EmailCT2"],
  so_gpkd: ["SoGPKD"],
  ngay_cap_gpkd: ["NgayCapGPKD"],
  noi_cap_gpkd: ["NoiCapGPKD"],
  so_dkkd: ["SoDKKD"],
  ngay_cap_gdkkd: ["NgayCapGDKKD"],
  noi_cap_gdkkd: ["NoiCapGDKKD"],
  so_tai_khoan: ["SoTaiKhoan"],
  ten_ngan_hang: ["TenNganHang"],
  ma_nh: ["MaNH"],
  ma_so_ttncn: ["MaSoTTNCN"],
  nguoi_dai_dien_pl: ["NguoiDaiDienPL"],
  // Người đại diện pháp luật / người được uỷ quyền
  ndd_so_cccd: ["NDDSoCCCD"],
  ndd_ngay_cap: ["NDDNgayCap"],
  ndd_noi_cap: ["NDDNoiCap"],
  ndd_dien_thoai: ["NDDDienThoai"],
  ndd_email: ["NDDEmail"],
  ndd_thuong_tru: ["NDDThuongTru"],
  ndd_dia_chi_lh: ["NDDDiaChiLH"],
  van_ban_uq: ["VanBanUQ"],
  nguoi_nhan_tb: ["NguoiNhanTB"],
  nn_dien_thoai1: ["NNDienThoai1"],
  nn_dien_thoai2: ["NNDienThoai2"],
  nn_email1: ["NNEmail1"],
  nn_email2: ["NNEmail2"],
  anh_cccd_truoc: ["AnhCCCDTruoc"],
  anh_cccd_sau: ["AnhCCCDSau"],
  ma_tinh: ["MaTinh"],
  ma_huyen: ["MaHuyen"],
  ma_xa: ["MaXa"],
  mau_nen: ["MauNen"],
  color_web: ["ColorWeb"],
  created_by_id: ["CreatedById"],
  updated_by_id: ["UpdatedById"],
  ngay_sua: ["NgaySua"],
  ghi_chu: ["GhiChu"],
  // QH (manual 148): HĐ liên quan + Mối quan hệ — 2 trường độc lập
  hd_lien_quan_id: ["HdLienQuanId"],
  moi_quan_he_id: ["MoiQuanHeId"],

};

/** Cột số (giữ kiểu number, không ép chuỗi như TEXT_MAP) */
const NUM_MAP: Record<string, string> = {
  muc_do_quan_tam: "MucDoQuanTam",
};

/** Cột máy chủ tự đặt khi lưu qua fn_customer_save — client không gửi */
const SERVER_COLS = new Set(["company_id", "created_by_id", "updated_by_id", "ngay_sua"]);

const BOOL_MAP: Record<string, string> = {
  is_personal: "IsPersonal",
  nhan_sms: "NhanSMS",
  nhan_zalo: "NhanZalo",
  nhan_email: "NhanEmail",
};

const pickKey = (r: any, keys: string[]) => {
  for (const k of keys) {
    const v = r?.[k] ?? r?.[k.charAt(0).toLowerCase() + k.slice(1)];
    if (v != null && v !== "") return v;
  }
  return null;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isCustomerUid = (v: any) => UUID_RE.test(String(v ?? "").trim());

/** Các cột kiểu uuid — chỉ nhận uuid hợp lệ, còn lại để trống (null) */
const UUID_COLS = new Set([
  "id",
  "ma_ctdk",
  "company_id",
  "created_by_id",
  "updated_by_id",
  "ma_tt_id",
  "ma_nguon_id",
  "hd_lien_quan_id",
  "moi_quan_he_id",
]);
const uuidOrNull = (v: any) =>
  isCustomerUid(v) ? String(v).trim() : null;

const hasKey = (r: any, k: string) =>
  r != null &&
  (Object.prototype.hasOwnProperty.call(r, k) ||
    Object.prototype.hasOwnProperty.call(r, k.charAt(0).toLowerCase() + k.slice(1)));
const hasAny = (r: any, keys: string[]) => keys.some((k) => hasKey(r, k));
/** Giá trị đầu tiên khác rỗng trong các bí danh (null nếu tất cả rỗng) */
const firstOf = (r: any, keys: string[]) => str(pickKey(r, keys));

/**
 * Bản ghi cột phẳng CHỈ gồm các cột có khoá tương ứng trong payload — gửi cho
 * fn_customer_save (máy chủ ghép lên bản ghi cũ, cột không gửi giữ nguyên).
 * Các bí danh cùng một thông tin (CCCD, SĐT, email, địa chỉ) được đồng bộ.
 */
export const toPartialRow = (payload: any): Record<string, any> => {
  const p = stripMasked(payload || {});
  const row: Record<string, any> = {};
  const uid = [p.Id, p.ID, p.MaKH, p.maKH, p.KhachHangId]
    .map((v) => String(v ?? "").trim())
    .find((v) => isCustomerUid(v));
  if (uid) row.id = uid;

  Object.entries(TEXT_MAP).forEach(([col, keys]) => {
    if (SERVER_COLS.has(col) || !hasAny(p, keys)) return;
    const v = firstOf(p, keys);
    row[col] = UUID_COLS.has(col) ? uuidOrNull(v) : v;
  });
  Object.entries(BOOL_MAP).forEach(([col, key]) => {
    if (hasKey(p, key)) row[col] = bool(p[key]);
  });
  Object.entries(NUM_MAP).forEach(([col, key]) => {
    if (!hasKey(p, key)) return;
    const n = p[key] == null || p[key] === "" ? null : Number(p[key]);
    row[col] = n == null || Number.isNaN(n) ? null : n;
  });

  if (!hasKey(p, "TenKH") && hasKey(p, "HoTen")) row.ten_kh = str(p.HoTen);

  // Cột chính (cccd, dien_thoai, email, dia_chi) chỉ lấy từ khoá CHÍNH. Bí danh phụ (MST, SĐT/email/địa chỉ
  // công ty, thường trú) đi theo cột riêng của chúng; máy chủ điền cột chính từ chúng khi cột chính trống —
  // tránh sửa ghi đè địa chỉ/email đang có và chống trùng SĐT nhầm theo SĐT công ty.
  const idKeys = ["SoCMND", "CCCD", "CMND"];
  if (hasAny(p, idKeys)) row.so_cmnd = row.cccd = firstOf(p, idKeys);

  const phoneKeys = ["DiDong", "DienThoai", "SoDienThoai", "Phone"];
  if (hasAny(p, phoneKeys)) row.di_dong = row.dien_thoai = firstOf(p, phoneKeys);

  if (hasKey(p, "Email")) row.email = str(p.Email ?? p.email);
  if (hasKey(p, "DiaChi")) row.dia_chi = str(p.DiaChi ?? p.diaChi);
  if (hasAny(p, ["LoaiKH", "CustomerType"])) row.loai_kh = firstOf(p, ["LoaiKH", "CustomerType"]);
  if (hasKey(p, "NgayTao")) row.ngay_tao = p.NgayTao ? new Date(p.NgayTao).toISOString() : null;
  if (hasKey(p, "NguoiNhanTBList"))
    row.nguoi_nhan_tb_list = Array.isArray(p.NguoiNhanTBList) ? p.NguoiNhanTBList : null;
  if (hasKey(p, "IsNoxh")) row.is_noxh = p.IsNoxh === true;
  return row;
};


/**
 * Che trường theo nhóm quyền (máy chủ trả `_che` = cột đã che, chỉ cột đang có giá trị) ⇒ khoá dạng cũ để form khoá ô.
 * Cột bí danh / cột phụ quy về trường cấu hình tương ứng.
 */
const MASK_COL_EXTRA: Record<string, string> = {
  cccd: "SoCMND",
  dien_thoai: "DiDong",
  email: "Email",
  dia_chi: "DiaChi",
  hd_lien_quan: "HdLienQuanId",
  ten_moi_quan_he: "MoiQuanHeId",
  ten_tt: "MaTT",
  trang_thai: "MaTT",
  mau_tt: "MaTT",
  ten_nguon: "MaNguon",
  nguon: "MaNguon",
  mau_nguon: "MaNguon",
};
export const maskedKeysOf = (r: any): string[] => {
  const che: unknown = r?._che;
  if (!Array.isArray(che)) return [];
  const out = new Set<string>();
  che.forEach((c) => {
    const col = String(c);
    const k = TEXT_MAP[col]?.[0] ?? MASK_COL_EXTRA[col];
    if (k) out.add(k);
  });
  return [...out];
};

/** Bí danh dạng cũ của cùng một trường — trường bị che thì bỏ cả bí danh khỏi payload */
const MASK_ALIASES: Record<string, string[]> = {
  SoCMND: ["SoCMND", "CCCD", "CMND"],
  DiDong: ["DiDong", "DienThoai", "SoDienThoai", "Phone"],
  TenKH: ["TenKH", "HoTen"],
};
/** Bỏ khỏi payload các khoá bị che (payload.__masked từ fromRow) — máy chủ cũng tự giữ giá trị cũ */
const stripMasked = (payload: any): any => {
  const masked: unknown = payload?.__masked;
  if (!Array.isArray(masked) || !masked.length) return payload;
  const p = { ...payload };
  masked.forEach((k) => {
    (MASK_ALIASES[k] ?? [k]).forEach((a) => {
      delete p[a];
      delete p[a.charAt(0).toLowerCase() + a.slice(1)];
    });
  });
  return p;
};

/** Dựng lại object dạng cũ từ bản ghi cột phẳng */
export const fromRow = (r: any) => {
  const out: any = {};
  Object.entries(TEXT_MAP).forEach(([col, keys]) => {
    if (r?.[col] != null && r[col] !== "") out[keys[0]] = r[col];
  });
  Object.entries(BOOL_MAP).forEach(([col, key]) => {
    if (r?.[col] != null) out[key] = r[col];
  });
  Object.entries(NUM_MAP).forEach(([col, key]) => {
    if (r?.[col] != null && r[col] !== "") out[key] = Number(r[col]);
  });
  if (Array.isArray(r?.nguoi_nhan_tb_list))
    out.NguoiNhanTBList = r.nguoi_nhan_tb_list;
  const cty = r?.cty || null;
  const creator = r?.creator || null;
  const updater = r?.updater || null;
  const empName = (e: any) =>
    e ? String(e.ho_ten || e.ma_nv || "").trim() || null : null;
  // Bản giới hạn (khách công ty khác chỉ thấy qua chứng từ): CCCD đã che ⇒ KHÔNG đưa vào ô nhập (SoCMND / CCCD) để form
  // không điền sẵn rồi gửi lại giá trị che; chỉ hiển thị qua CCCDMasked. Máy chủ cũng bỏ qua giá trị che khi lưu.
  const limited = r?.limited === true;
  return {
    ...out,
    Id: r?.id,
    MaKH: r?.id,
    HoTen: out.TenKH ?? r?.ten_kh,
    TenKH: out.TenKH ?? r?.ten_kh,
    IsPersonal: out.IsPersonal ?? (out.TenCongTy ? false : true),
    DienThoai: out.DiDong ?? out.DienThoaiCT ?? r?.dien_thoai,
    DiDong: out.DiDong ?? out.DienThoaiCT ?? r?.dien_thoai,
    SoCMND: limited ? null : out.SoCMND ?? out.MaSoThueCT ?? r?.cccd,
    Email: out.Email ?? out.EmailCT ?? r?.email,
    CCCD: limited ? null : r?.cccd,
    CCCDMasked: limited ? r?.cccd ?? null : null,
    DiaChi: r?.dia_chi ?? out.ThuongTru ?? out.DiaChiCT,
    NgayTao: r?.ngay_tao,
    // QH: nhãn HĐ liên quan ({id, so_hdmb, ten_da, ten_khu, ten_kh, ky_hieu}) + tên mối quan hệ — chỉ hiển thị, không gửi lại
    HdLienQuan: r?.hd_lien_quan && typeof r.hd_lien_quan === "object" ? r.hd_lien_quan : null,
    TenMoiQuanHe: r?.ten_moi_quan_he ?? null,
    // Người tạo / người sửa (tên nhân viên, lấy theo liên kết uuid)
    NguoiThem: empName(creator),
    NguoiSua: empName(updater),
    // Công ty/đại lý sở hữu khách hàng
    CompanyId: r?.company_id ?? out.CompanyId ?? null,
    TenCongTyQuanLy: cty?.ten_ct ?? cty?.ten_ct_vt ?? null,
    IsAgency: cty ? !!cty.is_san : null,
    IsNoxh: r?.is_noxh === true,
    /** Khách công ty khác chỉ thấy qua chứng từ: máy chủ trả bản giới hạn (CCCD che, không ảnh / giấy tờ) */
    Limited: limited,
    /** Trường bị che theo nhóm quyền (khoá dạng cũ) — form khoá ô, không gửi lại */
    __masked: maskedKeysOf(r),
    _cloud: true,
  };
};

export interface CustomerListOptions {
  keyword?: string;
  pageIndex?: number;
  pageSize?: number;
  maTT?: any;
  maNguon?: any;
  isPersonal?: boolean | null;
  /** Lọc khách tạo từ hồ sơ NOXH: null = tất cả */
  isNoxh?: boolean | null;
  /** Lọc theo 1 công ty cụ thể (tự bao gồm công ty con) */
  companyId?: string | null;
  /** Lọc theo nhiều công ty (mỗi công ty tự bao gồm công ty con); rỗng = không lọc */
  companyIds?: string[] | null;
  /** (giữ cho tương thích) — phạm vi công ty luôn lấy ở máy chủ */
  allCompanies?: boolean;
}

/**
 * Một trang khách hàng — `fn_customer_list` (bản mới): công ty đăng ký + phạm vi công ty / sàn lấy từ JWT ở máy chủ,
 * tìm kiếm escape ở máy chủ, trả kèm tên / màu trạng thái và nguồn. Lỗi máy chủ ném ra (màn Khách hàng hiện toast).
 */
export const listCustomerPage = async (opts: CustomerListOptions = {}): Promise<{ rows: any[]; total: number }> => {
  const pageIndex = Math.max(1, Number(opts.pageIndex) || 1);
  const pageSize = Math.min(5000, Math.max(1, Number(opts.pageSize) || 20));
  const uuidOr = (v: any) => (v != null && v !== "" && isCustomerUid(v) ? String(v).trim() : null);
  const companyIds = (opts.companyIds || []).map(uuidOr).filter(Boolean) as string[];
  const { data, error } = await supabase.rpc("fn_customer_list" as any, {
    p_company_id: uuidOr(opts.companyId),
    p_company_ids: companyIds.length ? companyIds : null,
    p_search: (opts.keyword || "").trim() || null,
    p_is_personal: opts.isPersonal == null ? null : !!opts.isPersonal,
    p_is_noxh: opts.isNoxh == null ? null : !!opts.isNoxh,
    p_ma_tt_id: uuidOr(opts.maTT),
    p_ma_nguon_id: uuidOr(opts.maNguon),
    p_page: pageIndex,
    p_size: pageSize,
  } as any);
  // Giữ mã Postgres (42501 thiếu quyền xem) để màn hình báo "không có quyền" thay vì trắng màn
  if (error) throw new RpcError(error.message || "Không thể tải danh sách khách hàng", (error as { code?: string }).code);
  const res: any = data ?? {};
  return {
    rows: (Array.isArray(res.rows) ? res.rows : []).map(fromListRow),
    total: Number(res.total ?? 0) || 0,
  };
};

/** Map 1 dòng _customer_rows (fn_customer_list / fn_customer_picker) */
const fromListRow = (r: any) => ({
  ...fromRow(r),
  TenTrangThai: r?.ten_tt ?? null,
  MauTrangThai: r?.mau_tt ?? null,
  TenNguon: r?.ten_nguon ?? null,
  MauNguon: r?.mau_nguon ?? null,
});

/** Số ký tự tối thiểu của từ khoá ô chọn khách (máy chủ trả rỗng nếu ngắn hơn) */
export const CUSTOMER_PICKER_MIN_KEYWORD = 2;
/** Số dòng tối đa ô chọn khách (máy chủ kẹp 1…50) */
export const CUSTOMER_PICKER_MAX = 50;

/**
 * Ô chọn khách ở màn khác (Booking, Đặt cọc, HĐ, Phiếu thu, Chuyển nhượng…) — `fn_customer_picker` (D5-5): khách trong công ty
 * được xem (①), không áp "Theo nhân viên", không cần quyền màn Khách hàng. Từ khoá < 2 ký tự ⇒ rỗng; ≤ 50 dòng; không phân trang
 * (trang > 1 ⇒ rỗng để ô chọn cuộn trang không lặp dòng). Lỗi máy chủ ném ra.
 */
export const listCustomerPicker = async (opts: CustomerListOptions = {}): Promise<{ rows: any[]; total: number }> => {
  const keyword = (opts.keyword || "").trim();
  if (keyword.length < CUSTOMER_PICKER_MIN_KEYWORD || (Number(opts.pageIndex) || 1) > 1) return { rows: [], total: 0 };
  const uuidOr = (v: any) => (v != null && v !== "" && isCustomerUid(v) ? String(v).trim() : null);
  const companyIds = [...(opts.companyIds || []), opts.companyId].map(uuidOr).filter(Boolean) as string[];
  const { data, error } = await supabase.rpc("fn_customer_picker" as any, {
    p_search: keyword,
    p_limit: Math.min(CUSTOMER_PICKER_MAX, Math.max(1, Number(opts.pageSize) || 20)),
    p_company_ids: companyIds.length ? companyIds : null,
    p_is_personal: opts.isPersonal == null ? null : !!opts.isPersonal,
    p_is_noxh: opts.isNoxh == null ? null : !!opts.isNoxh,
  } as any);
  if (error) throw new Error(error.message || "Không thể tìm khách hàng");
  const rows = (Array.isArray((data as any)?.rows) ? (data as any).rows : []).map(fromListRow);
  return { rows, total: rows.length };
};

/**
 * Tab "Danh mục khách hàng" của cổng Đại lý — `fn_agency_customer_list` (quyền xem form Khách hàng 824, chỉ tài khoản đại lý /
 * nhân viên sàn, khách của sàn, phân trang). Lỗi máy chủ ném ra.
 */
export const listAgencyCustomerPage = async (
  opts: { keyword?: string; pageIndex?: number; pageSize?: number } = {},
): Promise<{ rows: any[]; total: number }> => {
  const { data, error } = await supabase.rpc("fn_agency_customer_list" as any, {
    p_search: (opts.keyword || "").trim() || null,
    p_page: Math.max(1, Number(opts.pageIndex) || 1),
    p_size: Math.min(500, Math.max(1, Number(opts.pageSize) || 50)),
  } as any);
  if (error) throw new Error(error.message || "Không tải được khách hàng của đại lý");
  const res: any = data ?? {};
  return { rows: (Array.isArray(res.rows) ? res.rows : []).map(fromListRow), total: Number(res.total ?? 0) || 0 };
};

/** Ô tìm khách ở các màn khác — `fn_customer_picker`; lỗi ⇒ rỗng (giữ hành vi cũ) */
export const listCustomersFromCloud = async (opts?: CustomerListOptions): Promise<{ rows: any[]; total: number }> => {
  try {
    return await listCustomerPicker(opts || {});
  } catch {
    return { rows: [], total: 0 };
  }
};

/**
 * Danh mục khách hàng (trạng thái + nguồn) — 1 lần `fn_customer_catalog_list`, công ty lấy từ JWT.
 * Cache ngắn (DEFAULT_TTL) dùng chung cơ chế `catalog:` — lưu danh mục KH xoá cache ngay.
 */
export const listCustomerCatalogs = async (): Promise<{ trangThai: any[]; nguon: any[]; moiQuanHe: any[] }> =>
  memoAsync(`catalog:${sessionCompanyId() || ""}:customer-catalogs:`, async () => {
    const { data, error } = await supabase.rpc("fn_customer_catalog_list" as any, {
      p_types: ["trang_thai_kh", "nguon_kh", "moi_quan_he_kh"],
    } as any);
    if (error) throw new Error(error.message || "Không tải được danh mục khách hàng");
    const d: any = data ?? {};
    return {
      trangThai: (Array.isArray(d.trang_thai_kh) ? d.trang_thai_kh : []).map((r: any) => ({
        ID: r.id,
        MaTT: r.id,
        Code: r.item_code ?? null,
        TenTT: r.item_name ?? null,
        Name: r.item_name ?? null,
        Color: r.color_code ?? null,
        MauNen: r.color_code ?? null,
        ColorWeb: r.color_code ?? null,
        GhiChu: r.ghi_chu ?? null,
      })),
      nguon: (Array.isArray(d.nguon_kh) ? d.nguon_kh : []).map((r: any) => ({
        ID: r.id,
        MaNguon: r.id,
        Code: r.item_code ?? null,
        TenNguon: r.item_name ?? null,
        Name: r.item_name ?? null,
        Color: r.color_code ?? null,
        GhiChu: r.ghi_chu ?? null,
      })),
      // Máy chủ cũ chưa có loại này ⇒ mảng rỗng
      moiQuanHe: (Array.isArray(d.moi_quan_he_kh) ? d.moi_quan_he_kh : []).map((r: any) => ({
        ID: r.id,
        MaMoiQuanHe: r.id,
        Code: r.item_code ?? null,
        TenMoiQuanHe: r.item_name ?? null,
        Name: r.item_name ?? null,
        GhiChu: r.ghi_chu ?? null,
      })),
    };
  });

/** uuid hồ sơ nhân viên của tài khoản đang đăng nhập (dm_employees.id) */
export const resolveCurrentEmployeeId = async (): Promise<string | null> => {
  const fromToken = sessionEmployeeId();
  if (isCustomerUid(fromToken)) return String(fromToken).trim();
  try {
    const tenantId = sessionCompanyId();
    const maNV = sessionMaNV();
    if (!maNV) return null;
    // Ưu tiên đúng công ty đăng ký, nếu không có thì dò theo mã nhân viên
    if (tenantId) {
      const { data } = await supabase
        .from("dm_employees" as any)
        .select("id")
        .eq("ma_ctdk", tenantId)
        .eq("ma_nv", maNV)
        .limit(1);
      const hit = Array.isArray(data) ? (data as any[])[0] : null;
      if (isCustomerUid(hit?.id)) return String(hit.id);
    }
    const { data: any2 } = await supabase
      .from("dm_employees" as any)
      .select("id")
      .eq("ma_nv", maNV)
      .limit(1);
    const row = Array.isArray(any2) ? (any2 as any[])[0] : null;
    return isCustomerUid(row?.id) ? String(row.id) : null;
  } catch {
    return null;
  }
};

/**
 * Thêm/sửa khách hàng qua RPC fn_customer_save — chống trùng CCCD/SĐT, sinh mã,
 * gán công ty/người tạo/người sửa đều xử lý trên máy chủ (1 giao dịch).
 * Chỉ gửi các cột có trong payload; cột không gửi giữ nguyên.
 * `scoped`: màn Khách hàng — kiểm quyền ADD/EDIT + phạm vi công ty; luồng giao dịch
 * ở module khác để mặc định (chỉ lọc công ty đăng ký).
 * `forceNew`: form Thêm khách (BUG-001, TK4) — khách trùng CCCD/SĐT trong phạm vi không bị ghi đè, máy chủ tạo khách mới;
 * trùng ngoài phạm vi giữ luật phạm vi (TK5). Không truyền ⇒ máy chủ gộp vào khách trùng như cũ.
 */
export const saveCustomerToCloud = async (
  payload: any,
  opts?: { scoped?: boolean; forceNew?: boolean },
) => {
  // Công ty đăng ký kiểm ở máy chủ (app_tenant từ JWT)
  const { data, error } = await supabase.rpc("fn_customer_save" as any, {
    p_row: toPartialRow(payload),
    p_scoped: !!opts?.scoped,
    p_force_new: !!opts?.forceNew,
  } as any);
  if (error) throw new Error(error.message || "Lưu khách hàng thất bại");
  return { status: 2000 as const, data: ((data as any) ?? null) as string | null, message: undefined };
};

/**
 * Lấy 1 khách hàng theo uuid — `fn_customer_get_by_ids`: khách trong công ty được xem ⇒ đầy đủ; khách công ty khác nằm trên
 * chứng từ người gọi thấy ⇒ bản giới hạn (`Limited: true`); ngoài cả hai / lỗi ⇒ null.
 */
export const getCustomerFromCloud = async (maKH: any) => {
  if (!isCustomerUid(maKH)) return null;
  try {
    const rows = await getCustomersByIds([String(maKH).trim()]);
    return rows[0] ? fromRow(rows[0]) : null;
  } catch {
    return null;
  }
};

/**
 * Chi tiết 1 khách hàng cho màn Khách hàng › chi tiết (RPC fn_customer_get, theo phạm vi công ty).
 * Ngoài phạm vi / không tồn tại ⇒ null. Kèm tên trạng thái, màu trạng thái, tên nguồn.
 */
export const getCustomerScoped = async (id: any) => {
  if (!isCustomerUid(id)) return null;
  const { data, error } = await supabase.rpc("fn_customer_get" as any, {
    p_id: String(id).trim(),
  } as any);
  if (error) throw new Error(error.message || "Không tải được khách hàng");
  if (!data) return null;
  const r: any = data;
  return {
    ...fromRow(r),
    TenTrangThai: r.trang_thai?.item_name ?? null,
    MauTrangThai: r.trang_thai?.color_code ?? null,
    TenNguon: r.nguon?.item_name ?? null,
  };
};

/**
 * Lấy khách hàng theo bất kỳ định danh nào: uuid, mã khách hàng (MaSoKH)
 * hoặc số điện thoại (di động). Dùng cho các phiếu cũ chỉ lưu mã khách hàng. Ưu tiên khớp mã, rồi SĐT.
 */
export const getCustomerByRef = async (ref: any) => {
  const key = String(ref ?? "").trim();
  if (!key) return null;
  if (isCustomerUid(key)) return await getCustomerFromCloud(key);
  try {
    const rows = await getCustomersByRefs([key]);
    const hit =
      rows.find((r: any) => String(r?.ma_so_kh ?? "").trim() === key) ||
      rows.find((r: any) => String(r?.di_dong ?? "").trim() === key) ||
      null;
    return hit ? fromRow(hit) : null;
  } catch {
    return null;
  }
};

/** Xóa khách hàng (RPC fn_customer_delete: phạm vi + quyền + còn booking thì chặn). Ném lỗi máy chủ. */
export const removeCustomerFromCloud = async (maKH: any) => {
  if (!isCustomerUid(maKH)) return;
  const { error } = await supabase.rpc("fn_customer_delete" as any, {
    p_id: String(maKH).trim(),
  } as any);
  if (error) throw new Error(error.message || "Xóa khách hàng thất bại");
};

/** Lưu ảnh CCCD (mặt trước/sau) của khách hàng qua fn_customer_save — chỉ gửi 2 cột ảnh, lỗi không chặn luồng lưu */
export const saveCustomerCccdImages = async (
  maKH: any,
  imgs: { AnhCCCDTruoc?: string | null; AnhCCCDSau?: string | null },
  _extra?: any
) => {
  if (!isCustomerUid(maKH)) return;
  if (!imgs.AnhCCCDTruoc && !imgs.AnhCCCDSau) return;
  try {
    await saveCustomerToCloud({ Id: maKH, ...imgs });
  } catch {
    /* ảnh lỗi không chặn lưu chứng từ / khách hàng */
  }
};

/**
 * Đọc ảnh CCCD đã lưu của khách hàng — `fn_customer_images_get` (màn Khách hàng: quyền xem + phạm vi đầy đủ). Không có quyền
 * màn Khách hàng (form khách mở từ chứng từ) ⇒ `fn_customer_get_by_ids(…, p_with_images)`: chỉ khách trong công ty được xem
 * mới có ảnh (bản giới hạn không trả ảnh). Lỗi ⇒ rỗng.
 */
export const getCustomerCccdImages = async (
  maKH: any
): Promise<{ AnhCCCDTruoc: string | null; AnhCCCDSau: string | null; AnhCCCDMasked?: boolean }> => {
  const empty = { AnhCCCDTruoc: null, AnhCCCDSau: null };
  if (!isCustomerUid(maKH)) return empty;
  const id = String(maKH).trim();
  // Ảnh bị che theo nhóm quyền: máy chủ trả null + _che có anh_cccd_* ⇒ form hiện "Ảnh bị che", không cho tải lại
  const masked = (r: any) =>
    Array.isArray(r?._che) && r._che.some((c: any) => c === "anh_cccd_truoc" || c === "anh_cccd_sau");
  const { data, error } = await supabase.rpc("fn_customer_images_get" as any, { p_id: id } as any);
  if (!error && data) {
    return {
      AnhCCCDTruoc: (data as any).anh_cccd_truoc ?? null,
      AnhCCCDSau: (data as any).anh_cccd_sau ?? null,
      AnhCCCDMasked: masked(data),
    };
  }
  try {
    const row = (await getCustomersByIds([id], { withImages: true }))[0];
    return row
      ? { AnhCCCDTruoc: row.anh_cccd_truoc ?? null, AnhCCCDSau: row.anh_cccd_sau ?? null, AnhCCCDMasked: masked(row) }
      : empty;
  } catch {
    return empty;
  }
};

/**
 * Mã khách hàng xem trước khi thêm mới — `fn_customer_next_code`: đúng mã máy chủ cấp khi lưu (quy tắc đánh mã KHACHHANG
 * của công ty đăng ký lấy từ JWT, số lớn nhất trong công ty + 1). Lỗi ⇒ "" (máy chủ vẫn tự cấp mã khi lưu).
 */
export const nextCustomerCode = async (): Promise<string> => {
  const { data, error } = await supabase.rpc("fn_customer_next_code" as any, {} as any);
  if (error) return "";
  return String(data ?? "").trim();
};

export const CustomerCloudService = {
  listCustomersFromCloud,
  listCustomerPicker,
  listAgencyCustomerPage,
  listCustomerPage,
  listCustomerCatalogs,
  saveCustomerToCloud,
  getCustomerFromCloud,
  getCustomerScoped,
  getCustomerByRef,
  removeCustomerFromCloud,
  saveCustomerCccdImages,
  getCustomerCccdImages,
  nextCustomerCode,
};


export { relatedContractLabel, type RelatedContractOption } from "./relatedContract";
import type { RelatedContractOption } from "./relatedContract";

/** Ô "HĐ liên quan": tìm HĐMB đã duyệt theo số HĐ / mã căn / tên khách / dự án — `fn_customer_contract_picker` */
export const searchRelatedContracts = async (search: string, limit = 50): Promise<RelatedContractOption[]> => {
  const { data, error } = await supabase.rpc("fn_customer_contract_picker" as any, {
    p_search: search?.trim() || null,
    p_limit: limit,
  } as any);
  if (error) throw new Error(error.message || "Không tải được danh sách HĐMB");
  const rows = typeof data === "string" ? JSON.parse(data || "[]") : data;
  return Array.isArray(rows) ? (rows as RelatedContractOption[]) : [];
};

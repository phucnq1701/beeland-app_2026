import { listResult, pageWindow } from "../lib/listRpc";
import { getCustomersByRefs, pickCustomers as pickCustomerRows, getCustomersByIds } from "./customerLookup";
import { mapCustomerTransaction } from "../lib/customerRules";
import { callNv, errorMessage, NvApiError } from "@/services/nvApi";

/*
 * Khách hàng — bộ API riêng app nhân viên (api/app-nhan-vien/fn_nv_app_*, lõi chung: SP app bọc đúng SP web, công ty / nhân viên
 * lấy từ phiên ở máy chủ):
 *   danh mục   fn_nv_app_danh_muc(p_loai)              – như web listCatalogFromCloud (cloud_catalogs của công ty, created_at tăng)
 *   danh sách  fn_nv_app_khach_hang_list               – fn_customer_list (phạm vi khách ở máy chủ)
 *   chi tiết   fn_nv_app_khach_hang_chi_tiet(p_id)     – fn_customer_get (ngoài phạm vi ⇒ null; qua chứng từ ⇒ bản giới hạn)
 *   lưu        fn_nv_app_khach_hang_luu(p_row)         – fn_customer_save(p_row, p_scoped = true) ⇒ uuid
 *   xoá        fn_nv_app_khach_hang_xoa(p_id)          – fn_customer_delete
 *   giao dịch  fn_nv_app_khach_hang_giao_dich          – phiếu của khách theo phạm vi giao dịch web (SP 83)
 * Lỗi máy chủ (RAISE) ⇒ NvApiError, hiện nguyên thông báo.
 */

/**
 * Cột form app quản lý — sửa khách chỉ gửi các cột này cho fn_customer_save (máy chủ ghép lên bản ghi cũ, cột không gửi
 * giữ nguyên ⇒ dữ liệu chỉ nhập trên web không bị ghi đè).
 */
const APP_EDIT_COLUMNS = new Set([
  "is_personal", "ten_kh", "ten_cong_ty", "di_dong", "dien_thoai", "di_dong2",
  "dien_thoai_ct", "email", "email_ct", "cccd", "so_cmnd", "dia_chi", "dia_chi_ct", "ma_so_thue_ct", "ma_so_ttncn",
  "nguoi_dai_dien_pl", "chuc_vu", "ndd_dien_thoai", "ndd_email", "ndd_so_cccd", "ma_tt_id", "ma_nguon_id",
  "ghi_chu",
]);

async function rpc<T = any>(fn: string, body: Record<string, any>, fallback: string): Promise<T> {
  try {
    return await callNv<T>(fn, body);
  } catch (e) {
    if (e instanceof NvApiError) throw e;
    throw new Error(errorMessage(e, fallback));
  }
}

const isAuthError = (e: any) => e instanceof NvApiError && e.status === 401;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Trạng thái KH KHÔNG hardcode: luôn đọc từ danh mục công ty (xem getTrangThaiCatalogs).

const DEFAULT_NGUON_CATALOG = [
  { id: "facebook", label: "Facebook / Ads", value: "facebook", code: "facebook" },
  { id: "website", label: "Website", value: "website", code: "website" },
  { id: "referral", label: "Giới thiệu", value: "referral", code: "referral" },
  { id: "hotline", label: "Hotline / Trực tiếp", value: "hotline", code: "hotline" },
  { id: "self", label: "Tự tìm kiếm", value: "self", code: "self" },
];

/** Danh mục của công ty phiên (máy chủ lọc công ty, chỉ loại app dùng) — như web listCatalogFromCloud: created_at tăng dần */
export const fetchCatalogList = async (catalogType: string): Promise<any[]> => {
  const rows = await callNv<any[]>("fn_nv_app_danh_muc", { p_loai: catalogType });
  return Array.isArray(rows) ? rows : [];
};

/** Bỏ dấu tiếng Việt + lower-case để so khớp tên trạng thái ổn định */
const normalizeStatusText = (s: any): string =>
  String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/**
 * Resolve trạng thái khách hàng -> UUID danh mục (trang_thai_kh của công ty).
 * Nhận cả UUID, item_code (vd "active") hoặc tên (item_name).
 * Trả null nếu không tìm thấy (khi đó lọc phía client theo tên).
 */
const resolveStatusUuid = async (statusIdOrCode?: string, statusLabel?: string): Promise<string | null> => {
  const v = String(statusIdOrCode || "").trim();
  if (!v || v === "all") return null;
  if (UUID_RE.test(v)) return v;
  try {
    const rows = await fetchCatalogList("trang_thai_kh");
    const label = normalizeStatusText(statusLabel);
    const hit =
      rows.find((r: any) => String(r?.item_code ?? "") === v) ||
      (label ? rows.find((r: any) => normalizeStatusText(r?.item_name) === label) : null);
    if (hit?.id && UUID_RE.test(String(hit.id))) return String(hit.id);
  } catch {
    // không resolve được -> caller lọc phía client
  }
  return null;
};

/**
 * Resolve UUID khách hàng từ id (UUID) hoặc mã KH (ma_so_kh, vd KH-893482).
 * Màn danh sách/home có thể truyền mã KH — mọi query cột uuid phải dùng UUID.
 * Mã KH → `fn_customer_get_by_ids(p_refs)` (customerLookup.getCustomersByRefs), khớp đúng mã, không có thì SĐT
 * (như web CustomerCloudService.getCustomerByRef). Lỗi máy chủ ném ra; không tìm thấy ⇒ null.
 */
const resolveCustomerUuid = async (idOrCode: string): Promise<string | null> => {
  const v = String(idOrCode || "").trim();
  if (!v) return null;
  if (UUID_RE.test(v)) return v;
  const rows = await getCustomersByRefs([v]);
  const hit =
    rows.find((r: any) => String(r?.ma_so_kh ?? "").trim() === v) ||
    rows.find((r: any) => String(r?.di_dong ?? "").trim() === v) ||
    null;
  return hit?.id && UUID_RE.test(String(hit.id)) ? String(hit.id) : null;
};

export interface CustomerCloudModel {
  id: string;
  ma_so_kh?: string;
  ten_kh?: string;
  ten_cong_ty?: string;
  is_personal?: boolean;
  di_dong?: string;
  di_dong2?: string;
  dien_thoai?: string;
  dien_thoai_ct?: string;
  email?: string;
  email2?: string;
  email_ct?: string;
  cccd?: string;
  so_cmnd?: string;
  ngay_cap?: string;
  noi_cap?: string;
  ngay_sinh?: string;
  loai_kh?: string;
  thuong_tru?: string;
  dia_chi?: string;
  dia_chi_ct?: string;
  ma_so_thue_ct?: string;
  ma_so_ttncn?: string;
  so_tai_khoan?: string;
  ten_ngan_hang?: string;
  ma_nh?: string;
  nguoi_dai_dien_pl?: string;
  chuc_vu?: string;
  ndd_dien_thoai?: string;
  ndd_email?: string;
  ndd_so_cccd?: string;
  ma_tt_id?: string;
  ma_nguon_id?: string;
  ma_qd?: string;
  ten_qd?: string;
  company_id?: string;
  ma_ctdk?: string;
  created_at?: string;
  updated_at?: string;
  ngay_tao?: string;
  color_code?: string;
  color_web?: string;
  ten_tt?: string;
  ten_nguon?: string;
  trang_thai?: any;
  tt?: any;
  nguon?: any;
  cty?: any;
  creator?: any;
}

export function normalizeCustomerRow(raw: any) {
  const isPersonal = raw?.is_personal !== false;
  const tenKH = (raw?.ten_kh || raw?.ten_cong_ty || raw?.name || raw?.ho_ten || "").toString().trim();
  const diDong = (raw?.di_dong || raw?.dien_thoai || raw?.phone || raw?.di_dong2 || raw?.dien_thoai_ct || "").toString().trim();
  
  // Status & color resolving — KHÔNG mặc định "Tiềm năng":
  // khách chưa chọn trạng thái thì status rỗng để UI ẩn badge.
  const ttObj = raw?.trang_thai || raw?.tt || {};
  const statusName = ttObj?.item_name || raw?.ten_tt || raw?.status || "";
  // fn_customer_list bản mới trả phẳng ten_tt / mau_tt (bản cũ: object trang_thai)
  const statusColor =
    ttObj?.color_code || ttObj?.color_web || raw?.mau_tt || raw?.color_code || raw?.color_web || "#9CA3AF";

  const nguonObj = raw?.nguon || {};
  const sourceName = nguonObj?.item_name || raw?.ten_nguon || raw?.source || "";

  const ctyObj = raw?.cty || {};
  const tenSan = ctyObj?.ten_ct_vt || ctyObj?.ten_ct || raw?.ten_san || "";

  return {
    ...raw,
    id: raw?.id,
    maKH: raw?.ma_so_kh || raw?.id,
    ma_kh: raw?.ma_so_kh || raw?.id,
    ma_so_kh: raw?.ma_so_kh || "",
    is_personal: isPersonal,
    isPersonal: isPersonal,
    tenKH,
    ho_ten: tenKH,
    name: tenKH,
    ten_kh: raw?.ten_kh || (isPersonal ? tenKH : ""),
    ten_cong_ty: raw?.ten_cong_ty || (!isPersonal ? tenKH : ""),
    company: raw?.ten_cong_ty || tenSan || "",
    tenSan,
    diDong,
    dien_thoai: diDong,
    di_dong: raw?.di_dong || diDong,
    di_dong2: raw?.di_dong2 || "",
    dien_thoai_ct: raw?.dien_thoai_ct || "",
    phone: diDong,
    email: raw?.email || raw?.email_ct || "",
    email2: raw?.email2 || "",
    email_ct: raw?.email_ct || "",
    cccd: raw?.cccd || raw?.so_cmnd || "",
    so_cmnd: raw?.so_cmnd || raw?.cccd || "",
    ngay_cap: raw?.ngay_cap || "",
    noi_cap: raw?.noi_cap || "",
    ngay_sinh: raw?.ngay_sinh || "",
    diaChi: raw?.dia_chi || raw?.thuong_tru || raw?.dia_chi_ct || "",
    dia_chi: raw?.dia_chi || "",
    thuong_tru: raw?.thuong_tru || "",
    dia_chi_ct: raw?.dia_chi_ct || "",
    taxCode: raw?.ma_so_thue_ct || raw?.ma_so_ttncn || "",
    ma_so_thue_ct: raw?.ma_so_thue_ct || "",
    ma_so_ttncn: raw?.ma_so_ttncn || "",
    so_tai_khoan: raw?.so_tai_khoan || "",
    ten_ngan_hang: raw?.ten_ngan_hang || "",
    ma_nh: raw?.ma_nh || "",
    nguoi_dai_dien_pl: raw?.nguoi_dai_dien_pl || "",
    chuc_vu: raw?.chuc_vu || "",
    ndd_dien_thoai: raw?.ndd_dien_thoai || "",
    ndd_email: raw?.ndd_email || "",
    ndd_so_cccd: raw?.ndd_so_cccd || "",
    ma_tt_id: raw?.ma_tt_id || ttObj?.id || null,
    ma_nguon_id: raw?.ma_nguon_id || nguonObj?.id || null,
    ma_qd: raw?.ma_qd || "",
    ten_qd: raw?.ten_qd || "",
    ngayDangKy: raw?.created_at || raw?.ngay_tao,
    created_at: raw?.created_at,
    ngay_tao: raw?.ngay_tao,
    tenTT: statusName,
    status: statusName,
    statusColor: statusColor,
    color_code: statusColor,
    tenNguon: sourceName,
    source: sourceName,
  };
}

export const CustomerService = {
  /**
   * Danh mục Trạng thái khách hàng của công ty (KHÔNG hardcode) — fn_nv_app_danh_muc('trang_thai_kh').
   * value = id (UUID) để gửi thẳng p_trang_thai_id. Trả [] nếu công ty chưa khai báo (UI chỉ hiện "Tất cả").
   */
  getTrangThaiCatalogs: async () => {
    try {
      const list = await fetchCatalogList("trang_thai_kh");
      return list.map((item: any) => ({
        id: item.id,
        label: item.item_name || item.item_code,
        value: item.id,
        color: item.color_code || "#9CA3AF",
        code: item.item_code,
        ghiChu: item.ghi_chu || "",
      }));
    } catch (e) {
      console.log("Error getTrangThaiCatalogs:", errorMessage(e));
      return [];
    }
  },

  /** Danh mục Nguồn khách hàng của công ty — fn_nv_app_danh_muc('nguon_kh'); trống ⇒ danh sách mặc định (gửi ma_nguon_id = null) */
  getNguonCatalogs: async () => {
    try {
      const list = await fetchCatalogList("nguon_kh");
      if (list.length === 0) return DEFAULT_NGUON_CATALOG;
      return list.map((item: any) => ({
        id: item.id,
        label: item.item_name || item.item_code,
        value: item.id,
        code: item.item_code,
      }));
    } catch (e) {
      console.log("Error getNguonCatalogs:", errorMessage(e));
      return DEFAULT_NGUON_CATALOG;
    }
  },

  /**
   * Danh sách khách hàng — fn_nv_app_khach_hang_list (= fn_customer_list web: phạm vi khách ở máy chủ; trả { rows, total }).
   * Hết phiên ⇒ { authError }; lỗi khác (không quyền xem…) ném ra kèm thông báo máy chủ.
   */
  getCustomers: async ({
    search = "",
    isPersonal,
    maTtId,
    statusLabel,
    limit = 20,
    offset = 0,
  }: {
    search?: string;
    isPersonal?: boolean;
    maTtId?: string;
    /** Tên trạng thái trên pill (để resolve/fallback lọc phía client) */
    statusLabel?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    try {
      // Bộ lọc trạng thái: resolve value của pill -> UUID danh mục
      const wantStatusFilter = !!maTtId && maTtId !== "all";
      const statusUuid = wantStatusFilter ? await resolveStatusUuid(maTtId, statusLabel) : null;

      const callRpcPage = async (pOffset: number, pLimit: number) => {
        const w = pageWindow(pOffset, pLimit);
        const res = await callNv<any>("fn_nv_app_khach_hang_list", {
          p_tu_khoa: search.trim() || null,
          p_ca_nhan: typeof isPersonal === "boolean" ? isPersonal : null,
          p_trang_thai_id: statusUuid,
          p_trang: w.p_page,
          p_so_dong: w.p_size,
        });
        const { rows, total } = listResult(res);
        return { rows: rows.slice(w.skip), total };
      };

      // Không lọc trạng thái, hoặc đã có UUID để máy chủ lọc (rỗng là kết quả hợp lệ theo phạm vi quyền web)
      if (!wantStatusFilter || statusUuid) {
        const page = await callRpcPage(offset, limit);
        const data = page.rows.map(normalizeCustomerRow);
        return { data, total: page.total, hasMore: offset + data.length < page.total };
      }

      // Không resolve được UUID (pill cũ không còn trong danh mục) -> tải cửa sổ rộng rồi lọc phía client theo TÊN trạng thái
      const windowSize = Math.min(2000, Math.max(500, offset + limit * 5));
      const rawRows = (await callRpcPage(0, windowSize)).rows;
      const label = normalizeStatusText(statusLabel || maTtId);
      const filtered = rawRows.map(normalizeCustomerRow).filter((r) => !!label && normalizeStatusText(r.status) === label);
      const data = filtered.slice(offset, offset + limit);
      return { data, total: filtered.length, hasMore: offset + data.length < filtered.length };
    } catch (e: any) {
      if (isAuthError(e)) {
        return { data: [], total: 0, hasMore: false, authError: true, message: errorMessage(e) };
      }
      console.log("ERROR fn_nv_app_khach_hang_list:", errorMessage(e));
      throw e;
    }
  },

  /**
   * Ô chọn khách ở màn khác (lịch ký, phiếu tính giá, gắn hội thoại chat…) — `fn_customer_picker` như web
   * CustomerCloudService.listCustomerPicker: khách trong công ty được xem, không cần quyền màn Khách hàng, từ khoá
   * ≥ 2 ký tự (ngắn hơn ⇒ rỗng, không gọi máy chủ), ≤ 50 dòng, không phân trang. Dòng cùng dạng fn_customer_list
   * (`ten_tt`, `mau_tt`, `ten_nguon` phẳng) ⇒ chuẩn hoá bằng normalizeCustomerRow. Lỗi máy chủ ném ra.
   */
  pickCustomers: async ({ search = "", limit = 20, isPersonal }: { search?: string; limit?: number; isPersonal?: boolean } = {}) => {
    const rows = await pickCustomerRows(search, { limit, isPersonal: typeof isPersonal === "boolean" ? isPersonal : null });
    return { data: rows.map(normalizeCustomerRow) };
  },

  /**
   * Một khách theo uuid cho màn khác (form lịch ký…) — `fn_customer_get_by_ids` như web getCustomerFromCloud: khách
   * trong công ty được xem ⇒ đầy đủ; khách công ty khác nằm trên chứng từ ⇒ bản giới hạn (`limited`, CCCD che, không
   * điền vào ô nhập); ngoài cả hai ⇒ null. Lỗi máy chủ ném ra.
   */
  getCustomerById: async (idOrCode: string) => {
    const v = String(idOrCode || "").trim();
    if (!v) return null;
    // Mã KH (phiếu cũ) ⇒ tra theo mã / SĐT như web getCustomerByRef
    const id = UUID_RE.test(v) ? v : await resolveCustomerUuid(v);
    const row = id ? (await getCustomersByIds([id]))[0] : null;
    if (!row) return null;
    const n = normalizeCustomerRow(row);
    // Bản giới hạn: CCCD đã che ⇒ không đưa vào ô nhập (web fromRow: SoCMND/CCCD = null, CCCDMasked riêng)
    return row.limited === true ? { ...n, cccd: "", so_cmnd: "", cccd_masked: row.cccd ?? null } : n;
  },

  /**
   * Chi tiết khách cho màn Khách hàng › chi tiết / sửa — fn_nv_app_khach_hang_chi_tiet (= fn_customer_get web: cần quyền xem màn
   * Khách hàng, theo phạm vi; kèm `trang_thai`, `nguon`, `cty`, `creator`, `updater` lồng). Nhận cả UUID lẫn mã KH.
   * Không tồn tại / ngoài phạm vi ⇒ null. Lỗi máy chủ (không quyền xem, phiên hết hạn…) ném ra với thông báo máy chủ.
   * Khách chỉ thấy qua chứng từ ⇒ bản giới hạn `limited: true` (CCCD che, giấy tờ trống) – màn chỉ xem, không sửa / xoá.
   */
  getCustomerDetailCloud: async (idOrCode: string) => {
    const v = String(idOrCode || "").trim();
    if (!v) return null;
    const id = await resolveCustomerUuid(v);
    if (!id) return null;
    const row = await rpc<any>("fn_nv_app_khach_hang_chi_tiet", { p_id: id }, "Không tải được khách hàng");
    if (!row || typeof row !== "object") return null;
    const normalized = normalizeCustomerRow(row);
    const cty = row.cty || null;
    if (cty) normalized.tenSan = cty.ten_ct_vt || cty.ten_ct || normalized.tenSan;
    if (row.limited === true) {
      return { ...normalized, limited: true, cccd: "", so_cmnd: "", cccd_masked: row.cccd ?? null };
    }
    return normalized;
  },

  /**
   * Lưu khách hàng (tạo mới / cập nhật) — fn_nv_app_khach_hang_luu (= fn_customer_save(p_row, p_scoped = true) web màn Khách hàng:
   * quyền thêm / sửa + phạm vi, chống trùng, khoá sửa theo giao dịch, cấp mã khách, tự đặt id / công ty / người tạo, sửa).
   * Trả uuid ⇒ đọc lại dòng bằng chi tiết để trả về màn gọi. Sửa: chỉ gửi cột form app quản lý (APP_EDIT_COLUMNS).
   */
  saveCustomerCloud: async (payload: any = {}) => {
    const isPersonal = payload.isPersonal ?? payload.is_personal ?? (payload.type !== "business");
    const tenKh = String(
      payload.tenKh ?? payload.hoTen ?? payload.name ?? payload.ten_kh ?? ""
    ).trim();
    const tenCongTy = String(
      payload.tenCongTy ?? payload.company ?? payload.ten_cong_ty ?? ""
    ).trim();

    if (isPersonal && !tenKh) {
      return { status: 400, message: "Vui lòng nhập họ và tên khách hàng" };
    }
    if (!isPersonal && !tenCongTy && !tenKh) {
      return { status: 400, message: "Vui lòng nhập tên công ty / doanh nghiệp" };
    }

    const phone = String(
      payload.diDong ?? payload.dienThoai ?? payload.phone ?? payload.di_dong ?? payload.dien_thoai_ct ?? ""
    ).trim();

    if (!phone) {
      return { status: 400, message: "Vui lòng nhập số điện thoại" };
    }

    const rawTtId = String(payload.maTtId ?? payload.ma_tt_id ?? payload.statusId ?? "").trim();
    const rawNguonId = String(payload.maNguonId ?? payload.ma_nguon_id ?? payload.sourceId ?? "").trim();
    const cccdVal = String(payload.cccd ?? payload.soCMND ?? payload.so_cmnd ?? "").trim();
    const emailVal = String(payload.email ?? "").trim();
    const diaChiVal = String(payload.diaChi ?? payload.dia_chi ?? payload.thuongTru ?? payload.thuong_tru ?? "").trim();
    const isUpdate = Boolean(payload.id && UUID_RE.test(String(payload.id)));

    // Cột khách (máy chủ chỉ nhận cột trong danh sách của _ds5_customer_save; id / ma_ctdk / company_id / người tạo,
    // sửa / ngày sửa do máy chủ đặt nên không gửi)
    const input: Record<string, any> = {
      is_personal: isPersonal,
      // Khi là DN, Web yêu cầu đồng bộ ten_kh = ten_cong_ty để hiển thị và tìm kiếm
      ten_kh: isPersonal ? tenKh : (tenCongTy || tenKh),
      ten_cong_ty: !isPersonal ? (tenCongTy || tenKh) : null,
      di_dong: phone,
      dien_thoai: phone,
      di_dong2: String(payload.diDong2 ?? payload.di_dong2 ?? payload.phone2 ?? "").trim() || null,
      dien_thoai_ct: !isPersonal ? phone : null,
      email: emailVal || null,
      email2: String(payload.email2 ?? "").trim() || null,
      email_ct: !isPersonal ? emailVal || null : null,
      cccd: cccdVal || null,
      so_cmnd: cccdVal || null,
      ngay_cap: String(payload.ngayCap ?? payload.ngay_cap ?? "").trim() || null,
      noi_cap: String(payload.noiCap ?? payload.noi_cap ?? "").trim() || null,
      ngay_sinh: String(payload.ngaySinh ?? payload.ngay_sinh ?? "").trim() || null,
      thuong_tru: diaChiVal || null,
      dia_chi: diaChiVal || null,
      dia_chi_ct: !isPersonal ? diaChiVal || null : null,
      ma_so_thue_ct: !isPersonal ? String(payload.taxCode ?? payload.maSoThueCt ?? payload.ma_so_thue_ct ?? "").trim() || null : null,
      ma_so_ttncn: isPersonal ? String(payload.taxCode ?? payload.maSoTtncn ?? payload.ma_so_ttncn ?? "").trim() || null : null,
      so_tai_khoan: String(payload.soTaiKhoan ?? payload.so_tai_khoan ?? "").trim() || null,
      ten_ngan_hang: String(payload.tenNganHang ?? payload.ten_ngan_hang ?? "").trim() || null,
      nguoi_dai_dien_pl: !isPersonal ? String(payload.nguoiDaiDienPl ?? payload.nguoi_dai_dien_pl ?? "").trim() || null : null,
      chuc_vu: !isPersonal ? String(payload.chucVu ?? payload.chuc_vu ?? "").trim() || null : null,
      ndd_dien_thoai: !isPersonal ? String(payload.nddDienThoai ?? payload.ndd_dien_thoai ?? "").trim() || null : null,
      ndd_email: !isPersonal ? String(payload.nddEmail ?? payload.ndd_email ?? "").trim() || null : null,
      ndd_so_cccd: !isPersonal ? String(payload.nddSoCccd ?? payload.ndd_so_cccd ?? "").trim() || null : null,
      ma_tt_id: UUID_RE.test(rawTtId) ? rawTtId : null,
      ma_nguon_id: UUID_RE.test(rawNguonId) ? rawNguonId : null,
    };

    // Ghi chú (cột ghi_chu – app thêm 2026-10-02, web chưa dùng): chỉ ghi khi payload có trường này,
    // nơi gọi không gửi ghi chú thì giữ nguyên ghi chú đang có.
    if ("ghiChu" in payload || "ghi_chu" in payload) {
      input.ghi_chu = String(payload.ghiChu ?? payload.ghi_chu ?? "").trim() || null;
    }

    // Danh xưng (quý danh) — Web lưu ma_qd = item_code, ten_qd = item_name
    if (payload.maQd || payload.ma_qd) input.ma_qd = payload.maQd || payload.ma_qd;
    if (payload.tenQd || payload.ten_qd) input.ten_qd = payload.tenQd || payload.ten_qd;

    // Mã khách: tạo mới không gửi ⇒ máy chủ cấp theo quy tắc đánh mã của công ty (như web; trước đây app tự sinh KH-xxxxxx)
    const maSoKh = String(payload.ma_so_kh ?? payload.maSoKh ?? "").trim();
    if (!isUpdate && maSoKh) input.ma_so_kh = maSoKh;

    let pRow: Record<string, any> = input;
    if (isUpdate) {
      // Chỉ ghi các cột form app quản lý; cột chỉ nhập trên web (ngày sinh, nơi cấp, tài khoản, email phụ,
      // thường trú riêng, danh xưng…) không gửi thì máy chủ giữ nguyên, không bị ghi đè null.
      pRow = { id: String(payload.id) };
      Object.keys(input).forEach((key) => {
        if (APP_EDIT_COLUMNS.has(key) && input[key] !== undefined) pRow[key] = input[key];
      });
    }

    let savedId: string;
    try {
      savedId = String((await callNv<string>("fn_nv_app_khach_hang_luu", { p_row: pRow })) ?? "").trim();
    } catch (error: any) {
      console.log("ERROR saveCustomerCloud:", errorMessage(error));
      if (isAuthError(error)) return { status: 5000, needLogin: true, message: errorMessage(error) };
      return { status: 5000, message: errorMessage(error, "Không thể lưu thông tin khách hàng") };
    }
    if (!UUID_RE.test(savedId)) {
      return { status: 5000, message: "Không nhận được phản hồi từ máy chủ" };
    }

    // Đọc lại dòng đã lưu (mã khách, công ty do máy chủ đặt); đọc lỗi thì trả dữ liệu vừa gửi kèm id
    const fresh = await CustomerService.getCustomerDetailCloud(savedId).catch(() => null);
    return {
      status: 2000,
      data: fresh ?? normalizeCustomerRow({ ...input, ...pRow, id: savedId }),
      message: isUpdate ? "Cập nhật khách hàng thành công" : "Tạo khách hàng thành công",
    };
  },

  /**
   * Xoá khách hàng (nhận UUID hoặc mã KH) — fn_nv_app_khach_hang_xoa (= fn_customer_delete web: phạm vi + quyền xoá, chặn khi còn
   * phiếu booking / HĐ / chứng từ khác — thông báo chặn của máy chủ hiện nguyên cho người dùng).
   */
  deleteCustomer: async (idOrCode: string) => {
    let id: string | null;
    try {
      id = await resolveCustomerUuid(idOrCode);
    } catch (error: any) {
      return { status: 500, message: errorMessage(error, "Không thể xoá khách hàng") };
    }
    if (!id) {
      return { status: 400, message: "Thiếu mã khách hàng" };
    }
    try {
      await callNv("fn_nv_app_khach_hang_xoa", { p_id: id });
      return { status: 2000, message: "Xoá khách hàng thành công" };
    } catch (error: any) {
      console.log("ERROR delete customer:", errorMessage(error));
      return { status: 400, message: errorMessage(error, "Không thể xoá khách hàng") };
    }
  },

  /**
   * Giao dịch (Booking / Cọc / HĐ) của khách — fn_nv_app_khach_hang_giao_dich: phiếu theo phạm vi giao dịch web (khách không thấy ⇒ []),
   * kèm ký hiệu căn / dự án / trạng thái (thay 4 lần đọc thẳng bảng). Lỗi ném ra (màn phân biệt "lỗi tải" với "chưa có giao dịch").
   */
  getCustomerTransactions: async (customerIdOrCode: string) => {
    const customerId = await resolveCustomerUuid(customerIdOrCode);
    if (!customerId) return [];
    const rows = await callNv<any[]>("fn_nv_app_khach_hang_giao_dich", { p_khach_hang_id: customerId });
    return (Array.isArray(rows) ? rows : []).map((r) =>
      mapCustomerTransaction(r, {
        products: { [r?.san_pham_id]: { ky_hieu: r?.ky_hieu, ma_sp: r?.ma_sp } },
        projects: { [r?.project_id]: { ten_da: r?.ten_da } },
        statuses: { [r?.trang_thai_id]: { item_name: r?.ten_tt, color_code: r?.mau_tt } },
      })
    );
  },

  // Lịch hẹn (tính năng ẩn) — chưa có bảng trên web
  getLichHenByMaKH: async (_payload: any = {}) => ({ data: [] }),

  /** Giao dịch của khách; error=true khi tải lỗi (khác với danh sách rỗng). */
  getHopDong: async (payload: any = {}) => {
    const id = payload?.MaKH || payload?.khach_hang_id;
    if (!id) return { data: [], error: false };
    try {
      return { data: await CustomerService.getCustomerTransactions(id), error: false };
    } catch {
      return { data: [], error: true };
    }
  },
};

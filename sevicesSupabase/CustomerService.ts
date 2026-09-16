import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosApi from "./axiosApi";
import axiosApiSupabase from "./axiosApiSupabase";
import {
  getTenantId,
  getEmployeeId,
  getUserCompanyId,
  getUserCompanyIds,
  getValidSupabaseJwt,
  getTypeAccount,
  getMaNv,
} from "./cloudTenant";

const escapeIlike = (value: string) => value.replace(/[%,()]/g, "");

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Danh mục mặc định khi tenant chưa khai báo (dùng để UI không rỗng, KHÔNG phải UUID thật) */
const DEFAULT_STATUS_CATALOG = [
  { id: "potential", label: "Tiềm năng", value: "potential", color: "#F59E0B", code: "potential" },
  { id: "active", label: "Đang giao dịch", value: "active", color: "#10B981", code: "active" },
  { id: "completed", label: "Đã chốt cọc/HĐ", value: "completed", color: "#3B82F6", code: "completed" },
  { id: "inactive", label: "Không hoạt động", value: "inactive", color: "#9CA3AF", code: "inactive" },
];

const DEFAULT_NGUON_CATALOG = [
  { id: "facebook", label: "Facebook / Ads", value: "facebook", code: "facebook" },
  { id: "website", label: "Website", value: "website", code: "website" },
  { id: "referral", label: "Giới thiệu", value: "referral", code: "referral" },
  { id: "hotline", label: "Hotline / Trực tiếp", value: "hotline", code: "hotline" },
  { id: "self", label: "Tự tìm kiếm", value: "self", code: "self" },
];

/**
 * Đọc danh mục từ cloud_catalogs theo tenant.
 * Thử cột tenant `ma_ctdk_uid` trước, nếu lỗi/không có dữ liệu thì fallback sang `ma_ctdk`.
 */
const fetchCatalogList = async (catalogType: string, selectCols: string) => {
  const tenantId = await getTenantId();
  for (const tenantCol of ["ma_ctdk_uid", "ma_ctdk"]) {
    try {
      const params: Record<string, string> = {
        select: selectCols,
        catalog_type: `eq.${catalogType}`,
        order: "item_name.asc",
      };
      if (tenantId && UUID_RE.test(tenantId)) params[tenantCol] = `eq.${tenantId}`;
      const res = await axiosApiSupabase.get("rest/v1/cloud_catalogs", { params });
      const list = Array.isArray(res.data) ? res.data : [];
      if (list.length > 0) return list;
    } catch (e) {
      // thử cột tenant kế tiếp
    }
  }
  return [] as any[];
};

/** Lấy 1 danh mục theo id (để bù tên/màu khi join không có) */
const fetchCatalogById = async (catalogId?: string | null) => {
  if (!catalogId || !UUID_RE.test(String(catalogId))) return null;
  try {
    const res = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
      params: { id: `eq.${catalogId}`, select: "id,item_code,item_name,color_code", limit: "1" },
    });
    return Array.isArray(res.data) ? res.data[0] : null;
  } catch {
    return null;
  }
};

/**
 * Resolve UUID khách hàng từ id (UUID) hoặc mã KH (ma_so_kh, vd KH-893482).
 * Màn danh sách/home có thể truyền mã KH — mọi query cột uuid phải dùng UUID.
 * Trả về UUID hoặc null.
 */
const resolveCustomerUuid = async (idOrCode: string): Promise<string | null> => {
  const v = String(idOrCode || "").trim();
  if (!v) return null;
  if (UUID_RE.test(v)) return v;
  try {
    const tenantId = await getTenantId();
    const params: Record<string, string> = {
      ma_so_kh: `eq.${v}`,
      select: "id",
      limit: "1",
    };
    if (tenantId && UUID_RE.test(tenantId)) params.ma_ctdk = `eq.${tenantId}`;
    const res = await axiosApiSupabase.get("rest/v1/cloud_customers", { params });
    const row = Array.isArray(res.data) ? res.data[0] : null;
    if (row?.id && UUID_RE.test(String(row.id))) return String(row.id);
  } catch (e) {
    console.log("resolveCustomerUuid error:", e);
  }
  return null;
};

/**
 * Xác định p_employee_id cho RPC fn_customer_list (chuẩn web):
 * - Tài khoản đại lý (AGENCY): null.
 * - SYSTEM: claim employee_id trong JWT; nếu thiếu thì tra dm_employees
 *   theo ma_nv (giống web tra theo ma_ctdk + ma_nv, RLS JWT đã giới hạn tenant).
 * Trả về UUID hoặc null.
 */
const resolveRpcEmployeeId = async (tenantId: string): Promise<string | null> => {
  try {
    const type = await getTypeAccount();
    if (type === "AGENCY") return null;
  } catch {}
  const empId = await getEmployeeId();
  if (empId && UUID_RE.test(empId)) return empId;
  // Fallback: tra dm_employees theo ma_nv
  try {
    const maNv = await getMaNv();
    if (!maNv) return null;
    const res = await axiosApiSupabase.get("rest/v1/dm_employees", {
      params: { ma_nv: `eq.${maNv}`, select: "id,company_id", limit: "1" },
    });
    const emp = Array.isArray(res.data) ? res.data[0] : null;
    if (emp?.id && UUID_RE.test(emp.id)) {
      try {
        await AsyncStorage.setItem("@employee_id", emp.id);
      } catch {}
      return emp.id;
    }
  } catch (e) {
    console.log("resolveRpcEmployeeId dm_employees lookup error:", e);
  }
  return null;
};

/**
 * Xác định company_id HỢP L trong dm_companies cho tài khoản đang đăng nhập.
 * u tiên: company_id của nhân viên (dm_employees) -> JWT/storage -> công ty đầu tiên của tenant.
 * Tuyệt đối không trả về tenant id nếu tenant không phải một bản ghi dm_companies,
 * vì sẽ làm hỏng FK và khiến RPC fn_customer_list loại bản ghi.
 */
const resolveCompanyId = async (): Promise<string | null> => {
  const tenantId = await getTenantId();
  const candidates: string[] = [];

  const jwtCompanyId = await getUserCompanyId();
  if (jwtCompanyId && UUID_RE.test(jwtCompanyId)) candidates.push(jwtCompanyId);

  const employeeId = await getEmployeeId();
  if (employeeId && UUID_RE.test(employeeId)) {
    try {
      const res = await axiosApiSupabase.get("rest/v1/dm_employees", {
        params: { id: `eq.${employeeId}`, select: "company_id,company_ids", limit: "1" },
      });
      const emp = Array.isArray(res.data) ? res.data[0] : null;
      if (emp?.company_id && UUID_RE.test(emp.company_id)) candidates.unshift(emp.company_id);
      if (Array.isArray(emp?.company_ids)) {
        emp.company_ids.forEach((c: any) => {
          if (typeof c === "string" && UUID_RE.test(c)) candidates.push(c);
        });
      }
    } catch (e) {
      console.log("resolveCompanyId dm_employees error:", e);
    }
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      // chỉ kiểm tra tồn tại theo id (ứng viên đã đến từ JWT/nhân viên nên đúng tenant)
      const res = await axiosApiSupabase.get("rest/v1/dm_companies", {
        params: { id: `eq.${candidate}`, select: "id", limit: "1" },
      });
      if (Array.isArray(res.data) && res.data.length > 0) return candidate;
    } catch (e) {
      // thử ứng viên kế tiếp
    }
  }

  // Cuối cùng: lấy công ty đầu tiên của tenant (thử cả 2 tên cột tenant)
  if (tenantId && UUID_RE.test(tenantId)) {
    for (const tenantCol of ["ma_ctdk", "ma_ctdk_uid"]) {
      try {
        const res = await axiosApiSupabase.get("rest/v1/dm_companies", {
          params: { [tenantCol]: `eq.${tenantId}`, select: "id", limit: "1" },
        });
        const comp = Array.isArray(res.data) ? res.data[0] : null;
        if (comp?.id && UUID_RE.test(comp.id)) return comp.id;
      } catch (e) {
        // thử cột tenant kế tiếp
      }
    }
  }

  return null;
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
  
  // Status & color resolving
  const ttObj = raw?.trang_thai || raw?.tt || {};
  const statusName = ttObj?.item_name || raw?.ten_tt || raw?.status || "Tiềm năng";
  const statusColor = ttObj?.color_code || ttObj?.color_web || raw?.color_code || raw?.color_web || "#F59E0B";

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
  /** Lấy danh mục Trạng thái khách hàng từ cloud_catalogs */
  getTrangThaiCatalogs: async () => {
    try {
      const list = await fetchCatalogList("trang_thai_kh", "id,item_code,item_name,color_code");
      if (list.length === 0) return DEFAULT_STATUS_CATALOG;
      return list.map((item: any) => ({
        id: item.id,
        label: item.item_name || item.item_code,
        value: item.id,
        color: item.color_code || "#F59E0B",
        code: item.item_code,
      }));
    } catch (e) {
      console.log("Error getTrangThaiCatalogs:", e);
      return DEFAULT_STATUS_CATALOG;
    }
  },

  /** Lấy danh mục Nguồn khách hàng từ cloud_catalogs */
  getNguonCatalogs: async () => {
    try {
      const list = await fetchCatalogList("nguon_kh", "id,item_code,item_name");
      if (list.length === 0) return DEFAULT_NGUON_CATALOG;
      return list.map((item: any) => ({
        id: item.id,
        label: item.item_name || item.item_code,
        value: item.id,
        code: item.item_code,
      }));
    } catch (e) {
      console.log("Error getNguonCatalogs:", e);
      return DEFAULT_NGUON_CATALOG;
    }
  },

  /** Lấy danh mục Danh xưng từ cloud_catalogs */
  getQuyDanhCatalogs: async () => {
    try {
      const list = await fetchCatalogList("quy_danh_kh", "id,item_code,item_name");
      if (list.length === 0) {
        return [
          { id: "1", label: "Anh", value: "Anh", code: "1" },
          { id: "2", label: "Chị", value: "Chị", code: "2" },
          { id: "3", label: "Ông", value: "Ông", code: "3" },
          { id: "4", label: "Bà", value: "Bà", code: "4" },
        ];
      }
      return list.map((item: any) => ({
        id: item.id,
        label: item.item_name || item.item_code,
        value: item.item_name || item.item_code,
        code: item.item_code || item.item_name,
      }));
    } catch (e) {
      return [
        { id: "1", label: "Anh", value: "Anh", code: "1" },
        { id: "2", label: "Chị", value: "Chị", code: "2" },
        { id: "3", label: "Ông", value: "Ông", code: "3" },
        { id: "4", label: "Bà", value: "Bà", code: "4" },
      ];
    }
  },

  /** Kiểm tra khách hàng trùng theo SĐT, CCCD hoặc Email */
  checkDuplicateCustomer: async ({ phone, cccd, email }: { phone?: string; cccd?: string; email?: string }) => {
    const tenantId = await getTenantId();
    if (!tenantId || !UUID_RE.test(tenantId) || (!phone && !cccd && !email)) return null;

    try {
      const orConditions: string[] = [];
      const cleanPhone = phone?.trim();
      const cleanCccd = cccd?.trim();
      const cleanEmail = email?.trim().toLowerCase();

      if (cleanPhone) {
        orConditions.push(`dien_thoai.eq.${cleanPhone}`);
        orConditions.push(`di_dong.eq.${cleanPhone}`);
        orConditions.push(`di_dong2.eq.${cleanPhone}`);
        orConditions.push(`dien_thoai_ct.eq.${cleanPhone}`);
      }
      if (cleanCccd) {
        orConditions.push(`cccd.eq.${cleanCccd}`);
        orConditions.push(`so_cmnd.eq.${cleanCccd}`);
      }
      if (cleanEmail) {
        orConditions.push(`email.eq.${cleanEmail}`);
        orConditions.push(`email2.eq.${cleanEmail}`);
        orConditions.push(`email_ct.eq.${cleanEmail}`);
      }

      if (orConditions.length === 0) return null;

      const params: Record<string, string> = {
        select:
          "id,ma_so_kh,ten_kh,ten_cong_ty,is_personal,di_dong,dien_thoai,email,cccd,dia_chi,ma_tt_id,ma_nguon_id,created_at",
        ma_ctdk: `eq.${tenantId}`,
        or: `(${orConditions.join(",")})`,
        limit: "1",
      };

      const res = await axiosApiSupabase.get("rest/v1/cloud_customers", { params });
      const rows = Array.isArray(res.data) ? res.data : [];
      if (rows.length > 0) {
        return normalizeCustomerRow(rows[0]);
      }
      return null;
    } catch (error) {
      console.log("ERROR checkDuplicateCustomer:", error);
      return null;
    }
  },

  /**
   * Lấy danh sách khách hàng:
   * Gọi RPC `public.fn_customer_list` (chuẩn Web) — không fallback trực tiếp bảng.
   * Tham số: p_ma_ctdk, p_employee_id, p_company_ids, p_is_personal, p_ma_tt_id, p_input_search, p_offset, p_limit
   * Trả về: rows + total_count, đã JOIN sẵn cty, creator, updater, trang_thai (có color_code)
   */
  getCustomers: async ({
    search = "",
    isPersonal,
    maTtId,
    limit = 20,
    offset = 0,
  }: {
    search?: string;
    isPersonal?: boolean;
    maTtId?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Customer] chưa có cloud_jwt hợp lệ, bỏ qua gọi cloud_customers");
      return {
        data: [],
        total: 0,
        hasMore: false,
        authError: true,
        message: "Chưa đăng nhập hoặc phiên đã hết hạn. Vui lòng đăng nhập lại.",
      };
    }
    const tenantId = await getTenantId();
    if (!tenantId || !UUID_RE.test(tenantId)) {
      console.log("[Customer] thiếu tenant UUID hợp lệ, yêu cầu đăng nhập lại");
      return {
        data: [],
        total: 0,
        hasMore: false,
        authError: true,
        message: "Không xác định được công ty (tenant). Vui lòng đăng nhập lại.",
      };
    }

    // Gọi RPC fn_customer_list (chuẩn Web) — bắt buộc để phân quyền đúng
    try {
      const rpcTenantId = await getTenantId();
      const employeeId = await resolveRpcEmployeeId(rpcTenantId);
      const companyIds = await getUserCompanyIds();

      const rpcPayload: Record<string, any> = {
        p_ma_ctdk: rpcTenantId,
        p_employee_id: employeeId,
        p_company_ids: companyIds || null,
        p_is_personal: typeof isPersonal === "boolean" ? isPersonal : null,
        p_ma_tt_id: maTtId && maTtId !== "all" && UUID_RE.test(maTtId) ? maTtId : null,
        p_input_search: search.trim() || null,
        p_offset: offset,
        p_limit: limit,
      };

      const resRpc = await axiosApiSupabase.post("rest/v1/rpc/fn_customer_list", rpcPayload);
      if (Array.isArray(resRpc.data) && resRpc.data.length > 0) {
        const rows = resRpc.data;
        const total = rows[0]?.total_count != null ? Number(rows[0].total_count) : rows.length;
        const data = rows.map(normalizeCustomerRow);
        return { data, total, hasMore: offset + data.length < total };
      }

      // RPC trả rỗng là kết quả hợp lệ và phải tôn trọng phạm vi quyền Web.
      return { data: [], total: 0, hasMore: false };
    } catch (rpcError: any) {
      console.log("ERROR fn_customer_list:", rpcError?.response?.data || rpcError);
      return { data: [], total: 0, hasMore: false };
    }
  },

  /**
   * Lấy chi tiết khách hàng từ Supabase. Nhận cả UUID `id` lẫn mã KH `ma_so_kh`
   * (vd KH-893482 — màn home/danh sách có thể truyền mã).
   * Lấy `select=*` trước (rich join ma_nguon_id/ma_tt_id không có FK trong
   * schema cache nên luôn 400 PGRST200), rồi bù tên/màu bằng truy vấn riêng.
   */
  getCustomerDetailCloud: async (idOrCode: string) => {
    const v = String(idOrCode || "").trim();
    if (!v) return null;
    const isUuid = UUID_RE.test(v);

    let row: any = null;
    try {
      const params: Record<string, string> = { select: "*", limit: "1" };
      if (isUuid) {
        params.id = `eq.${v}`;
      } else {
        params.ma_so_kh = `eq.${v}`;
        const tenantId = await getTenantId();
        if (tenantId && UUID_RE.test(tenantId)) params.ma_ctdk = `eq.${tenantId}`;
      }
      const res = await axiosApiSupabase.get("rest/v1/cloud_customers", { params });
      row = Array.isArray(res.data) ? res.data[0] : null;
    } catch (e) {
      console.log("ERROR getCustomerDetailCloud:", e);
      return null;
    }

    if (!row) return null;

    const normalized = normalizeCustomerRow(row);

    // Bù trạng thái nếu join không trả về
    if (!row.trang_thai && normalized.ma_tt_id) {
      const st = await fetchCatalogById(normalized.ma_tt_id);
      if (st) {
        normalized.tenTT = st.item_name || st.item_code;
        normalized.status = normalized.tenTT;
        normalized.color_code = st.color_code || normalized.color_code;
        normalized.statusColor = st.color_code || normalized.statusColor;
      }
    }

    // Bù nguồn nếu join không trả về
    if (!row.nguon && normalized.ma_nguon_id) {
      const src = await fetchCatalogById(normalized.ma_nguon_id);
      if (src) {
        normalized.tenNguon = src.item_name || src.item_code;
        normalized.source = normalized.tenNguon;
      }
    }

    // Bù tên công ty nếu join không trả về
    if (!row.cty && normalized.company_id && UUID_RE.test(String(normalized.company_id))) {
      try {
        const res = await axiosApiSupabase.get("rest/v1/dm_companies", {
          params: { id: `eq.${normalized.company_id}`, select: "id,ten_ct,ten_ct_vt,is_san", limit: "1" },
        });
        const comp = Array.isArray(res.data) ? res.data[0] : null;
        if (comp) {
          normalized.cty = comp;
          normalized.tenSan = comp.ten_ct_vt || comp.ten_ct || "";
        }
      } catch (e) {
        // bỏ qua
      }
    }

    return normalized;
  },

  /** Lưu khách hàng (Tạo mới hoặc Cập nhật) vào cloud_customers — upsert onConflict: id */
  saveCustomerCloud: async (payload: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    const tenantId = await getTenantId();
    const employeeId = await getEmployeeId();

    if (!validJwt || !tenantId || !UUID_RE.test(tenantId)) {
      return {
        status: 5000,
        needLogin: true,
        message: "Chưa đăng nhập hoặc phiên đã hết hạn. Vui lòng đăng nhập lại tài khoản (giống tài khoản web).",
      };
    }

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
    const nowIso = new Date().toISOString();

    // company_id: Gán theo công ty THẬT của nhân viên (không dùng tenant id)
    // để RPC fn_customer_list không loại bản ghi và không lỗi khóa ngoại.
    const isUpdate = Boolean(payload.id && UUID_RE.test(String(payload.id)));
    let assignedCompanyId: string | null =
      payload.company_id && UUID_RE.test(String(payload.company_id))
        ? String(payload.company_id)
        : null;

    if (!isUpdate && !assignedCompanyId) {
      assignedCompanyId = await resolveCompanyId();
    }

    if (!isUpdate && !assignedCompanyId) {
      return {
        status: 400,
        message:
          "Không xác định được công ty/chi nhánh hợp lệ của tài khoản. Vui lòng đăng nhập lại.",
      };
    }

    const input: Record<string, any> = {
      ma_ctdk: tenantId,
      ...(assignedCompanyId ? { company_id: assignedCompanyId } : {}),
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
      ngay_sua: nowIso,
    };

    if (employeeId && UUID_RE.test(employeeId)) {
      if (!payload.id) input.created_by_id = employeeId;
      input.updated_by_id = employeeId;
    }

    // Danh xưng (quý danh) — Web lưu ma_qd = item_code, ten_qd = item_name
    if (payload.maQd || payload.ma_qd) input.ma_qd = payload.maQd || payload.ma_qd;
    if (payload.tenQd || payload.ten_qd) input.ten_qd = payload.tenQd || payload.ten_qd;

    // Tự sinh mã khách nếu tạo mới chưa có mã (theo quy tắc KH-{6 số cuối timestamp})
    if (!payload.id && !payload.ma_so_kh && !payload.maSoKh) {
      input.ma_so_kh = `KH-${Date.now().toString().slice(-6)}`;
    }

    if (payload.id && UUID_RE.test(String(payload.id))) {
      input.id = String(payload.id);
    }

    try {
      let row: any;

      if (isUpdate) {
        const customerId = String(payload.id);
        const existing = await CustomerService.getCustomerDetailCloud(customerId);
        if (!existing) {
          return { status: 404, message: "Không tìm thấy khách hàng để cập nhật" };
        }

        // PATCH: giữ nguyên các trường hệ thống, chỉ cập nhật trường Mobile cho phép
        const updateInput: Record<string, any> = {
          ...input,
          ma_ctdk: existing.ma_ctdk || tenantId,
          ma_so_kh: existing.ma_so_kh,
          company_id: existing.company_id,
        };
        delete updateInput.id;
        delete updateInput.created_by_id;
        delete updateInput.created_at;
        delete updateInput.updated_at;
        Object.keys(updateInput).forEach((key) => {
          if (updateInput[key] === undefined) delete updateInput[key];
        });

        const res = await axiosApiSupabase.patch(
          "rest/v1/cloud_customers",
          updateInput,
          {
            params: { id: `eq.${customerId}`, ma_ctdk: `eq.${tenantId}` },
            headers: { Prefer: "return=representation" },
          }
        );
        row = Array.isArray(res.data) ? res.data[0] : res.data;
      } else {
        const res = await axiosApiSupabase.post("rest/v1/cloud_customers", input, {
          headers: { Prefer: "return=representation" },
        });
        row = Array.isArray(res.data) ? res.data[0] : res.data;
      }

      if (!row?.id) {
        return { status: 5000, message: "Không nhận được phản hồi từ máy chủ" };
      }

      return {
        status: 2000,
        data: normalizeCustomerRow(row),
        message: payload.id ? "Cập nhật khách hàng thành công" : "Tạo khách hàng thành công",
      };
    } catch (error: any) {
      console.log("ERROR saveCustomerCloud:", error?.response?.data || error);
      return {
        status: 5000,
        message: error?.response?.data?.message || "Không thể lưu thông tin khách hàng",
      };
    }
  },

  /** Alias cho addCustomerCloud */
  addCustomerCloud: async (payload: any = {}) => {
    return CustomerService.saveCustomerCloud(payload);
  },

  /** Xoá khách hàng (nhận UUID hoặc mã KH — kiểm tra giao dịch trước, hard delete) */
  deleteCustomer: async (idOrCode: string) => {
    const tenantId = await getTenantId();
    const id = await resolveCustomerUuid(idOrCode);
    if (!id) {
      return { status: 400, message: "Thiếu mã khách hàng" };
    }

    try {
      // 1. Kiểm tra xem khách hàng có giao dịch phiếu giữ chỗ / cọc / HĐ không
      const pgcRes = await axiosApiSupabase.get("rest/v1/cloud_pgc_phieu_giucho", {
        params: {
          khach_hang_id: `eq.${id}`,
          select: "id,so_phieu_gc,giai_doan",
          limit: "1",
        },
      });
      if (Array.isArray(pgcRes.data) && pgcRes.data.length > 0) {
        return {
          status: 400,
          message: "Khách hàng đã có giao dịch (giữ chỗ/đặt cọc/hợp đồng), không thể xoá!",
        };
      }

      const bookingRes = await axiosApiSupabase.get("rest/v1/cloud_bookings", {
        params: {
          khach_hang_id: `eq.${id}`,
          select: "id",
          limit: "1",
        },
      });
      if (Array.isArray(bookingRes.data) && bookingRes.data.length > 0) {
        return {
          status: 400,
          message: "Khách hàng đã có phiếu booking, không thể xoá!",
        };
      }

      // 2. Xóa cứng
      const params: Record<string, string> = { id: `eq.${id}` };
      if (tenantId && UUID_RE.test(tenantId)) {
        params.ma_ctdk = `eq.${tenantId}`;
      }

      await axiosApiSupabase.delete("rest/v1/cloud_customers", { params });
      return { status: 2000, message: "Xoá khách hàng thành công" };
    } catch (error) {
      console.log("ERROR delete customer (cloud):", error);
      return { status: 500, message: "Không thể xoá khách hàng" };
    }
  },

  /** Lấy danh sách giao dịch (Booking / Cọc / HĐ) của khách từ cloud_pgc_phieu_giucho */
  getCustomerTransactions: async (customerId: string) => {
    if (!customerId) return [];
    try {
      const res = await axiosApiSupabase.get("rest/v1/cloud_pgc_phieu_giucho", {
        params: {
          khach_hang_id: `eq.${customerId}`,
          select:
            "id,so_phieu_gc,giai_doan,tong_gia_tri,tien_giu_cho,da_thu,created_at,sp:bds_products!san_pham_id(id,ma_sp,ky_hieu),da:da_projects!project_id(id,ten_da),tt:cloud_catalogs!trang_thai_id(id,item_name,color_code)",
          order: "created_at.desc",
          limit: "50",
        },
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      return rows.map((r: any) => ({
        id: r.id,
        soPhieu: r.so_phieu_gc || "---",
        giaiDoan: r.giai_doan || "GIUCHO",
        tongGia: Number(r.tong_gia_tri || 0),
        tienGiuCho: Number(r.tien_giu_cho || 0),
        daThu: Number(r.da_thu || 0),
        tenDA: r.da?.ten_da || "Dự án",
        maSP: r.sp?.ma_sp || r.sp?.ky_hieu || "Sản phẩm",
        status: r.tt?.item_name || r.giai_doan || "---",
        statusColor: r.tt?.color_code || "#3B82F6",
        createdAt: r.created_at,
      }));
    } catch (e) {
      console.log("ERROR getCustomerTransactions:", e);
      return [];
    }
  },

  /** Lấy lịch sử làm việc / nhật ký chăm sóc (nhận UUID hoặc mã KH) */
  getCustomerActivities: async (customerId: string) => {
    const uuid = await resolveCustomerUuid(customerId);
    if (!uuid) return [];
    try {
      const res = await axiosApiSupabase.get("rest/v1/cloud_customer_activities", {
        params: {
          khach_hang_id: `eq.${uuid}`,
          select: "*",
          order: "created_at.desc",
          limit: "50",
        },
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      return rows.map((r: any) => ({
        id: r.id,
        loai: r.loai || "call",
        tieuDe: r.tieu_de || r.title || "Chăm sóc khách hàng",
        noiDung: r.noi_dung || r.content || "",
        trangThai: r.trang_thai || "hoan_thanh",
        nguoiThucHien: r.nguoi_thuc_hien || "Nhân viên",
        thoiGian: r.thoi_gian || r.created_at,
      }));
    } catch (e) {
      console.log("ERROR getCustomerActivities:", e);
      return [];
    }
  },

  /** Thêm nhật ký chăm sóc khách hàng */
  addCustomerActivity: async (payload: {
    customerId: string;
    content: string;
    title?: string;
    loai?: "call" | "meeting" | "quote" | "email" | "note";
  }) => {
    const tenantId = await getTenantId();
    const employeeId = await getEmployeeId();
    const uuid = await resolveCustomerUuid(payload.customerId);
    if (!uuid) {
      return { status: 400, message: "Không xác định được khách hàng" };
    }
    try {
      const body: Record<string, any> = {
        khach_hang_id: uuid,
        noi_dung: payload.content,
        tieu_de: payload.title || "Chăm sóc khách hàng",
        loai: payload.loai || "call",
        trang_thai: "hoan_thanh",
        thoi_gian: new Date().toISOString(),
      };
      if (tenantId && UUID_RE.test(tenantId)) {
        body.ma_ctdk = tenantId;
      }
      if (employeeId && UUID_RE.test(employeeId)) {
        body.nguoi_thuc_hien = employeeId;
      }
      const res = await axiosApiSupabase.post("rest/v1/cloud_customer_activities", body);
      return { status: 2000, data: res.data, message: "Thêm nhật ký thành công" };
    } catch (e) {
      console.log("ERROR addCustomerActivity:", e);
      return { status: 5000, message: "Không thể thêm nhật ký" };
    }
  },

  // Supabase-first fallback implementations (bỏ toàn bộ gọi API .NET cũ)
  getCustomer: async (payload: any = {}) => {
    const id = payload?.MaKH || payload?.id;
    return await CustomerService.getCustomerDetailCloud(id);
  },

  addCustomer: async (payload: any = {}) => {
    return await CustomerService.saveCustomerCloud(payload);
  },

  delete: async (payload: { MaKH: (string | number)[] }) => {
    const list = Array.isArray(payload?.MaKH) ? payload.MaKH : [];
    if (list.length === 0) return { status: 400, message: "Không có mã khách hàng" };
    return await CustomerService.deleteCustomer(String(list[0]));
  },

  getNguonKH: async () => {
    return await CustomerService.getNguonCatalogs();
  },

  getNhomKH: async () => {
    return [];
  },

  getTrangThaiKH: async () => {
    return await CustomerService.getTrangThaiCatalogs();
  },

  getGhiChunByMaKH: async (payload: any = {}) => {
    const id = payload?.MaKH || payload?.id;
    if (!id) return { data: [] };
    const activities = await CustomerService.getCustomerActivities(id);
    return { data: activities };
  },

  addGhiChu: async (payload: any = {}) => {
    return await CustomerService.addCustomerActivity({
      customerId: payload?.MaKH || payload?.customerId,
      content: payload?.DienGiai || payload?.content || "",
      title: payload?.TieuDe || "Nhật ký chăm sóc",
    });
  },

  getLichHenByMaKH: async (_payload: any = {}) => {
    // Tạm thời trả về rỗng do bảng lịch hẹn web chưa kích hoạt
    return { data: [] };
  },

  getLichHen: async (_payload: any = {}) => {
    return { data: [] };
  },

  addLichHen: async (_payload: any = {}) => {
    return { status: 2000, message: "Tính năng đang được phát triển" };
  },

  getHopDong: async (payload: any = {}) => {
    const id = payload?.MaKH || payload?.khach_hang_id;
    if (!id) return { data: [] };
    const list = await CustomerService.getCustomerTransactions(id);
    return { data: list };
  },

  getAllContracts: async (payload: any = {}) => {
    const id = payload?.MaKH || payload?.khach_hang_id;
    if (!id) return { data: [] };
    const list = await CustomerService.getCustomerTransactions(id);
    return { data: list };
  },

  getQRCode: async (payload: any) => {
    return await axiosApi
      .post("https://api.vietqr.io/v2/generate", payload)
      .then((res) => res.data);
  },
};

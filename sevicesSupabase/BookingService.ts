import axiosApi from "./axiosApi";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosApiSupabase from "./axiosApiSupabase";
import {
  getCompanyCode,
  getCompanyId,
  getEmployeeId,
  getValidSupabaseJwt,
} from "./cloudTenant";
import { BookingSalesConfig, isLowRiseProduct, mapPriceListItem, sortPriceLists } from "../lib/bookingPrice";

/** Ngày dương lịch theo giờ máy (VN) dạng YYYY-MM-DD — không dùng toISOString (UTC lệch ngày 0h–7h). */
export const localYmd = (d: Date = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Chọn cài đặt bán hàng hiệu lực — giống web SalesSettingsService.resolve:
 * ap_dung khác false, tu_ngay <= ngày <= den_ngay; ưu tiên dòng của dự án, sau đó dòng chung (ma_da null).
 */
export const pickSalesSetting = (rows: any[], projectId: string | null | undefined, day: string) => {
  const valid = (rows || []).filter(
    (r: any) =>
      r?.ap_dung !== false &&
      (!r?.tu_ngay || r.tu_ngay <= day) &&
      (!r?.den_ngay || r.den_ngay >= day)
  );
  return (
    (projectId && valid.find((r: any) => r?.ma_da === projectId)) ||
    valid.find((r: any) => !r?.ma_da) ||
    null
  );
};

/** Lock căn — theo web ProductLockService.ts */
/**
 * Tháng dùng cho số phiếu lock KyHieu/YYYY/MM/STT, tính theo giờ Việt Nam (UTC+7) như web
 * (ProductLockService.nextLockVoucherNo: new Date(yyyy, m, 1) theo giờ máy VN).
 * fromIso = 00:00 ngày 1 giờ VN dưới dạng UTC – mốc đếm STT trong tháng.
 */
export const lockVoucherMonth = (now: Date = new Date()) => {
  const VN_OFFSET_MS = 7 * 3600 * 1000;
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const yyyy = vn.getUTCFullYear();
  const month = vn.getUTCMonth();
  return {
    yyyy,
    mm: String(month + 1).padStart(2, "0"),
    fromIso: new Date(Date.UTC(yyyy, month, 1) - VN_OFFSET_MS).toISOString(),
  };
};

const LOCK_DOC_TYPE = "LOCK";
const LOCK_STATE = {
  ACTIVE: "LOCKED",
  EXPIRED: "EXPIRED",
  RELEASED: "RELEASED",
} as const;
const DEFAULT_LOCK_MINUTES = 30;

/** uuid dự án: đã là uuid thì dùng luôn, không thì tra da_projects theo ma_da_code (web resolveProjectId). */
async function resolveProjectUid(maDA: any): Promise<string | null> {
  const v = String(maDA ?? "").trim();
  if (!v) return null;
  if (UUID_RE.test(v)) return v;
  try {
    const r = await axiosApiSupabase.get("rest/v1/da_projects", {
      params: { select: "id", ma_da_code: `eq.${v}`, limit: "1" },
    });
    const rows = Array.isArray(r.data) ? r.data : [];
    return rows[0]?.id || null;
  } catch {
    return null;
  }
}

/**
 * Resolve thời gian lock (phút) theo web SalesSettingsService.resolve:
 * bảng cloud_sales_settings, tenant = ma_ctdk (uuid), dự án = ma_da (uuid,
 * NULL = áp dụng chung). Ưu tiên dòng riêng của dự án, rồi dòng chung.
 * Điều kiện hiệu lực: ap_dung=true và tu_ngay <= today <= den_ngay.
 * Không có → mặc định 30 phút.
 */
async function resolveLockMinutes(maDA?: any): Promise<number> {
  try {
    const companyId = await getCompanyId();
    if (!companyId || !UUID_RE.test(companyId)) return DEFAULT_LOCK_MINUTES;

    const params: Record<string, string> = {
      select: "id,ma_da,tu_ngay,den_ngay,ap_dung,thoi_gian_lock",
      ma_ctdk: `eq.${companyId}`,
      order: "created_at.desc",
      limit: "50",
    };
    if (maDA && UUID_RE.test(String(maDA))) {
      params.or = `(ma_da.eq.${maDA},ma_da.is.null)`;
    }

    const res = await axiosApiSupabase.get("rest/v1/cloud_sales_settings", {
      params,
    });
    const rows = Array.isArray(res.data) ? res.data : [];

    const today = new Date().toISOString().slice(0, 10);
    const inRange = (r: any) =>
      r?.ap_dung !== false &&
      (!r?.tu_ngay || r.tu_ngay <= today) &&
      (!r?.den_ngay || r.den_ngay >= today);
    const valid = rows.filter(inRange);

    const specific =
      maDA && UUID_RE.test(String(maDA))
        ? valid.find((r: any) => r?.ma_da === maDA)
        : null;
    const global = valid.find((r: any) => !r?.ma_da);
    const setting = specific || global || null;

    const m = Number(setting?.thoi_gian_lock);
    if (Number.isFinite(m) && m > 0) return m;
  } catch (e) {
    console.log("ERROR resolveLockMinutes (cloud_sales_settings):", e);
  }
  return DEFAULT_LOCK_MINUTES;
}

const LOCK_SELECT = [
  "*",
  "da:da_projects!ma_da_id(id,ten_da,ma_da_code)",
  "sp:bds_products!ma_sp_id(id,ma_sp,ky_hieu)",
  "san:dm_companies!ma_san_id(id,ma_dl,ten_ct,ten_ct_vt)",
].join(",");

function secondsLeft(iso?: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

function normalizeLock(r: any, index = 0) {
  const conLai = secondsLeft(r?.het_han_luc);
  const active = r?.state === LOCK_STATE.ACTIVE && conLai > 0;
  // Tổng thời gian lock (phút) = het_han - ngay_giu_cho, mặc định 30
  let lockMinutes = DEFAULT_LOCK_MINUTES;
  try {
    const start = new Date(r?.ngay_giu_cho).getTime();
    const end = new Date(r?.het_han_luc).getTime();
    if (start > 0 && end > start) {
      lockMinutes = Math.max(1, Math.round((end - start) / 60000));
    }
  } catch {}
  return {
    id: r?.id,
    ID: r?.id,
    STT: index + 1,
    SoPhieu: r?.so_phieu,
    so_phieu: r?.so_phieu,
    TenDA: r?.da?.ten_da ?? null,
    tenDA: r?.da?.ten_da ?? null,
    MaDA: r?.da?.ma_da_code ?? null,
    MaSP: r?.sp?.ma_sp ?? null,
    maSP: r?.sp?.ma_sp ?? null,
    KyHieu: r?.sp?.ky_hieu ?? null,
    kyHieu: r?.sp?.ky_hieu ?? null,
    ThoiGianLock: r?.ngay_giu_cho,
    ngayLock: r?.ngay_giu_cho,
    NgayHetHan: r?.het_han_luc,
    ThoiGianConLai: conLai,
    NhanVienNhap: r?.nhan_vien ?? null,
    TenCT: r?.san?.ten_ct_vt ?? r?.san?.ten_ct ?? null,
    State: r?.state,
    TinhTrang: active
      ? "active"
      : r?.state === LOCK_STATE.RELEASED
        ? "released"
        : "expired",
    TenTT: active
      ? "Đang lock"
      : r?.state === LOCK_STATE.RELEASED
        ? "Đã giải phóng"
        : "Hết hạn",
    // tương thích UI cũ: thoiGianConLai (phút, cho list), thoiGianLock (tổng phút)
    thoiGianConLai: Math.ceil(conLai / 60),
    thoiGianLock: lockMinutes,
    raw: r,
  };
}

async function getStaffName(): Promise<string> {
  try {
    const raw =
      (await AsyncStorage.getItem("@user")) ||
      (await AsyncStorage.getItem("user")) ||
      "";
    if (!raw) return "";
    const u = JSON.parse(raw);
    return u?.ho_ten || u?.tenNV || u?.fullName || u?.username || "";
  } catch {
    return "";
  }
}

/** Lời báo lỗi của máy chủ (RAISE EXCEPTION → PostgREST response.data.message), không có thì fallback. */
function serverMessage(error: any, fallback: string): string {
  const m = error?.response?.data?.message;
  return typeof m === "string" && m.trim() ? m.trim() : fallback;
}

const STATE_LABEL: Record<string, string> = {
  PENDING: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  CANCELLED: "Huỷ booking",
};

function normalizeBooking(raw: any) {
  const kh = raw?.kh || {};
  const da = raw?.da || {};
  const sp = raw?.sp || {};
  const san = raw?.san || {};
  const tt = raw?.tt || {};
  const tenTT: string =
    tt?.item_name || (STATE_LABEL[raw?.state] as string) || raw?.state || "";
  // Tổng tiền: ưu tiên tong_gia trên booking, dự phòng tổng ở phiếu giữ chỗ
  // (nhiều phiếu web tạo không chép tong_gia sang cloud_bookings)
  const pgc = raw?.pgc || {};
  const tongGia =
    raw?.tong_gia ??
    pgc?.tong_gia_tri ??
    pgc?.gia_tri_hd_sau_ck ??
    pgc?.gia_tri_hd ??
    null;
  return {
    ...raw,
    id: raw?.id,
    maPGC: raw?.ma_pgc_id || raw?.id,
    ma_pgc_id: raw?.ma_pgc_id,
    soPhieu: raw?.so_phieu,
    so_phieu: raw?.so_phieu,
    tenTT,
    // Màu nền chuẩn của trạng thái (cloud_catalogs.color_code) — dùng để
    // đồng bộ màu chip trạng thái giữa chi tiết và danh sách booking.
    colorCode: tt?.color_code ?? null,
    MaTT: tt?.item_code ?? "",
    state: raw?.state,
    khachHang: kh?.ten_kh || kh?.ten_cong_ty || "",
    maSanPham: sp?.ky_hieu || sp?.ma_sp || "",
    tenDA: da?.ten_da || "",
    ngayGiuCho: raw?.ngay_giu_cho,
    ngay_giu_cho: raw?.ngay_giu_cho,
    tongGiaGomVAT: tongGia,
    tong_gia: tongGia,
    // thêm cho trang chi tiết
    tien_giu_cho: raw?.tien_giu_cho,
    da_thu: raw?.da_thu,
    het_han_luc: raw?.het_han_luc,
    thoi_gian_con_lai: raw?.thoi_gian_con_lai,
    ten_san: san?.ten_ct_vt || san?.ten_ct || "",
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// NOTE: embed FK có thể thiếu trên schema cache -> fallback select gọn nếu 400 PGRST200
const BOOKING_SELECT_FULL =
  "id,so_phieu,state,tong_gia,tien_giu_cho,da_thu,ngay_giu_cho,ngay_nhap,het_han_luc,thoi_gian_con_lai,created_at,ma_pgc_id,khach_hang_id,ma_da_id,ma_sp_id,ma_san_id,trang_thai_id,kh:cloud_customers!khach_hang_id(id,ten_kh,ten_cong_ty,dien_thoai,email,ma_so_kh),da:da_projects!ma_da_id(id,ten_da,ma_da_code),sp:bds_products!ma_sp_id(id,ma_sp,ky_hieu),san:dm_companies!ma_san_id(id,ma_dl,ten_ct,ten_ct_vt),tt:cloud_catalogs!trang_thai_id(id,item_code,item_name,color_code)";
const BOOKING_SELECT_SIMPLE =
  "id,so_phieu,state,tong_gia,tien_giu_cho,da_thu,ngay_giu_cho,ngay_nhap,het_han_luc,thoi_gian_con_lai,created_at,ma_pgc_id,khach_hang_id,ma_da_id,ma_sp_id,ma_san_id,trang_thai_id";

/**
 * Chuẩn hoá 1 dòng RPC fn_booking_list về shape UI đang dùng (như normalizeBooking).
 * Dòng gốc là phiếu giữ chỗ (id = pgc id); booking_id là cloud_bookings.id.
 */
function normalizeBookingRow(r: any) {
  const tongGia = r?.gia_tri_hd_sau_ck ?? r?.gia_tri_hd ?? null;
  return {
    ...r,
    // id booking để mở chi tiết; không có booking thì dùng id phiếu giữ chỗ
    id: r?.booking_id || r?.id,
    maPGC: r?.id,
    ma_pgc_id: r?.id,
    soPhieu: r?.so_phieu,
    so_phieu: r?.so_phieu,
    tenTT: r?.ten_tt || "",
    colorCode: r?.color_code ?? null,
    MaTT: r?.ma_tt ?? "",
    state: r?.booking_state,
    khachHang: r?.ten_kh || "",
    maSanPham: r?.ky_hieu || r?.ma_sp || "",
    tenDA: r?.ten_da || "",
    ngayGiuCho: r?.ngay_giu_cho,
    tongGiaGomVAT: tongGia,
    tong_gia: tongGia,
    tien_giu_cho: r?.tien_booking,
    ten_san: r?.ten_san || "",
  };
}

/** Gọi RPC fn_booking_list; tự thêm p_ma_ctdk_uid, trả { data, total } */
async function callBookingListRpc(params: Record<string, any>) {
  const companyId = await getCompanyId();
  const validJwt = await getValidSupabaseJwt();
  if (!validJwt || !companyId || !UUID_RE.test(companyId)) {
    console.log("[Booking] chưa có cloud_jwt/company_id hợp lệ");
    return { data: [] as any[], total: 0 };
  }
  try {
    const res = await axiosApiSupabase.post("rest/v1/rpc/fn_booking_list", {
      p_ma_ctdk_uid: companyId,
      p_project_id: null,
      p_ma_tt: null,
      p_tu_ngay: null,
      p_den_ngay: null,
      p_input_search: null,
      p_limit: 100,
      p_offset: 0,
      ...params,
    });
    const rows = Array.isArray(res.data) ? res.data : [];
    return {
      data: rows.map(normalizeBookingRow),
      total: Number(rows[0]?.total_count) || rows.length,
    };
  } catch (error) {
    console.log("ERROR fn_booking_list:", error);
    return { data: [] as any[], total: 0 };
  }
}

/**
 * Tải 1 tệp lên kho của công ty (edge function `upload-file`, như web FileUploadService.uploadFileToCloud
 * với `folder`); lỗi thì lùi về API upload .NET cũ. Trả về đường dẫn tệp.
 */
export async function uploadTenantFile(file: { uri: string; name?: string; type?: string }, folder: string) {
  const companyCode = (await getCompanyCode()).trim().toLowerCase();
  const name = file.name || `chung-tu-${Date.now()}.jpg`;
  const type = file.type || "image/jpeg";
  const rnFile = { uri: file.uri, name, type } as any;

  if (companyCode) {
    try {
      const fd = new FormData();
      fd.append("file", rnFile);
      fd.append("ma_ctdk", companyCode);
      fd.append("folder", folder);
      const res = await axiosApiSupabase.post("functions/v1/upload-file", fd, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 120000,
      });
      const out = res.data ?? {};
      if (out.error) throw new Error(out.error);
      const value = out.provider === "DOTNET" ? out.link : out.url || out.link;
      if (typeof value === "string" && value.trim()) return value.trim();
      throw new Error("Máy chủ upload không trả về đường dẫn ảnh");
    } catch (error) {
      console.log("[uploadTenantFile] upload-file lỗi, lùi về API .NET", error);
    }
  }

  const fd = new FormData();
  fd.append("Image", rnFile);
  fd.append("TenCTDK", companyCode || "beeland");
  fd.append("Project", "beeland_admin_web");
  const res = await fetch("https://upload.beesky.vn/api/Upload", { method: "POST", body: fd });
  const text = await res.text().catch(() => "");
  let parsed: any = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }
  const link = parsed?.data?.[0];
  if (!res.ok || parsed?.status !== 2000 || !link) {
    throw new Error(parsed?.message || `Upload thất bại (HTTP ${res.status})`);
  }
  return String(link);
}

export const BookingService = {
  /** Home: 5 booking gần nhất — RPC fn_booking_list (giống web) */
  listBookingsFromCloud: async ({
    limit = 5,
    offset = 0,
  }: { limit?: number; offset?: number } = {}) => {
    const res = await callBookingListRpc({ p_limit: limit, p_offset: offset });
    return { data: res.data, total: res.total };
  },

  /**
   * Danh sách booking — RPC fn_booking_list (phiếu giữ chỗ giai đoạn GIUCHO).
   * Trạng thái lấy theo phiếu giữ chỗ (pgc_trang_thai) → khớp web.
   * payload: { maDA?: string[] (ma_da_code | uuid), maTT?: uuid catalog | số item_code,
   *   tuNgay?: string, denNgay?: string, keyword?: string,
   *   pageSize?: number, pageIndex?: number }
   */
  listBookings: async (payload: any = {}) => {
    try {
      // Dự án: ma_da_code → uuid, RPC nhận chuỗi uuid ngăn cách dấu phẩy
      const maDAs: string[] = Array.isArray(payload?.maDA)
        ? payload.maDA
        : payload?.maDA
          ? [payload.maDA]
          : [];
      const uids: string[] = [];
      for (const code of maDAs) {
        const v = String(code).trim();
        if (!v) continue;
        if (UUID_RE.test(v)) {
          uids.push(v);
          continue;
        }
        try {
          const r = await axiosApiSupabase.get("rest/v1/da_projects", {
            params: { select: "id", ma_da_code: `eq.${v}`, limit: "1" },
          });
          const rows = Array.isArray(r.data) ? r.data : [];
          if (rows[0]?.id) uids.push(rows[0].id);
        } catch {}
      }

      // Trạng thái: RPC lọc theo số item_code; UI đang giữ uuid catalog → tra item_code
      let maTTCode: number | null = null;
      const maTT = payload?.maTT ?? payload?.MaTT;
      if (maTT != null && maTT !== "" && maTT !== 0) {
        const v = String(maTT).trim();
        if (UUID_RE.test(v)) {
          try {
            const r = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
              params: { select: "item_code", id: `eq.${v}`, limit: "1" },
            });
            const code = Array.isArray(r.data) ? r.data[0]?.item_code : null;
            const n = parseInt(String(code ?? "").replace(/[^0-9]/g, ""), 10);
            if (Number.isFinite(n)) maTTCode = n;
          } catch {}
        } else if (Number.isFinite(Number(v))) {
          maTTCode = Number(v);
        }
      }

      // Mốc ngày quá rộng (mặc định 2000-01-01..2100-01-01) coi như không giới hạn
      const tuNgay = payload?.tuNgay ?? payload?.TuNgay;
      const denNgay = payload?.denNgay ?? payload?.DenNgay;
      const effTu =
        tuNgay && String(tuNgay).slice(0, 10) > "2000-01-01" ? String(tuNgay) : null;
      const effDen =
        denNgay && String(denNgay).slice(0, 10) < "2100-01-01" ? String(denNgay) : null;

      const kw = String(payload?.keyword ?? payload?.inputSearch ?? "").trim();
      const pageSize = Math.max(1, Number(payload?.pageSize ?? payload?.Limit ?? 50));
      const pageIndex = Math.max(1, Number(payload?.pageIndex ?? 1));

      return await callBookingListRpc({
        p_project_id: uids.length > 0 ? uids.join(",") : null,
        p_ma_tt: maTTCode,
        p_tu_ngay: effTu,
        p_den_ngay: effDen,
        p_input_search: kw || null,
        p_limit: pageSize,
        p_offset: (pageIndex - 1) * pageSize,
      });
    } catch (error) {
      console.log("ERROR listBookings:", error);
      return { data: [], total: 0 };
    }
  },

  /**
   * Kiểm tra căn đã có booking chưa — theo web checkBooking.
   * Query cloud_bookings theo keyword (ma_sp/ky_hieu), khớp MaSP/KyHieu.
   */
  checkBooking: async (payload: any = {}) => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt || !companyId || !UUID_RE.test(companyId)) {
      return { status: 2000, isBooking: false };
    }

    try {
      const maSP = String(payload?.MaSP ?? payload?.maSP ?? "").trim();
      if (!maSP) return { status: 2000, isBooking: false };

      // Chuẩn UUID: resolve id sản phẩm trước (ma_sp/ky_hieu là text; or= không
      // ngoặc bị gateway làm hỏng, ilike trên cột uuid ma_sp_id lỗi 400 →
      // checkBooking trước đây luôn âm thầm trả isBooking=false).
      let spUid: string | null = null;
      try {
        const safe = maSP.replace(/[,()]/g, "");
        const r = await axiosApiSupabase.get("rest/v1/bds_products", {
          params: {
            select: "id",
            or: `(ma_sp.eq.${safe},ky_hieu.eq.${safe})`,
            limit: "1",
          },
        });
        const prows = Array.isArray(r.data) ? r.data : [];
        spUid = prows[0]?.id || null;
      } catch {}
      if (!spUid) return { status: 2000, isBooking: false };

      const res = await axiosApiSupabase.get("rest/v1/cloud_bookings", {
        params: {
          select: "id,so_phieu",
          ma_ctdk_id: `eq.${companyId}`,
          loai_ct: "eq.BOOKING",
          ma_sp_id: `eq.${spUid}`,
          limit: "1",
        },
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      return { status: 2000, isBooking: rows.length > 0 };
    } catch (error) {
      console.log("ERROR checkBooking:", error);
      return { status: 2000, isBooking: false };
    }
  },

  /**
   * Tạo booking mới — theo web addBookingAPI.
   * payload: { MaKH, MaSP, SanPhamId, KyHieu, MaSan, MaDA, TenDA, MaKhu,
   *   TongGiaGomPBT, DTThongThuy, TongGiaGomVAT, PhiBaoTri, TienGiuCho?, ... }
   * - TienGiuCho / HetHanLuc từ cài đặt bán hàng (tien_booking, thoi_gian_booking)
   * - Ghi qua RPC fn_booking_create (máy chủ sinh số phiếu, ghi phiếu giữ chỗ + booking,
   *   đổi căn 2/18 → 11); từ chối → { status: 5000, message: lời báo của máy chủ }
   * - LockId (tuỳ chọn): phiếu lock khi booking từ căn đã lock
   */
  createBooking: async (payload: any = {}) => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt || !companyId || !UUID_RE.test(companyId)) {
      return { status: 5000, message: "Chưa đăng nhập cloud" };
    }

    try {
      const maKH = payload?.MaKH ?? payload?.maKH;
      const maSP = payload?.MaSP ?? payload?.maSP;
      if (!maKH) return { status: 5000, message: "Vui lòng chọn khách hàng" };
      if (!maSP) return { status: 5000, message: "Thiếu mã sản phẩm" };

      const now = new Date();
      const nowIso = now.toISOString();

      // Resolve uuid sản phẩm + dự án
      let spUid: string | null = payload?.SanPhamId || null;
      let spRow: any = null;
      if (!spUid) {
        try {
          const r = await axiosApiSupabase.get("rest/v1/bds_products", {
            params: { select: "id,ma_sp,ky_hieu,ma_da", ma_sp: `eq.${maSP}`, limit: "1" },
          });
          const rows = Array.isArray(r.data) ? r.data : [];
          spRow = rows[0] || null;
          spUid = spRow?.id || null;
        } catch {}
      }
      if (!spUid) return { status: 5000, message: "Không tìm thấy sản phẩm" };

      let daUid: string | null = spRow?.ma_da || null;
      const maDA = payload?.MaDA ?? payload?.maDA;
      if (!daUid && maDA) {
        const v = String(maDA).trim();
        if (UUID_RE.test(v)) daUid = v;
        else {
          try {
            const r = await axiosApiSupabase.get("rest/v1/da_projects", {
              params: { select: "id", ma_da_code: `eq.${v}`, limit: "1" },
            });
            const rows = Array.isArray(r.data) ? r.data : [];
            daUid = rows[0]?.id || null;
          } catch {}
        }
      }

      // Resolve uuid khách hàng (MaKH có thể là ma_so_kh hoặc uuid).
      // KHÔNG gộp ma_so_kh (text) với id (uuid) trong 1 or=: khi mã KH không
      // phải uuid (vd "KH-00006"), so sánh id.eq."KH-00006" làm Postgres lỗi
      // 22P02 "invalid input syntax for type uuid" → cả query chết 400 →
      // "Không tìm thấy khách hàng". Khi không phải uuid chỉ tra ma_so_kh.
      let khUid: string | null = null;
      {
        const v = String(maKH).trim();
        if (UUID_RE.test(v)) khUid = v;
        else {
          try {
            const r = await axiosApiSupabase.get("rest/v1/cloud_customers", {
              params: {
                select: "id",
                ma_ctdk: `eq.${companyId}`,
                ma_so_kh: `eq.${v}`,
                limit: "1",
              },
            });
            const rows = Array.isArray(r.data) ? r.data : [];
            khUid = rows[0]?.id || null;
          } catch {}
        }
      }
      if (!khUid) return { status: 5000, message: "Không tìm thấy khách hàng" };

      // Tiền booking như web (BookingFormDialog.handleSubmit): chính sách bán hàng đã chọn (payload.TienGiuCho)
      // trước, không có mới lấy cài đặt bán hàng (tien_booking, trống thì tien_dat_coc).
      const policyAmount = Number(payload?.TienGiuCho);
      let tienGiuCho: number | null = Number.isFinite(policyAmount) && policyAmount > 0 ? policyAmount : null;
      let hetHanLuc: string | null = null;
      try {
        const s = await axiosApiSupabase.get("rest/v1/cloud_sales_settings", {
          params: {
            select: "tien_booking,tien_dat_coc,thoi_gian_booking,ma_da,tu_ngay,den_ngay,ap_dung",
            ma_ctdk: `eq.${companyId}`,
            order: "created_at.desc",
            limit: "200",
          },
        });
        const rows = Array.isArray(s.data) ? s.data : [];
        const setting = pickSalesSetting(rows, daUid, localYmd(now));
        // Giống web: tiền booking = "Tiền booking" của cài đặt, trống thì mới lấy "Tiền đặt cọc"
        const t = Number(setting?.tien_booking) || Number(setting?.tien_dat_coc) || 0;
        if (tienGiuCho == null && Number.isFinite(t) && t > 0) tienGiuCho = t;
        const minutes = Number(setting?.thoi_gian_booking);
        if (Number.isFinite(minutes) && minutes > 0) {
          hetHanLuc = new Date(now.getTime() + minutes * 60000).toISOString();
        }
      } catch {}

      const staff = await getStaffName();
      const employeeId = await getEmployeeId();
      const num = (v: any) => {
        if (v == null || v === "") return null;
        const n = Number(String(v).replace(/,/g, ""));
        return Number.isFinite(n) ? n : null;
      };
      const sanId = payload?.MaSan ?? payload?.maSan;

      // Như web Product.addBookingAPI: một RPC fn_booking_create làm trọn giao dịch phía máy chủ
      // (kiểm tra trạng thái căn: mã 2, hoặc mã 18 kèm phiếu lock còn hạn; ghi phiếu giữ chỗ +
      // booking; đổi căn sang 11). Máy chủ từ chối → không có gì được ghi, trả nguyên lời báo lỗi.
      const body = {
        ma_ctdk_uid: companyId,
        san_pham_id: spUid,
        ma_sp: maSP,
        ky_hieu: payload?.KyHieu ?? payload?.kyHieu ?? spRow?.ky_hieu ?? null,
        khach_hang_id: khUid,
        san_id: UUID_RE.test(String(sanId ?? "")) ? String(sanId) : null,
        so_phieu: payload?.SoPhieu ?? null,
        ngay_giu_cho: nowIso,
        het_han_luc: hetHanLuc,
        tien_giu_cho: tienGiuCho,
        ghi_chu: payload?.GhiChu ?? payload?.ghiChu ?? null,
        nguoi_nhap: staff || null,
        nguoi_nhap_id: employeeId && UUID_RE.test(employeeId) ? employeeId : null,
        price_list_id: payload?.MaDotGia ?? null,
        sales_policy_id: payload?.MaCS ?? null,
        pricing_config_id: payload?.MaCSTong ?? null,
        payment_schedule_id: payload?.MaTDTT ?? null,
        promotion_ids: (payload?.KhuyenMai || [])
          .map((km: any) => km?.ID ?? km?.MaKM ?? km)
          .filter(Boolean),
        chinh_sach: payload?.ChinhSach ?? [],
        lich_thanh_toan: payload?.LichThanhToan ?? [],
        khuyen_mai: payload?.KhuyenMai ?? [],
        payload,
        tt_hop_dong: {
          MaSP: maSP,
          MaDA: payload?.MaDA ?? payload?.maDA,
          MaCan: payload?.KyHieu ?? null,
          TongGiaGomVAT: payload?.TongGiaGomVAT ?? payload?.TongGiaGomPBT,
          // Như web salesConfigPayload → Payload.TTHopDong
          MaDotGia: payload?.MaDotGia ?? null,
          MaCS: payload?.MaCS ?? null,
          MaCSTong: payload?.MaCSTong ?? null,
          MaTDTT: payload?.MaTDTT ?? null,
        },
        tt_khach_hang: { MaKH: maKH },
        lock_id: payload?.LockId ?? null,
        gia: {
          dien_tich: num(payload?.DTThongThuy),
          don_gia_gom_vat: num(payload?.DonGiaTT),
          don_gia_chua_vat: num(payload?.DonGiaChuaVAT),
          tong_chua_vat: num(payload?.TongGiaChuaVAT),
          tien_vat: num(payload?.TienVAT),
          tong_gom_vat: num(payload?.TongGiaGomVAT),
          phi_bao_tri: num(payload?.PhiBaoTri),
          gia_tri_hd: num(payload?.TongGiaGomPBT ?? payload?.TongGiaGomVAT),
          don_gia_dat: num(payload?.DonGiaDat),
          tong_gia_dat: num(payload?.TongGiaDat),
          don_gia_xd: num(payload?.DonGiaXD),
          thanh_tien_xd: num(payload?.ThanhTienXD),
        },
      };

      let created: any;
      try {
        const res = await axiosApiSupabase.post("rest/v1/rpc/fn_booking_create", { p_payload: body });
        created = res.data || {};
      } catch (e) {
        console.log("ERROR fn_booking_create:", e);
        return { status: 5000, message: serverMessage(e, "Tạo booking thất bại") };
      }

      return {
        status: 2000,
        data: created.booking_id || created.phieu_giu_cho_id,
        id: created.booking_id,
        soPhieu: created.so_phieu,
        maPGC: created.phieu_giu_cho_id,
      };
    } catch (error) {
      console.log("ERROR createBooking:", error);
      return { status: 5000, message: "Tạo booking thất bại" };
    }
  },

  /**
   * Cấu hình bán hàng web tự chọn khi mở form booking (useSalesConfigOptions + BookingFormDialog):
   * bảng giá hiện hành ưu tiên cao nhất theo dự án + loại BĐS, chính sách bán hàng gắn với bảng giá đó,
   * dòng giá của sản phẩm trong bảng giá. Không có / lỗi → null hết (dùng giá sản phẩm).
   * product: ProductService.normalizeProduct (uuid ở "ID").
   */
  getBookingSalesConfig: async (product: any): Promise<BookingSalesConfig> => {
    const empty: BookingSalesConfig = { priceListId: null, priceItem: null, policy: null };
    try {
      const companyId = await getCompanyId();
      const productId = String(product?.ID ?? product?.id ?? product?.Id ?? "");
      if (!UUID_RE.test(companyId || "") || !UUID_RE.test(productId)) return empty;
      const projectId = await resolveProjectUid(product?.MaDA);
      if (!projectId) return empty;

      const isLow = isLowRiseProduct({ product, maSP: product?.KyHieu });
      const rpc = async (fn: string, body: Record<string, any>): Promise<any[]> => {
        const res = await axiosApiSupabase.post(`rest/v1/rpc/${fn}`, body);
        return Array.isArray(res.data) ? res.data : [];
      };
      const [lists, policies] = await Promise.all([
        rpc("fn_get_current_price_lists", {
          p_ma_ctdk_uid: companyId,
          p_da_project_id: projectId,
          p_type: isLow ? "Thấp tầng" : "Chung cư",
        }),
        rpc("fn_get_sales_policies", {
          p_ma_ctdk: companyId,
          p_da_project_id: projectId,
          p_form_code: isLow ? "THAPTANG" : "CAOTANG",
        }),
      ]);
      const list = sortPriceLists(lists)[0];
      if (!list?.id) return empty;
      const priceListId = String(list.id);
      const policy = list.sales_policy_id
        ? policies.find((c: any) => String(c.id) === String(list.sales_policy_id)) ?? null
        : null;
      const items = await rpc("fn_get_price_list_item_by_product", {
        p_price_list_id: priceListId,
        p_product_id: productId,
        p_ma_ctdk_uid: companyId,
      });
      return { priceListId, priceItem: mapPriceListItem(items[0] ?? null), policy };
    } catch (e) {
      console.log("ERROR getBookingSalesConfig:", e);
      return empty;
    }
  },

  /**
   * Lấy chi tiết 1 phiếu booking theo id hoặc so_phieu / ma_pgc
   */
  getBookingDetail: async (bookingIdOrCode: string) => {
    const companyId = await getCompanyId();
    const idStr = String(bookingIdOrCode || "").trim();
    if (!idStr) return { data: null };

    try {
      const isUid = UUID_RE.test(idStr);
      let query = `rest/v1/cloud_bookings?select=${BOOKING_SELECT_FULL}&loai_ct=eq.BOOKING&limit=1`;
      if (companyId && UUID_RE.test(companyId)) {
        query += `&ma_ctdk_id=eq.${companyId}`;
      }
      if (isUid) {
        query += `&id=eq.${idStr}`;
      } else {
        query += `&so_phieu=eq.${idStr}`;
      }

      const res = await axiosApiSupabase.get(query);
      const rows = Array.isArray(res.data) ? res.data : [];
      if (rows.length > 0) {
        return { data: normalizeBooking(rows[0]) };
      }

      // Fallback tìm theo ma_pgc_id nếu idStr là ma_pgc_id uuid
      if (isUid) {
        let pgcQuery = `rest/v1/cloud_bookings?select=${BOOKING_SELECT_FULL}&loai_ct=eq.BOOKING&ma_pgc_id=eq.${idStr}&limit=1`;
        if (companyId && UUID_RE.test(companyId)) {
          pgcQuery += `&ma_ctdk_id=eq.${companyId}`;
        }
        const pgcRes = await axiosApiSupabase.get(pgcQuery);
        const pgcRows = Array.isArray(pgcRes.data) ? pgcRes.data : [];
        if (pgcRows.length > 0) {
          return { data: normalizeBooking(pgcRows[0]) };
        }
      }

      return { data: null };
    } catch (error: any) {
      // PGRST200 fallback to simple select
      try {
        const isUid = UUID_RE.test(idStr);
        let query = `rest/v1/cloud_bookings?select=${BOOKING_SELECT_SIMPLE}&loai_ct=eq.BOOKING&limit=1`;
        if (companyId && UUID_RE.test(companyId)) {
          query += `&ma_ctdk_id=eq.${companyId}`;
        }
        if (isUid) {
          query += `&id=eq.${idStr}`;
        } else {
          query += `&so_phieu=eq.${idStr}`;
        }

        const res = await axiosApiSupabase.get(query);
        const rows = Array.isArray(res.data) ? res.data : [];
        if (rows.length > 0) {
          return { data: normalizeBooking(rows[0]) };
        }
      } catch (e) {
        console.log("ERROR getBookingDetail fallback:", e);
      }
      console.log("ERROR getBookingDetail:", error);
      return { data: null };
    }
  },

  /**
   * Chi tiết booking theo đúng mapping web BookingFormDialog.tsx +
   * BookingDocsCloudService.getBookingEditDetail.
   * Trả về 1 object gồm: phiếu (cloud_bookings + cloud_pgc_phieu_giucho),
   * khách hàng (cloud_customers + tt_khach_hang), sàn, sản phẩm, dự án,
   * giá theo bảng giá (price_list_items), chính sách/tiến độ/quà tặng.
   */
  getBookingEditDetail: async (bookingIdOrCode: string) => {
    const idStr = String(bookingIdOrCode || "").trim();
    if (!idStr) return { data: null };
    if (!(await getValidSupabaseJwt())) {
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }
    const companyId = await getCompanyId();

    // Không embed FK: schema cache thiếu quan hệ không làm mất cả phiếu.
    // RLS lọc các bảng danh mục bằng company_id trong JWT.
    const get = async (table: string, params: Record<string, string>) => {
      const res = await axiosApiSupabase.get(`rest/v1/${table}`, {
        params: { select: "*", limit: "1", ...params },
      });
      return Array.isArray(res.data) ? res.data[0] ?? null : null;
    };
    const byId = (table: string, id: unknown) =>
      UUID_RE.test(String(id ?? ""))
        ? get(table, { id: `eq.${id}` })
        : Promise.resolve(null);
    const jsonObject = (value: any): Record<string, any> => {
      if (typeof value === "string") {
        try { value = JSON.parse(value); } catch { return {}; }
      }
      return value && typeof value === "object" && !Array.isArray(value) ? value : {};
    };
    const numberOrNull = (value: any): number | null =>
      value == null || value === "" || !Number.isFinite(Number(value))
        ? null
        : Number(value);
    const booleanOrNull = (value: any): boolean | null => {
      if (value === true || value === 1 || value === "1" || value === "true") return true;
      if (value === false || value === 0 || value === "0" || value === "false") return false;
      return null;
    };

    try {
      const isUid = UUID_RE.test(idStr);
      // 1) Phiếu booking
      let booking: any = null;
      {
        const params: Record<string, string> = {
          select: "*",
          loai_ct: "eq.BOOKING",
          limit: "1",
        };
        if (companyId && UUID_RE.test(companyId))
          params.ma_ctdk_id = `eq.${companyId}`;
        if (isUid) params.id = `eq.${idStr}`;
        else {
          params.so_phieu = `eq.${idStr}`;
          params.order = "created_at.desc.nullslast";
        }
        booking = await get("cloud_bookings", params);
        // fallback theo ma_pgc_id
        if (!booking && isUid) {
          const p2 = { ...params };
          delete p2.id;
          p2.ma_pgc_id = `eq.${idStr}`;
          // 1 phiếu giữ chỗ có thể có nhiều booking → lấy booking mới nhất
          p2.order = "created_at.desc.nullslast";
          booking = await get("cloud_bookings", p2);
        }
      }
      if (!booking) return { data: null };

      // 2) Vòng đời: UUID trước, số phiếu chỉ là liên kết dự phòng.
      const pgcTenant: Record<string, string> =
        companyId && UUID_RE.test(companyId) ? { ma_ctdk_uid: `eq.${companyId}` } : {};
      let pgc: any = null;
      if (UUID_RE.test(String(booking.ma_pgc_id ?? ""))) {
        pgc = await get("cloud_pgc_phieu_giucho", {
          ...pgcTenant, id: `eq.${booking.ma_pgc_id}`,
        });
      }
      if (!pgc && booking.so_phieu) {
        pgc = await get("cloud_pgc_phieu_giucho", {
          ...pgcTenant, so_phieu_gc: `eq.${booking.so_phieu}`,
        });
      }

      const ttHopDong = jsonObject(pgc?.tt_hop_dong);
      const maDotGia = ttHopDong.MaDotGia || null;
      const maCS = ttHopDong.MaCS || pgc?.ma_cs || null;
      const sanPhamId = pgc?.san_pham_id || booking.ma_sp_id || null;
      const [product, kh, san, policy, priceList, priceItem, status] = await Promise.all([
        byId("bds_products", sanPhamId),
        byId("cloud_customers", booking.khach_hang_id || pgc?.khach_hang_id),
        byId("dm_companies", pgc?.san_id || booking.ma_san_id),
        byId("da_sales_policies", maCS),
        // Phiếu cũ vẫn cần tên bảng giá đã hết hiệu lực.
        byId("price_lists", maDotGia),
        UUID_RE.test(String(maDotGia)) && UUID_RE.test(String(sanPhamId))
          ? get("price_list_items", {
              price_list_id: `eq.${maDotGia}`, product_id: `eq.${sanPhamId}`,
            })
          : Promise.resolve(null),
        // Trạng thái theo phiếu giữ chỗ (pgc_trang_thai) — khớp fn_booking_list
        byId("cloud_catalogs", pgc?.trang_thai_id || booking.trang_thai_id),
      ]);
      const projectId = pgc?.project_id || booking.ma_da_id || product?.ma_da;
      const maCSTong = ttHopDong.MaCSTong || policy?.pricing_config_id || null;
      const maTDTT = ttHopDong.MaTDTT || policy?.payment_schedule_id || null;
      const [project, pricingConfig, paymentSchedule] = await Promise.all([
        byId("da_projects", projectId),
        byId("cloud_pricing_configs", maCSTong),
        byId("da_payment_schedules", maTDTT),
      ]);

      // Schema thực tế: cloud_sales_settings.ma_da là UUID da_projects.id,
      // không phải ma_da_code (ví dụ "2"). Không suy ra hạn từ số phút.
      let settings: any = null;
      if (UUID_RE.test(String(project?.id ?? ""))) {
        const now = new Date();
        const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        settings = await get("cloud_sales_settings", {
          select: "thoi_gian_booking,tien_booking,tien_dat_coc,booking_uu_tien,tu_ngay,den_ngay",
          ma_da: `eq.${project.id}`,
          ap_dung: "is.true",
          and: `(or(tu_ngay.is.null,tu_ngay.lte.${today}),or(den_ngay.is.null,den_ngay.gte.${today}))`,
          order: "tu_ngay.desc.nullslast",
        });
      }

      // Giữ bản chụp quà tặng; chỉ bổ sung danh mục nếu bản chụp thiếu.
      const khuyenMai: any[] = Array.isArray(pgc?.khuyen_mai) ? pgc.khuyen_mai : [];
      const promotions = await Promise.all(khuyenMai.map(async (value: any) => {
        const km = jsonObject(value);
        const promotionId = [km.ID, km.MaKM].find((v) => UUID_RE.test(String(v ?? "")));
        const needsCatalog = !km.TenQuaTang || !km.TenKhuyenMai ||
          km.SoLuong == null || km.GiaTri == null;
        const catalog = needsCatalog ? await byId("da_promotions", promotionId) : null;
        return {
          id: promotionId ?? null,
          tenKhuyenMai: km.TenKhuyenMai || km.ten_khuyen_mai || catalog?.ten_khuyen_mai || null,
          tenQuaTang: km.TenQuaTang || km.ten_qua_tang || catalog?.ten_qua_tang || null,
          soLuong: numberOrNull(km.SoLuong ?? km.so_luong ?? catalog?.so_luong),
          giaTri: numberOrNull(km.GiaTri ?? km.gia_tri ?? catalog?.gia_tri),
        };
      }));

      // Bản chụp khách hàng tại thời điểm lập phiếu
      const ttKH = jsonObject(pgc?.tt_khach_hang);
      const customer = {
        id: kh?.id ?? booking.khach_hang_id ?? pgc?.khach_hang_id ?? null,
        maSoKH: kh?.ma_so_kh || null,
        tenKH: kh?.ten_kh || ttKH.TenKH || null,
        cccd: kh?.cccd || ttKH.SoCMND || ttKH.CCCD || null,
        dienThoai: kh?.dien_thoai || ttKH.DiDong || null,
        email: kh?.email || ttKH.Email || null,
        diaChi: ttKH.DiaChi || null,
      };

      const tienGiuCho =
        numberOrNull(policy?.tien_booking) ??
        numberOrNull(booking.tien_giu_cho) ??
        numberOrNull(settings?.tien_booking) ??
        numberOrNull(settings?.tien_dat_coc);
      const tongGia =
        numberOrNull(priceItem?.total_payment) ??
        numberOrNull(product?.tong_gia_tri_hdmb) ??
        numberOrNull(booking.tong_gia);
      // Không tính lại giá. Chỉ fallback block sản phẩm khi thiếu dòng bảng giá.
      const price = priceItem ?? {
        area: product?.dien_tich_thong_thuy,
        unit_price_vat: product?.don_gia_da_vat,
        total_before_vat: product?.tong_gia_chua_vat,
        vat_amount: product?.tien_vat,
        maintenance_amount: product?.tien_phi_bao_tri,
        total_payment: product?.tong_gia_tri_hdmb,
      };
      const uuTien =
        booleanOrNull(jsonObject(booking.raw).UuTien) ??
        booleanOrNull(jsonObject(pgc?.payload).UuTien) ??
        booleanOrNull(settings?.booking_uu_tien);

      const soPhieu = pgc?.so_phieu_gc || booking.so_phieu || null;

      return {
        data: {
          // Phiếu
          id: booking.id,
          maPGC: pgc?.id ?? booking.ma_pgc_id,
          soPhieu,
          so_phieu_gc: soPhieu,
          state: booking.state,
          maTT: status?.item_code ?? booking.ma_tt ?? null,
          // Cùng thứ tự với normalizeBooking (danh sách) để chip trạng thái khớp nhau
          tenTT: status?.item_name || booking.ten_tt || STATE_LABEL[booking.state] || booking.state || null,
          // Màu nền chuẩn của trạng thái (cloud_catalogs.color_code) — dùng để
          // đồng bộ màu chip trạng thái giữa chi tiết và danh sách booking.
          colorCode: status?.color_code ?? null,
          status: status ?? null,
          ngayGiuCho: booking.ngay_giu_cho ?? pgc?.ngay_giu_cho ?? null,
          ngayNhap: booking.ngay_nhap,
          hetHanLuc: booking.het_han_luc,
          giaiDoan: pgc?.giai_doan ?? null,
          nhanVien: booking.nhan_vien,
          ghiChu: booking.ghi_chu,
          // Header
          tongGia,
          tienGiuCho,
          thoiGianBooking: numberOrNull(settings?.thoi_gian_booking),
          uuTien,
          daThu: numberOrNull(booking.da_thu ?? pgc?.da_thu),
          // Khách hàng
          customer,
          ttKhachHang: ttKH,
          // Sàn / dự án / sản phẩm
          san: san ? { id: san.id, tenCongTy: san.ten_cong_ty || san.ten_ct || null } : null,
          project,
          product,
          sanPhamId,
          // Bảng giá + giá tính sẵn
          priceList: priceList ?? null,
          priceItem: priceItem ?? null,
          price,
          priceSource: priceItem ? "price_list_items" : "bds_products",
          // Chính sách & cấu hình
          policy: policy ?? null,
          pricingConfig: pricingConfig ?? null,
          paymentSchedule: paymentSchedule ?? null,
          maDotGia,
          maCS,
          maCSTong,
          maTDTT,
          // Quà tặng
          promotions,
          khuyenMai,
          // jsonb gốc
          pgcRaw: pgc,
          bookingRaw: booking,
        },
      };
    } catch (error) {
      // UI phân biệt lỗi tải với phiếu không tồn tại; không hiển thị dữ liệu giả.
      throw error;
    }
  },

  /** Danh sách trạng thái booking thay FilterService.getStatusTransaction */
  getBookingStatus: async () => {
    const companyId = await getCompanyId();
    try {
      const params: Record<string, string> = {
        select: "id,item_code,item_name,color_code",
        catalog_type: "eq.pgc_trang_thai",
        order: "item_code.asc",
      };
      if (companyId && UUID_RE.test(companyId)) {
        params.or = `(ma_ctdk.eq.global,ma_ctdk_uid.eq.${companyId})`;
      }
      const res = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
        params,
      });
      return { data: Array.isArray(res.data) ? res.data : [] };
    } catch (error) {
      console.log("ERROR getBookingStatus:", error);
      return { data: [] };
    }
  },

  // ===== LOCK CĂN — cloud (cloud_bookings loai_ct=LOCK), theo web ProductLockService.ts =====

  /**
   * Danh sách lock — cloud_bookings loai_ct=LOCK, order ngay_giu_cho desc.
   * payload: { maDA?: string[] (ma_da_code), keyword?: string, limit?: number }
   */
  listProductLocks: async (payload: any = {}) => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt || !companyId || !UUID_RE.test(companyId)) {
      console.log("[Lock] chưa có cloud_jwt/company_id hợp lệ");
      return { data: [] };
    }

    try {
      const params: Record<string, string> = {
        select: LOCK_SELECT,
        ma_ctdk_id: `eq.${companyId}`,
        loai_ct: `eq.${LOCK_DOC_TYPE}`,
        order: "ngay_giu_cho.desc.nullslast",
        limit: String(payload?.limit ?? 500),
      };

      // Lọc dự án: maDA có thể là mảng ma_da_code → resolve sang uuid
      const maDAs: string[] = Array.isArray(payload?.maDA)
        ? payload.maDA
        : payload?.maDA
          ? [payload.maDA]
          : [];
      if (maDAs.length > 0) {
        const uids: string[] = [];
        for (const code of maDAs) {
          const v = String(code).trim();
          if (UUID_RE.test(v)) {
            uids.push(v);
            continue;
          }
          try {
            const r = await axiosApiSupabase.get("rest/v1/da_projects", {
              params: { select: "id", ma_da_code: `eq.${v}`, limit: "1" },
            });
            const rows = Array.isArray(r.data) ? r.data : [];
            if (rows[0]?.id) uids.push(rows[0].id);
          } catch {}
        }
        if (uids.length > 0) params.ma_da_id = `in.(${uids.join(",")})`;
      }

      const kw = String(payload?.keyword ?? "").trim();
      if (kw) params.so_phieu = `ilike.*${kw.replace(/[,()]/g, "")}*`;

      const res = await axiosApiSupabase.get("rest/v1/cloud_bookings", {
        params,
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      return { data: rows.map((r: any, i: number) => normalizeLock(r, i)) };
    } catch (error) {
      console.log("ERROR listProductLocks:", error);
      return { data: [] };
    }
  },

  /**
   * Chi tiết 1 phiếu lock theo id + lịch sử lock cùng căn (tối đa 50).
   */
  getLockDetailCloud: async (payload: any = {}) => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt || !companyId || !UUID_RE.test(companyId)) {
      return { data: null, history: [] };
    }

    try {
      const id = payload?.ID ?? payload?.id;
      if (!id) return { data: null, history: [] };

      const res = await axiosApiSupabase.get("rest/v1/cloud_bookings", {
        params: {
          select: LOCK_SELECT,
          ma_ctdk_id: `eq.${companyId}`,
          loai_ct: `eq.${LOCK_DOC_TYPE}`,
          id: `eq.${id}`,
          limit: "1",
        },
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      if (rows.length === 0) return { data: null, history: [] };

      const detail = normalizeLock(rows[0], 0);
      const maSpId = rows[0]?.ma_sp_id;

      // Lịch sử lock cùng căn
      let history: any[] = [];
      if (maSpId) {
        try {
          const h = await axiosApiSupabase.get("rest/v1/cloud_bookings", {
            params: {
              select:
                "id,so_phieu,state,ngay_giu_cho,het_han_luc,nhan_vien,san:dm_companies!ma_san_id(ten_ct,ten_ct_vt)",
              ma_ctdk_id: `eq.${companyId}`,
              loai_ct: `eq.${LOCK_DOC_TYPE}`,
              ma_sp_id: `eq.${maSpId}`,
              order: "ngay_giu_cho.desc",
              limit: "50",
            },
          });
          history = Array.isArray(h.data) ? h.data : [];
        } catch (e) {
          console.log("ERROR lock history:", e);
        }
      }

      return { data: detail, history };
    } catch (error) {
      console.log("ERROR getLockDetailCloud:", error);
      return { data: null, history: [] };
    }
  },

  /**
   * Tạo lock mới: đổi trạng thái SP qua RPC fn_product_transaction
   * (2 Mở bán → 18 Đã Lock); chỉ khi thành công mới insert phiếu LOCK.
   * payload: { maSP, kyHieu, maDA (uuid hoặc ma_da_code), minutes? }
   * Trả { status: 2000, data: seconds } giống legacy để UI cũ dùng được.
   */
  createLock: async (payload: any = {}) => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt || !companyId || !UUID_RE.test(companyId)) {
      return { status: 5000, message: "Chưa đăng nhập cloud" };
    }

    try {
      const maSP = payload?.maSP ?? payload?.MaSP;
      const kyHieu = payload?.kyHieu ?? payload?.KyHieu;
      if (!maSP && !kyHieu) return { status: 5000, message: "Thiếu mã sản phẩm" };

      // Resolve uuid sản phẩm
      let spUid: string | null = null;
      let spRow: any = null;
      try {
        const q: Record<string, string> = {
          select: "id,ma_sp,ky_hieu,ma_da",
          limit: "1",
        };
        if (maSP) q.ma_sp = `eq.${maSP}`;
        else q.ky_hieu = `eq.${kyHieu}`;
        const r = await axiosApiSupabase.get("rest/v1/bds_products", {
          params: q,
        });
        const rows = Array.isArray(r.data) ? r.data : [];
        spRow = rows[0] || null;
        spUid = spRow?.id || null;
      } catch {}
      if (!spUid) return { status: 5000, message: "Không tìm thấy sản phẩm" };

      // Resolve uuid dự án
      let daUid: string | null = spRow?.ma_da || null;
      const maDA = payload?.maDA ?? payload?.MaDA;
      if (!daUid && maDA) {
        const v = String(maDA).trim();
        if (UUID_RE.test(v)) daUid = v;
        else {
          try {
            const r = await axiosApiSupabase.get("rest/v1/da_projects", {
              params: { select: "id", ma_da_code: `eq.${v}`, limit: "1" },
            });
            const rows = Array.isArray(r.data) ? r.data : [];
            daUid = rows[0]?.id || null;
          } catch {}
        }
      }

      // Thời gian lock: payload minutes > 0 → cấu hình dự án → mặc định 30 phút
      let lockMinutes = Number(payload?.minutes ?? payload?.Minutes ?? 0);
      if (!Number.isFinite(lockMinutes) || lockMinutes <= 0) {
        lockMinutes = await resolveLockMinutes(daUid);
      }

      const now = new Date();
      const hetHan = new Date(now.getTime() + lockMinutes * 60000);
      const staff = await getStaffName();

      // Số phiếu: KyHieu/YYYY/MM/STT (đếm lock trong tháng, tháng theo giờ VN như web)
      const { yyyy, mm, fromIso: from } = lockVoucherMonth(now);
      let soPhieu = `${kyHieu || maSP}/${yyyy}/${mm}/1`;
      try {
        const c = await axiosApiSupabase.get("rest/v1/cloud_bookings", {
          params: {
            select: "id",
            ma_ctdk_id: `eq.${companyId}`,
            loai_ct: `eq.${LOCK_DOC_TYPE}`,
            created_at: `gte.${from}`,
          },
          headers: { Prefer: "count=exact" },
        });
        const range = (c.headers?.["content-range"] as string) || "";
        const count = range.includes("/")
          ? Number(range.split("/").pop()) || 0
          : 0;
        soPhieu = `${kyHieu || maSP}/${yyyy}/${mm}/${count + 1}`;
      } catch {}

      // 1) Đổi trạng thái SP qua RPC (2 → 18). Hệ thống từ chối (căn không còn "Mở bán"…) → DỪNG,
      //    không tạo phiếu lock – như web CloudWriteService.lockProductCloudFirst.
      try {
        await axiosApiSupabase.post("rest/v1/rpc/fn_product_transaction", {
          p_san_pham_id: spUid,
          p_action: "LOCK_CREATE",
          p_next_product_code: "18",
          p_require_codes: ["2"],
          p_phieu_id: null,
          p_next_pgc_code: null,
          p_so_phieu: soPhieu,
          p_note: `Lock căn đến ${hetHan.toISOString()}`,
          p_user: staff || null,
        });
      } catch (e) {
        console.log("ERROR lock RPC:", e);
        return { status: 5000, message: serverMessage(e, "Không lock được căn này") };
      }

      // 2) Insert phiếu LOCK
      await axiosApiSupabase.post("rest/v1/cloud_bookings", {
        ma_ctdk_id: companyId,
        loai_ct: LOCK_DOC_TYPE,
        so_phieu: soPhieu,
        ma_da_id: daUid,
        ma_sp_id: spUid,
        state: LOCK_STATE.ACTIVE,
        ngay_giu_cho: now.toISOString(),
        ngay_nhap: now.toISOString(),
        het_han_luc: hetHan.toISOString(),
        nhan_vien: staff,
        ghi_chu: `Lock căn đến ${hetHan.toISOString()}`,
      });

      return { status: 2000, data: lockMinutes * 60, soPhieu };
    } catch (error) {
      console.log("ERROR createLock:", error);
      return { status: 5000, message: "Tạo lock thất bại" };
    }
  },

  /**
   * Hủy lock: update state (RELEASED/EXPIRED) + tính lại trạng thái SP
   * (trả về '2' Mở bán nếu đang '18').
   */
  releaseLock: async (payload: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) return { status: 5000, message: "Chưa đăng nhập cloud" };

    try {
      const id = payload?.ID ?? payload?.id;
      const state =
        payload?.state === LOCK_STATE.RELEASED
          ? LOCK_STATE.RELEASED
          : LOCK_STATE.EXPIRED;
      if (!id) return { status: 5000, message: "Thiếu ID phiếu lock" };

      await axiosApiSupabase.patch(`rest/v1/cloud_bookings?id=eq.${id}`, {
        state,
        updated_at: new Date().toISOString(),
      });

      // Tính lại trạng thái SP (trả về Mở bán nếu đang Đã Lock)
      const staff = await getStaffName();
      try {
        await axiosApiSupabase.post("rest/v1/rpc/fn_product_transaction", {
          p_san_pham_id: payload?.ma_sp_id ?? null,
          p_action: "LOCK_RELEASE",
          p_next_product_code: "2",
          p_require_codes: ["18"],
          p_phieu_id: id,
          p_next_pgc_code: null,
          p_so_phieu: payload?.so_phieu ?? null,
          p_note:
            state === LOCK_STATE.RELEASED
              ? "Giải phóng lock căn"
              : "Hết thời gian lock căn",
          p_user: staff || null,
        });
      } catch (e) {
        console.log("ERROR lock release RPC:", e);
      }

      return { status: 2000 };
    } catch (error) {
      console.log("ERROR releaseLock:", error);
      return { status: 5000, message: "Hủy lock thất bại" };
    }
  },

  /**
   * Quét lock hết hạn lúc load màn: state=LOCKED AND het_han_luc < now → EXPIRED.
   */
  sweepExpiredLocks: async () => {
    const companyId = await getCompanyId();
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt || !companyId || !UUID_RE.test(companyId)) return;

    try {
      const now = new Date().toISOString();
      const res = await axiosApiSupabase.get("rest/v1/cloud_bookings", {
        params: {
          select: "id,ma_sp_id,so_phieu",
          ma_ctdk_id: `eq.${companyId}`,
          loai_ct: `eq.${LOCK_DOC_TYPE}`,
          state: `eq.${LOCK_STATE.ACTIVE}`,
          het_han_luc: `lt.${now}`,
          limit: "200",
        },
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      for (const r of rows) {
        try {
          await axiosApiSupabase.patch(
            `rest/v1/cloud_bookings?id=eq.${r.id}`,
            { state: LOCK_STATE.EXPIRED, updated_at: now }
          );
        } catch {}
      }
      if (rows.length > 0) {
        console.log(`[Lock] đã quét ${rows.length} lock hết hạn`);
      }
    } catch (error) {
      console.log("ERROR sweepExpiredLocks:", error);
    }
  },

  // ===== API cũ giữ lại để các màn khác chưa migrate vẫn chạy =====
  getLockList: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/san-pham/danh-sach-lock-can", dataInit)
      .then((res) => res.data);
  },

  getLockDetail: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/lock-can-chi-tiet", dataInit)
      .then((res) => res.data);
  },

  lockCan: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/admin/san-pham/lock-can", dataInit)
      .then((res) => res.data);
  },

  addImageBooking: async (payload: any = {}) => {
    const dataInit = {
      ...payload,
    };
    return await axiosApi
      .post("api/beeland/add-images-booking", dataInit)
      .then((res) => res.data);
  },
  /** Ảnh booking trên self-host; MaPGC là UUID vòng đời, không phải số phiếu. */
  getListImageGC: async (payload: { MaPGC?: string; maPGC?: string } = {}) => {
    if (!(await getValidSupabaseJwt())) {
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }
    const maPGC = String(payload.MaPGC ?? payload.maPGC ?? "").trim();
    if (!UUID_RE.test(maPGC)) {
      throw new Error("Thiếu UUID phiếu giữ chỗ để tải ảnh booking.");
    }
    const companyId = (await getCompanyId()).trim();
    if (!companyId || !UUID_RE.test(companyId)) throw new Error("Không xác định được tenant UUID.");

    // Phân trang để không bỏ ảnh khi PostgREST giới hạn số dòng trả về.
    const rows: any[] = [];
    const pageSize = 100;
    for (let offset = 0; ; offset += pageSize) {
      const res = await axiosApiSupabase.get("rest/v1/cloud_generic_records", {
        params: {
          select: "record_id,payload,created_at",
          endpoint: "eq.admin/hop-dong/anh-giu-cho",
          ma_ctdk: `eq.${companyId}`,
          "payload->>MaPGC": `eq.${maPGC}`,
          is_deleted: "is.false",
          order: "created_at.asc,record_id.asc",
          limit: String(pageSize),
          offset: String(offset),
        },
      });
      if (!Array.isArray(res.data)) throw new Error("Dữ liệu ảnh booking không hợp lệ.");
      rows.push(...res.data);
      if (res.data.length < pageSize) break;
    }

    const paths = rows.flatMap((row) => {
      const record = row.payload ?? {};
      const images = Array.isArray(record.Images)
        ? record.Images.filter((v: unknown): v is string => typeof v === "string" && !!v.trim())
        : [];
      const legacy = record.uri || record.Url;
      const values = images.length ? images : typeof legacy === "string" && legacy.trim() ? [legacy] : [];
      return values.map((value: string, index: number) => ({
        id: `${row.record_id ?? record.ID}:${index}`,
        recordId: String(row.record_id ?? record.ID ?? ""),
        path: value.trim(),
      }));
    });
    if (!paths.length) return { data: [] };

    let baseUrl = "https://upload.beesky.vn/";
    if (paths.some((image) => !/^https?:\/\//i.test(image.path))) {
      const res = await axiosApiSupabase.get("rest/v1/upload_configs", {
        params: {
          select: "provider,config",
          ma_ctdk: `eq.${companyId}`,
          ma_ct: "is.null",
          limit: "1",
        },
      });
      const configured = res.data?.[0]?.config?.public_base_url;
      if (typeof configured === "string" && configured.trim()) {
        if (!/^https?:\/\//i.test(configured.trim())) {
          throw new Error("Cấu hình URL máy chủ ảnh không hợp lệ.");
        }
        baseUrl = configured.trim();
      }
      // Chỉ dùng mặc định khi không có cấu hình, không che lỗi API cấu hình.
    }
    return {
      data: paths.map((image) => ({
        id: image.id,
        recordId: image.recordId,
        uri: /^https?:\/\//i.test(image.path)
          ? image.path
          : `${baseUrl.replace(/\/+$/, "")}/${image.path.replace(/^\/+/, "")}`,
        name: image.path.split("/").pop()?.split(/[?#]/)[0] || "Ảnh booking",
      })),
    };
  },

  /**
   * Số tiền booking để thu qua QR = cột "Tiền booking" (tien_booking) của cài đặt bán hàng
   * đang áp dụng cho dự án, tại ngày giữ chỗ của booking. KHÔNG lấy cột khác
   * (phi_bao_tri là phí bảo trì căn hộ — có thể vài trăm triệu). Lỗi mạng thì ném lỗi, không đoán.
   */
  resolveBookingAmount: async (projectId: string, at?: string | Date | null) => {
    if (!UUID_RE.test(String(projectId || ""))) throw new Error("Booking chưa gắn dự án.");
    if (!(await getValidSupabaseJwt())) {
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }
    const companyId = (await getCompanyId()).trim();
    if (!UUID_RE.test(companyId)) throw new Error("Không xác định được tenant UUID.");
    const res = await axiosApiSupabase.get("rest/v1/cloud_sales_settings", {
      params: {
        select: "id,ma_da,tu_ngay,den_ngay,ap_dung,tien_booking",
        ma_ctdk: `eq.${companyId}`,
        or: `(ma_da.eq.${projectId},ma_da.is.null)`,
        order: "created_at.desc",
        limit: "200",
      },
    });
    if (!Array.isArray(res.data)) throw new Error("Dữ liệu cài đặt bán hàng không hợp lệ.");
    const when = at ? new Date(at) : new Date();
    const day = localYmd(Number.isNaN(when.getTime()) ? new Date() : when);
    const setting = pickSalesSetting(res.data, projectId, day);
    const amount = Number(setting?.tien_booking);
    return {
      day,
      setting,
      amount: Number.isFinite(amount) && amount > 0 ? Math.round(amount) : null,
    };
  },

  /**
   * Tải 1 ảnh chứng từ lên nơi lưu tài liệu của công ty (giống web uploadTenantFile):
   * edge function `upload-file` tự chọn R2/S3/.NET theo upload_configs; lỗi thì lùi về API .NET.
   * Trả về giá trị lưu vào Images: URL tuyệt đối (R2/S3) hoặc link tương đối (.NET).
   */
  uploadBookingImage: async (file: { uri: string; name?: string; type?: string }) =>
    uploadTenantFile(file, "booking"),

  /**
   * Lưu ảnh chứng từ vào booking — cùng bản ghi web đọc/ghi
   * (cloud_generic_records, endpoint admin/hop-dong/anh-giu-cho, payload { MaPGC, Images }).
   */
  addBookingImages: async (payload: { MaPGC: string; Images: string[] }) => {
    if (!(await getValidSupabaseJwt())) {
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }
    const maPGC = String(payload.MaPGC ?? "").trim();
    if (!UUID_RE.test(maPGC)) throw new Error("Thiếu UUID phiếu giữ chỗ để lưu ảnh booking.");
    const images = (payload.Images || []).filter((v) => typeof v === "string" && v.trim());
    if (!images.length) throw new Error("Chưa có ảnh để lưu.");
    const companyId = (await getCompanyId()).trim();
    if (!companyId || !UUID_RE.test(companyId)) throw new Error("Không xác định được tenant UUID.");

    const recordId = `c${Date.now()}${Math.floor(Math.random() * 1000)}`;
    await axiosApiSupabase.post(
      "rest/v1/cloud_generic_records",
      {
        ma_ctdk: companyId,
        endpoint: "admin/hop-dong/anh-giu-cho",
        record_id: recordId,
        payload: { MaPGC: maPGC, Images: images, ID: recordId },
        is_deleted: false,
      },
      {
        params: { on_conflict: "ma_ctdk,endpoint,record_id" },
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      }
    );
    return { status: 2000, data: { recordId, images } };
  },
};
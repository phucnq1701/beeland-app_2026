import { callNv, errorMessage as nvErrorMessage } from "@/services/nvApi";
import { DuAnApi, SanPhamApi } from "@/services/SanPhamApi";
import axiosApiSupabase from "./axiosApiSupabase";
import { listResult, mergeProjectPages, pageArgs } from "../lib/listRpc";
import {
  getCompanyCode,
  getCompanyId,
  getValidSupabaseJwt,
} from "./cloudTenant";
import { BookingSalesConfig, isLowRiseProduct, mapPriceListItem, sortPriceLists } from "../lib/bookingPrice";
import { getCustomersByRefs, withCustomers } from "./customerLookup";

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

const LOCK_STATE = {
  ACTIVE: "LOCKED",
  EXPIRED: "EXPIRED",
  RELEASED: "RELEASED",
} as const;
const DEFAULT_LOCK_MINUTES = 30;


/**
 * 1 phiếu lock từ fn_nv_app_lock_list / fn_nv_app_lock_chi_tiet (máy chủ tính con_lai: chỉ LOCKED còn hạn mới > 0) ⇒ dạng màn cũ.
 * maSP = mã SP (chi tiết) hoặc uuid căn (danh sách) — màn chi tiết căn nhận cả hai.
 */
export function normalizeLock(r: any, index = 0) {
  const conLai = Math.max(0, Number(r?.con_lai) || 0);
  const active = r?.state === LOCK_STATE.ACTIVE && conLai > 0;
  let lockMinutes = DEFAULT_LOCK_MINUTES;
  const start = new Date(r?.ngay_lock ?? "").getTime();
  const end = new Date(r?.het_han_luc ?? "").getTime();
  if (start > 0 && end > start) lockMinutes = Math.max(1, Math.round((end - start) / 60000));
  const maSP = r?.ma_sp ?? r?.ma_sp_id ?? null;
  return {
    id: r?.id,
    ID: r?.id,
    STT: index + 1,
    SoPhieu: r?.so_phieu,
    so_phieu: r?.so_phieu,
    TenDA: r?.ten_da ?? null,
    tenDA: r?.ten_da ?? null,
    MaDA: r?.ma_da ?? null,
    MaSP: maSP,
    maSP,
    sanPhamId: r?.ma_sp_id ?? null,
    KyHieu: r?.ky_hieu ?? null,
    kyHieu: r?.ky_hieu ?? null,
    ThoiGianLock: r?.ngay_lock,
    ngayLock: r?.ngay_lock,
    NgayHetHan: r?.het_han_luc,
    ThoiGianConLai: conLai,
    NhanVienNhap: r?.nhan_vien ?? null,
    TenCT: r?.ten_san ?? null,
    State: r?.state,
    TinhTrang: active ? "active" : r?.state === LOCK_STATE.RELEASED ? "released" : "expired",
    TenTT: active ? "Đang lock" : r?.state === LOCK_STATE.RELEASED ? "Đã giải phóng" : "Hết hạn",
    // tương thích UI cũ: thoiGianConLai (phút, cho list), thoiGianLock (tổng phút)
    thoiGianConLai: Math.ceil(conLai / 60),
    thoiGianLock: lockMinutes,
    raw: r,
  };
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
// Khách KHÔNG embed (cloud_customers đã khoá đọc thẳng từ 2026-10-20, migration 20261020000510_ds_dot5_customer_revoke —
// embed làm hỏng cả câu): gắn `kh` sau bằng withCustomers (RPC fn_customer_get_by_ids), như web BookingCloudService.
const BOOKING_SELECT_FULL =
  "id,so_phieu,state,tong_gia,tien_giu_cho,da_thu,ngay_giu_cho,ngay_nhap,het_han_luc,thoi_gian_con_lai,created_at,ma_pgc_id,khach_hang_id,ma_da_id,ma_sp_id,ma_san_id,trang_thai_id,da:da_projects!ma_da_id(id,ten_da,ma_da_code),sp:bds_products!ma_sp_id(id,ma_sp,ky_hieu),san:dm_companies!ma_san_id(id,ma_dl,ten_ct,ten_ct_vt),tt:cloud_catalogs!trang_thai_id(id,item_code,item_name,color_code)";
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
    // Bản mới fn_booking_list không trả booking_id: mở chi tiết bằng id phiếu giữ chỗ
    // (getBookingDetail tra cloud_bookings theo ma_pgc_id, lấy booking mới nhất)
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

/**
 * Gọi RPC fn_booking_list bản mới (web `src/services/sales/booking-list` listBookings, migration 20261014140000):
 * công ty + phạm vi dự án lấy từ JWT ở máy chủ; tham số p_project_id (1 uuid), p_search, p_tu_ngay, p_den_ngay,
 * p_ma_tt, p_states, p_page, p_size; trả { rows, total }. Bản cũ (p_ma_ctdk_uid, p_offset, p_limit…) đã bị xoá
 * trên máy chủ ⇒ app từng nhận lỗi và hiện danh sách rỗng.
 */
async function callBookingListRpc(params: {
  projectId?: string | null;
  search?: string | null;
  tuNgay?: string | null;
  denNgay?: string | null;
  maTT?: number | null;
  /** Trạng thái booking (cloud_bookings.state) – lib/bookingState.statesForTab */
  states?: string[] | null;
  page?: number;
  size?: number;
}) {
  try {
    const pa = pageArgs(params.page, params.size);
    const res = await callNv<any>("fn_nv_app_booking_list", {
      p_du_an_id: params.projectId || null,
      p_tu_khoa: params.search || null,
      p_tu_ngay: params.tuNgay || null,
      p_den_ngay: params.denNgay || null,
      p_states: params.states && params.states.length ? params.states : null,
      p_trang: pa.p_page,
      p_so_dong: pa.p_size,
    });
    const { rows, total } = listResult(res);
    return { data: rows.map(normalizeBookingRow), total };
  } catch (error) {
    console.log("ERROR fn_nv_app_booking_list:", nvErrorMessage(error));
    return { data: [] as any[], total: 0, error: nvErrorMessage(error) };
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
    const size = Math.max(1, limit);
    const res = await callBookingListRpc({ page: Math.floor(Math.max(0, offset) / size) + 1, size });
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
      // Dự án: mã dự án / uuid ⇒ uuid (danh sách dự án người dùng xem được); máy chủ nhận 1 dự án / lần
      const maDAs: any[] = Array.isArray(payload?.maDA) ? payload.maDA : payload?.maDA ? [payload.maDA] : [];
      const uids = (await Promise.all(maDAs.map((x) => DuAnApi.resolveId(x)))).filter((x): x is string => !!x);
      if (maDAs.length > 0 && uids.length === 0) return { data: [], total: 0 };
      // Lọc trạng thái thay bằng tab (states) — màn không còn gửi MaTT
      const maTTCode: number | null = null;

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

      const states: string[] | null = Array.isArray(payload?.states) && payload.states.length ? payload.states : null;
      const base = { search: kw || null, tuNgay: effTu, denNgay: effDen, maTT: maTTCode, states };
      // Chọn nhiều dự án: hàm mới chỉ nhận 1 dự án ⇒ gọi từng dự án rồi gộp đúng trang (lib/listRpc)
      if (uids.length > 1) {
        const pages = await Promise.all(
          uids.map((projectId) =>
            callBookingListRpc({ ...base, projectId, page: 1, size: pageIndex * pageSize })
          )
        );
        const merged = mergeProjectPages(
          pages.map((p) => ({ rows: p.data, total: p.total })),
          pageIndex,
          pageSize,
          (r: any) => r?.ngay_giu_cho ?? r?.ngay_nhap
        );
        return { data: merged.rows, total: merged.total };
      }
      return await callBookingListRpc({
        ...base,
        projectId: uids[0] ?? null,
        page: pageIndex,
        size: pageSize,
      });
    } catch (error) {
      console.log("ERROR listBookings:", error);
      return { data: [], total: 0 };
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
    try {
      const maKH = payload?.MaKH ?? payload?.maKH;
      const maSP = payload?.MaSP ?? payload?.maSP;
      if (!maKH) return { status: 5000, message: "Vui lòng chọn khách hàng" };
      if (!maSP) return { status: 5000, message: "Thiếu mã sản phẩm" };

      // uuid căn: màn tạo booking luôn có (SanPhamId = ID chi tiết căn); thiếu thì tra chi tiết căn theo mã
      let spUid: string | null = UUID_RE.test(String(payload?.SanPhamId ?? "")) ? String(payload.SanPhamId) : null;
      let kyHieu = payload?.KyHieu ?? payload?.kyHieu ?? null;
      if (!spUid) {
        const d = await SanPhamApi.detail(String(maSP));
        spUid = d?.product?.ID ?? null;
        kyHieu = kyHieu ?? d?.product?.KyHieu ?? null;
      }
      if (!spUid) return { status: 5000, message: "Không tìm thấy sản phẩm" };

      // Mã khách (ma_so_kh) ⇒ uuid qua RPC tra khách (cloud_customers đã khoá đọc thẳng)
      let khUid: string | null = null;
      {
        const v = String(maKH).trim();
        if (UUID_RE.test(v)) khUid = v;
        else {
          try {
            const rows = await getCustomersByRefs([v]);
            khUid = (rows.find((r: any) => String(r?.ma_so_kh ?? "").trim() === v) || rows[0])?.id || null;
          } catch {}
        }
      }
      if (!khUid) return { status: 5000, message: "Không tìm thấy khách hàng" };

      const num = (v: any) => {
        if (v == null || v === "") return null;
        const n = Number(String(v).replace(/,/g, ""));
        return Number.isFinite(n) ? n : null;
      };
      const sanId = payload?.MaSan ?? payload?.maSan;

      // fn_nv_app_booking_tao (bọc fn_booking_create của web): máy chủ tự điền công ty, người nhập, ngày giữ chỗ, tiền giữ chỗ
      // (chính sách > cài đặt bán hàng) và hạn (thời gian booking) như web; kiểm căn (2, hoặc 18 kèm lock còn hạn), ghi phiếu
      // giữ chỗ + booking, đổi căn sang 11. Từ chối ⇒ không ghi gì, trả nguyên lời báo của máy chủ.
      const body = {
        san_pham_id: spUid,
        ma_sp: maSP,
        ky_hieu: kyHieu,
        khach_hang_id: khUid,
        san_id: UUID_RE.test(String(sanId ?? "")) ? String(sanId) : null,
        so_phieu: payload?.SoPhieu ?? null,
        ghi_chu: payload?.GhiChu ?? payload?.ghiChu ?? null,
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
        created = (await callNv<any>("fn_nv_app_booking_tao", { p_payload: body })) || {};
      } catch (e) {
        console.log("ERROR fn_nv_app_booking_tao:", nvErrorMessage(e));
        return { status: 5000, message: nvErrorMessage(e, "Tạo booking thất bại") };
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
      const productId = String(product?.ID ?? product?.id ?? product?.Id ?? "");
      if (!UUID_RE.test(productId)) return empty;
      const projectId = await DuAnApi.resolveId(product?.MaDA);
      if (!projectId) return empty;

      const isLow = isLowRiseProduct({ product, maSP: product?.KyHieu });
      const list0 = async (fn: string, body: Record<string, any>): Promise<any[]> => {
        const res = await callNv<any>(fn, body);
        return Array.isArray(res) ? res : [];
      };
      // Công ty lấy từ phiên ở máy chủ (cùng các hàm web dùng cho form booking)
      const [lists, policies] = await Promise.all([
        list0("fn_nv_app_bang_gia_hien_hanh", { p_du_an_id: projectId, p_loai: isLow ? "Thấp tầng" : "Chung cư" }),
        list0("fn_nv_app_chinh_sach_list", { p_du_an_id: projectId, p_form_code: isLow ? "THAPTANG" : "CAOTANG" }),
      ]);
      const list = sortPriceLists(lists)[0];
      if (!list?.id) return empty;
      const priceListId = String(list.id);
      const policy = list.sales_policy_id
        ? policies.find((c: any) => String(c.id) === String(list.sales_policy_id)) ?? null
        : null;
      // Dòng giá theo product_id như web fn_get_price_list_item_by_product (không dò mã căn)
      const item = await callNv<any>("fn_nv_app_gia_trong_bang_gia", { p_bang_gia_id: priceListId, p_san_pham_id: productId, p_ma_sp: null });
      return { priceListId, priceItem: mapPriceListItem(item ?? null), policy };
    } catch (e) {
      console.log("ERROR getBookingSalesConfig:", nvErrorMessage(e));
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
        return { data: normalizeBooking(await withCustomers(rows[0], { nested: [] })) };
      }

      // Fallback tìm theo ma_pgc_id nếu idStr là ma_pgc_id uuid
      if (isUid) {
        // 1 phiếu giữ chỗ có thể có nhiều booking (booking cũ đã huỷ + booking mới) ⇒ lấy mới nhất như web
        let pgcQuery = `rest/v1/cloud_bookings?select=${BOOKING_SELECT_FULL}&loai_ct=eq.BOOKING&ma_pgc_id=eq.${idStr}&order=created_at.desc&limit=1`;
        if (companyId && UUID_RE.test(companyId)) {
          pgcQuery += `&ma_ctdk_id=eq.${companyId}`;
        }
        const pgcRes = await axiosApiSupabase.get(pgcQuery);
        const pgcRows = Array.isArray(pgcRes.data) ? pgcRes.data : [];
        if (pgcRows.length > 0) {
          return { data: normalizeBooking(await withCustomers(pgcRows[0], { nested: [] })) };
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
          return { data: normalizeBooking(await withCustomers(rows[0], { nested: [] })) };
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
   * khách hàng (fn_customer_get_by_ids + tt_khach_hang), sàn, sản phẩm, dự án,
   * giá theo bảng giá (price_list_items), chính sách/tiến độ/quà tặng.
   */
  getBookingEditDetail: async (bookingIdOrCode: string) => {
    const idStr = String(bookingIdOrCode || "").trim();
    if (!idStr) return { data: null };
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
      // 1 lời gọi fn_nv_app_booking_chi_tiet (phạm vi + che trường khách = fn_sales_doc_get của web). Lỗi ⇒ ném (UI báo lỗi tải).
      const r = await callNv<any>("fn_nv_app_booking_chi_tiet", { p_id: idStr });
      if (!r) return { data: null };
      const booking: any = r.booking ?? {
        id: null, ma_pgc_id: r.doc?.pgc?.id, so_phieu: r.doc?.pgc?.so_phieu_gc, ngay_giu_cho: r.doc?.pgc?.ngay_giu_cho,
      };
      const pgc: any = r.doc?.pgc ?? null;
      const ttHopDong = jsonObject(pgc?.tt_hop_dong);
      const maDotGia = ttHopDong.MaDotGia || pgc?.ma_dot_gia || null;
      const maCS = ttHopDong.MaCS || pgc?.ma_cs || null;
      const sanPhamId = pgc?.san_pham_id || booking.ma_sp_id || null;
      const product: any = r.san_pham_gia ?? r.doc?.san_pham ?? null;
      const kh: any = r.doc?.khach_hang ?? null;
      const san: any = r.san ?? null;
      const policy: any = r.chinh_sach ?? null;
      const priceList: any = r.bang_gia ?? null;
      const priceItem: any = r.gia_bang_gia ?? null;
      const status: any = r.doc?.trang_thai ?? null;
      const project: any = r.doc?.du_an ?? null;
      const maCSTong = ttHopDong.MaCSTong || policy?.pricing_config_id || null;
      const maTDTT = ttHopDong.MaTDTT || policy?.payment_schedule_id || null;
      const pricingConfig: any = r.cau_hinh_tinh_gia ? { ...r.cau_hinh_tinh_gia, name: r.cau_hinh_tinh_gia.ten } : null;
      const paymentSchedule: any = r.lich_tt ?? null;
      const settings: any = r.cai_dat ?? null;

      // Giữ bản chụp quà tặng; thiếu thì bổ sung từ danh mục máy chủ đã trả kèm.
      const khuyenMai: any[] = Array.isArray(pgc?.khuyen_mai) ? pgc.khuyen_mai : [];
      const catalogById = new Map<string, any>((Array.isArray(r.khuyen_mai) ? r.khuyen_mai : []).map((c: any) => [String(c.id).toLowerCase(), c]));
      const promotions = khuyenMai.map((value: any) => {
        const km = jsonObject(value);
        const promotionId = [km.ID, km.MaKM, km.id].find((v) => UUID_RE.test(String(v ?? "")));
        const catalog = promotionId ? catalogById.get(String(promotionId).toLowerCase()) : null;
        return {
          id: promotionId ?? null,
          tenKhuyenMai: km.TenKhuyenMai || km.ten_khuyen_mai || catalog?.ten_khuyen_mai || null,
          tenQuaTang: km.TenQuaTang || km.ten_qua_tang || catalog?.ten_qua_tang || null,
          soLuong: numberOrNull(km.SoLuong ?? km.so_luong ?? catalog?.so_luong),
          giaTri: numberOrNull(km.GiaTri ?? km.gia_tri ?? catalog?.gia_tri),
        };
      });

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
  /**
   * Danh sách phiếu lock (fn_nv_app_lock_list = fn_product_lock_list của web: phạm vi chứng từ /sales/locks + dự án được gán,
   * tìm theo số phiếu / ký hiệu / mã SP). payload: { maDA?: mã dự án | uuid | mảng, keyword?, limit? }.
   * Nhiều dự án ⇒ gọi từng dự án rồi gộp (máy chủ nhận 1 dự án / lần).
   */
  listProductLocks: async (payload: any = {}) => {
    try {
      const raw: any[] = Array.isArray(payload?.maDA) ? payload.maDA : payload?.maDA != null && payload?.maDA !== "" ? [payload.maDA] : [];
      const ids = (await Promise.all(raw.map((x) => DuAnApi.resolveId(x)))).filter((x): x is string => !!x);
      if (raw.length > 0 && ids.length === 0) return { data: [] };
      const size = Math.max(1, Math.min(5000, Number(payload?.limit ?? 500) || 500));
      const kw = String(payload?.keyword ?? "").trim() || null;
      const targets: (string | null)[] = ids.length ? ids : [null];
      const pages = await Promise.all(targets.map((pid) =>
        callNv<{ rows: any[] }>("fn_nv_app_lock_list", { p_du_an_id: pid, p_tu_khoa: kw, p_trang: 1, p_so_dong: size })));
      const rows = pages.flatMap((p) => p?.rows ?? []);
      rows.sort((x, y) => String(y?.ngay_lock ?? "").localeCompare(String(x?.ngay_lock ?? "")));
      return { data: rows.slice(0, size).map((r: any, i: number) => normalizeLock(r, i)) };
    } catch (e) {
      console.log("ERROR listProductLocks (fn_nv_app_lock_list):", nvErrorMessage(e));
      return { data: [], error: nvErrorMessage(e) };
    }
  },

  /** Chi tiết 1 phiếu lock (fn_nv_app_lock_chi_tiet — phạm vi như web). */
  getLockDetailCloud: async (payload: any = {}) => {
    const id = payload?.ID ?? payload?.id;
    if (!id) return { data: null };
    try {
      const r = await callNv<any>("fn_nv_app_lock_chi_tiet", { p_id: String(id) });
      return { data: r ? normalizeLock(r, 0) : null };
    } catch (e) {
      console.log("ERROR getLockDetailCloud (fn_nv_app_lock_chi_tiet):", nvErrorMessage(e));
      return { data: null, error: nvErrorMessage(e) };
    }
  },

  /**
   * Lock căn — 1 lời gọi fn_nv_app_lock_tao (máy chủ: phút lock theo cài đặt bán hàng, số phiếu không trùng, 2 ⇒ 18 + phiếu
   * LOCK trong cùng giao dịch). payload: { sanPhamId (uuid) | maSP }. Trả { status: 2000, data: giây, soPhieu } như bản cũ.
   */
  createLock: async (payload: any = {}) => {
    try {
      let spId = String(payload?.sanPhamId ?? payload?.ID ?? "").trim();
      if (!UUID_RE.test(spId)) {
        const key = String(payload?.maSP ?? payload?.MaSP ?? payload?.kyHieu ?? payload?.KyHieu ?? "").trim();
        if (!key) return { status: 5000, message: "Thiếu mã sản phẩm" };
        const d = await SanPhamApi.detail(key);
        spId = d?.product?.ID ?? "";
        if (!spId) return { status: 5000, message: "Không tìm thấy sản phẩm" };
      }
      const r = await callNv<any>("fn_nv_app_lock_tao", { p_san_pham_id: spId });
      return { status: 2000, data: Number(r?.so_giay) || 0, soPhieu: r?.so_phieu ?? null, lockId: r?.id ?? null };
    } catch (e) {
      return { status: 5000, message: nvErrorMessage(e, "Không lock được căn này") };
    }
  },

  /**
   * Hết hạn lock: máy chủ chuyển phiếu LOCKED quá hạn sang EXPIRED và TRẢ CĂN về trạng thái thực tế (fn_nv_app_lock_het_han =
   * fn_product_lock_expire_due của web; job nền 5 phút vẫn chạy). Lỗi ⇒ bỏ qua (không chặn màn).
   */
  sweepExpiredLocks: async () => {
    try {
      const ids = await callNv<any[]>("fn_nv_app_lock_het_han", {});
      return { data: Array.isArray(ids) ? ids : [] };
    } catch (e) {
      console.log("sweepExpiredLocks (fn_nv_app_lock_het_han):", nvErrorMessage(e));
      return { data: [] };
    }
  },

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
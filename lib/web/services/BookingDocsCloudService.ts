// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/BookingDocsCloudService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * BookingDocsCloudService — chứng từ phụ của BOOKING GIỮ CHỖ (public.cloud_bookings).
 *
 * Gồm: đổi tên (cloud_booking_renames), phiếu hoàn (cloud_booking_refunds) và nhật ký thao tác (cloud_booking_doc_logs).
 * Liên kết theo (ma_ctdk, ma_pgc) giống bảng cloud_bookings. Cloud-first.
 * Đổi căn booking dùng chung luồng đặt cọc: ProductChangeService (bds_product_changes, 2026-10-16).
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { readCloudTenant } from "./cloudTenant";
import { sessionClaims } from "../_shims/lib/session";
import { DataScopeService } from "./DataScopeService";
import { getCustomerFromCloud, saveCustomerToCloud } from "./CustomerCloudService";
import { clearApiCache } from "../lib/apiCache";
import { isUuid, salesTenantUid, resolveStatusUid } from "./salesDocsCloud";
import { clearSalesDocsCache } from "./SalesDocListService";
import { stateFor } from "./bookingStateResolver";
import { productStatusFor } from "./productStateResolver";
import { luuLichThanhToan } from "./sales/lich-thanh-toan";
import { cleanCompanyIds } from "../_extract/services/system/permitted-company";
import { mapBookingRefundRow } from "./preBooking/refundRows";
import {
  applyCoOwnersToCustomerJson,
  lifecycleCoOwnerIds,
  normalizeCoOwnerIds,
} from "./preBooking/coOwners";
import { resolveCoOwnerUids } from "./preBooking/coOwnerRefs";
import { getHostForm } from "../lib/hostForm";

const tenant = () => (readCloudTenant() || "").toLowerCase();
const table = (name: string) => supabase.from(name as any);

export const currentUserName = (): string => {
  const c: any = sessionClaims() || {};
  return (
    c.ho_ten || c.HoTen || c.full_name || c.name || c.ma_nv || c.MaNV || c.email || "—"
  );
};

const ownerId = () => {
  try {
    return DataScopeService.ownerEmployeeId?.() ?? null;
  } catch {
    return null;
  }
};

const ok = (data: any = null) => ({ status: 2000, data, message: undefined as any });
const fail = (message: string) => ({ status: 5000, message, data: null });

export type BookingDocStatus = "PENDING" | "APPROVED" | "REJECTED";
export type BookingDocKind = "RENAME" | "REFUND";

const TBL: Record<BookingDocKind, string> = {
  RENAME: "cloud_booking_renames",
  REFUND: "cloud_booking_refunds",
};

/* ------------------------------------------------------------------ */
/* Nhật ký thao tác                                                    */
/* ------------------------------------------------------------------ */

export const writeBookingLog = async (payload: {
  MaPGC: string;
  Loai: BookingDocKind | "BOOKING";
  HanhDong: string;
  NoiDung?: string | null;
  Raw?: any;
}) => {
  const ma_ctdk = tenant();
  if (!ma_ctdk || !payload?.MaPGC) return;
  try {
    await table("cloud_booking_doc_logs").insert({
      ma_ctdk,
      ma_pgc: String(payload.MaPGC),
      loai: payload.Loai,
      hanh_dong: payload.HanhDong,
      noi_dung: payload.NoiDung ?? null,
      nguoi_thuc_hien: currentUserName(),
      nguoi_nhap_id: ownerId(),
      raw: payload.Raw ?? null,
    } as any);
  } catch (e) {
    console.warn("[BookingDocs] không ghi được nhật ký:", e);
  }
};

export const listBookingLogs = async (maPGC: string) => {
  const ma_ctdk = tenant();
  if (!ma_ctdk || !maPGC) return [];
  const { data, error } = await table("cloud_booking_doc_logs")
    .select("*")
    .eq("ma_ctdk", ma_ctdk)
    .eq("ma_pgc", String(maPGC))
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return data || [];
};

/* ------------------------------------------------------------------ */
/* Đọc chung                                                           */
/* ------------------------------------------------------------------ */

export const listBookingDocs = async (
  kind: BookingDocKind,
  opts: { MaPGC?: string | null; TrangThai?: BookingDocStatus | null } = {},
) => {
  const ma_ctdk = tenant();
  if (!ma_ctdk) return [];
  let q = table(TBL[kind]).select("*").eq("ma_ctdk", ma_ctdk);
  if (opts.MaPGC) q = q.eq("ma_pgc", String(opts.MaPGC));
  if (opts.TrangThai) q = q.eq("trang_thai", opts.TrangThai);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(500);
  if (error) throw error;
  return data || [];
};

export const hasPendingDoc = async (kind: BookingDocKind, maPGC: string) => {
  const rows = await listBookingDocs(kind, { MaPGC: maPGC, TrangThai: "PENDING" });
  return rows.length > 0;
};

/* ------------------------------------------------------------------ */
/* Cập nhật booking gốc                                                */
/* ------------------------------------------------------------------ */

const bookingByMaPGC = async (maPGC: string) => {
  const tenantId = salesTenantUid();
  if (!tenantId) return null;
  const key = String(maPGC ?? "").trim();
  if (!key) return null;

  // Booking liên kết vòng đời bằng UUID; chứng từ cũ có thể lưu số phiếu.
  if (isUuid(key)) {
    const { data: byUid } = await table("cloud_bookings")
      .select("*")
      .eq("ma_ctdk_id", tenantId)
      .eq("loai_ct", "BOOKING")
      .or(`ma_pgc_id.eq.${key},id.eq.${key}`)
      .maybeSingle();
    if (byUid) return byUid as any;

    const { data: lifecycle } = await table("cloud_pgc_phieu_giucho")
      .select("so_phieu_gc")
      .eq("ma_ctdk_uid", tenantId)
      .eq("id", key)
      .maybeSingle();
    const soPhieu = String((lifecycle as any)?.so_phieu_gc ?? "").trim();
    if (soPhieu) {
      const { data: byVoucher } = await table("cloud_bookings")
        .select("*")
        .eq("ma_ctdk_id", tenantId)
        .eq("loai_ct", "BOOKING")
        .eq("so_phieu", soPhieu)
        .maybeSingle();
      if (byVoucher) return byVoucher as any;
    }
    return null;
  }

  const { data } = await table("cloud_bookings")
    .select("*")
    .eq("ma_ctdk_id", tenantId)
    .eq("loai_ct", "BOOKING")
    .eq("so_phieu", key)
    .maybeSingle();
  return (data as any) || null;
};

export const getBookingRow = bookingByMaPGC;

/** Dòng vòng đời (cloud_pgc_phieu_giucho) ứng với 1 booking. */
const lifecycleByBooking = async (key: string, booking: any) => {
  const tenantId = salesTenantUid();
  if (!tenantId) return null;
  const refs = Array.from(
    new Set(
      [key, booking?.ma_pgc_id, booking?.ma_pgc, booking?.so_phieu]
        .map((v) => String(v ?? "").trim())
        .filter(Boolean),
    ),
  );
  for (const ref of refs) {
    if (!isUuid(ref)) continue;
    const { data } = await table("cloud_pgc_phieu_giucho")
      .select("*")
      .eq("ma_ctdk_uid", tenantId)
      .eq("id", ref)
      .maybeSingle();
    if (data) return data as any;
  }
  const vouchers = refs.filter((r) => !isUuid(r));
  if (vouchers.length) {
    const { data } = await table("cloud_pgc_phieu_giucho")
      .select("*")
      .eq("ma_ctdk_uid", tenantId)
      .in("so_phieu_gc", vouchers)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data as any;
  }
  return null;
};

/** Chuỗi khác rỗng đầu tiên (bỏ null / "" / khoảng trắng) */
const firstText = (...vals: any[]): string | null => {
  for (const v of vals) {
    if (v != null && String(v).trim() !== "") return String(v);
  }
  return null;
};

/** Các trường thông tin khách lưu trong tt_khach_hang (khoá chính → khoá đồng nghĩa cũ) */
const KH_FIELDS: [string, string[]][] = [
  ["TenKH", ["HoTen"]],
  ["DiDong", ["DienThoai"]],
  ["Email", []],
  ["SoCMND", ["CCCD"]],
  ["DiaChi", ["ThuongTru"]],
];

/**
 * Thông tin khách của phiếu: theo thứ tự `nhap` (form) → `ttKH` (tt_khach_hang của phiếu) → khách hàng gốc
 * (cloud_customers theo `khId`). Không bao giờ lấy chuỗi rỗng khi nguồn sau có giá trị; khách gốc chỉ đọc khi thiếu.
 * (cloud_bookings không còn cột khach_hang / di_dong / email — không đọc từ booking.)
 */
const resolveCustomerInfo = async (
  khId: string | null,
  ttKH: any,
  nhap: Record<string, any> = {},
): Promise<Record<string, string | null>> => {
  const pick = (goc: any) =>
    Object.fromEntries(
      KH_FIELDS.map(([k, alias]) => [
        k,
        firstText(nhap[k], ttKH?.[k], ...alias.map((a) => ttKH?.[a]), goc?.[k]),
      ]),
    ) as Record<string, string | null>;
  let out = pick(null);
  if (khId && isUuid(khId) && Object.values(out).some((v) => v == null)) {
    const goc = await getCustomerFromCloud(khId).catch(() => null);
    if (goc) out = pick(goc);
  }
  return out;
};

/**
 * Chi tiết booking phục vụ form SỬA — gộp dữ liệu từ cloud_bookings +
 * cloud_pgc_phieu_giucho + sản phẩm (bds_products), trả về đúng shape mà
 * BookingFormDialog dùng lúc tạo booking từ sản phẩm mở bán.
 */
export const getBookingEditDetail = async (key: string) => {
  const k = String(key ?? "").trim();
  if (!k) return null;
  const booking = await bookingByMaPGC(k);
  const life = await lifecycleByBooking(k, booking);
  if (!booking && !life) return null;

  // Sản phẩm → shape `product` của form tạo booking
  const spId = life?.san_pham_id ?? booking?.ma_sp_id ?? null;
  let product: any = null;
  if (spId && isUuid(String(spId))) {
    const { data: sp } = await table("bds_products")
      .select("*")
      .eq("id", String(spId))
      .maybeSingle();
    if (sp) {
      const s: any = sp;
      product = {
        id: s.id,
        MaSP: s.ma_sp ?? s.id,
        KyHieu: s.ky_hieu ?? booking?.ma_san_pham ?? null,
        MaDA: s.ma_da ?? booking?.ma_da_id ?? null,
        TenDA: booking?.ten_da ?? null,
        MaKhu: s.ma_khu ?? null,
        Khu: s.ma_khu ?? null,
        Tang: s.ma_tang ?? null,
        FormCode: s.form_code ?? null,
        TongGiaTriHDMB: s.tong_gia_tri_hdmb ?? s.tong_gia_gom_pbt ?? null,
        TongGiaGomVAT: s.tong_gia_gom_vat ?? null,
        TongGiaChuaVAT: s.tong_gia_chua_vat ?? null,
        TienVAT: s.tien_vat ?? null,
        PhiBaoTri: s.tien_phi_bao_tri ?? s.tien_pbt ?? s.pbt ?? null,
        DTTimTuong: s.dt_tim_tuong ?? null,
        DTThongThuy: s.dien_tich_thong_thuy ?? null,
        DonGiaThongThuy: s.don_gia_da_vat ?? s.dg_gom_vat ?? null,
        DienTichDat: s.dien_tich_dat ?? null,
        DonGiaDat: s.don_gia_dat ?? null,
        TongGiaDat: s.tong_gia_dat ?? null,
        DienTichXD: s.dien_tich_xd ?? null,
        DonGiaXD: s.don_gia_xay_dung ?? null,
        ThanhTienXD: s.thanh_tien_xd ?? null,
      };
    }
  }
  if (!product) {
    product = {
      id: spId ?? null,
      MaSP: booking?.ma_sp ?? life?.tt_hop_dong?.MaSP ?? null,
      KyHieu: booking?.ma_san_pham ?? life?.tt_hop_dong?.MaCan ?? null,
      MaDA: booking?.ma_da_id ?? life?.project_id ?? null,
      TenDA: booking?.ten_da ?? null,
    };
  }

  // Giá Naked đã chốt trên phiếu, không theo bảng giá hay sản phẩm hiện tại
  const pgcId = life?.id ?? booking?.ma_pgc_id ?? null;
  const { data: dongGia } = pgcId
    ? await table("cloud_pgc_san_pham")
        .select("gia_naked")
        .eq("phieu_giu_cho_id", String(pgcId))
        .order("created_at", { ascending: true })
        .limit(1)
    : { data: null };
  const giaNaked = (dongGia as any[] | null)?.[0]?.gia_naked;
  product.GiaNaked = giaNaked == null || giaNaked === "" ? null : Number(giaNaked);

  // Đổi mã UUID → tên hiển thị cho tiêu đề form (dự án, khu, tầng)
  try {
    const maDA = product?.MaDA ?? null;
    const tenDA = String(product?.TenDA ?? "");
    if (!tenDA || isUuid(tenDA)) {
      if (maDA && isUuid(String(maDA))) {
        const { data: da } = await table("da_projects")
          .select("ten_da")
          .eq("id", String(maDA))
          .maybeSingle();
        const tenDAName = (da as any)?.ten_da;
        if (tenDAName) product.TenDA = tenDAName;
      }
      if (!product.TenDA || isUuid(String(product.TenDA)))
        product.TenDA = null;
    }
    const catalogIds = [product?.Khu, product?.Tang]
      .map((x) => String(x ?? ""))
      .filter((x) => isUuid(x));
    if (catalogIds.length) {
      const { data: cats } = await table("cloud_catalogs")
        .select("id, item_name")
        .in("id", catalogIds);
      const nameOf = (id: any) =>
        ((cats ?? []) as any[]).find((c: any) => String(c.id) === String(id))
          ?.item_name ?? null;
      if (isUuid(String(product?.Khu ?? ""))) product.Khu = nameOf(product.Khu);
      if (isUuid(String(product?.Tang ?? "")))
        product.Tang = nameOf(product.Tang);
    }
  } catch (e) {
    console.error("Resolve tên dự án/khu/tầng cho form sửa booking failed", e);
  }

  const ttHD = (life?.tt_hop_dong as any) ?? {};
  const ttKH = (life?.tt_khach_hang as any) ?? {};
  const km = Array.isArray(life?.khuyen_mai) ? life.khuyen_mai : [];
  const maKH = life?.khach_hang_id ?? booking?.khach_hang_id ?? ttKH?.MaKH ?? null;
  // tt_khach_hang thường trống (phiếu tạo qua fn_booking_create) → lấy từ khách hàng gốc
  const kh = await resolveCustomerInfo(maKH ? String(maKH) : null, ttKH);

  return {
    maPGC: life?.id ?? booking?.ma_pgc_id ?? booking?.ma_pgc ?? k,
    soPhieu: life?.so_phieu_gc ?? booking?.so_phieu ?? k,
    product,
    customer: {
      MaKH: maKH,
      TenKH: kh.TenKH ?? "",
      DiDong: kh.DiDong ?? "",
      Email: kh.Email ?? "",
      SoCMND: kh.SoCMND ?? "",
      DiaChi: kh.DiaChi ?? "",
    },
    maSan: life?.san_id ?? booking?.ma_san_id ?? null,
    uuTien: Number((life?.payload as any)?.UuTien ?? 0) ? 1 : 0,
    tienGiuCho: Number(booking?.tien_giu_cho ?? life?.tien_coc ?? 0) || null,
    priceListId: life?.price_list_id ?? ttHD?.MaDotGia ?? null,
    quyCanId: ttHD?.MaQuyCan ?? null,
    // Công ty bán hàng: cùng khóa với Cọc / HĐ (ContractForm đọc lại khi lên cọc từ booking)
    congTyBanHangId: ttHD?.CongTyBanHangId ? String(ttHD.CongTyBanHangId) : null,
    congTyBanHangTen: ttHD?.TenCongTyBanHang ? String(ttHD.TenCongTyBanHang) : null,
    policyId: life?.sales_policy_id ?? ttHD?.MaCS ?? null,
    pricingConfigId: life?.pricing_config_id ?? ttHD?.MaCSTong ?? null,
    scheduleId: life?.payment_schedule_id ?? ttHD?.MaTDTT ?? null,
    promotionIds: Array.isArray(life?.promotion_ids) && life.promotion_ids.length
      ? life.promotion_ids.map(String)
      : km.map((x: any) => String(x?.ID ?? x?.MaKM ?? "")).filter(Boolean),
  };
};

/**
 * Cập nhật đầy đủ booking từ form sửa: ghi cloud_pgc_phieu_giucho (bảng chính)
 * rồi đồng bộ các cột hiển thị sang cloud_bookings.
 */
export const updateBookingFull = async (
  key: string,
  input: {
    MaKH?: any;
    TenKH?: string;
    DiDong?: string;
    Email?: string;
    SoCMND?: string;
    DiaChi?: string;
    MaSan?: any;
    TienGiuCho?: number | null;
    UuTien?: number;
    MaDotGia?: any;
    /** uuid quỹ căn (dm_quy_can); không gửi khóa = giữ giá trị đã lưu */
    MaQuyCan?: string | null;
    /** Công ty bán hàng (tt_hop_dong.CongTyBanHangId); không gửi khóa = giữ giá trị đã lưu, null = bỏ chọn */
    CongTyBanHangId?: string | null;
    TenCongTyBanHang?: string | null;
    MaCS?: any;
    MaCSTong?: any;
    /** Tiến độ thanh toán; không gửi khóa = giữ giá trị đã lưu (form Booking không còn ô này) */
    MaTDTT?: any;
    KhuyenMai?: any[];
    /** Không gửi khóa = giữ lịch thanh toán đã lưu */
    LichThanhToan?: any[];
  },
) => {
  try {
    const tenantId = salesTenantUid();
    const booking = await bookingByMaPGC(key);
    const life = await lifecycleByBooking(key, booking);
    if (!booking && !life) return fail("Không tìm thấy booking");

    const khId = isUuid(String(input.MaKH ?? "")) ? String(input.MaKH) : null;
    // Thông tin khách: form → tt_khach_hang cũ → khách hàng gốc; không ghi đè giá trị có sẵn bằng chuỗi rỗng.
    // Đổi sang khách khác → bỏ tt_khach_hang cũ (của khách trước).
    const prevKH = (life?.tt_khach_hang as any) || {};
    const khCu = String(life?.khach_hang_id ?? prevKH?.MaKH ?? booking?.khach_hang_id ?? "");
    const baseKH = khId && khCu && khId !== khCu ? {} : prevKH;
    const kh = await resolveCustomerInfo(khId ?? (khCu || null), baseKH, input);
    const ttKH = {
      ...baseKH,
      ...(khId ? { MaKH: khId } : {}),
      TenKH: kh.TenKH,
      HoTen: kh.TenKH,
      DiDong: kh.DiDong,
      DienThoai: kh.DiDong,
      Email: kh.Email,
      SoCMND: kh.SoCMND,
      CCCD: kh.SoCMND,
      DiaChi: kh.DiaChi,
    };
    const sanId = isUuid(String(input.MaSan ?? "")) ? String(input.MaSan) : null;
    // Đại lý phân phối không bắt buộc (booking-ctbh-dai-ly): gửi khóa MaSan rỗng / null ⇒ bỏ chọn; mã không phải uuid (dữ liệu cũ) ⇒ không ghi
    const sanBoChon = "MaSan" in input && String(input.MaSan ?? "").trim() === "";
    // Form Booking bỏ ô Tiến độ thanh toán ⇒ không gửi khóa MaTDTT / LichThanhToan: giữ TĐTT đã lưu
    const coTDTT = "MaTDTT" in input;
    const coLTT = "LichThanhToan" in input;
    const promoIds = (input.KhuyenMai ?? [])
      .map((x: any) => String(x?.ID ?? x?.MaKM ?? x ?? ""))
      .filter((v) => isUuid(v));

    if (life?.id && tenantId) {
      const payload = { ...((life.payload as any) || {}) };
      const congTy =
        input.CongTyBanHangId !== undefined
          ? { CongTyBanHangId: input.CongTyBanHangId || null, TenCongTyBanHang: input.CongTyBanHangId ? input.TenCongTyBanHang ?? null : null }
          : {};
      payload.TTHopDong = {
        ...((payload.TTHopDong as any) || {}),
        MaDotGia: input.MaDotGia ?? null,
        ...(input.MaQuyCan !== undefined ? { MaQuyCan: input.MaQuyCan } : {}),
        ...congTy,
        MaCS: input.MaCS ?? null,
        MaCSTong: input.MaCSTong ?? null,
        ...(coTDTT ? { MaTDTT: input.MaTDTT ?? null } : {}),
        TenKH: kh.TenKH,
        DiDong: kh.DiDong,
      };
      payload.TTKhachHang = ttKH;
      if (coLTT) payload.LichThanhToan = input.LichThanhToan ?? [];
      payload.KhuyenMai = input.KhuyenMai ?? [];
      payload.UuTien = input.UuTien ?? 0;

      const patch: Record<string, any> = {
        tt_khach_hang: ttKH,
        payload,
        tt_hop_dong: {
          ...((life.tt_hop_dong as any) || {}),
          MaDotGia: input.MaDotGia ?? null,
          ...(input.MaQuyCan !== undefined ? { MaQuyCan: input.MaQuyCan } : {}),
          ...congTy,
          MaCS: input.MaCS ?? null,
          MaCSTong: input.MaCSTong ?? null,
          ...(coTDTT ? { MaTDTT: input.MaTDTT ?? null } : {}),
        },
        ma_dot_gia: input.MaDotGia ? String(input.MaDotGia) : null,
        ma_cs: input.MaCS ? String(input.MaCS) : null,
        price_list_id: isUuid(String(input.MaDotGia ?? ""))
          ? String(input.MaDotGia)
          : null,
        sales_policy_id: isUuid(String(input.MaCS ?? ""))
          ? String(input.MaCS)
          : null,
        pricing_config_id: isUuid(String(input.MaCSTong ?? ""))
          ? String(input.MaCSTong)
          : null,
        ...(coTDTT ? { payment_schedule_id: isUuid(String(input.MaTDTT ?? "")) ? String(input.MaTDTT) : null } : {}),
        promotion_ids: promoIds.length ? promoIds : null,
        khuyen_mai: input.KhuyenMai ?? [],
        updated_at: new Date().toISOString(),
      };
      if (khId) patch.khach_hang_id = khId;
      if (sanId) patch.san_id = sanId;
      else if (sanBoChon) patch.san_id = null;
      if (input.TienGiuCho != null) patch.tien_coc = input.TienGiuCho;

      const { error } = await table("cloud_pgc_phieu_giucho")
        .update(patch as any)
        .eq("id", life.id)
        .eq("ma_ctdk_uid", tenantId);
      if (error) throw error;
      if (coLTT) await luuLichThanhToan(life.id, input.LichThanhToan ?? []);
    }

    if (booking?.id) {
      // cloud_bookings chỉ còn cột khoá / số liệu (không còn khach_hang, di_dong, email, raw); thông tin khách,
      // ưu tiên và cấu hình bán hàng nằm ở phiếu (tt_khach_hang, payload, tt_hop_dong) đã ghi ở trên
      const mirror: Record<string, any> = {};
      if (khId) mirror.khach_hang_id = khId;
      if (sanId) mirror.ma_san_id = sanId;
      else if (sanBoChon) mirror.ma_san_id = null;
      if (input.TienGiuCho != null) mirror.tien_giu_cho = input.TienGiuCho;
      if (Object.keys(mirror).length) await patchBooking(key, mirror);
    }

    await writeBookingLog({
      MaPGC: String(life?.id ?? booking?.ma_pgc ?? key),
      Loai: "BOOKING",
      HanhDong: "UPDATE",
      NoiDung: "Cập nhật booking (form sửa)",
      Raw: input,
    });
    clearApiCache();
    return ok(true);
  } catch (e: any) {
    return fail(e?.message || "Không cập nhật được booking");
  }
};

const patchBooking = async (maPGC: string, patch: Record<string, any>) => {
  const booking = await bookingByMaPGC(maPGC);
  if (!booking?.id) throw new Error("Không tìm thấy booking cần cập nhật");
  const { data, error } = await table("cloud_bookings")
    .update({ ...patch, updated_at: new Date().toISOString() } as any)
    .eq("id", booking.id)
    .select("id");
  if (error) throw error;
  // RLS bỏ qua im lặng khi booking nằm ngoài phạm vi của người duyệt ⇒ báo lỗi thay vì coi như đã cập nhật
  if (!Array.isArray(data) || data.length === 0)
    throw new Error("Không cập nhật được booking (ngoài phạm vi của bạn hoặc đã bị xoá)");
};

/** Dòng vòng đời (`cloud_pgc_phieu_giucho`) của booking thường — theo uuid `ma_pgc` hoặc số phiếu. */
type BookingLifecycleRow = {
  id: string;
  tt_khach_hang?: Record<string, unknown> | null;
  payload?: Record<string, unknown> | null;
};
const bookingLifecycleRows = async (
  booking: { so_phieu?: unknown } | null | undefined,
  doc: { so_phieu?: unknown; ma_pgc?: unknown },
): Promise<BookingLifecycleRow[]> => {
  const tenantId = salesTenantUid();
  if (!tenantId) return [];
  const refs = Array.from(
    new Set(
      [booking?.so_phieu, doc?.so_phieu, doc?.ma_pgc]
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
  if (!refs.length) return [];

  let lifecycleQuery = table("cloud_pgc_phieu_giucho")
    .select("id,tt_khach_hang,payload")
    .eq("ma_ctdk_uid", tenantId);
  lifecycleQuery = isUuid(doc?.ma_pgc)
    ? lifecycleQuery.or(`id.eq.${doc.ma_pgc},so_phieu_gc.in.(${refs.join(",")})`)
    : lifecycleQuery.in("so_phieu_gc", refs);
  const { data: rows, error: readError } = await lifecycleQuery;
  if (readError) throw readError;
  return (rows as unknown as BookingLifecycleRow[]) || [];
};

/**
 * Danh sách Booking ưu tiên dữ liệu từ bảng vòng đời khi cùng số phiếu, nên
 * duyệt đổi tên phải cập nhật đồng thời cả mirror và dòng vòng đời tương ứng.
 * Hàm này chỉ dùng cho Booking thường, không chạm các bảng Booking thiện chí.
 */
const patchBookingLifecycleCustomer = async (
  booking: any,
  customerId: string | null,
  doc: any,
) => {
  const tenantId = salesTenantUid();
  if (!tenantId) return;

  const customerSnapshot: Record<string, any> = {
    TenKH: doc.ten_kh_moi,
    HoTen: doc.ten_kh_moi,
    DiDong: doc.di_dong_moi ?? null,
    DienThoai: doc.di_dong_moi ?? null,
    Email: doc.email_moi ?? null,
    SoCMND: doc.so_cmnd_moi ?? null,
    CCCD: doc.so_cmnd_moi ?? null,
  };
  if (customerId) customerSnapshot.MaKH = customerId;

  // Người đồng đứng tên: yêu cầu cũ (dong_so_huu_moi null) ⇒ giữ nguyên
  const coOwners = Array.isArray(doc?.dong_so_huu_moi) ? normalizeCoOwnerIds(doc.dong_so_huu_moi) : null;

  for (const row of await bookingLifecycleRows(booking, doc)) {
    const currentCustomer = { ...((row.tt_khach_hang as any) || {}) };
    const nextCustomer = applyCoOwnersToCustomerJson({ ...currentCustomer, ...customerSnapshot }, coOwners);
    const payload = { ...((row.payload as any) || {}) };
    payload.TTKhachHang = {
      ...((payload.TTKhachHang as any) || {}),
      ...nextCustomer,
    };

    const { error } = await table("cloud_pgc_phieu_giucho")
      .update({
        ...(customerId ? { khach_hang_id: customerId } : {}),
        tt_khach_hang: nextCustomer,
        payload,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", row.id)
      .eq("ma_ctdk_uid", tenantId);
    if (error) throw error;
  }
};

/** Sửa nhanh thông tin booking (khách hàng, tiền giữ chỗ, ghi chú…). */
export const updateBookingInfo = async (
  maPGC: string,
  payload: {
    KhachHang?: string | null;
    DiDong?: string | null;
    Email?: string | null;
    KhachHangId?: string | null;
    TienGiuCho?: number | null;
    TongGia?: number | null;
    DaThu?: number | null;
    GhiChu?: string | null;
  },
) => {
  try {
    const cur = await bookingByMaPGC(maPGC);
    if (!cur) return fail("Không tìm thấy booking");
    const patch: Record<string, any> = {};
    if (payload.KhachHangId !== undefined) patch.khach_hang_id = payload.KhachHangId;
    if (payload.TienGiuCho !== undefined) patch.tien_giu_cho = payload.TienGiuCho;
    if (payload.TongGia !== undefined) patch.tong_gia = payload.TongGia;
    if (payload.DaThu !== undefined) patch.da_thu = payload.DaThu;

    await patchBooking(maPGC, patch);
    await writeBookingLog({
      MaPGC: maPGC,
      Loai: "BOOKING",
      HanhDong: "UPDATE",
      NoiDung: "Cập nhật thông tin booking",
      Raw: payload,
    });
    return ok(true);
  } catch (e: any) {
    return fail(e?.message || "Không cập nhật được booking");
  }
};

/* ------------------------------------------------------------------ */
/* Đổi tên                                                             */
/* ------------------------------------------------------------------ */

export const createBookingRename = async (payload: {
  MaPGC: string;
  SoPhieu?: string | null;
  TenKHCu?: string | null;
  DiDongCu?: string | null;
  KhachHangCuId?: string | null;
  TenKHMoi: string;
  DiDongMoi?: string | null;
  EmailMoi?: string | null;
  SoCMNDMoi?: string | null;
  KhachHangMoiId?: string | null;
  LyDo?: string | null;
  /** Người đồng đứng tên sau đổi tên (không gửi ⇒ duyệt không đổi đồng đứng tên). */
  DongSoHuuMoi?: (string | number)[];
}) => {
  const ma_ctdk = tenant();
  if (!ma_ctdk) return fail("Thiếu mã công ty đăng ký");
  if (!payload?.MaPGC) return fail("Thiếu mã booking");
  if (!payload?.TenKHMoi?.trim()) return fail("Vui lòng nhập tên khách hàng mới");
  try {
    if (await hasPendingDoc("RENAME", payload.MaPGC))
      return fail("Booking đang có một phiếu đổi tên chờ duyệt");

    const dsh = Array.isArray(payload.DongSoHuuMoi)
      ? await resolveCoOwnerUids(payload.DongSoHuuMoi, payload.KhachHangMoiId)
      : null;
    if (dsh && !dsh.ok) return fail(dsh.message);
    const dshCols: Record<string, unknown> = {};
    if (dsh?.ok) {
      const [row] = await bookingLifecycleRows(await bookingByMaPGC(String(payload.MaPGC)), {
        so_phieu: payload.SoPhieu,
        ma_pgc: payload.MaPGC,
      });
      dshCols.dong_so_huu_cu = lifecycleCoOwnerIds(row);
      dshCols.dong_so_huu_moi = dsh.ids;
    }

    const { data, error } = await table("cloud_booking_renames")
      .insert({
        ma_ctdk,
        ma_pgc: String(payload.MaPGC),
        so_phieu: payload.SoPhieu ?? null,
        ten_kh_cu: payload.TenKHCu ?? null,
        di_dong_cu: payload.DiDongCu ?? null,
        khach_hang_cu_id: payload.KhachHangCuId ?? null,
        ten_kh_moi: payload.TenKHMoi.trim(),
        di_dong_moi: payload.DiDongMoi ?? null,
        email_moi: payload.EmailMoi ?? null,
        so_cmnd_moi: payload.SoCMNDMoi ?? null,
        khach_hang_moi_id: payload.KhachHangMoiId ?? null,
        ly_do: payload.LyDo ?? null,
        trang_thai: "PENDING",
        nguoi_tao: currentUserName(),
        nguoi_nhap_id: ownerId(),
        ...dshCols,
      } as any)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    await writeBookingLog({
      MaPGC: payload.MaPGC,
      Loai: "RENAME",
      HanhDong: "CREATE",
      NoiDung: `Tạo phiếu đổi tên: ${payload.TenKHCu || "-"} → ${payload.TenKHMoi}`,
    });
    return ok((data as any)?.id ?? null);
  } catch (e: any) {
    return fail(e?.message || "Không tạo được phiếu đổi tên");
  }
};

/* ------------------------------------------------------------------ */
/* Phiếu hoàn                                                          */
/* ------------------------------------------------------------------ */

export const createBookingRefund = async (payload: {
  MaPGC: string;
  SoPhieu?: string | null;
  TenKH?: string | null;
  DiDong?: string | null;
  TenDA?: string | null;
  KyHieu?: string | null;
  SoTien: number;
  NgayHoan?: string | null;
  LyDo?: string | null;
  MaHinhThuc?: number | null;
  MaLyDo?: number | null;
  SoTaiKhoan?: string | null;
  NganHang?: string | null;
  GhiChu?: string | null;
}) => {
  const ma_ctdk = tenant();
  if (!ma_ctdk) return fail("Thiếu mã công ty đăng ký");
  if (!payload?.MaPGC) return fail("Thiếu mã booking");
  if (!(Number(payload?.SoTien) > 0)) return fail("Số tiền hoàn phải lớn hơn 0");
  try {
    // MỘT giao dịch ở máy chủ (`fn_booking_refund_create`, migration 20261016000200): kiểm trùng phiếu hoàn chờ duyệt toàn tenant,
    // tạo phiếu (người nhập / công ty theo JWT) và chuyển booking sang "Chờ hoàn tiền". Booking ngoài phạm vi (42501) / không
    // tìm thấy ⇒ lỗi, không tạo phiếu — không còn nuốt lỗi cập nhật booking.
    const state = await stateFor("REFUND_CREATE", "WAITING_REFUND");
    const { data, error } = await supabase.rpc("fn_booking_refund_create" as any, {
      p: {
        ma_pgc: String(payload.MaPGC),
        host_form: getHostForm(),
        so_phieu: payload.SoPhieu ?? null,
        ten_kh: payload.TenKH ?? null,
        di_dong: payload.DiDong ?? null,
        ten_da: payload.TenDA ?? null,
        ky_hieu: payload.KyHieu ?? null,
        so_tien: Number(payload.SoTien),
        ngay_hoan: payload.NgayHoan ?? new Date().toISOString(),
        ly_do: payload.LyDo ?? null,
        raw: {
          MaHinhThuc: payload.MaHinhThuc ?? null,
          MaLyDo: payload.MaLyDo ?? null,
          SoTaiKhoan: payload.SoTaiKhoan ?? null,
          NganHang: payload.NganHang ?? null,
          GhiChu: payload.GhiChu ?? null,
        },
      },
      p_booking_state: state,
    } as any);
    if (error) throw new Error(error.message || "Không tạo được phiếu hoàn");
    clearApiCache(`bookings:${ma_ctdk}:`);
    clearSalesDocsCache();
    await writeBookingLog({
      MaPGC: payload.MaPGC,
      Loai: "REFUND",
      HanhDong: "CREATE",
      NoiDung: `Tạo phiếu hoàn booking: ${Number(payload.SoTien).toLocaleString("vi-VN")} đ`,
    });
    return { ...ok((data as any)?.id ?? null), soPhieuChi: ((data as any)?.so_phieu_chi ?? null) as string | null };
  } catch (e: any) {
    return fail(e?.message || "Không tạo được phiếu hoàn");
  }
};

/* ------------------------------------------------------------------ */
/* Duyệt / từ chối                                                     */
/* ------------------------------------------------------------------ */

const setDocStatus = async (
  kind: BookingDocKind,
  id: string,
  trang_thai: BookingDocStatus,
  lyDoTuChoi?: string | null,
) => {
  // Phiếu hoàn: duyệt / từ chối chỉ qua RPC (fn_booking_refund_approve / _reject) — máy chủ chặn PATCH trạng thái trực tiếp
  if (kind === "REFUND") throw new Error("Phiếu hoàn chỉ được duyệt / từ chối qua máy chủ");
  const { error } = await table(TBL[kind])
    .update({
      trang_thai,
      nguoi_duyet: currentUserName(),
      ngay_duyet: new Date().toISOString(),
      ly_do_tu_choi: lyDoTuChoi ?? null,
      updated_at: new Date().toISOString(),
    } as any)
    .eq("id", id);
  if (error) throw error;
};

const docById = async (kind: BookingDocKind, id: string) => {
  const { data } = await table(TBL[kind]).select("*").eq("id", id).maybeSingle();
  return data as any;
};

/** Duyệt chứng từ → cập nhật lại booking tương ứng. */
export const approveBookingDoc = async (kind: BookingDocKind, id: string) => {
  try {
    if (kind === "REFUND") {
      // MỘT giao dịch ở máy chủ (`fn_booking_refund_approve`, migration 20261016000250): khoá phiếu, kiểm còn chờ duyệt (duyệt lại
      // / 2 người cùng duyệt ⇒ lỗi, không trừ tiền 2 lần), trừ "đã thu" + đổi trạng thái booking, nhả căn, rồi mới duyệt phiếu.
      const { data, error } = await supabase.rpc("fn_booking_refund_approve" as any, {
        p_id: id,
        p_booking_state: await stateFor("REFUND_APPROVE", "REFUND_APPROVED"),
        p_refund_status_id: (await resolveStatusUid("pgc_trang_thai", 3)) ?? null,
        p_product_status: await productStatusFor("BOOKING_CANCEL", "Còn trống"),
      } as any);
      if (error) throw new Error(error.message || "Không duyệt được chứng từ");
      clearApiCache(`bookings:${tenant()}:`);
      clearSalesDocsCache();
      await writeBookingLog({
        MaPGC: String((data as any)?.ma_pgc ?? ""),
        Loai: kind,
        HanhDong: "APPROVE",
        NoiDung: "Duyệt chứng từ và cập nhật booking",
      });
      return ok(true);
    }
    const doc = await docById(kind, id);
    if (!doc) return fail("Không tìm thấy chứng từ");
    if (doc.trang_thai !== "PENDING") return fail("Chứng từ đã được xử lý");
    const maPGC = String(doc.ma_pgc);

    if (kind === "RENAME") {
      // Lưu khách hàng mới vào danh mục khách hàng nếu chưa có
      let khId: string | null = doc.khach_hang_moi_id ?? null;
      if (!khId) {
        try {
          const saved: any = await saveCustomerToCloud({
            TenKH: doc.ten_kh_moi,
            DiDong: doc.di_dong_moi,
            DienThoai: doc.di_dong_moi,
            Email: doc.email_moi,
            CCCD: doc.so_cmnd_moi,
            LoaiKH: 1,
          });
          khId = saved?.data ?? null;
        } catch (e) {
          console.warn("[BookingDocs] không lưu được khách hàng mới:", e);
        }
      }
      const cur = await bookingByMaPGC(maPGC);
      await patchBooking(maPGC, {
        khach_hang_id: khId ?? cur?.khach_hang_id ?? null,
      });
      await patchBookingLifecycleCustomer(cur, khId, doc);
      if (khId && khId !== doc.khach_hang_moi_id)
        await table(TBL.RENAME).update({ khach_hang_moi_id: khId } as any).eq("id", id);
    }

    await setDocStatus(kind, id, "APPROVED");
    clearApiCache(`bookings:${tenant()}:`);
    clearSalesDocsCache();
    await writeBookingLog({
      MaPGC: maPGC,
      Loai: kind,
      HanhDong: "APPROVE",
      NoiDung: "Duyệt chứng từ và cập nhật booking",
    });
    return ok(true);
  } catch (e: any) {
    return fail(e?.message || "Không duyệt được chứng từ");
  }
};

export const rejectBookingDoc = async (
  kind: BookingDocKind,
  id: string,
  lyDo?: string | null,
) => {
  try {
    if (kind === "REFUND") {
      // Từ chối phiếu hoàn + trả booking về trạng thái trước khi tạo phiếu trong MỘT giao dịch (`fn_booking_refund_reject`):
      // booking ngoài phạm vi / không tìm thấy ⇒ lỗi, phiếu vẫn chờ duyệt (trước đây lỗi booking bị nuốt).
      const approvedId = await resolveStatusUid("pgc_trang_thai", 6);
      const { data, error } = await supabase.rpc("fn_booking_refund_reject" as any, {
        p_id: id,
        p_ly_do: lyDo ?? null,
        p_approved_status_id: approvedId ?? null,
      } as any);
      if (error) throw new Error(error.message || "Không từ chối được chứng từ");
      clearApiCache(`bookings:${tenant()}:`);
      clearSalesDocsCache();
      await writeBookingLog({
        MaPGC: String((data as any)?.ma_pgc ?? ""),
        Loai: kind,
        HanhDong: "REJECT",
        NoiDung: lyDo ? `Từ chối: ${lyDo}` : "Từ chối chứng từ",
      });
      return ok(true);
    }
    const doc = await docById(kind, id);
    if (!doc) return fail("Không tìm thấy chứng từ");
    if (doc.trang_thai !== "PENDING") return fail("Chứng từ đã được xử lý");
    await setDocStatus(kind, id, "REJECTED", lyDo ?? null);
    await writeBookingLog({
      MaPGC: String(doc.ma_pgc),
      Loai: kind,
      HanhDong: "REJECT",
      NoiDung: lyDo ? `Từ chối: ${lyDo}` : "Từ chối chứng từ",
    });
    return ok(true);
  } catch (e: any) {
    return fail(e?.message || "Không từ chối được chứng từ");
  }
};

export const deleteBookingDoc = async (kind: BookingDocKind, id: string) => {
  try {
    if (kind === "REFUND") {
      // MỘT giao dịch ở máy chủ (`fn_booking_refund_delete`, migration 20261016000300): quyền Xoá, khoá phiếu, phạm vi, phiếu đã
      // duyệt ⇒ lỗi (trước đây kiểm rồi xoá không điều kiện — phiếu vừa được duyệt vẫn bị xoá).
      const { data, error } = await supabase.rpc("fn_booking_refund_delete" as any, { p_id: id } as any);
      if (error) throw new Error(error.message || "Không xóa được chứng từ");
      clearSalesDocsCache();
      await writeBookingLog({
        MaPGC: String((data as any)?.ma_pgc ?? ""),
        Loai: kind,
        HanhDong: "DELETE",
        NoiDung: "Xóa chứng từ",
      });
      return ok(true);
    }
    const doc = await docById(kind, id);
    if (!doc) return fail("Không tìm thấy chứng từ");
    if (doc.trang_thai === "APPROVED")
      return fail("Chứng từ đã duyệt, không thể xóa");
    const { error } = await table(TBL[kind]).delete().eq("id", id);
    if (error) throw error;
    await writeBookingLog({
      MaPGC: String(doc.ma_pgc),
      Loai: kind,
      HanhDong: "DELETE",
      NoiDung: "Xóa chứng từ",
    });
    return ok(true);
  } catch (e: any) {
    return fail(e?.message || "Không xóa được chứng từ");
  }
};

/**
 * Danh sách phiếu hoàn của BOOKING GIỮ CHỖ, ánh xạ sang cấu trúc dùng chung
 * của màn "Hoàn booking" (không đụng tới luồng booking thiện chí).
 */
export const listBookingRefundRows = async (
  opts: {
    MaDA?: any;
    InputSearch?: string | null;
    TuNgay?: string | null;
    DenNgay?: string | null;
    CompanyIds?: string[] | null;
  } = {},
) => {
  // Cùng hàm với màn Hoàn booking (`fn_booking_refund_list`): máy chủ áp 3 lớp phạm vi + ép sàn đại lý,
  // chỉ lấy khối BOOKING (phiếu hoàn của booking giữ chỗ).
  const { data, error } = await supabase.rpc("fn_booking_refund_list" as any, {
    p: {
      project_id: isUuid(opts.MaDA) ? String(opts.MaDA) : null,
      san_id: null,
      search: String(opts.InputSearch ?? "").trim() || null,
      tu_ngay: opts.TuNgay || null,
      den_ngay: opts.DenNgay || null,
      deleted: false,
      page: 1,
      size: 5000,
      company_ids: cleanCompanyIds(opts.CompanyIds),
    },
  } as any);
  if (error) throw new Error(error.message || "Không tải được phiếu hoàn booking");
  const rows: any[] = (data as any)?.rows || [];
  return rows.filter((r) => r?.__src === "BOOKING").map(mapBookingRefundRow);
};

export const BookingDocsCloudService = {
  listBookingDocs,
  listBookingRefundRows,
  listBookingLogs,
  hasPendingDoc,
  getBookingRow,
  updateBookingInfo,
  createBookingRename,
  createBookingRefund,
  approveBookingDoc,
  rejectBookingDoc,
  deleteBookingDoc,
  writeBookingLog,
};

export default BookingDocsCloudService;

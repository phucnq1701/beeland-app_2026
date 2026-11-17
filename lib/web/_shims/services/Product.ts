/**
 * SHIM VIẾT TAY — thay web src/services/Product.js (service cũ, đọc thẳng bảng) cho module web chép ở lib/web.
 * Chỉ hàm luồng phiếu tính giá app dùng; còn lại ⇒ lỗi "App không hỗ trợ".
 *  - getSPByBG: như web (dòng giá của căn trong bảng giá ⇒ mapPriceListItem), đọc qua fn_nv_app_gia_trong_bang_gia (= cùng luật
 *    web: ưu tiên product_id, bảng giá cũ khớp mã căn; mọi cột như select *).
 *  - addBookingAPI: thân web chép nguyên (dựng body fn_booking_create), gọi fn_nv_app_booking_tao (SP 50 bọc usp_booking_create):
 *    máy chủ app tự điền công ty / người nhập (phiên), ngày giữ chỗ, hạn + tiền giữ chỗ theo đúng thứ tự web (chính sách > cài đặt).
 *  - addKhachHangAPI (tạo khách khi chưa chọn): app chưa hỗ trợ ⇒ lỗi (form web bắt buộc chọn khách nên không đi vào nhánh này).
 */
import { callNv, errorMessage } from "@/services/nvApi";
import { mapPriceListItem } from "../../services/priceListItem";
import { resolveBdsProductId } from "../../services/BdsProductService";
import { normalizeSanGiaoDich } from "../../services/SanGiaoDichCloudService";

/** Màn app nghe booking vừa tạo (form web chỉ gọi onSuccess() không kèm phiếu) ⇒ vào thẳng chi tiết booking để thu tiền */
const bookingListeners = new Set<(created: { BookingId?: string; MaPGC?: string; SoPhieu?: string }) => void>();
export function onWebBookingCreated(cb: (created: { BookingId?: string; MaPGC?: string; SoPhieu?: string }) => void) {
  bookingListeners.add(cb);
  return () => {
    bookingListeners.delete(cb);
  };
}

const unsupported = (name: string) => async () => {
  console.log(`[lib/web shim] app không hỗ trợ ProductService.${name}`);
  throw new Error(`App không hỗ trợ ProductService.${name}`);
};

export const ProductService: any = new Proxy(
  {
    /**
     * web Product.js getSanGiaoDichAPI = listSanGiaoDich (dm_companies is_san của công ty) — app đọc qua fn_nv_app_san_list (SP 53, cùng
     * luật web), chuẩn hoá bằng normalizeSanGiaoDich của web (ID = uuid công ty, TenCT = tên viết tắt / tên).
     */
    getSanGiaoDichAPI: async () => {
      const rows = await callNv<any[]>("fn_nv_app_san_list", {});
      const data = (Array.isArray(rows) ? rows : [])
        .map((r: any) => normalizeSanGiaoDich({ ...r, Id: r.id, ID: r.id, TenCT: r.ten_ct_vt || r.ten_ct, TenCTVT: r.ten_ct_vt }))
        .filter((x: any) => x.ID != null && !!x.TenCT);
      return { status: 2000, data };
    },
    /** web Product.js addBookingAPI — cùng payload / kết quả { status, data: { ...payload, MaPGC, PhieuGiuChoId, BookingId, SoPhieu } } */
    addBookingAPI: async (payload: any) => {
      const num = (v: any) => {
        if (v == null || v === "") return null;
        const n = Number(String(v).replace(/,/g, ""));
        return Number.isFinite(n) ? n : null;
      };
      const body = {
        san_pham_id: payload?.SanPhamId ?? null,
        ma_sp: payload?.MaSP ?? null,
        ky_hieu: payload?.KyHieu ?? payload?.MaSanPham ?? null,
        khach_hang_id: payload?.MaKH ?? null,
        san_id: payload?.MaSan ?? null,
        so_phieu: payload?.SoPhieu ?? null,
        ngay_giu_cho: payload?.NgayGiuCho ?? null,
        het_han_luc: payload?.HetHanLuc ?? null,
        tien_giu_cho: num(payload?.TienGiuCho),
        ghi_chu: payload?.GhiChu ?? null,
        price_list_id: payload?.MaDotGia ?? null,
        sales_policy_id: payload?.MaCS ?? null,
        pricing_config_id: payload?.MaCSTong ?? null,
        payment_schedule_id: payload?.MaTDTT ?? null,
        promotion_ids: (payload?.KhuyenMai || []).map((km: any) => km?.ID ?? km?.MaKM ?? km).filter(Boolean),
        chinh_sach: payload?.ChinhSach ?? [],
        lich_thanh_toan: payload?.LichThanhToan ?? [],
        khuyen_mai: payload?.KhuyenMai ?? [],
        payload: payload?.Payload ?? null,
        tt_hop_dong: payload?.Payload?.TTHopDong ?? null,
        tt_khach_hang: null,
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
          gia_naked: num(payload?.GiaNaked),
        },
      };
      let res: any;
      try {
        res = (await callNv<any>("fn_nv_app_booking_tao", { p_payload: body })) || {};
      } catch (e: any) {
        return { status: 500, message: errorMessage(e), cloudOnly: true };
      }
      const data = { ...payload, MaPGC: res.phieu_giu_cho_id, PhieuGiuChoId: res.phieu_giu_cho_id, BookingId: res.booking_id, SoPhieu: res.so_phieu };
      bookingListeners.forEach((cb) => cb(data));
      return { status: 2000, data, cloudOnly: true };
    },
    /** web Product.js getSPByBG — cùng tham số / kết quả { status, data } */
    getSPByBG: async (payload: any) => {
      const maSP = payload?.MaSP ?? payload?.maSP;
      const maDot = payload?.MaDot ?? payload?.MaDotGia;
      const rawProductKey = payload?.ProductId ?? payload?.productId ?? maSP ?? null;
      if ((!maSP && !rawProductKey) || !maDot) return { status: 2000, data: null };
      try {
        const productId = await resolveBdsProductId(rawProductKey, payload?.MaDA ?? payload?.maDA);
        const row = await callNv<any>("fn_nv_app_gia_trong_bang_gia", {
          p_bang_gia_id: String(maDot),
          p_san_pham_id: productId || null,
          p_ma_sp: maSP ? String(maSP) : null,
        });
        if (!row) return { status: 2000, data: null };
        return { status: 2000, data: mapPriceListItem(row) };
      } catch (e: any) {
        return { status: 5000, message: e?.message || "Không tải được giá theo bảng giá" };
      }
    },
  },
  { get: (t: any, k) => (k in t ? t[k] : typeof k === "string" ? unsupported(k) : undefined) }
);

export default ProductService;

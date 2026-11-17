/**
 * Đổi dữ liệu bộ API riêng app nhân viên (fn_nv_app_du_an_list / san_pham_list / so_do / san_pham_chi_tiet / san_pham_bo_loc)
 * sang dạng các màn đang dùng (PascalCase cũ: MaDA, MaSP, KyHieu, TenTT, ColorTT…). Thuần — không gọi mạng (test được).
 */

/** Máy chủ tệp (đường dẫn tương đối của dữ liệu cũ) — như resolveUploadUrl của web. */
export const FILE_SERVER = "https://upload.beesky.vn/";

/** Ảnh mặc định khi căn / dự án chưa có ảnh. */
export const DEFAULT_BANNER_URL = "https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/css461kotbkumrm0wjakm";

export function absUrl(u?: string | null): string {
  const s = String(u ?? "").trim();
  if (!s) return "";
  if (/^(https?:|data:|blob:)/i.test(s)) return s;
  return FILE_SERVER + s.replace(/^\/+/, "");
}

const v = (x: any) => (x === "" || x === undefined ? null : x);

/* ------------------------------ Dự án ------------------------------ */

export function mapProject(r: any) {
  const imageUrl = absUrl(r?.image_url);
  const bg = absUrl(r?.anh_background);
  const icon = absUrl(r?.anh_icon);
  const soDo = absUrl(r?.anh_so_do);
  const display = bg || icon || imageUrl;
  const statusText = String(r?.ten_tt ?? "").trim();
  const maTT = r?.ma_tt != null ? String(r.ma_tt) : "";
  return {
    id: r?.id,
    MaDA: r?.ma_da_code ?? r?.id,
    ma_da_code: r?.ma_da_code ?? null,
    TenDA: r?.ten_da || r?.ten_viet_tat || "Dự án",
    ten_da: r?.ten_da ?? null,
    ten_viet_tat: r?.ten_viet_tat ?? null,
    icon: display,
    background: display,
    anh_background: bg,
    anh_icon: icon,
    anh_so_do: soDo,
    anh_so_do_3d: absUrl(r?.anh_so_do_3d),
    image_url: imageUrl,
    mapImage: soDo || display,
    district: r?.dia_chi || "",
    dia_chi: r?.dia_chi || "",
    MaTT: maTT,
    ma_tt: maTT,
    TenTT: statusText,
    ten_tt: statusText,
    is_active: statusText.toLowerCase() === "đang bán",
    statusText: statusText || "Không xác định",
    ap_dung: true,
  };
}

/* ------------------------------ Bộ lọc ------------------------------ */

export function mapFilters(r: any) {
  const khu = (Array.isArray(r?.khu) ? r.khu : []).map((k: any) => ({ MaKhu: k.id, TenKhu: k.ten || k.ma || k.id }));
  const trangThai = (Array.isArray(r?.trang_thai) ? r.trang_thai : []).map((t: any) => ({
    MaTT: t.id,
    TenTT: t.ten ?? "",
    ColorWeb: t.mau || null,
    _raw: { id: t.id, item_code: t.ma, item_name: t.ten, color_code: t.mau },
  }));
  return { khu, trangThai };
}

/* ------------------------------ Danh sách căn ------------------------------ */

/** 1 dòng fn_nv_app_san_pham_list ⇒ dạng màn Sản phẩm / ô chọn căn. */
export function mapProductRow(r: any) {
  return {
    ID: v(r?.id),
    MaSP: v(r?.ma_sp),
    KyHieu: v(r?.ky_hieu),
    FormCode: v(r?.form_code),
    MaDA: v(r?.ma_da),
    TenDA: v(r?.ten_da),
    MaKhu: v(r?.ma_khu),
    TenKhu: v(r?.ten_khu),
    DienTichThongThuy: v(r?.dien_tich_thong_thuy),
    DTThongThuy: v(r?.dien_tich_thong_thuy),
    TongGomPBT: v(r?.tong_gom_pbt),
    TongGiaTriHDMB: v(r?.tong_gia_tri_hdmb ?? r?.tong_gom_pbt),
    MaTT: v(r?.ma_tt),
    MaTTCode: v(r?.tt_ma),
    TenTT: v(r?.tt_ten),
    ColorTT: v(r?.tt_mau),
  };
}

/* ------------------------------ Chi tiết căn ------------------------------ */

/** fn_nv_app_san_pham_chi_tiet ⇒ đối tượng căn (dạng normalizeProduct cũ, đủ trường cho tạo Booking / bảng giá). */
export function mapProductDetail(r: any) {
  if (!r || typeof r !== "object") return null;
  return {
    ID: v(r.id),
    MaSP: v(r.ma_sp),
    KyHieu: v(r.ky_hieu),
    FormCode: v(r.form_code),
    MaDA: v(r.ma_da),
    MaDACode: v(r.ma_da_code),
    TenDA: v(r.ten_da),
    DiaChi: v(r.dia_chi_da),
    MaKhu: v(r.ma_khu),
    TenKhu: v(r.ten_khu),
    MaPK: v(r.ma_pk),
    TenPK: v(r.ten_pk),
    MaTang: v(r.ma_tang),
    TenTang: v(r.ten_tang),
    Tang: v(r.ten_tang),
    ViTri: v(r.vi_tri),
    TenViTri: v(r.ten_vi_tri),
    SoCanHo: v(r.so_can_ho),
    SoPN: v(r.so_pn),
    TenLoaiPN: v(r.ten_loai_pn),
    MaLCH: v(r.ma_lch),
    TenLoaiCanHo: v(r.ten_loai_can),
    LoaiBDS: v(r.ten_loai_bds),
    TenHuongCua: v(r.ten_huong_cua),
    TenHuongBC: v(r.ten_huong_bc),
    TenView: v(r.ten_view),
    SoTang: v(r.so_tang),
    SoO: v(r.so_o),
    DienTich: v(r.dien_tich),
    DienTichThongThuy: v(r.dien_tich_thong_thuy),
    DTThongThuy: v(r.dien_tich_thong_thuy),
    DTTimDuong: v(r.dt_tim_tuong),
    DienTichDat: v(r.dien_tich_dat),
    DienTichXD: v(r.dien_tich_xd),
    TongDTXD: v(r.tong_dt_xd),
    DonGia: v(r.don_gia),
    DonGiaChuaVAT: v(r.don_gia_chua_vat),
    DonGiaDaVAT: v(r.don_gia_da_vat),
    TongGia: v(r.tong_gia),
    TongGiaChuaVAT: v(r.tong_gia_chua_vat),
    TongGiaDaVAT: v(r.tong_gia_da_vat),
    TyLeVAT: v(r.ty_le_vat),
    TienVAT: v(r.tien_vat),
    // như bản cũ: căn chưa có tong_gia_gom_vat / tong_gia_tri_hdmb ⇒ dùng tong_gom_pbt
    TongGiaGomVAT: v(r.tong_gia_gom_vat ?? r.tong_gom_pbt),
    TongGiaTriHDMB: v(r.tong_gia_tri_hdmb ?? r.tong_gom_pbt),
    TyLePhiBaoTri: v(r.ty_le_phi_bao_tri),
    TienPhiBaoTri: v(r.tien_phi_bao_tri),
    PhiBaoTri: v(r.tien_pbt ?? r.tien_phi_bao_tri),
    TienPBT: v(r.tien_pbt),
    TongGomPBT: v(r.tong_gom_pbt),
    TongThanhToan: v(r.tong_thanh_toan),
    TienDat: v(r.tien_dat),
    DonGiaDat: v(r.don_gia_dat),
    TongGiaDat: v(r.tong_gia_dat),
    DonGiaXD: v(r.don_gia_xay_dung),
    DonGiaXayDung: v(r.don_gia_xay_dung),
    ThanhTienXD: v(r.thanh_tien_xd),
    GiaNaked: v(r.gia_naked),
    MauNen: v(r.mau_nen),
    MaSan: v(r.ma_san),
    SanGiaoDich: v(r.san_giao_dich),
    MaCauHinhTinhGia: v(r.ma_cau_hinh_tinh_gia),
    GhiChu: v(r.ghi_chu),
    MaTT: v(r.ma_tt),
    MaTTCode: v(r.tt_ma),
    TenTT: v(r.tt_ten),
    ColorTT: v(r.tt_mau),
    isHienThiBook: true,
    ThoiGianConLai: Math.max(0, Number(r?.khoa?.so_giay_con_lai) || 0),
  };
}

/** Quyền nút giao dịch của căn (fn_nv_app_san_pham_chi_tiet.quyen) — thiếu ⇒ false (fail-closed như web usePerm). */
export function mapProductPerms(r: any) {
  const q = r?.quyen || {};
  return {
    lock: q.lock === true,
    booking: q.booking === true,
    deposit: q.deposit === true,
    investment: q.investment === true,
    contract: q.contract === true,
    priceSheet: q.phieu_tinh_gia === true,
  };
}

/** raw danh mục mẫu căn (loai_ch / mau_nha) ⇒ URL ảnh: ImageUrl (đại diện) trước, rồi Images[]. */
function catalogImages(raw: any): string[] {
  let o = raw;
  if (typeof o === "string") {
    try {
      o = JSON.parse(o);
    } catch {
      return [];
    }
  }
  const out: string[] = [];
  if (Array.isArray(o?.Images)) {
    for (const img of o.Images) {
      const u = absUrl(typeof img === "string" ? img : img?.url || img?.path || img?.name);
      if (u) out.push(u);
    }
  }
  const main = absUrl(o?.ImageUrl);
  if (main && !out.includes(main)) out.unshift(main);
  return out;
}

/**
 * Ảnh hiển thị của căn — cùng thứ tự app (và web) dùng:
 * ảnh riêng của căn (JSON mảng chuỗi / {url|path|name} hoặc chuỗi cách dấu phẩy) → ảnh mẫu loại căn hộ → ảnh mẫu nhà
 * → ảnh nền dự án → ảnh dự án → ảnh mặc định.
 */
export function productImages(anh: any): string[] {
  const own = String(anh?.hinh_anh_can ?? "").trim();
  let urls: string[] = [];
  if (own.startsWith("[")) {
    try {
      const arr = JSON.parse(own);
      if (Array.isArray(arr)) {
        urls = arr.map((it: any) => absUrl(typeof it === "string" ? it : it?.url || it?.path || it?.name)).filter(Boolean);
      }
    } catch {
      // JSON hỏng ⇒ xử lý như chuỗi thường
    }
  }
  if (!urls.length && own && !own.startsWith("[")) urls = own.split(",").map((s) => absUrl(s)).filter(Boolean);
  if (!urls.length) urls = catalogImages(anh?.mau_loai_can);
  if (!urls.length) urls = catalogImages(anh?.mau_nha);
  if (!urls.length && absUrl(anh?.nen_du_an)) urls = [absUrl(anh?.nen_du_an)];
  if (!urls.length && absUrl(anh?.anh_du_an)) urls = [absUrl(anh?.anh_du_an)];
  return urls.length ? urls : [DEFAULT_BANNER_URL];
}

/* ------------------------------ Sơ đồ căn ------------------------------ */

/**
 * fn_nv_app_so_do ⇒ dạng lưới cũ: [{ maKhu, tenKhu, location:[{maVT,tenVT}], floor:[{maTang,tenTang,detailFloor:[]}] }]
 * Khu theo thứ tự xuất hiện; tầng theo thứ tự danh mục tầng (mã tầng), tầng ngoài danh mục xếp theo tên.
 */
export function buildGrid(r: any) {
  const tang: any[] = Array.isArray(r?.tang) ? r.tang : [];
  const viTri: any[] = Array.isArray(r?.vi_tri) ? r.vi_tri : [];
  const can: any[] = Array.isArray(r?.can) ? r.can : [];
  const tangOrder = new Map<string, number>();
  tang.forEach((t, i) => tangOrder.set(String(t.id).toLowerCase(), i));
  const location = viTri.map((x) => ({ maVT: x.id, tenVT: x.ten || x.ma || x.id }));
  // id vị trí (thường) → id đúng như danh mục: căn trả uuid hoa / thường khác danh mục vẫn vào đúng cột
  const vtId = new Map<string, string>(location.map((l) => [String(l.maVT).toLowerCase(), l.maVT]));

  const blocks = new Map<string, any>();
  for (const c of can) {
    if (c?.ma_khu == null) continue;
    const kKey = String(c.ma_khu).toLowerCase();
    if (!blocks.has(kKey)) blocks.set(kKey, { maKhu: c.ma_khu, tenKhu: c.ten_khu || String(c.ma_khu), location, floor: [], unplaced: [] });
    const block = blocks.get(kKey);
    const cell = {
      ID: c.id,
      MaSP: c.ma_sp,
      KyHieu: c.ky_hieu,
      MaVT: c.vi_tri == null ? c.vi_tri : vtId.get(String(c.vi_tri).toLowerCase()) ?? c.vi_tri,
      MaTT: c.ma_tt,
      GiaBan: c.tong_gia_gom_vat,
      MauNen: c.mau_nen || c.tt_mau || "",
      TenTT: c.tt_ten || "",
      ColorTT: c.tt_mau || "",
    };
    // Thiếu tầng / vị trí (hoặc vị trí không có trong danh mục) ⇒ không đặt được vào ô ⇒ nhóm "Chưa xếp" (trước đây thành hàng "null" toàn ô khoá)
    if (c.ma_tang == null || c.vi_tri == null || !vtId.has(String(c.vi_tri).toLowerCase())) {
      block.unplaced.push(cell);
      continue;
    }
    const fKey = String(c.ma_tang ?? "").toLowerCase();
    let floor = block.floor.find((f: any) => String(f.maTang ?? "").toLowerCase() === fKey);
    if (!floor) {
      floor = { maTang: c.ma_tang, tenTang: c.ten_tang || String(c.ma_tang), detailFloor: [] };
      block.floor.push(floor);
    }
    floor.detailFloor.push(cell);
  }
  // Danh mục vị trí là của cả dự án (mỗi tòa có bộ 01, 02… riêng) ⇒ mỗi tòa chỉ giữ cột căn của tòa dùng, theo thứ tự danh mục;
  // trước đây mọi tòa nhận hết cột ⇒ cột đầu của tòa khác trống (ô khoá), căn thật nằm tận bên phải.
  return Array.from(blocks.values()).map((b) => ({
    ...b,
    location: (() => {
      const used = new Set<string>();
      for (const f of b.floor) for (const d of f.detailFloor) if (d.MaVT != null) used.add(String(d.MaVT).toLowerCase());
      const own = location.filter((l) => used.has(String(l.maVT).toLowerCase()));
      return own;
    })(),
    floor: [...b.floor].sort((a: any, c: any) => {
      const ai = tangOrder.get(String(a.maTang).toLowerCase());
      const ci = tangOrder.get(String(c.maTang).toLowerCase());
      if (ai != null && ci != null) return ai - ci;
      if (ai != null) return -1;
      if (ci != null) return 1;
      return String(a.tenTang).localeCompare(String(c.tenTang), "vi");
    }),
  }));
}

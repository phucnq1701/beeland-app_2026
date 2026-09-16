import axiosApiSupabase from "./axiosApiSupabase";
import { getCompanyId, getValidSupabaseJwt } from "./cloudTenant";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chuẩn hoá ngày → ISO (RPC nhận ISO). Trả null nếu rỗng. */
function toIsoDate(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  try {
    const d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toISOString();
  } catch {
    return String(v);
  }
}

/** DuAn có thể là mảng hoặc chuỗi ",a,b," → mảng id sạch. */
function parseProjectIds(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map((x) => String(x).trim()).filter(Boolean);
  }
  return String(raw)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** ma_da_code → da_projects.id (uuid). Bỏ qua nếu đã là uuid. */
async function resolveProjectUuids(ids: string[]): Promise<string[]> {
  const uuids: string[] = [];
  for (const id of ids) {
    if (UUID_RE.test(id)) {
      uuids.push(id);
      continue;
    }
    try {
      const r = await axiosApiSupabase.get("rest/v1/da_projects", {
        params: { select: "id", ma_da_code: `eq.${id}`, limit: "1" },
      });
      const rows = Array.isArray(r.data) ? r.data : [];
      if (rows[0]?.id) uuids.push(rows[0].id);
    } catch {
      // bỏ qua lỗi resolve từng dự án
    }
  }
  return uuids;
}

/**
 * Map 1 dòng fn_deposit_list → shape UI cũ (PascalCase) mà app/deposits.tsx
 * và app/deposit/[id].tsx đang dùng.
 */
function mapDepositRow(r: any) {
  return {
    ...r,
    ID: r?.id,
    MaPDC: r?.id,
    MaPGC: r?.id,
    PhieuGiuChoId: r?.pgc_id,
    SoPhieu: r?.so_phieu || "",
    NgayDatCoc: r?.ngay_coc || "",
    KhachHang: r?.ten_kh || "",
    DiDong: r?.dien_thoai || "",
    MaSanPham: r?.ky_hieu || "",
    MaSP: r?.ma_sp || "",
    TenDA: r?.ten_da || "",
    MaDA: r?.ma_da_code || "",
    TienCoc: r?.tien_coc ?? 0,
    DaThu: r?.da_thu ?? 0,
    TongGiaTriHDMB: r?.gia_tri_hd_sau_ck ?? 0,
    DienTich: r?.dien_tich ?? null,
    DonGiaTT: r?.don_gia_gom_vat ?? null,
    MaTT: r?.ma_tt ?? null,
    TenTT: r?.ten_tt || "",
    // web: color_code -> MauNen/ColorWeb
    MauNen: r?.color_code || r?.mau_nen || "",
    SanGD: r?.ten_san || "",
    NguoiNhap: r?.nguoi_tao ?? null,
    NguoiSua: r?.nguoi_sua ?? null,
    TotalRows: r?.total_count ?? 0,
  };
}

/** Chuẩn hoá 1 dòng lịch thanh toán (JSONB raw) → shape UI. */
function normalizeScheduleRow(raw: any) {
  if (!raw) return null;
  const soTien = Number(raw?.SoTien ?? raw?.so_tien ?? 0);
  const phaiThu = Number(raw?.PhaiThu ?? raw?.phai_thu ?? soTien);
  const daThu = Number(raw?.DaThu ?? raw?.da_thu ?? 0);
  const phaiThuPBT = Number(
    raw?.PhaiThuPBT ?? raw?.PhiBT ?? raw?.phai_thu_pbt ?? 0
  );
  const daThuPBT = Number(raw?.DaThuPBT ?? raw?.da_thu_pbt ?? 0);
  const conNoPBT = Number(raw?.ConNoPBT ?? raw?.con_no_pbt ?? 0);
  return {
    DotTT: raw?.DotTT ?? raw?.Dot ?? raw?.dot_tt ?? null,
    DotTTText: raw?.DotTTText ?? raw?.KieuThanhToan ?? "",
    NgayTT: raw?.NgayTT ?? raw?.ngay_tt ?? "",
    TyLeTT: Number(raw?.TyLeTT ?? raw?.ty_le ?? 0),
    SoTien: soTien,
    PhaiThu: phaiThu,
    DaThu: daThu,
    ConLai: phaiThu - daThu,
    PhaiThuPBT: phaiThuPBT,
    DaThuPBT: daThuPBT,
    ConNoPBT: conNoPBT,
    DienGiai: raw?.DienGiai ?? raw?.dien_giai ?? "",
  };
}

/**
 * Phân bổ tổng "đã thu" vào từng đợt (theo web allocatePaidToSchedule):
 * đổ hết PhaiThu đợt 1 → dư chảy sang đợt 2… hết phần gốc mới phân bổ PhaiThuPBT.
 */
function allocatePaidToSchedule(rows: any[], totalPaid: number) {
  let remaining = Number(totalPaid) || 0;
  const withBase = rows.map((r) => {
    const phaiThu = Number(r?.PhaiThu || 0);
    const paid = Math.min(remaining, phaiThu);
    remaining -= paid;
    return { ...r, DaThu: paid, ConLai: phaiThu - paid };
  });
  return withBase.map((r) => {
    const phaiThuPBT = Number(r?.PhaiThuPBT || 0);
    const paidPBT = Math.min(remaining, phaiThuPBT);
    remaining -= paidPBT;
    return { ...r, DaThuPBT: paidPBT, ConNoPBT: phaiThuPBT - paidPBT };
  });
}

/**
 * ĐẶT CỌC — cloud (theo web):
 * - Danh sách: RPC fn_deposit_list (bảng cloud_pgc_phieu_giucho giai_doan='DATCOC'
 *   + cloud_deposits + joins).
 * - Trạng thái: cloud_catalogs catalog_type='pgc_trang_thai' (ma_ctdk='global').
 */
export const DatCocService = {
  /**
   * Danh sách phiếu đặt cọc.
   * filter (legacy UI): { TuNgay, DenNgay, DuAn, MaTT, inputSearch, Offset, Limit }
   *  - Offset: 1-based (page). RPC nhận p_offset 0-based = (Offset-1)*Limit.
   *  - Limit : pageSize (mặc định 20).
   *  - DuAn  : mảng hoặc chuỗi id dự án (ma_da_code hoặc uuid).
   */
  get: async (filter: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Deposit] chưa có cloud_jwt hợp lệ, bỏ qua fn_deposit_list");
      return { data: [], totalRows: 0 };
    }

    try {
      const tenantId = await getCompanyId();
      const limit = Math.max(1, Number(filter?.Limit ?? filter?.limit ?? 20));
      const page = Math.max(1, Number(filter?.Offset ?? filter?.offset ?? 1));
      const offset = (page - 1) * limit;

      // Dự án: resolve ma_da_code -> uuid, nối dấu phẩy (null = tất cả)
      const projectIds = parseProjectIds(
        filter?.DuAn ?? filter?.duAn ?? filter?.projectId
      );
      const projectUuids =
        projectIds.length > 0 ? await resolveProjectUuids(projectIds) : [];
      const pProjectId = projectUuids.length > 0 ? projectUuids.join(",") : null;

      const search = String(
        filter?.inputSearch ?? filter?.keyword ?? ""
      ).trim();

      const maTTNum = Number(filter?.MaTT ?? filter?.maTT ?? 0);
      const pMaTT =
        Number.isFinite(maTTNum) && maTTNum > 0 ? maTTNum : null;

      const body = {
        p_ma_ctdk_uid: tenantId || null,
        p_project_id: pProjectId,
        p_tu_ngay: toIsoDate(filter?.TuNgay ?? filter?.tuNgay),
        p_den_ngay: toIsoDate(filter?.DenNgay ?? filter?.denNgay),
        p_input_search: search || null,
        p_ma_tt: pMaTT,
        p_offset: offset,
        p_limit: limit,
      };

      const res = await axiosApiSupabase.post(
        "rest/v1/rpc/fn_deposit_list",
        body
      );

      const rows = Array.isArray(res.data) ? res.data : [];
      const mapped = rows.map(mapDepositRow);
      const total = Number(rows[0]?.total_count);

      return {
        data: mapped,
        totalRows: Number.isFinite(total) && total > 0 ? total : mapped.length,
      };
    } catch (error) {
      console.log("ERROR DatCocService.get (fn_deposit_list):", error);
      return { data: [], totalRows: 0 };
    }
  },

  /**
   * Danh mục trạng thái đặt cọc — cloud_catalogs catalog_type='pgc_trang_thai'
   * (dùng chung: ma_ctdk='global'), order item_code asc.
   * Shape UI cũ: { data: [{ MaTT, TenTT, ColorWeb }] } — MaTT = item_code (số).
   */
  getTT: async (_payload: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Deposit] chưa có cloud_jwt, bỏ qua getTT");
      return { data: [] };
    }

    try {
      const params: Record<string, string> = {
        select: "id,item_code,item_name,color_code",
        catalog_type: "eq.pgc_trang_thai",
        ma_ctdk: "eq.global",
        order: "item_code.asc",
        limit: "100",
      };

      const res = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
        params,
      });
      const rows = Array.isArray(res.data) ? res.data : [];

      const data = rows.map((r: any) => {
        const code = r?.item_code;
        const num = Number(code);
        return {
          MaTT: Number.isFinite(num) ? num : code,
          TenTT: r?.item_name || "",
          ColorWeb: r?.color_code || "#9CA3AF",
          _raw: r,
        };
      });

      return { data };
    } catch (error) {
      console.log(
        "ERROR DatCocService.getTT (cloud_catalogs pgc_trang_thai):",
        error
      );
      return { data: [] };
    }
  },

  /**
   * Chi tiết phiếu đặt cọc (drawer web) — KHÔNG có RPC riêng:
   * - Header: dùng lại dòng từ fn_deposit_list (truyền vào `row`).
   * - Lịch thanh toán: cloud_catalogs catalog_type='lich_tt_hd', parent_code = MaPDC
   *   (fallback mảng JSONB lich_thanh_toan trên row).
   * - Phiếu thu: cloud_cash_voucher_details (pgc_id = PhieuGiuChoId, loai_phieu='THU')
   *   → cloud_cash_vouchers.
   * - Phân bổ "Đã thu" vào từng đợt.
   */
  getDepositDetail: async (payload: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Deposit] chưa có cloud_jwt, bỏ qua getDepositDetail");
      return { data: null, lichTT: [], phieuThu: [], tongDaThu: 0 };
    }

    const row = payload?.row ?? payload?.data ?? {};
    const maPDC = row?.MaPDC ?? payload?.MaPDC ?? payload?.id; // cloud_deposits.id
    let pgcId = row?.PhieuGiuChoId ?? payload?.PhieuGiuChoId; // phieu_giu_cho_id

    try {
      // 0) Bổ sung header: đọc phiếu giữ chỗ + khách hàng + sản phẩm
      // (fn_deposit_list chưa trả email/cccd/địa chỉ/loại căn).
      let header: any = { ...row };
      if (pgcId) {
        try {
          const p = await axiosApiSupabase.get(
            "rest/v1/cloud_pgc_phieu_giucho",
            {
              params: {
                select:
                  "id,khach_hang_id,san_pham_id,dien_tich,don_gia_gom_vat,gia_tri_hd,gia_tri_hd_sau_ck,phi_bao_tri,tien_coc,da_thu",
                id: `eq.${pgcId}`,
                limit: "1",
              },
            }
          );
          const pgc = Array.isArray(p.data) ? p.data[0] : null;
          if (pgc) {
            header = {
              ...header,
              DienTich: header.DienTich ?? pgc.dien_tich,
              DonGiaTT: header.DonGiaTT ?? pgc.don_gia_gom_vat,
              PhiBaoTri: pgc.phi_bao_tri,
              TongGiaGomVAT: pgc.gia_tri_hd,
              TongGiaTriHDMB:
                header.TongGiaTriHDMB ?? pgc.gia_tri_hd_sau_ck ?? pgc.gia_tri_hd,
            };

            // Khách hàng (email, cccd, địa chỉ)
            if (pgc.khach_hang_id) {
              try {
                const c = await axiosApiSupabase.get(
                  "rest/v1/cloud_customers",
                  {
                    params: {
                      select:
                        "id,ten_kh,ten_cong_ty,dien_thoai,email,cccd,dia_chi,ma_so_kh",
                      id: `eq.${pgc.khach_hang_id}`,
                      limit: "1",
                    },
                  }
                );
                const kh = Array.isArray(c.data) ? c.data[0] : null;
                if (kh) {
                  header.KhachHang = header.KhachHang || kh.ten_kh || kh.ten_cong_ty || "";
                  header.DiDong = header.DiDong || kh.dien_thoai || "";
                  header.Email = kh.email || "";
                  header.SoCMND = kh.cccd || "";
                  header.DiaChi = kh.dia_chi || "";
                  header.MaSoKH = kh.ma_so_kh || "";
                }
              } catch (e) {
                console.log("ERROR deposit customer:", e);
              }
            }

            // Sản phẩm (loại căn, hướng)
            if (pgc.san_pham_id) {
              try {
                const sp = await axiosApiSupabase.get("rest/v1/bds_products", {
                  params: {
                    select:
                      "id,ma_sp,ky_hieu,ten_loai_can_ho,huong_cua,huong_bc,ten_huong_cua,ten_huong_bc",
                    id: `eq.${pgc.san_pham_id}`,
                    limit: "1",
                  },
                });
                const prod = Array.isArray(sp.data) ? sp.data[0] : null;
                if (prod) {
                  header.MaSP = header.MaSP || prod.ma_sp || "";
                  header.MaSanPham = header.MaSanPham || prod.ky_hieu || "";
                  header.LoaiCanHo = prod.ten_loai_can_ho || "";
                  header.Huong =
                    prod.ten_huong_cua ||
                    prod.huong_cua ||
                    prod.ten_huong_bc ||
                    prod.huong_bc ||
                    "";
                }
              } catch (e) {
                console.log("ERROR deposit product:", e);
              }
            }
          }
        } catch (e) {
          console.log("ERROR deposit pgc header:", e);
        }
      }

      // 1) Lịch thanh toán
      let lichTT: any[] = [];
      if (maPDC) {
        try {
          const r = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
            params: {
              select: "raw",
              catalog_type: "eq.lich_tt_hd",
              parent_code: `eq.${maPDC}`,
              limit: "200",
            },
          });
          const rows = Array.isArray(r.data) ? r.data : [];
          lichTT = rows
            .map((x: any) => normalizeScheduleRow(x?.raw))
            .filter(Boolean)
            .sort((a: any, b: any) => Number(a.DotTT) - Number(b.DotTT));
        } catch (e) {
          console.log("ERROR deposit lichTT (cloud_catalogs):", e);
        }
      }

      // Fallback: mảng JSONB lich_thanh_toan trên row
      if (lichTT.length === 0 && Array.isArray(row?.lich_thanh_toan)) {
        lichTT = row.lich_thanh_toan
          .map((x: any) => normalizeScheduleRow(x))
          .filter(Boolean)
          .sort((a: any, b: any) => Number(a.DotTT) - Number(b.DotTT));
      }

      // 2) Phiếu thu
      let phieuThu: any[] = [];
      if (pgcId) {
        try {
          const d = await axiosApiSupabase.get(
            "rest/v1/cloud_cash_voucher_details",
            {
              params: {
                select: "ma_phieu_id,so_tien,dot_tt",
                loai_phieu: "eq.THU",
                pgc_id: `eq.${pgcId}`,
                limit: "5000",
              },
            }
          );
          const details = Array.isArray(d.data) ? d.data : [];
          const ids = Array.from(
            new Set(details.map((x: any) => x?.ma_phieu_id).filter(Boolean))
          );
          if (ids.length > 0) {
            const v = await axiosApiSupabase.get(
              "rest/v1/cloud_cash_vouchers",
              {
                params: {
                  select:
                    "id,so_phieu,ngay_phieu,so_tien,dien_giai,nguoi_nop,hinh_thuc",
                  id: `in.(${ids.join(",")})`,
                  limit: "5000",
                },
              }
            );
            const vouchers = Array.isArray(v.data) ? v.data : [];
            phieuThu = vouchers.map((x: any) => ({
              soPT: x?.so_phieu,
              ngayThu: x?.ngay_phieu,
              tienThu: x?.so_tien ?? 0,
              dienGiai: x?.dien_giai,
              hoTen: x?.nguoi_nop,
              hinhThuc: x?.hinh_thuc,
            }));
          }
        } catch (e) {
          console.log("ERROR deposit phieuThu:", e);
        }
      }

      // 3) Phân bổ đã thu vào lịch
      const tongDaThu = phieuThu.reduce(
        (s: number, x: any) => s + Number(x?.tienThu || 0),
        0
      );
      lichTT = allocatePaidToSchedule(lichTT, tongDaThu);

      return { data: header, lichTT, phieuThu, tongDaThu };
    } catch (error) {
      console.log("ERROR getDepositDetail:", error);
      return { data: row, lichTT: [], phieuThu: [], tongDaThu: 0 };
    }
  },
};

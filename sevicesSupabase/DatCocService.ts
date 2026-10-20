import axiosApiSupabase from "./axiosApiSupabase";
import { getValidSupabaseJwt } from "./cloudTenant";
import { listResult, mergeProjectPages, pageArgs } from "../lib/listRpc";
import { PaymentProgressService } from "./PaymentProgressService";
import { statusCodeNum } from "../lib/depositQr";
import { formatDirections } from "../lib/format";
import { getCustomersByIds } from "./customerLookup";


const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

const num = (v: any) => (v == null ? null : Number(v));

/** Ngày lọc theo giờ VN như web vnDayStart / vnDayEnd ("YYYY-MM-DD" hoặc Date); rỗng → null. */
export function vnDayBound(v: any, end: boolean): string | null {
  if (v == null || v === "") return null;
  let ymd = "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) ymd = v.slice(0, 10);
  else {
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    const vn = new Date(d.getTime() + 7 * 3600 * 1000);
    ymd = vn.toISOString().slice(0, 10);
  }
  return end ? `${ymd}T23:59:59.999+07:00` : `${ymd}T00:00:00.000+07:00`;
}

/** Kết quả hàm máy chủ: { rows, total_count } (bản mới) hoặc mảng dòng kèm total_count (bản cũ). */
export function rpcRows(data: any): { rows: any[]; total: number | null } {
  if (Array.isArray(data)) {
    const t = Number(data[0]?.total_count);
    return { rows: data, total: Number.isFinite(t) && t > 0 ? t : null };
  }
  const rows = Array.isArray(data?.rows) ? data.rows : [];
  // Hàm danh sách bản mới (2026-10-14) trả { rows, total }; bản trước { rows, total_count }
  const t = Number(data?.total_count ?? data?.total);
  return { rows, total: Number.isFinite(t) ? t : null };
}

/**
 * 1 dòng fn_deposit_list → dữ liệu màn hình – y hệt web DepositListService.mapRow.
 * MaPGC / PhieuGiuChoId = uuid phiếu giữ chỗ (lịch thanh toán, phiếu thu đều theo phiếu giữ chỗ).
 */
function mapDepositRow(r: any) {
  const hd = r?.tt_hop_dong || {};
  return {
    ID: r.id,
    MaDC: r.id,
    MaPDC: r.id,
    MaPGC: r.pgc_id ?? r.id,
    PhieuGiuChoId: r.pgc_id ? String(r.pgc_id) : null,
    GiaiDoan: r.giai_doan,
    SoPhieu: r.so_phieu,
    SoPhieuGC: r.so_phieu_gc ?? null,
    NgayDatCoc: r.ngay_coc ?? r.ngay_nhap ?? r.created_at,
    NgayCoc: r.ngay_coc ?? null,
    NgayNhap: r.ngay_nhap ?? r.created_at,
    MaDA: r.ma_da_code ?? r.project_id ?? null,
    ProjectId: r.project_id ?? null,
    TenDA: r.ten_da ?? null,
    SanPhamId: r.san_pham_id ?? null,
    MaSP: r.ma_sp ?? null,
    KyHieu: r.ky_hieu ?? null,
    MaSanPham: r.ky_hieu ?? null,
    MaKH: r.khach_hang_id ?? null,
    MaSoKH: r.ma_so_kh ?? null,
    TenKH: r.ten_kh ?? null,
    KhachHang: r.ten_kh ?? null,
    SoCMND: r.cccd ?? null,
    DiDong: r.dien_thoai ?? null,
    Email: r.email ?? null,
    DiaChi: r.dia_chi ?? null,
    SanGD: r.ten_san ?? null,
    DienTich: num(r.dien_tich),
    DonGiaTT: num(r.don_gia_gom_vat),
    TongGiaGomVAT: num(r.gia_tri_hd),
    TongGiaTriHDMB: num(r.gia_tri_hd_sau_ck ?? r.gia_tri_hd),
    TienCoc: num(r.tien_coc),
    PhiBaoTri: num(r.phi_bao_tri),
    DaThu: num(r.da_thu) ?? 0,
    // item_code có thể lẫn chữ → lấy phần số như fn_deposit_list (Number() sẽ ra NaN)
    MaTT: statusCodeNum(r.ma_tt),
    TenTT: r.ten_tt ?? null,
    MauNen: r.color_code ?? null,
    NguoiTao: r.nguoi_tao ?? null,
    NguoiSua: r.nguoi_sua ?? null,
    TenNVKD: r.ten_nvkd ?? hd?.TenNVKD ?? null,
    TenChinhSach: r.ten_chinh_sach ?? (r.chinh_sach ?? [])[0]?.TenCS ?? (r.chinh_sach ?? [])[0]?.TenChinhSach ?? null,
    TotalRows: Number(r?.total_count) || 0,
  };
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
      const limit = Math.max(1, Number(filter?.Limit ?? filter?.limit ?? 20));
      const page = Math.max(1, Number(filter?.Offset ?? filter?.offset ?? 1));

      // Dự án: resolve ma_da_code -> uuid. Phạm vi (nội bộ: dự án được gán; đại lý: dự án của đại lý) do máy chủ
      // áp theo JWT (_da_project_scope) ⇒ không tự lọc phía app nữa.
      const projectIds = parseProjectIds(
        filter?.DuAn ?? filter?.duAn ?? filter?.projectId
      );
      const projectUuids =
        projectIds.length > 0 ? await resolveProjectUuids(projectIds) : [];
      // Có chọn dự án nhưng không đổi ra uuid nào → không có dữ liệu hợp lệ (web DepositListService)
      if (projectIds.length > 0 && projectUuids.length === 0) return { data: [], totalRows: 0 };

      const search = String(
        filter?.inputSearch ?? filter?.keyword ?? ""
      ).trim();

      const maTTNum = Number(filter?.MaTT ?? filter?.maTT ?? 0);
      const pMaTT =
        Number.isFinite(maTTNum) && maTTNum > 0 ? maTTNum : null;

      // fn_deposit_list bản mới (web DepositListService, migration 20261014171500): công ty từ JWT,
      // p_project_id 1 uuid, p_search, p_page, p_size; trả { rows, total }. Ngày theo giờ VN, không lọc → null.
      const base = {
        p_search: search || null,
        p_tu_ngay: vnDayBound(filter?.TuNgay ?? filter?.tuNgay, false),
        p_den_ngay: vnDayBound(filter?.DenNgay ?? filter?.denNgay, true),
        p_ma_tt: pMaTT,
      };
      const call = async (projectId: string | null, p: number, size: number) => {
        const res = await axiosApiSupabase.post("rest/v1/rpc/fn_deposit_list", {
          ...base,
          p_project_id: projectId,
          ...pageArgs(p, size),
        });
        return listResult(res.data);
      };

      let result: { rows: any[]; total: number };
      if (projectUuids.length > 1) {
        // Chọn nhiều dự án: hàm chỉ nhận 1 dự án ⇒ gọi từng dự án rồi gộp đúng trang
        const pages = await Promise.all(projectUuids.map((id) => call(id, 1, page * limit)));
        result = mergeProjectPages(pages, page, limit, (r: any) => r?.ngay_coc ?? r?.ngay_nhap);
      } else {
        result = await call(projectUuids[0] ?? null, page, limit);
      }
      const mapped = result.rows.map(mapDepositRow);
      return { data: mapped, totalRows: result.total };
    } catch (error) {
      console.log("ERROR DatCocService.get (fn_deposit_list):", error);
      return { data: [], totalRows: 0, error: true };
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
   * - Phiếu thu: PaymentProgressService.getReceipts → RPC fn_cash_vouchers_by_pgc (bảng cloud_cash_voucher_details /
   *   cloud_cash_vouchers đã khoá đọc thẳng).
   * - Phân bổ "Đã thu" vào từng đợt.
   */
  getDepositDetail: async (payload: any = {}) => {
    const validJwt = await getValidSupabaseJwt();
    if (!validJwt) {
      console.log("[Deposit] chưa có cloud_jwt, bỏ qua getDepositDetail");
      return { data: null, lichTT: [], phieuThu: [], tongDaThu: 0 };
    }

    const row = payload?.row ?? payload?.data ?? {};
    // uuid phiếu giữ chỗ (web: PhieuGiuChoId ?? MaPGC, MaPGC = pgc_id ?? id)
    const pgcId = row?.PhieuGiuChoId ?? payload?.PhieuGiuChoId ?? row?.MaPGC ?? payload?.MaPGC;

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

            // Khách hàng (email, cccd, địa chỉ) — qua RPC fn_customer_get_by_ids (cloud_customers đã khoá đọc thẳng từ
            // 2026-10-20; web DepositCloudService withCustomers). Khách công ty khác chỉ thấy qua chứng từ ⇒ cccd đã che.
            if (pgc.khach_hang_id) {
              try {
                const kh = (await getCustomersByIds([pgc.khach_hang_id]))[0] ?? null;
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
                // bds_products không có cột ten_*: loại căn (ma_lch → danh mục loai_ch) và hướng (huong_cua / huong_bc →
                // danh mục phuong_huong) là uuid cloud_catalogs → tra tên bằng id=in.(…) (không embed FK – docs/data-access.md).
                const sp = await axiosApiSupabase.get("rest/v1/bds_products", {
                  params: {
                    select: "id,ma_sp,ky_hieu,ma_lch,huong_cua,huong_bc",
                    id: `eq.${pgc.san_pham_id}`,
                    limit: "1",
                  },
                });
                const prod = Array.isArray(sp.data) ? sp.data[0] : null;
                if (prod) {
                  header.MaSP = header.MaSP || prod.ma_sp || "";
                  header.MaSanPham = header.MaSanPham || prod.ky_hieu || "";
                  const ids = [prod.ma_lch, prod.huong_cua, prod.huong_bc].filter(
                    (x: unknown): x is string => typeof x === "string" && UUID_RE.test(x),
                  );
                  const names = new Map<string, string>();
                  if (ids.length) {
                    const cat = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
                      params: { select: "id,item_name", id: `in.(${[...new Set(ids)].join(",")})` },
                    });
                    for (const r of Array.isArray(cat.data) ? cat.data : []) names.set(String(r.id), String(r.item_name ?? ""));
                  }
                  header.LoaiCanHo = names.get(prod.ma_lch) || "";
                  header.Huong = formatDirections(names.get(prod.huong_cua), names.get(prod.huong_bc));
                }
              } catch (e) {
                console.log("ERROR deposit product:", e);
              }
            }
          }
        } catch (e) {
          console.log("ERROR deposit pgc header:", e);
        }

        // Trạng thái hiện tại của phiếu (dòng danh sách có thể cũ, vd vừa tự duyệt sau khi thu QR đủ cọc)
        try {
          const t = await axiosApiSupabase.get("rest/v1/cloud_pgc_phieu_giucho", {
            params: {
              select: "tt:cloud_catalogs!trang_thai_id(item_code,item_name,color_code)",
              id: `eq.${pgcId}`,
              limit: "1",
            },
          });
          const tt = Array.isArray(t.data) ? t.data[0]?.tt : null;
          if (tt?.item_name) {
            header.TenTT = tt.item_name;
            header.MaTT = statusCodeNum(tt.item_code);
            header.MauNen = tt.color_code ?? header.MauNen;
          }
        } catch (e) {
          console.log("ERROR deposit status:", e);
        }
      }

      // 1) Lịch thanh toán + phiếu thu theo phiếu giữ chỗ – như web ContractDetail (type DATCOC)
      const [schedule, receipts] = await Promise.all([
        PaymentProgressService.getSchedule(pgcId),
        PaymentProgressService.getReceipts(pgcId),
      ]);
      const lichTT = schedule.rows;
      const phieuThu = receipts.rows;
      const tongDaThu = receipts.total;
      return { data: header, lichTT, phieuThu, tongDaThu, receiptsError: receipts.error };
    } catch (error) {
      console.log("ERROR getDepositDetail:", error);
      return { data: row, lichTT: [], phieuThu: [], tongDaThu: 0, receiptsError: true };
    }
  },
};

// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/SalesLifecycleCloudService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../_shims/integrations/supabase/client";
import { stampOwner } from "./DataScopeService";
import { ensureDonGiaGomVAT } from "../utils/contractValue";
import {
  PGC_SELECT,
  buildSalesDocRefs,
  isUuid,
  mapSalesDoc,
  mapSalesDocs,
  resolveProductUid,
  resolveProjectUid,
  resolveStatusUid,
  salesTenantUid,
  saveProductPriceSnapshot,
  syncSnapshotStatus,
} from "./salesDocsCloud";
import { luuLichThanhToan } from "./sales/lich-thanh-toan";
import { withCustomers } from "./customers/customer-lookup";

/**
 * BẢNG CHÍNH VÒNG ĐỜI CHỨNG TỪ BÁN HÀNG — public.cloud_pgc_phieu_giucho
 *
 *   GIUCHO (giữ chỗ) → DATCOC (đặt cọc) → HDGV (HĐ góp vốn) → HDMB (HĐ mua bán)
 *
 * Bảng chỉ còn khóa ngoại UUID (ma_ctdk_uid, project_id, san_pham_id,
 * khach_hang_id, san_id, trang_thai_id). Mỗi sản phẩm chỉ có 1 dòng vòng đời
 * đang hoạt động → định danh bản ghi bằng `id` hoặc UUID sản phẩm.
 */

export type SalesStage = "GIUCHO" | "DATCOC" | "HDGV" | "HDMB";

const STAGE_ORDER: Record<SalesStage, number> = {
  GIUCHO: 1,
  DATCOC: 2,
  HDGV: 3,
  HDMB: 4,
};

export const stageRank = (s: any): number =>
  STAGE_ORDER[String(s || "").toUpperCase() as SalesStage] ?? 0;

const t = () => supabase.from("cloud_pgc_phieu_giucho" as any);

const str = (v: any) => (v == null || v === "" ? null : String(v));
const uuidOrNull = (v: any) => (isUuid(v) ? String(v) : null);
const uuidList = (list: any[]) => {
  const out = Array.from(
    new Set((list || []).filter(isUuid).map((v: any) => String(v)))
  );
  return out.length ? out : null;
};
const num = (v: any) => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};
const iso = (v: any) => {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
};
const arr = (v: any) => (Array.isArray(v) ? v : []);

const safe = async <T>(fn: () => Promise<T>): Promise<T | null> => {
  try {
    return await fn();
  } catch (e) {
    console.warn("[SalesLifecycle] bỏ qua lỗi:", e);
    return null;
  }
};

const currentUserName = (): string => {
  try {
    const u = JSON.parse(localStorage.getItem("authUser") || "{}")?.data ?? {};
    return String(u?.hoTen ?? u?.tenNV ?? u?.userName ?? u?.email ?? "");
  } catch {
    return "";
  }
};

export interface LifecycleInput {
  /** Tham chiếu: uuid dòng vòng đời (nếu đã biết) */
  maPGC?: any;
  giaiDoan: SalesStage;
  lifecycleId?: string | null;
  /** Payload chuẩn của ContractForm ({ TTHopDong, TTKhachHang, ... }) */
  payload?: any;
  /** Dữ liệu thô trả về từ API cũ / bản ghi đã dựng sẵn */
  raw?: any;
  maDC?: any;
  maHDGV?: any;
  maHDMB?: any;
  soPhieu?: any;
  /** UUID có sẵn (ưu tiên hơn việc tra cứu theo mã chữ) */
  sanPhamId?: any;
  khachHangId?: any;
  sanId?: any;
  /**
   * uuid dòng vòng đời của HỢP ĐỒNG GỐC (khi lập hợp đồng chuyển nhượng).
   * Có giá trị ⇒ luôn tạo DÒNG MỚI, không ghi đè vòng đời của hợp đồng gốc.
   */
  maHDGoc?: any;
  /**
   * true = luôn TẠO DÒNG MỚI, không dò/ghi đè dòng vòng đời cũ của căn.
   * Dùng khi lập phiếu mới cho căn đang ở trạng thái "Mở bán".
   */
  forceNew?: boolean;
  extra?: {
    tenDA?: any;
    sanGD?: any;
    tenNVKD?: any;
    nguoiTao?: any;
    tenTT?: any;
  };
}

/** UUID dòng vòng đời theo tham chiếu (uuid dòng, uuid sản phẩm, mã/ký hiệu căn) */
export const resolveLifecycleId = async (ref: any): Promise<string | null> => {
  const uid = salesTenantUid();
  const key = str(ref);
  if (!uid || !key) return null;
  if (isUuid(key)) {
    const byId = await safe(async () => {
      const { data } = await t().select("id").eq("id", key).maybeSingle();
      return (data as any)?.id ?? null;
    });
    if (byId) return byId as string;
  }
  const sanPhamId = await resolveProductUid(
    isUuid(key) ? { id: key } : { maSP: key, kyHieu: key }
  );
  if (!sanPhamId) return null;
  const res = await safe(async () => {
    const { data } = await t()
      .select("id")
      .eq("ma_ctdk_uid", uid)
      .eq("san_pham_id", sanPhamId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return (data as any)?.id ?? null;
  });
  return (res as string) || null;
};

const resolveLifecycleIds = async (refs: any[]): Promise<string[]> => {
  const out = new Set<string>();
  for (const r of refs || []) {
    // eslint-disable-next-line no-await-in-loop
    const id = await resolveLifecycleId(r);
    if (id) out.add(id);
  }
  return Array.from(out);
};

/** Dựng bản ghi vòng đời (chỉ gồm các cột đang tồn tại trên bảng). */
const buildRow = async (input: LifecycleInput) => {
  const p = input.payload || input.raw?.Payload || {};
  const hd = p?.TTHopDong || {};
  const kh = p?.TTKhachHang || {};
  const gt = hd?.GiaTriHopDong || {};
  const gtCK = hd?.GiaTriHopDongSauCK || {};
  // Luôn bảo đảm có "Đơn giá gồm VAT" trong khối giá trị hợp đồng
  ensureDonGiaGomVAT(gt);
  ensureDonGiaGomVAT(gtCK);
  if (hd && typeof hd === "object") {
    if (Object.keys(gt).length) (hd as any).GiaTriHopDong = gt;
    if (Object.keys(gtCK).length) (hd as any).GiaTriHopDongSauCK = gtCK;
  }
  const raw = input.raw || {};
  const stage = input.giaiDoan;
  const chinhSach = arr(p?.ChinhSach ?? raw?.ChinhSach);

  const refs = await buildSalesDocRefs({
    maDA: hd?.MaDA ?? raw?.MaDA,
    maSP: hd?.MaSP ?? raw?.MaSP,
    kyHieu: hd?.MaCan ?? raw?.KyHieu ?? raw?.MaSanPham,
    sanPhamId: input.sanPhamId,
    maKH: kh?.MaKH ?? raw?.MaKH,
    khachHangId: input.khachHangId,
    trangThai: input.extra?.tenTT ?? raw?.MaTT ?? raw?.TenTT,
    statusType: "pgc_trang_thai",
    target: "pgc",
  });

  // Giá trị SAU chiết khấu (fallback về giá gốc khi không có CK) — dùng chung
  // cho cả cao tầng (căn hộ) và thấp tầng (đất + xây dựng).
  const pickCK = (k: string) => num((gtCK as any)?.[k] ?? (gt as any)?.[k]);
  const dtThongThuy = num(
    gtCK?.DienTichThongThuy ?? gt?.DienTichThongThuy ?? raw?.DienTichThongThuy ?? raw?.DienTich
  );
  const dgDatPB = pickCK("DGDatPB");
  const tienDatPB =
    pickCK("TongTienVATDat") ??
    (dgDatPB != null && dtThongThuy != null ? dgDatPB * dtThongThuy : null);

  const row: Record<string, any> = {
    ...refs,
    giai_doan: stage,
    dien_tich: dtThongThuy,
    dien_tich_thong_thuy: dtThongThuy,
    don_gia_gom_vat: pickCK("DonGiaGomVAT") ?? pickCK("DonGiaDaVAT") ?? (
      (pickCK("TongGomVAT") != null && pickCK("DienTichThongThuy"))
        ? pickCK("TongGomVAT")! / pickCK("DienTichThongThuy")!
        : null
    ),
    don_gia_chua_vat: pickCK("DonGiaChuaVAT"),
    tong_chua_vat: pickCK("TongChuaVAT"),
    ty_le_vat: pickCK("TyLeVAT"),
    tien_vat: pickCK("TienVAT"),
    tong_gom_vat: pickCK("TongGomVAT"),
    ty_le_pbt: pickCK("TyLePhiBaoTri"),
    dg_dat_pb: dgDatPB,
    tien_dat_pb: tienDatPB,
    don_gia_dat: pickCK("DonGiaDat"),
    tien_dat_chua_vat: pickCK("TienDatChuaVAT"),
    tien_vat_dat: pickCK("TienVATDat"),
    tong_tien_dat_vat: pickCK("TongTienVATDat"),
    don_gia_xd: pickCK("DonGiaXD"),
    tien_xd_chua_vat: pickCK("TienXDChuaVAT"),
    tien_vat_xd: pickCK("TienVATXD"),
    tong_tien_xd_vat: pickCK("TongTienXDGomVAT"),
    tong_gia_dat_xd: pickCK("TongGiaGomDatXD"),
    gia_tri_hd: num(
      gt?.TongGiaGomVATPBT ??
        gt?.TongGiaGomDatXD ??
        gt?.TongGomVAT ??
        raw?.TongGiaGomVAT
    ),
    gia_tri_hd_sau_ck: num(
      gtCK?.TongGiaGomVATPBT ??
        gtCK?.TongGiaGomDatXD ??
        gtCK?.TongGomVAT ??
        raw?.TongGiaTriHDMB ??
        raw?.TongGiaGomVAT
    ),
    tien_coc: num(hd?.TienCoc ?? raw?.TienCoc ?? raw?.SoTienCoc ?? raw?.TienGiuCho),
    da_thu: num(raw?.DaThu),
    phi_bao_tri: num(gtCK?.TienPhiBaoTri ?? gt?.TienPhiBaoTri ?? raw?.PhiBaoTri),
    ma_dot_gia: str(hd?.MaDotGia),
    ma_cs: str(hd?.MaCS ?? chinhSach?.[0]?.MaCS),
    // Khóa ngoại cấu hình bán hàng (song song với tt_hop_dong)
    price_list_id: uuidOrNull(hd?.MaDotGia ?? raw?.MaDotGia),
    sales_policy_id: uuidOrNull(
      hd?.MaCS ?? raw?.MaCS ?? chinhSach?.[0]?.MaCS
    ),
    pricing_config_id: uuidOrNull(hd?.MaCSTong ?? raw?.MaCSTong),
    payment_schedule_id: uuidOrNull(hd?.MaTDTT ?? raw?.MaTDTT),
    promotion_ids: uuidList(
      arr(p?.KhuyenMai ?? raw?.KhuyenMai).map(
        (km: any) => km?.ID ?? km?.MaKM ?? km
      )
    ),
    chinh_sach: chinhSach,
    khuyen_mai: arr(p?.KhuyenMai ?? raw?.KhuyenMai),
    uu_dai_lai_suat: arr(p?.UuDaiLaiSuat ?? raw?.UuDaiLaiSuat),
    payload: input.payload ?? raw?.Payload ?? null,
    tt_hop_dong: Object.keys(hd || {}).length ? hd : null,
    tt_khach_hang: Object.keys(kh || {}).length ? kh : null,
  };

  if (isUuid(input.sanId)) row.san_id = String(input.sanId);
  // Hợp đồng phân phối của đại lý (cơ sở tính hoa hồng)
  const hdPhanPhoi = uuidOrNull(hd?.MaHDPhanPhoi ?? raw?.MaHDPhanPhoi);
  if (hdPhanPhoi) {
    row.agency_contract_id = hdPhanPhoi;
    row.agency_contract_code = str(hd?.SoHDPhanPhoi ?? raw?.SoHDPhanPhoi) ?? null;
  }
  if (isUuid(input.maHDGoc)) row.ma_hd_goc = String(input.maHDGoc);
  if (stage === "GIUCHO") {
    row.so_phieu_gc = str(input.soPhieu ?? raw?.SoPhieu);
    row.ngay_giu_cho = iso(hd?.NgayKy ?? raw?.NgayKy ?? raw?.NgayGiuCho);
  }

  Object.keys(row).forEach((k) => {
    if (row[k] === null || row[k] === undefined) delete row[k];
  });
  row.giai_doan = stage;
  return row;
};

/**
 * Phiếu vòng đời mới nhất của căn (cùng hợp đồng gốc; null = không có hợp đồng gốc) — `fn_pgc_latest_for_product`.
 * null = căn chưa có phiếu; phiếu thuộc công ty ngoài phạm vi người dùng ⇒ ném lỗi (42501) để không tạo phiếu trùng.
 */
export const latestLifecycleForProduct = async (
  sanPhamId: string,
  maHdGoc: string | null
): Promise<{ id: string; giai_doan: string | null; trang_thai_id: string | null; lich_su_chuyen_doi: any } | null> => {
  const { data, error } = await (supabase as any).rpc("fn_pgc_latest_for_product", {
    p_san_pham_id: sanPhamId,
    p_ma_hd_goc: maHdGoc,
  });
  if (error) throw error;
  return (data as any) ?? null;
};

/**
 * Ghi/cập nhật bản ghi vòng đời của 1 sản phẩm. Không bao giờ lùi giai đoạn.
 * Trả về uuid dòng vòng đời.
 */
export const upsertLifecycleRow = async (
  input: LifecycleInput
): Promise<string | null> => {
  const uid = salesTenantUid();
  if (!uid) return null;
  const row = await buildRow(input);
  // lịch ghi qua RPC (bảng cloud_pgc_dot_thanh_toan) sau khi ghi phiếu; input không có lịch → giữ lịch hiện có
  const p0 = input.payload || input.raw?.Payload || {};
  const lich = p0?.LichThanhToan ?? input.raw?.LichThanhToan;
  if (!row.san_pham_id) {
    console.warn("[SalesLifecycle] thiếu UUID sản phẩm, bỏ qua ghi vòng đời");
    return null;
  }
  const res = await safe(async () => {
    // Hợp đồng chuyển nhượng: mỗi cặp (căn, hợp đồng gốc) là 1 dòng vòng đời
    // riêng, KHÔNG ghi đè dòng vòng đời của hợp đồng gốc.
    let existing: any = null;
    if (!input.forceNew) {
      // Phiếu mới nhất của căn tra trên TOÀN tenant ở máy chủ (RLS trần công ty ẩn phiếu công ty khác ⇒ đọc thẳng bảng sẽ
      // chèn phiếu vòng đời thứ 2 cho cùng căn). Phiếu ngoài phạm vi ⇒ lỗi 42501 (không ghi gì).
      existing = await latestLifecycleForProduct(row.san_pham_id, row.ma_hd_goc ?? null);
    }

    if (!existing) {
      const { data, error } = await t()
        .insert(stampOwner({
          ...row,
          ngay_nhap: new Date().toISOString(),
          lich_su_chuyen_doi: [
            {
              giaiDoan: row.giai_doan,
              thoiDiem: new Date().toISOString(),
              nguoiThucHien: currentUserName(),
            },
          ],
        }, "cloud_pgc_phieu_giucho") as any)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      const newId = (data as any)?.id ?? null;
      if (newId && Array.isArray(lich)) await luuLichThanhToan(newId, lich);
      return newId;
    }

    const cur = (existing as any).giai_doan;
    const advanced = stageRank(row.giai_doan) > stageRank(cur);
    const patch: Record<string, any> = { ...row };
    if (!advanced) patch.giai_doan = cur;
    else
      patch.lich_su_chuyen_doi = [
        ...arr((existing as any).lich_su_chuyen_doi),
        {
          tuGiaiDoan: cur,
          tuTrangThaiId: (existing as any).trang_thai_id ?? null,
          giaiDoan: row.giai_doan,
          thoiDiem: new Date().toISOString(),
          nguoiThucHien: currentUserName(),
        },
      ];
    const { error } = await t()
      .update(patch as any)
      .eq("id", (existing as any).id);
    if (error) throw error;
    if (Array.isArray(lich)) await luuLichThanhToan((existing as any).id, lich);
    return (existing as any).id as string;
  });
  const lifecycleId = (res as string) || null;

  if (lifecycleId) {
    const p = input.payload || input.raw?.Payload || {};
    const gt = p?.TTHopDong?.GiaTriHopDong || input.raw?.GiaTriHopDong || null;
    await saveProductPriceSnapshot({
      lifecycleId,
      priceSheetId: p?.TTHopDong?.MaPDK,
      sanPhamId: row.san_pham_id,
      trangThaiId: row.trang_thai_id,
      giaTriHopDong: gt,
    });
  }
  return lifecycleId;
};

export const upsertLifecycle = async (input: LifecycleInput): Promise<boolean> =>
  !!(await upsertLifecycleRow(input));

/** Ghi hàng loạt (dùng khi mirror danh sách từ API cũ). */
export const upsertLifecycleMany = async (inputs: LifecycleInput[]) => {
  for (const i of inputs) {
    // eslint-disable-next-line no-await-in-loop
    await upsertLifecycle(i);
  }
};

/** Chuyển đổi giai đoạn (giữ nguyên dòng vòng đời của sản phẩm). */
export const convertStage = async (
  maPGC: any,
  toStage: SalesStage,
  data?: Partial<LifecycleInput>
): Promise<boolean> =>
  upsertLifecycle({ maPGC, giaiDoan: toStage, ...(data || {}) } as LifecycleInput);

/** Đọc 1 bản ghi vòng đời. */
export const getLifecycle = async (ref: any): Promise<any | null> => {
  const id = await resolveLifecycleId(ref);
  if (!id) return null;
  const res = await safe(async () => {
    const { data, error } = await t().select(PGC_SELECT).eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? await withCustomers(data as any) : data;
  });
  return res ? mapSalesDoc(res) : null;
};

/** Danh sách theo giai đoạn. */
export const listLifecycle = async (filter?: {
  giaiDoan?: SalesStage | SalesStage[];
  maDA?: any;
  includeDeleted?: boolean;
}): Promise<any[]> => {
  const uid = salesTenantUid();
  if (!uid) return [];
  const projectId = filter?.maDA ? await resolveProjectUid(filter.maDA) : null;
  const res = await safe(async () => {
    let q = t().select(PGC_SELECT).eq("ma_ctdk_uid", uid);
    if (filter?.giaiDoan) {
      const stages = Array.isArray(filter.giaiDoan)
        ? filter.giaiDoan
        : [filter.giaiDoan];
      q = q.in("giai_doan", stages);
    }
    if (projectId) q = q.eq("project_id", projectId);
    if (!filter?.includeDeleted) q = q.is("deleted_at", null);
    const { data, error } = await q.order("created_at", { ascending: false });
    if (error) throw error;
    return await withCustomers((data || []) as any[]);
  });
  return mapSalesDocs(res as any[]);
};

/** Danh sách chứng từ của 1 sản phẩm. */
export const listLifecycleByProduct = async (p: {
  maSP?: any;
  kyHieu?: any;
  sanPhamId?: any;
}): Promise<any[]> => {
  const uid = salesTenantUid();
  const sanPhamId = await resolveProductUid({
    id: p?.sanPhamId,
    maSP: p?.maSP,
    kyHieu: p?.kyHieu,
  });
  if (!uid || !sanPhamId) return [];
  const res = await safe(async () => {
    const { data, error } = await t()
      .select(PGC_SELECT)
      .eq("ma_ctdk_uid", uid)
      .eq("san_pham_id", sanPhamId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return await withCustomers((data || []) as any[]);
  });
  return mapSalesDocs(res as any[]);
};

/** Lùi giai đoạn về BOOKING THIỆN CHÍ khi xóa phiếu đặt cọc. */
export const revertDepositStageToBooking = async (
  refs: any[]
): Promise<string[]> => {
  const ids = await resolveLifecycleIds(refs);
  if (!ids.length) return [];
  const reverted: string[] = [];
  await safe(async () => {
    const { data, error } = await t().select("*").in("id", ids);
    if (error) throw error;
    for (const row of (data || []) as any[]) {
      const fromBooking = !!(row?.so_phieu_gc || row?.ngay_giu_cho);
      if (String(row?.giai_doan).toUpperCase() !== "DATCOC" || !fromBooking)
        continue;
      const history = arr(row?.lich_su_chuyen_doi);
      const last = [...history]
        .reverse()
        .find((h: any) => String(h?.giaiDoan).toUpperCase() === "DATCOC");
      const prevStatusId =
        last?.tuTrangThaiId ??
        (await resolveStatusUid("pgc_trang_thai", "Đã duyệt booking"));
      // eslint-disable-next-line no-await-in-loop
      const { error: upErr } = await t()
        .update({
          giai_doan: "GIUCHO",
          trang_thai_id: prevStatusId ?? null,
          lich_su_chuyen_doi: [
            ...history,
            {
              tuGiaiDoan: "DATCOC",
              tuTrangThaiId: row?.trang_thai_id ?? null,
              giaiDoan: "GIUCHO",
              trangThaiId: prevStatusId ?? null,
              lyDo: "Xóa phiếu đặt cọc",
              thoiDiem: new Date().toISOString(),
              nguoiThucHien: currentUserName(),
            },
          ],
        } as any)
        .eq("id", row.id);
      if (upErr) throw upErr;
      reverted.push(String(row.id));
    }
  });
  return reverted;
};

export const softDeleteLifecycle = async (refs: any[]) => {
  const ids = await resolveLifecycleIds(refs);
  if (!ids.length) return;
  await safe(async () => {
    const { error } = await t()
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: currentUserName(),
      } as any)
      .in("id", ids);
    if (error) throw error;
  });
};

export const restoreLifecycle = async (refs: any[]) => {
  const ids = await resolveLifecycleIds(refs);
  if (!ids.length) return;
  await safe(async () => {
    const { error } = await t()
      .update({ deleted_at: null, deleted_by: null } as any)
      .in("id", ids);
    if (error) throw error;
  });
};

/**
 * Xóa hẳn dòng vòng đời (chỉ khi không còn chứng từ nào tham chiếu).
 * Kiểm "còn được dùng" + xoá chạy ở máy chủ (fn_lifecycle_delete, 20261015230900 — BUG-2a-005): RLS theo phạm vi người gọi
 * ẩn chứng từ của công ty khác (vd cọc trên phiếu đã xoá mềm) nên kiểm qua PostgREST có thể xoá nhầm phiếu còn dùng.
 * Phiếu còn dùng / không tìm thấy / ngoài phạm vi: bỏ qua lặng lẽ như trước.
 */
export const deleteLifecycle = async (refs: any[]) => {
  const ids = await resolveLifecycleIds(refs);
  if (!ids.length) return;
  for (const id of ids) {
    // eslint-disable-next-line no-await-in-loop
    await safe(async () => {
      const { error } = await supabase.rpc("fn_lifecycle_delete" as any, {
        p_pgc_id: id,
      } as any);
      if (error) throw error;
    });
  }
};

/** Cập nhật trạng thái chứng từ (theo uuid danh mục pgc_trang_thai). */
export const setLifecycleStatus = async (refs: any[], tenTT: string) => {
  const ids = await resolveLifecycleIds(refs);
  const ttId = await resolveStatusUid("pgc_trang_thai", tenTT);
  if (!ids.length || !ttId) return;
  await safe(async () => {
    const { error } = await t()
      .update({ trang_thai_id: ttId } as any)
      .in("id", ids);
    if (error) throw error;
  });
  await syncSnapshotStatus(ids, ttId);
};

/**
 * Lùi giai đoạn hợp đồng về giai đoạn trước khi xóa hợp đồng:
 *   HDGV → DATCOC (phiếu quay lại màn Đặt cọc)
 *   HDMB → HDGV / DATCOC theo lịch sử chuyển đổi
 */
export const revertContractStage = async (
  refs: any[],
  loaiCT: "HDGV" | "HDMB" = "HDGV"
): Promise<string[]> => {
  const ids = await resolveLifecycleIds(refs);
  if (!ids.length) return [];
  const reverted: string[] = [];
  await safe(async () => {
    const { data, error } = await t().select("*").in("id", ids);
    if (error) throw error;
    for (const row of (data || []) as any[]) {
      if (String(row?.giai_doan).toUpperCase() !== loaiCT) continue;
      const history = arr(row?.lich_su_chuyen_doi);
      const last = [...history]
        .reverse()
        .find((h: any) => String(h?.giaiDoan).toUpperCase() === loaiCT);
      const prevStage: SalesStage =
        (String(last?.tuGiaiDoan || "").toUpperCase() as SalesStage) ||
        (loaiCT === "HDGV" ? "DATCOC" : "HDGV");
      const patch: Record<string, any> = {
        giai_doan: prevStage,
        lich_su_chuyen_doi: [
          ...history,
          {
            tuGiaiDoan: loaiCT,
            tuTrangThaiId: row?.trang_thai_id ?? null,
            giaiDoan: prevStage,
            trangThaiId: last?.tuTrangThaiId ?? null,
            lyDo: `Xóa hợp đồng ${loaiCT}`,
            thoiDiem: new Date().toISOString(),
            nguoiThucHien: currentUserName(),
          },
        ],
      };
      if (last?.tuTrangThaiId) patch.trang_thai_id = last.tuTrangThaiId;
      // eslint-disable-next-line no-await-in-loop
      const { error: upErr } = await t().update(patch as any).eq("id", row.id);
      if (upErr) throw upErr;
      reverted.push(String(row.id));
    }
  });
  return reverted;
};

export const SalesLifecycleCloudService = {

  upsertLifecycle,
  upsertLifecycleRow,
  upsertLifecycleMany,
  convertStage,
  getLifecycle,
  listLifecycle,
  listLifecycleByProduct,
  softDeleteLifecycle,
  deleteLifecycle,
  restoreLifecycle,
  revertDepositStageToBooking,
  revertContractStage,
  setLifecycleStatus,
  resolveLifecycleId,
  stageRank,
};

export default SalesLifecycleCloudService;

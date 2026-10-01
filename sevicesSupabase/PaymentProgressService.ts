import axiosApiSupabase from "./axiosApiSupabase";
import { getCompanyId } from "./cloudTenant";
import { ScheduleRow, allocatePaidToSchedule, mapScheduleRpcRow, pgcVoucherTotal } from "../lib/paymentMath";

/**
 * Lịch thanh toán + phiếu thu của MỘT phiếu (đặt cọc / hợp đồng) – y hệt web ContractDetail
 * (dùng chung cho cọc: DepositContractManagement mở ContractDetail type="DATCOC"):
 *  - Lịch: fn_contract_payment_schedule (ContractScheduleService); rỗng → lịch lưu `lich_tt_hd`
 *    (parent_code = uuid phiếu giữ chỗ) + phân bổ tổng tiền các phiếu thu (allocatePaidToSchedule).
 *  - Phiếu thu: fn_cash_vouchers_by_pgc (CashVoucherService.listVouchersByPgc), tiền = so_tien_pgc.
 * pgcId luôn là uuid PHIẾU GIỮ CHỖ (không phải uuid cọc / hợp đồng).
 */

export type Receipt = {
  id: string;
  soPhieu: string;
  ngay: string | null;
  /** Phần tiền của phiếu thu thuộc phiếu này */
  soTien: number;
  /** Tổng tiền cả tờ phiếu thu */
  tongPhieu: number;
  dienGiai: string;
  nguoiNop: string;
  hinhThuc: string;
};

const n = (v: any) => Number(v || 0) || 0;

/** Dòng lịch lưu trên cloud_catalogs → dòng lịch (web normalizeScheduleRow). */
function normalizeStoredRow(r: any, index: number) {
  const soTien = r?.SoTien ?? r?.PhaiThu ?? r?.TuongUng;
  const phaiThu = r?.PhaiThu ?? soTien;
  return {
    DotTT: r?.DotTT ?? r?.Dot ?? index + 1,
    DotTTText: r?.DotTTText ?? r?.KieuThanhToan ?? "",
    NgayTT: r?.NgayTT ?? null,
    TyLeTT: n(r?.TyLeTT),
    PhaiThu: n(phaiThu),
    PhaiThuPBT: n(r?.PhaiThuPBT ?? r?.PhiBT),
    DienGiai: r?.DienGiai ?? r?.GhiChu ?? "",
  };
}

async function rpcVouchers(pgcId: string): Promise<any[]> {
  const companyId = await getCompanyId();
  const res = await axiosApiSupabase.post("rest/v1/rpc/fn_cash_vouchers_by_pgc", {
    p_ma_ctdk_uid: companyId,
    p_pgc_id: pgcId,
    p_loai: "THU",
  });
  return Array.isArray(res.data) ? res.data : [];
}

export const PaymentProgressService = {
  /** Lịch thanh toán từng đợt kèm Đã thu / Còn lại (gốc và phí bảo trì). */
  getSchedule: async (
    pgcId: string | null | undefined
  ): Promise<{ rows: ScheduleRow[]; source: "server" | "fallback" | "none"; error?: boolean }> => {
    if (!pgcId) return { rows: [], source: "none" };
    const companyId = await getCompanyId();
    try {
      const res = await axiosApiSupabase.post("rest/v1/rpc/fn_contract_payment_schedule", {
        p_ma_ctdk_uid: companyId,
        p_pgc_id: pgcId,
      });
      const rows = (Array.isArray(res.data) ? res.data : []).map(mapScheduleRpcRow);
      if (rows.length) return { rows, source: "server" };
    } catch (e) {
      // Web: lỗi hàm máy chủ → coi như rỗng, chuyển sang lịch dự phòng
      console.log("WARN fn_contract_payment_schedule:", e);
    }

    // Dự phòng như web: lịch lưu + phân bổ tổng tiền phiếu thu (web cộng TOÀN BỘ tờ phiếu – spec 0.2)
    try {
      const r = await axiosApiSupabase.get("rest/v1/cloud_catalogs", {
        params: {
          select: "raw",
          ma_ctdk_uid: `eq.${companyId}`,
          catalog_type: "eq.lich_tt_hd",
          parent_code: `eq.${pgcId}`,
        },
      });
      const stored = (Array.isArray(r.data) ? r.data : [])
        .map((x: any, i: number) => normalizeStoredRow(x?.raw || {}, i))
        .sort((a: any, b: any) => Number(a.DotTT || 0) - Number(b.DotTT || 0));
      if (!stored.length) return { rows: [], source: "none" };
      let totalPaid = 0;
      try {
        totalPaid = (await rpcVouchers(pgcId)).reduce((s, v) => s + n(v?.so_tien), 0);
      } catch {}
      const allocated = allocatePaidToSchedule(stored, totalPaid);
      const rows: ScheduleRow[] = allocated.map((x: any) => ({
        DotTT: Number(x.DotTT) || 0,
        DotTTText: x.DotTTText || `Đợt ${x.DotTT}`,
        NgayTT: x.NgayTT,
        TyLeTT: x.TyLeTT,
        PhaiThu: x.PhaiThu,
        DaThu: x.DaThu,
        ConLai: x.PhaiThu - x.DaThu,
        PhaiThuPBT: x.PhaiThuPBT,
        PhiBT: x.PhaiThuPBT,
        DaThuPBT: x.DaThuPBT,
        ConNoPBT: x.PhaiThuPBT - x.DaThuPBT,
        DienGiai: x.DienGiai,
      }));
      return { rows, source: "fallback" };
    } catch (e) {
      console.log("ERROR payment schedule fallback:", e);
      return { rows: [], source: "none", error: true };
    }
  },

  /** Phiếu thu của phiếu – tiền là phần thuộc phiếu này (so_tien_pgc), như tab Phiếu thu web. */
  getReceipts: async (
    pgcId: string | null | undefined
  ): Promise<{ rows: Receipt[]; total: number; error: boolean }> => {
    if (!pgcId) return { rows: [], total: 0, error: false };
    try {
      const raw = await rpcVouchers(pgcId);
      const rows: Receipt[] = raw.map((v: any) => ({
        id: String(v?.id ?? v?.so_phieu ?? ""),
        soPhieu: v?.so_phieu || "",
        ngay: v?.ngay_phieu ?? null,
        soTien: n(v?.so_tien_pgc),
        tongPhieu: n(v?.so_tien),
        dienGiai: v?.dien_giai || "",
        nguoiNop: v?.nguoi_nop || "",
        hinhThuc: v?.hinh_thuc || "",
      }));
      return { rows, total: pgcVoucherTotal(raw), error: false };
    } catch (e) {
      console.log("ERROR fn_cash_vouchers_by_pgc:", e);
      return { rows: [], total: 0, error: true };
    }
  },
};

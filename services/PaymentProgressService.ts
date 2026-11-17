import { callNv, errorMessage } from "@/services/nvApi";
import { ScheduleRow, mapScheduleRpcRow, pgcVoucherTotal } from "../lib/paymentMath";

/**
 * Lịch thanh toán + phiếu thu của MỘT phiếu (đặt cọc / hợp đồng) – y hệt web ContractDetail
 * (dùng chung cho cọc: DepositContractManagement mở ContractDetail type="DATCOC"), qua bộ API riêng app:
 *  - Lịch: fn_nv_app_lich_tt_phieu = fn_contract_payment_schedule của web (máy chủ tự đọc lịch lưu `lich_tt_hd`, phân bổ phiếu thu,
 *    số tiền điều chỉnh). Như web: không còn tự dựng lịch dự phòng ở máy.
 *  - Phiếu thu: fn_nv_app_phieu_thu_phieu = fn_cash_vouchers_by_pgc (THU), tiền = so_tien_pgc.
 * Công ty lấy từ phiên ở máy chủ. `pgcId`: uuid phiếu giữ chỗ — hoặc uuid hợp đồng / phiếu cọc (máy chủ tự quy về phiếu giữ chỗ).
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

export const PaymentProgressService = {
  /** Lịch thanh toán từng đợt kèm Đã thu / Còn lại (gốc và phí bảo trì). Lỗi tải ⇒ error (không giả lịch rỗng là "chưa có lịch"). */
  getSchedule: async (
    pgcId: string | null | undefined
  ): Promise<{ rows: ScheduleRow[]; source: "server" | "none"; error?: boolean }> => {
    if (!pgcId) return { rows: [], source: "none" };
    try {
      const data = await callNv<any[]>("fn_nv_app_lich_tt_phieu", { p_id: pgcId });
      const rows = (Array.isArray(data) ? data : []).map(mapScheduleRpcRow);
      return { rows, source: rows.length ? "server" : "none" };
    } catch (e) {
      console.log("ERROR fn_nv_app_lich_tt_phieu:", errorMessage(e));
      return { rows: [], source: "none", error: true };
    }
  },

  /** Phiếu thu của phiếu – tiền là phần thuộc phiếu này (so_tien_pgc), như tab Phiếu thu web. */
  getReceipts: async (
    pgcId: string | null | undefined
  ): Promise<{ rows: Receipt[]; total: number; error: boolean }> => {
    if (!pgcId) return { rows: [], total: 0, error: false };
    try {
      const data = await callNv<any[]>("fn_nv_app_phieu_thu_phieu", { p_id: pgcId });
      const raw = Array.isArray(data) ? data : [];
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
      console.log("ERROR fn_nv_app_phieu_thu_phieu:", errorMessage(e));
      return { rows: [], total: 0, error: true };
    }
  },
};

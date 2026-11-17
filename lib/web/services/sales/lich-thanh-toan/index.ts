// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/lich-thanh-toan/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Lịch thanh toán của phiếu giữ chỗ / đặt cọc / hợp đồng — ghi qua RPC `fn_pgc_lich_tt_luu`
 * (migration 20261015110000_lich_tt_doc_lap_cot), KHÔNG ghi thẳng cột `cloud_pgc_phieu_giucho.lich_thanh_toan`
 * (cột cũ sẽ bị xoá; lịch nằm ở bảng `cloud_pgc_dot_thanh_toan`).
 *
 * Máy chủ: công ty lấy từ JWT, phiếu phải thuộc công ty, cần quyền ADD hoặc EDIT ở một màn bán hàng / hợp đồng.
 * Đọc lịch qua REST: trường tính toán `lich_thanh_toan:lich_tt` (xem `PGC_SELECT`, `PGC_LIST_SELECT`).
 */
import { rpcRaw } from "../../_core/rpc";

/** Ghi đè toàn bộ lịch (phần tử dạng `LichThanhToan` cũ: DotTT, NgayTT, TyLeTT, SoTien…). Lỗi → ném Error. */
export async function luuLichThanhToan(pgcId: string, lich: unknown[]): Promise<void> {
  await rpcRaw(
    "fn_pgc_lich_tt_luu",
    { p_pgc_id: pgcId, p_lich: Array.isArray(lich) ? lich : [] },
    { errorField: true, fallback: "Không lưu được lịch thanh toán" }
  );
}

// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/customer-conditions/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Thông tin khách cho điều kiện của mức chiết khấu — fn_sales_customer_conditions (thay fn_sales_customer_provinces, 2026-11-17):
 *   tinh    : id tb_dm_tinh của người đứng tên / đồng đứng tên + chủ / đồng chủ HĐ liên quan (điều kiện «Tỉnh», spec csbh-dieu-kien-toa-tinh B)
 *   so_hdmb : số HĐMB đang sở hữu theo CCCD (chủ / đồng chủ) + HĐ liên quan, trừ phiếu của chứng từ đang lập (điều kiện «Mua nhiều», spec csbh-mua-nhieu)
 * Máy chủ gộp, lọc tenant, chỉ trả mã tỉnh + con số. Lỗi ném lên để màn coi là chưa xác định.
 */
import { rpcRaw } from "../../_core/rpc";

export type CustomerConditions = { tinhIds: string[]; soHdmb: number };

export const fetchCustomerConditions = async (customerIds: string[], excludePgc: string | null | undefined): Promise<CustomerConditions> => {
  const raw = await rpcRaw<unknown>(
    "fn_sales_customer_conditions",
    { p_customer_ids: customerIds, p_exclude_pgc: excludePgc ?? null },
    { fallback: "Không tải được thông tin khách hàng cho điều kiện chiết khấu" },
  );
  const d = (typeof raw === "string" ? JSON.parse(raw) : raw) as { tinh?: unknown; so_hdmb?: unknown } | null;
  return {
    tinhIds: Array.isArray(d?.tinh) ? d!.tinh.map((x) => String(x)) : [],
    soHdmb: Number.isFinite(Number(d?.so_hdmb)) ? Number(d?.so_hdmb) : 0,
  };
};

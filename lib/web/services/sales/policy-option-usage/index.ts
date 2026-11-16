// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/policy-option-usage/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Số chứng từ cọc / hợp đồng còn hiệu lực đã dùng từng mức chi tiết chiết khấu (spec so-luong-thoi-gian-chi-tiet-ck),
 * để Phiếu tính giá / Hợp đồng khóa mức hết suất. Không cache vì số suất đổi liên tục. Lỗi (vd API chưa deploy RPC) ⇒ rỗng:
 * form coi như chưa có suất nào bị dùng; máy chủ vẫn chặn khi lưu.
 * khoStock (spec chinh-sach-theo-kho D6, D7): tồn kho theo mức chiết khấu theo kho (fn_gift_warehouse_stock_for_policy), tải song song;
 * lỗi (API cũ chưa có RPC) ⇒ {}.
 */
import { rpcRaw } from "../../_core/rpc";
import { giftWarehouseService, type PolicyKhoStock } from "../../projects/gift-warehouse";

type UsageRow = { ID: string; DaDung: number; TheoCongTy?: { CongTyId: string | null; DaDung: number }[] };

export type OptionUsage = {
  usage: Record<string, number>;
  /** mức → công ty bán hàng (id chữ thường; chứng từ không có công ty = "") → số đã dùng */
  usageByCompany: Record<string, Record<string, number>>;
  /** mức theo kho (option.ID) → tồn của dòng kho */
  khoStock: Record<string, PolicyKhoStock>;
};

const loadKhoStock = async (policyId: string, excludePgcId?: string | null): Promise<Record<string, PolicyKhoStock>> => {
  try {
    const out: Record<string, PolicyKhoStock> = {};
    (await giftWarehouseService.stockForPolicy(policyId, excludePgcId)).forEach((s) => {
      if (s.option_id) out[s.option_id] = s;
    });
    return out;
  } catch {
    return {};
  }
};

export const loadOptionUsage = async (policyId: string, excludePgcId?: string | null): Promise<OptionUsage> => {
  const [base, khoStock] = await Promise.all([loadUsage(policyId, excludePgcId), loadKhoStock(policyId, excludePgcId)]);
  return { ...base, khoStock };
};

const loadUsage = async (policyId: string, excludePgcId?: string | null): Promise<Omit<OptionUsage, "khoStock">> => {
  try {
    const rows = await rpcRaw<UsageRow[]>("fn_sales_policy_option_usage", {
      p_policy_id: policyId,
      p_exclude_pgc_id: excludePgcId ?? null,
    });
    const usage: Record<string, number> = {};
    const usageByCompany: Record<string, Record<string, number>> = {};
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      if (!r?.ID) return;
      const id = String(r.ID);
      usage[id] = Number(r.DaDung) || 0;
      const byCo: Record<string, number> = {};
      (Array.isArray(r.TheoCongTy) ? r.TheoCongTy : []).forEach((c) => {
        const k = c?.CongTyId ? String(c.CongTyId).toLowerCase() : "";
        byCo[k] = (byCo[k] ?? 0) + (Number(c?.DaDung) || 0);
      });
      usageByCompany[id] = byCo;
    });
    return { usage, usageByCompany };
  } catch {
    return { usage: {}, usageByCompany: {} };
  }
};

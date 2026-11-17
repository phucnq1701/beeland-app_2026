// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/useOptionUsage.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Số suất đã dùng từng mức chi tiết chiết khấu của chính sách đang chọn; tải lại khi đổi chính sách / chứng từ loại trừ */
import { useEffect, useState } from "react";
import { loadOptionUsage, type OptionUsage } from "../../../services/sales/policy-option-usage";

/** Cùng một object rỗng mỗi lần render, để bối cảnh phía sau không bị tính lại liên tục */
const EMPTY: Record<string, number> = Object.freeze({}) as Record<string, number>;
const EMPTY_BY_CO: Record<string, Record<string, number>> = Object.freeze({}) as Record<string, Record<string, number>>;
const EMPTY_KHO: OptionUsage["khoStock"] = Object.freeze({}) as OptionUsage["khoStock"];

export function useOptionUsage(
  policyId?: string | null,
  excludePgcId?: string | null,
): OptionUsage & { loading: boolean } {
  const key = policyId ? `${policyId}|${excludePgcId ?? ""}` : "";
  const [state, setState] = useState<{ key: string; } & OptionUsage | null>(null);

  useEffect(() => {
    if (!policyId) return;
    let alive = true;
    loadOptionUsage(policyId, excludePgcId).then((u) => alive && setState({ key, ...u }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!policyId) return { usage: EMPTY, usageByCompany: EMPTY_BY_CO, khoStock: EMPTY_KHO, loading: false };
  return state?.key === key
    ? { usage: state.usage, usageByCompany: state.usageByCompany, khoStock: state.khoStock ?? EMPTY_KHO, loading: false }
    : { usage: EMPTY, usageByCompany: EMPTY_BY_CO, khoStock: EMPTY_KHO, loading: true };
}

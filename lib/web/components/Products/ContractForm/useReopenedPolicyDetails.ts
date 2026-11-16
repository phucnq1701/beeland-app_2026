// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/useReopenedPolicyDetails.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { toast } from "../../../_shims/sonner";

export type PolicyDetailsStatus = "idle" | "loading" | "loaded" | "failed";

/** Chi tiết từ phản hồi getPolicyById. Chính sách không còn ⇒ rỗng; lỗi tải ⇒ ném lỗi để thử lại */
export const detailsFromPolicyResponse = (res: any): any[] => {
  if (res?.status === 2000 || res?.notFound) return Array.isArray(res?.detail) ? res.detail : [];
  throw new Error(res?.message || "Không tải được chi tiết chính sách");
};

/**
 * Chứng từ mở lại có dòng đã lưu: nạp chi tiết chính sách (các mức, nút "Thêm chiết khấu").
 * Chưa tải xong hoặc tải lỗi thì chặn lưu, vì dòng chưa biết có mức sẽ bị bỏ khi lưu và lệch vị trí.
 */
export function useReopenedPolicyDetails(
  policyId: unknown,
  load: (id: string) => Promise<any>,
  onLoaded: (details: any[]) => void
) {
  const [request, setRequest] = useState<{ id: string } | null>(null);
  const [status, setStatus] = useState<PolicyDetailsStatus>("idle");
  const latestPolicyId = useRef(policyId);
  latestPolicyId.current = policyId;

  useEffect(() => {
    if (!request) return;
    let cancelled = false;
    load(request.id)
      .then(detailsFromPolicyResponse)
      .then((details) => {
        if (cancelled) return;
        // Đã đổi chính sách trong lúc chờ ⇒ bỏ kết quả
        if (String(latestPolicyId.current ?? "") !== request.id) return setStatus("idle");
        if (details.length) onLoaded(details);
        setStatus("loaded");
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Không tải được chi tiết chính sách:", err);
        toast.error("Không tải được chi tiết chính sách");
        setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const begin = (id: unknown) => {
    setStatus("loading");
    setRequest({ id: String(id) });
  };
  const reset = () => {
    setStatus("idle");
    setRequest(null);
  };
  const pending = status === "loading" || status === "failed";
  /** Gọi đầu hàm lưu: false là phải dừng. Đang lỗi thì tải lại để lần lưu sau đi tiếp */
  const guardSave = (): boolean => {
    if (!pending) return true;
    toast.error("Chưa tải xong chi tiết chính sách, vui lòng thử lại");
    if (status === "failed" && request) begin(request.id);
    return false;
  };

  return { status, pending, begin, reset, guardSave };
}

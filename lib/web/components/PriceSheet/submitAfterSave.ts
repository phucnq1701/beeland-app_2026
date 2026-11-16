// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/PriceSheet/submitAfterSave.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { toast } from "../../_shims/sonner";
import { ApprovalFlowService } from "../../services/workflows/approvalFlow";

/**
 * PriceSheetForm có 2 nút cho phiếu tính giá: "Lưu nháp" và "Lưu & gửi phê duyệt".
 * Form chỉ trả payload kèm cờ `_submitApproval`; màn mở form tự lưu rồi gọi các hàm dưới đây.
 */

/** Lấy cờ "gửi phê duyệt" và gỡ khỏi payload để không lưu cờ vào dữ liệu phiếu. */
export const takeSubmitApprovalFlag = (payload: unknown): boolean => {
  if (!payload || typeof payload !== "object") return false;
  const p = payload as { _submitApproval?: unknown };
  const flag = !!p._submitApproval;
  delete p._submitApproval;
  return flag;
};

/**
 * Phiếu vừa lưu (Nháp) ⇒ gửi vào quy trình phê duyệt của dự án.
 * Dự án chưa cài quy trình ⇒ giữ Nháp và báo. Lỗi gửi không làm mất bản đã lưu.
 * Trả về true nếu đã gửi phê duyệt.
 */
export const submitPriceSheetAfterSave = async (saved: { id?: string | null; da_project_id?: string | null } | null | undefined): Promise<boolean> => {
  const id = saved?.id ? String(saved.id) : "";
  if (!id) return false;
  try {
    const projectId = saved?.da_project_id ? String(saved.da_project_id) : "";
    const flows = projectId ? await ApprovalFlowService.projectFlows("PRICE_SHEET", [projectId]) : [];
    if (!flows?.length) {
      toast.warning("Dự án chưa cài quy trình phê duyệt phiếu tính giá — phiếu được lưu ở trạng thái Nháp");
      return false;
    }
    await ApprovalFlowService.submit("PRICE_SHEET", id);
    toast.success("Đã lưu và gửi phê duyệt phiếu tính giá");
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : (e as { message?: string } | null)?.message;
    toast.error(`Đã lưu nháp nhưng chưa gửi được phê duyệt: ${msg || "lỗi không xác định"}`);
    return false;
  }
};

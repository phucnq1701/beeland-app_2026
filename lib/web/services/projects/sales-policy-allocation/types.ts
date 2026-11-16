// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/projects/sales-policy-allocation/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type { PolicyOptionAllocation } from "../../DaSalesPolicyService";

/**
 * Trạng thái phân bổ CTBH của một dòng chiết khấu (spec phan-bo-ctbh-duyet §3), tính từ dữ liệu, không lưu riêng:
 * CHO_DUYET = mới có bản chờ; CO_THAY_DOI = đã có bản hiệu lực và có bản chờ; DA_DUYET = chỉ bản hiệu lực;
 * KHONG_CAN = dòng "Không cần phân bổ CTBH", chưa có bản nào; CHUA = có mức, chưa phân bổ.
 */
export type AllocationStatus = "CHO_DUYET" | "CO_THAY_DOI" | "DA_DUYET" | "KHONG_CAN" | "CHUA";

/** Người / giờ gửi bản chờ (`detail[].PhanBoGui`); `GuiLuc` là chuỗi máy chủ trả, gửi lại nguyên văn khi duyệt */
export type AllocationSubmit = { NguoiGuiId: string | null; NguoiGui: string | null; GuiLuc: string };

/** Màn gọi: `detail` = Chi tiết chính sách bán hàng (form 408), `policy` = Chính sách bán hàng (form 407) */
export type AllocationScreen = "detail" | "policy";

/** Một mức gửi lên khi lưu bản chờ: `PhanBo` rỗng = đề xuất bỏ hết phân bổ của mức */
export type AllocationItem = { ID: string; PhanBo: PolicyOptionAllocation[] };

// ⚠️ TỰ SINH — bản chép nguyên văn web src/pages/sales/giao-dich/dat-lich-ky/signingFieldValues.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { SIGNING_ENTERPRISE_PHAN_LOAI } from "../../../../config/fieldConfigCatalog";
import type { CustomerKind } from "./types";

/** Khối đồng sở hữu có hiện không: cá nhân + (phân loại đồng sở hữu hoặc đã có người đồng đứng tên). */
export function hasCoOwnerSlot(form: any, kind: CustomerKind): boolean {
  return (
    kind === "individual" &&
    (Number(form?.MaPhanLoaiKH) === 2 ||
      (Array.isArray(form?.CoOwners) && form.CoOwners.length > 0))
  );
}

/**
 * Dựng `values` theo khoá danh mục "signing" từ state form Book ký.
 * MaPhanLoaiKH suy từ `kind` (form đang hiện) chứ không từ ô chọn, để `when` của
 * trường doanh nghiệp bám theo biểu mẫu con đang hiển thị.
 */
export function signingValues(form: any, kind: CustomerKind): Record<string, any> {
  const f = form || {};
  return {
    ...f,
    // Giao dịch có lịch thanh toán ⇒ ô Phương án thanh toán khoá theo lịch, coi như đã nhập (DK29; máy chủ kiểm giống vậy)
    MaPhuongAnTT: f.MaLichTT ? String(f.MaLichTT) : f.MaPhuongAnTT,
    MaPhanLoaiKH: kind === "enterprise" ? SIGNING_ENTERPRISE_PHAN_LOAI : 1,
    CoOwners: Array.isArray(f.CoOwners) ? f.CoOwners : [],
    CoOwnerSlot: hasCoOwnerSlot(f, kind),
  };
}

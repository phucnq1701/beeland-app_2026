// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Sales/salesConfig/approvedConfig.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
/**
 * Cấu hình bán hàng chỉ dùng bản đã duyệt (`approved`): chính sách bán hàng và
 * tiến độ thanh toán `pending` không được tự điền / nạp đợt, chiết khấu.
 * Lưu ý `status` của kết quả (2000 / 5000) khác `data.status` (pending / approved).
 */
import { toast } from "../../../_shims/sonner";
import * as DaSalesPolicyService from "../../../services/DaSalesPolicyService";
import * as DaPaymentScheduleService from "../../../services/DaPaymentScheduleService";

export const PENDING_SUFFIX = " (Chờ duyệt)";

export interface ConfigOption {
  value: string;
  label: string;
  raw?: any;
}

/** Dòng chính sách (kết quả fn_get_sales_policies) -> dạng raw các form đang dùng */
export const mapPolicyRow = (c: any) => ({
  ...c,
  ID: c.id,
  TenChinhSach: c.ten_cs,
  LoaiHinh: c.form_code,
  FormCode: c.form_code,
  MaCauHinhTinhGia: c.pricing_config_id,
  CauHinhId: c.pricing_config_id,
  MaTruonghopTT: c.payment_schedule_id,
});

/** Dòng tiến độ (kết quả fn_get_payment_schedules) -> dạng raw các form đang dùng */
export const mapScheduleRow = (c: any) => ({
  ...c,
  ID: c.id,
  MaTH: c.id,
  TenTH: c.name,
  SoDot: c.so_dot ?? 0,
  TongTyLeTT: Number(c.tong_tt ?? 0),
});

/** Tên hiển thị ở ô chọn / chip: dòng thêm từ bản đã lưu có `NhanHienThi` (kèm " (Chờ duyệt)"); trường tên giữ sạch để lưu */
export const displayName = (row: any, key: "TenChinhSach" | "TenTH"): string => row?.NhanHienThi ?? row?.[key];

/** Bảng giá -> chính sách gắn; null khi bảng giá không gắn hoặc chính sách không có trong danh sách chọn hoặc chưa duyệt */
export const pickPolicyFromPriceList = (
  priceLists: ConfigOption[],
  policies: ConfigOption[],
  priceListId?: string | null,
): { policyId: string; raw: any } | null => {
  const pl = priceLists.find((o) => o.value === priceListId)?.raw as any;
  const policyId = pl?.sales_policy_id ? String(pl.sales_policy_id) : null;
  if (!policyId) return null;
  const policy = policies.find((o) => o.value === policyId);
  return policy?.raw?.status === "approved" ? { policyId, raw: policy.raw } : null;
};

/** Các dòng bảng giá của ContractForm / PriceSheetForm */
export const toPriceListRows = (options: ConfigOption[]): any[] =>
  options.map((o) => ({ ...o.raw, ID: o.raw?.id, TenDot: o.label }));

/** `pending: true` trên kết quả để form biết `detail` rỗng là do chưa duyệt (không báo "chưa có chi tiết") */
export const getApprovedPolicyById = async (id: any): Promise<any> => {
  const res: any = await DaSalesPolicyService.getPolicyById(id);
  if (res?.data?.status !== "pending") return res;
  toast.warning(`Chính sách bán hàng "${res.data.TenChinhSach ?? ""}" đang chờ duyệt, không nạp chiết khấu từ bản này.`);
  return { ...res, data: { ...res.data, ListChiTiet: [] }, detail: [], pending: true };
};

export const getApprovedScheduleById = async (id: any): Promise<any> => {
  const res: any = await DaPaymentScheduleService.getScheduleById(id);
  if (res?.data?.status !== "pending") return res;
  toast.warning(`Tiến độ thanh toán "${res.data.TenTH ?? ""}" đang chờ duyệt, không nạp các đợt từ bản này.`);
  return { ...res, detail: [], pending: true };
};

/** Khôi phục chứng từ đã lưu mà mẫu đang gắn chờ duyệt: báo cho người dùng biết lịch được giữ nguyên, không tính lại từ mẫu */
export const warnPendingScheduleKept = (res: { data?: { status?: string; TenTH?: unknown } | null } | null | undefined): void => {
  if (res?.data?.status !== "pending") return;
  toast.warning(`Tiến độ thanh toán "${res.data.TenTH ?? ""}" đang chờ duyệt: giữ nguyên lịch và hạn đã lưu, không tính lại từ mẫu. Nếu sửa số liệu tài chính, số tiền tính theo %TT, không theo công thức của mẫu.`);
};

/**
 * Ô chọn chính sách của form bảng giá: chỉ bản `approved` cộng bản đang gắn
 * (giữ dù khác loại hình), bản đang gắn chưa duyệt có hậu tố " (Chờ duyệt)".
 */
export const toPolicyOptions = (
  rows: any[],
  wantForm: string,
  linkedId?: string | null,
): { value: string; label: string }[] =>
  (rows || [])
    .filter((r) => {
      const linked = !!linkedId && String(r?.ID) === String(linkedId);
      return linked || (r?.status === "approved" && (!r?.FormCode || r.FormCode === wantForm));
    })
    .map((r) => {
      const name = r.TenChinhSach || String(r.ID);
      return { value: String(r.ID), label: r.status === "approved" ? name : `${name}${PENDING_SUFFIX}` };
    });

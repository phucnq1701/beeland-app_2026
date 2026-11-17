/**
 * Cổng thanh toán (QR tài khoản định danh — VA) qua bộ API riêng app: `fn_nv_app_cong_thanh_toan { p_action, … }`.
 * Máy chủ dùng chung lõi với web (PaymentGatewayEdgeService) ⇒ VA tạo ở app hay web là một, trạng thái đồng bộ hai bên.
 * Xác thực bằng JWT (callNv) — không gửi token phiên / công ty từ máy. Lỗi ⇒ Error mang thông điệp máy chủ (như web).
 */
import { callNv } from "@/services/nvApi";

type Action = "accounts" | "create" | "delete" | "expire_sweep" | "list";

function call<T = any>(action: Action, payload: Record<string, unknown> = {}): Promise<T> {
  return callNv<T>("fn_nv_app_cong_thanh_toan", { p_action: action, ...payload }, { timeout: 45000 });
}

export type GatewayAccount = {
  MaTK: number;
  TenCauHinh: string;
  Provider: string;
  MerchantName?: string;
  ServiceCode?: string;
  MasterAccountNumber?: string;
  IsAccountVA?: boolean;
  IsThanhToanDu?: boolean;
};

export type CreateVAItem = {
  pgc_id: string;
  so_hop_dong?: string;
  khach_hang_id?: string | null;
  ten_kh: string;
  ky_hieu?: string;
  amount: number;
  dien_giai?: string;
};

export type CreateVAResult = {
  pgc_id: string;
  success: boolean;
  message: string | null;
  account_number: string | null;
  account_name?: string;
  bank_code?: string | null;
  id?: string | null;
};

export type ContractVA = {
  id: string;
  account_number: string;
  account_name: string;
  bank_code: string | null;
  provider: string | null;
  ten_cau_hinh: string | null;
  ma_tk: number;
  state: string | null;
  amount: number;
  paid_amount: number;
  dien_giai: string | null;
  status: "ACTIVE" | "DELETED";
  module?: string;
  expires_at?: string | null;
  created_at: string;
};

/** Ảnh QR VietQR giống hệt web (cùng tham số → cùng mã QR). */
export const vietQrUrl = (va: ContractVA) =>
  `https://img.vietqr.io/image/${encodeURIComponent(va.bank_code || "")}-${encodeURIComponent(
    va.account_number
  )}-compact2.png?amount=${Math.round(Number(va.amount) || 0)}&addInfo=${encodeURIComponent(
    va.dien_giai || ""
  )}&accountName=${encodeURIComponent(va.account_name || "")}`;

export const PaymentGatewayService = {
  getAccounts: (projectId: string) => call<GatewayAccount[]>("accounts", { project_id: projectId }),
  create: (p: {
    project_id: string;
    ma_tk: number;
    ten_cau_hinh?: string;
    provider?: string;
    module?: "HOPDONG" | "BOOKING" | "DATCOC";
    /** null = không hạn (đặt cọc) */
    expires_at?: string | null;
    items: CreateVAItem[];
  }) => call<{ message?: string; results: CreateVAResult[] }>("create", p),
  /** Huỷ VA (DELETE virtual-account bên nội bộ + đánh dấu DELETED) — như nút xoá trên web */
  remove: (id: string) => call("delete", { id }),
  expireSweep: (pgcId?: string) => call<{ deleted: number }>("expire_sweep", { pgc_id: pgcId }),
  listByContract: (pgcId: string) =>
    call<{ accounts: ContractVA[]; logs: any[] }>("list", { pgc_id: pgcId }),
};

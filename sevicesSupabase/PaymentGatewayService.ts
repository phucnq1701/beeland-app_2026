/**
 * Cầu nối edge function `payment-gateway` — dùng chung với web
 * (beeland/src/services/PaymentGatewayService.ts), nên tài khoản định danh (VA)
 * tạo ở app hay web đều là một, trạng thái thanh toán đồng bộ hai bên.
 * Xác thực: token phiên đăng nhập Cloud (AsyncStorage "@token") qua x-cloud-token.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosApiSupabase from "./axiosApiSupabase";

async function call<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const token = ((await AsyncStorage.getItem("@token")) || "").trim();
  if (!token) throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
  const res = await axiosApiSupabase.post(
    "functions/v1/payment-gateway",
    { action, token, ...payload },
    { headers: { "x-cloud-token": token }, timeout: 45000 }
  );
  const data = res.data;
  if (data?.error) throw new Error(String(data.error));
  return data?.data as T;
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

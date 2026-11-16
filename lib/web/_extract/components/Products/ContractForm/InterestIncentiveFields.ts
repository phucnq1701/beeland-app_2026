// ⚠️ TỰ SINH — trích nguyên văn từ web src/components/Products/ContractForm/InterestIncentiveFields.tsx (scripts/sync-web-pricing.cjs): createInterestIncentiveInfo, InterestIncentiveInfo. KHÔNG SỬA TAY.
import { Dayjs } from "dayjs";

export interface InterestIncentiveInfo {
  NgayHieuLuc: Dayjs | null;
  NgayHetHan: Dayjs | null;
  SoThang: number | null;
  /** UUID ngân hàng (sys_banks) */
  MaNganHang?: string | null;
  TenNganHang?: string;
  ChiNhanh: string;
  /** UUID chi nhánh (cloud_bank_branches) */
  MaChiNhanh?: string | null;
  /** UUID ưu đãi lãi suất (cloud_bank_branch_rates) */
  MaUuDai?: string | null;
  TyLe: number | null;
}

export const createInterestIncentiveInfo = (): InterestIncentiveInfo => ({
  NgayHieuLuc: null,
  NgayHetHan: null,
  SoThang: null,
  MaNganHang: null,
  TenNganHang: "",
  ChiNhanh: "",
  MaChiNhanh: null,
  MaUuDai: null,
  TyLe: null,
});

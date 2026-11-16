// ⚠️ TỰ SINH — kiểu trích nguyên văn (module không thuần) từ web src/services/projects/gift-warehouse/policyKho.ts (scripts/sync-web-pricing.cjs): PolicyKhoStock. KHÔNG SỬA TAY.
/** Tồn theo mức (option.ID) cho form chứng từ */
export interface PolicyKhoStock {
  option_id: string;
  line_id: string;
  kho_id: string;
  kho_ten: string;
  con_lai: number;
  suc_chua: number;
  nguong: number;
  tu_ngay: string;
  den_ngay: string | null;
  kho_active: boolean;
  pham_vi: { da_project_id: string; toa_id: string | null }[];
}

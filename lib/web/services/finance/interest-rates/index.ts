// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/finance/interest-rates/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { rpcRaw } from "../../_core/rpc";
import type { InterestRateInput, InterestRateRaw, ProjectInterestRate } from "./types";

export * from "./types";
export * from "./rule";
import { toDonVi } from "./rule";
export * from "./contractInterest";

/**
 * LÃI SUẤT DỰ ÁN (bảng da_project_interest_rates) — máy chủ lọc công ty từ JWT; chỉ gọi RPC, không đọc/ghi thẳng bảng.
 */

const toRate = (r: InterestRateRaw): ProjectInterestRate => ({
  id: r.id,
  projectId: r.project_id,
  tuNgay: String(r.tu_ngay).slice(0, 10),
  denNgay: String(r.den_ngay).slice(0, 10),
  tyLe: Number(r.ty_le) || 0,
  donVi: toDonVi(r.don_vi),
  soNgayKhongTinhLai: Number(r.so_ngay_khong_tinh_lai) || 0,
  apDung: r.ap_dung === true,
  updatedAt: r.updated_at ?? null,
});

export const listInterestRates = async (
  projectId?: string | null,
  activeOnly = false,
): Promise<ProjectInterestRate[]> => {
  const res = await rpcRaw<InterestRateRaw[] | null>(
    "fn_da_interest_rate_list",
    { p_project_id: projectId || null, p_active_only: activeOnly },
    { fallback: "Không tải được lãi suất" },
  );
  return (res || []).map(toRate);
};

export const saveInterestRate = async (r: InterestRateInput): Promise<ProjectInterestRate> => {
  const res = await rpcRaw<InterestRateRaw>(
    "fn_da_interest_rate_save",
    {
      p_payload: {
        id: r.id || null,
        project_id: r.projectId,
        tu_ngay: r.tuNgay,
        den_ngay: r.denNgay,
        ty_le: r.tyLe,
        don_vi: r.donVi,
        so_ngay_khong_tinh_lai: r.soNgayKhongTinhLai,
        ap_dung: r.apDung,
      },
    },
    { fallback: "Không lưu được lãi suất" },
  );
  return toRate(res);
};

export const deleteInterestRate = async (id: string): Promise<number> => {
  const res = await rpcRaw<{ deleted?: number } | null>(
    "fn_da_interest_rate_delete",
    { p_id: id },
    { fallback: "Không xoá được lãi suất" },
  );
  return Number(res?.deleted) || 0;
};

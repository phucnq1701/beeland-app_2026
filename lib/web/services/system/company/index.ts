// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/system/company/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { rpcRaw } from "../../_core/rpc";
import { isUuid, toCompanyAgencyMap, toCompanyAgencyRow, toCompanyPayload, toCompanyRow } from "./mapper";
import type { CompanyAgencyMap, CompanyAgencyMapRaw, CompanyAgencyRaw, CompanyAgencyRow, CompanyInput, CompanyRaw, CompanyRow, CompanyVersion, CompanyVersionInput } from "./types";

/**
 * Hệ thống > Công ty (/system/company) — công ty nội bộ (dm_companies.is_san khác true) của công ty đăng ký.
 * Đọc/ghi qua RPC `fn_dm_company_*`: tenant lấy từ JWT, quyền form + cấp trên hợp lệ kiểm ở máy chủ.
 */

export type { CompanyAgencyMap, CompanyAgencyRow, CompanyInput, CompanyRaw, CompanyRow } from "./types";

/** Mọi công ty nội bộ — RPC fn_dm_company_list (1 lần gọi; màn tự lọc từ khoá / trạng thái) */
export const listCompanies = async (): Promise<CompanyRow[]> => {
  const rows = await rpcRaw<CompanyRaw[] | null>("fn_dm_company_list", {}, {
    fallback: "Không tải được danh sách công ty",
  });
  return (Array.isArray(rows) ? rows : []).map(toCompanyRow);
};

/** Thêm / sửa công ty — RPC fn_dm_company_save, trả dòng đã lưu */
export const saveCompany = async (input: CompanyInput): Promise<CompanyRow> =>
  toCompanyRow(
    await rpcRaw<CompanyRaw | null>("fn_dm_company_save", { p: toCompanyPayload(input) }, {
      fallback: "Không lưu được công ty",
    })
  );

/**
 * Xoá công ty kèm toàn bộ công ty con cháu — RPC fn_dm_company_delete (1 giao dịch; máy chủ chặn khi còn
 * nhân viên / đã phát sinh dữ liệu). Trả số công ty đã xoá.
 */
export const deleteCompanies = async (ids: string[]): Promise<number> => {
  const valid = Array.from(new Set(ids.map((x) => String(x).trim()).filter(isUuid)));
  if (!valid.length) return 0;
  const res = await rpcRaw<{ deleted?: number } | null>("fn_dm_company_delete", { p_ids: valid }, {
    fallback: "Không xoá được công ty",
  });
  return Number(res?.deleted ?? 0);
};

/* ------------- Đại lý của Công ty bán hàng (dm_company_agencies — chỉ CTBH có đại lý, 2026-11-04) ------------- */

/** Đại lý thuộc 1 Công ty bán hàng — RPC fn_dm_company_agency_list (quyền Xem màn Công ty) */
export const listCompanyAgencies = async (companyId: string): Promise<CompanyAgencyRow[]> => {
  if (!isUuid(companyId)) return [];
  const rows = await rpcRaw<CompanyAgencyRaw[] | null>("fn_dm_company_agency_list", { p_company_id: companyId }, {
    fallback: "Không tải được đại lý của công ty",
  });
  return (Array.isArray(rows) ? rows : []).map(toCompanyAgencyRow);
};

const changeCompanyAgencies = async (
  fn: "fn_dm_company_agency_add" | "fn_dm_company_agency_remove",
  companyId: string,
  agencyIds: string[],
  fallback: string
): Promise<{ count: number; rows: CompanyAgencyRow[] }> => {
  const ids = Array.from(new Set(agencyIds.map((x) => String(x).trim()).filter(isUuid)));
  if (!isUuid(companyId) || !ids.length) return { count: 0, rows: [] };
  const res = await rpcRaw<{ added?: number; removed?: number; rows?: CompanyAgencyRaw[] } | null>(
    fn,
    { p_company_id: companyId, p_agency_ids: ids },
    { fallback }
  );
  return {
    count: Number(res?.added ?? res?.removed ?? 0),
    rows: (Array.isArray(res?.rows) ? res!.rows : []).map(toCompanyAgencyRow),
  };
};

/** Gắn đại lý vào Công ty bán hàng (đã gắn ⇒ bỏ qua) — trả số đã thêm + danh sách mới */
export const addCompanyAgencies = (companyId: string, agencyIds: string[]) =>
  changeCompanyAgencies("fn_dm_company_agency_add", companyId, agencyIds, "Không thêm được đại lý");

/** Gỡ đại lý khỏi Công ty bán hàng (máy chủ chặn khi đại lý còn trong giỏ của công ty) */
export const removeCompanyAgencies = (companyId: string, agencyIds: string[]) =>
  changeCompanyAgencies("fn_dm_company_agency_remove", companyId, agencyIds, "Không gỡ được đại lý");

/**
 * Chủ đầu tư / Công ty bán hàng + đại lý của từng CTBH — RPC fn_company_agency_map (không chặn form; tài khoản đại lý ⇒ rỗng).
 * Máy chủ chưa có RPC (BE cũ) ⇒ bản đồ rỗng, nơi gọi coi như chưa lọc theo đơn vị.
 */
export const getCompanyAgencyMap = async (): Promise<CompanyAgencyMap & { supported: boolean }> => {
  try {
    const raw = await rpcRaw<CompanyAgencyMapRaw | null>("fn_company_agency_map", {}, { fallback: "Không tải được đại lý của công ty" });
    return { ...toCompanyAgencyMap(raw), supported: true };
  } catch {
    return { ...toCompanyAgencyMap(null), supported: false };
  }
};

/* ------------- Thông tin công ty theo ngày hiệu lực (dm_company_versions, 2026-11-14) ------------- */

export type { CompanyVersion, CompanyVersionInput } from "./types";

const toVersions = (rows: unknown): CompanyVersion[] => (Array.isArray(rows) ? (rows as CompanyVersion[]) : []);

/** Lịch sử thông tin (mới → cũ) — RPC fn_dm_company_version_list (quyền Xem màn Công ty) */
export const listCompanyVersions = async (companyId: string): Promise<CompanyVersion[]> => {
  if (!isUuid(companyId)) return [];
  return toVersions(
    await rpcRaw<CompanyVersion[] | null>("fn_dm_company_version_list", { p_company_id: companyId }, {
      fallback: "Không tải được lịch sử thông tin công ty",
    })
  );
};

/** Sửa phiên bản (có id) / điều chỉnh mới có hiệu lực từ ngày (không id) — trả lại lịch sử */
export const saveCompanyVersion = async (input: CompanyVersionInput): Promise<CompanyVersion[]> =>
  toVersions(
    await rpcRaw<CompanyVersion[] | null>("fn_dm_company_version_save", { p: input }, {
      fallback: "Không lưu được thông tin công ty",
    })
  );

/** Xoá 1 điều chỉnh (không xoá được thông tin ban đầu) — trả lại lịch sử */
export const deleteCompanyVersion = async (id: string): Promise<CompanyVersion[]> =>
  toVersions(
    await rpcRaw<CompanyVersion[] | null>("fn_dm_company_version_delete", { p_id: id }, {
      fallback: "Không xoá được điều chỉnh",
    })
  );

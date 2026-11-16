// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/agencies/agency-list/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { rpcRaw } from "../../_core/rpc";
import { isUuid, toAgencyPayload, toAgencyRow } from "./mapper";
import type { AgencyInput, AgencyListFilter, AgencyRaw, AgencyRow } from "./types";

/**
 * Màn Danh sách đại lý (/agencies/list) — đại lý = dm_companies.is_san = true của công ty đăng ký.
 * Đọc/ghi qua RPC `fn_dm_agency_*`: tenant lấy từ JWT, quyền form kiểm ở máy chủ, tìm kiếm + lọc trạng thái ở máy chủ.
 */

export type { AgencyInput, AgencyListFilter, AgencyRaw, AgencyRow } from "./types";

/** Danh sách đại lý — RPC fn_dm_agency_list */
export const listAgencies = async (f: AgencyListFilter = {}): Promise<AgencyRow[]> => {
  const rows = await rpcRaw<AgencyRaw[] | null>(
    "fn_dm_agency_list",
    {
      p_keyword: f.keyword?.trim() || null,
      // UI State: true = Ngừng ⇒ ap_dung = false
      p_ap_dung: f.state === null || f.state === undefined ? null : !f.state,
    },
    { fallback: "Không tải được danh sách đại lý" }
  );
  return (Array.isArray(rows) ? rows : []).map(toAgencyRow);
};

/** Thêm / sửa đại lý — RPC fn_dm_agency_save, trả dòng đã lưu */
export const saveAgency = async (input: AgencyInput): Promise<AgencyRow> =>
  toAgencyRow(
    await rpcRaw<AgencyRaw | null>("fn_dm_agency_save", { p: toAgencyPayload(input) }, { fallback: "Không lưu được đại lý" })
  );

/** Xoá đại lý — RPC fn_dm_agency_delete (máy chủ chặn khi còn nhân viên / đã phát sinh dữ liệu) */
export const deleteAgency = async (id: string): Promise<void> => {
  if (!isUuid(id)) throw new Error("Thiếu thông tin đại lý cần xoá");
  await rpcRaw("fn_dm_agency_delete", { p_id: String(id).trim() }, { fallback: "Không xoá được đại lý" });
};

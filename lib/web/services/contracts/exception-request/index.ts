// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/contracts/exception-request/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Yêu cầu ngoại lệ (form 9137): cho chọn Phiếu tính giá / Chính sách bán hàng / Lịch thanh toán đã hết hạn trên một giao dịch.
 * Máy chủ vẫn chặn khi lưu (`_sales_config_expiry_guard`); service này chỉ để ô chọn hiện đúng mục được phép.
 */
import { rpcRaw } from "../../_core/rpc";
import {
  EXCEPTION_REQUEST_LOAI,
  type ActiveExceptionItem,
  type ExceptionObjectOption,
  type ExceptionRequestFilter,
  type ExceptionRequestLoai,
  type ExceptionRequestLog,
  type ExceptionRequestPage,
  type ExceptionRequestRow,
  type ExceptionRequestStats,
  type ExceptionTxnOption,
} from "./types";

export * from "./types";

const parseRows = (data: unknown): unknown[] => {
  const v = typeof data === "string" ? JSON.parse(data) : data;
  return Array.isArray(v) ? v : [];
};

const toActive = (rows: unknown[]): ActiveExceptionItem[] =>
  rows.flatMap((r) => {
    const loai = (r as { loai?: unknown })?.loai;
    const id = String((r as { doi_tuong_id?: unknown })?.doi_tuong_id ?? "").trim().toLowerCase();
    return EXCEPTION_REQUEST_LOAI.includes(loai as ActiveExceptionItem["loai"]) && id
      ? [{ loai: loai as ActiveExceptionItem["loai"], doi_tuong_id: id }]
      : [];
  });

const asObj = (data: unknown): Record<string, unknown> => {
  const v = typeof data === "string" ? JSON.parse(data) : data;
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
};

const num = (v: unknown) => Number(v) || 0;

export const exceptionRequestService = {
  async list(f: ExceptionRequestFilter): Promise<ExceptionRequestPage> {
    const o = asObj(
      await rpcRaw<unknown>(
        "fn_exception_request_list",
        {
          p: {
            project_id: f.projectId || null,
            loai: f.loai || null,
            trang_thai: f.trangThai || null,
            search: f.search?.trim() || null,
            page: f.page ?? 1,
            page_size: f.pageSize ?? 50,
          },
        },
        { fallback: "Không tải được danh sách yêu cầu ngoại lệ" }
      )
    );
    const s = asObj(o.stats);
    const stats: ExceptionRequestStats = { tong: num(s.tong), cho_duyet: num(s.cho_duyet), da_duyet: num(s.da_duyet), tu_choi: num(s.tu_choi), huy: num(s.huy) };
    return { rows: Array.isArray(o.rows) ? (o.rows as ExceptionRequestRow[]) : [], total: num(o.total), stats };
  },

  /** Bước 4 của hộp tạo: giao dịch của dự án (+ quỹ căn nếu chọn; null ⇒ mọi quỹ, kể cả giao dịch cũ chưa có quỹ), tìm theo mã căn / mã GD / khách hàng (tối đa 50) */
  async transactions(projectId: string, quyCanId: string | null, search: string): Promise<ExceptionTxnOption[]> {
    return parseRows(
      await rpcRaw<unknown>(
        "fn_exception_request_options",
        { p_step: "giao_dich", p_project_id: projectId, p_quy_can_id: quyCanId || null, p_search: search.trim() || null },
        { fallback: "Không tải được danh sách giao dịch" }
      )
    ) as ExceptionTxnOption[];
  },

  /** Bước 5: phiếu đang hết hạn mà giao dịch có thể xin ngoại lệ */
  async objects(pgcId: string, loai: ExceptionRequestLoai): Promise<ExceptionObjectOption[]> {
    return parseRows(
      await rpcRaw<unknown>(
        "fn_exception_request_options",
        { p_step: "doi_tuong", p_pgc_id: pgcId, p_loai: loai },
        { fallback: "Không tải được danh sách phiếu hết hạn" }
      )
    ) as ExceptionObjectOption[];
  },

  async create(i: { pgcId: string; loai: ExceptionRequestLoai; doiTuongId: string; lyDo: string }): Promise<{ id: string; so_phieu: string }> {
    return asObj(
      await rpcRaw<unknown>(
        "fn_exception_request_create",
        { p: { pgc_id: i.pgcId, loai: i.loai, doi_tuong_id: i.doiTuongId, ly_do: i.lyDo.trim() } },
        { fallback: "Không tạo được yêu cầu ngoại lệ" }
      )
    ) as { id: string; so_phieu: string };
  },

  async approve(id: string): Promise<void> {
    await rpcRaw("fn_exception_request_approve", { p_id: id }, { fallback: "Không duyệt được yêu cầu ngoại lệ" });
  },
  async reject(id: string, reason: string): Promise<void> {
    await rpcRaw("fn_exception_request_reject", { p_id: id, p_reason: reason.trim() }, { fallback: "Không từ chối được yêu cầu ngoại lệ" });
  },
  async cancel(id: string, reason: string): Promise<void> {
    await rpcRaw("fn_exception_request_cancel", { p_id: id, p_reason: reason.trim() || null }, { fallback: "Không hủy được yêu cầu ngoại lệ" });
  },
  async remove(id: string): Promise<void> {
    await rpcRaw("fn_exception_request_delete", { p_id: id }, { fallback: "Không xoá được yêu cầu ngoại lệ" });
  },
  async logs(id: string): Promise<ExceptionRequestLog[]> {
    return parseRows(
      await rpcRaw<unknown>("fn_exception_request_logs", { p_id: id }, { fallback: "Không tải được lịch sử yêu cầu" })
    ) as ExceptionRequestLog[];
  },

  /** Ngoại lệ đã duyệt của giao dịch `pgcId`; không có pgc / lỗi / API cũ chưa có RPC ⇒ [] (form coi như không có ngoại lệ) */
  async active(pgcId: string): Promise<ActiveExceptionItem[]> {
    if (!pgcId) return [];
    try {
      return toActive(parseRows(await rpcRaw<unknown>("fn_exception_request_active", { p_pgc_id: pgcId })));
    } catch {
      return [];
    }
  },
};

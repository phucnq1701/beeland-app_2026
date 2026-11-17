// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/pre-booking-actions/index.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Thao tác booking thiện chí qua RPC (A1): máy chủ kiểm quyền / phạm vi / trạng thái, client không gửi trạng thái kết quả.
 * Lỗi giữ nguyên thông điệp máy chủ, kèm `code` (55000 sai trạng thái · 22023 dữ liệu · 42501 quyền · P0002 không thấy).
 */
import { rpcRaw } from "../../_core/rpc";
import {
  cleanSeqs,
  fromAssign,
  fromAttachDeposit,
  fromSaveResult,
  fromSeqItems,
  fromStateChange,
  fromUnassign,
  toSavePayload,
  toUuid,
} from "./mapper";
import type {
  AssignResult,
  AttachDepositResult,
  PreBookingAction,
  PreBookingSaveInput,
  PreBookingSaveResult,
  SeqItem,
  StateChangeResult,
  UnassignResult,
} from "./types";

export * from "./types";

export class PreBookingActionError extends Error {
  code: string | null;
  constructor(message: string, code: string | null = null) {
    super(message);
    this.name = "PreBookingActionError";
    this.code = code;
  }
}

/** Phiếu đã đổi trạng thái ở nơi khác (55000) ⇒ tải lại danh sách */
export const isStaleError = (e: unknown): boolean => (e as any)?.code === "55000";

const call = async <T>(fn: string, args: Record<string, unknown>, fallback: string): Promise<T> => {
  try {
    return await rpcRaw<T>(fn, args, { fallback });
  } catch (e: any) {
    throw new PreBookingActionError(e?.message || fallback, e?.code ?? null);
  }
};

const needSeqs = (seqs: number[]): number[] => {
  const s = cleanSeqs(seqs);
  if (!s.length) throw new PreBookingActionError("Chưa chọn phiếu booking", "22023");
  return s;
};

export const PreBookingActions = {
  async save(p: PreBookingSaveInput): Promise<PreBookingSaveResult> {
    return fromSaveResult(await call("fn_pre_booking_save", { p: toSavePayload(p) }, "Không lưu được phiếu booking"));
  },

  async changeState(seqs: number[], action: PreBookingAction): Promise<StateChangeResult> {
    const p_seqs = needSeqs(seqs);
    return fromStateChange(
      await call("fn_pre_booking_change_state", { p_seqs, p_action: action }, "Không đổi được trạng thái booking")
    );
  },

  async remove(seqs: number[]): Promise<SeqItem[]> {
    return fromSeqItems(await call("fn_pre_booking_delete", { p_seqs: needSeqs(seqs) }, "Không xóa được phiếu booking"));
  },

  async restore(seqs: number[]): Promise<SeqItem[]> {
    return fromSeqItems(
      await call("fn_pre_booking_restore", { p_seqs: needSeqs(seqs) }, "Không khôi phục được phiếu booking")
    );
  },

  async assign(seq: number, sanPhamId: string): Promise<AssignResult> {
    const [s] = needSeqs([seq]);
    const sp = toUuid(sanPhamId);
    if (!sp) throw new PreBookingActionError("Chưa chọn căn", "22023");
    return fromAssign(
      await call("fn_pre_booking_assign", { p_seq: s, p_san_pham_id: sp }, "Không gán được căn cho booking")
    );
  },

  async unassign(seq: number): Promise<UnassignResult> {
    const [s] = needSeqs([seq]);
    return fromUnassign(await call("fn_pre_booking_unassign", { p_seq: s }, "Không bỏ gán được căn"));
  },

  /** `pgcId` = cloud_pgc_phieu_giucho.id; không hợp lệ / vắng ⇒ null (máy chủ tự tìm phiếu đặt cọc còn hiệu lực) */
  async attachDeposit(seq: number, pgcId?: string | null): Promise<AttachDepositResult> {
    const [s] = needSeqs([seq]);
    return fromAttachDeposit(
      await call("fn_pre_booking_attach_deposit", { p_seq: s, p_pgc_id: toUuid(pgcId) }, "Không gắn được phiếu đặt cọc")
    );
  },
};

export default PreBookingActions;

// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/pre-booking-actions/types.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Thao tác booking thiện chí qua RPC `fn_pre_booking_*` (A1). Tên khớp migration 20261101300100…300500. */

export type PreBookingAction = "APPROVE" | "PAYMENT" | "QUEUE_ASSIGN" | "UNAPPROVE" | "UNQUEUE" | "REJECT";

export interface PreBookingSaveInput {
  /** `seq` của phiếu khi sửa; vắng = tạo mới */
  id?: number;
  khachHangId: string;
  daProjectId: string;
  sanId?: string | null;
  khoangGiaId?: string | null;
  khoangDtId?: string | null;
  tienGiuCho: number;
  hanBooking?: string | null;
  formCode?: string | null;
  dienGiai?: string | null;
  taiLieus?: unknown[];
  dongSoHuu?: unknown[];
  tieuChi?: Record<string, unknown>;
}

export interface PreBookingSaveResult {
  id: string;
  seq: number;
  soPhieu: string;
  state: string;
  created: boolean;
}

export interface StateChangeItem {
  seq: number;
  soPhieu: string | null;
  stateFrom: string;
  stateTo: string;
}

export interface StateChangeResult {
  items: StateChangeItem[];
  warning: string | null;
}

export interface SeqItem {
  seq: number;
  soPhieu: string | null;
}

export interface AssignResult {
  seq: number;
  stateFrom: string;
  stateTo: string;
  sanPhamId: string;
}

export interface UnassignResult {
  seq: number;
  stateFrom: string;
  stateTo: string;
}

export interface AttachDepositResult {
  seq: number;
  stateTo: string;
  phieuGiuChoId: string;
  daThu: number;
}

// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/sales/pre-booking-actions/mapper.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type {
  AssignResult,
  AttachDepositResult,
  PreBookingSaveInput,
  PreBookingSaveResult,
  SeqItem,
  StateChangeResult,
  UnassignResult,
} from "./types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** uuid hợp lệ (chữ thường) hoặc null */
export const toUuid = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return UUID_RE.test(s) ? s.toLowerCase() : null;
};

/** Danh sách seq: chỉ số nguyên dương, bỏ trùng, giữ thứ tự */
export const cleanSeqs = (seqs: unknown): number[] => {
  const out: number[] = [];
  for (const v of Array.isArray(seqs) ? seqs : []) {
    const n = typeof v === "number" ? v : NaN;
    if (Number.isSafeInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
};

const ARRAY_KEYS = ["Tangs", "Huongs", "LoaiCans", "Views", "Vitris", "KhoangTangs"] as const;
const NULL_KEYS = ["MaKhu", "MaKhoangGia", "MaDienTich"] as const;

/** Đúng 9 khoá mặc định như `toRow` (write.ts) — máy chủ gộp bằng `||` nên client gửi bản sạch (KhoangTangs: khoá thứ 9, máy chủ giữ nguyên) */
export const buildTieuChi = (input?: Record<string, unknown> | null): Record<string, unknown> => {
  const merged: Record<string, unknown> = {
    MaKhu: null,
    MaKhoangGia: null,
    MaDienTich: null,
    Tangs: [],
    Huongs: [],
    LoaiCans: [],
    Views: [],
    Vitris: [],
    KhoangTangs: [],
    ...(input ?? {}),
  };
  for (const k of ARRAY_KEYS) if (merged[k] == null) merged[k] = [];
  for (const k of NULL_KEYS) if (merged[k] === undefined) merged[k] = null;
  return merged;
};

/** Không gửi state / san_pham_id / phieu_giu_cho_id (máy chủ không nhận) */
export const toSavePayload = (p: PreBookingSaveInput) => ({
  id: p.id ?? null,
  khach_hang_id: p.khachHangId,
  da_project_id: p.daProjectId,
  san_id: p.sanId ?? null,
  khoang_gia_id: p.khoangGiaId ?? null,
  khoang_dt_id: p.khoangDtId ?? null,
  tien_giu_cho: Number(p.tienGiuCho) || 0,
  han_booking: p.hanBooking || null,
  form_code: p.formCode ?? null,
  dien_giai: p.dienGiai ?? null,
  tai_lieus: p.taiLieus ?? [],
  dong_so_huu: p.dongSoHuu ?? [],
  tieu_chi: buildTieuChi(p.tieuChi),
});

export const fromSaveResult = (r: any): PreBookingSaveResult => ({
  id: String(r?.id ?? ""),
  seq: Number(r?.seq),
  soPhieu: String(r?.so_phieu ?? ""),
  state: String(r?.state ?? ""),
  created: !!r?.created,
});

export const fromStateChange = (r: any): StateChangeResult => ({
  items: ((r?.items as any[]) ?? []).map((i) => ({
    seq: Number(i.seq),
    soPhieu: i.so_phieu ?? null,
    stateFrom: String(i.state_from ?? ""),
    stateTo: String(i.state_to ?? ""),
  })),
  warning: r?.warning ? String(r.warning) : null,
});

export const fromSeqItems = (r: any): SeqItem[] =>
  ((r?.items as any[]) ?? []).map((i) => ({ seq: Number(i.seq), soPhieu: i.so_phieu ?? null }));

export const fromAssign = (r: any): AssignResult => ({
  seq: Number(r?.seq),
  stateFrom: String(r?.state_from ?? ""),
  stateTo: String(r?.state_to ?? ""),
  sanPhamId: String(r?.san_pham_id ?? ""),
});

export const fromUnassign = (r: any): UnassignResult => ({
  seq: Number(r?.seq),
  stateFrom: String(r?.state_from ?? ""),
  stateTo: String(r?.state_to ?? ""),
});

export const fromAttachDeposit = (r: any): AttachDepositResult => ({
  seq: Number(r?.seq),
  stateTo: String(r?.state_to ?? ""),
  phieuGiuChoId: String(r?.phieu_giu_cho_id ?? ""),
  daThu: Number(r?.da_thu) || 0,
});

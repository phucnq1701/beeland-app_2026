// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/SigningShiftConfigService.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Đặt lịch ký: loại thủ tục + ca làm việc theo cấu hình HIỆU LỰC của dự án và chỗ còn lại theo ngày.
 * Cấu hình (đọc/lưu theo dự án) ở `@/services/sales/signing-shift-config` — tệp này còn truy vấn bảng lịch hẹn
 * (cloud_signing_appointments) nên ở lại service phẳng; chuyển RPC thì dời nốt.
 */
import { supabase } from "../_shims/integrations/supabase/client";
import { sessionCompanyId } from "../_shims/lib/session";
import { SigningConfigService, type ProcedureType, type WorkShift } from "./sales/signing-shift-config";

export type { ProcedureType, WorkShift, SigningConfig } from "./sales/signing-shift-config";
export { DEFAULT_PROCEDURES, DEFAULT_SHIFTS, genCode, SigningConfigService } from "./sales/signing-shift-config";

/** Ca làm việc kèm số lượt còn lại trong 1 ngày */
export interface ShiftSlot {
  /** uuid ca làm việc */
  id: string;
  code: string;
  name: string;
  from: string;
  to: string;
  capacity: number;
  used: number;
  remaining: number;
}

const APPT_TBL = "cloud_signing_appointments";

/** uuid công ty đăng ký (ma_ctdk) của phiên hiện tại */
const maCTDK = () => sessionCompanyId();

export const SigningShiftConfigService = {
  /** Loại thủ tục theo cấu hình hiệu lực của dự án (null = bộ mặc định công ty); lỗi máy chủ ⇒ rỗng như trước */
  listProcedures: async (projectId?: string | null): Promise<ProcedureType[]> =>
    SigningConfigService.getConfig(projectId ?? null)
      .then((c) => c.procedures)
      .catch(() => []),

  /**
   * Danh sách ca làm việc kèm **số lượt còn lại** trong 1 ngày (YYYY-MM-DD).
   * Chỉ gọi máy chủ khi có **đủ**: công ty, ngày, phiếu giữ chỗ, loại thủ tục.
   * Máy chủ bỏ ca mà chính phiếu giữ chỗ này đã đặt trong ngày và chỉ trả ca
   * có khai báo loại thủ tục đang chọn.
   */
  slotsByDate: async (
    dateStr: string,
    procedureId?: string | null,
    pgcId?: string | null
  ): Promise<ShiftSlot[]> => {
    const ma_ctdk = maCTDK();
    if (!ma_ctdk || !dateStr || !pgcId || !procedureId) return [];
    const { data, error } = await supabase.rpc("fn_signing_shift_slots" as any, {
      p_ma_ctdk: ma_ctdk,
      p_ngay: dateStr,
      p_ma_pgc: pgcId,
      p_loai_thu_tuc_id: procedureId,
    } as any);
    if (error) return [];
    return ((data as any[]) || []).map((r) => ({
      id: String(r.shift_id),
      code: String(r.ky_hieu),
      name: r.name || String(r.ky_hieu),
      from: r.tu_gio || "",
      to: r.den_gio || "",
      capacity: Number(r.capacity) || 0,
      used: Number(r.used) || 0,
      remaining: Number(r.remaining) || 0,
    }));
  },

  /**
   * Tổng chỗ còn lại theo từng ngày trong khoảng [fromDate, fromDate + days).
   * Trả về map { "YYYY-MM-DD": số chỗ còn lại }.
   */
  availabilityByDate: async (
    fromDate: string,
    days = 14,
    procedureId?: string | null,
    pgcId?: string | null,
    projectId?: string | null
  ): Promise<Record<string, number>> => {
    const ma_ctdk = maCTDK();
    const out: Record<string, number> = {};
    if (!ma_ctdk || !fromDate || days <= 0) return out;

    const start = new Date(`${fromDate}T00:00:00+07:00`);
    const dayKey = (d: Date) => {
      const t = new Date(d.getTime() + 7 * 3600 * 1000);
      return t.toISOString().slice(0, 10);
    };
    const end = new Date(start.getTime() + days * 86400000);

    if (!procedureId) return out;
    // Ca theo cấu hình hiệu lực của dự án; ca không chọn thủ tục nào áp dụng mọi thủ tục
    const { shifts: all } = await SigningConfigService.getConfig(projectId ?? null).catch(() => ({ shifts: [] as WorkShift[] }));
    const shifts = all.filter(
      (s) => s.active && (!s.procedureIds?.length || s.procedureIds.includes(String(procedureId)))
    );
    const allow = new Set(shifts.map((s) => String(s.id)));
    const capacityPerDay = shifts.reduce((n, x) => n + (Number(x.capacity) || 0), 0);

    const { data } = await supabase
      .from(APPT_TBL as any)
      .select("seq, ca_lam_viec_id, ngay_book_ky, state, phieu_giu_cho_id")
      .eq("ma_ctdk_uid", ma_ctdk)
      .gte("ngay_book_ky", start.toISOString())
      .lt("ngay_book_ky", end.toISOString());

    const usedByDay: Record<string, number> = {};
    ((data as any[]) || []).forEach((r) => {
      if (String(r.state || "").toUpperCase() === "REJECTED") return;
      if (!r.ca_lam_viec_id || !allow.has(String(r.ca_lam_viec_id))) return;
      const k = dayKey(new Date(r.ngay_book_ky));
      usedByDay[k] = (usedByDay[k] || 0) + 1;
    });

    for (let i = 0; i < days; i++) {
      const k = dayKey(new Date(start.getTime() + i * 86400000));
      out[k] = Math.max(0, capacityPerDay - (usedByDay[k] || 0));
    }
    return out;
  },

  /**
   * Số chỗ còn lại của 1 ca (uuid) trong ngày — đọc lại dữ liệu mới nhất.
   * Trả về `null` nếu ca không giới hạn sức chứa.
   */
  remainingForShift: async (
    dateStr: string,
    shiftId: string,
    pgcId?: string | null,
    procedureId?: string | null
  ): Promise<number | null> => {
    if (!dateStr || !shiftId || !pgcId || !procedureId) return null;
    const slots = await SigningShiftConfigService.slotsByDate(
      dateStr,
      procedureId,
      pgcId
    );
    const s = slots.find((x) => x.id === String(shiftId));
    if (!s || !s.capacity) return null;
    return s.remaining;
  },

  /** Lắng nghe thay đổi lịch ký để cập nhật số chỗ còn lại theo thời gian thực. */
  subscribeAppointments: (onChange: () => void) => {
    // Bảng lịch ký chứa dữ liệu cá nhân nên không phát qua Realtime công khai:
    // dùng polling nhẹ để cập nhật số chỗ còn lại.
    const timer = setInterval(() => onChange(), 20_000);
    const onFocus = () => onChange();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  },
};

export default SigningShiftConfigService;

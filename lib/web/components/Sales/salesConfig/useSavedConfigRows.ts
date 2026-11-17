// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Sales/salesConfig/useSavedConfigRows.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Chứng từ đã lưu có thể gắn chính sách / tiến độ chưa được duyệt, nên không có
 * trong danh sách chọn. Hook đọc theo id và thêm đúng 1 dòng (cùng dạng `raw` của
 * fetchSalesConfigOptions), nhãn hiển thị `NhanHienThi` có hậu tố " (Chờ duyệt)" khi chưa duyệt; các trường tên giữ nguyên.
 */
import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import * as DaSalesPolicyService from "../../../services/DaSalesPolicyService";
import * as DaPaymentScheduleService from "../../../services/DaPaymentScheduleService";
import { PENDING_SUFFIX, mapPolicyRow, mapScheduleRow } from "./approvedConfig";

interface Params {
  policyId?: string | null;
  scheduleId?: string | null;
  /** Danh sách chọn đã nạp xong */
  loaded: boolean;
  policies: any[];
  setPolicies: Dispatch<SetStateAction<any[]>>;
  schedules: any[];
  setSchedules: Dispatch<SetStateAction<any[]>>;
  /** Danh sách là {value,label,raw} thay vì dòng raw */
  asOption?: boolean;
}

const idOf = (r: any) => String(r?.value ?? r?.ID ?? r?.MaTH ?? r?.id ?? "");

export const useSavedConfigRows = ({
  policyId,
  scheduleId,
  loaded,
  policies,
  setPolicies,
  schedules,
  setSchedules,
  asOption,
}: Params): void => {
  /** id đã đọc (hoặc đang đọc) trong lần nạp danh sách này */
  const askedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!loaded) askedRef.current.clear();
  }, [loaded]);

  const append = async (
    kind: "policy" | "schedule",
    id: string,
    list: any[],
    setList: Dispatch<SetStateAction<any[]>>,
  ) => {
    const key = `${kind}:${id}`;
    if (askedRef.current.has(key) || list.some((r) => idOf(r) === id)) return;
    askedRef.current.add(key);
    try {
      const res: any =
        kind === "policy"
          ? await DaSalesPolicyService.getPolicyById(id)
          : await DaPaymentScheduleService.getScheduleById(id);
      const d = res?.data;
      if (res?.status !== 2000 || !d) return;
      const pending = d.status !== "approved";
      const raw: any =
        kind === "policy"
          ? mapPolicyRow({
              ...d,
              id: d.ID,
              ten_cs: d.TenChinhSach,
              form_code: d.FormCode ?? d.LoaiHinh,
              pricing_config_id: d.MaCauHinhTinhGia,
              payment_schedule_id: d.MaTruonghopTT,
            })
          : mapScheduleRow({
              ...d,
              id: d.ID ?? d.MaTH,
              name: d.TenTH,
              so_dot: d.SoDot,
              tong_tt: d.TongTyLeTT,
            });
      const name = (kind === "policy" ? raw.TenChinhSach : raw.TenTH) || id;
      const label = pending ? `${name}${PENDING_SUFFIX}` : name;
      // Tên giữ sạch (được lưu / in); nhãn kèm hậu tố chỉ ở NhanHienThi và label của ô chọn
      raw.NhanHienThi = label;
      const row = asOption ? { value: id, label, raw } : raw;
      setList((prev) => (prev.some((r) => idOf(r) === id) ? prev : [...prev, row]));
    } catch (e) {
      askedRef.current.delete(key);
      console.error("useSavedConfigRows", e);
    }
  };

  useEffect(() => {
    if (!loaded) return;
    if (policyId) void append("policy", String(policyId), policies, setPolicies);
    if (scheduleId) void append("schedule", String(scheduleId), schedules, setSchedules);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, policyId, scheduleId, policies, schedules]);
};

export default useSavedConfigRows;

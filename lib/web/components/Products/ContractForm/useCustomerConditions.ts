// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/useCustomerConditions.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { fetchCustomerConditions } from "../../../services/sales/customer-conditions";

type State = { key: string; tinhIds?: string[]; soHdmb?: number; loading: boolean; failed: boolean };

/**
 * Thông tin khách trên chứng từ cho điều kiện mức (CSBH đợt 2 «Tỉnh» + «Mua nhiều»): `ids` = mã KH người đứng tên + người đồng đứng tên
 * (trống bỏ qua); `excludePgc` = phiếu giữ chỗ của chứng từ đang lập (không tự đếm vào số HĐMB). Tập khách (không phân biệt thứ tự / hoa
 * thường) hoặc phiếu loại trừ đổi ⇒ tải lại.
 * `changed` = tập khách khác tập đầu tiên có khách KỂ TỪ lần đổi `resetKey` gần nhất (bên gọi truyền mở/đóng + id chứng từ — form giữ mount khi
 * đóng) ⇒ người dùng đổi khách / đồng đứng tên trên chứng từ đã lưu ⇒ bên gọi bật đối soát mức. Tập rỗng (bỏ chọn khách) không tính.
 * `failed` = lỗi tải: không có số liệu; bên gọi coi như còn chờ (không tự tick / bỏ tick).
 */
export function useCustomerConditions(
  ids: (string | null | undefined)[],
  excludePgc: string | null | undefined,
  resetKey = "",
): { tinhIds?: string[]; soHdmb?: number; loading: boolean; changed: boolean; failed: boolean } {
  const list = [...new Set(ids.map((x) => String(x ?? "").trim().toLowerCase()).filter(Boolean))].sort();
  const khach = list.join(",");
  const ex = String(excludePgc ?? "").trim().toLowerCase();
  const key = khach ? `${khach}|${ex}` : "";
  const first = useRef<string | null>(null);
  const reset = useRef(resetKey);
  if (reset.current !== resetKey) {
    reset.current = resetKey;
    first.current = null;
  }
  if (khach && first.current === null) first.current = khach;
  const [state, setState] = useState<State>({ key: "", loading: false, failed: false });
  useEffect(() => {
    if (!key) {
      setState({ key: "", loading: false, failed: false });
      return;
    }
    let alive = true;
    setState({ key, loading: true, failed: false });
    fetchCustomerConditions(khach.split(","), excludePgc ?? null)
      .then((r) => alive && setState({ key, tinhIds: r.tinhIds, soHdmb: r.soHdmb, loading: false, failed: false }))
      .catch(() => alive && setState({ key, loading: false, failed: true }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const cur: State = state.key === key ? state : { key, loading: !!key, failed: false };
  return { tinhIds: cur.tinhIds, soHdmb: cur.soHdmb, loading: cur.loading, changed: !!khach && first.current !== null && khach !== first.current, failed: cur.failed };
}

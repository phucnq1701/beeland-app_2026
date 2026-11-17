// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/useOptionReconcile.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Đối chiếu mức chi tiết CK đã tick mỗi khi bối cảnh (loại căn, tòa, giá, lịch thanh toán, công ty, mức phải phân bổ CTBH R-2d) đổi, dùng chung cho
 * Phiếu tính giá và Hợp đồng. `enabled` = phiếu mới hoặc người dùng đã sửa (phiếu mở lại chưa sửa giữ nguyên số đã lưu),
 * và dữ liệu sản phẩm đã tải xong. Mỗi bối cảnh chỉ xử lý một lần nên đổi qua lại không lặp thông báo.
 */
import { useEffect, useRef } from "react";
import { toast } from "../../../_shims/sonner";
import { reconcilePicks } from "./discountOptions";
import type { OptionCtx } from "./optionConditions";

export function useOptionReconcile<T extends { name?: string }>(
  rounds: T[],
  setRounds: (next: T[]) => void,
  ctx: OptionCtx,
  enabled: boolean,
  markEdited: () => void,
  notify: (msg: string) => void = (msg) => toast.info(msg),
) {
  const usageKey = ctx.usage ? Object.keys(ctx.usage).sort().map((k) => `${k}:${ctx.usage![k]}`).join(",") : null;
  const byCoKey = ctx.usageByCompany
    ? Object.keys(ctx.usageByCompany).sort().map((m) => `${m}=${Object.keys(ctx.usageByCompany![m]).sort().map((c) => `${c}:${ctx.usageByCompany![m][c]}`).join("|")}`).join(",")
    : null;
  // R-2d: mức phải phân bổ (chính sách bật Áp dụng phân bổ CTBH ⇒ đối chiếu lại, bỏ tick mức chưa phân bổ)
  const reqKey = ctx.allocationRequiredIds?.length ? [...ctx.allocationRequiredIds].sort().join(",") : null;
  // CSBH đợt 2: tỉnh của khách (điều kiện Tỉnh) — đổi khách / đồng đứng tên ⇒ đối chiếu lại (review M2)
  const tinhKey = ctx.tinhIds ? [...ctx.tinhIds].sort().join(",") : null;
  // Mua nhiều: số HĐMB đổi (đổi khách / đồng đứng tên) ⇒ đối chiếu lại
  const key = JSON.stringify([ctx.loaiCan ?? null, ctx.toaId ?? null, ctx.giaGomVAT ?? null, ctx.lichTTId ?? null, !!ctx.pending, ctx.ngay ?? null, usageKey, ctx.congTyBanHangId ?? null, byCoKey, reqKey, tinhKey, ctx.soHdmb ?? null]);
  const done = useRef<string | null>(null);
  const roundsRef = useRef(rounds);
  roundsRef.current = rounds;

  useEffect(() => {
    // Lần đầu (hoặc khi đang tắt) chỉ ghi nhận bối cảnh: dựng dòng đã áp tự tick theo bối cảnh rồi
    if (!enabled || ctx.pending || done.current === null) {
      done.current = key;
      return;
    }
    if (done.current === key) return;
    done.current = key;
    const messages: string[] = [];
    let changed = false;
    const next = roundsRef.current.map((round) => {
      const out = reconcilePicks(round, ctx);
      if (out.round !== round) changed = true;
      if (out.dropped) messages.push(`Đã bỏ chọn «${out.dropped.Ten}» ở «${round.name ?? ""}» vì không còn phù hợp`);
      return out.round;
    });
    if (!changed) return;
    setRounds(next);
    // Có dòng đổi (bỏ hoặc tự tick) ⇒ phiếu đã sửa, để lần áp chính sách sau không ghi đè
    markEdited();
    messages.forEach((m) => notify(m));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
}

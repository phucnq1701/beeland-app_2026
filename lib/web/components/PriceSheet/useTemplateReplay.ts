// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/PriceSheet/useTemplateReplay.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Lập phiếu tính giá từ mẫu (spec 2026-11-11-phieu-tinh-gia-mau): phát lại lựa chọn của mẫu qua đúng các handler của form trên phiếu mới
 * của căn khác — Quỹ căn → Công ty bán hàng → Chính sách → Bảng giá → Lịch TT → mức CK → khuyến mãi — để giá tính như khi người dùng tự chọn.
 * Mỗi bước chạy đúng 1 lần, chờ danh mục của bước đó nạp xong và chờ handler của bước trước chạy xong. Thiếu id thì bỏ qua bước.
 * Bước chờ quá REPLAY_STEP_TIMEOUT_MS mà danh mục chưa sẵn sàng thì bỏ qua (báo 1 lần / lượt) để Lưu không bị khóa mãi.
 */
import { useEffect, useRef, useState } from "react";
import { applyPicked, reconcilePicks, type PickedOption } from "../Products/ContractForm/discountOptions";
import type { OptionCtx } from "../Products/ContractForm/optionConditions";
import type { PolicyDiscountOption } from "../../services/DaSalesPolicyService";
import type { FromTemplateSeed } from "./templateSheet";

export type TemplateReplayStep =
  | "idle"
  | "unitFund"
  | "company"
  | "policy"
  | "priceList"
  | "schedule"
  | "options"
  | "promotions"
  | "done";

export interface TemplateReplayReady {
  funds: boolean;
  /** Danh mục quỹ căn đã nạp xong mà rỗng (lỗi tải ⇒ []): bỏ bước quỹ căn, không đổi quỹ căn, báo người dùng chọn lại */
  fundsUnavailable?: boolean;
  salesCompanies: boolean;
  policies: boolean;
  priceLists: boolean;
  schedules: boolean;
  rounds: boolean;
}

/** Một dòng `payload.KhuyenMai` của mẫu (cùng dạng phiếu đã lưu) */
export type TemplatePromotion = { PromotionID?: unknown; TieuDe?: unknown; SoLuong?: unknown; SoTien?: unknown; [k: string]: unknown };

export interface TemplateReplayActions {
  changeUnitFund(id: string): void;
  setSalesCompany(id: string | null): void;
  selectPolicy(id: string): Promise<void> | void;
  selectPriceList(id: string | null): Promise<void> | void;
  selectSchedule(id: string): Promise<void> | void;
  /**
   * Tick các mức theo ID. `dropped`: tên mức bị bỏ vì không còn đạt điều kiện với căn này;
   * `missing`: ID không tìm thấy trên chính sách hiện tại (mức đã bị gỡ khỏi chính sách)
   */
  applyPickedOptions(ids: string[]): { dropped: string[]; missing: string[] };
  applyPromotions(kmArr: TemplatePromotion[]): void;
}

export interface TemplateReplayArgs {
  open: boolean;
  seed: FromTemplateSeed | null | undefined;
  ready: TemplateReplayReady;
  salesCompanyLocked: boolean;
  actions: TemplateReplayActions;
  notify(msg: string): void;
}

export const DROPPED_OPTIONS_MESSAGE = "Đã bỏ chọn các mức không còn phù hợp với căn này: ";
export const TEMPLATE_REPLAY_BUSY_MESSAGE = "Đang áp mẫu, vui lòng chờ";
export const FUNDS_UNAVAILABLE_MESSAGE = "Không tải được quỹ căn của mẫu, vui lòng chọn lại các mục cấu hình";
export const STUCK_REPLAY_MESSAGE = "Không áp được đầy đủ mẫu, vui lòng kiểm tra lại các mục cấu hình";
/** Một bước chờ danh mục lâu hơn mức này ⇒ bỏ qua bước */
export const REPLAY_STEP_TIMEOUT_MS = 15_000;

/** Lập phiếu từ mẫu mà chưa phát lại xong ⇒ khóa Lưu (lưu giữa chừng ra phiếu thiếu mức CK / khuyến mãi của mẫu) */
export function isTemplateReplayBusy(seed: FromTemplateSeed | null | undefined, step: TemplateReplayStep): boolean {
  return !!seed && step !== "done";
}

const ORDER: TemplateReplayStep[] = ["unitFund", "company", "policy", "priceList", "schedule", "options", "promotions", "done"];
const nextOf = (s: TemplateReplayStep): TemplateReplayStep => ORDER[ORDER.indexOf(s) + 1] ?? "done";

type Plan = { skip: boolean; ready: boolean; run: () => Promise<void> | void };

export function useTemplateReplay(args: TemplateReplayArgs): { step: TemplateReplayStep } {
  const { open, seed, ready, salesCompanyLocked } = args;
  /** Bước hiện tại gắn với lượt (mẫu) của nó: đổi mẫu giữa chừng thì bước của mẫu cũ không chạy với mẫu mới */
  const [state, setState] = useState<{ key: string | null; step: TemplateReplayStep }>({ key: null, step: "idle" });
  // Handler của form đổi mỗi lần render: luôn gọi bản mới nhất (đọc state mới nhất)
  const actionsRef = useRef(args.actions);
  actionsRef.current = args.actions;
  const notifyRef = useRef(args.notify);
  notifyRef.current = args.notify;
  const seedRef = useRef(seed);
  seedRef.current = seed;
  /** Lượt phát lại: đóng form / đổi mẫu ⇒ tăng, phần chạy dở của lượt cũ không đi tiếp */
  const runRef = useRef(0);
  const busyRef = useRef(false);
  /** Bước hiện tại đang chờ danh mục (chưa ready, chưa chạy) — hẹn giờ bỏ qua chỉ áp khi còn chờ */
  const waitingRef = useRef(false);
  /** Đã báo "không áp được đầy đủ mẫu" trong lượt này */
  const stuckNotifiedRef = useRef(false);
  const templateKey = open && seed ? seed.templateId || "_" : null;

  useEffect(() => {
    runRef.current += 1;
    busyRef.current = false;
    waitingRef.current = false;
    stuckNotifiedRef.current = false;
    const target: TemplateReplayStep = templateKey ? "unitFund" : "idle";
    // Không có mẫu (form thường) ⇒ giữ nguyên state, không thêm lần render nào
    setState((prev) => (prev.key === templateKey && prev.step === target ? prev : { key: templateKey, step: target }));
  }, [templateKey]);

  const step = state.key === templateKey ? state.step : "idle";
  useEffect(() => {
    const s = seedRef.current;
    if (!templateKey || !s || state.key !== templateKey || step === "idle" || step === "done" || busyRef.current) {
      waitingRef.current = false;
      return;
    }
    const key = templateKey;
    const advance = () => setState((prev) => (prev.key === key && prev.step === step ? { key, step: nextOf(step) } : prev));
    const a = actionsRef.current;
    const plans: Record<Exclude<TemplateReplayStep, "idle" | "done">, Plan> = {
      unitFund: {
        skip: !s.quyCanId,
        ready: ready.funds || !!ready.fundsUnavailable,
        run: () => {
          // Có quỹ căn thì đổi như thường; danh mục quỹ căn rỗng (tải lỗi) ⇒ không đổi, báo chọn lại, các bước sau vẫn chạy
          if (ready.funds) a.changeUnitFund(String(s.quyCanId));
          else notifyRef.current(FUNDS_UNAVAILABLE_MESSAGE);
        },
      },
      company: {
        skip: !s.congTyBanHangId,
        ready: ready.salesCompanies,
        run: () => {
          if (!salesCompanyLocked) a.setSalesCompany(s.congTyBanHangId);
        },
      },
      policy: { skip: !s.policyId, ready: ready.policies, run: () => a.selectPolicy(String(s.policyId)) },
      priceList: { skip: !s.priceListId, ready: ready.priceLists, run: () => a.selectPriceList(s.priceListId) },
      schedule: { skip: !s.scheduleId, ready: ready.schedules, run: () => a.selectSchedule(String(s.scheduleId)) },
      options: {
        skip: !s.pickedOptionIds?.length,
        ready: ready.rounds,
        run: () => {
          const res = a.applyPickedOptions([...s.pickedOptionIds]);
          // Mức không còn trong chính sách: báo bằng tên lúc lưu mẫu, chung một thông báo với mức không đạt điều kiện
          const names = [...(res?.dropped ?? [])];
          for (const id of res?.missing ?? []) {
            const ten = (s.pickedOptions ?? []).find((o) => sameId(o.ID, id))?.Ten || id;
            if (!names.includes(ten)) names.push(ten);
          }
          if (names.length) notifyRef.current(DROPPED_OPTIONS_MESSAGE + names.join(", "));
        },
      },
      promotions: { skip: !s.promotions?.length, ready: true, run: () => a.applyPromotions(s.promotions) },
    };
    const plan = plans[step];
    if (plan.skip) {
      waitingRef.current = false;
      advance();
      return;
    }
    waitingRef.current = !plan.ready;
    if (!plan.ready) return;
    busyRef.current = true;
    const run = runRef.current;
    let result: Promise<void> | void;
    try {
      result = plan.run();
    } catch (e) {
      console.error("Áp mẫu phiếu tính giá:", e);
    }
    Promise.resolve(result)
      .catch((e) => console.error("Áp mẫu phiếu tính giá:", e))
      .finally(() => {
        if (run !== runRef.current) return;
        busyRef.current = false;
        advance();
      });
  }, [templateKey, state.key, step, ready.funds, ready.fundsUnavailable, ready.salesCompanies, ready.policies, ready.priceLists, ready.schedules, ready.rounds, salesCompanyLocked]);

  // Lưới an toàn: bước chờ danh mục quá REPLAY_STEP_TIMEOUT_MS ⇒ bỏ qua, đi tiếp, báo 1 lần / lượt.
  // Hẹn giờ theo bước (đổi bước / đóng form / đổi mẫu ⇒ hủy); bước đã ready và đang chạy handler chậm thì không bỏ qua.
  useEffect(() => {
    if (!templateKey || state.key !== templateKey || step === "idle" || step === "done") return;
    const key = templateKey;
    const run = runRef.current;
    const timer = setTimeout(() => {
      if (run !== runRef.current || busyRef.current || !waitingRef.current) return;
      waitingRef.current = false;
      if (!stuckNotifiedRef.current) {
        stuckNotifiedRef.current = true;
        notifyRef.current(STUCK_REPLAY_MESSAGE);
      }
      setState((prev) => (prev.key === key && prev.step === step ? { key, step: nextOf(step) } : prev));
    }, REPLAY_STEP_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [templateKey, state.key, step]);

  return { step };
}

const sameId = (a: unknown, b: unknown) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

/**
 * Tick mức của mẫu trên các dòng chiết khấu của phiếu mới: mỗi dòng (đang bật) tick 1 mức đầu tiên có ID thuộc `ids` như ô Chi tiết CK
 * (chỉ chọn 1 mức), rồi đối chiếu điều kiện với căn này (`reconcilePicks`). `ctx` undefined (thấp tầng) ⇒ không kiểm điều kiện như ô Chi tiết CK.
 * Dòng không có mức nào trong `ids` giữ nguyên. `missing`: ID của mẫu không tick được ở dòng nào (đã bị gỡ khỏi chính sách hiện tại).
 */
export function tickTemplateOptions<T>(
  rounds: T[],
  ids: string[],
  ctx: OptionCtx | undefined
): { rounds: T[]; dropped: string[]; missing: string[] } {
  const dropped: string[] = [];
  const hits: string[] = [];
  const next = (rounds || []).map((round) => {
    const r = round as { enabled?: boolean; luaChon?: PolicyDiscountOption[] } | null;
    if (r?.enabled === false) return round;
    const hit = (r?.luaChon ?? []).find((o) => ids.some((id) => sameId(id, o?.ID)));
    if (!hit) return round;
    hits.push(String(hit.ID ?? ""));
    const picked: PickedOption = {
      ID: String(hit.ID ?? ""),
      Ten: hit.Ten,
      GiaTri: hit.GiaTri,
      ...(hit.DonViTinh ? { DonViTinh: hit.DonViTinh } : {}),
    };
    let out = applyPicked(round, [picked]) as unknown as T;
    if (ctx) {
      const rec = reconcilePicks(out, ctx);
      if (rec.dropped) {
        dropped.push(rec.dropped.Ten);
        out = rec.round;
      }
    }
    return out;
  });
  // ID không được tick ở dòng nào (không còn trong chính sách / dòng đã tắt), giữ thứ tự, không trùng
  const missing: string[] = [];
  for (const id of ids) {
    if (hits.some((h) => sameId(h, id)) || missing.some((m) => sameId(m, id))) continue;
    missing.push(id);
  }
  return { rounds: next, dropped, missing };
}

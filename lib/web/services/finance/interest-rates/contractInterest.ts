// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/finance/interest-rates/contractInterest.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { calcInterest, chargeableDays, toDonVi, vnDateKey } from "./rule";
import type { DonViLai } from "./types";

/**
 * Lãi theo đợt của 1 hợp đồng — hàm thuần (không đọc DB), dùng chung cho drawer Tính lãi và các màn khác.
 * Quy tắc: lãi suất/ngưỡng theo ngày đến hạn của đợt; trễ ≤ N → 0, > N → đủ số ngày; tiền = round(gốc × tỷ lệ/100 × ngày / mẫu số (1 | 365)).
 */

/** Số ngày nguyên giữa 2 khoá ngày YYYY-MM-DD (lịch VN) */
const wholeDays = (fromKey: string, toKey: string): number =>
  Math.round((Date.parse(`${toKey}T00:00:00Z`) - Date.parse(`${fromKey}T00:00:00Z`)) / 86400000);

export interface InstallmentInterest {
  /** Số ngày tính lãi (đã áp ngưỡng); 0 khi chưa cài lãi suất */
  days: number;
  interest: number;
  tyLe: number | null;
  /** Đơn vị lãi suất (ngày/năm); null khi chưa có lãi suất */
  donVi: DonViLai | null;
  /** Đợt chưa có lãi suất dự án phủ ngày đến hạn */
  noRate: boolean;
}

/** Ngày đến hạn của đợt (như máy chủ): NgayGiaHan || NgayTT */
export const dueOf = (c: { NgayGiaHan?: unknown; NgayTT?: unknown } | null | undefined): string | null =>
  (c?.NgayGiaHan as string) || (c?.NgayTT as string) || null;

/** Lãi 1 đợt theo lãi suất dự án của chính đợt đó: ngày VN, chênh nguyên ngày, `chargeableDays`, `calcInterest`. */
export const installmentInterest = (
  amount: number,
  tyLe: number | null | undefined,
  grace: number | null | undefined,
  due: string | Date | null | undefined,
  to: string | Date | null | undefined,
  donVi?: DonViLai | null,
): InstallmentInterest => {
  const rate = tyLe == null || !Number.isFinite(Number(tyLe)) ? null : Number(tyLe);
  if (rate == null) return { days: 0, interest: 0, tyLe: null, donVi: null, noRate: true };
  const d = vnDateKey(due);
  const t = vnDateKey(to);
  const raw = d && t ? wholeDays(d, t) : 0;
  const days = chargeableDays(raw, Number(grace) || 0);
  const dv = toDonVi(donVi);
  return { days, interest: calcInterest(amount, rate, days, dv), tyLe: rate, donVi: dv, noRate: false };
};

export interface ContractInstallment {
  dotTT: number;
  dotText: string;
  due: string | null;
  soTien: number;
  phiBT: number;
  tyLe: number | null;
  /** Đơn vị lãi suất của đợt; null/thiếu ⇒ ngày (khi có tyLe) */
  donVi?: DonViLai | null;
  grace: number | null;
}
/** Phiếu thu chỉ phần gốc + PBT (đã bỏ phần lãi) */
export interface ContractReceipt {
  /** id phiếu (cloud_cash_vouchers.id) — phân định 2 phiếu cùng thời điểm */
  id?: string;
  soPT?: string;
  ngay: string;
  soTien: number;
}
export interface PaidInterestRow {
  key: string;
  soPT?: string;
  /** id phiếu thu nguồn (cloud_cash_vouchers.id) */
  receiptId?: string;
  dotTT: number | null;
  dot: string;
  ngayTT: string | null;
  ngay: string;
  base: number;
  days: number;
  interest: number;
  tyLe: number | null;
  donVi: DonViLai | null;
  noRate: boolean;
  extra?: boolean;
}
export interface UnpaidInterestRow {
  key: string;
  dotTT: number;
  dot: string;
  ngayTT: string | null;
  ngay: string;
  base: number;
  days: number;
  interest: number;
  tyLe: number | null;
  donVi: DonViLai | null;
  noRate: boolean;
}
export interface DotInterest {
  paidInterest: number;
  unpaidInterest: number;
  total: number;
  noRate: boolean;
}

/** Thời điểm thu (ms); thiếu / sai ngày → cuối */
const instantMs = (v: string | null | undefined): number => {
  if (!v || !vnDateKey(v)) return Number.POSITIVE_INFINITY;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
};

/**
 * Thứ tự phân bổ phiếu thu vào các đợt — dùng chung mọi màn tính lãi, khớp máy chủ (`ORDER BY ngay_phieu, id`):
 * thời điểm thu tăng dần → id → số phiếu. Phiếu thiếu ngày xếp cuối.
 */
export const compareReceipts = (
  a: { ngay?: string | null; id?: string | null; soPT?: string | null },
  b: { ngay?: string | null; id?: string | null; soPT?: string | null },
): number => {
  const ta = instantMs(a.ngay);
  const tb = instantMs(b.ngay);
  if (ta !== tb) return ta < tb ? -1 : 1;
  const ia = String(a.id ?? "").toLowerCase();
  const ib = String(b.id ?? "").toLowerCase();
  if (ia !== ib) return ia < ib ? -1 : 1;
  return String(a.soPT ?? "").localeCompare(String(b.soPT ?? ""), undefined, { numeric: true });
};

export const computeContractInterest = (i: {
  installments: ContractInstallment[];
  receipts: ContractReceipt[];
  asOf: string | Date;
}): { byDot: Map<number, DotInterest>; paidRows: PaidInterestRow[]; unpaidRows: UnpaidInterestRow[] } => {
  const asOfKey = vnDateKey(i.asOf) as string;
  const schedule = (i.installments || [])
    .map((c) => ({ ...c, due: vnDateKey(c.due), grace: c.grace ?? 0, remain: (c.soTien || 0) + (c.phiBT || 0) }))
    .sort((a, b) => {
      if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
      return (Number(a.dotTT) || 0) - (Number(b.dotTT) || 0);
    });

  const byDot = new Map<number, DotInterest>();
  schedule.forEach((s) => {
    byDot.set(s.dotTT, { paidInterest: 0, unpaidInterest: 0, total: 0, noRate: s.tyLe == null });
  });

  const sorted = [...(i.receipts || [])].sort(compareReceipts);

  // Đã thu: chỉ phiếu có ngày hợp lệ
  const paidRows: PaidInterestRow[] = [];
  const work = schedule.map((s) => ({ ...s }));
  sorted
    .filter((p) => !!vnDateKey(p.ngay))
    .forEach((p, pi) => {
      let amount = p.soTien || 0;
      const ngayThu = vnDateKey(p.ngay) as string;
      for (const s of work) {
        if (amount <= 0) break;
        if (s.remain <= 0) continue;
        const alloc = Math.min(amount, s.remain);
        s.remain -= alloc;
        amount -= alloc;
        const calc = installmentInterest(alloc, s.tyLe, s.grace, s.due, ngayThu, s.donVi);
        paidRows.push({
          key: `${pi}-${s.dotTT}`,
          soPT: p.soPT,
          receiptId: p.id,
          dotTT: s.dotTT,
          dot: s.dotText,
          ngayTT: s.due,
          ngay: ngayThu,
          base: alloc,
          days: calc.days,
          interest: calc.interest,
          tyLe: calc.tyLe,
          donVi: calc.donVi,
          noRate: calc.noRate,
        });
        byDot.get(s.dotTT)!.paidInterest += calc.interest;
      }
      if (amount > 0) {
        paidRows.push({
          key: `${pi}-extra`,
          soPT: p.soPT,
          receiptId: p.id,
          dotTT: null,
          dot: "Thu vượt / chưa phân bổ",
          ngayTT: null,
          ngay: ngayThu,
          base: amount,
          days: 0,
          interest: 0,
          tyLe: null,
          donVi: null,
          noRate: false,
          extra: true,
        });
      }
    });

  // Chưa thu: trừ toàn bộ phiếu (kể cả phiếu thiếu ngày) để ra dư nợ đúng
  const rem = schedule.map((s) => ({ ...s }));
  sorted.forEach((p) => {
    let amount = p.soTien || 0;
    for (const s of rem) {
      if (amount <= 0) break;
      if (s.remain <= 0) continue;
      const alloc = Math.min(amount, s.remain);
      s.remain -= alloc;
      amount -= alloc;
    }
  });
  const unpaidRows: UnpaidInterestRow[] = [];
  rem.forEach((s) => {
    if (s.remain <= 0) return;
    if (s.due && s.due > asOfKey) return;
    const calc = installmentInterest(s.remain, s.tyLe, s.grace, s.due, asOfKey, s.donVi);
    unpaidRows.push({
      key: `unpaid-${s.dotTT}`,
      dotTT: s.dotTT,
      dot: s.dotText,
      ngayTT: s.due,
      ngay: asOfKey,
      base: s.remain,
      days: calc.days,
      interest: calc.interest,
      tyLe: calc.tyLe,
      donVi: calc.donVi,
      noRate: calc.noRate,
    });
    byDot.get(s.dotTT)!.unpaidInterest += calc.interest;
  });

  byDot.forEach((d) => {
    d.total = d.paidInterest + d.unpaidInterest;
  });
  return { byDot, paidRows, unpaidRows };
};

/**
 * Phân bổ phiếu thu lãi vào các đợt: phiếu ghi đợt cộng thẳng vào đợt đó; phiếu không ghi đợt (null)
 * trừ dần vào phần lãi còn thiếu theo thứ tự `dotTT`; dư → cộng vào đợt cuối.
 */
export const allocateInterestReceipts = (
  totals: { dotTT: number; lai: number }[],
  receipts: { dotTT: number | null; soTien: number }[],
): Map<number, number> => {
  const ordered = [...totals].sort((a, b) => a.dotTT - b.dotTT);
  const out = new Map<number, number>();
  ordered.forEach((t) => out.set(t.dotTT, 0));
  if (!ordered.length) return out;
  let free = 0;
  for (const r of receipts) {
    if (r.dotTT != null && out.has(r.dotTT)) out.set(r.dotTT, out.get(r.dotTT)! + r.soTien);
    else free += r.soTien;
  }
  for (const t of ordered) {
    if (free <= 0) break;
    const take = Math.min(free, Math.max(t.lai - out.get(t.dotTT)!, 0));
    out.set(t.dotTT, out.get(t.dotTT)! + take);
    free -= take;
  }
  if (free > 0) {
    const last = ordered[ordered.length - 1].dotTT;
    out.set(last, out.get(last)! + free);
  }
  return out;
};

// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/mocTinh.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
/**
 * Mốc tính: ghép dòng chiết khấu của chính sách với vòng công thức của cấu hình tính giá
 * (cao tầng). Mốc cấu hình = vòng TIENCODINH cuối cùng; mốc chính sách = dòng tick Mốc tính,
 * không có thì dòng VNĐ cuối cùng trước dòng % đầu tiên. Dòng tới mốc dùng vòng cùng vị trí,
 * dòng sau mốc dùng các vòng sau mốc cấu hình; biến theo lần từ mốc cấu hình trở đi được dời
 * theo độ lệch hai mốc. Hai mốc trùng nhau thì giống hệt ghép theo vị trí.
 */
import type { PolicyDiscountRound, RoundFormulas } from "./formulas";

/**
 * Thông tin của dòng cần để ghép công thức. `khongTruGiaHD` (dòng đang bật): dòng bỏ qua, không nhận công thức,
 * không chiếm số lần; công thức gán lần lượt cho các dòng còn lại (cao tầng).
 */
export type MocRow = { loai?: string; mocTinh?: boolean; khongTruGiaHD?: boolean; enabled?: boolean } | undefined;

/**
 * Dòng bỏ qua công thức: "Không trừ vào giá HĐ", kể cả khi đang tắt, để bật / tắt dòng không làm lệch công thức các
 * dòng sau (công thức chỉ gán lại khi tải cấu hình). Dòng thường đang tắt giữ cách cũ: chiếm vị trí, giữ số dòng trước.
 */
export const isSkipRound = (r: MocRow): boolean => !!r?.khongTruGiaHD;

/** Kết quả của dòng bỏ qua: mọi cột 0; vòng tính không cập nhật số "lần trước" từ dòng này */
export const skippedRoundResult = () => ({
  tongCK: 0,
  tongChuaVAT: 0,
  vat: 0,
  tongGomVAT: 0,
  phiBaoTri: 0,
  tongGiaTriHD: 0,
  giaNaked: null as number | null,
  tienCK: 0,
  vars: {} as Record<string, number>,
  skipped: true as const,
});

/** Kết quả các dòng được tính (bỏ dòng bỏ qua): nguồn của biến theo lần và mốc */
export const countedResults = <T>(rows: T[]): T[] => rows.filter((r) => !(r as any)?.skipped);

/** Kết quả dòng được tính cuối cùng (Sản phẩm sau CSBH); không có thì null */
export const lastCountedResult = <T>(rows: T[]): T | null => {
  const list = countedResults(rows);
  return list.length ? list[list.length - 1] : null;
};

/** Dòng cần để tính `LuyKeCKTyLe`; `enabled` vắng mặt coi là bật */
export type LuyKeRow =
  | { enabled?: boolean; khongTruGiaHD?: boolean; mocTinhTyLe?: boolean; discountPercent?: number }
  | undefined;

/**
 * `LuyKeCKTyLe` của từng dòng (cùng vị trí với `rows`): dòng tick Mốc tính tỷ lệ nhận tổng Tỷ lệ CK của các dòng
 * tick phía trên rồi cộng tỷ lệ của mình vào; dòng không tick bằng 0; dòng tắt hoặc bỏ qua bằng 0 và không cộng.
 * Tổng làm tròn 6 chữ số thập phân để 0.1 + 0.2 ra đúng 0.3.
 */
export function luyKeTyLeSeries(rows: LuyKeRow[]): number[] {
  let sum = 0;
  return (rows || []).map((r) => {
    if (!isLuyKeRow(r)) return 0;
    const val = sum;
    sum = Math.round((sum + (Number(r!.discountPercent) || 0)) * 1e6) / 1e6;
    return val;
  });
}

/** Dòng tham gia lũy kế: tick Mốc tính tỷ lệ, đang bật, không bị bỏ qua */
const isLuyKeRow = (r: LuyKeRow): boolean => !isSkipRound(r) && r?.enabled !== false && !!r?.mocTinhTyLe;

/**
 * `LuyKeTienCKTyLe` của dòng `idx`: tổng Tổng CK (`tongCKs`, kết quả của các dòng đã tính) của các dòng tham gia lũy kế
 * phía trên; dòng `idx` không tham gia thì 0. Tổng CK là kết quả công thức nên phải tính dần theo từng dòng.
 */
export function luyKeTienTyLeAt(rows: LuyKeRow[], tongCKs: number[], idx: number): number {
  if (!isLuyKeRow(rows?.[idx])) return 0;
  let sum = 0;
  for (let j = 0; j < idx; j++) if (isLuyKeRow(rows[j])) sum += Number(tongCKs[j]) || 0;
  return sum;
}

/** Vị trí (1-based) vòng TIENCODINH cuối cùng; 0 nếu không có, hoặc không có vòng PHANTRAM nào sau nó */
export function configMoc(template: { loaiCK?: string }[]): number {
  let last = -1;
  (template || []).forEach((r, i) => {
    if (r?.loaiCK === "TIENCODINH") last = i;
  });
  if (last < 0) return 0;
  return (template || []).slice(last + 1).some((r) => r?.loaiCK === "PHANTRAM") ? last + 1 : 0;
}

/** Vị trí (1-based) mốc của chính sách; 0 = không xác định (ghép theo vị trí) */
export function policyMoc(rows: MocRow[]): number {
  const list = rows || [];
  const ticked = list.findIndex((r) => !!r?.mocTinh);
  if (ticked >= 0) return ticked + 1;
  const firstPct = list.findIndex((r) => r?.loai === "percentage");
  for (let k = firstPct - 1; k >= 0; k--) {
    if (list[k]?.loai === "fixed_amount") return k + 1;
  }
  return 0;
}

/** Chỉ số (0-based) vòng công thức cho dòng `row` (1-based); một mốc bằng 0 thì theo vị trí */
export function templateIndexFor(row: number, pMoc: number, cMoc: number, len: number): number {
  if (len <= 0) return -1;
  if (!pMoc || !cMoc) return Math.min(row, len) - 1;
  if (row <= pMoc) return Math.min(row, cMoc) - 1;
  return Math.min(cMoc + (row - pMoc), len) - 1;
}

/** Dời `TongChuaVATLan{n}` / `TienCKLan{n}` có n ≥ cMoc thêm `delta` lần */
export function shiftRoundRefs(formula: string, cMoc: number, delta: number): string {
  if (!formula || !delta || !cMoc) return formula;
  return formula.replace(/\b(TongChuaVATLan|TienCKLan)([1-9]\d*)\b/g, (all, code: string, num: string) => {
    const n = Number(num);
    if (n < cMoc) return all;
    const next = n + delta;
    return next >= 1 ? `${code}${next}` : "0";
  });
}

const shiftFormulas = (formulas: RoundFormulas, cMoc: number, delta: number): RoundFormulas => {
  const out: any = { ...formulas };
  Object.keys(out).forEach((k) => {
    if (typeof out[k] === "string") out[k] = shiftRoundRefs(out[k], cMoc, delta);
  });
  return out;
};

/**
 * Hàm chọn vòng công thức cho từng dòng (0-based) theo mốc. Dòng không dùng đúng vòng cùng vị trí
 * nhận khóa `_extra_` riêng để không trùng khóa với dòng khác.
 */
export function mocTemplatePicker(rows: MocRow[], template: PolicyDiscountRound[]) {
  // Cao tầng (vòng cấu hình có loại): dòng bỏ qua không chiếm vị trí; thấp tầng ghép theo vị trí như cũ
  const highRise = template.some((r) => r?.loaiCK != null);
  const skip = (i: number) => highRise && isSkipRound(rows[i]);
  const effIndex: number[] = [];
  let n = 0;
  for (let i = 0; i < rows.length; i++) effIndex.push(skip(i) ? -1 : n++);
  const counted = rows.filter((_, i) => !skip(i));
  const cMoc = configMoc(template);
  const pMoc = policyMoc(counted);
  const on = cMoc > 0 && pMoc > 0;
  const delta = on ? pMoc - cMoc : 0;
  return (idx: number): PolicyDiscountRound => {
    if (skip(idx)) {
      const tpl = template[Math.min(idx, template.length - 1)];
      return { ...tpl, key: `${tpl.key}_skip_${idx}`, formulas: {} as RoundFormulas };
    }
    const at = effIndex[idx] ?? idx;
    const ti = on ? templateIndexFor(at + 1, pMoc, cMoc, template.length) : Math.min(at, template.length - 1);
    const tpl = template[ti];
    const base = ti === idx ? tpl : { ...tpl, key: `${tpl.key}_extra_${idx}` };
    return delta ? { ...base, formulas: shiftFormulas(base.formulas, cMoc, delta) } : base;
  };
}

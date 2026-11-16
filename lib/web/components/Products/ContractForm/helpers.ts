// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/helpers.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Pure helpers for ContractForm. Không phụ thuộc React state — nhận
 * mọi context cần thiết qua tham số để có thể tái sử dụng ở các form
 * hợp đồng khác (Đặt cọc, Hợp đồng, Đầu tư, Phụ lục...).
 */
import { loaiTienDoKey } from "../../../lib/tdttLoaiTienDo";
import {
  type PolicyDiscountRound,
  type RoundFormulas,
  DEFAULT_EVAL_ORDER,
  LOW_EVAL_ORDER,
  DEFAULT_FIRST_FORMULAS,
  DEFAULT_NEXT_FORMULAS,
  LOW_FIRST_FORMULAS,
  LOW_NEXT_FORMULAS,
  evaluateRoundFormula,
} from "./formulas";
import {
  applyPicked,
  findDetailForRound,
  isLegacyCode,
  policyRoundFields,
  shouldSaveRound,
  type PickedOption,
} from "./discountOptions";
import { luyKeTienTyLeAt, luyKeTyLeSeries, mocTemplatePicker, policyMoc, skippedRoundResult } from "./mocTinh";

import { withAllocationRequired, type OptionCtx } from "./optionConditions";
import { GOM_VAT_PBT_VAR_SOURCES, HIGH_RISE_BASE_VAR_SOURCES, gomVatPbtVars, highRiseBaseVars, mocRoundVar, nakedRoundVars, parseNaked, roundRefSources, roundRefVars } from "./roundVars";
import dayjs from "dayjs";
import { type PaymentSchedule } from "./types";
import { templateDuration } from "../../../lib/tdttThoiHan";
import { giaoDichKey } from "../../../lib/tdttGiaoDich";
import { HDMB_LAN_CODE, HDMB_LAN_MAX } from "./hdmbLanVars";
import { VAT_CUOI_PBT_CODE } from "./vatCuoiPbtVar";

/* ===================== Calculations shape (kết quả useMemo `calculations`) ===================== */
export interface ContractCalculations {
  tongChuaVAT?: number;
  tienVAT?: number;
  tongGomVAT?: number;
  phiBaoTri?: number;
  tongGiaTriHD?: number;
  tongGiaTriHDMB?: number;
  giaTriSauCK?: number;
  tienDatChuaVAT?: number;
  tienVATDat?: number;
  tongTienDatVAT?: number;
  thanhTienXDSauCK?: number;
  tienVATXD?: number;
  tongGiaXDVAT?: number;
  [k: string]: any;
}

/* ===================== Map API formula details -> RoundFormulas ===================== */
export function mapApiDetailsToFormulas(
  details: any[],
  isLow: boolean,
  isFirst: boolean
): RoundFormulas {
  const FIRST = isLow ? LOW_FIRST_FORMULAS : DEFAULT_FIRST_FORMULAS;
  const NEXT = isLow ? LOW_NEXT_FORMULAS : DEFAULT_NEXT_FORMULAS;
  const fallback = isFirst ? FIRST : NEXT;
  const get = (code: string) =>
    details?.find(
      (d: any) => (d?.Code || "").toLowerCase() === code.toLowerCase()
    )?.Formula;
  return {
    tongCK: get("TongCK") || fallback.tongCK,
    // High-rise
    tongChuaVAT: get("TongChuaVAT") || fallback.tongChuaVAT,
    vat: get("VAT") || fallback.vat,
    tongGomVAT: get("TongGomVAT") || fallback.tongGomVAT,
    phiBaoTri: get("PhiBaoTri") || get("PhiBT") || fallback.phiBaoTri,
    // Chấp nhận nhiều mã đồng nghĩa cho "Tổng gồm VAT + PBT"
    tongGiaTriHD:
      get("TongGiaTriHD") ||
      get("TongGiaTri") ||
      get("TongGomPBT") ||
      get("TongCongPBT") ||
      get("TongThanhToan") ||
      fallback.tongGiaTriHD,
    giaNaked: isLow ? undefined : get("GiaNaked") || fallback.giaNaked,
    // Low-rise
    giaDatChuaVAT:
      get("GiaDatChuaVAT") || get("GiaDatKoVAT") || fallback.giaDatChuaVAT,
    vatDat: get("VATDat") || fallback.vatDat,
    tongGiaDat:
      get("TongGiaDatVAT") || get("TongGiaDat") || fallback.tongGiaDat,
    tienXDChuaVAT:
      get("TongXDChuaVAT") || get("TienXDChuaVAT") || fallback.tienXDChuaVAT,
    vatXD: get("VATXD") || fallback.vatXD,
    tienXDGomVAT:
      get("TongXDVAT") || get("TienXDGomVAT") || fallback.tienXDGomVAT,
    tongGiaTriHDMB:
      get("TongGiaTriHDMB") ||
      get("TongGiaTri") ||
      get("TongGomPBT") ||
      get("TongCongPBT") ||
      get("TongThanhToan") ||
      fallback.tongGiaTriHDMB,
    evalOrder: isLow ? [...LOW_EVAL_ORDER] : [...DEFAULT_EVAL_ORDER],
  } as RoundFormulas;
}

/* ===================== Biến đầu vào cho công thức lịch thanh toán ===================== */
export interface PaymentFormulaContext {
  calculations: ContractCalculations;
  rawTongGiaChuaVAT?: number | null;
  /** Cao tầng: "Giá HĐMB chưa TT lần 1…6" của sản phẩm trong bảng giá (biến GiaTriHDMBLan{n}); trống ⇒ 0 */
  giaHDMBLan?: (number | null)[] | null;
  /** Cao tầng: "5%VAT đợt cuối + PBT" (cột Q) của sản phẩm trong bảng giá (biến VATCuoiPBT); trống ⇒ 0 */
  vatCuoiPBT?: number | null;
}

/** Σ các đợt phía trên đợt đang tính (biến Prev*, TienCocPrev) + Σ Tổng cộng các đợt phía dưới (NextTongCong) */
export interface ScheduleRunningSums {
  tuongUng?: number;
  vat?: number;
  pbt?: number;
  tongCong?: number;
  vatDat?: number;
  vatXD?: number;
  tienCoc?: number;
  vonTuCo?: number;
  vayNH?: number;
  nextTongCong?: number;
}

export function getPaymentFormulaVars(
  ctx: PaymentFormulaContext,
  tyLeTT: number,
  tyLeVAT: number,
  tyLePBT: number,
  soTien?: number,
  tienVAT?: number,
  tienBaoTri?: number,
  prevSums?: ScheduleRunningSums,
  tyLeXD?: number,
  /** Tiền cọc của chính đợt (biến LanNay_TienCoc) */
  tienCoc?: number,
  /** Cao tầng: tỷ lệ và số đã tính tới lúc này của Vốn tự có / Vay NH trong đợt (chưa tính ⇒ bỏ trống ⇒ 0) */
  vonVay?: { tyLeVonTuCo?: number; tyLeVayNH?: number; vonTuCo?: number; vayNH?: number }
): Record<string, number> {
  const calculations = ctx.calculations || {};
  const tongGiaTriHDB =
    calculations.tongGiaTriHD ||
    calculations.tongGiaTriHDMB ||
    calculations.tongGomVAT ||
    calculations.giaTriSauCK ||
    calculations.tongChuaVAT ||
    0;
  const tongChuaVATSauCSBH =
    calculations.giaTriSauCK ||
    calculations.tongChuaVAT ||
    Number(ctx.rawTongGiaChuaVAT) ||
    0;
  const tongVAT = calculations.tienVAT || 0;
  const phiBaoTri = calculations.phiBaoTri || 0;
  return {
    PhanTramTT: tyLeTT,
    PhanTramVAT: tyLeVAT,
    TyLeVAT: tyLeVAT,
    PhanTramPBT: tyLePBT,
    TyLePBT: tyLePBT,
    PhanTramXD: tyLeXD ?? 0,
    TyLeXD: tyLeXD ?? 0,
    TongGiaChuaVAT: tongChuaVATSauCSBH,
    TongChuaVAT: tongChuaVATSauCSBH,
    TongGiaDaVAT: calculations.tongGomVAT || 0,
    TongGomVAT: calculations.tongGomVAT || 0,
    TongGiaGomVAT: calculations.tongGomVAT || 0,
    TongGiaTriHD: tongGiaTriHDB,
    TongGiaTriHDB: tongGiaTriHDB,
    // "Tổng cộng" của danh mục biến TĐTT cao tầng: gồm VAT + phí bảo trì (sau CK)
    TongThanhToan: tongGiaTriHDB,
    TongTienVAT: tongVAT,
    TienVAT: tongVAT,
    PhiBaoTri: phiBaoTri,
    TongPhiBaoTri: phiBaoTri,
    // Thấp tầng (sau CK)
    GiaDatGomVAT: (calculations as any).tongTienDatVAT || 0,
    GiaDatChuaVAT: (calculations as any).tienDatChuaVAT || 0,
    VATDat: (calculations as any).tienVATDat || 0,
    ThanhTienXDVAT: (calculations as any).tongGiaXDVAT || 0,
    TienXDChuaVAT: (calculations as any).thanhTienXDSauCK || 0,
    VATXD: (calculations as any).tienVATXD || 0,
    GiaTriHDMB: (calculations as any).tongGiaTriHDMB || 0,
    // LanNay_*
    // Giá trị của chính đợt: chưa tính tới (theo thứ tự tính) ⇒ 0, không lấy tổng của cả hợp đồng
    LanNay_TuongUng: soTien ?? 0,
    LanNay_VAT: tienVAT ?? 0,
    LanNay_PBT: tienBaoTri ?? 0,
    LanNay_TienCoc: Number(tienCoc) || 0,
    PhanTramVonTuCo: Number(vonVay?.tyLeVonTuCo) || 0,
    PhanTramVayNH: Number(vonVay?.tyLeVayNH) || 0,
    LanNay_VonTuCo: Number(vonVay?.vonTuCo) || 0,
    LanNay_VayNH: Number(vonVay?.vayNH) || 0,
    LanNay_GiaDatGomVAT:
      soTien !== undefined
        ? soTien
        : ((calculations as any).tongTienDatVAT || 0) * (tyLeTT / 100),
    LanNay_GiaDatChuaVAT:
      soTien !== undefined
        ? soTien / (1 + (tyLeVAT / 100 || 0))
        : ((calculations as any).tienDatChuaVAT || 0) * (tyLeTT / 100),
    LanNay_VATDat:
      soTien !== undefined
        ? soTien - soTien / (1 + (tyLeVAT / 100 || 1))
        : ((calculations as any).tienVATDat || 0) * (tyLeTT / 100),
    LanNay_ThanhTienXDVAT: tienBaoTri ?? 0,
    LanNay_TienXDChuaVAT: (tienBaoTri ?? 0) / (1 + (tyLeVAT / 100 || 1)),
    LanNay_VATXD:
      (tienBaoTri ?? 0) - (tienBaoTri ?? 0) / (1 + (tyLeVAT / 100 || 1)),
    LanNay_TienXD: tienBaoTri ?? 0,
    LanNay_XD: tienBaoTri ?? 0,
    LanNay_TongTienXDVAT: tienBaoTri ?? 0,
    LanNay_HDMB: (soTien ?? 0) + (tienVAT ?? 0) + (tienBaoTri ?? 0),
    SoTien: soTien ?? 0,
    TienBaoTri: tienBaoTri ?? 0,
    PrevTuongUng: prevSums?.tuongUng ?? 0,
    PrevVAT: prevSums?.vat ?? 0,
    PrevPBT: prevSums?.pbt ?? 0,
    PrevTongCong: prevSums?.tongCong ?? 0,
    // "Σ Tổng cộng (đợt sau)": Σ Tổng cộng các đợt phía dưới (recalcPaymentScheduleSequential tính lặp)
    NextTongCong: prevSums?.nextTongCong ?? 0,
    // "Tiền cọc (Đợt trước)": Σ tiền cọc các đợt phía trên
    TienCocPrev: prevSums?.tienCoc ?? 0,
    // Giá trị HĐMB lần n (bảng giá) — biến theo lần GiaTriHDMBLan1…6
    ...Object.fromEntries(
      Array.from({ length: HDMB_LAN_MAX }, (_, i) => [`${HDMB_LAN_CODE}${i + 1}`, Number(ctx.giaHDMBLan?.[i]) || 0])
    ),
    // 5%VAT cuối + PBT (cột Q bảng giá)
    [VAT_CUOI_PBT_CODE]: Number(ctx.vatCuoiPBT) || 0,
    PrevVonTuCo: prevSums?.vonTuCo ?? 0,
    PrevVayNH: prevSums?.vayNH ?? 0,
    PrevThanhTienXDVAT: prevSums?.pbt ?? 0,
    PrevXD: prevSums?.pbt ?? 0,
    PrevTienXD: prevSums?.pbt ?? 0,
    PrevHDMB: prevSums?.tongCong ?? 0,
    PrevGiaDatGomVAT: prevSums?.tuongUng ?? 0,
    PrevGiaDatChuaVAT: (prevSums?.tuongUng ?? 0) - (prevSums?.vat ?? 0),
    PrevVATDat: prevSums?.vat ?? 0,
  };
}

/* ===================== Tính 1 dòng lịch thanh toán ===================== */
export function calculatePaymentScheduleRow(
  row: PaymentSchedule,
  ctx: PaymentFormulaContext,
  prevSums?: ScheduleRunningSums,
  forceRecalc = false
): PaymentSchedule {
  if ((row as any).restoredFromMaPGC && !(row as any).edited && !forceRecalc)
    return row;
  const tyLeTT = Number(row.tyLeTT) || 0;
  const tyLeVAT = Number(row.tyLeVAT) || 0;
  // const tyLeVATDat = Number(row.tyLeVATDat) || tyLeVAT;
  const tyLePBT = Number(row.tyLePBT) || 0;
  const tyLeXD = Number(row.tyLeXD) || 0;
  const tuongUngFormula = row.tuongUngFormula != null ? String(row.tuongUngFormula) : "";
  const tienVATFormulaStr = row.tienVATFormula != null ? String(row.tienVATFormula) : "";
  const phiBaoTriFormulaStr = row.phiBaoTriFormula != null ? String(row.phiBaoTriFormula) : "";
  const tongCongFormulaStr = row.tongCongFormula != null ? String(row.tongCongFormula) : "";
  const vonTuCoFormulaStr = row.vonTuCoFormula != null ? String(row.vonTuCoFormula) : "";
  const vayNHFormulaStr = row.vayNHFormula != null ? String(row.vayNHFormula) : "";
  const tyLeVonVay = { tyLeVonTuCo: Number(row.tyLeVonTuCo) || 0, tyLeVayNH: Number(row.tyLeVayNH) || 0 };

  const vars = getPaymentFormulaVars(
    ctx,
    tyLeTT,
    tyLeVAT,
    tyLePBT,
    undefined,
    undefined,
    undefined,
    prevSums,
    tyLeXD,
    row.tienCoc,
    tyLeVonVay
  );
  const round0 = (v: number) => Math.round(Number(v) || 0);

  // Fallback phân bổ theo tỷ lệ khi CHƯA cấu hình công thức:
  // mỗi đợt = Tổng tiền tương ứng * %TT (VAT / PBT theo tỷ lệ khai báo,
  // nếu đợt không khai báo tỷ lệ riêng thì phân bổ theo %TT).
  const baseTuongUng = Number(vars.TongGiaChuaVAT) || 0;
  const baseVAT = Number(vars.TongTienVAT) || 0;
  const basePBT = Number(vars.TongPhiBaoTri) || 0;

  /*
   * Thứ tự tính theo phụ thuộc: trường dùng LanNay_X của trường khác thì tính sau trường đó; không phụ thuộc thì giữ thứ tự
   * mặc định Tương ứng → VAT → PBT → Vốn tự có → Vay NH (Tổng cộng luôn cuối). Hai trường dùng lẫn nhau (vòng) ⇒ trường
   * đứng trước theo thứ tự mặc định tính trước, thấy biến kia = 0. VAT không có công thức tính theo %VAT của Tương ứng.
   */
  type Truong = "tu" | "vat" | "pbt" | "vtc" | "vnh";
  const vals: Partial<Record<Truong, number>> = {};
  const varsNow = () =>
    getPaymentFormulaVars(ctx, tyLeTT, tyLeVAT, tyLePBT, vals.tu, vals.vat, vals.pbt, prevSums, tyLeXD, row.tienCoc, {
      ...tyLeVonVay,
      vonTuCo: vals.vtc,
      vayNH: vals.vnh,
    });
  let tienXD = 0;
  const truong: { key: Truong; formula: string; lanNay: string; noFormulaDeps: Truong[]; tinh: () => number }[] = [
    {
      key: "tu", formula: tuongUngFormula, lanNay: "LanNay_TuongUng", noFormulaDeps: [],
      tinh: () => (tuongUngFormula ? evaluateRoundFormula(tuongUngFormula, varsNow()) : round0((baseTuongUng * tyLeTT) / 100)),
    },
    {
      key: "vat", formula: tienVATFormulaStr, lanNay: "LanNay_VAT", noFormulaDeps: ["tu"],
      tinh: () => {
        const v = varsNow();
        tienXD = tienVATFormulaStr
          ? evaluateRoundFormula(tienVATFormulaStr, v)
          : round0(tyLeXD > 0 ? (baseVAT * tyLeXD) / 100 : 0);
        // Nếu người dùng để trống / 0 ở cột %VAT thì đợt đó KHÔNG có tiền VAT
        return tienVATFormulaStr
          ? evaluateRoundFormula(tienVATFormulaStr, v)
          : round0(tyLeVAT > 0 ? ((vals.tu ?? 0) * tyLeVAT) / 100 : 0);
      },
    },
    {
      key: "pbt", formula: phiBaoTriFormulaStr, lanNay: "LanNay_PBT", noFormulaDeps: [],
      tinh: () => (phiBaoTriFormulaStr ? evaluateRoundFormula(phiBaoTriFormulaStr, varsNow()) : round0((basePBT * (tyLePBT > 0 ? tyLePBT : 0)) / 100)),
    },
    // Cao tầng: chưa cấu hình công thức ⇒ 0 (không tự chia theo tỷ lệ)
    { key: "vtc", formula: vonTuCoFormulaStr, lanNay: "LanNay_VonTuCo", noFormulaDeps: [], tinh: () => (vonTuCoFormulaStr ? evaluateRoundFormula(vonTuCoFormulaStr, varsNow()) : 0) },
    { key: "vnh", formula: vayNHFormulaStr, lanNay: "LanNay_VayNH", noFormulaDeps: [], tinh: () => (vayNHFormulaStr ? evaluateRoundFormula(vayNHFormulaStr, varsNow()) : 0) },
  ];
  const deps = new Map(
    truong.map((t) => [
      t.key,
      t.formula.trim()
        ? truong.filter((o) => o.key !== t.key && new RegExp(`\\b${o.lanNay}\\b`).test(t.formula)).map((o) => o.key)
        : t.noFormulaDeps,
    ])
  );
  const conLai = truong.slice();
  while (conLai.length) {
    const i = conLai.findIndex((t) => (deps.get(t.key) || []).every((k) => vals[k] !== undefined || !conLai.some((c) => c.key === k)));
    const [t] = conLai.splice(i >= 0 ? i : 0, 1);
    vals[t.key] = t.tinh();
  }
  const soTien = vals.tu ?? 0;
  const tienVAT = vals.vat ?? 0;
  const tienBaoTri = vals.pbt ?? 0;
  const vonTuCo = vals.vtc ?? 0;
  const vayNH = vals.vnh ?? 0;

  const tongGiaTri = tongCongFormulaStr
    ? evaluateRoundFormula(tongCongFormulaStr, varsNow())
    : soTien + tienVAT + tienBaoTri;

  return {
    ...row,
    tyLeTT,
    tyLeVAT,
    tyLePBT,
    // tyLeVATDat,
    tyLeXD,
    soTien,
    tienVAT,
    // tienVATDat,
    tienXD,
    tienBaoTri,
    vonTuCo,
    vayNH,
    tongGiaTri,
  };
}

/** Ô Vốn tự có / Vay NH: đợt không có công thức và số bằng 0 ⇒ để trống (công thức trống không phải "phân bổ theo tỷ lệ") */
export const hasOptionalScheduleAmount = (value: unknown, formula: unknown): boolean =>
  !!String(formula ?? "").trim() || (Number(value) || 0) !== 0;

/* ===================== Tính lại toàn bộ lịch thanh toán theo thứ tự ===================== */
const NEXT_TONG_CONG_RE = /\bNextTongCong\b/;
/** Số lượt tính lặp tối đa khi có đợt dùng NextTongCong */
const NEXT_TONG_CONG_MAX_PASSES = 5;

const usesNextTongCong = (r: PaymentSchedule): boolean =>
  [r.tuongUngFormula, r.tienVATFormula, r.phiBaoTriFormula, r.tongCongFormula, r.vonTuCoFormula, r.vayNHFormula].some(
    (f) => f != null && NEXT_TONG_CONG_RE.test(String(f))
  );

/** NextTongCong của từng đợt = Σ tongGiaTri các đợt phía dưới (đợt cuối = 0) */
const suffixTongCong = (rows: PaymentSchedule[]): number[] => {
  const out = new Array<number>(rows.length).fill(0);
  for (let i = rows.length - 2; i >= 0; i--) out[i] = out[i + 1] + (Number(rows[i + 1].tongGiaTri) || 0);
  return out;
};

/**
 * Tính lại toàn bộ lịch theo thứ tự (Prev* cộng dồn từ trên xuống).
 * Có đợt dùng NextTongCong (Σ Tổng cộng các đợt sau) ⇒ tính lặp: lượt 1 NextTongCong = 0, lượt sau lấy Tổng cộng các
 * đợt dưới của lượt trước; dừng khi Tổng cộng mọi đợt không đổi. Hết NEXT_TONG_CONG_MAX_PASSES lượt chưa ổn định
 * (công thức phụ thuộc vòng) ⇒ giữ lượt cuối, gắn cờ canhBaoDotSau cho đợt dùng biến.
 */
export function recalcPaymentScheduleSequential(
  rows: PaymentSchedule[],
  ctx: PaymentFormulaContext,
  forceRecalc = false
): PaymentSchedule[] {
  // Cờ của lần tính trước không được giữ lại (đợt khôi phục từ phiếu trả nguyên dòng vào)
  const clean = rows.map(({ canhBaoDotSau: _old, ...r }) => r as PaymentSchedule);
  if (!clean.some(usesNextTongCong)) return recalcOnePass(clean, ctx, forceRecalc);

  let out = recalcOnePass(clean, ctx, forceRecalc, new Array<number>(clean.length).fill(0));
  for (let pass = 2; pass <= NEXT_TONG_CONG_MAX_PASSES; pass++) {
    const next = recalcOnePass(clean, ctx, forceRecalc, suffixTongCong(out));
    const stable = next.every((r, i) => Math.abs((Number(r.tongGiaTri) || 0) - (Number(out[i].tongGiaTri) || 0)) < 0.5);
    out = next;
    if (stable) return out;
  }
  return out.map((r) => (usesNextTongCong(r) ? { ...r, canhBaoDotSau: true } : r));
}

/** Câu cảnh báo khi có đợt dùng NextTongCong mà tính lặp chưa ổn định (cờ canhBaoDotSau); không có ⇒ null */
export function dotSauIssue(rows: PaymentSchedule[]): string | null {
  const n = (rows || []).filter((r) => r.canhBaoDotSau).length;
  return n
    ? `${n} đợt dùng Σ Tổng cộng (đợt sau) nhưng công thức các đợt phụ thuộc vòng, số tiền chưa ổn định.`
    : null;
}

function recalcOnePass(
  rows: PaymentSchedule[],
  ctx: PaymentFormulaContext,
  forceRecalc: boolean,
  nextTongCong?: number[]
): PaymentSchedule[] {
  const out: PaymentSchedule[] = [];
  const running = { tuongUng: 0, vat: 0, pbt: 0, tongCong: 0, tienCoc: 0, vonTuCo: 0, vayNH: 0 };
  for (const [i, r] of rows.entries()) {
    const calc = calculatePaymentScheduleRow(
      r,
      ctx,
      nextTongCong ? { ...running, nextTongCong: nextTongCong[i] ?? 0 } : { ...running },
      forceRecalc
    );
    out.push(calc);
    running.tuongUng += calc.soTien || 0;
    running.vat += calc.tienVAT || 0;
    running.pbt += calc.tienBaoTri || 0;
    running.tongCong += calc.tongGiaTri || 0;
    running.tienCoc += Number(calc.tienCoc) || 0;
    running.vonTuCo += Number(calc.vonTuCo) || 0;
    running.vayNH += Number(calc.vayNH) || 0;
  }
  return balanceScheduleRounding(out, ctx);
}

/**
 * Cân số dư làm tròn: nếu tổng các đợt (đủ 100% tỷ lệ) lệch so với tổng
 * giá trị hợp đồng thì dồn phần lệch vào đợt cuối cùng để tổng khớp tuyệt đối.
 */
function balanceScheduleRounding(
  rows: PaymentSchedule[],
  ctx: PaymentFormulaContext
): PaymentSchedule[] {
  if (!rows.length) return rows;
  const totalRatio = rows.reduce((s, r) => s + (Number(r.tyLeTT) || 0), 0);
  // Chỉ cân khi lịch phân bổ đủ 100% giá trị hợp đồng
  if (Math.abs(totalRatio - 100) > 0.01) return rows;

  const vars = getPaymentFormulaVars(ctx, 100, 0, 0);
  const targets = {
    soTien: Number(vars.TongGiaChuaVAT) || 0,
    tienVAT: Number(vars.TongTienVAT) || 0,
    tienBaoTri: Number(vars.TongPhiBaoTri) || 0,
  };

  const lastIdx = rows.length - 1;
  const last: any = { ...rows[lastIdx] };
  if (last.edited || last.restoredFromMaPGC) return rows;

  let bu = 0;
  (["soTien", "tienVAT", "tienBaoTri"] as const).forEach((key) => {
    const target = targets[key];
    if (!target) return;
    const sum = rows.reduce((s, r: any) => s + (Number(r[key]) || 0), 0);
    // Không tự bù nếu người dùng để trống hoàn toàn (VD: %VAT = 0 mọi đợt)
    if (sum === 0 && key !== "soTien") return;
    const diff = Math.round(target - sum);
    // Chỉ bù chênh lệch nhỏ do làm tròn (< 1% giá trị mục tiêu)
    if (diff !== 0 && Math.abs(diff) <= Math.max(1000, target * 0.01)) {
      last[key] = (Number(last[key]) || 0) + diff;
      bu += diff;
    }
  });
  if (!bu) return rows;

  // Cộng phần bù vào Tổng giá trị, không tính lại = Tương ứng + VAT + PBT:
  // giữ kết quả công thức Tổng cộng của đợt (vd. TongThanhToan - PrevTongCong, trừ TienCocPrev)
  last.tongGiaTri = (Number(last.tongGiaTri) || 0) + bu;

  const out = rows.slice();
  out[lastIdx] = last;
  return out;
}

/* ===================== Lịch thanh toán: mẫu tiến độ ⇄ dữ liệu đã lưu trong phiếu ===================== */
/** 1 đợt của mẫu tiến độ (fn_get_byid_payment_schedule → normalizeDetails) */
export interface ScheduleTemplateDetail {
  DotTT?: number | string;
  TuongUng?: unknown;
  TienVAT?: unknown;
  PhiBaoTri?: unknown;
  VATDat?: unknown;
  TienXayDung?: unknown;
  TongCong?: unknown;
  LoaiTienDo?: unknown;
  DienGiaiTyLeTT?: unknown;
  DienGiaiThoiHanTT?: unknown;
  SoNgay?: unknown;
  SoThang?: unknown;
  LoaiThoiGian?: unknown;
  MaLoai?: unknown;
  /** Giao dịch của đợt (src/lib/tdttGiaoDich.ts) */
  GiaoDich?: unknown;
  /** Tiền cọc của đợt */
  TienCoc?: unknown;
  /** Cao tầng: công thức Vốn tự có / Vay NH và tỷ lệ của đợt */
  VonTuCo?: unknown;
  VayNH?: unknown;
  TyLeVonTuCo?: unknown;
  TyLeVayNH?: unknown;
}

/** 1 phần tử `lich_thanh_toan` đã lưu trong phiếu (khoá PascalCase) */
export type SavedScheduleItem = Record<string, unknown>;

/**
 * Công thức 4 cột của 1 đợt theo mẫu tiến độ.
 * Cao tầng: TienVAT → cột VAT, PhiBaoTri → cột PBT.
 * Thấp tầng: VATDat → cột VAT đất, TienXayDung → cột tiền XD.
 * Không phải chuỗi = chưa cấu hình → "" (calc rơi về phân bổ theo tỷ lệ).
 */
export function scheduleFormulasFromTemplate(
  inst: ScheduleTemplateDetail | undefined,
  isLowRise: boolean
) {
  const asFormula = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    tuongUngFormula: asFormula(inst?.TuongUng),
    tienVATFormula: asFormula(isLowRise ? inst?.VATDat : inst?.TienVAT),
    phiBaoTriFormula: asFormula(isLowRise ? inst?.TienXayDung : inst?.PhiBaoTri),
    tongCongFormula: asFormula(inst?.TongCong),
    vonTuCoFormula: isLowRise ? "" : asFormula(inst?.VonTuCo),
    vayNHFormula: isLowRise ? "" : asFormula(inst?.VayNH),
  };
}

/** Loại tiến độ + 2 diễn giải của đợt mẫu ⇒ field dòng lịch (dùng cho phiếu in) */
export const templatePrintText = (inst: ScheduleTemplateDetail | undefined) => ({
  loaiTienDo: loaiTienDoKey(inst?.LoaiTienDo),
  dienGiaiTyLeTT: String(inst?.DienGiaiTyLeTT ?? ""),
  dienGiaiThoiHanTT: String(inst?.DienGiaiThoiHanTT ?? ""),
});

/**
 * Mẫu tiến độ đang chờ duyệt (không đọc được đợt mẫu): giữ chữ đã chụp trong printData lần lưu trước, ghép theo đợt,
 * để lưu lại phiếu không làm mất mẫu Chuyển nhượng.
 */
export function keepSavedPrintText<T extends { dot?: unknown; loaiTienDo?: unknown }>(
  rows: T[],
  savedPrint: ReadonlyArray<{ dot?: unknown; loaiTienDo?: unknown; dienGiaiTyLeTT?: unknown; dienGiaiThoiHanTT?: unknown }> | null | undefined
): T[] {
  if (!savedPrint?.length) return rows;
  return rows.map((r) => {
    if (r.loaiTienDo) return r;
    const s = savedPrint.find((x) => Number(x?.dot) === Number(r.dot));
    return s?.loaiTienDo
      ? { ...r, loaiTienDo: loaiTienDoKey(s.loaiTienDo), dienGiaiTyLeTT: String(s.dienGiaiTyLeTT ?? ""), dienGiaiThoiHanTT: String(s.dienGiaiThoiHanTT ?? "") }
      : r;
  });
}

/**
 * Số liệu 1 đợt đã lưu → field của bảng lịch thanh toán. Thấp tầng: cột
 * VAT đất dùng tyLeVAT/tienVAT, cột "Tiền XD" dùng tyLeXD/tienBaoTri.
 * %XD đọc cả khoá cũ TyLeXD / TyLeXayDung.
 */
export function savedScheduleAmounts(inst: SavedScheduleItem, isLowRise: boolean) {
  const n = (v: unknown) => Number(v) || 0;
  return {
    tyLeTT: n(inst?.TyLeTT),
    soTien: n(inst?.TuongUng),
    tyLeVAT: n(isLowRise ? inst?.TyLeVATDat : inst?.TyLeVAT),
    tienVAT: n(isLowRise ? inst?.TienVATDat : inst?.ThueVAT),
    tyLeVATDat: n(inst?.TyLeVATDat),
    tienVATDat: n(inst?.TienVATDat),
    tyLePBT: n(inst?.TyLePBT),
    tyLeXD: n(inst?.TyLePXD ?? inst?.TyLeXD ?? inst?.TyLeXayDung),
    hasPBT: n(inst?.TyLePBT) > 0 || n(inst?.PhiBT) > 0,
    tienBaoTri: n(isLowRise ? inst?.TienXD : inst?.PhiBT),
    tienXD: n(inst?.TienXD),
    tongGiaTri: n(inst?.SoTien),
    vonTuCo: n(inst?.VonTuCo),
    vayNH: n(inst?.VayNH),
  };
}

/**
 * Dựng lại tab Lịch thanh toán khi mở phiếu để sửa: số liệu lấy đúng theo
 * `lich_thanh_toan` đã lưu (giữ cờ restoredFromMaPGC), công thức lấy theo mẫu
 * tiến độ `templateDetails` ghép theo DotTT — để popover hiện đúng công thức
 * và khi người dùng sửa số liệu thì tính lại đúng như lúc tạo phiếu.
 */
export function restoreSavedSchedule(
  saved: SavedScheduleItem[],
  isLowRise: boolean,
  templateDetails: ScheduleTemplateDetail[] = []
): PaymentSchedule[] {
  const n = (v: unknown) => Number(v) || 0;
  const tplByDot = new Map<number, ScheduleTemplateDetail>();
  (templateDetails || []).forEach((t) => {
    const dot = n(t?.DotTT);
    if (dot && !tplByDot.has(dot)) tplByDot.set(dot, t);
  });
  return (saved || [])
    .slice()
    .sort((a, b) => n(a?.DotTT) - n(b?.DotTT))
    .map((inst, index) => {
      const dot = n(inst?.DotTT) || index + 1;
      const tpl = tplByDot.get(dot);
      // Lịch đã lưu không giữ SoNgay / MaLoai ⇒ lấy theo đợt mẫu cùng DotTT để đổi ngày gốc tính lại được
      const noDueConfig = !tpl && inst?.SoNgay == null;
      return {
        id: index + 1,
        dot,
        kieuThanhToan: String(inst?.DotTTText || `Đợt ${dot}`),
        ngayTT: (inst?.NgayTT as string | null | undefined) ?? null,
        ...scheduleFormulasFromTemplate(tpl, isLowRise),
        ...savedScheduleAmounts(inst, isLowRise),
        // Phiếu lưu trước khi có cột tiền cọc ⇒ theo đợt mẫu cùng DotTT
        tienCoc: n(inst?.TienCoc ?? tpl?.TienCoc),
        // Tỷ lệ Vốn tự có / Vay NH: phiếu lưu trước khi có khoá ⇒ theo đợt mẫu cùng DotTT
        tyLeVonTuCo: n(inst?.TyLeVonTuCo ?? tpl?.TyLeVonTuCo),
        tyLeVayNH: n(inst?.TyLeVayNH ?? tpl?.TyLeVayNH),
        ...(inst?.SoNgay != null ? { soNgay: n(inst.SoNgay), theoThang: false } : templateDuration(tpl)),
        // Đợt mẫu bỏ chọn loại ngày (MaLoai null) ⇒ giữ null: Ngày TT để trống
        maLoaiNgay: n(inst?.MaLoai) || (tpl && (tpl.MaLoai === null || tpl.MaLoai === "") ? null : n(tpl?.MaLoai) || 1),
        // Lịch đã lưu không giữ giao dịch ⇒ theo đợt mẫu cùng DotTT
        giaoDich: giaoDichKey(tpl?.GiaoDich),
        // Không lưu theo đợt của phiếu ⇒ theo đợt mẫu cùng DotTT (chỉ dùng cho phiếu in)
        ...templatePrintText(tpl),
        dienGiai: String(inst?.DienGiai ?? ""),
        // Loại tiến độ: phiếu lưu trước khi có khoá ⇒ theo đợt mẫu cùng DotTT
        LoaiTienDo: loaiTienDoKey(inst?.LoaiTienDo ?? tpl?.LoaiTienDo),
        restoredFromMaPGC: true,
        ...(noDueConfig ? { noDueConfig: true } : {}),
      };
    });
}

/** Kết quả đọc mẫu tiến độ (fn_get_byid_payment_schedule); PriceSheetForm có nơi đọc `data.detail` */
type ScheduleTemplateRes = { status?: number; data?: { status?: string; detail?: ScheduleTemplateDetail[] } | null; detail?: ScheduleTemplateDetail[] } | null | undefined;

/** Đợt của mẫu dùng để khôi phục chứng từ đã lưu: mẫu đang chờ duyệt thì không lấy gì (nội dung chưa duyệt không vào chứng từ) */
export const restorableTemplateDetails = (res: ScheduleTemplateRes): ScheduleTemplateDetail[] =>
  res?.data?.status === "pending" ? [] : res?.detail || res?.data?.detail || [];

/**
 * restoreSavedSchedule theo kết quả đọc mẫu. Mẫu đang chờ duyệt: giữ nguyên dòng và hạn đã lưu; mọi dòng `noDueConfig`
 * để clearDueDates không xóa hạn khi chuyển cọc sang hợp đồng hoặc đổi ngày gốc. Mẫu được duyệt lại thì lần mở sau dùng mẫu như thường.
 */
export function restoreScheduleFromRes(saved: SavedScheduleItem[], isLowRise: boolean, res: ScheduleTemplateRes): PaymentSchedule[] {
  const rows = restoreSavedSchedule(saved, isLowRise, restorableTemplateDetails(res));
  return res?.data?.status === "pending" ? rows.map((r) => ({ ...r, noDueConfig: true })) : rows;
}

/* ===================== Ngày TT theo loại ngày của mẫu tiến độ ===================== */
/**
 * Ngày gốc của 1 đợt: ngày đặt cọc (phiếu cọc: ngày cọc), ngày giao dịch, Ngày TT của đợt ngay phía trên (dot_truoc),
 * hoặc không có (none: bỏ chọn loại ngày ⇒ Ngày TT trống)
 */
export type DueBase = "dat_coc" | "giao_dich" | "dot_truoc" | "none";
export type DueDocType = "deposit" | "contract" | "investment" | string;

/**
 * MaLoai (danh mục loai_ngay_tdtt): 1 = Ngày đặt cọc (8 = Ngày đặt cọc của danh mục cũ), 3 = Ngày giao dịch, 2 = tháng (cũ),
 * 4 = Đợt liền trước, null / "" = không chọn (undefined: dòng nguồn cũ, giữ cách tính cũ).
 * HĐ / góp vốn: 1|8 → ngày đặt cọc, còn lại → ngày giao dịch. Phiếu cọc: mọi đợt → ngày cọc (chưa có ngày giao dịch;
 * đợt "Ngày giao dịch" lấy đúng ngày cọc, không cộng số ngày — tính lại khi lên HĐ, xem computeDueDate).
 */
export function scheduleBaseKind(maLoai: unknown, type: DueDocType): DueBase {
  if (maLoai === null || maLoai === "") return "none";
  const m = Number(maLoai);
  if (m === 4) return "dot_truoc";
  if (type === "deposit") return "dat_coc";
  return m === 1 || m === 8 ? "dat_coc" : "giao_dich";
}

export interface DueDateCtx {
  type: DueDocType;
  ngayGiaoDich: Date | null;
  /** Phiếu cọc: truyền ngày cọc (ô ngayKy, nhãn "Ngày đặt cọc") */
  ngayDatCoc: Date | null;
}

/**
 * Ngày TT = ngày gốc theo loại ngày + số ngày (theoThang hoặc mã 2 cũ: số tháng). Ngày gốc trống → null. Dạng "YYYY-MM-DDT00:00:00+07:00".
 * Phiếu cọc, đợt "Ngày giao dịch" (MaLoai 3): mặc định đúng ngày cọc, không cộng số ngày.
 */
export function computeDueDate(
  row: { soNgay?: number; maLoaiNgay?: number | null; theoThang?: boolean; noDueConfig?: boolean },
  ctx: DueDateCtx
): string | null {
  if (row.noDueConfig) return null; // không có cấu hình hạn (mẫu chờ duyệt): không tính "ngày gốc + 0"
  const kind = scheduleBaseKind(row.maLoaiNgay, ctx.type);
  if (kind === "none" || kind === "dot_truoc") return null; // dot_truoc: tính theo chuỗi ở scheduleDueDates
  const base = kind === "dat_coc" ? ctx.ngayDatCoc : ctx.ngayGiaoDich;
  if (!base) return null;
  if (ctx.type === "deposit" && Number(row.maLoaiNgay) === 3) return dayjs(base).format("YYYY-MM-DD") + "T00:00:00+07:00";
  const unit = row.theoThang || Number(row.maLoaiNgay) === 2 ? "month" : "day";
  return dayjs(base).add(Number(row.soNgay) || 0, unit).format("YYYY-MM-DD") + "T00:00:00+07:00";
}

/**
 * Bỏ Ngày TT đã có của các đợt có ngày gốc thuộc `kinds` (để tính lại theo công thức), kèm các đợt "Đợt liền trước"
 * nối tiếp ngay sau một đợt vừa bị bỏ; không dòng nào đổi → trả mảng cũ
 */
export function clearDueDates<T extends PaymentSchedule>(rows: T[], type: DueDocType, kinds: DueBase[]): T[] {
  let changed = false;
  let prevCleared = false;
  const next = rows.map((r) => {
    const kind = scheduleBaseKind(r.maLoaiNgay, type);
    const clear = !r.noDueConfig && (kinds.includes(kind) || (kind === "dot_truoc" && prevCleared));
    prevCleared = clear;
    if (!clear || r.ngayTT == null) return r;
    changed = true;
    return { ...r, ngayTT: null };
  });
  return changed ? next : rows;
}

/**
 * Số đợt thiếu kỳ hạn (cảnh báo khi lưu): chưa có Ngày TT và thời hạn 0. Bỏ chọn loại ngày là chủ ý để trống ⇒ không tính;
 * "Đợt liền trước" thời hạn 0 hợp lệ (cùng ngày đợt trên), chỉ tính khi là đợt đầu (không có đợt trên)
 */
export function countMissingTermRows(rows: PaymentSchedule[], type: DueDocType): number {
  return rows.filter((r, i) => {
    if (r.ngayTT) return false;
    const kind = scheduleBaseKind(r.maLoaiNgay, type);
    if (kind === "none") return false;
    if (kind === "dot_truoc") return i === 0;
    return !(Number(r.soNgay) > 0);
  }).length;
}

/** Sau khi chọn tay Ngày TT của đợt `id`: bỏ Ngày TT các đợt "Đợt liền trước" nối tiếp ngay sau để tính lại theo chuỗi */
export function clearChainedDueDates<T extends PaymentSchedule>(rows: T[], id: number): T[] {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return rows;
  let changed = false;
  const next = rows.slice();
  for (let j = i + 1; j < next.length && scheduleBaseKind(next[j].maLoaiNgay, "") === "dot_truoc"; j++) {
    if (next[j].ngayTT == null || next[j].noDueConfig) continue;
    next[j] = { ...next[j], ngayTT: null };
    changed = true;
  }
  return changed ? next : rows;
}

/**
 * Xóa đợt `id`: các đợt "Đợt liền trước" nối ngay sau vị trí đó đổi đợt đứng trên ⇒ bỏ Ngày TT đã có để tính lại theo chuỗi
 */
export function removeScheduleRow<T extends PaymentSchedule>(rows: T[], id: number): T[] {
  const i = rows.findIndex((r) => r.id === id);
  if (i < 0) return rows;
  const next = rows.filter((r) => r.id !== id);
  for (let j = i; j < next.length && scheduleBaseKind(next[j].maLoaiNgay, "") === "dot_truoc"; j++) {
    if (next[j].ngayTT != null && !next[j].noDueConfig) next[j] = { ...next[j], ngayTT: null };
  }
  return next;
}

/**
 * Ngày TT của từng đợt, tính tuần tự: ngày đã có (chọn tay / đã lưu) giữ nguyên; không chọn loại ngày ⇒ trống;
 * "Đợt liền trước" ⇒ Ngày TT của đợt ngay trên + thời hạn (đợt trên trống / là đợt đầu ⇒ trống);
 * còn lại theo `baseDue` của từng form (hợp đồng: computeDueDate; phiếu tính giá: Ngày tính + thời hạn).
 */
export function scheduleDueDates<T extends PaymentSchedule>(rows: T[], baseDue: (row: T) => string | null): (string | null)[] {
  const out: (string | null)[] = [];
  rows.forEach((r, i) => {
    if (r.ngayTT || r.noDueConfig) {
      out.push(r.ngayTT ?? null);
      return;
    }
    const kind = scheduleBaseKind(r.maLoaiNgay, "");
    if (kind === "none") {
      out.push(null);
      return;
    }
    if (kind === "dot_truoc") {
      const prev = i > 0 ? out[i - 1] : null;
      const unit = r.theoThang ? "month" : "day";
      // Cộng theo ngày lịch của Ngày TT đợt trên (10 ký tự đầu), không đổi qua múi giờ trình duyệt
      out.push(prev ? dayjs(prev.slice(0, 10)).add(Number(r.soNgay) || 0, unit).format("YYYY-MM-DD") + "T00:00:00+07:00" : null);
      return;
    }
    out.push(baseDue(r));
  });
  return out;
}

/** Nhãn ô formData.ngayKy: phiếu cọc = ngày cọc, HĐ / góp vốn = ngày giao dịch */
export function signDateLabel(type: DueDocType): string {
  if (type === "deposit") return "Ngày đặt cọc";
  if (type === "contract" || type === "investment") return "Ngày giao dịch";
  return "Ngày ký";
}

/** Form có ô "Ngày đặt cọc": HĐ mua bán / góp vốn, trừ phụ lục (`_appendix_apply` không ghi ngay_dat_coc) */
export function hasDepositDateField(type: DueDocType, type2?: string | null): boolean {
  return (type === "contract" || type === "investment") && type2 !== "appendix";
}

/** HĐ mua bán / góp vốn bắt buộc Ngày giao dịch (ngayKy) + Ngày đặt cọc; trả thông báo thiếu hoặc null */
export function missingContractDates(
  type: DueDocType,
  d: { ngayKy: Date | null; ngayDatCoc?: Date | null },
  type2?: string | null
): string | null {
  if (!hasDepositDateField(type, type2)) return null;
  if (!d.ngayKy) return "Vui lòng nhập Ngày giao dịch";
  if (!d.ngayDatCoc) return "Vui lòng nhập Ngày đặt cọc";
  return null;
}

/** 1 dòng `LichThanhToan` gửi lên khi lưu phiếu — ngược lại của restoreSavedSchedule. */
export function toSavedScheduleItem(
  row: PaymentSchedule,
  isLowRise: boolean,
  extra: { MaPGC: unknown; MaTH: unknown; NgayTT: string | null }
) {
  const num = (v: unknown) =>
    v === null || v === undefined || v === "" ? null : Number(v);
  return {
    MaPGC: extra.MaPGC,
    MaTH: extra.MaTH,
    DotTT: row.dot,
    DotTTText: row.kieuThanhToan,
    NgayTT: extra.NgayTT,
    TyLeTT: num(row.tyLeTT),
    TuongUng: num(row.soTien),
    TyLeVAT: isLowRise ? 0 : num(row.tyLeVAT),
    ThueVAT: isLowRise ? 0 : num(row.tienVAT),
    TyLePBT: isLowRise ? 0 : num(row.tyLePBT),
    PhiBT: isLowRise ? 0 : num(row.tienBaoTri),
    SoTien: num(row.tongGiaTri),
    TyLePXD: isLowRise ? num(row.tyLeXD) : 0,
    TienXD: isLowRise ? num(row.tienBaoTri) : 0,
    TyLeVATDat: isLowRise ? num(row.tyLeVAT) : 0,
    TienVATDat: isLowRise ? num(row.tienVAT) : 0,
    TienCoc: num(row.tienCoc) ?? 0,
    TyLeVonTuCo: isLowRise ? 0 : num(row.tyLeVonTuCo),
    VonTuCo: isLowRise ? 0 : num(row.vonTuCo),
    TyLeVayNH: isLowRise ? 0 : num(row.tyLeVayNH),
    VayNH: isLowRise ? 0 : num(row.vayNH),
    DienGiai: row.dienGiai ?? row.ghiChu ?? "",
    LoaiTienDo: loaiTienDoKey(row.LoaiTienDo),
  };
}

/* ===================== Khôi phục kết quả từng round CSBH từ payload getByMaPGC ===================== */
export interface RestoredRoundContext {
  giaGoc?: number;
  giaGocGomVAT?: number;
  tyLeVAT?: number;
  tyLePBT?: number;
  dienTichThongThuy?: number;
  donGiaDatPhanBo?: number;
  tienSDDat?: number;
  dienTichXD?: number;
  donGiaXD?: number;
  tongGiaDatGoc?: number;
  tienXDGomVATGoc?: number;
  tongGiaTriHDMBGoc?: number;
  giaNakedGoc?: number;
  /** Tiền VAT / PBT gốc của bảng giá (highRiseGocVatPbt); thiếu thì tính theo % */
  tienVATGoc?: number;
  tienPBTGoc?: number;
}

export function getRestoredRoundResults(
  csArr: any[],
  isLowRise: boolean,
  ctx?: RestoredRoundContext
): any[] {
  const c0 = ctx || {};
  let prevTongChuaVAT = c0.giaGoc ?? 0;
  let prevTongGomVAT = c0.giaGocGomVAT ?? 0;
  let prevTongGiaTriHD = c0.giaGocGomVAT ?? 0;
  let prevGiaDatChuaVAT = c0.giaGoc ?? 0;
  let prevTongGiaDat = c0.tongGiaDatGoc ?? 0;
  let prevTienXDChuaVAT = 0;
  let prevTienXDGomVAT = c0.tienXDGomVATGoc ?? 0;
  let prevTongGiaTriHDMB = c0.tongGiaTriHDMBGoc ?? 0;
  let prevGiaNaked = c0.giaNakedGoc ?? 0;
  let prevTongCK = 0;
  const goc = {
    tienVAT: c0.tienVATGoc ?? (c0.giaGoc ?? 0) * ((c0.tyLeVAT ?? 0) / 100),
    tienPBT: c0.tienPBTGoc ?? (c0.giaGoc ?? 0) * ((c0.tyLePBT ?? 0) / 100),
  };
  let prevPhiBaoTri = goc.tienPBT;
  const highRiseRows: { tongChuaVAT: number; tongCK: number }[] = [];
  // Phiếu lưu từ khi có Mốc tính mang Loai / IsMocTinh; phiếu cũ không có ⇒ mốc 0, biến mốc bằng 0
  // Dòng "Không trừ giá HĐ" (phiếu lưu từ khi có quy tắc bỏ qua) không chiếm số lần, không vào mốc
  const skipSaved = (c: any) => !!c?.IsKhongTruGiaHD;
  const moc = policyMoc((csArr || []).filter((c: any) => !skipSaved(c)).map((c: any) => ({ loai: c?.Loai, mocTinh: !!c?.IsMocTinh })));
  // Lũy kế tỷ lệ theo cờ đã lưu trên chứng từ (phiếu cũ không có ⇒ 0); dòng giữ chỗ coi như dòng tắt
  const luyKeRows = (csArr || []).map((c) => ({
    enabled: !c?.__carry,
    khongTruGiaHD: skipSaved(c),
    mocTinhTyLe: !!c?.IsMocTinhTyLe,
    discountPercent: Number(c?.CKPT ?? c?.TyLeCK ?? c?.PhanTramCK) || 0,
  }));
  const luyKe = luyKeTyLeSeries(luyKeRows);
  // Lũy kế tiền: Tổng CK đã lưu (CKTien) của từng dòng
  const savedCK = (csArr || []).map((c) => Number(c?.CKTien) || 0);

  const seedSourceFor = (idx: number) =>
    idx === 0 ? "Giá gốc (round 1)" : `Kết quả round ${idx}`;
  // Dòng giữ chỗ của alignSavedRows: kết quả bằng dòng liền trước, như dòng tắt khi tính lại
  const carried = () => ({
    TongGiaChuaVAT: prevTongChuaVAT,
    TongGiaGomVAT: prevTongGomVAT,
    VAT: prevTongGomVAT - prevTongChuaVAT,
    PhiBaoTri: prevTongGiaTriHD - prevTongGomVAT,
    TongGiaTriHDMB: isLowRise ? prevTongGiaTriHDMB : prevTongGiaTriHD,
    TongGiaDatChuaVAT: prevGiaDatChuaVAT,
    TienVATDat: prevTongGiaDat - prevGiaDatChuaVAT,
    TongGiaDat: prevTongGiaDat,
    TienXDTruocVAT: prevTienXDChuaVAT,
    VATXD: prevTienXDGomVAT - prevTienXDChuaVAT,
    TienXDCoVAT: prevTienXDGomVAT,
    GiaNaked: c0.giaNakedGoc ? prevGiaNaked : null,
  });

  return csArr.map((raw: any, idx: number) => {
    if (!isLowRise && skipSaved(raw)) return { ...skippedRoundResult(), restoredFromMaPGC: true };
    const c = raw?.__carry ? { ...raw, ...carried() } : raw;
    const tyLeCK = Number(c.CKPT ?? c.TyLeCK ?? c.PhanTramCK) || 0;
    const tienCKTienMat =
      Number(c.TienCKTienMat ?? c.CKTienMat) ||
      Number(c.CKDonGia) ||
      (tyLeCK > 0 ? 0 : Number(c.CKTien) || 0);
    const heSo = Number(c.HeSo) || 1;
    const seedSrc = seedSourceFor(idx);

    if (isLowRise) {
      const giaDatChuaVAT =
        Number(c.TongGiaDatChuaVAT ?? c.GiaDatChuaVAT) || 0;
      const vatDat = Number(c.TienVATDat ?? c.VATDat) || 0;
      const tongGiaDat =
        Number(c.TongGiaDat ?? c.TongGiaGomDatVAT) || giaDatChuaVAT + vatDat;
      const tienXDChuaVAT =
        Number(c.TienXDTruocVAT ?? c.TienXDChuaVAT ?? c.TongXDChuaVAT) || 0;
      const vatXD = Number(c.VATXD) || 0;
      const tienXDGomVAT =
        Number(c.TienXDCoVAT ?? c.TienXDGomVAT ?? c.TongXDVAT) ||
        tienXDChuaVAT + vatXD;
      const tongGiaTriHDMB =
        Number(c.TongGiaTriHDMB) || tongGiaDat + tienXDGomVAT;
      const tongCK = Number(c.CKTien) || 0;

      const formulaVars: Record<string, number> = {
        GiaDatKoVAT: c0.giaGoc ?? giaDatChuaVAT,
        TienSDDat: c0.tienSDDat ?? 0,
        DienTichXD: c0.dienTichXD ?? 0,
        DonGiaXD: c0.donGiaXD ?? 0,
        TyLeCK: tyLeCK,
        TienCKTienMat: tienCKTienMat,
        HeSo: heSo,
        TyLeVAT: c0.tyLeVAT ?? 0,
        TyLeVATXayDung: c0.tyLeVAT ?? 0,
        GiaDatChuaVAT_Prev: prevGiaDatChuaVAT,
        TongGiaDat_Prev: prevTongGiaDat,
        TienXDChuaVAT_Prev: prevTienXDChuaVAT,
        TienXDGomVAT_Prev: prevTienXDGomVAT,
        TongGiaTriHDMB_Prev: prevTongGiaTriHDMB,
        TongCK: tongCK,
        GiaDatChuaVAT: giaDatChuaVAT,
        VATDat: vatDat,
        TongGiaDat: tongGiaDat,
        TienXDChuaVAT: tienXDChuaVAT,
        VATXD: vatXD,
        TienXDGomVAT: tienXDGomVAT,
        TongGiaTriHDMB: tongGiaTriHDMB,
      };
      const varSources: Record<string, string> = {
        GiaDatChuaVAT_Prev: seedSrc,
        TongGiaDat_Prev: seedSrc,
        TienXDChuaVAT_Prev: seedSrc,
        TienXDGomVAT_Prev: seedSrc,
        TongGiaTriHDMB_Prev: seedSrc,
        TyLeCK: `Cấu hình CSBH lần ${idx + 1} (API CKPT)`,
        TienCKTienMat: `CK Tiền nhập tay - lần ${idx + 1}`,
        HeSo: `Cấu hình CSBH lần ${idx + 1}`,
        TyLeVAT: "Form: % VAT",
        TongCK: `API: chinhSach[${idx}].CKTien`,
        GiaDatChuaVAT: `API: chinhSach[${idx}].TongGiaDatChuaVAT`,
        VATDat: `API: chinhSach[${idx}].TienVATDat`,
        TongGiaDat: `API: chinhSach[${idx}].TongGiaDat`,
        TienXDChuaVAT: `API: chinhSach[${idx}].TienXDTruocVAT`,
        VATXD: `API: chinhSach[${idx}].VATXD`,
        TienXDGomVAT: `API: chinhSach[${idx}].TienXDCoVAT`,
        TongGiaTriHDMB: `API: chinhSach[${idx}].TongGiaTriHDMB`,
      };

      prevGiaDatChuaVAT = giaDatChuaVAT;
      prevTongGiaDat = tongGiaDat;
      prevTienXDChuaVAT = tienXDChuaVAT;
      prevTienXDGomVAT = tienXDGomVAT;
      prevTongGiaTriHDMB = tongGiaTriHDMB;

      return {
        tongCK,
        giaDatChuaVAT,
        vatDat,
        tongGiaDat,
        tienXDChuaVAT,
        vatXD,
        tienXDGomVAT,
        tongGiaTriHDMB,
        tienCK: tongCK,
        vars: formulaVars,
        varSources,
        restoredFromMaPGC: true,
      };
    }

    // High-rise
    const tongChuaVAT = Number(c.TongGiaChuaVAT) || 0;
    const tongGomVAT = Number(c.TongGiaGomVAT) || 0;
    const vat = Number(c.VAT) || 0;
    const phiBaoTri = Number(c.PhiBaoTri) || 0;
    const tongGiaTriHD =
      Number(c.TongGiaTriHDMB) || Number(c.SoTien) || tongGomVAT + phiBaoTri;
    const tongCK = Number(c.CKTien) || 0;
    const giaNaked = parseNaked(c.GiaNaked);

    const formulaVars: Record<string, number> = {
      GiaGoc: c0.giaGoc ?? 0,
      GiaGocGomVAT: c0.giaGocGomVAT ?? 0,
      GiaTruocCK: prevTongChuaVAT,
      TyLeCK: tyLeCK,
      TienCKTienMat: tienCKTienMat,
      HeSo: heSo,
      TyLeVAT: c0.tyLeVAT ?? 0,
      TyLePBT: c0.tyLePBT ?? 0,
      DienTichThongThuy: c0.dienTichThongThuy ?? 0,
      DGDatPB: c0.donGiaDatPhanBo ?? 0,
      TongChuaVAT_Prev: prevTongChuaVAT,
      TongGomVAT_Prev: prevTongGomVAT,
      TongGiaTriHD_Prev: prevTongGiaTriHD,
      TongCK: tongCK,
      TongChuaVAT: tongChuaVAT,
      VAT: vat,
      TongGomVAT: tongGomVAT,
      PhiBaoTri: phiBaoTri,
      TongGiaTriHD: tongGiaTriHD,
      TienCK: tongCK,
      ...highRiseBaseVars(c0.giaGoc ?? 0, c0.tyLeVAT ?? 0, c0.tyLePBT ?? 0, prevTongCK, goc),
      ...gomVatPbtVars(c0.giaGocGomVAT ?? 0, goc.tienPBT, prevTongGomVAT, prevPhiBaoTri),
      TongGomVATPBT: tongGomVAT + phiBaoTri,
      ...mocRoundVar(highRiseRows, moc),
      LuyKeCKTyLe: luyKe[idx] ?? 0,
      LuyKeTienCKTyLe: luyKeTienTyLeAt(luyKeRows, savedCK, idx),
      ...roundRefVars(highRiseRows),
      ...(giaNaked === null
        ? {}
        : {
            ...nakedRoundVars(c0.giaNakedGoc ?? 0, prevGiaNaked),
            GiaNaked: giaNaked,
          }),
    };

    const varSources: Record<string, string> = {
      GiaGoc: "Giá gốc chưa VAT (API GiaTriHopDong / bảng giá)",
      GiaGocGomVAT: "Giá gốc gồm VAT (API GiaTriHopDong / bảng giá)",
      GiaTruocCK: `Tổng chưa VAT trước CK (${seedSrc})`,
      TongChuaVAT_Prev: seedSrc,
      TongGomVAT_Prev: seedSrc,
      TongGiaTriHD_Prev: seedSrc,
      TyLeCK: `Cấu hình CSBH lần ${idx + 1}`,
      TienCKTienMat: `CK Tiền nhập tay - lần ${idx + 1}`,
      HeSo: `Cấu hình CSBH lần ${idx + 1}`,
      TyLeVAT: "Form: % VAT",
      TyLePBT: "Form: % Phí bảo trì",
      DienTichThongThuy: "Form: DT thông thủy",
      DGDatPB: "Form: ĐG đất phân bổ",
      TongCK: `API: chinhSach[${idx}].CKTien`,
      TongChuaVAT: `API: chinhSach[${idx}].TongGiaChuaVAT`,
      VAT: `API: chinhSach[${idx}].VAT`,
      TongGomVAT: `API: chinhSach[${idx}].TongGiaGomVAT`,
      PhiBaoTri: `API: chinhSach[${idx}].PhiBaoTri`,
      TongGiaTriHD: `API: chinhSach[${idx}].TongGiaTriHDMB`,
      GiaNakedGoc: "Giá Naked gốc của căn",
      GiaNaked_Prev: seedSrc,
      GiaNaked: `API: chinhSach[${idx}].GiaNaked`,
      ...HIGH_RISE_BASE_VAR_SOURCES,
      ...GOM_VAT_PBT_VAR_SOURCES,
      ...roundRefSources(idx),
    };

    highRiseRows.push({ tongChuaVAT, tongCK });
    prevTongChuaVAT = tongChuaVAT;
    prevTongGomVAT = tongGomVAT;
    prevTongGiaTriHD = tongGiaTriHD;
    prevPhiBaoTri = phiBaoTri;
    if (giaNaked !== null) prevGiaNaked = giaNaked;
    if (!raw?.__carry) prevTongCK = tongCK;

    return {
      tongCK,
      tongChuaVAT,
      vat,
      tongGomVAT,
      phiBaoTri,
      tongGiaTriHD,
      giaNaked,
      tienCK: tongCK,
      vars: formulaVars,
      varSources,
      restoredFromMaPGC: true,
    };
  });
}

/* ===================== Load rounds + formula details từ Cấu hình tính giá ===================== */
export interface LoadRoundsDeps {
  /** ProjectService.CauHinh.getDetailById */
  getDetailById: (id: any) => Promise<any>;
  /** ProjectService.CauHinh.getDetailByIdByDetail */
  getDetailByIdByDetail: (id: any) => Promise<any>;
}

export async function loadRoundsFromCauHinh(
  configId: any,
  isLow: boolean,
  deps: LoadRoundsDeps,
  getDefaultRounds: (type: "high" | "low") => PolicyDiscountRound[]
): Promise<PolicyDiscountRound[]> {
  if (!configId) return getDefaultRounds(isLow ? "low" : "high");
  const roundsRes = await deps.getDetailById(configId);
  const rounds = roundsRes?.data ?? [];
  if (!rounds.length) return getDefaultRounds(isLow ? "low" : "high");
  const built: PolicyDiscountRound[] = [];
  for (let i = 0; i < rounds.length; i++) {
    const r = rounds[i];
    // listRounds (theo cau_hinh_id) đã trả kèm chi tiết trong cột details —
    // chỉ gọi lại theo từng id khi dữ liệu chi tiết bị thiếu (dữ liệu cũ).
    let details: any[] = Array.isArray(r?.Details) ? r.Details : [];
    if (!details.length && r?.ID) {
      try {
        const detRes = await deps.getDetailByIdByDetail(r?.ID);
        if (detRes?.status === 2000) details = detRes?.details ?? [];
      } catch (err) {
        console.error("Lỗi tải chi tiết cấu hình tính giá:", err);
      }
    }
    built.push({
      key: String(r?.ID ?? `ck${i + 1}`),
      name: r?.Name || `Chiết khấu ${i + 1}`,
      description: r?.Description || "",
      discountPercent: r?.DefaultPercent ?? 0,
      tienCK: 0,
      heSo: 1,
      enabled: true,
      formulas: mapApiDetailsToFormulas(details, isLow, i === 0),
      // Mốc tính chỉ áp cho cao tầng: thấp tầng không có loại vòng ⇒ ghép theo vị trí
      ...(isLow ? {} : { loaiCK: r?.LoaiCK }),
    });
  }
  return built;
}

/* ===================== Ghép chi tiết chính sách & công thức cấu hình tính giá ===================== */
/**
 * Dựng bảng chiết khấu theo chi tiết chính sách: số dòng = số dòng chi tiết
 * (3 dòng ⇒ 3, 4 dòng ⇒ 4); công thức lấy theo vị trí từ cấu hình tính giá,
 * dòng dư dùng lại khung công thức của vòng cuối.
 */
export function buildRoundsFromPolicyDetails(
  details: any[],
  template: PolicyDiscountRound[],
  ctx?: OptionCtx
): PolicyDiscountRound[] {
  const pick = mocTemplatePicker(
    details.map((d) => ({ loai: d?.Loai, mocTinh: !!d?.IsMocTinh, khongTruGiaHD: !!d?.IsKhongTruGiaHD })),
    template
  );
  // R-2d: mức phải phân bổ ("Áp dụng phân bổ CTBH" / "Không cần phân bổ CTBH") lấy theo chính sách đang dựng (bối cảnh của form có thể còn là chính sách trước)
  const c = withAllocationRequired(ctx, details);
  return details.map((d, idx) => {
    const base = pick(idx);
    return {
      ...base,
      name: d?.TenChietKhau || base.name,
      ...policyRoundFields(d, c),
    };
  });
}

/**
 * Áp công thức của cấu hình tính giá lên các dòng đang có: tên / CK% / hệ số /
 * tiền CK là dữ liệu chính (chính sách hoặc phiếu đã lưu) nên được giữ lại.
 * detailCount = 0 (chưa có chi tiết chính sách) ⇒ hiển thị đủ vòng của cấu hình.
 */
export function mergeConfigRounds(
  prev: PolicyDiscountRound[],
  built: PolicyDiscountRound[],
  detailCount: number
): PolicyDiscountRound[] {
  // Cấu hình không khai báo vòng nào ⇒ không xoá số liệu đang hiển thị
  if (!built.length) return prev;
  const rowCount = detailCount > 0 ? detailCount : built.length;
  // Dòng đang có mang loại / mốc (từ chính sách hoặc phiếu đã lưu) ⇒ ghép công thức theo mốc
  const pick = mocTemplatePicker(Array.from({ length: rowCount }, (_, i) => prev[i]), built);
  return Array.from({ length: rowCount }, (_, idx) => {
    const round = pick(idx);
    const old: any = prev[idx];
    if (!old) return round;
    return {
      ...round,
      name: old.name || round.name,
      discountPercent: old.discountPercent ?? round.discountPercent,
      heSo: old.heSo ?? round.heSo,
      tienCK: old.tienCK ?? round.tienCK,
      enabled: old.enabled ?? round.enabled,
      ...(old.maCK != null ? { maCK: old.maCK } : {}),
      ...(old.maKTT != null ? { maKTT: old.maKTT } : {}),
      ...(old.luaChon != null ? { luaChon: old.luaChon } : {}),
      ...(old.luaChonDaChon != null ? { luaChonDaChon: old.luaChonDaChon } : {}),
      ...(old.loai != null ? { loai: old.loai } : {}),
      ...(old.mocTinh ? { mocTinh: true } : {}),
      ...(old.khongTruGiaHD ? { khongTruGiaHD: true } : {}),
      ...(old.mocTinhTyLe ? { mocTinhTyLe: true } : {}),
    };
  });
}

/**
 * Cập nhật tên và các mức tùy chọn của dòng bảng theo chi tiết chính sách (tải xong
 * sau khi đã restore). Dò theo mã; maCK trống/số kiểu cũ dò theo vị trí và chỉ lấy
 * tên, không điền mức. Mã ID không còn trong danh sách ⇒ giữ nguyên dòng.
 * Không đổi gì ⇒ trả lại đúng `prev`.
 */
export function refreshRoundsFromDetails<T extends PolicyDiscountRound>(prev: T[], details: any[]): T[] {
  let changed = false;
  const next = prev.map((round, idx) => {
    const det = findDetailForRound(details, round, idx);
    if (!det) return round;
    const name = det.TenChietKhau || det.TenCK;
    const legacy = isLegacyCode(round.maCK);
    const luaChon = legacy ? round.luaChon : det.LuaChon;
    const nameChanged = !!name && name !== round.name;
    const optsChanged = !legacy && luaChon !== round.luaChon && (luaChon != null || round.luaChon != null);
    // Phiếu lưu trước khi có Mốc tính không có loại dòng: lấy theo chính sách để tick mức % ra đúng CK %
    const loai = !legacy && round.loai == null && det.Loai ? det.Loai : undefined;
    if (!nameChanged && !optsChanged && !loai) return round;
    changed = true;
    return {
      ...round,
      ...(nameChanged ? { name } : {}),
      ...(optsChanged ? { luaChon } : {}),
      ...(loai ? { loai } : {}),
    };
  });
  return changed ? next : prev;
}

/**
 * Dòng mới khi bấm "Thêm chiết khấu": lấy tên, CK, mã, mức từ dòng chi tiết chính sách
 * kế tiếp (nếu có), khung công thức theo cấu hình tính giá, thiếu thì dùng `fallbackFormulas`.
 */
export function buildAddedRound(
  detail: any,
  tpl: PolicyDiscountRound | undefined,
  index: number,
  fallbackFormulas: RoundFormulas = DEFAULT_NEXT_FORMULAS,
  ctx?: OptionCtx
): PolicyDiscountRound {
  const base = tpl ? { ...tpl } : ({ formulas: { ...fallbackFormulas } } as PolicyDiscountRound);
  const d = detail;
  return {
    ...base,
    key: `ck_${Date.now()}`,
    name:
      (d && (d.TenChietKhau || d.TenCK || d.TenChinhSach)) ||
      (tpl?.name as string) ||
      `CK${index + 1}`,
    description: tpl?.description || "",
    ...(d
      ? { ...policyRoundFields(d, ctx), maCK: d.MaCK || undefined }
      : { discountPercent: 0, tienCK: 0, heSo: 1, enabled: true, luaChon: undefined, luaChonDaChon: [] }),
  };
}

/**
 * Dòng đang bật kèm kết quả của chính nó. `results` đủ số dòng (cả dòng tắt), nên phải ghép
 * theo vị trí trước khi lọc; lọc rồi mới lấy theo chỉ số thì mọi dòng sau dòng tắt lệch số tiền.
 */
export function enabledRoundsWithResults<T extends { enabled?: boolean }>(
  rounds: T[],
  results: any[] | undefined
): { round: T; result: any }[] {
  return (rounds || [])
    .map((round, idx) => ({ round, result: results?.[idx] }))
    .filter(({ round }) => round?.enabled !== false);
}

const hasSavedPicks = (c: any) => c?.MaCK != null && (c?.LuaChonDaChon?.length ?? 0) > 0;

/**
 * Áp lại các mức đã tick của một phiếu lên bảng đã dựng, dò theo MaCK. Dòng có mức theo
 * phiếu; dòng đang tick mà phiếu không tick thì bỏ tick (tiền về 0); dòng khác giữ nguyên.
 */
export function applySavedPicks<T extends PolicyDiscountRound>(rounds: T[], savedRows: any[]): T[] {
  const picksByCode = new Map<string, PickedOption[]>();
  (savedRows || []).filter(hasSavedPicks).forEach((c) => picksByCode.set(String(c.MaCK), c.LuaChonDaChon));
  let changed = false;
  const next = rounds.map((round) => {
    const picks = round.maCK != null ? picksByCode.get(String(round.maCK)) : undefined;
    if (picks) {
      changed = true;
      return { ...applyPicked(round, picks), enabled: true };
    }
    if ((round.luaChonDaChon?.length ?? 0) === 0) return round;
    changed = true;
    return applyPicked(round, []);
  });
  return changed ? next : rounds;
}

/** Dòng phiếu có tick nhưng bảng không có dòng cùng mã (chính sách đã đổi): số tiền không áp được */
export const savedPicksWithoutRow = (rounds: PolicyDiscountRound[], savedRows: any[]): any[] =>
  (savedRows || []).filter(
    (c) => hasSavedPicks(c) && !rounds.some((r) => r.maCK != null && String(r.maCK) === String(c.MaCK))
  );

/** Dòng bảng lúc lưu có vào ChinhSach không: lọc lại trên snapshot */
const snapshotRowWasSaved = (s: any) =>
  shouldSaveRound({
    enabled: s?.enabled !== false,
    tienCK: s?.tienCK,
    discountPercent: s?.discountPercent,
    luaChonDaChon: s?.luaChonDaChon,
  });

/**
 * ChinhSach chỉ có dòng được lưu, snapshot có đủ dòng bảng (cả dòng tắt, dòng 0). Căn về đúng
 * số dòng và vị trí của snapshot để số liệu, tick và công thức không lệch dòng: khớp theo mã,
 * còn lại lọc lại theo điều kiện lưu và lấy lần lượt; dòng không được lưu thành dòng giữ chỗ
 * (`__carry`). Hai bên không khớp nhau thì trả null: dùng ChinhSach, bỏ qua snapshot.
 */
export function alignSavedRows(savedRows: any[], snapRounds: any[]): any[] | null {
  const rest = [...savedRows];
  const byCode = snapRounds.map((s) => {
    if (s?.maCK == null || s.maCK === "") return undefined;
    const at = rest.findIndex((c) => String(c?.MaCK) === String(s.maCK));
    return at < 0 ? undefined : rest.splice(at, 1)[0];
  });
  let lost = false;
  const aligned = snapRounds.map((s, idx) => {
    if (byCode[idx]) return byCode[idx];
    if (snapshotRowWasSaved(s)) {
      const next = rest.shift();
      if (!next) lost = true;
      return next;
    }
    return {
      __carry: true,
      MaCK: s?.maCK ?? null,
      MaKTT: s?.maKTT ?? null,
      TenChietKhau: s?.name ?? null,
      CKDonGia: Number(s?.tienCK) || null,
      CKPT: Number(s?.discountPercent) || null,
      CKTien: null,
      HeSo: s?.heSo ?? null,
      LuaChonDaChon: s?.luaChonDaChon,
      // Dòng "Không trừ giá HĐ" CK 0 không được lưu vào ChinhSach: giữ cờ để khôi phục vẫn bỏ qua dòng này
      ...(s?.khongTruGiaHD ? { IsKhongTruGiaHD: true } : {}),
      ...(s?.mocTinhTyLe ? { IsMocTinhTyLe: true } : {}),
    };
  });
  return lost || rest.length ? null : aligned;
}

/**
 * Giữ nguyên số liệu CK đã khôi phục của TỪNG dòng trước khi chuyển sang tính lại,
 * chỉ dòng người dùng thao tác mới thay đổi. `snap` phải cùng vị trí với `rounds`.
 */
export function applySavedFigures<T extends PolicyDiscountRound>(rounds: T[], snap: any[]): T[] {
  return rounds.map((r, i) => {
    const c: any = snap[i];
    if (!c) return r;
    return {
      ...r,
      discountPercent: Number(c.CKPT) || r.discountPercent || 0,
      heSo: Number(c.HeSo) || r.heSo || 1,
      tienCK: Math.round(Number(c.CKDonGia) || 0),
    };
  });
}

/** Trường khôi phục từ dòng ChinhSach đã lưu: mã chiết khấu và các mức đã chọn (phiếu cũ ⇒ []) */
export function restoredRoundExtras(saved: any): {
  maCK: unknown;
  luaChonDaChon: PickedOption[];
  loai?: string;
  mocTinh?: boolean;
  khongTruGiaHD?: boolean;
  mocTinhTyLe?: boolean;
} {
  // Loại / mốc / không trừ giá HĐ chỉ có ở phiếu lưu sau khi có Mốc tính; thiếu thì không ghi đè dòng
  return {
    maCK: saved?.MaCK ?? null,
    luaChonDaChon: Array.isArray(saved?.LuaChonDaChon) ? saved.LuaChonDaChon : [],
    ...(saved?.Loai ? { loai: saved.Loai } : {}),
    ...(saved?.IsMocTinh ? { mocTinh: true } : {}),
    ...(saved?.IsKhongTruGiaHD ? { khongTruGiaHD: true } : {}),
    ...(saved?.IsMocTinhTyLe ? { mocTinhTyLe: true } : {}),
  };
}

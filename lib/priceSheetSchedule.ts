/**
 * Lịch thanh toán của phiếu tính giá – bản app của:
 *  - beeland/src/components/Products/ContractForm/helpers.ts (getPaymentFormulaVars, calculatePaymentScheduleRow,
 *    recalcPaymentScheduleSequential, balanceScheduleRounding)
 *  - PriceSheetForm.handleTemplateSelect (dựng dòng từ mẫu tiến độ da_payment_schedules.details)
 *  - PriceSheetForm.handleSave (NgayTT = ngày ký + số ngày/tháng của đợt)
 * Test so trực tiếp với helpers.ts của web: tests/price-sheet-schedule.test.cjs.
 */
import { evaluateRoundFormula } from "./priceSheetFormulas";

export interface ScheduleRow {
  id: number;
  dot: number;
  kieuThanhToan: string;
  tuongUngFormula: string;
  tienVATFormula: string;
  phiBaoTriFormula: string;
  tongCongFormula: string;
  tyLeTT: number;
  soTien: number;
  tyLeVAT: number;
  tienVAT: number;
  tyLeVATDat?: number;
  tienVATDat?: number;
  tyLePBT: number;
  tyLeXD: number;
  hasPBT?: boolean;
  tienBaoTri: number;
  tienXD?: number;
  tongGiaTri: number;
  soNgay: number;
  /** 1 = ngày, 2 = tháng */
  maLoaiNgay: number;
  ngayTT?: string | null;
  dienGiai?: string;
  ghiChu?: string;
  edited?: boolean;
  restoredFromMaPGC?: boolean;
  maTH?: any;
}

export interface ScheduleCtx {
  calculations: Record<string, any>;
  rawTongGiaChuaVAT?: number | null;
}

type Sums = { tuongUng?: number; vat?: number; pbt?: number; tongCong?: number };

export function getPaymentFormulaVars(
  ctx: ScheduleCtx,
  tyLeTT: number,
  tyLeVAT: number,
  tyLePBT: number,
  soTien?: number,
  tienVAT?: number,
  tienBaoTri?: number,
  prevSums?: Sums,
  tyLeXD?: number
): Record<string, number> {
  const c: any = ctx.calculations || {};
  const tongGiaTriHDB = c.tongGiaTriHD || c.tongGiaTriHDMB || c.tongGomVAT || c.giaTriSauCK || c.tongChuaVAT || 0;
  const tongChuaVATSauCSBH = c.giaTriSauCK || c.tongChuaVAT || Number(ctx.rawTongGiaChuaVAT) || 0;
  const tongVAT = c.tienVAT || 0;
  const phiBaoTri = c.phiBaoTri || 0;
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
    TongGiaDaVAT: c.tongGomVAT || 0,
    TongGomVAT: c.tongGomVAT || 0,
    TongGiaGomVAT: c.tongGomVAT || 0,
    TongGiaTriHD: tongGiaTriHDB,
    TongGiaTriHDB: tongGiaTriHDB,
    TongTienVAT: tongVAT,
    TienVAT: tongVAT,
    PhiBaoTri: phiBaoTri,
    TongPhiBaoTri: phiBaoTri,
    GiaDatGomVAT: c.tongTienDatVAT || 0,
    GiaDatChuaVAT: c.tienDatChuaVAT || 0,
    VATDat: c.tienVATDat || 0,
    ThanhTienXDVAT: c.tongGiaXDVAT || 0,
    TienXDChuaVAT: c.thanhTienXDSauCK || 0,
    VATXD: c.tienVATXD || 0,
    GiaTriHDMB: c.tongGiaTriHDMB || 0,
    LanNay_TuongUng:
      soTien !== undefined
        ? soTien
        : c.tongGiaTriHD || c.tongGiaTriHDMB || c.tongGomVAT || c.giaTriSauCK || c.tongChuaVAT || 0,
    LanNay_VAT: tienVAT !== undefined ? tienVAT : tongVAT,
    LanNay_PBT: tienBaoTri !== undefined ? tienBaoTri : phiBaoTri,
    LanNay_GiaDatGomVAT: soTien !== undefined ? soTien : (c.tongTienDatVAT || 0) * (tyLeTT / 100),
    LanNay_GiaDatChuaVAT:
      soTien !== undefined ? soTien / (1 + (tyLeVAT / 100 || 0)) : (c.tienDatChuaVAT || 0) * (tyLeTT / 100),
    LanNay_VATDat:
      soTien !== undefined
        ? soTien - soTien / (1 + (tyLeVAT / 100 || 1))
        : (c.tienVATDat || 0) * (tyLeTT / 100),
    LanNay_ThanhTienXDVAT: tienBaoTri ?? 0,
    LanNay_TienXDChuaVAT: (tienBaoTri ?? 0) / (1 + (tyLeVAT / 100 || 1)),
    LanNay_VATXD: (tienBaoTri ?? 0) - (tienBaoTri ?? 0) / (1 + (tyLeVAT / 100 || 1)),
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
    PrevThanhTienXDVAT: prevSums?.pbt ?? 0,
    PrevXD: prevSums?.pbt ?? 0,
    PrevTienXD: prevSums?.pbt ?? 0,
    PrevHDMB: prevSums?.tongCong ?? 0,
    PrevGiaDatGomVAT: prevSums?.tuongUng ?? 0,
    PrevGiaDatChuaVAT: (prevSums?.tuongUng ?? 0) - (prevSums?.vat ?? 0),
    PrevVATDat: prevSums?.vat ?? 0,
  };
}

export function calculatePaymentScheduleRow(
  row: ScheduleRow,
  ctx: ScheduleCtx,
  prevSums?: Sums,
  forceRecalc = false
): ScheduleRow {
  if (row.restoredFromMaPGC && !row.edited && !forceRecalc) return row;
  const tyLeTT = Number(row.tyLeTT) || 0;
  const tyLeVAT = Number(row.tyLeVAT) || 0;
  const tyLePBT = Number(row.tyLePBT) || 0;
  const tyLeXD = Number(row.tyLeXD) || 0;
  const tuongUngFormula = row.tuongUngFormula != null ? String(row.tuongUngFormula) : "";
  const tienVATFormulaStr = row.tienVATFormula != null ? String(row.tienVATFormula) : "";
  const phiBaoTriFormulaStr = row.phiBaoTriFormula != null ? String(row.phiBaoTriFormula) : "";
  const tongCongFormulaStr = row.tongCongFormula != null ? String(row.tongCongFormula) : "";

  const vars = getPaymentFormulaVars(ctx, tyLeTT, tyLeVAT, tyLePBT, undefined, undefined, undefined, prevSums, tyLeXD);
  const round0 = (v: number) => Math.round(Number(v) || 0);
  const baseTuongUng = Number(vars.TongGiaChuaVAT) || 0;
  const baseVAT = Number(vars.TongTienVAT) || 0;
  const basePBT = Number(vars.TongPhiBaoTri) || 0;

  const soTien = tuongUngFormula
    ? evaluateRoundFormula(tuongUngFormula, vars)
    : round0((baseTuongUng * tyLeTT) / 100);
  const varsAfterTuongUng = getPaymentFormulaVars(ctx, tyLeTT, tyLeVAT, tyLePBT, soTien, undefined, undefined, prevSums, tyLeXD);
  const tienVAT = tienVATFormulaStr
    ? evaluateRoundFormula(tienVATFormulaStr, varsAfterTuongUng)
    : round0(tyLeVAT > 0 ? (soTien * tyLeVAT) / 100 : 0);
  const tienXD = tienVATFormulaStr
    ? evaluateRoundFormula(tienVATFormulaStr, varsAfterTuongUng)
    : round0(tyLeXD > 0 ? (baseVAT * tyLeXD) / 100 : 0);
  const varsAfterVAT = getPaymentFormulaVars(ctx, tyLeTT, tyLeVAT, tyLePBT, soTien, tienVAT, undefined, prevSums, tyLeXD);
  const tienBaoTri = phiBaoTriFormulaStr
    ? evaluateRoundFormula(phiBaoTriFormulaStr, varsAfterVAT)
    : round0((basePBT * (tyLePBT > 0 ? tyLePBT : 0)) / 100);
  const tongGiaTri = tongCongFormulaStr
    ? evaluateRoundFormula(
        tongCongFormulaStr,
        getPaymentFormulaVars(ctx, tyLeTT, tyLeVAT, tyLePBT, soTien, tienVAT, tienBaoTri, prevSums, tyLeXD)
      )
    : soTien + tienVAT + tienBaoTri;

  return { ...row, tyLeTT, tyLeVAT, tyLePBT, tyLeXD, soTien, tienVAT, tienXD, tienBaoTri, tongGiaTri };
}

/** Bù sai số làm tròn vào đợt cuối khi lịch đủ 100% (lệch ≤ max(1000, 1%)) */
function balanceScheduleRounding(rows: ScheduleRow[], ctx: ScheduleCtx): ScheduleRow[] {
  if (!rows.length) return rows;
  const totalRatio = rows.reduce((s, r) => s + (Number(r.tyLeTT) || 0), 0);
  if (Math.abs(totalRatio - 100) > 0.01) return rows;
  const vars = getPaymentFormulaVars(ctx, 100, 0, 0);
  const targets: Record<string, number> = {
    soTien: Number(vars.TongGiaChuaVAT) || 0,
    tienVAT: Number(vars.TongTienVAT) || 0,
    tienBaoTri: Number(vars.TongPhiBaoTri) || 0,
  };
  const lastIdx = rows.length - 1;
  const last: any = { ...rows[lastIdx] };
  if (last.edited || last.restoredFromMaPGC) return rows;
  (["soTien", "tienVAT", "tienBaoTri"] as const).forEach((key) => {
    const target = targets[key];
    if (!target) return;
    const sum = rows.reduce((s, r: any) => s + (Number(r[key]) || 0), 0);
    if (sum === 0 && key !== "soTien") return;
    const diff = Math.round(target - sum);
    if (diff !== 0 && Math.abs(diff) <= Math.max(1000, target * 0.01)) {
      last[key] = (Number(last[key]) || 0) + diff;
    }
  });
  last.tongGiaTri = (Number(last.soTien) || 0) + (Number(last.tienVAT) || 0) + (Number(last.tienBaoTri) || 0);
  const out = rows.slice();
  out[lastIdx] = last;
  return out;
}

export function recalcPaymentScheduleSequential(rows: ScheduleRow[], ctx: ScheduleCtx, forceRecalc = false): ScheduleRow[] {
  const out: ScheduleRow[] = [];
  const running = { tuongUng: 0, vat: 0, pbt: 0, tongCong: 0 };
  for (const r of rows) {
    const calc = calculatePaymentScheduleRow(r, ctx, { ...running }, forceRecalc);
    out.push(calc);
    running.tuongUng += calc.soTien || 0;
    running.vat += calc.tienVAT || 0;
    running.pbt += calc.tienBaoTri || 0;
    running.tongCong += calc.tongGiaTri || 0;
  }
  return balanceScheduleRounding(out, ctx);
}

/**
 * Dòng mẫu tiến độ (da_payment_schedules.details đã chuẩn hoá như DaPaymentScheduleService.normalizeDetails)
 * → dòng lịch chưa tính – PriceSheetForm.handleTemplateSelect. Cao tầng: TienVAT/PhiBaoTri; thấp tầng:
 * VATDat/TienXayDung. Tên đợt lấy `MoTa` như web (chi tiết mẫu không có MoTa ⇒ "Đợt n").
 */
export function scheduleRowsFromTemplate(details: any[], isLowRise: boolean, formTyLeVAT: number): ScheduleRow[] {
  const asFormula = (v: any) => (typeof v === "string" ? v : "");
  return (details || [])
    .slice()
    .sort((a, b) => (a?.DotTT || 0) - (b?.DotTT || 0))
    .map((inst: any, index: number) => {
      const tyLePBT = Number(inst.TyLePBT) || 0;
      return {
        id: index + 1,
        dot: inst.DotTT || index + 1,
        kieuThanhToan: inst.MoTa || `Đợt ${inst.DotTT || index + 1}`,
        tuongUngFormula: asFormula(inst.TuongUng),
        tienVATFormula: asFormula(isLowRise ? inst.VATDat : inst.TienVAT),
        phiBaoTriFormula: asFormula(isLowRise ? inst.TienXayDung : inst.PhiBaoTri),
        tongCongFormula: asFormula(inst.TongCong),
        tyLeTT: Number(inst.TyLeTT) || 0,
        soTien: 0,
        tyLeVAT: Number(inst.TyLeVAT ?? formTyLeVAT ?? 10) || 0,
        tienVAT: 0,
        tyLeVATDat: Number(inst.TyLeVATDat) || 0,
        tienVATDat: 0,
        tyLePBT,
        tyLeXD: Number(inst.TyLeXD ?? inst.TyLeXayDung ?? 0) || 0,
        hasPBT: tyLePBT > 0,
        tienBaoTri: 0,
        tienXD: 0,
        tongGiaTri: 0,
        soNgay: Number(inst.SoNgay) || 0,
        maLoaiNgay: Number(inst.MaLoai) || 1,
      };
    });
}

const pad = (v: number) => String(v).padStart(2, "0");

/** Cộng ngày / tháng như dayjs().add (tháng: ngày vượt cuối tháng → ngày cuối tháng) */
export function addDaysOrMonths(date: Date, amount: number, unit: "day" | "month"): Date {
  const d = new Date(date.getTime());
  if (unit === "day") {
    d.setDate(d.getDate() + amount);
    return d;
  }
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + amount);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

/** NgayTT lưu phiếu: có sẵn thì giữ, không thì ngày ký + soNgay (MaLoai 2 = tháng) – "YYYY-MM-DDT00:00:00+07:00" */
export function dueDateFor(row: ScheduleRow, ngayKy: Date | null): string | null {
  if (row.ngayTT) return row.ngayTT;
  if (!ngayKy) return null;
  const unit = Number(row.maLoaiNgay) === 2 ? "month" : "day";
  const d = addDaysOrMonths(ngayKy, Number(row.soNgay) || 0, unit);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00:00+07:00`;
}

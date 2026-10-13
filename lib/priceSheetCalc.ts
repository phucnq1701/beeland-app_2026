/**
 * Tính giá sau chính sách bán hàng (các vòng chiết khấu nối tiếp) – bản thuần của `calculations`
 * trong beeland/src/components/PriceSheet/PriceSheetForm.tsx (useMemo, ~dòng 764–1438).
 * Giữ đúng thứ tự tính, biến công thức, fallback và số pass của web. Khác web:
 *  - không có nhánh "khôi phục số liệu đã lưu" (restoredChinhSachSnapshot) – app luôn tính lại;
 *  - cảnh báo fallback trả qua `warnings` thay vì toast.
 */
import {
  DEFAULT_EVAL_ORDER,
  LOW_EVAL_ORDER,
  evaluateRoundFormula,
  type FormulaFieldKey,
  type PolicyDiscountRound,
} from "./priceSheetFormulas";

/** Các trường của form web mà phép tính đọc (tên giữ nguyên formData của web) */
export interface PriceForm {
  isLowRise: boolean;
  /** % (vd 10) */
  tyLeVAT: number;
  /** % (vd 2) */
  tyLePBT: number;
  tienCoc: number;
  dienTichThongThuy: number;
  donGiaSuDungDat: number;
  donGiaDatPhanBo: number;
  dienTichDat: number;
  donGiaDat: number;
  dienTichXD: number;
  tongDTSanXD: number;
  donGiaXD: number;
  rawTongGiaChuaVAT?: number | null;
  rawTongGiaDaVAT?: number | null;
  rawTienVAT?: number | null;
  rawTienPhiBaoTri?: number | null;
  rawTongGomPBT?: number | null;
  rawTongGiaTriHDMB?: number | null;
  rawTienDatChuaVAT?: number | null;
  rawTienVATDat?: number | null;
  rawTongTienDatVAT?: number | null;
  rawTienSDDat?: number | null;
  rawThanhTienXD?: number | null;
  rawTienVATXD?: number | null;
  rawTongGiaXDVAT?: number | null;
}

export interface PriceCalc {
  tongChuaVAT: number;
  tienChietKhau: number;
  giaTriSauCK: number;
  tienVAT: number;
  tongGomVAT: number;
  phiBaoTri: number;
  tongGiaTriHD: number;
  tongGiaTriHDMB: number;
  conPhaiThanhToan: number;
  totalDiscountPercent: number;
  roundResults: any[];
  thanhTienDat: number;
  donGiaDatPhanBo?: number;
  tienDatChuaVAT?: number;
  tienVATDat?: number;
  tongTienDatVAT?: number;
  thanhTienXD: number;
  thanhTienXDSauCK: number;
  tienVATXD: number;
  tongGiaXDVAT: number;
  baseTienVAT?: number;
  baseGomVAT?: number;
  basePhiBaoTri?: number;
  baseTongGiaTriHD?: number;
  /** Vòng có công thức trả 0 phải dùng công thức dự phòng (web hiện toast cảnh báo) */
  warnings: string[];
}

const n = (v: any) => Number(v) || 0;

export function computePriceSheet(form: PriceForm, policyRounds: PolicyDiscountRound[]): PriceCalc {
  const fd = form;
  const isLowRise = !!fd.isLowRise;
  const tyLeVAT = n(fd.tyLeVAT) / 100;
  const tyLePBT = n(fd.tyLePBT) / 100;
  const tienCoc = n(fd.tienCoc);
  const warnings: string[] = [];

  // Chưa chọn chính sách (không vòng nào bật) ⇒ giá sau CSBH = giá sản phẩm
  if (!policyRounds || policyRounds.length === 0 || !policyRounds.some((r) => r.enabled)) {
    const rawTongChuaVAT = n(fd.rawTongGiaChuaVAT);
    const rawTongGomVAT = n(fd.rawTongGiaDaVAT);
    const rawTienVATRaw =
      n(fd.rawTienVAT) || (rawTongGomVAT && rawTongChuaVAT ? rawTongGomVAT - rawTongChuaVAT : 0);
    const rawPhiBaoTri = n(fd.rawTienPhiBaoTri) || n(fd.rawTongGomPBT) - rawTongGomVAT || 0;
    const rawTongGiaTri = n(fd.rawTongGomPBT) || n(fd.rawTongGiaTriHDMB) || rawTongGomVAT + rawPhiBaoTri;

    if (isLowRise) {
      const rawTienDatChuaVAT = n(fd.rawTienDatChuaVAT);
      const rawTienVATDat = n(fd.rawTienVATDat);
      const rawTongTienDatVAT = n(fd.rawTongTienDatVAT);
      const rawThanhTienXD = n(fd.rawThanhTienXD);
      const rawTienVATXD = n(fd.rawTienVATXD);
      const rawTongGiaXDVAT = n(fd.rawTongGiaXDVAT);
      const rawTongGiaTriHDMB = n(fd.rawTongGiaTriHDMB) || rawTongTienDatVAT + rawTongGiaXDVAT;
      return {
        thanhTienDat: rawTienDatChuaVAT,
        donGiaDatPhanBo: (fd.dienTichDat || 0) > 0 ? rawTienDatChuaVAT / (fd.dienTichDat || 1) : fd.donGiaDat || 0,
        tienDatChuaVAT: rawTienDatChuaVAT,
        tienVATDat: rawTienVATDat,
        tongTienDatVAT: rawTongTienDatVAT,
        thanhTienXD: rawThanhTienXD,
        thanhTienXDSauCK: rawThanhTienXD,
        tienVATXD: rawTienVATXD,
        tongGiaXDVAT: rawTongGiaXDVAT,
        tongGiaTriHDMB: rawTongGiaTriHDMB,
        conPhaiThanhToan: rawTongGiaTriHDMB - tienCoc,
        totalDiscountPercent: 0,
        tongChuaVAT: rawTongChuaVAT,
        tienChietKhau: 0,
        giaTriSauCK: rawTongChuaVAT,
        tienVAT: rawTienVATRaw,
        tongGomVAT: rawTongGomVAT,
        phiBaoTri: rawPhiBaoTri,
        tongGiaTriHD: rawTongGiaTriHDMB,
        roundResults: [],
        warnings,
      };
    }

    return {
      tongChuaVAT: rawTongChuaVAT,
      tienChietKhau: 0,
      giaTriSauCK: rawTongChuaVAT,
      tienVAT: rawTienVATRaw,
      tongGomVAT: rawTongGomVAT,
      phiBaoTri: rawPhiBaoTri,
      tongGiaTriHD: rawTongGiaTri,
      conPhaiThanhToan: rawTongGiaTri - tienCoc,
      totalDiscountPercent: 0,
      roundResults: [],
      baseTienVAT: rawTienVATRaw,
      baseGomVAT: rawTongGomVAT,
      basePhiBaoTri: rawPhiBaoTri,
      baseTongGiaTriHD: rawTongGiaTri,
      thanhTienDat: 0,
      thanhTienXD: 0,
      thanhTienXDSauCK: 0,
      tienVATXD: 0,
      tongGiaXDVAT: 0,
      tongGiaTriHDMB: rawTongGiaTri,
      warnings,
    };
  }

  if (isLowRise) {
    const dienTichDat = fd.dienTichDat || 0;
    const donGiaDat = fd.donGiaDat || 0;
    const dienTichXD = fd.tongDTSanXD || fd.dienTichXD || 0;
    const donGiaXD = fd.donGiaXD || 0;
    const tyLeVATXD = fd.tyLeVAT; // web dùng chung % VAT (giữ nguyên dạng %, không chia 100)

    const rawGiaDatKoVAT = n(fd.rawTienDatChuaVAT);
    const rawVATDat = n(fd.rawTienVATDat);
    const rawTongGiaDat = n(fd.rawTongTienDatVAT);
    const rawTienSDDat = n(fd.rawTienSDDat);
    const rawThanhTienXD = n(fd.rawThanhTienXD);
    const rawVATXD = n(fd.rawTienVATXD);
    const rawTongGiaXDVAT = n(fd.rawTongGiaXDVAT);
    const rawTongGiaTriHDMB = n(fd.rawTongGiaTriHDMB);

    const giaDatKoVAT = rawGiaDatKoVAT || dienTichDat * donGiaDat;
    const vatDat = rawVATDat || giaDatKoVAT * tyLeVAT;
    const tienSDDat = rawTienSDDat;
    const thanhTienXD = rawThanhTienXD || dienTichXD * donGiaXD;
    const tongGiaDatGoc = rawTongGiaDat || giaDatKoVAT + vatDat + tienSDDat;
    const tongGiaXDVATGoc = rawTongGiaXDVAT || thanhTienXD * (1 + tyLeVATXD);
    const tongGiaTriHDMBGoc = rawTongGiaTriHDMB || tongGiaDatGoc + tongGiaXDVATGoc;

    let prevGiaDatChuaVAT = giaDatKoVAT;
    let prevVATDat = vatDat;
    let prevTongGiaDat = tongGiaDatGoc;
    let prevTienXDChuaVAT = thanhTienXD;
    let prevTienXDGomVAT = tongGiaXDVATGoc;
    let prevTongGiaTriHDMB = tongGiaTriHDMBGoc;
    let totalCKAmount = 0;
    const roundResults: any[] = [];

    for (const round of policyRounds) {
      if (!round.enabled) {
        roundResults.push({
          tongCK: 0,
          giaDatChuaVAT: giaDatKoVAT,
          vatDat,
          tongGiaDat: prevTongGiaDat,
          tienXDChuaVAT: prevTienXDChuaVAT,
          vatXD: prevTienXDChuaVAT * tyLeVAT,
          tienXDGomVAT: prevTienXDGomVAT,
          tongGiaTriHDMB: prevTongGiaTriHDMB,
          tienCK: 0,
          vars: {},
        });
        continue;
      }

      const vars: Record<string, number> = {
        GiaDatKoVAT: giaDatKoVAT,
        GiaDatChuaVAT: giaDatKoVAT,
        VATDat: vatDat,
        TienSDDat: tienSDDat,
        ThanhTienXD: thanhTienXD,
        DonGiaXD: donGiaXD,
        DonGiaXDVAT: donGiaXD * (1 + tyLeVAT),
        DienTichXD: dienTichXD,
        DienTichDat: dienTichDat,
        DonGiaDat: donGiaDat,
        DonGiaDatVAT: donGiaDat * (1 + tyLeVAT),
        DonGiaSDD: fd.donGiaSuDungDat || 0,
        TyLeVATXayDung: tyLeVATXD,
        TyLeVAT: fd.tyLeVAT,
        TyLePBT: fd.tyLePBT,
        GiaDatChuaVAT_Goc: giaDatKoVAT,
        GiaDatKoVAT_Goc: giaDatKoVAT,
        VATDat_Goc: vatDat,
        TongGiaDat_Goc: tongGiaDatGoc,
        GiaDatVAT_Goc: tongGiaDatGoc,
        TienSDDat_Goc: tienSDDat,
        ThanhTienXD_Goc: thanhTienXD,
        TienXDChuaVAT_Goc: thanhTienXD,
        TongXDChuaVAT_Goc: thanhTienXD,
        VATXD_Goc: rawVATXD || thanhTienXD * tyLeVATXD,
        TienXDGomVAT_Goc: tongGiaXDVATGoc,
        TongXDVAT_Goc: tongGiaXDVATGoc,
        TongGiaTriHDMB_Goc: tongGiaTriHDMBGoc,
        GiaGoc: tongGiaTriHDMBGoc,
        GiaTruocCK: tongGiaTriHDMBGoc,
        TyLeCK: round.discountPercent,
        TienCKTienMat: round.tienCK,
        TienCK: round.tienCK + tongGiaTriHDMBGoc * (round.discountPercent / 100) * round.heSo,
        HeSo: round.heSo,
        GiaDatChuaVAT_Prev: prevGiaDatChuaVAT,
        VATDat_Prev: prevVATDat,
        TongGiaDat_Prev: prevTongGiaDat,
        TongGiaDatVAT_Prev: prevTongGiaDat,
        TienXDChuaVAT_Prev: prevTienXDChuaVAT,
        TongXDChuaVAT_Prev: prevTienXDChuaVAT,
        TienXDGomVAT_Prev: prevTienXDGomVAT,
        TongXDVAT_Prev: prevTienXDGomVAT,
        TongGiaTriHDMB_Prev: prevTongGiaTriHDMB,
      };

      const tongCKFormula = (round.formulas.tongCK || "").trim() || "0";
      const tongCKVal = evaluateRoundFormula(tongCKFormula, vars);
      vars["TongCK"] = tongCKVal;

      const varNameMap: Partial<Record<FormulaFieldKey, string[]>> = {
        tongCK: ["TongCK"],
        giaDatChuaVAT: ["GiaDatChuaVAT", "GiaDatKoVAT"],
        vatDat: ["VATDat"],
        tongGiaDat: ["TongGiaDat", "TongGiaDatVAT"],
        tienXDChuaVAT: ["TienXDChuaVAT", "TongXDChuaVAT"],
        vatXD: ["VATXD"],
        tienXDGomVAT: ["TienXDGomVAT", "TongXDVAT"],
        tongGiaTriHDMB: ["TongGiaTriHDMB"],
      };
      const baseOrder = round.formulas.evalOrder || LOW_EVAL_ORDER;
      const evalOrder: FormulaFieldKey[] = [
        ...baseOrder,
        ...(Object.keys(varNameMap) as FormulaFieldKey[]).filter((k) => !baseOrder.includes(k)),
      ];
      const results: Record<string, number> = { tongCK: tongCKVal };
      for (const fieldKey of evalOrder) {
        if (fieldKey === "tongCK") continue;
        const formula = ((round.formulas as any)[fieldKey] || "").trim() || "0";
        const val = evaluateRoundFormula(formula, vars);
        (varNameMap[fieldKey] || []).forEach((name) => {
          vars[name] = val;
        });
        results[fieldKey] = val;
      }

      totalCKAmount += results.tongCK || tongCKVal;
      const r = {
        tongCK: results.tongCK ?? tongCKVal,
        giaDatChuaVAT: results.giaDatChuaVAT ?? 0,
        vatDat: results.vatDat ?? 0,
        tongGiaDat: results.tongGiaDat ?? 0,
        tienXDChuaVAT: results.tienXDChuaVAT ?? 0,
        vatXD: results.vatXD ?? 0,
        tienXDGomVAT: results.tienXDGomVAT ?? 0,
        tongGiaTriHDMB: results.tongGiaTriHDMB ?? 0,
        tienCK: results.tongCK ?? tongCKVal,
        vars: { ...vars },
      };
      roundResults.push(r);
      prevTongGiaDat = r.tongGiaDat;
      prevGiaDatChuaVAT = r.giaDatChuaVAT;
      prevVATDat = r.vatDat;
      prevTienXDChuaVAT = r.tienXDChuaVAT;
      prevTienXDGomVAT = r.tienXDGomVAT;
      prevTongGiaTriHDMB = r.tongGiaTriHDMB;
    }

    const last = roundResults.length > 0 ? roundResults[roundResults.length - 1] : null;
    const tongGiaTriHDMB = last?.tongGiaTriHDMB ?? prevTongGiaTriHDMB;
    return {
      thanhTienDat: last?.giaDatChuaVAT ?? giaDatKoVAT,
      donGiaDatPhanBo: dienTichDat > 0 ? giaDatKoVAT / dienTichDat : donGiaDat,
      tienDatChuaVAT: last?.giaDatChuaVAT ?? giaDatKoVAT,
      tienVATDat: last?.vatDat ?? vatDat,
      tongTienDatVAT: last?.tongGiaDat ?? giaDatKoVAT + vatDat,
      thanhTienXD,
      thanhTienXDSauCK: last?.tienXDChuaVAT ?? thanhTienXD,
      tienVATXD: last?.vatXD ?? thanhTienXD * tyLeVAT,
      tongGiaXDVAT: last?.tienXDGomVAT ?? thanhTienXD * (1 + tyLeVAT),
      tongGiaTriHDMB,
      conPhaiThanhToan: tongGiaTriHDMB - tienCoc,
      totalDiscountPercent: giaDatKoVAT > 0 ? Math.round((totalCKAmount / giaDatKoVAT) * 10000) / 100 : 0,
      tongChuaVAT: thanhTienXD,
      tienChietKhau: totalCKAmount,
      giaTriSauCK: last?.tienXDChuaVAT ?? thanhTienXD,
      tienVAT: last?.vatXD ?? thanhTienXD * tyLeVAT,
      tongGomVAT: last?.tienXDGomVAT ?? thanhTienXD * (1 + tyLeVAT),
      phiBaoTri: 0,
      tongGiaTriHD: tongGiaTriHDMB,
      roundResults,
      warnings,
    };
  }

  // Cao tầng — vòng chiết khấu theo công thức, nhiều pass cho công thức tham chiếu chéo
  const dienTich = fd.dienTichThongThuy || 0;
  const donGia = fd.donGiaSuDungDat || 0;
  const rawGomVAT = n(fd.rawTongGiaDaVAT);
  const rawChuaVAT = n(fd.rawTongGiaChuaVAT);
  const giaGocVAT = rawGomVAT > 0 ? rawGomVAT : dienTich * donGia;
  const giaGoc =
    rawChuaVAT > 0 ? rawChuaVAT : rawGomVAT > 0 ? rawGomVAT / (1 + tyLeVAT) : giaGocVAT / (1 + tyLeVAT);

  let prevTongChuaVAT = giaGoc;
  let prevTongGomVAT = giaGocVAT;
  let prevTongGiaTriHD = giaGocVAT + giaGoc * tyLePBT;
  let totalCKAmount = 0;
  const roundResults: any[] = [];

  for (const round of policyRounds) {
    if (!round.enabled) {
      roundResults.push({
        tongCK: 0,
        tongChuaVAT: prevTongChuaVAT,
        vat: prevTongChuaVAT * tyLeVAT,
        tongGomVAT: prevTongGomVAT,
        phiBaoTri: prevTongChuaVAT * tyLePBT,
        tongGiaTriHD: prevTongGiaTriHD,
        tienCK: 0,
        vars: {},
      });
      continue;
    }

    const vars: Record<string, number> = {
      GiaGoc: giaGoc,
      GiaGocGomVAT: giaGocVAT,
      GiaTruocCK: prevTongChuaVAT,
      TongChuaVAT_Prev: prevTongChuaVAT,
      TongGomVAT_Prev: prevTongGomVAT,
      TongGiaTriHD_Prev: prevTongGiaTriHD,
      TyLeCK: round.discountPercent,
      TienCKTienMat: round.tienCK,
      TienCK: round.tienCK + prevTongChuaVAT * (round.discountPercent / 100) * round.heSo,
      HeSo: round.heSo,
      TyLeVAT: fd.tyLeVAT,
      TyLePBT: fd.tyLePBT,
      DienTichThongThuy: dienTich,
      DGDatPB: fd.donGiaDatPhanBo || 0,
      TongChuaVAT: prevTongChuaVAT,
      TongGomVAT: prevTongGomVAT,
      VAT: prevTongChuaVAT * tyLeVAT,
      PhiBaoTri: prevTongChuaVAT * tyLePBT,
      TongGiaTriHD: prevTongGiaTriHD,
    };

    const tongCKVal = evaluateRoundFormula(round.formulas.tongCK || "TienCK", vars);
    vars["TongCK"] = tongCKVal;

    const evalOrder = round.formulas.evalOrder || DEFAULT_EVAL_ORDER;
    const isFirstRound = roundResults.length === 0;
    const fallbacks: Partial<Record<FormulaFieldKey, string>> = {
      tongCK: "TienCK",
      tongChuaVAT: isFirstRound ? "GiaGoc - TongCK" : "TongChuaVAT_Prev - TongCK",
      vat: "TongChuaVAT * TyLeVAT / 100",
      tongGomVAT: "TongChuaVAT + VAT",
      phiBaoTri: "TongChuaVAT * TyLePBT / 100",
      tongGiaTriHD: "TongGomVAT + PhiBaoTri",
    };
    const varNameMap: Partial<Record<FormulaFieldKey, string>> = {
      tongCK: "TongCK",
      tongChuaVAT: "TongChuaVAT",
      vat: "VAT",
      tongGomVAT: "TongGomVAT",
      phiBaoTri: "PhiBaoTri",
      tongGiaTriHD: "TongGiaTriHD",
    };
    const results: Record<string, number> = {};
    const roundIndex = roundResults.length + 1;

    for (let pass = 0; pass < 5; pass++) {
      let changed = false;
      for (const fieldKey of evalOrder) {
        const formula = (round.formulas as any)[fieldKey] || fallbacks[fieldKey] || "0";
        let val = evaluateRoundFormula(formula, vars);
        if (val === 0 && (prevTongChuaVAT > 0 || prevTongGomVAT > 0) && fallbacks[fieldKey]) {
          if (pass === 0) {
            const referenced = (formula.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []).filter(
              (id: string) => !["round", "floor", "ceil"].includes(id)
            );
            const missing = referenced.filter((id: string) => !(id in vars) || vars[id] === undefined);
            warnings.push(
              `CSBH Lần ${roundIndex}: công thức "${formula}" ${
                missing.length ? `thiếu biến (${missing.join(", ")})` : "trả về 0"
              }, đang dùng fallback`
            );
          }
          val = evaluateRoundFormula(fallbacks[fieldKey] as string, vars);
        }
        const varName = varNameMap[fieldKey];
        if (varName) {
          if (vars[varName] !== val) changed = true;
          vars[varName] = val;
        }
        results[fieldKey] = val;
      }
      if (!changed) break;
    }

    totalCKAmount += results.tongCK || tongCKVal;
    roundResults.push({
      tongCK: results.tongCK ?? tongCKVal,
      tongChuaVAT: results.tongChuaVAT ?? 0,
      vat: results.vat ?? 0,
      tongGomVAT: results.tongGomVAT ?? 0,
      phiBaoTri: results.phiBaoTri ?? 0,
      tongGiaTriHD: results.tongGiaTriHD ?? 0,
      tienCK: results.tongCK ?? tongCKVal,
      vars: { ...vars },
    });
    prevTongChuaVAT = results.tongChuaVAT ?? 0;
    prevTongGomVAT = results.tongGomVAT ?? 0;
    prevTongGiaTriHD = results.tongGiaTriHD ?? 0;
  }

  const lastResult = roundResults.length > 0 ? roundResults[roundResults.length - 1] : null;
  const giaTriSauCK = lastResult?.tongChuaVAT ?? giaGoc;
  const tienVAT = lastResult?.vat ?? giaGoc * tyLeVAT;
  const tongGomVAT = lastResult?.tongGomVAT ?? giaGoc + giaGoc * tyLeVAT;
  const phiBaoTri = lastResult?.phiBaoTri ?? giaTriSauCK * tyLePBT;
  const tongGiaTriHD = lastResult?.tongGiaTriHD ?? tongGomVAT + phiBaoTri;

  return {
    tongChuaVAT: giaGoc,
    tienChietKhau: totalCKAmount,
    giaTriSauCK,
    tienVAT,
    tongGomVAT,
    phiBaoTri,
    tongGiaTriHD,
    conPhaiThanhToan: tongGiaTriHD - tienCoc,
    totalDiscountPercent: giaGoc > 0 ? Math.round((totalCKAmount / giaGoc) * 10000) / 100 : 0,
    roundResults,
    baseTienVAT: giaGoc * tyLeVAT,
    baseGomVAT: giaGocVAT,
    basePhiBaoTri: giaGoc * tyLePBT,
    baseTongGiaTriHD: giaGocVAT + giaGoc * tyLePBT,
    thanhTienDat: 0,
    thanhTienXD: 0,
    thanhTienXDSauCK: 0,
    tienVATXD: 0,
    tongGiaXDVAT: 0,
    tongGiaTriHDMB: tongGiaTriHD,
    warnings,
  };
}

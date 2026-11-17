// ⚠️ TỰ SINH — trích nguyên văn logic từ web src/components/PriceSheet/PriceSheetForm.tsx (scripts/sync-web-pricing.cjs): webCalculations, webGetRestoredRoundResults, webFormulaCtx, webRecalcPaymentScheduleSequential, webDueDatesOf, webBuildSave.
// KHÔNG SỬA TAY. Biến của component (state / props / hàm khác) truyền qua ctx.
// Web biên dịch với strict: false; trích ra khỏi component thì state mất kiểu suy luận ⇒ bỏ kiểm kiểu (hành vi kiểm bằng test so web).
// @ts-nocheck
/* eslint-disable */
import { DEFAULT_EVAL_ORDER, LOW_EVAL_ORDER, evaluateRoundFormula, roundFormulaText, type FormulaFieldKey } from "../Products/ContractForm/formulas";
import { countedResults, isSkipRound, lastCountedResult, luyKeTienTyLeAt, luyKeTyLeSeries, policyMoc, skippedRoundResult } from "../Products/ContractForm/mocTinh";
import { gomVatPbtVars, highRiseBaseVars, highRiseGocVatPbt, highRiseVarSources, mocRoundVar, nakedRoundResult, nakedRoundVars, parseNaked, roundRefVars, syncGomVatPbt, withNakedFormula, nakedPayload } from "../Products/ContractForm/roundVars";
import { isLowRiseProduct } from "../../utils/productType";
import { getRestoredRoundResults as getRestoredRoundResultsHelper, recalcPaymentScheduleSequential as recalcPaymentScheduleSequentialHelper, scheduleDueDates, enabledRoundsWithResults, toSavedScheduleItem } from "../Products/ContractForm/helpers";
import { type PaymentSchedule } from "../Products/ContractForm/types";
import dayjs from "dayjs";
import { DateHelper } from "../../utils/DateHelper";
import { buildPriceSheetPrintData } from "./print/printData";
import { clampSheetExpiry, policyExpiryDate } from "../../lib/priceSheetExpiry";
import { hdmbLanPayload } from "../Products/ContractForm/hdmbLanVars";
import { pickFormPrices } from "./savedSheetPrices";
import { savedDetailForRound, savedRoundExtras, shouldSaveRound } from "../Products/ContractForm/discountOptions";
import { templateTraceOf } from "./templateSheet";
import { vatCuoiPbtPayload } from "../Products/ContractForm/vatCuoiPbtVar";

export interface WebCalculationsCtx {
  discounts: any;
  financialEdited: any;
  formData: any;
  getRestoredRoundResults: any;
  policyRounds: any;
  product: any;
  restoredChinhSachSnapshot: any;
  selectedDiscountIds: any;
}

export function webCalculations(__ctx: WebCalculationsCtx): any {
  const { discounts, financialEdited, formData, getRestoredRoundResults, policyRounds, product, restoredChinhSachSnapshot, selectedDiscountIds } = __ctx;
  return (() => {
    const isLowRise = isLowRiseProduct({
      loaiSP: formData.loaiSP,
      product,
      maSP: formData.maSanPham,
    });
    const tyLeVAT = formData.tyLeVAT / 100;
    const tyLePBT = formData.tyLePBT / 100;

    if (!financialEdited && restoredChinhSachSnapshot?.length) {
      const ctxGiaGoc = Number((formData as any).rawTongGiaChuaVAT) || 0;
      const ctxGiaGocVAT = Number((formData as any).rawTongGiaDaVAT) || 0;
      const roundResults = getRestoredRoundResults(
        restoredChinhSachSnapshot,
        isLowRise,
        {
          giaGoc: ctxGiaGoc,
          giaGocGomVAT: ctxGiaGocVAT,
          tienVATGoc: highRiseGocVatPbt(formData, ctxGiaGoc, formData.tyLeVAT, formData.tyLePBT).tienVAT,
          tienPBTGoc: highRiseGocVatPbt(formData, ctxGiaGoc, formData.tyLeVAT, formData.tyLePBT).tienPBT,
          giaNakedGoc: Number((formData as any).rawGiaNaked) || 0,
          tyLeVAT: formData.tyLeVAT,
          tyLePBT: formData.tyLePBT,
          dienTichThongThuy: formData.dienTichThongThuy,
          donGiaDatPhanBo: (formData as any).donGiaDatPhanBo || 0,
          tienSDDat: Number((formData as any).rawTienSDDat) || 0,
          dienTichXD:
            (formData as any).tongDTSanXD || (formData as any).dienTichXD || 0,
          donGiaXD: (formData as any).donGiaXD || 0,
          tongGiaDatGoc: Number((formData as any).rawTongTienDatVAT) || 0,
          tienXDGomVATGoc: Number((formData as any).rawTongGiaXDVAT) || 0,
          tongGiaTriHDMBGoc: Number((formData as any).rawTongGiaTriHDMB) || 0,
        }
      );
      const totalCKAmount = restoredChinhSachSnapshot.reduce(
        (sum, item) => sum + (Number(item?.CKTien) || 0),
        0
      );
      const rawTongChuaVAT = Number((formData as any).rawTongGiaChuaVAT) || 0;
      const rawTongGomVAT = Number((formData as any).rawTongGiaDaVAT) || 0;
      const rawPhiBaoTri = Number((formData as any).rawTienPhiBaoTri) || 0;
      const rawTongGiaTri = Number((formData as any).rawTongGomPBT) || 0;
      // Ưu tiên giá trị đã lưu trên form, nếu thiếu thì lấy từ vòng CSBH cuối,
      // cuối cùng mới tính lại theo % VAT / % PBT (tránh hiển thị 0)
      // Dòng không trừ giá HĐ cuối bảng có kết quả 0: lấy dòng được tính cuối cùng
      const lastRound: any = lastCountedResult(roundResults);
      const tongChuaVAT =
        Number((formData as any).tongChuaVAT) ||
        Number(lastRound?.tongChuaVAT) ||
        rawTongChuaVAT;
      const tienVAT =
        Number((formData as any).tienVAT) ||
        Number(lastRound?.vat) ||
        tongChuaVAT * tyLeVAT;
      const tongGomVAT =
        Number((formData as any).tongGomVAT) ||
        Number(lastRound?.tongGomVAT) ||
        tongChuaVAT + tienVAT;
      const phiBaoTri =
        Number((formData as any).phiBaoTri) ||
        Number(lastRound?.phiBaoTri) ||
        tongChuaVAT * tyLePBT;
      const tongGiaTriHD =
        Number((formData as any).tongGiaVATPBT) ||
        Number(lastRound?.tongGiaTriHD) ||
        tongGomVAT + phiBaoTri;

      const conPhaiThanhToan = tongGiaTriHD - (Number(formData.tienCoc) || 0);

      return {
        thanhTienDat: 0,
        donGiaDatPhanBo: 0,
        tienDatChuaVAT: tongChuaVAT,
        tienVATDat: tienVAT,
        tongTienDatVAT: tongGomVAT,
        thanhTienXD: 0,
        thanhTienXDSauCK: 0,
        tienVATXD: 0,
        tongGiaXDVAT: 0,
        tongGiaTriHDMB: tongGiaTriHD,
        giaTriSauCK: tongChuaVAT,
        tongChuaVAT,
        tienVAT,
        tongGomVAT,
        phiBaoTri,
        tongGiaTriHD,
        conPhaiThanhToan,
        totalDiscountPercent:
          rawTongChuaVAT > 0
            ? Math.round((totalCKAmount / rawTongChuaVAT) * 10000) / 100
            : 0,
        tienChietKhau: totalCKAmount,
        giaNaked: lastRound?.giaNaked ?? null,
        roundResults,
        baseTienVAT:
          Number((formData as any).rawTienVAT) ||
          (rawTongGomVAT && rawTongChuaVAT
            ? rawTongGomVAT - rawTongChuaVAT
            : rawTongChuaVAT * tyLeVAT),
        baseGomVAT: rawTongGomVAT || rawTongChuaVAT * (1 + tyLeVAT),
        basePhiBaoTri: rawPhiBaoTri || rawTongChuaVAT * tyLePBT,
        baseTongGiaTriHD:
          rawTongGiaTri ||
          rawTongChuaVAT * (1 + tyLeVAT) + rawTongChuaVAT * tyLePBT,
      };
    }

    // ⚡ Khi CHƯA chọn chính sách bán hàng (policyRounds rỗng) ⇒ panel
    // "Sản phẩm sau CSBH" hiển thị đúng bằng "Thông tin sản phẩm" (raw từ lưới).
    if (
      !policyRounds ||
      policyRounds.length === 0 ||
      !policyRounds.some((r) => r.enabled)
    ) {
      const rawTongChuaVAT = Number((formData as any).rawTongGiaChuaVAT) || 0;
      const rawTongGomVAT = Number((formData as any).rawTongGiaDaVAT) || 0;
      const rawTienVATRaw =
        Number((formData as any).rawTienVAT) ||
        (rawTongGomVAT && rawTongChuaVAT ? rawTongGomVAT - rawTongChuaVAT : 0);
      const rawPhiBaoTri =
        Number((formData as any).rawTienPhiBaoTri) ||
        (Number((formData as any).rawTongGomPBT) || 0) - rawTongGomVAT ||
        0;
      const rawTongGiaTri =
        Number((formData as any).rawTongGomPBT) ||
        Number((formData as any).rawTongGiaTriHDMB) ||
        rawTongGomVAT + rawPhiBaoTri;

      if (isLowRise) {
        const rawTienDatChuaVAT =
          Number((formData as any).rawTienDatChuaVAT) || 0;
        const rawTienVATDat = Number((formData as any).rawTienVATDat) || 0;
        const rawTongTienDatVAT =
          Number((formData as any).rawTongTienDatVAT) || 0;
        const rawThanhTienXD = Number((formData as any).rawThanhTienXD) || 0;
        const rawTienVATXD = Number((formData as any).rawTienVATXD) || 0;
        const rawTongGiaXDVAT = Number((formData as any).rawTongGiaXDVAT) || 0;
        const rawTongGiaTriHDMB =
          Number((formData as any).rawTongGiaTriHDMB) ||
          rawTongTienDatVAT + rawTongGiaXDVAT;
        const conPhaiThanhToan =
          rawTongGiaTriHDMB - (Number(formData.tienCoc) || 0);
        return {
          thanhTienDat: rawTienDatChuaVAT,
          donGiaDatPhanBo:
            (formData.dienTichDat || 0) > 0
              ? rawTienDatChuaVAT / (formData.dienTichDat || 1)
              : formData.donGiaDat || 0,
          tienDatChuaVAT: rawTienDatChuaVAT,
          tienVATDat: rawTienVATDat,
          tongTienDatVAT: rawTongTienDatVAT,
          thanhTienXD: rawThanhTienXD,
          thanhTienXDSauCK: rawThanhTienXD,
          tienVATXD: rawTienVATXD,
          tongGiaXDVAT: rawTongGiaXDVAT,
          tongGiaTriHDMB: rawTongGiaTriHDMB,
          conPhaiThanhToan,
          totalDiscountPercent: 0,
          tongChuaVAT: rawTongChuaVAT,
          tienChietKhau: 0,
          giaTriSauCK: rawTongChuaVAT,
          tienVAT: rawTienVATRaw,
          tongGomVAT: rawTongGomVAT,
          phiBaoTri: rawPhiBaoTri,
          tongGiaTriHD: rawTongGiaTriHDMB,
          roundResults: [],
        };
      }

      const conPhaiThanhToan = rawTongGiaTri - (Number(formData.tienCoc) || 0);
      return {
        tongChuaVAT: rawTongChuaVAT,
        tienChietKhau: 0,
        giaTriSauCK: rawTongChuaVAT,
        tienVAT: rawTienVATRaw,
        tongGomVAT: rawTongGomVAT,
        phiBaoTri: rawPhiBaoTri,
        tongGiaTriHD: rawTongGiaTri,
        conPhaiThanhToan,
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
      };
    }

    // Calculate discounts
    let totalDiscountPercent = 0;
    selectedDiscountIds.forEach((id) => {
      const discount = discounts.find((d) => d.id === id);
      if (discount && discount.discount_type === "percentage") {
        totalDiscountPercent += discount.discount_percentage;
      }
    });

    if (isLowRise) {
      // Low-rise calculation — cascading discount rounds (formula-based, theo cấu hình)
      const dienTichDat = formData.dienTichDat || 0;
      const donGiaDat = formData.donGiaDat || 0;
      const dienTichXD = formData.tongDTSanXD || formData.dienTichXD || 0;
      const donGiaXD = formData.donGiaXD || 0;
      const tyLeVATXD = formData.tyLeVAT; // dùng chung % VAT (xây dựng)

      // Raw "_Goc" values từ lưới (LowRiseProductList) — ưu tiên dùng nếu có,
      // tránh tính lại lệch với dữ liệu hiển thị bên ngoài
      const rawGiaDatKoVAT = Number((formData as any).rawTienDatChuaVAT) || 0;
      const rawVATDat = Number((formData as any).rawTienVATDat) || 0;
      const rawTongGiaDat = Number((formData as any).rawTongTienDatVAT) || 0;
      const rawTienSDDat = Number((formData as any).rawTienSDDat) || 0;
      const rawThanhTienXD = Number((formData as any).rawThanhTienXD) || 0;
      const rawVATXD = Number((formData as any).rawTienVATXD) || 0;
      const rawTongGiaXDVAT = Number((formData as any).rawTongGiaXDVAT) || 0;
      const rawTongGiaTriHDMB =
        Number((formData as any).rawTongGiaTriHDMB) || 0;

      // Biến gốc theo pricingEngine LOW_RISE_FIELDS
      const giaDatKoVAT = rawGiaDatKoVAT || dienTichDat * donGiaDat; // Giá đất chưa VAT
      const vatDat = rawVATDat || giaDatKoVAT * tyLeVAT; // VAT đất
      const tienSDDat = rawTienSDDat; // Tiền sử dụng đất từ lưới
      const thanhTienXD = rawThanhTienXD || dienTichXD * donGiaXD; // Tiền XD chưa VAT gốc
      const tongGiaDatGoc = rawTongGiaDat || giaDatKoVAT + vatDat + tienSDDat;
      const tongGiaXDVATGoc = rawTongGiaXDVAT || thanhTienXD * (1 + tyLeVATXD);
      const tongGiaTriHDMBGoc =
        rawTongGiaTriHDMB || tongGiaDatGoc + tongGiaXDVATGoc;

      // Khởi tạo giá trị "Prev" cho vòng đầu (chưa có CK) — ưu tiên dùng giá trị gốc từ lưới
      let prevGiaDatChuaVAT = giaDatKoVAT;
      let prevVATDat = vatDat;
      let prevTongGiaDat = tongGiaDatGoc;
      let prevTienXDChuaVAT = thanhTienXD;
      let prevTienXDGomVAT = tongGiaXDVATGoc;
      let prevTongGiaTriHDMB = tongGiaTriHDMBGoc;
      let totalCKAmount = 0;

      const roundResults: {
        tongCK: number;
        giaDatChuaVAT: number;
        vatDat: number;
        tongGiaDat: number;
        tienXDChuaVAT: number;
        vatXD: number;
        tienXDGomVAT: number;
        tongGiaTriHDMB: number;
        tienCK: number;
        vars: Record<string, number>;
      }[] = [];

      for (const round of policyRounds) {
        if (!round.enabled) {
          roundResults.push({
            tongCK: 0,
            giaDatChuaVAT: giaDatKoVAT,
            vatDat: vatDat,
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
          // Biến nguồn LOW_RISE
          GiaDatKoVAT: giaDatKoVAT,
          GiaDatChuaVAT: giaDatKoVAT, // alias theo cấu hình
          VATDat: vatDat,
          TienSDDat: tienSDDat,
          ThanhTienXD: thanhTienXD,
          DonGiaXD: donGiaXD,
          DonGiaXDVAT: donGiaXD * (1 + tyLeVAT), // alias
          DienTichXD: dienTichXD,
          DienTichDat: dienTichDat,
          DonGiaDat: donGiaDat,
          DonGiaDatVAT: donGiaDat * (1 + tyLeVAT), // alias
          DonGiaSDD: (formData as any).donGiaSuDungDat || 0,
          TyLeVATXayDung: tyLeVATXD,
          TyLeVAT: formData.tyLeVAT,
          TyLePBT: formData.tyLePBT,
          // Biến GỐC (từ lưới sản phẩm thấp tầng truyền vào)
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
          // Biến CK
          TyLeCK: round.discountPercent,
          TienCKTienMat: round.tienCK,
          TienCK:
            round.tienCK +
            tongGiaTriHDMBGoc * (round.discountPercent / 100) * round.heSo,
          HeSo: round.heSo,
          // Biến vòng trước (cả 2 alias)
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

        const isFirstRound = roundResults.length === 0;

        // Eval TongCK trước — không cài công thức ⇒ 0
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

        // Đảm bảo MỌI field có trong varNameMap đều được eval (kể cả khi
        // evalOrder không liệt kê) — không cài công thức ⇒ giá trị = 0.
        const baseOrder = round.formulas.evalOrder || LOW_EVAL_ORDER;
        const evalOrder: FormulaFieldKey[] = [
          ...baseOrder,
          ...(Object.keys(varNameMap) as FormulaFieldKey[]).filter(
            (k) => !baseOrder.includes(k)
          ),
        ];
        const results: Record<string, number> = { tongCK: tongCKVal };
        for (const fieldKey of evalOrder) {
          if (fieldKey === "tongCK") continue;
          // Không cài công thức ⇒ giá trị = 0 (theo yêu cầu)
          const formula = (round.formulas[fieldKey] || "").trim() || "0";
          const val = evaluateRoundFormula(formula, vars);
          const names = varNameMap[fieldKey] || [];
          names.forEach((n) => {
            vars[n] = val;
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

      const last =
        roundResults.length > 0 ? roundResults[roundResults.length - 1] : null;
      const tongGiaTriHDMB = last?.tongGiaTriHDMB ?? prevTongGiaTriHDMB;
      const conPhaiThanhToan = tongGiaTriHDMB - formData.tienCoc;

      return {
        // Land / Construction (legacy compatibility) — phản ánh sau CK
        thanhTienDat: last?.giaDatChuaVAT ?? giaDatKoVAT,
        donGiaDatPhanBo:
          dienTichDat > 0 ? giaDatKoVAT / dienTichDat : donGiaDat,
        tienDatChuaVAT: last?.giaDatChuaVAT ?? giaDatKoVAT,
        tienVATDat: last?.vatDat ?? vatDat,
        tongTienDatVAT: last?.tongGiaDat ?? giaDatKoVAT + vatDat,
        thanhTienXD,
        thanhTienXDSauCK: last?.tienXDChuaVAT ?? thanhTienXD,
        tienVATXD: last?.vatXD ?? thanhTienXD * tyLeVAT,
        tongGiaXDVAT: last?.tienXDGomVAT ?? thanhTienXD * (1 + tyLeVAT),
        // Total
        tongGiaTriHDMB,
        conPhaiThanhToan,
        totalDiscountPercent:
          giaDatKoVAT > 0
            ? Math.round((totalCKAmount / giaDatKoVAT) * 10000) / 100
            : 0,
        // Standard fields (for compatibility)
        tongChuaVAT: thanhTienXD,
        tienChietKhau: totalCKAmount,
        giaTriSauCK: last?.tienXDChuaVAT ?? thanhTienXD,
        tienVAT: last?.vatXD ?? thanhTienXD * tyLeVAT,
        tongGomVAT: last?.tienXDGomVAT ?? thanhTienXD * (1 + tyLeVAT),
        phiBaoTri: 0,
        tongGiaTriHD: tongGiaTriHDMB,
        // Cascading results for UI
        roundResults,
      };
    } else {
      // Apartment (high-rise) calculation — formula-based cascading discount rounds
      const dienTich = formData.dienTichThongThuy || 0;
      const donGia = formData.donGiaSuDungDat || 0; // Đơn giá gồm VAT
      // Ưu tiên lấy giá trị gốc từ LƯỚI sản phẩm (raw từ API) để đảm bảo
      // khớp với "Tóm tắt sản phẩm" phía trên. Nếu không có thì mới fallback
      // tính từ diện tích × đơn giá.
      const rawGomVAT = Number((formData as any).rawTongGiaDaVAT) || 0;
      const rawChuaVAT = Number((formData as any).rawTongGiaChuaVAT) || 0;
      const giaGocVAT = rawGomVAT > 0 ? rawGomVAT : dienTich * donGia; // Tổng gồm VAT ban đầu
      const giaGoc =
        rawChuaVAT > 0
          ? rawChuaVAT
          : rawGomVAT > 0
            ? rawGomVAT / (1 + tyLeVAT)
            : giaGocVAT / (1 + tyLeVAT); // Tổng chưa VAT ban đầu

      // Evaluate each round using its configured formulas
      let prevTongChuaVAT = giaGoc;
      let prevTongGomVAT = giaGocVAT;
      // Tiền VAT / PBT gốc theo bảng giá (như khung Thông tin sản phẩm), không tự tính lại theo %
      const goc = highRiseGocVatPbt(formData, giaGoc, formData.tyLeVAT, formData.tyLePBT);
      let prevTongGiaTriHD = giaGocVAT + goc.tienPBT;
      const gocNaked = parseNaked((formData as any).rawGiaNaked);
      let prevGiaNaked = gocNaked;
      let prevTongCK = 0;
      // PBT của lần đang bật liền trước (dòng tắt không đổi), mốc tính theo dòng chính sách
      let prevPhiBaoTri = goc.tienPBT;
      const moc = policyMoc(policyRounds.filter((r) => !isSkipRound(r)));
      // Lũy kế tỷ lệ của các dòng tick Mốc tính tỷ lệ, theo vị trí dòng (mỗi dòng đẩy đúng 1 kết quả)
      const luyKe = luyKeTyLeSeries(policyRounds);
      let totalCKAmount = 0;
      const roundResults: {
        tongCK: number;
        tongChuaVAT: number;
        vat: number;
        tongGomVAT: number;
        phiBaoTri: number;
        tongGiaTriHD: number;
        giaNaked: number | null;
        tienCK: number;
        vars: Record<string, number>;
        varSources?: Record<string, string>;
      }[] = [];

      for (const round of policyRounds.map(withNakedFormula)) {
        // Dòng "Không trừ giá HĐ": không nhận công thức, mọi cột 0, không cập nhật số lần trước
        if (isSkipRound(round)) {
          roundResults.push(skippedRoundResult() as any);
          continue;
        }
        if (!round.enabled) {
          roundResults.push({
            tongCK: 0,
            tongChuaVAT: prevTongChuaVAT,
            vat: prevTongChuaVAT * tyLeVAT,
            tongGomVAT: prevTongGomVAT,
            phiBaoTri: prevTongChuaVAT * tyLePBT,
            tongGiaTriHD: prevTongGiaTriHD,
            giaNaked: prevGiaNaked,
            tienCK: 0,
            vars: {},
          });
          continue;
        }

        // Build context variables for formula evaluation
        const isFirstRoundEarly = roundResults.length === 0;
        const seedFromPrev = isFirstRoundEarly
          ? "Giá gốc (round 1)"
          : `Kết quả round ${roundResults.length}`;
        const vars: Record<string, number> = {
          GiaGoc: giaGoc,
          GiaGocGomVAT: giaGocVAT,
          GiaTruocCK: prevTongChuaVAT,
          TongChuaVAT_Prev: prevTongChuaVAT,
          TongGomVAT_Prev: prevTongGomVAT,
          TongGiaTriHD_Prev: prevTongGiaTriHD,
          TyLeCK: round.discountPercent,
          TienCKTienMat: round.tienCK,
          TienCK:
            round.tienCK +
            prevTongChuaVAT * (round.discountPercent / 100) * round.heSo,
          HeSo: round.heSo,
          TyLeVAT: formData.tyLeVAT,
          TyLePBT: formData.tyLePBT,
          DienTichThongThuy: dienTich,
          DGDatPB: formData.donGiaDatPhanBo || 0,
          // Seed các biến output bằng giá trị từ round trước (hoặc gốc cho round 1)
          // để công thức tham chiếu chéo (vd: TongChuaVAT = TongGomVAT*100/110) hoạt động đúng
          TongChuaVAT: prevTongChuaVAT,
          TongGomVAT: prevTongGomVAT,
          VAT: prevTongChuaVAT * tyLeVAT,
          PhiBaoTri: prevTongChuaVAT * tyLePBT,
          TongGiaTriHD: prevTongGiaTriHD,
          ...nakedRoundVars(gocNaked ?? 0, prevGiaNaked ?? 0),
          ...highRiseBaseVars(giaGoc, formData.tyLeVAT, formData.tyLePBT, prevTongCK, goc),
          ...roundRefVars(countedResults(roundResults)),
          ...gomVatPbtVars(giaGocVAT, goc.tienPBT, prevTongGomVAT, prevPhiBaoTri),
          ...mocRoundVar(countedResults(roundResults), moc),
          LuyKeCKTyLe: luyKe[roundResults.length] ?? 0,
          // Tổng CK của các dòng đã tính phía trên (dòng tắt / bỏ qua không cộng)
          LuyKeTienCKTyLe: luyKeTienTyLeAt(policyRounds, roundResults.map((x) => x.tongCK), roundResults.length),
        };
        syncGomVatPbt(vars);

        // Theo dõi nguồn gốc (seed source) của từng biến để hiển thị debug
        const varSources = highRiseVarSources(roundResults.length + 1, seedFromPrev);

        // Evaluate TongCK first — không cài công thức ⇒ 0
        const tongCKFormula = (round.formulas.tongCK || "").trim() || "0";
        const tongCKVal = evaluateRoundFormula(tongCKFormula, vars);
        vars["TongCK"] = tongCKVal;
        varSources["TongCK"] = `Tính từ công thức: ${tongCKFormula}`;

        // Evaluate formulas in configured order
        const evalOrder = round.formulas.evalOrder || DEFAULT_EVAL_ORDER;

        const varNameMap: Partial<Record<FormulaFieldKey, string>> = {
          tongCK: "TongCK",
          tongChuaVAT: "TongChuaVAT",
          vat: "VAT",
          tongGomVAT: "TongGomVAT",
          phiBaoTri: "PhiBaoTri",
          tongGiaTriHD: "TongGiaTriHD",
          giaNaked: "GiaNaked",
        };

        const results: Record<string, number> = {};

        // Chạy nhiều pass để các công thức tham chiếu chéo hội tụ
        // (vd: tongChuaVAT = TongGomVAT*100/110 và tongGomVAT = GiaGocGomVAT - TongCK
        //  cần ít nhất 2 pass để TongGomVAT có giá trị mới trước khi TongChuaVAT dùng nó).
        const MAX_PASSES = 5;
        for (let pass = 0; pass < MAX_PASSES; pass++) {
          let changed = false;
          for (const fieldKey of evalOrder) {
            // Không cài công thức ⇒ giá trị = 0 (không tự tính công thức mặc định)
            const formula = (round.formulas[fieldKey] || "").trim() || "0";
            const val = evaluateRoundFormula(formula, vars);
            const varName = varNameMap[fieldKey];
            if (varName) {
              if (vars[varName] !== val) changed = true;
              vars[varName] = val;
              varSources[varName] = `Tính từ công thức: ${formula}`;
            }
            results[fieldKey] = val;
          }
          if (syncGomVatPbt(vars)) changed = true;
          if (!changed) break;
        }

        const giaNaked = nakedRoundResult(roundFormulaText(round.formulas, "giaNaked"), results.giaNaked, prevGiaNaked);
        totalCKAmount += results.tongCK || tongCKVal;
        roundResults.push({
          tongCK: results.tongCK ?? tongCKVal,
          tongChuaVAT: results.tongChuaVAT ?? 0,
          vat: results.vat ?? 0,
          tongGomVAT: results.tongGomVAT ?? 0,
          phiBaoTri: results.phiBaoTri ?? 0,
          tongGiaTriHD: results.tongGiaTriHD ?? 0,
          giaNaked,
          tienCK: results.tongCK ?? tongCKVal,
          vars: { ...vars },
          varSources: { ...varSources },
        });

        prevTongChuaVAT = results.tongChuaVAT ?? 0;
        prevTongGomVAT = results.tongGomVAT ?? 0;
        prevTongGiaTriHD = results.tongGiaTriHD ?? 0;
        prevPhiBaoTri = results.phiBaoTri ?? 0;
        prevGiaNaked = giaNaked;
        prevTongCK = results.tongCK ?? tongCKVal;
      }

      // Dòng bỏ qua không phải kết quả cuối: Sản phẩm sau CSBH lấy dòng được tính cuối cùng
      const lastResult = lastCountedResult(roundResults);
      const giaTriSauCK = lastResult?.tongChuaVAT ?? giaGoc;
      const tienVAT = lastResult?.vat ?? giaGoc * tyLeVAT;
      const tongGomVAT = lastResult?.tongGomVAT ?? giaGoc + giaGoc * tyLeVAT;
      const phiBaoTri = lastResult?.phiBaoTri ?? giaTriSauCK * tyLePBT;
      const tongGiaTriHD = lastResult?.tongGiaTriHD ?? tongGomVAT + phiBaoTri;
      const conPhaiThanhToan = tongGiaTriHD - formData.tienCoc;

      // Base (original) values before any discounts
      const baseTienVAT = giaGoc * tyLeVAT;
      const baseGomVAT = giaGocVAT;
      const basePhiBaoTri = giaGoc * tyLePBT;
      const baseTongGiaTriHD = baseGomVAT + basePhiBaoTri;

      return {
        giaNaked: lastResult?.giaNaked ?? gocNaked,
        tongChuaVAT: giaGoc,
        tienChietKhau: totalCKAmount,
        giaTriSauCK,
        tienVAT,
        tongGomVAT,
        phiBaoTri,
        tongGiaTriHD,
        conPhaiThanhToan,
        totalDiscountPercent:
          giaGoc > 0 ? Math.round((totalCKAmount / giaGoc) * 10000) / 100 : 0,
        roundResults,
        // Base values (before discounts) for product info summary
        baseTienVAT,
        baseGomVAT,
        basePhiBaoTri,
        baseTongGiaTriHD,
        // Low-rise fields (for compatibility)
        thanhTienDat: 0,
        thanhTienXD: 0,
        thanhTienXDSauCK: 0,
        tienVATXD: 0,
        tongGiaXDVAT: 0,
        tongGiaTriHDMB: tongGiaTriHD,
      };
    }
  })();
}

export interface WebGetRestoredRoundResultsCtx {
}

export function webGetRestoredRoundResults(__ctx: WebGetRestoredRoundResultsCtx): any {

  return (
    csArr: any[],
    isLowRise: boolean,
    ctx?: Parameters<typeof getRestoredRoundResultsHelper>[2]
  ) => getRestoredRoundResultsHelper(csArr, isLowRise, ctx);
}

export interface WebFormulaCtxCtx {
  formData: any;
  latestCalculationsRef: any;
  latestHdmbLanRef: any;
  latestVatCuoiPbtRef: any;
}

export function webFormulaCtx(__ctx: WebFormulaCtxCtx): any {
  const { formData, latestCalculationsRef, latestHdmbLanRef, latestVatCuoiPbtRef } = __ctx;
  return () => ({
    calculations: latestCalculationsRef.current,
    rawTongGiaChuaVAT: (formData as any).rawTongGiaChuaVAT,
    // Giá HĐMB chưa TT lần 1…6 của bảng giá (biến GiaTriHDMBLan{n})
    giaHDMBLan: latestHdmbLanRef.current,
    // 5%VAT cuối + PBT của bảng giá (biến VATCuoiPBT)
    vatCuoiPBT: latestVatCuoiPbtRef.current,
  });
}

export interface WebRecalcPaymentScheduleSequentialCtx {
  formulaCtx: any;
}

export function webRecalcPaymentScheduleSequential(__ctx: WebRecalcPaymentScheduleSequentialCtx): any {
  const { formulaCtx } = __ctx;
  return (
    rows: PaymentSchedule[],
    forceRecalc = false
  ) => recalcPaymentScheduleSequentialHelper(rows, formulaCtx(), forceRecalc);
}

export interface WebDueDatesOfCtx {
  formData: any;
}

export function webDueDatesOf(__ctx: WebDueDatesOfCtx): any {
  const { formData } = __ctx;
  return (rows: PaymentSchedule[]) =>
    scheduleDueDates(rows, (row) => {
      if (!formData.ngayKy) return null;
      const unit = row.theoThang || Number(row.maLoaiNgay) === 2 ? "month" : "day";
      return dayjs(formData.ngayKy).add(Number(row.soNgay) || 0, unit).format("YYYY-MM-DDT00:00:00") + "+07:00";
    });
}

export interface WebBuildSaveCtx {
  calculations: any;
  chinhSachBH: any;
  chinhSachBHDetails: any;
  coOwners: any;
  congTyBanHangId: any;
  customer360: any;
  dueDatesOf: any;
  editContractData: any;
  effectiveMaDA: any;
  formData: any;
  handoverStandard: any;
  htlsProgram: any;
  initialSheet: any;
  isLowProductForPrice: any;
  lichThanhToan: any;
  maPGC: any;
  nameOfCongTyBanHang: any;
  paymentSchedule: any;
  policyRounds: any;
  priceCfg: any;
  printTemplate: any;
  product: any;
  sections: any;
  selectedDiscountIds: any;
  selectedPolicyConfigId: any;
  selectedPolicyId: any;
  selectedPolicyRow: any;
  selectedPriceListId: any;
  selectedPriceSheetId: any;
  selectedPromotion: any;
  selectedTemplateId: any;
  unitFund: any;
}

export function webBuildSave(__ctx: WebBuildSaveCtx): any {
  const { calculations, chinhSachBH, chinhSachBHDetails, coOwners, congTyBanHangId, customer360, dueDatesOf, editContractData, effectiveMaDA, formData, handoverStandard, htlsProgram, initialSheet, isLowProductForPrice, lichThanhToan, maPGC, nameOfCongTyBanHang, paymentSchedule, policyRounds, priceCfg, printTemplate, product, sections, selectedDiscountIds, selectedPolicyConfigId, selectedPolicyId, selectedPolicyRow, selectedPriceListId, selectedPriceSheetId, selectedPromotion, selectedTemplateId, unitFund } = __ctx;
  const num = (v: any) =>
        v === null || v === undefined || v === "" ? null : Number(v);
  const toIsoTz = (v: any): string | null => {
        if (v === null || v === undefined || v === "") return null;
        try {
          const d: Date =
            v instanceof Date
              ? v
              : typeof v === "object" && typeof v?.toDate === "function"
                ? v.toDate()
                : new Date(v);
          if (isNaN(d.getTime())) return null;
          const pad = (n: number) => String(n).padStart(2, "0");
          const tzMin = -d.getTimezoneOffset();
          const sign = tzMin >= 0 ? "+" : "-";
          const tzH = pad(Math.floor(Math.abs(tzMin) / 60));
          const tzM = pad(Math.abs(tzMin) % 60);
          return (
            `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
            `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(
              d.getSeconds()
            )}` +
            `${sign}${tzH}:${tzM}`
          );
        } catch {
          return null;
        }
      };
  const fd: any = formData || {};
  const p: any = product || {};
  const currentMaPGC = sections.pgcLink ? maPGC ?? editContractData?.MaPGC ?? null : null;
  const dienTichThongThuy =
        num(fd.dienTichThongThuy) ?? num(p.DienTichThongThuy) ?? num(p.area);
  const donGiaDaVAT = num(fd.rawDonGiaDaVAT) ?? num(p.DonGiaDaVAT);
  const tongGiaDaVAT = num(fd.rawTongGiaDaVAT) ?? num(p.TongGiaDaVAT);
  const tyLeVAT = num(fd.tyLeVAT) ?? num(p.TyLeVAT);
  const tienVAT = num(fd.rawTienVAT) ?? num(p.TienVAT);
  const donGiaChuaVAT =
        donGiaDaVAT !== null && tyLeVAT !== null && tyLeVAT !== 0
          ? donGiaDaVAT / (1 + tyLeVAT / 100)
          : num(p.DonGiaChuaVAT);
  const tongGiaChuaVAT =
        tongGiaDaVAT !== null && tyLeVAT !== null && tyLeVAT !== 0
          ? tongGiaDaVAT / (1 + tyLeVAT / 100)
          : num(p.TongGiaChuaVAT);
  const tyLePhiBaoTri = num(fd.tyLePBT) ?? num(p.TyLePhiBaoTri);
  const tienPhiBaoTri = num(fd.rawTienPhiBaoTri) ?? num(p.TienPhiBaoTri);
  const tongGiaGomVATPBT =
        num(fd.rawTongGomPBT) ??
        num(p.TongGomPBT) ??
        (formData as any).rawTongGiaTriHDMB ??
        calculations.tongGiaTriHDMB;
  const donGiaDatPhanBo = num(fd.donGiaDatPhanBo) ?? num(p.DGDatPB);
  const donGiaDat = num(fd.donGiaDat) ?? num(p.land_unit_price);
  const tienDatChuaVat =
        num(fd.rawTienDatChuaVAT) ?? num(p.rawTienDatChuaVAT);
  const tienVATDAT = num(fd.rawTienVATDat) ?? num(p.rawTienVATDat);
  const tongTienVATDat = num(fd.rawTongTienDatVAT);
  const donGiaXD = num(fd.donGiaXD);
  const tienXDChuaVAT = num(fd.rawThanhTienXD) ?? num(p.rawThanhTienXD);
  const tienVatXD = num(fd.rawTienVATXD) ?? num(p.rawTienVATXD);
  const tongTienXDGomVAT =
        num(fd.rawTongGiaXDVAT) ?? num(p.rawTongGiaXDVAT);
  const tongGiaDatGomVAT =
        num(fd.rawTongTienDatVAT) ?? num(p.rawTongTienDatVAT);
  const GiaTriHopDong = {
        DienTichThongThuy: dienTichThongThuy,
        DonGiaChuaVAT: donGiaChuaVAT,
        DonGiaGomVAT: donGiaDaVAT,
        TongChuaVAT: tongGiaChuaVAT,
        TyLeVAT: tyLeVAT,
        TienVAT: tienVAT,
        TongGomVAT: tongGiaDaVAT,
        TyLePhiBaoTri: tyLePhiBaoTri,
        TienPhiBaoTri: tienPhiBaoTri,
        TongGiaGomVATPBT: tongGiaGomVATPBT,
        DonGiaDat: donGiaDat,
        DGDatPB: donGiaDatPhanBo,
        TienDatChuaVAT: tienDatChuaVat,
        TienVATDat: tienVATDAT,
        TongTienVATDat: tongTienVATDat,
        DonGiaXD: donGiaXD,
        TienXDChuaVAT: tienXDChuaVAT,
        TienVATXD: tienVatXD,
        TongTienXDGomVAT: tongTienXDGomVAT,
        TongGiaGomDatXD: tongGiaDatGomVAT,
        ...nakedPayload(isLowProductForPrice, fd.rawGiaNaked ?? p.GiaNaked),
        ...hdmbLanPayload(fd.rawGiaHDMBLan),
        ...vatCuoiPbtPayload(fd.rawVATCuoiPBT),
      };
  const c: any = calculations || {};
  const hasAnyDiscountInRounds = (policyRounds || []).some(
        (r: any) =>
          r?.enabled && (num(r.discountPercent) > 0 || num(r.tienCK) > 0)
      );
  const hasCK =
        hasAnyDiscountInRounds ||
        (selectedDiscountIds && selectedDiscountIds.size > 0) ||
        (c.tienChietKhau && c.tienChietKhau > 0);
  const sauCK_DonGiaChuaVAT =
        dienTichThongThuy && c.giaTriSauCK
          ? c.giaTriSauCK / dienTichThongThuy
          : null;
  const sauCK_DonGiaGomVAT =
        dienTichThongThuy && num(c.tongGomVAT)
          ? num(c.tongGomVAT)! / dienTichThongThuy
          : null;
  const GiaTriHopDongSauCK = hasCK
        ? {
          DienTichThongThuy: dienTichThongThuy,
          DonGiaChuaVAT: sauCK_DonGiaChuaVAT,
          DonGiaGomVAT: sauCK_DonGiaGomVAT,
          TongChuaVAT: num(c.giaTriSauCK),
          TyLeVAT: tyLeVAT,
          TienVAT: num(c.tienVAT),
          TongGomVAT: num(c.tongGomVAT),
          TyLePhiBaoTri: tyLePhiBaoTri,
          TienPhiBaoTri: num(c.phiBaoTri),
          TongGiaGomVATPBT:
            num(c.tongGiaTriHD ?? c.tongGiaTriHDMB) ??
            (formData as any).rawTongGiaTriHDMB ??
            calculations.tongGiaTriHDMB,
          DonGiaDat: donGiaDat,
          DGDatPB: num(c.donGiaDatPhanBo),
          TienDatChuaVAT: num(c.tienDatChuaVAT),
          TienVATDat: num(c.tienVATDat),
          TongTienVATDat: num(c.tongTienDatVAT),
          DonGiaXD: donGiaXD,
          TienXDChuaVAT: num(c.thanhTienXDSauCK ?? c.thanhTienXD),
          TienVATXD: num(c.tienVATXD),
          TongTienXDGomVAT: num(c.tongGiaXDVAT),
          TongGiaGomDatXD: num(c.tongGiaTriHDMB),
          ...nakedPayload(isLowProductForPrice, c.giaNaked),
        }
        : {
          DienTichThongThuy: null,
          DonGiaChuaVAT: null,
          DonGiaGomVAT: null,
          TongChuaVAT: null,
          TyLeVAT: null,
          TienVAT: null,
          TongGomVAT: null,
          TyLePhiBaoTri: null,
          TienPhiBaoTri: null,
          TongGiaGomVATPBT: null,
          DonGiaDat: null,
          DGDatPB: null,
          TienDatChuaVAT: null,
          TienVATDat: null,
          TongTienVATDat: null,
          DonGiaXD: null,
          TienXDChuaVAT: null,
          TienVATXD: null,
          TongTienXDGomVAT: null,
          TongGiaGomDatXD: null,
        };
  const roundResultsArr: any[] = (c.roundResults as any[]) || [];
  const ChinhSach = (policyRounds || [])
        .map((round: any, idx: number) => {
          if (!shouldSaveRound(round)) return null;
          const rr = roundResultsArr[idx] || {};
          const csbhDetail = savedDetailForRound(chinhSachBHDetails, round, idx);
          const tongChuaVAT = num(rr.tongChuaVAT ?? rr.tongGiaDat);
          const vat = num(rr.vat ?? rr.vatXD);
          const tongGomVAT = num(rr.tongGomVAT ?? rr.tienXDGomVAT);
          const phiBT = num(
            isLowRiseProduct({
              loaiSP: formData.loaiSP,
              product,
              maSP: formData.maSanPham,
            })
              ? 0
              : tongChuaVAT * (num(formData?.tyLePBT) / 100)
          );
          const tongHDMB = num(rr.tongGiaTriHD ?? rr.tongGiaTriHDMB);
          const giaDatChuaVat = num(rr.giaDatChuaVAT);
          const vatDat = num(rr.vatDat);
          const tongGiaDat = num(rr.tongGiaDat);
          const tienXDChuaVAT = num(rr.tienXDChuaVAT);
          const vatXD = num(rr.vatXD);
          const tienXDGomVat = num(rr.tienXDGomVAT);
          const roundKeyAsNumber = Number(round.key);
          return {
            MaPGC: currentMaPGC,
            MaCS: selectedPolicyId || null,
            CKDonGia: num(round.tienCK) || null,
            CKPT: num(round.discountPercent) || null,
            MaCK:
              (round as any).maCK ??
              csbhDetail?.MaCK ??
              (Number.isFinite(roundKeyAsNumber) ? roundKeyAsNumber : null),
            MaKTT: (round as any).maKTT ?? csbhDetail?.MaKTT ?? null,
            MaCSTong: selectedPolicyConfigId || null,
            CKTien: num(rr.tongCK ?? rr.tienCK) || null,
            TongGiaChuaVAT: tongChuaVAT,
            VAT: vat,
            TongGiaGomVAT: tongGomVAT,
            PhiBaoTri: phiBT,
            TongGiaTriHDMB: tongHDMB,
            TongGiaDatChuaVAT: giaDatChuaVat,
            TienVATDat: vatDat,
            TongGiaDat: tongGiaDat,
            TienXDTruocVAT: tienXDChuaVAT,
            VATXD: vatXD,
            TienXDCoVAT: tienXDGomVat,
            ...nakedPayload(isLowProductForPrice, rr.giaNaked),
            ...savedRoundExtras(round),
          };
        })
        .filter(Boolean);
  const isLow = isLowRiseProduct({
        loaiSP: formData.loaiSP,
        product,
        maSP: formData.maSanPham,
      });
  const dueDates = dueDatesOf(paymentSchedule || []);
  const LichThanhToan = (paymentSchedule || []).map((row: any, i: number) =>
        toSavedScheduleItem(row, isLow, {
          MaPGC: currentMaPGC,
          MaTH: selectedTemplateId,
          NgayTT: dueDates[i],
        })
      );
  const KhuyenMai = (selectedPromotion || []).map((g: any) => ({
        MaPGC: currentMaPGC,
        PromotionID: g.ID,
        SoLuong: num(g.SoLuong),
        TieuDe: g.TenQuaTang,
        SoTien: num(g.GiaTri),
      }));
  const payload = {
        TTHopDong: {
          MaPGC: currentMaPGC,
          MaSP: product?.MaSP ?? editContractData?.MaSP ?? null,
          NgayKy: DateHelper.ToApiDateTime(formData?.ngayKy),
          NgayHetHan: sections.expiry ? clampSheetExpiry(formData?.ngayHetHan, policyExpiryDate(selectedPolicyRow)) : null,
          NgayBanGiaoKH: DateHelper.ToApiDateTime(formData?.ngayBanGiao),
          MaNVKD: formData?.maNVKD,
          SoPhieu: formData?.soHopDong,
          TienCoc: num(formData?.tienCoc),
          GhiChu: formData?.ghiChu,
          MaCan:
            product?.KyHieu || fd?.maSanPham || editContractData?.MaCan || null,
          MaDA:
            product?.MaDA ?? editContractData?.MaDA ?? effectiveMaDA ?? null,
          MaSan: formData?.maSan || null,
          // Công ty bán hàng — TenCongTyBanHang là tên thuần (không hậu tố)
          CongTyBanHangId: congTyBanHangId || null,
          TenCongTyBanHang: nameOfCongTyBanHang(congTyBanHangId),
          MaPDK: selectedPriceSheetId || null,
          MaCS: selectedPolicyId || null,
          MaDotGia: selectedPriceListId || null,
          MaQuyCan: unitFund.quyCanId,
          CauHinhTinhGiaID: selectedPolicyConfigId,
          GiaTriHopDong,
          GiaTriHopDongSauCK,
          // Phiếu lập từ mẫu đang sửa: giữ MauId / MaMau (lập mới từ mẫu thì withTemplateTrace gắn lúc giao payload)
          ...(sections.templateName ? {} : templateTraceOf(initialSheet)),
        },
        // Giá GỐC của căn đọc từ bds_products (getById) — không chịu ảnh hưởng
        // của bảng giá/chiết khấu; dùng để lưu vào cloud_pgc_san_pham.
        GiaGocSanPham: {
          DonGiaChuaVAT: num(product?.DonGiaChuaVAT),
          TongChuaVAT: num(product?.TongGiaChuaVAT),
          TongGomVAT: num(product?.TongGiaGomVAT ?? product?.TongGiaDaVAT),
          TienVAT: num(product?.TienVAT),
          TienPhiBaoTri: num(product?.TienPBT ?? product?.TienPhiBaoTri),
          TongGiaGomVATPBT: num(
            product?.TongGiaTriHDMB ??
              product?.TongGiaGomPBT ??
              product?.TongGomPBT
          ),
          DonGiaDat: num(product?.DonGiaDat),
          DGDatPB: num(product?.DGDatPB),
          TienDatChuaVAT: num(product?.TongGiaDat),
          DonGiaXD: num(product?.DonGiaXayDung),
          TienXDChuaVAT: num(product?.ThanhTienXD),
          ...nakedPayload(isLowProductForPrice, fd.rawGiaNaked ?? (product as any)?.GiaNaked),
        },
        TTKhachHang: {
          MaKH: fd?.MaKH ?? null,
          IsPersonal: fd?.customerType === "individual" ? true : false,
          TenKH: fd?.TenKH,
          MaQD: fd?.MaQD,
          DiDong: fd?.DiDong,
          DiDong2: (fd as any)?.DiDong2,
          Email: fd?.Email,
          Email2: (fd as any)?.Email2,
          MaSoTTNCN: (fd as any)?.MaSoTTNCN,
          SoTaiKhoan: (fd as any)?.SoTaiKhoan,
          TenNganHang: (fd as any)?.TenNganHang,
          // MaSoKH: (fd as any)?.MaSoKH,
          ThuongTru: fd?.ThuongTru,
          DiaChi: fd?.DiaChi,
          NgaySinh: DateHelper.ToApiDateTime(fd?.NgaySinh),
          SoCMND: fd?.SoCMND,
          NgayCap: DateHelper.ToApiDateTime(fd?.NgayCap),
          NoiCap: fd?.NoiCap,
          TenCongTy: fd?.TenCongTy,
          MaSoThueCT: fd?.MaSoThueCT,
          SoDKKD: fd?.SoDKKD,
          DiaChiCT: fd?.DiaChiCT,
          DienThoaiCT: fd?.DienThoaiCT,
          EmailCT: fd?.EmailCT,
          NguoiDaiDienPL: fd?.NguoiDaiDienPL,
          NgayCapGPKD: DateHelper.ToApiDateTime(fd?.NgayCapGPKD),
          NoiCapGPKD: fd?.NoiCapGPKD,
          SoGPKD: fd?.SoGPKD,
          ChucVu: fd?.ChucVu,
          ListKhachHang: (coOwners || []).map((item: any, index: number) => ({
            STT: index,
            MaKH: item?.MaKH ?? null,
          })),
        },
        TT360KhachHang: customer360,
        ChinhSach,
        LichThanhToan,
        KhuyenMai,
      };
  const snapshot = {
          // Lưu nguyên sản phẩm nguồn để khi sửa nạp lại đúng dữ liệu giá/diện tích
          product: product ? { ...(product as any) } : null,
          // Ô giá / diện tích đúng như đang hiện trên form (giá có thể từ bảng giá hoặc nhập tay)
          formValues: pickFormPrices(formData as any),
          priceConfigId: priceCfg.configId ?? null,
          coOwners,
          projectName:
            (formData as any).duAn || product?.TenDA || product?.project_name || "",
          productCode: product?.KyHieu || formData?.maSanPham || "",
          productType:
            (product as any)?.TenLoaiBDS || (formData as any).loaiSP || "",
          isLowRise: isLow,
          view: (product as any)?.TenView || (product as any)?.Huong || "",

          area:
            num((formData as any).dienTichThongThuy) ||
            num(product?.DienTichThongThuy) ||
            0,
          policyName:
            (chinhSachBH || []).find((p: any) => p?.ID === selectedPolicyId)
              ?.TenChinhSach ||
            (formData as any).tenChinhSach ||
            "",
          scheduleName:
            (lichThanhToan || []).find(
              (t: any) => t?.MaTH === selectedTemplateId
            )?.TenTH || "",
          policyDate: formData?.ngayKy || null,
          customerName: fd?.TenKH || "",
          customerPhone: fd?.DiDong || "",
          customer360,
          // Lưu nguyên trạng các dòng chiết khấu để khôi phục khi sửa
          policyRounds: (policyRounds || []).map((r: any) => ({
            key: r?.key,
            name: r?.name,
            enabled: r?.enabled !== false,
            discountPercent: num(r?.discountPercent) || 0,
            heSo: num(r?.heSo) || 1,
            tienCK: num(r?.tienCK) || 0,
            maCK: (r as any)?.maCK ?? null,
            maKTT: (r as any)?.maKTT ?? null,
            luaChonDaChon: r?.luaChonDaChon ?? [],
            ...((r as any)?.khongTruGiaHD ? { khongTruGiaHD: true } : {}),
            ...(r?.mocTinhTyLe ? { mocTinhTyLe: true } : {}),
          })),
          // Mẫu xuất + dữ liệu in (đúng số đang hiện trên form) — mẫu in chỉ đọc printData
          printTemplate,
          handoverStandard: handoverStandard.trim(),
          htlsProgram: htlsProgram.trim(),
          printData: buildPriceSheetPrintData({
            formData,
            product,
            calculations,
            policyRounds,
            paymentSchedule,
            // Ngày TT đúng như ô ngày tab Lịch thanh toán (Đợt liền trước / bỏ chọn loại ngày / chọn tay)
            dueDates: dueDatesOf(paymentSchedule || []),
            selectedPromotion,
            handoverStandard,
            htlsProgram,
            scheduleName:
              (lichThanhToan || []).find((t) => t?.MaTH === selectedTemplateId)?.TenTH || "",
          }),
          discounts: enabledRoundsWithResults(policyRounds, (calculations as any)?.roundResults)
            .map(({ round: r, result }, i: number) => ({
              key: r?.key ?? null,
              maCK: (r as any)?.maCK ?? null,
              name: r?.name || `Chiết khấu ${i + 1}`,
              rate: num(r?.discountPercent) || 0,
              amount:
                num(result?.tongCK) ||
                num(r?.tienCK) ||
                0,
            })),
          promotions: (selectedPromotion || []).map((g: any) => ({
            name: g?.TenQuaTang,
            quantity: num(g?.SoLuong),
            amount: num(g?.GiaTri),
          })),
          schedule: (paymentSchedule || []).map((row: any, i: number) => ({
            index: row?.dot ?? i + 1,
            name: row?.kieuThanhToan || row?.dienGiai || `Đợt ${i + 1}`,
            ratio: num(row?.tyLeTT),
            // Ngày TT như bảng lịch (đã chọn / đã lưu, hoặc tính theo loại ngày)
            dueDate: dueDatesOf(paymentSchedule || [])[i],
            amount: num(row?.tongGiaTri) || num(row?.soTien),
          })),
          totals: {
            totalListedPrice: num((formData as any).rawTongGomPBT),
            unitPriceVAT: num((formData as any).donGiaVAT),
            totalContractValue: num(calculations?.tongGiaTriHD),
            totalWithVATNoMaintenance: num(calculations?.tongGomVAT),
            // SAU chiết khấu như panel "Chưa VAT (sau CK)" — tongChuaVAT là giá gốc trước CK
            totalNoVAT: num(
              (calculations as any)?.giaTriSauCK ?? calculations?.tongChuaVAT
            ),
            vatAmount: num(calculations?.tienVAT),
            maintenanceFee: num(calculations?.phiBaoTri),
            discountAmount: num(calculations?.tienChietKhau),
            discountPercent: num(calculations?.totalDiscountPercent),
          },
        };
  return { payload, snapshot };
}

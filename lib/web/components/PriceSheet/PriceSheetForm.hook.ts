// ⚠️ TỰ SINH — thân component PriceSheetForm của web src/components/PriceSheet/PriceSheetForm.tsx chép NGUYÊN VĂN thành hook (scripts/sync-web-pricing.cjs).
// Bỏ câu return JSX + 2 câu giao diện: 3166, 4646. KHÔNG SỬA TAY.
// @ts-nocheck
/* eslint-disable */
import { templateModeSections, templateModeSteps, salesCompanyRules, validateTemplateName, allowsSaveFallback } from "./templateMode";
import { PRICESHEET_STEPS as STEPS } from "../../_shims/components/PriceSheet/priceSheetConstants";
import { useState, useEffect, useMemo, useRef } from "react";
import { getBdsProductById, listBdsProducts, resolveProjectId } from "../../services/BdsProductService";
import { type Customer360Data } from "../../_stubs/components/PriceSheet/Customer360Tab";
import { ApprovalFlowService } from "../../services/workflows/approvalFlow";
import { type Discount, type Customer, type PaymentSchedule } from "../Products/ContractForm/types";
import { type PolicyDiscountRound, evaluateRoundFormula, type FormulaFieldKey, LOW_EVAL_ORDER, DEFAULT_EVAL_ORDER, roundFormulaText, getDefaultRounds } from "../Products/ContractForm/formulas";
import * as DaSalesPolicyService from "../../services/DaSalesPolicyService";
import { getApprovedPolicyById, getApprovedScheduleById, toPriceListRows, warnPendingScheduleKept } from "../Sales/salesConfig/approvedConfig";
import * as DaPaymentScheduleService from "../../services/DaPaymentScheduleService";
import { useReopenedPolicyDetails } from "../Products/ContractForm/useReopenedPolicyDetails";
import { applySavedFigures, getPaymentFormulaVars as getPaymentFormulaVarsHelper, calculatePaymentScheduleRow as calculatePaymentScheduleRowHelper, getRestoredRoundResults as getRestoredRoundResultsHelper, recalcPaymentScheduleSequential as recalcPaymentScheduleSequentialHelper, scheduleDueDates, mapApiDetailsToFormulas as mapApiDetailsToFormulasHelper, loadRoundsFromCauHinh, mergeConfigRounds, buildRoundsFromPolicyDetails, alignSavedRows, restoredRoundExtras, refreshRoundsFromDetails, keepSavedPrintText, restoreScheduleFromRes, toSavedScheduleItem, enabledRoundsWithResults, removeScheduleRow, scheduleFormulasFromTemplate, templatePrintText } from "../Products/ContractForm/helpers";
import { type CustomerFormModalHandle } from "../../_stubs/pages/customers/quan-ly/khach-hang/types";
import { CustomerService } from "../../_shims/services/Customer";
import { toast } from "../../_shims/sonner";
import { isLowRiseProduct } from "../../utils/productType";
import { usePriceSheetCatalogs } from "./usePriceSheetCatalogs";
import { useSalesCompanyControl, useAutoSalesCompany } from "../shared/salesCompanyControl";
import { useSalesPolicyGate, useCompanyChangeFlag, onSalesCompanyChange } from "../Products/ContractForm/useSalesPolicyGate";
import { autoTemplateKey } from "./print/templates";
import { sessionCompanyCode } from "../../_shims/lib/session";
import { type InterestIncentiveInfo, createInterestIncentiveInfo } from "../../_extract/components/Products/ContractForm/InterestIncentiveFields";
import { useSavedConfigRows } from "../Sales/salesConfig/useSavedConfigRows";
import { firstUuid } from "../Sales/salesConfig/unitFundPriceList";
import { useUnitFundPriceList } from "../Sales/salesConfig/useUnitFundPriceList";
import dayjs from "dayjs";
import { format } from "date-fns";
import { highRiseGocVatPbt, parseNaked, withNakedFormula, nakedRoundVars, highRiseBaseVars, roundRefVars, gomVatPbtVars, mocRoundVar, syncGomVatPbt, highRiseVarSources, nakedRoundResult, nakedPayload } from "../Products/ContractForm/roundVars";
import { lastCountedResult, policyMoc, isSkipRound, luyKeTyLeSeries, skippedRoundResult, countedResults, luyKeTienTyLeAt } from "../Products/ContractForm/mocTinh";
import { useProductCriteria } from "../Products/ContractForm/useProductCriteria";
import { useOptionUsage } from "../Products/ContractForm/useOptionUsage";
import { priceSheetSourcePgc, priorDocOfSheet, priorOptionCtx } from "../Products/ContractForm/priorOptionState";
import { useExceptionAllowIds } from "../Sales/salesConfig/useExceptionAllowIds";
import { allocationRequiredIds, type OptionCtx, withAllocationRequired } from "../Products/ContractForm/optionConditions";
import { listedGomVATPBT, clearRoundOptions, policyRoundFields, shouldSaveRound, savedDetailForRound, savedRoundExtras } from "../Products/ContractForm/discountOptions";
import { useOptionReconcile } from "../Products/ContractForm/useOptionReconcile";
import { useTemplateReplay, tickTemplateOptions, isTemplateReplayBusy, TEMPLATE_REPLAY_BUSY_MESSAGE } from "./useTemplateReplay";
import { ProjectService } from "../../_shims/services/Project";
import { fetchSalesConfigOptions } from "../Sales/salesConfig/useSalesConfigOptions";
import { toIsoDate } from "../../lib/tdttHieuLuc";
import { hdmbLanFromSaved, hdmbLanFromPriceList, hdmbLanPayload } from "../Products/ContractForm/hdmbLanVars";
import { vatCuoiPbtSavedOr, vatCuoiPbtFromPriceList, vatCuoiPbtPayload } from "../Products/ContractForm/vatCuoiPbtVar";
import { applySheetNakedGoc } from "../Products/ContractForm/nakedPriceSource";
import { BanHangService } from "../../_stubs/services/BanHangService";
import { ProductService } from "../../_shims/services/Product";
import { SalesSettingsService } from "../../services/sales/sales-settings";
import { savedFormPrices, pickFormPrices } from "./savedSheetPrices";
import { useProductPriceConfig } from "./useProductPriceConfig";
import { policyExpiryDate, clampSheetExpiry } from "../../lib/priceSheetExpiry";
import { scheduleOutOfEffect, OUT_OF_EFFECT_WARNING } from "../Products/ContractForm/paymentScheduleOptions";
import { pickPriceListForPolicy } from "../Sales/salesConfig/policyScope";
import { DateHelper } from "../../utils/DateHelper";
import { templateTraceOf, withTemplateTrace } from "./templateSheet";
import { buildPriceSheetPrintData } from "./print/printData";
import { templateDuration } from "../../lib/tdttThoiHan";
import { giaoDichKey } from "../../lib/tdttGiaoDich";

export function useWebPriceSheetForm({
  open,
  onOpenChange,
  product: productProp,
  type,
  type2,
  filterCondition,
  contractId,
  maPGC: maPGCProp,
  prefillMaPGC: prefillMaPGCProp,
  fromBooking,
  initialMaKH: initialMaKHProp,
  initialSheet,
  unitFundPreset,
  onSaveSuccess,
  fromTemplate,
  mode = "sheet",
  templateName,
  readOnlyReason,
}: any = {}) {
  const sections = templateModeSections(mode);
  const steps = templateModeSteps(STEPS, sections);
  const maPGC = sections.pgcLink ? maPGCProp : undefined;
  const prefillMaPGC = sections.pgcLink ? prefillMaPGCProp : undefined;
  const initialMaKH = sections.customer ? initialMaKHProp : undefined;
  const [tenMau, setTenMau] = useState(templateName ?? "");
  useEffect(() => {
    if (open) setTenMau(templateName ?? "");
  }, [open, templateName]);
  const [fetchedProduct, setFetchedProduct] = useState<any>(null);
  const product: any = useMemo(
    () =>
      fetchedProduct ? { ...(productProp || {}), ...fetchedProduct } : productProp,
    [productProp, fetchedProduct]
  );
  const lastProductFetchKeyRef = useRef<string>("");
  useEffect(() => {
    let alive = true;
    (async () => {
      if (!open) {
        setFetchedProduct(null);
        lastProductFetchKeyRef.current = "";
        return;
      }
      const p: any = productProp || {};
      const hasPrice =
        Number(p?.DonGiaDaVAT) > 0 ||
        Number(p?.DonGiaChuaVAT) > 0 ||
        Number(p?.DienTichTimTuong) > 0 ||
        Number(p?.DienTichDat) > 0;
      // Ưu tiên khoá chính (uuid) của sản phẩm, chỉ dùng mã căn khi thiếu
      const key = p?.id ?? p?.SanPhamId ?? p?.MaSP ?? p?.ma_sp ?? null;
      const code = p?.KyHieu || p?.code || p?.MaCan || "";
      if (hasPrice || (!key && !code)) return;
      const fetchKey = String(key ?? code);
      if (lastProductFetchKeyRef.current === fetchKey) return;
      lastProductFetchKeyRef.current = fetchKey;
      try {
        let full: any = key ? await getBdsProductById(key) : null;
        if (!full && code) {
          const res = await listBdsProducts({
            MaDA: p?.MaDA,
            InputSearch: code,
            PageSize: 5,
          } as any);
          full =
            (res?.data || []).find(
              (r: any) =>
                String(r?.KyHieu || "").toLowerCase() ===
                String(code).toLowerCase()
            ) || (res?.data || [])[0] || null;
        }
        if (alive && full) setFetchedProduct(full);
      } catch {
        /* không chặn form nếu không đọc được sản phẩm */
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, productProp]);
  const loadDocMaPGC = maPGC ?? prefillMaPGC ?? null;
  const isDocPrefill = !maPGC && !!prefillMaPGC;
  const [currentStep, setCurrentStep] = useState(0);
  const [customer360, setCustomer360] = useState<Customer360Data>({});
  const patchCustomer360 = (patch: Partial<Customer360Data>) =>
    setCustomer360((prev) => ({ ...prev, ...patch }));
  const [isEditMode, setIsEditMode] = useState(false);
  const [editContractData, setEditContractData] = useState<any>(null);
  const [effectiveMaDA, setEffectiveMaDA] = useState<number | null>(null);
  const [hasApprovalFlow, setHasApprovalFlow] = useState(false);
  const approvalProjectKey = String(
    (initialSheet as any)?.da_project_id ?? (product as any)?.da_project_id ?? product?.MaDA ?? effectiveMaDA ?? ""
  );
  useEffect(() => {
    setHasApprovalFlow(false);
    if (!open || type !== "pricesheet" || !approvalProjectKey) return;
    let alive = true;
    (async () => {
      try {
        const projectId = await resolveProjectId(approvalProjectKey);
        if (!projectId) return;
        const flows = await ApprovalFlowService.projectFlows(sections.templateName ? "PRICE_SHEET_TEMPLATE" : "PRICE_SHEET", [projectId]);
        if (alive) setHasApprovalFlow(!!flows?.length);
      } catch {
        /* coi như chưa cài quy trình */
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, type, approvalProjectKey, sections.templateName]);
  const formContentRef = useRef<HTMLDivElement>(null);
  const summaryScrollRef = useRef<HTMLDivElement>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<any>("");
  const expiryPolicyRef = useRef("");
  const selectedPolicyIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedPolicyIdRef.current = selectedPolicyId ? String(selectedPolicyId) : null;
  }, [selectedPolicyId]);
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [selectedDiscountIds, setSelectedDiscountIds] = useState<Set<string>>(
    new Set()
  );
  const [priceSheets, setPriceSheets] = useState<any[]>([]);
  const [selectedPriceSheetId, setSelectedPriceSheetId] = useState<string>("");
  const [priceLists, setPriceLists] = useState<any[]>([]);
  const [selectedPriceListId, setSelectedPriceListId] = useState<string>("");
  const selectedPriceListIdRef = useRef<string>("");
  useEffect(() => {
    selectedPriceListIdRef.current = selectedPriceListId;
  }, [selectedPriceListId]);
  const loadChinhSachKeyRef = useRef<string>("");
  const policyDetailCacheRef = useRef<Map<string, any>>(new Map());
  const configRoundsCacheRef = useRef<Map<string, Promise<PolicyDiscountRound[]>>>(new Map());
  const scheduleDetailCacheRef = useRef<Map<string, Promise<any>>>(new Map());
  const getPolicyDetail = async (templateId: string, plain = false): Promise<any> => {
    // plain: đường khôi phục phiếu đã lưu — đọc bản gốc, không lọc theo trạng thái duyệt
    const key = (plain ? "r:" : "") + String(templateId);
    const cached = policyDetailCacheRef.current.get(key);
    if (cached) return cached;
    const p = (plain ? DaSalesPolicyService.getPolicyById : getApprovedPolicyById)(String(templateId)).catch((e: any) => {
      policyDetailCacheRef.current.delete(key);
      throw e;
    });
    policyDetailCacheRef.current.set(key, p);
    return p;
  };
  const getScheduleDetail = (templateId: string, plain = false): Promise<any> => {
    const key = (plain ? "r:" : "") + String(templateId);
    const cached = scheduleDetailCacheRef.current.get(key);
    if (cached) return cached;
    const p = (plain ? DaPaymentScheduleService.getScheduleById : getApprovedScheduleById)(String(templateId)).catch((e: any) => {
      scheduleDetailCacheRef.current.delete(key);
      throw e;
    });
    scheduleDetailCacheRef.current.set(key, p);
    return p;
  };
  const policyHandledRef = useRef<string>("");
  const scheduleHandledRef = useRef<string>("");
  const [paymentTemplates, setPaymentTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [policyRounds, setPolicyRounds] = useState<PolicyDiscountRound[]>([]);
  const [configRoundsTemplate, setConfigRoundsTemplate] = useState<
    PolicyDiscountRound[]
  >([]);
  const [policyDetailCount, setPolicyDetailCount] = useState<number>(0);
  const policyDetailCountRef = useRef<number>(0);
  const policyDetailRowsRef = useRef<any[]>([]);
  const policyRoundsRunRef = useRef(0);
  const scheduleSnapshotRef = useRef<string>("");
  const restoreTemplateIdRef = useRef<string | null>(null);
  const restorePriceCfgIdRef = useRef<string | null>(null);
  const [policyConfigs, setPolicyConfigs] = useState<any[]>([]);
  const [selectedPolicyConfigId, setSelectedPolicyConfigId] = useState<any>();
  const [inventoryProducts, setInventoryProducts] = useState<any[]>([]);
  const [cauHinhCS, setCauHinhCS] = useState<any[]>([]);
  const [handoverStandard, setHandoverStandard] = useState<string>("");
  const [htlsProgram, setHtlsProgram] = useState<string>("");
  const [productPriceInputs, setProductPriceInputs] = useState<Record<string, any>>({});
  const [lichThanhToan, setLichThanhToan] = useState<any[]>([]);
  const [bangGia, setBangGia] = useState<any[]>([]);
  const [chinhSachBH, setChinhSachBH] = useState<any[]>([]);
  const [chinhSachBHDetails, setChinhSachBHDetails] = useState<any[]>([]);
  const selectedPolicyRow: any = chinhSachBH.find((c: any) => String(c?.ID) === String(selectedPolicyId));
  const reopenDetails = useReopenedPolicyDetails(selectedPolicyId, async (id) => {
    const res = await getPolicyDetail(id, true);
    // Lỗi tải không ném lỗi: bỏ khỏi bộ nhớ tạm để lần sau tải lại được
    if (res?.status !== 2000) policyDetailCacheRef.current.delete(`r:${id}`);
    return res;
  }, (details) => {
    policyDetailRowsRef.current = details;
    setChinhSachBHDetails(details);
  });
  const [khuyenMai, setKhuyenMai] = useState<any[]>([]);
  const [selectedInventoryProductId, setSelectedInventoryProductId] =
    useState<string>("");
  const [productSelectionCollapsed, setProductSelectionCollapsed] =
    useState(false);
  const [selectedPromotionId, setSelectedPromotionId] =
    useState<any>(undefined);
  const [selectedPromotion, setSelectedPromotion] = useState([]);
  const [selectKey, setSelectKey] = useState(0);
  const [pendingRestoreChinhSach, setPendingRestoreChinhSach] = useState<
    any[] | null
  >(null);
  const [pendingRestoreLichTT, setPendingRestoreLichTT] = useState<
    any[] | null
  >(null);
  const [restoredChinhSachSnapshot, setRestoredChinhSachSnapshot] = useState<
    any[] | null
  >(null);
  const [financialEdited, setFinancialEdited] = useState(false);
  const restorePolicyConfigIdRef = useRef<any>(null);
  const skipPolicyAutoCalcRef = useRef(false);
  const [bookingRestoreInfo, setBookingRestoreInfo] = useState<{
    maCS: any;
    maCSTong: any;
    maTDTT: any;
    hasSavedSchedule?: boolean;
  } | null>(null);
  const bookingRestoreDoneRef = useRef(false);
  const restoreRoundsRef = useRef<any[] | null>(null);
  const autoAppliedPolicyKeyRef = useRef<string>("");
  const [restoreRoundsTick, setRestoreRoundsTick] = useState(0);
  const restoredSnapshotRef = useRef<any[] | null>(null);
  useEffect(() => {
    restoredSnapshotRef.current = restoredChinhSachSnapshot;
  }, [restoredChinhSachSnapshot]);
  const markFinancialEdited = () => {
    const snap = restoredSnapshotRef.current;
    if (snap?.length) {
      // Giữ nguyên số liệu CK đã khôi phục của TỪNG dòng, chỉ dòng người dùng
      // thao tác mới thay đổi (tránh mất toàn bộ CK khi bật/tắt 1 dòng).
      setPolicyRounds((prev) => applySavedFigures(prev, snap));
      restoredSnapshotRef.current = null;
    }
    setFinancialEdited(true);
    restoreRoundsRef.current = null;
    setRestoredChinhSachSnapshot(null);
    setPendingRestoreChinhSach(null);
    setPendingRestoreLichTT(null);
  };
  const [loading, setLoading] = useState(false);
  const [coOwners, setCoOwners] = useState<any[]>([]);
  const customerFormRef = useRef<CustomerFormModalHandle>(null);
  const handleAddCoOwnerFromForm = async (data: any) => {
    const isPersonal = (data?.activeTab || "individual") === "individual";

    // Lưu khách hàng vào DB để có MaKH gắn vào hợp đồng
    let maKH: any = null;
    try {
      const payload: any = {
        IsPersonal: isPersonal,
        TenKH: isPersonal ? data?.TenKH : data?.TenCongTy,
        MaQD: data?.MaQD ?? null,
        SoCMND: data?.SoCMND || null,
        NgayCap: data?.NgayCap || null,
        NoiCap: data?.NoiCap || null,
        DiDong: data?.DiDong || null,
        Email: data?.Email || null,
        ThuongTru: data?.ThuongTru || null,
        DiaChi: data?.DiaChi || null,
        TenCongTy: data?.TenCongTy || null,
        MaSoThueCT: data?.MaSoThueCT || null,
        DiaChiCT: data?.DiaChiCT || null,
        EmailCT: data?.EmailCT || null,
        DienThoaiCT: data?.DienThoaiCT || null,
        NguoiDaiDienPL: !isPersonal ? data?.NguoiDaiDienPL : null,
        ChucVu: data?.ChucVu || null,
      };
      // Người đồng đứng tên thêm mới (chưa có MaKH) ⇒ không ghi đè khách trùng CCCD/SĐT trong phạm vi (BUG-001, TK4)
      const res: any = await CustomerService.upcert(payload, { forceNew: true });
      if (res?.status !== 2000) {
        throw new Error(res?.message || "Không thể lưu khách hàng");
      }
      maKH = res?.data ?? null;
    } catch (err: any) {
      toast.error(err?.message || "Có lỗi khi tạo khách hàng");
      return;
    }

    setCoOwners((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        IsPersonal: isPersonal,
        MaKH: maKH,
        MaQD: data?.MaQD ?? null,
        TenKH: data?.TenKH || "",
        SoCMND: data?.SoCMND || "",
        NgayCap: data?.NgayCap || null,
        NoiCap: data?.NoiCap || "",
        DiDong: data?.DiDong || "",
        Email: data?.Email || "",
        ThuongTru: data?.ThuongTru || "",
        DiaChi: data?.DiaChi || "",
        TenCongTy: data?.TenCongTy || "",
        MaSoThueCT: data?.MaSoThueCT || "",
        DienThoaiCT: data?.DienThoaiCT || "",
        DiaChiCT: data?.DiaChiCT || "",
        EmailCT: data?.EmailCT || "",
        NguoiDaiDienPL: data?.NguoiDaiDienPL || "",
        ChucVu: data?.ChucVu || "",
      },
    ]);
    toast.success("Đã thêm người đồng đứng tên");
  };
  const removeCoOwnerByPascal = (id: string) => {
    setCoOwners((prev) => prev.filter((c) => c.id !== id));
  };
  const [showCoOwnerDialog, setShowCoOwnerDialog] = useState(false);
  const [coOwnerType, setCoOwnerType] = useState<"individual" | "business">(
    "individual"
  );
  const [coOwnerForm, setCoOwnerForm] = useState({
    title: "",
    name: "",
    cmnd: "",
    ngayCap: null as Date | null,
    noiCap: "",
    phone: "",
    email: "",
    diaChi: "",
    diaChiLH: "",
    tenDoanhNghiep: "",
    maSoThue: "",
    nguoiDaiDien: "",
    chucVu: "",
    maKH: null,
  });
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [duplicateCMND, setDuplicateCMND] = useState<Customer | null>(null);
  const [duplicatePhone, setDuplicatePhone] = useState<Customer | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null
  );
  const [coOwnerDuplicateCMND, setCoOwnerDuplicateCMND] =
    useState<Customer | null>(null);
  const [coOwnerDuplicatePhone, setCoOwnerDuplicatePhone] =
    useState<Customer | null>(null);
  const [coOwnerSearch, setCoOwnerSearch] = useState("");
  const [showCoOwnerCustomerDropdown, setShowCoOwnerCustomerDropdown] =
    useState(false);
  const [selectedCoOwnerCustomerId, setSelectedCoOwnerCustomerId] = useState<
    string | null
  >(null);
  const [formData, setFormData] = useState({
    customerType: "individual" as "individual" | "business",
    MaQD: null,
    TenKH: null,
    NgaySinh: null as Date | null,
    SoCMND: null,
    NgayCap: null as Date | null,
    NoiCap: null,
    DiDong: null,
    DiDong2: null,
    Email: null,
    Email2: null,
    MaSoTTNCN: null,
    SoTaiKhoan: null,
    TenNganHang: null,
    MaSoKH: null,
    DiaChi: null,
    ThuongTru: null,
    TenCongTy: null,
    MaSoThueCT: null,
    DiaChiCT: null,
    DienThoaiCT: null,
    EmailCT: null,
    NguoiDaiDienPL: null,
    ChucVu: null,
    NoiCapGPKD: null,
    NgayCapGPKD: null as Date | null,
    SoGPKD: null,
    duAn: product?.project_name || product?.TenDA || "",
    maSanPham: product?.code || product?.KyHieu || "",
    loaiSP: product?.product_type || "Chung cư",
    tang: product?.floor ?? (product?.Tang ? Number(product.Tang) : 0),
    dienTichTimTuong:
      (product as any)?.wall_area ?? product?.DTTimDuong ?? product?.area ?? 0,
    dienTichThongThuy: product?.DienTichThongThuy ?? product?.area ?? 0,
    donGiaDatPhanBo: (product as any)?.DGDatPB ?? 0,
    huong:
      (product as any)?.direction ||
      product?.TenHuongCua ||
      product?.TenHuongBC ||
      "",
    dienTichDat: product?.land_area ?? (product as any)?.DienTichDat ?? 0,
    donGiaDat: product?.land_unit_price ?? (product as any)?.DonGiaDat ?? 0,
    dienTichXD: product?.construction_area ?? (product as any)?.DienTichXD ?? 0,
    tongDTSanXD:
      product?.total_floor_area ?? (product as any)?.TongDTSanXD ?? 0,
    donGiaXD:
      product?.construction_unit_price ??
      (product as any)?.DonGiaXD ??
      product?.DonGiaXayDung ??
      0,
    donGiaSuDungDat: isLowRiseProduct({
      product,
      maSP:
        (product as any)?.code || product?.KyHieu || (product as any)?.MaCan,
    })
      ? product?.land_unit_price ?? (product as any)?.DonGiaDat ?? 0
      : (product as any)?.unit_price_before_vat ??
      product?.DonGiaDaVAT ??
      product?.DonGiaChuaVAT ??
      0,
    tyLeVAT: product?.TyLeVAT ?? 10,
    tyLePBT: product?.TyLePhiBaoTri ?? 2,
    rawDonGiaChuaVAT: (product as any)?.DonGiaChuaVAT ?? null,
    rawDonGiaDaVAT: (product as any)?.DonGiaDaVAT ?? null,
    rawTongGiaChuaVAT: (product as any)?.TongGiaChuaVAT ?? null,
    rawTongGiaDaVAT: (product as any)?.TongGiaDaVAT ?? null,
    rawGiaNaked: (product as any)?.GiaNaked ?? null,
    rawGiaHDMBLan: null as (number | null)[] | null,
    // 5%VAT cuối + PBT: undefined = chưa nạp bảng giá (lưu phiếu không ghi khoá), null = bảng giá trống
    rawVATCuoiPBT: undefined as number | null | undefined,
    rawTienVAT: (product as any)?.TienVAT ?? null,
    rawTienPhiBaoTri: (product as any)?.TienPhiBaoTri ?? null,
    rawTongGomPBT: (product as any)?.TongGomPBT ?? null,
    rawTienDatChuaVAT:
      (product as any)?.rawTienDatChuaVAT ??
      (product as any)?.GiaDatKoVAT ??
      (product as any)?.GiaDatChuaVAT ??
      null,
    rawTienVATDat:
      (product as any)?.rawTienVATDat ?? (product as any)?.VATDat ?? null,
    rawTongTienDatVAT:
      (product as any)?.rawTongTienDatVAT ??
      (product as any)?.TongGiaDat ??
      null,
    rawTienSDDat:
      (product as any)?.rawTienSDDat ?? (product as any)?.TienSDDat ?? null,
    rawThanhTienXD:
      (product as any)?.rawThanhTienXD ?? (product as any)?.ThanhTienXD ?? null,
    rawTienVATXD:
      (product as any)?.rawTienVATXD ??
      (product as any)?.TienVATXayDung ??
      null,
    rawTongGiaXDVAT:
      (product as any)?.rawTongGiaXDVAT ??
      (product as any)?.ThanhTienVATXayDung ??
      null,
    rawTongGiaTriHDMB:
      (product as any)?.rawTongGiaTriHDMB ??
      (product as any)?.TongGiaTriHDMB ??
      null,
    rawTyLeVATXD:
      (product as any)?.rawTyLeVATXD ??
      (product as any)?.TyLeVATXayDung ??
      null,
    tongChuaVAT: 0,
    tienVAT: 0,
    tongGomVAT: 0,
    phiBaoTri: 0,
    tongGiaVATPBT: 0,
    soHopDong: "",
    ngayKy: new Date() as Date | null,
    /** Ngày hết hạn phiếu 'YYYY-MM-DD' (mặc định = hạn CSBH) */
    ngayHetHan: null as string | null,
    ngayBanGiao: null as Date | null,
    tienCoc: 50000000,
    ghiChu: "",
    nhanVienKD: "Admin",
    maNVKD: null as number | null,
    maSan: null as number | null,
  });
  const {
    nhanVien: listNhanVienKD,
    sanGiaoDich: listSanGiaoDich,
    quyDanh: quyDanhOptions,
    nganHang: nganHangOptions,
  } = usePriceSheetCatalogs(open);
  const [congTyBanHangId, setCongTyBanHangId] = useState<string | null>(null);
  const [congTyBanHangTen, setCongTyBanHangTen] = useState<string | null>(null);
  const {
    options: salesCompanyOptions,
    nameOf: nameOfCongTyBanHang,
    disabled: salesCompanyLocked, required: salesCompanyRequired, autoId: salesCompanyAutoId, loadFailed: salesCompanyLoadFailed,
    viewer: optionViewer,
  } = useSalesCompanyControl(congTyBanHangId, congTyBanHangTen);
  const salesCompanyRule = salesCompanyRules(sections, !!salesCompanyRequired);
  useAutoSalesCompany(salesCompanyAutoId, congTyBanHangId, setCongTyBanHangId, open && salesCompanyRule.autoFill);
  const gate = useSalesPolicyGate(congTyBanHangId, salesCompanyRule.gateReadOnly, salesCompanyLoadFailed);
  const { changed: companyChanged, mark: markCompanyChanged, reset: resetCompanyChanged } = useCompanyChangeFlag();
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentSchedule[]>([]);
  const printTemplate = useMemo(() => autoTemplateKey(paymentSchedule, sessionCompanyCode()), [paymentSchedule]);
  const savedPrintScheduleRef = useRef<any[] | null>(null);
  const [appliedDiscounts, setAppliedDiscounts] = useState<any[]>([]);
  const [paymentSchedules, setPaymentSchedules] = useState<any[]>([]);
  const [promotionsRaw, setPromotionsRaw] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [interestIncentive, setInterestIncentive] =
    useState<InterestIncentiveInfo>(createInterestIncentiveInfo());
  const [rightTab, setRightTab] = useState<"contract" | "interest">("contract");
  const [loadingPolicies, setLoadingPolicies] = useState(false);
  const [policiesLoadedMaDA, setPoliciesLoadedMaDA] = useState<string | null>(null);
  const catalogMaDA = String(product?.MaDA ?? effectiveMaDA ?? "");
  const policyCatalogReady =
    !loadingPolicies && (!catalogMaDA || policiesLoadedMaDA === catalogMaDA);
  useSavedConfigRows({ policyId: selectedPolicyId, scheduleId: selectedTemplateId, loaded: policiesLoadedMaDA !== null, policies: chinhSachBH, setPolicies: setChinhSachBH, schedules: lichThanhToan, setSchedules: setLichThanhToan });
  const productUuid =
    firstUuid(
      product?.SanPhamId,
      product?.san_pham_id,
      product?.ProductId,
      product?.id,
      editContractData?.SanPhamId,
      editContractData?.san_pham_id
    ) ?? undefined;
  const unitFund = useUnitFundPriceList({
    open,
    isNewDoc: !contractId && !loadDocMaPGC && !initialSheet,
    priceLists:
      loadingPolicies || policiesLoadedMaDA === null
        ? null
        : bangGia.map((b) => ({ id: String(b.ID), label: b.TenDot, ma_quy_can: b.ma_quy_can, has_product: b.has_product })),
    selectedPriceListId,
    onPick: (id) => handleBG(id ?? undefined),
    // Phiếu tính giá: điền sẵn theo bộ lọc lưới, vẫn cho đổi quỹ căn
    preset: unitFundPreset,
  });
  const [loadingPriceCalc, setLoadingPriceCalc] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [loadingPriceList, setLoadingPriceList] = useState(false);
  const [savingCoOwner, setSavingCoOwner] = useState(false);
  useEffect(() => {
    if (open) isSavingRef.current = false;
  }, [open]);
  const prevOpenRef = useRef(open);
  useEffect(() => {
    const wasOpen = prevOpenRef.current;
    prevOpenRef.current = open;
    // Mở lại form ⇒ Ngày tính mặc định hôm nay (không giữ ngày của lần mở trước);
    // phiếu đang sửa / nạp từ chứng từ ghi đè bằng ngày đã lưu ở các effect nạp phía dưới
    if (!wasOpen && open) {
      setFormData((prev) => ({ ...prev, ngayKy: new Date() }));
      return;
    }
    if (!wasOpen || open) return;
    // Số phiếu của phiếu vừa sửa / vừa lưu không được mang sang lần "Thêm" sau (effect sinh mã giữ số đang có)
    expiryPolicyRef.current = "";
    setFormData((prev) => ({ ...prev, soHopDong: "", ngayKy: new Date(), ngayHetHan: null }));
    setCurrentStep(0);
    setCustomer360({});
    setIsEditMode(false);
    setEditContractData(null);
    setCongTyBanHangId(null);
    setCongTyBanHangTen(null);
    setEffectiveMaDA(null);
    setSelectedPolicyId("");
    setDiscounts([]);
    setSelectedDiscountIds(new Set());
    setPriceSheets([]);
    setSelectedPriceSheetId("");
    setPriceLists([]);
    setSelectedPriceListId("");
    setPaymentTemplates([]);
    setSelectedTemplateId("");
    setPolicyRounds([]);
    setConfigRoundsTemplate([]);
    setPolicyDetailCount(0);
    setPolicyConfigs([]);
    setSelectedPolicyConfigId(undefined);
    setInventoryProducts([]);
    setCauHinhCS([]);
    savedPrintScheduleRef.current = null;
    setHandoverStandard("");
    setHtlsProgram("");
    setProductPriceInputs({});
    restorePriceCfgIdRef.current = null;
    setLichThanhToan([]);
    policyDetailCacheRef.current.clear();
    configRoundsCacheRef.current.clear();
    scheduleDetailCacheRef.current.clear();
    policyHandledRef.current = "";
    scheduleHandledRef.current = "";
    setBangGia([]);
    setChinhSachBH([]);
    setChinhSachBHDetails([]);
    setKhuyenMai([]);
    setSelectedInventoryProductId("");
    setProductSelectionCollapsed(false);
    setSelectedPromotionId(undefined);
    setSelectedPromotion([]);
    setPendingRestoreChinhSach(null);
    setPendingRestoreLichTT(null);
    setRestoredChinhSachSnapshot(null);
    setFinancialEdited(false); resetCompanyChanged();
    setCoOwners([]);
    setPaymentSchedule([]);
    setAppliedDiscounts([]);
    setPaymentSchedules([]);
    setPromotionsRaw([]);
    setInterestIncentive(createInterestIncentiveInfo());
    setRightTab("contract");
    restorePolicyConfigIdRef.current = null;
    restoreRoundsRef.current = null;
    autoAppliedPolicyKeyRef.current = "";
    loadChinhSachKeyRef.current = "";
    lateRestoreConfigRef.current = "";
    policyDetailCountRef.current = 0;
    policyDetailRowsRef.current = [];
    reopenDetails.reset();
    policyRoundsRunRef.current += 1;
    scheduleSnapshotRef.current = "";
    restoreTemplateIdRef.current = null;
    skipPolicyAutoCalcRef.current = false;
    calcBaseSigRef.current = null;
    setPoliciesLoadedMaDA(null);
    policyDetailCacheRef.current = new Map();
  }, [open]);
  const [customerOptions, setCustomerOptions] = useState([]);
  const [loadingKH, setLoadingKH] = useState(false);
  const searchTimeoutRef = useRef(null);
  const customerSearchReqIdRef = useRef(0);
  const coOwnerSearchReqIdRef = useRef(0);
  const [coOwnerOptions, setCoOwnerOptions] = useState<any[]>([]);
  const [loadingCoOwnerKH, setLoadingCoOwnerKH] = useState(false);
  const coOwnerSearchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const coOwnerRef = useRef<any>(null);
  const [contractData, setContractData] = useState({
    chinhSachList: [] as any[],
    lichThanhToanList: [] as any[],
    khuyenMaiList: [] as any[],
    khachHangObj: {} as any,
    sanPhamObj: {} as any,
    hopDongObj: {} as any,
  });
  useEffect(() => {
    const el = summaryScrollRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  });
  const latestCalculationsRef = useRef<any>({});
  const latestHdmbLanRef = useRef<(number | null)[] | null>(null);
  const latestVatCuoiPbtRef = useRef<number | null>(null);
  const formulaCtx = () => ({
    calculations: latestCalculationsRef.current,
    rawTongGiaChuaVAT: (formData as any).rawTongGiaChuaVAT,
    // Giá HĐMB chưa TT lần 1…6 của bảng giá (biến GiaTriHDMBLan{n})
    giaHDMBLan: latestHdmbLanRef.current,
    // 5%VAT cuối + PBT của bảng giá (biến VATCuoiPBT)
    vatCuoiPBT: latestVatCuoiPbtRef.current,
  });
  const getPaymentFormulaVars = (
    tyLeTT: number,
    tyLeVAT: number,
    tyLePBT: number,
    soTien?: number,
    tienVAT?: number,
    tienBaoTri?: number,
    prevSums?: {
      tuongUng?: number;
      vat?: number;
      pbt?: number;
      tongCong?: number;
      tienCoc?: number;
      vonTuCo?: number;
      vayNH?: number;
      nextTongCong?: number;
    },
    tyLeXD?: number,
    tienCoc?: number,
    vonVay?: Parameters<typeof getPaymentFormulaVarsHelper>[10]
  ) =>
    getPaymentFormulaVarsHelper(
      formulaCtx(),
      tyLeTT,
      tyLeVAT,
      tyLePBT,
      soTien,
      tienVAT,
      tienBaoTri,
      prevSums,
      tyLeXD,
      tienCoc,
      vonVay
    );
  const calculatePaymentScheduleRow = (
    row: PaymentSchedule,
    prevSums?: {
      tuongUng?: number;
      vat?: number;
      pbt?: number;
      tongCong?: number;
      tienCoc?: number;
      vonTuCo?: number;
      vayNH?: number;
    },
    forceRecalc = false
  ) =>
    calculatePaymentScheduleRowHelper(row, formulaCtx(), prevSums, forceRecalc);
  const getRestoredRoundResults = (
    csArr: any[],
    isLowRise: boolean,
    ctx?: Parameters<typeof getRestoredRoundResultsHelper>[2]
  ) => getRestoredRoundResultsHelper(csArr, isLowRise, ctx);
  const recalcPaymentScheduleSequential = (
    rows: PaymentSchedule[],
    forceRecalc = false
  ) => recalcPaymentScheduleSequentialHelper(rows, formulaCtx(), forceRecalc);
  const dueDatesOf = (rows: PaymentSchedule[]) =>
    scheduleDueDates(rows, (row) => {
      if (!formData.ngayKy) return null;
      const unit = row.theoThang || Number(row.maLoaiNgay) === 2 ? "month" : "day";
      return dayjs(formData.ngayKy).add(Number(row.soNgay) || 0, unit).format("YYYY-MM-DDT00:00:00") + "+07:00";
    });
  const calculations = useMemo(() => {
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
  }, [
    formData.loaiSP,
    formData.dienTichThongThuy,
    formData.donGiaSuDungDat,
    formData.tyLeVAT,
    formData.tyLePBT,
    formData.tienCoc,
    formData.dienTichDat,
    formData.donGiaDat,
    formData.tongDTSanXD,
    formData.donGiaXD,
    formData.tongChuaVAT,
    formData.tienVAT,
    formData.tongGomVAT,
    formData.phiBaoTri,
    formData.tongGiaVATPBT,
    (formData as any).rawTongGiaChuaVAT,
    (formData as any).rawTongGiaDaVAT,
    (formData as any).rawTienVAT,
    (formData as any).rawGiaNaked,
    (formData as any).rawTienPhiBaoTri,
    (formData as any).rawTongGomPBT,
    selectedDiscountIds,
    discounts,
    policyRounds,
    restoredChinhSachSnapshot,
    financialEdited,
  ]);
  latestCalculationsRef.current = calculations;
  latestHdmbLanRef.current = (formData as any).rawGiaHDMBLan ?? null;
  latestVatCuoiPbtRef.current = (formData as any).rawVATCuoiPBT ?? null;
  const hdmbLanSig = JSON.stringify([(formData as any).rawGiaHDMBLan ?? null, (formData as any).rawVATCuoiPBT ?? null]);
  const calcBaseSigRef = useRef<string | null>(null);
  useEffect(() => {
    // Chữ ký cơ sở tính (giá trị sau CK, VAT, PBT...). Nếu cơ sở này thay đổi
    // so với lần tính trước (VD: áp/bỏ chiết khấu, đổi CSBH) thì các dòng lịch
    // thanh toán cũ đang giữ số từ phiếu sẽ bị SAI so với công thức đang hiển thị
    // → phải ép tính lại toàn bộ, kể cả dòng restoredFromMaPGC.
    const baseSig = [
      calculations.giaTriSauCK,
      calculations.tongChuaVAT,
      calculations.tongGomVAT,
      calculations.tongGiaTriHD,
      calculations.tongGiaTriHDMB,
      calculations.tienVAT,
      calculations.phiBaoTri,
    ]
      .map((v) => Math.round(Number(v) || 0))
      .join("|");

    const prevSig = calcBaseSigRef.current;
    const baseChanged = prevSig !== null && prevSig !== baseSig;
    calcBaseSigRef.current = baseSig;

    setPaymentSchedule((prev) =>
      recalcPaymentScheduleSequential(prev, financialEdited || baseChanged)
    );
  }, [
    calculations.giaTriSauCK,
    calculations.tongChuaVAT,
    calculations.tongGomVAT,
    calculations.tongGiaTriHD,
    calculations.tongGiaTriHDMB,
    calculations.tienVAT,
    calculations.phiBaoTri,
    financialEdited,
    policyRounds,
    hdmbLanSig,
  ]);
  const mapApiDetailsToFormulas = (
    details: any[],
    isLow: boolean,
    isFirst: boolean
  ) => mapApiDetailsToFormulasHelper(details, isLow, isFirst);
  const criteria = useProductCriteria(
    product,
    (product as any)?.ID ?? (product as any)?.id ?? (product as any)?.SanPhamId ?? (product as any)?.MaSP ?? formData.maSanPham,
    effectiveMaDA ?? (product as any)?.MaDA
  );
  const optionHighRise = !isLowRiseProduct({ loaiSP: formData.loaiSP, product, maSP: formData.maSanPham });
  const optionChecked = optionHighRise && sections.optionChecks;
  const optionUsage = useOptionUsage(optionChecked ? selectedPolicyId || null : null, priceSheetSourcePgc(loadDocMaPGC, initialSheet));
  const exceptionIds = useExceptionAllowIds(priceSheetSourcePgc(loadDocMaPGC, initialSheet));
  const optionNgay = formData.ngayKy ? dayjs(formData.ngayKy).format("YYYY-MM-DD") : undefined;
  const priorSheet = useMemo(() => priorDocOfSheet(initialSheet), [initialSheet]);
  const allocRequired = useMemo(() => allocationRequiredIds(chinhSachBHDetails), [chinhSachBHDetails]);
  const optionCtx = useMemo<OptionCtx | undefined>(
    () =>
      optionChecked
        ? {
            loaiCan: criteria.loaiCan,
            toaId: criteria.toaId,
            phongNguId: criteria.phongNguId,
            viTriId: criteria.viTriId,
            tangId: criteria.tangId,
            giaGomVAT: listedGomVATPBT(formData),
            lichTTId: selectedTemplateId || undefined,
            pending: criteria.loading || optionUsage.loading,
            ngay: optionNgay,
            usage: optionUsage.usage,
            congTyBanHangId, usageByCompany: optionUsage.usageByCompany,
            khoStock: optionUsage.khoStock, projectId: String(effectiveMaDA ?? (product as any)?.MaDA ?? "") || undefined,
            ...priorOptionCtx(priorSheet, selectedPolicyId, true),
            allocationRequiredIds: allocRequired,
            viewer: optionViewer,
          }
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [optionChecked, criteria.loaiCan, criteria.toaId, criteria.phongNguId, criteria.viTriId, criteria.tangId, criteria.loading, (formData as any).rawTongGiaDaVAT, formData.dienTichThongThuy, formData.donGiaSuDungDat, selectedTemplateId, optionNgay, optionUsage.usage, optionUsage.loading, congTyBanHangId, optionUsage.usageByCompany, optionUsage.khoStock, effectiveMaDA, priorSheet, selectedPolicyId, allocRequired, optionViewer]
  );
  const optionCtxRef = useRef(optionCtx);
  optionCtxRef.current = optionCtx;
  useOptionReconcile(policyRounds, setPolicyRounds, optionCtx ? { ...optionCtx, onlyAllocated: !!(contractId || loadDocMaPGC || initialSheet) && !financialEdited } : {}, !!optionCtx && !criteria.loading && !optionUsage.loading && (!contractId && !loadDocMaPGC && !initialSheet || financialEdited || companyChanged), markFinancialEdited);
  const policyRoundsRef = useRef(policyRounds);
  policyRoundsRef.current = policyRounds;
  const replayIdle = policyCatalogReady && !loadingPriceCalc && !loadingPriceList && !loadingSchedule;
  const { step: templateReplayStep } = useTemplateReplay({
    open,
    seed: fromTemplate,
    ready: {
      // Chờ phiếu mới tự chọn quỹ căn + bảng giá xong rồi mới đổi theo mẫu (2 lần nạp bảng giá không chạy chồng nhau)
      funds: replayIdle && !!unitFund.quyCanId,
      // Danh mục quỹ căn tải lỗi / rỗng ⇒ quyCanId không bao giờ có: bỏ bước quỹ căn thay vì chờ mãi (khóa Lưu)
      fundsUnavailable: replayIdle && !unitFund.quyCanId && unitFund.fundsLoaded && unitFund.funds.length === 0,
      salesCompanies: !salesCompanyRequired || !!salesCompanyLoadFailed || (salesCompanyOptions.length > 0 && !(salesCompanyAutoId && !congTyBanHangId)),
      policies: replayIdle,
      priceLists: replayIdle,
      schedules: replayIdle,
      rounds: replayIdle && !optionCtx?.pending,
    },
    salesCompanyLocked,
    actions: {
      changeUnitFund: (id) => unitFund.change(id),
      setSalesCompany: (id) => onSalesCompanyChange(congTyBanHangId, id, setCongTyBanHangId, markCompanyChanged),
      selectPolicy: (id) => handleSelectCSBH(id),
      selectPriceList: (id) => {
        policyPickedRef.current = null; // không để effect tự chuyển bảng giá theo chính sách ghi đè bảng giá của mẫu
        return handleBG(id ?? undefined);
      },
      selectSchedule: (id) => handleTemplateSelect(id),
      applyPickedOptions: (ids) => {
        const out = tickTemplateOptions(policyRoundsRef.current, ids, optionCtxRef.current);
        markFinancialEdited();
        setPolicyRounds(out.rounds);
        return { dropped: out.dropped, missing: out.missing };
      },
      applyPromotions: (kmArr) => {
        // Như khôi phục KhuyenMai của phiếu đã lưu
        setPromotionsRaw(kmArr);
        setSelectedPromotionId(kmArr[0]?.PromotionID);
        setSelectedPromotion(kmArr.map((g) => ({ ID: g.PromotionID, TenQuaTang: g.TieuDe, SoLuong: g.SoLuong, GiaTri: g.SoTien })) as unknown as typeof selectedPromotion);
      },
    },
    notify: (msg) => toast.info(msg),
  });
  const templateReplayBusy = isTemplateReplayBusy(fromTemplate, templateReplayStep);
  const loadRoundsFromApi = async (configId: any, isLow: boolean) => {
    if (!configId) {
      setConfigRoundsTemplate([]);
      setPolicyRounds(getDefaultRounds(isLow ? "low" : "high"));
      return [] as PolicyDiscountRound[];
    }
    setLoadingPriceCalc(true);
    try {
      // Vòng công thức theo cấu hình: mỗi cấu hình chỉ gọi 1 lần / lần mở form
      const cacheKey = `${configId}|${isLow ? "low" : "high"}`;
      let pending = configRoundsCacheRef.current.get(cacheKey);
      if (!pending) {
        pending = loadRoundsFromCauHinh(
          configId,
          isLow,
          {
            getDetailById: ProjectService.CauHinh.getDetailById,
            getDetailByIdByDetail: ProjectService.CauHinh.getDetailByIdByDetail,
          },
          getDefaultRounds
        ).catch((e: any) => {
          configRoundsCacheRef.current.delete(cacheKey);
          throw e;
        });
        configRoundsCacheRef.current.set(cacheKey, pending);
      }
      const built = await pending;
      setConfigRoundsTemplate(built);
      // CHỈ lấy CÔNG THỨC từ cấu hình tính giá; số dòng theo chi tiết chính
      // sách, tên / CK% / hệ số / tiền CK của dòng đang có được giữ lại.
      const detailCount = policyDetailCountRef.current || policyDetailCount;
      setPolicyRounds((prev) => mergeConfigRounds(prev, built, detailCount));
      return built;
    } catch {
      setConfigRoundsTemplate([]);
      setPolicyRounds(getDefaultRounds(isLow ? "low" : "high"));
      return [] as PolicyDiscountRound[];
    } finally {
      setLoadingPriceCalc(false);
    }
  };
  const applyCsbhDetailsToRounds = (
    details: any[],
    soChietKhau?: number,
    templateOverride?: PolicyDiscountRound[]
  ) => {
    policyDetailRowsRef.current = Array.isArray(details) ? details : [];
    const template = templateOverride ?? configRoundsTemplate;
    const policyCount = details.length || Number(soChietKhau) || 0;
    policyDetailCountRef.current = policyCount;
    setPolicyDetailCount(policyCount);
    if (!template.length) {
      // Chưa có template ⇒ chỉ cập nhật theo prev hiện có
      setPolicyRounds((prev) => {
        const limited =
          details.length > 0 ? prev.slice(0, details.length) : prev;
        return limited.map((round, idx) => {
          const d = details[idx];
          if (!d) return clearRoundOptions(round);
          return {
            ...round,
            name: d?.TenChietKhau || round.name,
            ...policyRoundFields(d, withAllocationRequired(optionCtxRef.current, details)),
          };
        });
      });
      return;
    }
    if (!details.length) {
      setPolicyRounds(
        template.map((r) => ({ ...r, discountPercent: 0, heSo: 1, tienCK: 0 }))
      );
      return;
    }
    setPolicyRounds(buildRoundsFromPolicyDetails(details, template, optionCtxRef.current));
  };
  useEffect(() => {
    if (!open || !selectedPolicyId) return;
    if (!configRoundsTemplate.length) return;
    // Đang khôi phục dữ liệu đã lưu của phiếu, hoặc người dùng đã chỉnh sửa
    // (đổi chính sách tự áp lại, bật/tắt 1 dòng không được đè cả bảng) ⇒ không ghi đè
    if (
      financialEdited ||
      skipPolicyAutoCalcRef.current ||
      restoreRoundsRef.current ||
      pendingRestoreChinhSach ||
      restoredChinhSachSnapshot?.length ||
      bookingRestoreInfo
    )
      return;
    const key = `${selectedPolicyId}|${selectedPolicyConfigId ?? ""}|${configRoundsTemplate.length}`;
    if (autoAppliedPolicyKeyRef.current === key) return;
    autoAppliedPolicyKeyRef.current = key;
    let cancelled = false;
    (async () => {
      try {
        const res = await getPolicyDetail(String(selectedPolicyId));
        if (cancelled) return;
        const details: any[] = res?.detail || [];
        if (!details.length) return;
        setChinhSachBHDetails(details);
        applyCsbhDetailsToRounds(details, details.length, configRoundsTemplate);
      } catch {
        autoAppliedPolicyKeyRef.current = "";
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    selectedPolicyId,
    selectedPolicyConfigId,
    configRoundsTemplate,
    financialEdited,
    pendingRestoreChinhSach,
    restoredChinhSachSnapshot,
    bookingRestoreInfo,
  ]);
  const maxRounds = (() => {
    const cfg = configRoundsTemplate.length;
    const pol = policyDetailCount;
    if (cfg > 0) return cfg;
    if (pol > 0) return pol;
    return Infinity;
  })();
  const canAddRound =
    policyRounds.length < maxRounds && configRoundsTemplate.length > 0;
  const handlePolicyConfigChange = async (
    configId: string,
    userTriggered = true
  ) => {
    if (userTriggered) markFinancialEdited();
    setSelectedPolicyConfigId(configId);
    const isLow = isLowRiseProduct({
      loaiSP: formData.loaiSP,
      product,
      maSP: formData.maSanPham,
    });
    const built = await loadRoundsFromApi(configId, isLow);
    if (userTriggered && selectedPolicyId) {
      try {
        const res = await getPolicyDetail(selectedPolicyId);
        const details: any[] = res?.detail || [];
        const selectedPolicy = chinhSachBH.find(
          (c) => c.ID === selectedPolicyId
        );
        applyCsbhDetailsToRounds(details, selectedPolicy?.SoChietKhau, built);
      } catch (err) {
        console.error("Lỗi đồng bộ chính sách bán hàng:", err);
      }
    }
  };
  useEffect(() => {
    const loadChinhSach = async () => {
      const isLow = isLowRiseProduct({
        loaiSP: formData.loaiSP,
        product,
        maSP: formData.maSanPham,
      });
      const formCode = isLow ? "CSTHAPTANG" : "CSCAOTANG";
      const formCode2 = isLow ? "TDTTTHAPTANG" : "TDTTCAOTANG";
      const maDA = product?.MaDA ?? effectiveMaDA;
      // Cùng dự án + cùng loại sản phẩm thì không nạp lại danh mục lần nữa
      const loadKey = `${String(maDA ?? "")}|${formCode}|${productUuid ?? ""}`;
      if (loadChinhSachKeyRef.current === loadKey) return;
      loadChinhSachKeyRef.current = loadKey;
      setLoadingPolicies(true);
      setPoliciesLoadedMaDA(null);
      try {
        // Cùng bộ hàm máy chủ với form giao dịch/booking:
        // fn_get_current_price_lists / fn_get_sales_policies /
        // fn_get_payment_schedules + cấu hình tính giá + quà tặng.
        const cfg = await fetchSalesConfigOptions({ maDA, isLow, productId: productUuid ?? null });

        setLichThanhToan(cfg.schedules.map((o) => o.raw));
        setChinhSachBH(cfg.policies.map((o) => o.raw));
        // Phiếu mới: bảng giá tự chọn theo quỹ căn ở useUnitFundPriceList (kéo theo chính sách của bảng giá)
        setBangGia(toPriceListRows(cfg.priceLists));
        setKhuyenMai(cfg.promotions.map((o) => o.raw));

        const list = cfg.pricingConfigs.map((o) => o.raw);
        if (list.length > 0) {
          setCauHinhCS(list);
          setPolicyConfigs(list);
          const restoreConfigId = restorePolicyConfigIdRef.current;
          const restoredConfig =
            restoreConfigId != null
              ? list.find((c: any) => String(c?.ID) === String(restoreConfigId))
              : null;
          if (restoredConfig?.ID) {
            handlePolicyConfigChange(restoredConfig.ID, false);
          }
          // Không reset bảng chiết khấu ở đây — chính sách tự chọn có thể đã dựng xong.
        } else {
          setCauHinhCS([]);
          setPolicyConfigs([]);
          if (!selectedPolicyIdRef.current) setPolicyRounds([]);
        }
      } catch {
        loadChinhSachKeyRef.current = "";
        setCauHinhCS([]);
        setPolicyConfigs([]);
        if (!selectedPolicyIdRef.current) setPolicyRounds([]);
      } finally {
        setPoliciesLoadedMaDA(String(maDA ?? ""));
        setLoadingPolicies(false);
      }
    };

    if (open) {
      if (!loadDocMaPGC || product?.MaDA != null || effectiveMaDA != null) {
        loadChinhSach();
      }
    }
  }, [
    open,
    contractId,
    type,
    effectiveMaDA,
    product?.MaDA,
    loadDocMaPGC,
    formData.loaiSP,
    formData.maSanPham,
    productUuid,
  ]);
  const lateRestoreConfigRef = useRef<string>("");
  useEffect(() => {
    if (!open || !cauHinhCS.length) return;
    if (policyRounds.length || financialEdited) return;
    const cfgId = restorePolicyConfigIdRef.current ?? selectedPolicyConfigId;
    if (cfgId == null || String(cfgId) === "") return;
    const found = cauHinhCS.find((c: any) => String(c?.ID) === String(cfgId));
    if (!found?.ID) return;
    if (lateRestoreConfigRef.current === String(found.ID)) return;
    lateRestoreConfigRef.current = String(found.ID);
    const isLow = isLowRiseProduct({
      loaiSP: formData.loaiSP,
      product,
      maSP: formData.maSanPham,
    });
    loadRoundsFromApi(found.ID, isLow).catch(() => {
      lateRestoreConfigRef.current = "";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    open,
    cauHinhCS,
    selectedPolicyConfigId,
    policyRounds.length,
    financialEdited,
  ]);
  useEffect(() => {
    if (!open || !initialSheet) return;
    const payload = initialSheet?.payload || initialSheet;
    const snap = initialSheet?.snapshot || payload?._snapshot || {};
    const tt = payload?.TTHopDong || {};
    const kh = payload?.TTKhachHang || {};
    const csArr: any[] = Array.isArray(payload?.ChinhSach)
      ? payload.ChinhSach
      : [];
    const lttArr: any[] = Array.isArray(payload?.LichThanhToan)
      ? payload.LichThanhToan
      : [];
    const kmArr: any[] = Array.isArray(payload?.KhuyenMai)
      ? payload.KhuyenMai
      : [];
    setCustomer360((payload?.TT360KhachHang || snap?.customer360 || {}) as any);
    savedPrintScheduleRef.current = Array.isArray(snap?.printData?.schedule) ? snap.printData.schedule : null;
    setHandoverStandard(String(snap?.handoverStandard ?? ""));
    setHtlsProgram(String(snap?.htlsProgram ?? ""));
    const toDate = (v: any) => (v ? new Date(v) : null);

    setIsEditMode(true);
    setFinancialEdited(false); resetCompanyChanged();
    if (tt.MaDA != null) setEffectiveMaDA(Number(tt.MaDA));
    setEditContractData(tt);
    setCongTyBanHangId(salesCompanyRule.show && tt.CongTyBanHangId ? String(tt.CongTyBanHangId) : null);
    setCongTyBanHangTen(salesCompanyRule.show && tt.TenCongTyBanHang ? String(tt.TenCongTyBanHang) : null);

    setFormData((prev) => ({
      ...prev,
      soHopDong: tt.SoPhieu || prev.soHopDong || "",
      ngayKy: toDate(tt.NgayKy) || prev.ngayKy,
      ngayHetHan: toIsoDate(tt.NgayHetHan),
      ngayBanGiao: toDate(tt.NgayBanGiaoKH) || prev.ngayBanGiao,
      maSanPham: tt.MaCan || snap.productCode || prev.maSanPham,
      maNVKD: tt.MaNVKD ?? prev.maNVKD,
      maSan: tt.MaSan ?? prev.maSan,
      tienCoc: Number(tt.TienCoc) || 0,
      ghiChu: tt.GhiChu || "",
      duAn: snap.projectName || prev.duAn,
      loaiSP: snap.productType || prev.loaiSP,
      dienTichThongThuy: Number(snap.area) || prev.dienTichThongThuy,
      rawGiaNaked: tt.GiaTriHopDong?.GiaNaked ?? null,
      // Giá HĐMB chưa TT lần 1…6: số đã lưu lúc lập phiếu
      rawGiaHDMBLan: hdmbLanFromSaved(tt.GiaTriHopDong) ?? null,
      rawVATCuoiPBT: vatCuoiPbtSavedOr(tt.GiaTriHopDong, null),
      customerType: kh?.IsPersonal === false ? "business" : "individual",
      MaKH: kh?.MaKH ?? (prev as any).MaKH ?? null,
      MaQD: kh?.MaQD ?? (prev as any).MaQD,
      TenKH: kh?.TenKH ?? (prev as any).TenKH,
      NgaySinh: toDate(kh?.NgaySinh),
      SoCMND: kh?.SoCMND,
      NgayCap: toDate(kh?.NgayCap),
      NoiCap: kh?.NoiCap,
      DiDong: kh?.DiDong,
      DiDong2: kh?.DiDong2,
      Email: kh?.Email,
      Email2: kh?.Email2,
      MaSoTTNCN: kh?.MaSoTTNCN,
      SoTaiKhoan: kh?.SoTaiKhoan,
      TenNganHang: kh?.TenNganHang,
      DiaChi: kh?.DiaChi,
      ThuongTru: kh?.ThuongTru,
      TenCongTy: kh?.TenCongTy,
      MaSoThueCT: kh?.MaSoThueCT,
      DiaChiCT: kh?.DiaChiCT,
      DienThoaiCT: kh?.DienThoaiCT,
      EmailCT: kh?.EmailCT,
      NguoiDaiDienPL: kh?.NguoiDaiDienPL,
      ChucVu: kh?.ChucVu,
      SoGPKD: kh?.SoGPKD,
      SoDKKD: kh?.SoDKKD,
      NgayCapGPKD: toDate(kh?.NgayCapGPKD),
      NoiCapGPKD: kh?.NoiCapGPKD,
    }));

    if (kh?.MaKH) setSelectedCustomerId(String(kh.MaKH));
    // Người cùng đứng tên: payload chỉ giữ MaKH ⇒ dùng bản đầy đủ trong snapshot
    setCoOwners(Array.isArray(snap?.coOwners) ? snap.coOwners : []);
    restorePriceCfgIdRef.current =
      snap?.priceConfigId != null ? String(snap.priceConfigId) : null;
    if (tt.MaPDK != null) setSelectedPriceSheetId(String(tt.MaPDK));
    if (tt.MaDotGia != null) setSelectedPriceListId(tt.MaDotGia);
    unitFund.restore(tt.MaQuyCan, tt.MaDotGia);
    if (tt.CauHinhTinhGiaID != null) {
      restorePolicyConfigIdRef.current = tt.CauHinhTinhGiaID;
      setSelectedPolicyConfigId(tt.CauHinhTinhGiaID);
    }
    expiryPolicyRef.current = String(tt.MaCS ?? csArr[0]?.MaCS ?? "");
    if (tt.MaCS != null) setSelectedPolicyId(tt.MaCS);
    else if (csArr[0]?.MaCS) setSelectedPolicyId(csArr[0].MaCS);

    // Chính sách chiết khấu
    skipPolicyAutoCalcRef.current = csArr.length > 0;
    const snapRounds = Array.isArray(snap?.policyRounds) && snap.policyRounds.length
      ? snap.policyRounds
      : null;
    // Căn ChinhSach theo đủ dòng của snapshot; không căn được thì dùng ChinhSach, bỏ snapshot
    const alignedCs = csArr.length && snapRounds ? alignSavedRows(csArr, snapRounds) : null;
    restoreRoundsRef.current = csArr.length && !alignedCs ? null : snapRounds;
    setRestoreRoundsTick((t) => t + 1);
    setRestoredChinhSachSnapshot(csArr.length ? alignedCs ?? csArr : null);
    setPendingRestoreChinhSach(csArr.length ? alignedCs ?? csArr : null);
    if (csArr.length && (tt.MaCS ?? csArr[0]?.MaCS)) reopenDetails.begin(tt.MaCS ?? csArr[0]?.MaCS);
    else reopenDetails.reset();
    setAppliedDiscounts(csArr);

    // Lịch thanh toán
    const maTHSaved = lttArr[0]?.MaTH ?? tt.MaTDTT;
    restoreTemplateIdRef.current = String(maTHSaved ?? "") || null;
    if (maTHSaved != null) setSelectedTemplateId(maTHSaved);
    setPendingRestoreLichTT(lttArr.length ? lttArr : null);
    setPaymentSchedules(lttArr);

    // Quà tặng
    setPromotionsRaw(kmArr);
    if (kmArr.length) {
      setSelectedPromotionId(kmArr[0]?.PromotionID);
      setSelectedPromotion(
        kmArr.map((g: any) => ({
          ID: g.PromotionID,
          TenQuaTang: g.TieuDe,
          SoLuong: g.SoLuong,
          GiaTri: g.SoTien,
        })) as any
      );
    }
    return applySheetNakedGoc(tt, snap, (v) => setFormData((prev: any) => ({ ...prev, rawGiaNaked: v })));
  }, [open, initialSheet]);
  useEffect(() => {
    const loadByMaPGC = async () => {
      if (!open || !loadDocMaPGC) {
        if (!open) setEffectiveMaDA(null);
        return;
      }
      try {
        if (!isDocPrefill) setIsEditMode(true);
        const res: any = await BanHangService.DatCoc.getByMaPGC(loadDocMaPGC);
        if (!res || res.status !== 2000) {
          toast.error(res?.message || "Không tải được dữ liệu phiếu");
          return;
        }
        const ttsp = res?.ttSanPham || {};
        const tt = res.ttHopDong || {};
        const kh = res.ttKhachHang || {};
        const csRaw = res.chinhSach;
        const csArr = Array.isArray(csRaw) ? csRaw : csRaw ? [csRaw] : [];
        const cs = csArr[0] || {};
        const ltt = res.lichThanhToan;
        const km = res.khuyenMai;
        const gt = tt.GiaTriHopDong || {};
        const gtCK = tt.GiaTriHopDongSauCK || {};

        setContractData((prev) => ({
          ...prev,
          chinhSachList: res.chinhSach || [],
          lichThanhToanList: res.lichThanhToan || [],
          khuyenMaiList: res.khuyenMai || [],
          khachHangObj: res.ttKhachHang || {},
          sanPhamObj: res.ttSanPham || {},
          hopDongObj: res.ttHopDong || {},
        }));

        setFinancialEdited(false); resetCompanyChanged();
        setPolicyRounds([]);
        setPaymentSchedule([]);
        setRestoredChinhSachSnapshot(null);
        setAppliedDiscounts([]);
        setPaymentSchedules([]);
        setPromotionsRaw([]);

        let bg: any = null;
        try {
          // Phiếu giữ chỗ / booking chỉ có uuid sản phẩm (san_pham_id) nên
          // phải chấp nhận cả trường hợp thiếu MaSP thì dùng uuid để lấy giá
          // theo đúng bảng giá đã lưu trên phiếu.
          const spKey = tt.MaSP ?? tt.SanPhamId ?? (product as any)?.id ?? null;
          if (spKey != null && tt.MaDotGia != null) {
            const bgRes: any = await ProductService.getSPByBG({
              MaSP: spKey,
              ProductId: tt.SanPhamId ?? (product as any)?.id ?? spKey,
              MaDA: tt.MaDA ?? (product as any)?.MaDA,
              MaDot: tt.MaDotGia,
            });
            bg = bgRes?.data || null;
          }
        } catch (_) {
          bg = null;
        }

        const toDate = (v: any) => (v ? new Date(v) : null);

        // Lưu MaDA để loadChinhSach (policy / promotions / price-sheet) chạy lại
        // theo dự án thực sự của phiếu đặt cọc đang mở.
        if (tt.MaDA != null) setEffectiveMaDA(Number(tt.MaDA));

        setEditContractData(tt);
        setCongTyBanHangId(tt.CongTyBanHangId ? String(tt.CongTyBanHangId) : null);
        setCongTyBanHangTen(tt.TenCongTyBanHang ? String(tt.TenCongTyBanHang) : null);

        // ----- Form data (contract + customer + product summary) -----
        setFormData((prev) => ({
          ...prev,
          // Contract

          // Khi chỉ điền sẵn từ chứng từ -> giữ số phiếu tính giá mới
          soHopDong: isDocPrefill ? prev.soHopDong || "" : tt.SoPhieu || "",
          ngayKy: toDate(tt.NgayKy) || (isDocPrefill ? prev.ngayKy : null),
          ngayHetHan: isDocPrefill ? prev.ngayHetHan : toIsoDate(tt.NgayHetHan),
          ngayBanGiao: toDate(tt.NgayBanGiaoKH),
          maSanPham: ttsp?.MaSoSP || tt.MaCan || prev.maSanPham,
          tienCoc: Number(tt.TienCoc) || 0,
          ghiChu: tt.GhiChu || "",
          maNVKD: tt.MaNVKD ?? prev.maNVKD,
          maSan: tt.MaSan ?? prev.maSan,
          customerType: kh?.IsPersonal === false ? "business" : "individual",
          TenQD: kh?.TenQD || (prev as any).TenQD,
          MaQD: kh?.MaQD ?? (prev as any).MaQD,
          TenKH: kh?.TenKH,
          NgaySinh: toDate(kh?.NgaySinh),
          SoCMND: kh?.SoCMND,
          NgayCap: toDate(kh?.NgayCap),
          NoiCap: kh?.NoiCap,
          DiDong: kh?.DiDong,
          DiDong2: kh?.DiDong2,
          Email: kh?.Email,
          Email2: kh?.Email2,
          MaSoTTNCN: kh?.MaSoTTNCN,
          SoTaiKhoan: kh?.SoTaiKhoan,
          TenNganHang: kh?.TenNganHang,
          MaSoKH: kh?.MaSoKH,
          DiaChi: kh?.DiaChi,
          ThuongTru: kh?.ThuongTru,
          // Business
          TenCongTy: kh?.TenCongTy,
          MaSoThueCT: kh?.MaSoThueCT,
          DiaChiCT: kh?.DiaChiCT,
          EmailCT: kh?.EmailCT,
          NguoiDaiDienPL: kh?.NguoiDaiDienPL,
          ChucVu: kh?.ChucVu,
          SoGPKD: kh?.SoGPKD,
          NgayCapGPKD: toDate(kh?.NgayCapGPKD),
          NoiCapGPKD: kh?.NoiCapGPKD,
          MaKH: kh?.MaKH ?? (prev as any).MaKH ?? null,
          dienTichThongThuy:
            ttsp?.DienTichThongThuy ??
            gtCK.DienTichThongThuy ??
            bg?.DTThongThuy ??
            prev.dienTichThongThuy ??
            0,
          tyLeVAT: gtCK.TyLeVAT ?? bg?.vatch ?? prev.tyLeVAT,
          tyLePBT: gtCK.TyLePhiBaoTri ?? bg?.PTPhiBaoTri ?? prev.tyLePBT,
          tongChuaVAT: gtCK.TongChuaVAT ?? gt.TongChuaVAT ?? 0,
          tienVAT: gtCK.TienVAT ?? gt.TienVAT ?? 0,
          tongGomVAT: gtCK.TongGomVAT ?? gt.TongGomVAT ?? 0,
          phiBaoTri: gtCK.TienPhiBaoTri ?? gt.TienPhiBaoTri ?? 0,
          tongGiaVATPBT: gtCK.TongGiaGomVATPBT ?? gt.TongGiaGomVATPBT ?? 0,
          // ----- Product info (from bảng giá) -----
          duAn: ttsp?.TenDA ?? bg?.TenDA ?? bg?.project_name ?? prev.duAn,

          loaiSP:
            ttsp?.TenLoaiBDS ??
            bg?.TenLoaiBDS ??
            bg?.product_type ??
            prev.loaiSP,
          tang: ttsp?.TenTang ?? prev.tang,
          dienTichTimTuong:
            ttsp?.DTTimDuong ??
            bg?.DTTimTuong ??
            bg?.wall_area ??
            prev.dienTichTimTuong ??
            0,
          huong:
            ttsp?.TenHuongCua ??
            bg?.TenHuongCua ??
            bg?.TenHuongBC ??
            prev.huong,
          donGiaSuDungDat:
            tt?.GiaTriHopDong?.DonGiaChuaVAT ??
            bg?.DonGiaVAT ??
            bg?.DonGiaChuaVAT ??
            prev.donGiaSuDungDat ??
            0,
          rawDonGiaChuaVAT: bg?.DonGiaChuaVAT ?? prev.rawDonGiaChuaVAT,
          rawDonGiaDaVAT: bg?.DonGiaVAT ?? prev.rawDonGiaDaVAT,
          rawTongGiaChuaVAT:
            bg?.TongGiaChuaVAT ?? gt.TongChuaVAT ?? prev.rawTongGiaChuaVAT,
          rawTongGiaDaVAT:
            bg?.TongGiaGomVAT ?? gt.TongGomVAT ?? prev.rawTongGiaDaVAT,
          rawGiaNaked: gt.GiaNaked ?? bg?.naked_price ?? prev.rawGiaNaked,
          rawGiaHDMBLan: hdmbLanFromSaved(gt) ?? hdmbLanFromPriceList(bg),
          rawVATCuoiPBT: vatCuoiPbtSavedOr(gt, vatCuoiPbtFromPriceList(bg)),
          rawTienVAT: bg?.vatchtien ?? gt.TienVAT ?? prev.rawTienVAT,
          rawTienPhiBaoTri:
            bg?.PhiBaoTri ?? gt.TienPhiBaoTri ?? prev.rawTienPhiBaoTri,
          rawTongGomPBT:
            bg?.TongGiaGomPBT ?? gt.TongGiaGomVATPBT ?? prev.rawTongGomPBT,
          // Đơn giá đất phân bổ — cần để công thức (DGDatPB) hoạt động
          donGiaDatPhanBo:
            bg?.DGDatPB ??
            bg?.DonGiaDatPhanBo ??
            (gtCK as any)?.DGDatPB ??
            (gt as any)?.DGDatPB ??
            prev.donGiaDatPhanBo ??
            0,
          dienTichDat: ttsp?.DienTichDat || 0,
          donGiaDat: gt?.DonGiaDat || 0,
          tienDatChuaVAT: gt?.TienDatChuaVAT || 0,
          dienTichXD: ttsp?.DienTichXD || 0,
          tongDTSanXD: ttsp?.TongDTXD || 0,
          donGiaXD: gt?.DonGiaXD || 0,
          rawThanhTienXD: gt?.TienXDChuaVAT || 0,
          rawTienVATXD: gt?.TienVATXD || 0,
          rawTongGiaXDVAT: gt?.TongTienXDGomVAT || 0,
          rawTienVATDat: gt?.TienVATDat || 0,
          rawTienDatChuaVAT: gt?.TienDatChuaVAT || 0,
          rawTongTienDatVAT: gt?.TongTienVATDat || 0,
          donGiaDatSauCK: gtCK?.DonGiaDat || 0,
          tienDatChuaVatSauCK: gtCK?.DonGiaDat || 0,
          // vatDatSauCK: gtCK?.DonGiaDat || 0,
          tongTienDatSauCK: gtCK?.DonGiaDat || 0,
          donGiaDienTichXDSauCK: gtCK?.DonGiaDat || 0,
          thanhTienXDSauCK: gtCK?.TienXDChuaVAT || 0,
          vatXDSauCK: gtCK?.TienVATXD || 0,
          tongXDCoVATSauCK: gtCK?.TongTienXDGomVAT || 0,
          tongGTHDSauCK: gtCK?.TongGiaGomDatXD || 0,
          tongTienDatVatSauCK: gtCK?.TongTienVATDat || 0,
          vatDatSauCK: gtCK?.TienVATDat || 0,
          tongGiaTriHDMB: gt?.TongGiaGomVATPBT || 0,
        }));

        // ----- Price sheet / Price list / Pricing config -----
        if (tt.MaPDK != null) setSelectedPriceSheetId(String(tt.MaPDK));
        if (tt.MaDotGia != null) setSelectedPriceListId(tt.MaDotGia);
        unitFund.restore(tt.MaQuyCan, tt.MaDotGia);
        if (tt.CauHinhTinhGiaID != null) {
          restorePolicyConfigIdRef.current = tt.CauHinhTinhGiaID;
          setSelectedPolicyConfigId(tt.CauHinhTinhGiaID);
        }

        // Customer link to skip duplicate warnings
        if (kh.MaKH) setSelectedCustomerId(String(kh.MaKH));

        // ----- Co-owners (Người cùng đứng tên) -----
        const listKH = kh.ListKhachHang;
        const coOwnerArr = Array.isArray(listKH)
          ? listKH
          : listKH
            ? [listKH]
            : [];
        if (coOwnerArr.length) {
          setCoOwners(
            coOwnerArr.map((c: any, idx: number) => ({
              id: String(c.ID ?? `co-${idx}`),
              IsPersonal: c.IsPersonal !== false,
              MaKH: c.MaKH ?? null,
              MaQD: c.MaQD ?? null,
              TenKH: c.TenKH || "",
              SoCMND: c.SoCMND || "",
              NgayCap: c.NgayCap || null,
              NoiCap: c.NoiCap || "",
              DiDong: c.DiDong || "",
              Email: c.Email || "",
              ThuongTru: c.ThuongTru || "",
              DiaChi: c.DiaChi || "",
              TenCongTy: c.TenCongTy || "",
              MaSoThueCT: c.MaSoThueCT || "",
              DienThoaiCT: c.DienThoaiCT || "",
              DiaChiCT: c.DiaChiCT || "",
              EmailCT: c.EmailCT || "",
              NguoiDaiDienPL: c.NguoiDaiDienPL || "",
              ChucVu: c.ChucVu || "",
            }))
          );
        } else {
          setCoOwners([]);
        }
        // ----- Policy / discount -----
        // Phiếu giữ chỗ (booking) chưa có mảng chính sách chi tiết — cấu hình
        // đã chọn nằm ở cột tt_hop_dong (MaCS / MaCSTong / MaTDTT).
        const maCS = cs.MaCS ?? tt.MaCS ?? null;
        const maCSTong = cs.MaCSTong ?? tt.MaCSTong ?? null;
        if (!isDocPrefill) expiryPolicyRef.current = String(maCS ?? "");
        if (maCS) setSelectedPolicyId(maCS);
        if (maCSTong) {
          restorePolicyConfigIdRef.current = maCSTong;
          setSelectedPolicyConfigId(maCSTong);
        }
        // Dòng `__fromPolicy` do service tự dựng từ chính sách khi phiếu chưa
        // lưu chiết khấu ⇒ không phải số liệu của phiếu, phải tính lại.
        const savedCs = csArr.filter((c: any) => !c?.__fromPolicy);
        if (savedCs.length) policyDetailCountRef.current = savedCs.length;
        skipPolicyAutoCalcRef.current = savedCs.length > 0;
        setRestoredChinhSachSnapshot(savedCs.length ? savedCs : null);

        const lttArr = Array.isArray(ltt) ? ltt : ltt ? [ltt] : [];
        const maTDTT = lttArr[0]?.MaTH ?? tt.MaTDTT ?? undefined;
        restoreTemplateIdRef.current = String(maTDTT ?? "") || null;
        if (maTDTT != null) setSelectedTemplateId(maTDTT);

        // Lưu lại snapshot để effect bên dưới re-apply sau khi policyRounds
        // đã được dựng (tránh việc loadChinhSach/handlePolicyConfigChange
        // ghi đè giá trị thực tế của phiếu).
        setPendingRestoreChinhSach(savedCs.length ? savedCs : null);
        if (savedCs.length && maCS) reopenDetails.begin(maCS);
        else reopenDetails.reset();
        setAppliedDiscounts(savedCs);

        // ----- Payment schedule -----
        setPendingRestoreLichTT(lttArr.length ? lttArr : null);
        setPaymentSchedules(lttArr);

        // Phiếu giữ chỗ/booking chỉ lưu các mã cấu hình, không có chi tiết
        // chiết khấu & tiến độ ⇒ ghi nhận để tự dựng lại từ danh mục.
        if (!savedCs.length || !lttArr.length) {
          bookingRestoreDoneRef.current = false;
          setBookingRestoreInfo({
            maCS: savedCs.length ? null : maCS,
            maCSTong,
            maTDTT: lttArr.length ? null : maTDTT ?? null,
            hasSavedSchedule: lttArr.length > 0,
          });
        } else {
          setBookingRestoreInfo(null);
        }

        // ----- Promotions -----
        const kmArr = Array.isArray(km) ? km : km ? [km] : [];
        setPromotionsRaw(kmArr);
        if (kmArr.length) {
          setSelectedPromotion(
            kmArr.map((p: any) => ({
              ID: p.PromotionID,
              id: String(p.PromotionID),
              promotionId: p.PromotionID,
              PromotionID: p.PromotionID,
              TenQuaTang: p.TieuDe,
              name: p.TieuDe,
              SoLuong: p.SoLuong ?? 1,
              quantity: p.SoLuong ?? 1,
              GiaTri: p.SoTien ?? 0,
              value: p.SoTien ?? 0,
            })) as any
          );
          setSelectedPromotionId(kmArr[0]?.PromotionID ?? null);
        }
      } catch (e: any) {
        toast.error("Lỗi tải phiếu: " + (e?.message || "Không xác định"));
      }
    };
    loadByMaPGC();
  }, [open, loadDocMaPGC]);
  useEffect(() => {
    if (!open) return;
    if (loadDocMaPGC) return; // đã load từ phiếu hiện hữu
    if (!initialMaKH) return;
    let cancelled = false;
    (async () => {
      try {
        const res: any = await CustomerService.getByMaKH(initialMaKH);
        const raw = res?.data ?? res;
        const kh = Array.isArray(raw) ? raw[0] : raw;
        if (!kh || cancelled) return;
        setSelectedCustomerId(String(kh.MaKH || ""));


        setFormData((prev: any) => ({
          ...prev,
          customerType: kh?.IsPersonal === false ? "business" : "individual",
          MaKH: kh?.MaKH ?? null,
          TenKH: kh?.TenKH ?? prev.TenKH,
          SoCMND: kh?.SoCMND ?? prev.SoCMND,
          DiDong: kh?.DiDong ?? prev.DiDong,
          DiDong2: kh?.DiDong2 ?? prev.DiDong2,
          Email: kh?.Email ?? prev.Email,
          Email2: kh?.Email2 ?? prev.Email2,
          MaSoTTNCN: kh?.MaSoTTNCN ?? prev.MaSoTTNCN,
          SoTaiKhoan: kh?.SoTaiKhoan ?? prev.SoTaiKhoan,
          TenNganHang: kh?.TenNganHang ?? prev.TenNganHang,
          MaSoKH: kh?.MaSoKH ?? prev.MaSoKH,
          DiaChi: kh?.DiaChi ?? prev.DiaChi,
          ThuongTru: kh?.ThuongTru ?? prev.ThuongTru,
          NgaySinh: kh?.NgaySinh ? new Date(kh.NgaySinh) : prev.NgaySinh,
          NgayCap: kh?.NgayCap ? new Date(kh.NgayCap) : prev.NgayCap,
          NoiCap: kh?.NoiCap ?? prev.NoiCap,
          MaQD: kh?.MaQD ?? prev.MaQD,
          TenCongTy: kh?.TenCongTy ?? prev.TenCongTy,
          MaSoThueCT: kh?.MaSoThueCT ?? prev.MaSoThueCT,
          DiaChiCT: kh?.DiaChiCT ?? prev.DiaChiCT,
          EmailCT: kh?.EmailCT ?? prev.EmailCT,
          DienThoaiCT: kh?.DienThoaiCT ?? prev.DienThoaiCT,
        }));
      } catch (e) {
        console.error("Prefill customer error:", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, loadDocMaPGC, initialMaKH]);
  useEffect(() => {
    if (!open) {
      setPendingRestoreChinhSach(null);
      setPendingRestoreLichTT(null);
      setRestoredChinhSachSnapshot(null);
      setFinancialEdited(false); resetCompanyChanged();
      setAppliedDiscounts([]);
      setPaymentSchedules([]);
      setPromotionsRaw([]);
      restorePolicyConfigIdRef.current = null;
      restoreRoundsRef.current = null;
    }
  }, [open, resetCompanyChanged]);
  useEffect(() => {
    if (!open || initialSheet || sections.templateName) return;
    let cancelled = false;
    (async () => {
      try {
        const { generateFormCode, getProjectCodeVars } = await import(
          "@/services/CodeGenService"
        );
        const maDA =
          (effectiveMaDA as any) ?? (product as any)?.MaDA ?? null;
        const projVars = await getProjectCodeVars(maDA as any);
        const code = await generateFormCode("PHIEUTINHGIA", {
          ...projVars,
          MaSP:
            (product as any)?.KyHieu ||
            (product as any)?.code ||
            (product as any)?.MaSP ||
            "",
        });
        if (!code || cancelled) return;
        setFormData((prev) =>
          prev.soHopDong ? prev : { ...prev, soHopDong: code }
        );
      } catch {
        /* chưa cấu hình quy tắc đánh mã → để trống cho người dùng nhập */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialSheet, effectiveMaDA, sections.templateName]);
  const depositFromDoc =
    !!loadDocMaPGC || !!initialSheet?.pgc_id || !!initialSheet?.payload?.TTHopDong?.MaPGC;
  const ngayTinhKey = formData.ngayKy && dayjs(formData.ngayKy).isValid() ? dayjs(formData.ngayKy).format("YYYY-MM-DD") : "";
  useEffect(() => {
    if (!open || type !== "pricesheet" || depositFromDoc) return;
    const maDA = product?.MaDA ?? effectiveMaDA;
    if (maDA == null || maDA === "") return;
    let cancelled = false;
    SalesSettingsService.resolve(maDA, ngayTinhKey ? dayjs(ngayTinhKey).toDate() : new Date())
      .then((st) => {
        if (cancelled) return;
        const v = Number(st?.tien_dat_coc);
        const coc = Number.isFinite(v) && v > 0 ? v : 0;
        setFormData((prev) => (Number(prev.tienCoc) === coc ? prev : { ...prev, tienCoc: coc }));
      })
      .catch(() => {
        /* không đọc được cài đặt ⇒ giữ tiền cọc hiện có */
      });
    return () => {
      cancelled = true;
    };
    // isEditMode: chạy lại sau khi khôi phục phiếu đã lưu (khôi phục ghi đè tienCoc bằng số đã lưu)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, type, depositFromDoc, product?.MaDA, effectiveMaDA, ngayTinhKey, isEditMode]);
  useEffect(() => {
    if (!open || !pendingRestoreChinhSach?.length) return;
    const saved = pendingRestoreChinhSach;
    let cancelled = false;
    (async () => {
      policyDetailCountRef.current = saved.length;
      setPolicyDetailCount(saved.length);
      setPolicyRounds(
        saved.map((c: any, idx: number) => ({
          key: `saved_${idx}`,
          name:
            c?.TenChietKhau ??
            c?.TenCK ??
            c?.TenChinhSach ??
            `Chiết khấu ${idx + 1}`,
          discountPercent: Number(c?.CKPT) || 0,
          heSo: Number(c?.HeSo) || 1,
          tienCK: Math.round(Number(c?.CKDonGia) || 0),
          ...restoredRoundExtras(c),
          maKTT: c?.MaKTT ?? null,
          enabled: true,
          formulas: {},
        })) as any
      );
      const cfgId = selectedPolicyConfigId ?? restorePolicyConfigIdRef.current;
      if (cfgId) {
        const isLow = isLowRiseProduct({
          loaiSP: formData.loaiSP,
          product,
          maSP: formData.maSanPham,
        });
        await loadRoundsFromApi(cfgId, isLow);
      }
      if (cancelled) return;
      setPendingRestoreChinhSach(null);
      setFinancialEdited(false); resetCompanyChanged();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingRestoreChinhSach]);
  useEffect(() => {
    setPolicyRounds((prev) => refreshRoundsFromDetails(prev, chinhSachBHDetails));
  }, [chinhSachBHDetails, policyRounds]);
  useEffect(() => {
    const saved = restoreRoundsRef.current;
    if (!saved?.length || financialEdited || !policyRounds.length) return;
    setPolicyRounds((prev) => {
      let changed = false;
      const base = prev.length >= saved.length ? prev : [
        ...prev,
        ...saved.slice(prev.length).map((s: any, i: number) => ({
          ...(prev[prev.length - 1] || {}),
          key: s?.key ?? `restored_${prev.length + i}`,
          // Không mang mã và các mức của dòng cuối sang dòng thêm
          maCK: s?.maCK,
          luaChon: undefined,
          luaChonDaChon: [],
        })),
      ];
      const next = base.map((round: any, idx: number) => {
        const s = saved[idx];
        if (!s) return round;
        // Snapshot cũ không có luaChonDaChon ⇒ giữ các mức của dòng
        const extras = restoredRoundExtras({ MaCK: s.maCK ?? round.maCK, LuaChonDaChon: s.luaChonDaChon ?? round.luaChonDaChon });
        if (
          Number(round.discountPercent || 0) === Number(s.discountPercent || 0) &&
          Number(round.heSo || 1) === Number(s.heSo || 1) &&
          Number(round.tienCK || 0) === Number(s.tienCK || 0) &&
          round.enabled === s.enabled &&
          JSON.stringify(round.luaChonDaChon ?? []) === JSON.stringify(extras.luaChonDaChon)
        ) {
          return round;
        }
        changed = true;
        return {
          ...round,
          name: s.name || round.name,
          enabled: s.enabled !== false,
          discountPercent: Number(s.discountPercent) || 0,
          heSo: Number(s.heSo) || 1,
          tienCK: Number(s.tienCK) || 0,
          ...extras,
          // Khác mã ⇒ các mức của dòng cũ không còn đúng, effect trên nạp lại theo mã mới
          luaChon: String(extras.maCK ?? "") === String(round.maCK ?? "") ? round.luaChon : undefined,
          maKTT: s.maKTT ?? (round as any).maKTT,
        };
      });
      return changed || base.length !== prev.length ? next : prev;
    });
  }, [policyRounds, financialEdited, restoreRoundsTick]);
  useEffect(() => {
    if (!open || !pendingRestoreLichTT?.length) return;
    const saved = pendingRestoreLichTT;
    const isLow = isLowRiseProduct({
      loaiSP: formData.loaiSP,
      product,
      maSP: formData.maSanPham,
    });
    const tplId =
      saved.find((x: any) => x?.MaTH)?.MaTH ?? restoreTemplateIdRef.current;
    let cancelled = false;
    (async () => {
      if (tplId) scheduleHandledRef.current = String(tplId);
      const res: any = tplId
        ? await getScheduleDetail(String(tplId), true).catch(() => null)
        : null;
      if (cancelled) return;
      warnPendingScheduleKept(res);
      const rows = keepSavedPrintText(restoreScheduleFromRes(saved, isLow, res), savedPrintScheduleRef.current);
      setPaymentSchedule(rows);
      scheduleSnapshotRef.current = serializeSchedule(rows);
      setPendingRestoreLichTT(null);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingRestoreLichTT]);
  useEffect(() => {
    if (!open) return;
    const info = bookingRestoreInfo;
    if (!info || bookingRestoreDoneRef.current) return;
    if (!info.maCS && !info.maCSTong && info.maTDTT == null) return;
    // Chờ danh mục cấu hình để còn lùi về cấu hình có vòng chiết khấu
    if (!policyCatalogReady) return;
    bookingRestoreDoneRef.current = true;

    (async () => {
      const isLow = isLowRiseProduct({
        loaiSP: formData.loaiSP,
        product,
        maSP: formData.maSanPham,
      });
      try {
        // 1) Bảng chiết khấu: chi tiết chính sách + công thức cấu hình tính giá
        let policyRes: any = null;
        let policyRow: any = null;
        if (info.maCS) {
          try {
            policyHandledRef.current = String(info.maCS);
            setSelectedPolicyId(info.maCS);
            const applied = await applyPolicyRounds(
              String(info.maCS),
              info.maCSTong
            );
            policyRes = applied.res;
            policyRow = applied.policyRow;
          } catch (err) {
            console.error("Lỗi nạp chi tiết chính sách từ booking:", err);
          }
        } else if (info.maCSTong != null) {
          setSelectedPolicyConfigId(info.maCSTong);
          await loadRoundsFromApi(info.maCSTong, isLow);
        }

        // 2) Tiến độ thanh toán (details của da_payment_schedules)
        const scheduleId =
          info.maTDTT ??
          policyRes?.data?.MaTruonghopTT ??
          policyRow?.MaTruonghopTT ??
          null;
        if (
          !info.hasSavedSchedule &&
          scheduleId != null &&
          String(scheduleId) !== ""
        ) {
          try {
            await handleTemplateSelect(String(scheduleId));
          } catch (err) {
            console.error("Lỗi nạp tiến độ thanh toán từ booking:", err);
          }
        }
      } finally {
        setBookingRestoreInfo(null);
        setFinancialEdited(false); resetCompanyChanged();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bookingRestoreInfo, policyCatalogReady]);
  useEffect(() => {
    if (open && product && !contractId) {
      const p: any = product;
      // Khi đang sửa phiếu đã lưu: không ghi đè giá trị đã khôi phục bằng null
      const keep = !!initialSheet;
      const k = (v: any, prevV: any) =>
        v ?? (keep ? prevV ?? null : null);
      setFormData((prev) => ({
        ...prev,
        duAn: p.project_name || p.TenDA || "",
        maSanPham: p.code || p.KyHieu || "",
        loaiSP: p.product_type || "Chung cư",
        tang: p.floor ?? (p.Tang ? Number(p.Tang) : 0),
        dienTichTimTuong: p.wall_area ?? p.DTTimDuong ?? p.area ?? 0,
        dienTichThongThuy: p.DienTichThongThuy ?? p.area ?? 0,
        donGiaDatPhanBo: p.DGDatPB ?? 0,
        huong: p.direction || p.TenHuongCua || p.TenHuongBC || prev.huong,
        // Low-rise (đã map từ LowRiseProductList)
        dienTichDat: p.land_area ?? p.DienTichDat ?? 0,
        donGiaDat: p.land_unit_price ?? p.DonGiaDat ?? 0,
        dienTichXD: p.construction_area ?? p.DienTichXD ?? 0,
        tongDTSanXD: p.total_floor_area ?? p.TongDTSanXD ?? 0,
        donGiaXD:
          p.construction_unit_price ?? p.DonGiaXD ?? p.DonGiaXayDung ?? 0,
        // Pricing
        donGiaSuDungDat: isLowRiseProduct({
          product: p,
          maSP: p?.code || p?.KyHieu || p?.MaCan,
        })
          ? p.land_unit_price ?? p.DonGiaDat ?? 0
          : p.unit_price_before_vat ?? p.DonGiaDaVAT ?? p.DonGiaChuaVAT ?? 0,
        tyLeVAT: p.TyLeVAT ?? prev.tyLeVAT,
        tyLePBT: p.TyLePhiBaoTri ?? prev.tyLePBT,
        // Raw values từ lưới — hiển thị trực tiếp trong "Thông tin sản phẩm"
        rawDonGiaChuaVAT: k(p.DonGiaChuaVAT, (prev as any).rawDonGiaChuaVAT),
        rawDonGiaDaVAT: k(p.DonGiaDaVAT, (prev as any).rawDonGiaDaVAT),
        rawTongGiaChuaVAT: k(p.TongGiaChuaVAT, (prev as any).rawTongGiaChuaVAT),
        rawTongGiaDaVAT: k(p.TongGiaDaVAT, (prev as any).rawTongGiaDaVAT),
        rawGiaNaked: initialSheet ? (prev as any).rawGiaNaked : p.GiaNaked ?? null,
        rawTienVAT: k(p.TienVAT, (prev as any).rawTienVAT),
        rawTienPhiBaoTri: k(p.TienPhiBaoTri, (prev as any).rawTienPhiBaoTri),
        rawTongGomPBT: k(p.TongGomPBT, (prev as any).rawTongGomPBT),
        // Low-rise raw values
        rawTienDatChuaVAT: k(
          p.rawTienDatChuaVAT ?? p.GiaDatKoVAT ?? p.GiaDatChuaVAT,
          (prev as any).rawTienDatChuaVAT
        ),
        rawTienVATDat: k(
          p.rawTienVATDat ?? p.VATDat,
          (prev as any).rawTienVATDat
        ),
        rawTongTienDatVAT: k(
          p.rawTongTienDatVAT ?? p.TongGiaDat,
          (prev as any).rawTongTienDatVAT
        ),
        rawTienSDDat: k(p.rawTienSDDat ?? p.TienSDDat, (prev as any).rawTienSDDat),
        rawThanhTienXD: k(
          p.rawThanhTienXD ?? p.ThanhTienXD,
          (prev as any).rawThanhTienXD
        ),
        rawTienVATXD: k(
          p.rawTienVATXD ?? p.TienVATXayDung,
          (prev as any).rawTienVATXD
        ),
        rawTongGiaXDVAT: k(
          p.rawTongGiaXDVAT ?? p.ThanhTienVATXayDung,
          (prev as any).rawTongGiaXDVAT
        ),
        rawTongGiaTriHDMB: k(
          p.rawTongGiaTriHDMB ?? p.TongGiaTriHDMB,
          (prev as any).rawTongGiaTriHDMB
        ),
        rawTyLeVATXD: k(
          p.rawTyLeVATXD ?? p.TyLeVATXayDung,
          (prev as any).rawTyLeVATXD
        ),
        // Sửa phiếu đã lưu: ô giá / diện tích lấy đúng như lúc lưu, không theo sản phẩm hiện tại
        ...(initialSheet
          ? savedFormPrices(
            initialSheet?.payload || initialSheet,
            initialSheet?.snapshot || initialSheet?.payload?._snapshot
          )
          : {}),
      }));
    }
  }, [open, product, contractId, initialSheet]);
  const PRICE_FIELD_MAP: Record<string, string> = {
    DonGiaChuaVAT: "rawDonGiaChuaVAT",
    DonGiaDaVAT: "rawDonGiaDaVAT",
    TongGiaChuaVAT: "rawTongGiaChuaVAT",
    TongGiaDaVAT: "rawTongGiaDaVAT",
    GiaNaked: "rawGiaNaked",
    TienVAT: "rawTienVAT",
    TienPhiBaoTri: "rawTienPhiBaoTri",
    TongGomPBT: "rawTongGomPBT",
    TongGiaTriHDMB: "rawTongGiaTriHDMB",
    GiaDatKoVAT: "rawTienDatChuaVAT",
    VATDat: "rawTienVATDat",
    TongGiaDat: "rawTongTienDatVAT",
    TienSDDat: "rawTienSDDat",
    ThanhTienXD: "rawThanhTienXD",
    TienVATXayDung: "rawTienVATXD",
    ThanhTienVATXayDung: "rawTongGiaXDVAT",
    TyLeVATXayDung: "rawTyLeVATXD",
    TyLeVAT: "tyLeVAT",
    TyLePhiBaoTri: "tyLePBT",
    DienTichTimTuong: "dienTichTimTuong",
    DienTichThongThuy: "dienTichThongThuy",
    DienTichDat: "dienTichDat",
    DonGiaDat: "donGiaDat",
    DGDatPB: "donGiaDatPhanBo",
    DienTichXD: "dienTichXD",
    TongDTSanXD: "tongDTSanXD",
    DonGiaXD: "donGiaXD",
    // Các mã đồng nghĩa giữa các cấu hình tính giá
    TongThanhToan: "rawTongGomPBT",
    TongGiaTriHD: "rawTongGomPBT",
    PhiBaoTri: "rawTienPhiBaoTri",
    DonGiaSuDungDat: "donGiaSuDungDat",
    DonGiaSDDat: "donGiaSuDungDat",
    TongTienDatVAT: "rawTongTienDatVAT",
    TongGiaXDVAT: "rawTongGiaXDVAT",
    DTTimTuong: "dienTichTimTuong",
    DTThongThuy: "dienTichThongThuy",
  };
  const handleProductPriceInputs = (next: Record<string, any>) => {
    setProductPriceInputs(next);
    markFinancialEdited();
    setFormData((prev: any) => {
      const patch: any = {};
      Object.entries(next).forEach(([code, val]) => {
        const target = PRICE_FIELD_MAP[code];
        if (target) patch[target] = val;
      });
      if (next.DonGiaChuaVAT != null && !isLowRiseProduct({
        loaiSP: prev.loaiSP,
        product,
        maSP: prev.maSanPham,
      })) {
        patch.donGiaSuDungDat = next.DonGiaChuaVAT;
      }
      if (next.DonGiaDat != null) patch.donGiaSuDungDat = patch.donGiaSuDungDat ?? next.DonGiaDat;
      return { ...prev, ...patch };
    });
  };
  const isLowProductForPrice = isLowRiseProduct({
    loaiSP: formData.loaiSP,
    product,
    maSP: formData.maSanPham,
  });
  const priceCfg = useProductPriceConfig({
    maDA: (product as any)?.MaDA ?? effectiveMaDA,
    isLow: isLowProductForPrice,
    product,
    onValues: handleProductPriceInputs,
  });
  const priceCodeValues = useMemo(() => {
    const o: Record<string, any> = {};
    Object.entries(PRICE_FIELD_MAP).forEach(([code, key]) => {
      const v = (formData as any)[key];
      if (v !== undefined && v !== null && v !== "") o[code] = Number(v) || 0;
    });
    return o;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData]);
  const priceSyncRef = useRef<string>("");
  useEffect(() => {
    if (!open || !priceCfg.fields.length) return;
    const sig = `${priceCfg.configId ?? ""}|${formData.maSanPham || ""}|${priceCfg.fields.length}`;
    if (priceSyncRef.current === sig) return;
    priceSyncRef.current = sig;
    // Sửa phiếu đã lưu: giữ đúng số đã lưu cho tới khi người dùng tự sửa. Tính lại ở đây
    // sẽ đánh dấu "đã sửa" (markFinancialEdited) và huỷ khôi phục chiết khấu / lịch thanh toán.
    if (initialSheet && !financialEdited) return;
    priceCfg.recomputeFrom(priceCodeValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, priceCfg.fields, priceCfg.configId, formData.maSanPham]);
  useEffect(() => {
    const id = restorePriceCfgIdRef.current;
    if (!open || !id || !priceCfg.configs.length) return;
    restorePriceCfgIdRef.current = null;
    if (String(priceCfg.configId ?? "") === id) return;
    if (priceCfg.configs.some((c: any) => String(c?.ID) === id)) priceCfg.selectConfig(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, priceCfg.configs]);
  const isRestoringSheet =
    !!contractId || !!loadDocMaPGC || !!initialSheet || isEditMode;
  useEffect(() => {
    if (!open || !selectedPolicyId || !policyCatalogReady) return;
    const id = String(selectedPolicyId);
    if (policyHandledRef.current === id) return;
    policyHandledRef.current = id;
    if (isRestoringSheet || bookingRestoreInfo) {
      getPolicyDetail(id, skipPolicyAutoCalcRef.current)
        .then((res: any) => {
          const details: any[] = res?.detail || [];
          if (details.length) {
            policyDetailRowsRef.current = details;
            setChinhSachBHDetails(details);
          }
        })
        .catch(() => {
          policyHandledRef.current = "";
        });
      return;
    }
    void handleSelectCSBH(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedPolicyId, policyCatalogReady]);
  useEffect(() => {
    if (!open || !selectedTemplateId || loadingPolicies) return;
    const id = String(selectedTemplateId);
    if (scheduleHandledRef.current === id) return;
    scheduleHandledRef.current = id;
    if (isRestoringSheet || bookingRestoreInfo) {
      getScheduleDetail(id, paymentSchedules.length > 0).catch(() => {
        scheduleHandledRef.current = "";
      });
      return;
    }
    handleTemplateSelect(id).catch(() => {
      scheduleHandledRef.current = "";
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedTemplateId, loadingPolicies]);
  const serializeSchedule = (rows: PaymentSchedule[]) =>
    JSON.stringify(
      (rows || []).map((r: any) => [
        r.dot,
        r.kieuThanhToan,
        r.tyLeTT,
        r.tyLeVAT,
        r.tyLePBT,
        r.tyLeXD,
        r.soNgay,
        r.maLoaiNgay,
        r.theoThang,
        r.tuongUngFormula,
        r.tienVATFormula,
        r.phiBaoTriFormula,
        r.tongCongFormula,
      ])
    );
  const isScheduleDirty = () =>
    paymentSchedule.length > 0 &&
    scheduleSnapshotRef.current !== "" &&
    serializeSchedule(paymentSchedule) !== scheduleSnapshotRef.current;
  const applyPolicyRounds = async (
    templateId: string,
    preferredConfigId?: any
  ) => {
    const runId = ++policyRoundsRunRef.current;
    const isStale = () => policyRoundsRunRef.current !== runId;
    let templateForApply: PolicyDiscountRound[] | undefined;
    const isLow = isLowRiseProduct({
      loaiSP: formData.loaiSP,
      product,
      maSP: formData.maSanPham,
    });
    const list = cauHinhCS || [];
    const policyRow: any = chinhSachBH.find(
      (c: any) => String(c?.ID) === String(templateId)
    );

    // Chi tiết chính sách (tên, loại, giá trị, hệ số) — nguồn duy nhất
    const res: any = await getPolicyDetail(templateId);
    const details: any[] = res?.detail || [];

    const policyConfigId =
      preferredConfigId ??
      res?.data?.MaCauHinhTinhGia ??
      res?.data?.CauHinhId ??
      policyRow?.MaCauHinhTinhGia ??
      policyRow?.CauHinhId ??
      null;
    const policyConfig =
      policyConfigId != null
        ? list.find((c: any) => String(c?.ID) === String(policyConfigId))
        : null;

    if (policyConfig?.ID) {
      templateForApply = await loadRoundsFromApi(policyConfig.ID, isLow);
      if (isStale()) return { res, details, policyRow, stale: true };
      setSelectedPolicyConfigId(policyConfig.ID);
    } else if (policyConfigId != null) {
      // Cấu hình khai báo trong chính sách không có trong danh mục đã nạp
      // (khác biểu mẫu) ⇒ vẫn đọc thẳng vòng chiết khấu theo uuid.
      templateForApply = await loadRoundsFromApi(policyConfigId, isLow);
      if (isStale()) return { res, details, policyRow, stale: true };
      if (templateForApply.length) setSelectedPolicyConfigId(policyConfigId);
    }

    // Cấu hình do chính sách khai báo có thể thuộc nhóm tính giá sản phẩm
    // (CAOTANG/THAPTANG) — nhóm này KHÔNG khai báo vòng chiết khấu nên
    // loadRoundsFromApi trả rỗng và bảng chiết khấu biến mất. Khi đó lùi về
    // cấu hình đang chọn, rồi cấu hình chính sách giá (CSCAOTANG/CSTHAPTANG).
    if (!templateForApply?.length) {
      const isPolicyCode = (c: any) =>
        String(c?.FormCode ?? "").toUpperCase().startsWith("CS");
      const usedId = String(policyConfig?.ID ?? policyConfigId ?? "");
      const candidates = [
        ...list.filter(
          (c: any) => String(c?.ID) === String(selectedPolicyConfigId ?? "")
        ),
        ...list.filter((c: any) => isPolicyCode(c) && c?.Status),
        ...list.filter((c: any) => isPolicyCode(c)),
        ...list.filter((c: any) => c?.Status),
        ...list,
      ].filter((c: any) => c?.ID && String(c.ID) !== usedId);
      for (const cand of candidates) {
        const built = await loadRoundsFromApi(cand.ID, isLow);
        if (isStale()) return { res, details, policyRow, stale: true };
        if (built.length) {
          templateForApply = built;
          setSelectedPolicyConfigId(cand.ID);
          break;
        }
      }
      if (!templateForApply?.length && !policyConfig?.ID && !list.length) {
        setPolicyRounds(getDefaultRounds(isLow ? "low" : "high"));
      }
    }

    if (isStale()) return { res, details, policyRow, stale: true };
    setChinhSachBHDetails(details);
    // Số dòng chiết khấu = số dòng chi tiết của chính sách (không phải số
    // vòng khai báo trong cấu hình tính giá).
    applyCsbhDetailsToRounds(
      details,
      details.length || policyRow?.SoChietKhau,
      templateForApply
    );
    return { res, details, policyRow, stale: false };
  };
  const handleSelectCSBH = async (
    templateId: string,
    options?: { keepSchedule?: boolean }
  ) => {
    markFinancialEdited();
    // Người dùng tự đổi chính sách ⇒ bỏ chế độ giữ nguyên số liệu đã lưu
    skipPolicyAutoCalcRef.current = false;
    reopenDetails.reset();
    setSelectedPolicyId(templateId);
    policyHandledRef.current = String(templateId || "");
    // Chọn / đổi CSBH ⇒ Ngày hết hạn phiếu = hạn CSBH (ghi đè); mở lại phiếu cũ cùng CSBH thì giữ ngày đã lưu
    if (String(templateId || "") !== expiryPolicyRef.current) {
      expiryPolicyRef.current = String(templateId || "");
      const pRow: any = chinhSachBH.find((c: any) => String(c?.ID) === String(templateId));
      setFormData((prev) => ({ ...prev, ngayHetHan: policyExpiryDate(pRow) }));
    }

    if (!templateId) {
      // Reset CK fields when clearing policy
      policyRoundsRunRef.current += 1;
      setChinhSachBHDetails([]);
      policyDetailRowsRef.current = [];
      policyDetailCountRef.current = 0;
      setPolicyDetailCount(0);
      setPolicyRounds([]);
      return;
    }

    setLoadingPriceCalc(true);
    try {
      const { res, stale } = await applyPolicyRounds(templateId);
      if (stale) return;
      // Tiến độ thanh toán lấy ĐÚNG theo cột payment_schedule_id của chính
      // sách vừa chọn (MaTruonghopTT) — không suy đoán từ nguồn khác.
      const linkedTemplateId = res?.data?.MaTruonghopTT ?? null;
      if (
        !options?.keepSchedule &&
        linkedTemplateId != null &&
        String(linkedTemplateId) !== "" &&
        String(linkedTemplateId) !== "0" &&
        (String(linkedTemplateId) !== String(selectedTemplateId || "") ||
          isScheduleDirty())
      ) {
        // Lịch của chính sách ngoài hiệu lực tại Ngày giao dịch / Ngày tính (manual 110) ⇒ không tự chọn
        if (scheduleOutOfEffect(lichThanhToan, linkedTemplateId, formData.ngayKy, exceptionIds.TDTT)) {
          toast.warning(OUT_OF_EFFECT_WARNING);
        } else {
          try {
            await handleTemplateSelect(String(linkedTemplateId));
          } catch {
            /* ignore */
          }
        }
      }
    } catch (err) {
      console.error("Lỗi load chính sách bán hàng:", err);
    } finally {
      setLoadingPriceCalc(false);
    }
  };
  const getProductDefaults = () => {
    const p: any = product || {};
    const edit: any = editContractData || {};
    const isLow = isLowRiseProduct({
      product: p,
      maSP: p?.code || p?.KyHieu || p?.MaCan,
    });
    return {
      dienTichThongThuy: p.DienTichThongThuy ?? p.area ?? 0,
      tyLeVAT: p.TyLeVAT ?? edit?.GiaTriHopDong?.TyLeVAT ?? 10,
      tyLePBT: p.TyLePhiBaoTri ?? edit?.GiaTriHopDong?.TyLePhiBaoTri ?? 2,
      dienTichDat: p.land_area ?? p.DienTichDat ?? 0,
      donGiaDat: p.land_unit_price ?? p.DonGiaDat ?? 0,
      dienTichXD: p.construction_area ?? p.DienTichXD ?? 0,
      donGiaXD: p.construction_unit_price ?? p.DonGiaXD ?? p.DonGiaXayDung ?? 0,
      donGiaSuDungDat: isLow
        ? p.land_unit_price ?? p.DonGiaDat ?? 0
        : p.unit_price_before_vat ?? p.DonGiaDaVAT ?? p.DonGiaChuaVAT ?? 0,
      rawDonGiaChuaVAT:
        p.DonGiaChuaVAT ?? edit?.GiaTriHopDong?.DonGiaChuaVAT ?? null,
      rawDonGiaDaVAT: p.DonGiaDaVAT ?? edit?.GiaTriHopDong?.DonGiaDaVAT ?? null,
      rawTongGiaChuaVAT:
        p.TongGiaChuaVAT ?? edit?.GiaTriHopDong?.TongChuaVAT ?? null,
      rawTongGiaDaVAT:
        p.TongGiaDaVAT ?? edit?.GiaTriHopDong?.TongGomVAT ?? null,
      rawGiaNaked: (product ? p.GiaNaked : edit?.GiaTriHopDong?.GiaNaked) ?? null,
      // Bỏ / đổi bảng giá không có dòng của sản phẩm ⇒ không giữ Giá HĐMB chưa TT của bảng giá trước
      rawGiaHDMBLan: (product ? null : hdmbLanFromSaved(edit?.GiaTriHopDong)) ?? null,
      rawVATCuoiPBT: product ? null : vatCuoiPbtSavedOr(edit?.GiaTriHopDong, null),
      rawTienVAT: p.TienVAT ?? edit?.GiaTriHopDong?.TienVAT ?? null,
      rawTienPhiBaoTri:
        p.TienPhiBaoTri ?? edit?.GiaTriHopDong?.TienPhiBaoTri ?? null,
      rawTongGomPBT:
        p.TongGomPBT ?? edit?.GiaTriHopDong?.TongGiaGomVATPBT ?? null,
    };
  };
  const policyPickedRef = useRef<string | null>(null);
  useEffect(() => {
    const picked = policyPickedRef.current;
    if (!picked || !selectedPolicyId || String(picked).toLowerCase() !== String(selectedPolicyId).toLowerCase()) return;
    const row = chinhSachBH.find((c: { ID?: unknown; id?: unknown }) => String(c?.ID ?? c?.id ?? "").toLowerCase() === String(selectedPolicyId).toLowerCase());
    if (!row) return;
    policyPickedRef.current = null;
    const rows = bangGia.map((b) => ({ id: String(b.ID), label: b.TenDot, ma_quy_can: b.ma_quy_can, has_product: b.has_product }));
    const next = pickPriceListForPolicy(rows, unitFund.quyCanId, row, selectedPriceListId);
    if (next !== undefined) void handleBG(next ?? undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPolicyId, chinhSachBH]);
  const handleBG = async (v) => {
    markFinancialEdited();
    setSelectedPriceListId(v ?? "");
    const defaults = getProductDefaults();

    // Người dùng xoá lựa chọn bảng giá -> reset về dữ liệu sản phẩm gốc
    if (!v) {
      setFormData((prev) => ({ ...prev, ...defaults } as typeof prev));
      return;
    }

    setLoadingPriceList(true);
    try {
      const res = await ProductService.getSPByBG({
        MaSP: product?.MaSP ?? editContractData?.MaSP,
        ProductId:
          (product as any)?.id ??
          editContractData?.SanPhamId ??
          editContractData?.san_pham_id ??
          null,
        MaDA: (product as any)?.MaDA ?? editContractData?.MaDA,
        MaDot: v,
      });
      const bg = res?.data;

      // Bảng giá không trả về data -> dùng lại dữ liệu sản phẩm gốc
      if (!bg) {
        setFormData((prev) => ({ ...prev, ...defaults } as typeof prev));
        return;
      }

      // Với mỗi field: ưu tiên giá trị bảng giá, nếu null/undefined thì fallback
      // về giá trị sản phẩm gốc (KHÔNG phải prev — tránh giữ lại giá của bảng giá cũ)
      const pick = <T,>(bgVal: any, fallback: T): T =>
        bgVal !== null && bgVal !== undefined ? (bgVal as T) : fallback;

      setFormData((prev) => {
        // const dienTichThongThuy = pick(
        //   bg.DTThongThuy,
        //   defaults.dienTichThongThuy
        // );
        const tyLeVAT = pick(bg.vatch, defaults.tyLeVAT);
        const tyLePBT = pick(bg.PTPhiBaoTri, defaults.tyLePBT);
        const rawDonGiaChuaVAT = pick(
          bg.DonGiaChuaVAT,
          defaults.rawDonGiaChuaVAT
        );
        const rawDonGiaDaVAT = pick(bg.DonGiaVAT, defaults.rawDonGiaDaVAT);
        const rawTongGiaChuaVAT = pick(
          bg.TongGiaChuaVAT,
          defaults.rawTongGiaChuaVAT
        );
        const rawTongGiaDaVAT = pick(
          bg.TongGiaGomVAT,
          defaults.rawTongGiaDaVAT
        );
        const rawTienVAT = pick(bg.vatchtien, defaults.rawTienVAT);
        const rawTienPhiBaoTri = pick(bg.PhiBaoTri, defaults.rawTienPhiBaoTri);
        const rawTongGomPBT = pick(bg.TongGiaGomPBT, defaults.rawTongGomPBT);
        const rawGiaNaked = pick(bg.naked_price, defaults.rawGiaNaked);
        // const dienTichDat = pick(bg.DienTichDat, defaults.dienTichDat);
        const donGiaDat = pick(bg.DonGiaDatChuaVAT, defaults.donGiaDat);
        // const dienTichXD = pick(bg.DienTichXD, defaults.dienTichXD);
        const donGiaXD = pick(bg.DonGiaXD, defaults.donGiaXD);

        const isLow = isLowRiseProduct({
          loaiSP: prev.loaiSP,
          product,
          maSP: prev.maSanPham,
        });
        const donGiaSuDungDat = isLow
          ? donGiaDat
          : pick(bg.DonGiaVAT, defaults.donGiaSuDungDat);

        return {
          ...prev,
          // dienTichThongThuy,
          tyLeVAT,
          tyLePBT,
          // dienTichDat,
          donGiaDat,
          // dienTichXD,
          donGiaXD,
          donGiaSuDungDat,
          rawDonGiaChuaVAT,
          rawDonGiaDaVAT,
          rawTongGiaChuaVAT,
          rawTongGiaDaVAT,
          rawTienVAT,
          rawTienPhiBaoTri,
          rawTongGomPBT,
          rawGiaNaked,
          rawGiaHDMBLan: hdmbLanFromPriceList(bg),
          rawVATCuoiPBT: vatCuoiPbtFromPriceList(bg),
        } as typeof prev;
      });
    } catch (err) {
      console.error("Lỗi load sản phẩm theo bảng giá:", err);
    } finally {
      setLoadingPriceList(false);
    }
  };
  useEffect(() => {
    if (!formData.SoCMND || formData.SoCMND.length < 9) {
      setDuplicateCMND(null);
      return;
    }

    const duplicate = customers.find(
      (c) =>
        c.id_number &&
        c.id_number.toLowerCase() === formData.SoCMND.toLowerCase()
    );

    // Skip warning if this is the selected customer's own data
    if (
      duplicate &&
      selectedCustomerId &&
      duplicate.id === selectedCustomerId
    ) {
      setDuplicateCMND(null);
    } else {
      setDuplicateCMND(duplicate || null);
    }
  }, [formData.SoCMND, customers, selectedCustomerId]);
  useEffect(() => {
    if (!formData.DiDong || formData.DiDong.length < 9) {
      setDuplicatePhone(null);
      return;
    }

    const duplicate = customers.find(
      (c) =>
        c.mobile1 &&
        c.mobile1.replace(/\s/g, "") === formData.DiDong.replace(/\s/g, "")
    );

    // Skip warning if this is the selected customer's own data
    if (
      duplicate &&
      selectedCustomerId &&
      duplicate.id === selectedCustomerId
    ) {
      setDuplicatePhone(null);
    } else {
      setDuplicatePhone(duplicate || null);
    }
  }, [formData.DiDong, customers, selectedCustomerId]);
  useEffect(() => {
    if (!coOwnerForm.cmnd || coOwnerForm.cmnd.length < 9) {
      setCoOwnerDuplicateCMND(null);
      return;
    }

    const duplicate = customers.find(
      (c) =>
        c.id_number &&
        c.id_number.toLowerCase() === coOwnerForm.cmnd.toLowerCase()
    );

    // Skip warning if this is the selected co-owner customer's own data
    if (
      duplicate &&
      selectedCoOwnerCustomerId &&
      duplicate.id === selectedCoOwnerCustomerId
    ) {
      setCoOwnerDuplicateCMND(null);
    } else {
      setCoOwnerDuplicateCMND(duplicate || null);
    }
  }, [coOwnerForm.cmnd, customers, selectedCoOwnerCustomerId]);
  useEffect(() => {
    if (!coOwnerForm.phone || coOwnerForm.phone.length < 9) {
      setCoOwnerDuplicatePhone(null);
      return;
    }

    const duplicate = customers.find(
      (c) =>
        c.mobile1 &&
        c.mobile1.replace(/\s/g, "") === coOwnerForm.phone.replace(/\s/g, "")
    );

    // Skip warning if this is the selected co-owner customer's own data
    if (
      duplicate &&
      selectedCoOwnerCustomerId &&
      duplicate.id === selectedCoOwnerCustomerId
    ) {
      setCoOwnerDuplicatePhone(null);
    } else {
      setCoOwnerDuplicatePhone(duplicate || null);
    }
  }, [coOwnerForm.phone, customers, selectedCoOwnerCustomerId]);
  const handleSave = async (submitApproval = false) => {
    if (isSavingRef.current) return;
    if (readOnlyReason) {
      toast.info(readOnlyReason);
      return;
    }
    if (templateReplayBusy) {
      toast.info(TEMPLATE_REPLAY_BUSY_MESSAGE);
      return;
    }
    // Chế độ mẫu: bắt buộc Tên mẫu, gửi kèm bản đã cắt khoảng trắng
    let templateExtra: { TenMau: string } | null = null;
    if (sections.templateName) {
      const chk = validateTemplateName(tenMau);
      if (chk.ok === false) {
        toast.error(chk.error);
        return;
      }
      templateExtra = { TenMau: chk.name };
    }
    if (!reopenDetails.guardSave()) return;
    if (unitFund.missing) {
      toast.error("Vui lòng chọn quỹ căn");
      return;
    }
    // Phiếu tính giá / mẫu: không bắt buộc thông tin khách hàng
    if (type !== "pricesheet" && sections.customer) {
      if (formData?.customerType === "individual" && !formData.TenKH.trim()) {
        toast.error("Vui lòng nhập họ tên");
        return;
      }
      if (formData?.customerType === "business" && !formData.TenCongTy.trim()) {
        toast.error("Vui lòng nhập tên doanh nghiệp");
        return;
      }
    }
    if (salesCompanyRule.required && !congTyBanHangId) { toast.error("Vui lòng chọn Công ty bán hàng"); return; }

    isSavingRef.current = true;
    setIsSaving(true);
    // Phiếu tính giá: handedOff = đã giao payload cho bên gọi ghi; keepLocked = ghi xong, form đóng, khoá giữ đến lần mở sau
    let handedOff = false;
    let keepLocked = false;

    try {
      let res = null;

      // ===== Helpers =====
      const num = (v: any) =>
        v === null || v === undefined || v === "" ? null : Number(v);

      // Format ISO 8601 với timezone (+07:00) cho .NET DateTimeOffset.
      // Nhận Date | dayjs | string | null.
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

      // Giá trị từ lưới/BG
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

      // GiaTriHopDong: gốc
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

      // GiaTriHopDongSauCK: từ kết quả tính
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

      // LichThanhToan
      const dueDates = dueDatesOf(paymentSchedule || []);
      const LichThanhToan = (paymentSchedule || []).map((row: any, i: number) =>
        toSavedScheduleItem(row, isLow, {
          MaPGC: currentMaPGC,
          MaTH: selectedTemplateId,
          NgayTT: dueDates[i],
        })
      );

      // KhuyenMai
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

      if (type === "pricesheet") {
        // Snapshot đầy đủ để lưu mock trên trình duyệt + in phiếu tính giá
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
        // Bên gọi mới thực sự ghi (và tự báo thành công / lỗi) ⇒ chờ xong rồi mới đóng, giữ khoá đến lần mở sau:
        // trước đây nhánh này không await nên khoá nhả ngay, bấm đúp / bấm lúc form đang đóng ⇒ tạo 2 phiếu.
        handedOff = true;
        const handed = { ...payload, _snapshot: snapshot, ...templateExtra, _submitApproval: submitApproval };
        await onSaveSuccess?.((fromTemplate ? withTemplateTrace(handed, fromTemplate) : handed) as any);
        keepLocked = true;
        onOpenChange(false);
        return;
      }


      if (type === "deposit") {
        if (fromBooking) {
          res = await ProductService?.addBookingDatCoc(payload);
          if (res?.status !== 2000) {
            res = await ProductService?.addDatCoc(payload);
          }
        } else {
          res = await ProductService?.addDatCoc(payload);
        }

      } else if (type === "contract") {
        if (currentMaPGC) {
          res = await ProductService?.addHopDongV2(payload);
        } else {
          res = await ProductService?.addHopDong(payload);
        }
      } else if (type === "investment") {
        if (currentMaPGC) {
          res = await ProductService?.addGopVonV2(payload);
        } else {
          res = await ProductService?.addGopVon(payload);
        }
      }

      if (res?.status === 2000) {
        toast.success(
          type === "deposit"
            ? `Đã lưu phiếu đặt cọc thành công`
            : type === "investment"
              ? `Đã lưu hợp đồng góp vốn thành công`
              : `Đã lưu hợp đồng thành công`
        );
        onSaveSuccess?.(res);
        onOpenChange(false);
      }
    } catch (error: any) {
      console.error("Error saving contract:", error);
      if (allowsSaveFallback(type, sections, handedOff)) {
        // Không để lỗi dựng payload chặn việc lưu phiếu tính giá
        handedOff = true;
        const fallback: any = {
          _submitApproval: submitApproval,
          TTHopDong: {
            SoPhieu: (formData as any)?.soHopDong || "",
            MaSP: (product as any)?.MaSP ?? null,
            MaDA: (product as any)?.MaDA ?? null,
            MaCan: (product as any)?.KyHieu ?? "",
            // Công ty bán hàng — TenCongTyBanHang là tên thuần (không hậu tố)
            CongTyBanHangId: congTyBanHangId || null,
            TenCongTyBanHang: nameOfCongTyBanHang(congTyBanHangId),
            ...(sections.templateName ? {} : templateTraceOf(initialSheet)),
          },
          TTKhachHang: {
            TenKH: (formData as any)?.TenKH || "",
            DiDong: (formData as any)?.DiDong || "",
          },
          _snapshot: {
            projectName:
              (formData as any)?.duAn || (product as any)?.TenDA || "",
            productCode: (product as any)?.KyHieu || "",
            isLowRise: isLowRiseProduct(product as any),

            area:
              Number((formData as any)?.dienTichThongThuy) ||
              Number((product as any)?.DienTichThongThuy) ||
              0,
            policyName:
              (chinhSachBH || []).find((p: any) => p?.ID === selectedPolicyId)
                ?.TenChinhSach ||
              (formData as any)?.tenChinhSach ||
              "",
            scheduleName:
              (lichThanhToan || []).find(
                (t: any) => t?.MaTH === selectedTemplateId
              )?.TenTH || "",
            totals: {},
          },
          ...templateExtra,
        };
        await onSaveSuccess?.(fromTemplate ? withTemplateTrace(fallback, fromTemplate) : fallback);
        keepLocked = true;
        onOpenChange(false);
        return;
      }
      toast.error(`Lỗi khi lưu: ${error.message || "Đã xảy ra lỗi"}`);

    } finally {
      setIsSaving(false);
      // Phiếu tính giá đã giao cho bên gọi ghi ⇒ form đóng, khoá nhả khi mở lại (effect theo `open`)
      if (!keepLocked) isSavingRef.current = false;
    }
  };
  const removePaymentRow = (id: number) => {
    markFinancialEdited();
    setPaymentSchedule((prev) =>
      recalcPaymentScheduleSequential(removeScheduleRow(prev, id), true)
    );
  };
  const handleTemplateSelect = async (templateId: string) => {
    markFinancialEdited();
    setSelectedTemplateId(templateId);
    scheduleHandledRef.current = String(templateId || "");

    if (!templateId) return;
    setLoadingSchedule(true);

    let res: any;
    try {
      res = await getScheduleDetail(String(templateId));
    } catch (e) {
      setLoadingSchedule(false);
      throw e;
    }
    const details: any[] = res?.detail || [];

    if (!details.length) {
      if (!res?.pending) toast.error("Tiến độ thanh toán chưa có chi tiết");
      setLoadingSchedule(false);
      return;
    }

    // Map installments to payment schedule
    const sortedDetails = details
      .slice()
      .sort((a, b) => (a.DotTT || 0) - (b.DotTT || 0));
    const isLowRise = isLowRiseProduct({
      loaiSP: formData.loaiSP,
      product,
      maSP: formData.maSanPham,
    });
    // Map từng dòng template -> PaymentSchedule. Công thức lấy đúng theo
    // field API trả về; nếu trả về chuỗi rỗng nghĩa là CHƯA cấu hình ->
    // giữ nguyên chuỗi rỗng (calc sẽ rơi về fallback theo tỷ lệ).
    const baseRows: PaymentSchedule[] = sortedDetails.map((inst, index) => {
      const tyLeTT = Number(inst.TyLeTT) || 0;
      const tyLeVAT = Number(inst.TyLeVAT ?? formData.tyLeVAT ?? 10) || 0;
      const tyLeVATDat = Number(inst.TyLeVATDat) || 0;
      const tyLePBT = Number(inst.TyLePBT) || 0;
      const tyLeXD = Number(inst.TyLeXD ?? inst.TyLeXayDung ?? 0) || 0;
      return {
        id: index + 1,
        dot: inst.DotTT || index + 1,
        // normalizeDetails trả tên đợt ở `TenDot` (MoTa: dữ liệu kiểu cũ)
        kieuThanhToan: inst.TenDot || inst.MoTa || `Đợt ${inst.DotTT || index + 1}`,
        ...scheduleFormulasFromTemplate(inst, isLowRise),
        tyLeTT,
        soTien: 0,
        tyLeVAT,
        tienVAT: 0,
        tyLeVATDat,
        tienVATDat: 0,
        tyLePBT,
        tyLeXD,
        hasPBT: tyLePBT > 0,
        tienBaoTri: 0,
        tienXD: 0,
        tongGiaTri: 0,
        ...templateDuration(inst),
        // Bỏ chọn loại ngày ⇒ null: Ngày TT để trống
        maLoaiNgay: inst.MaLoai == null || inst.MaLoai === "" ? null : Number(inst.MaLoai),
        giaoDich: giaoDichKey(inst.GiaoDich),
        tienCoc: Number(inst.TienCoc) || 0,
        tyLeVonTuCo: Number(inst.TyLeVonTuCo) || 0,
        tyLeVayNH: Number(inst.TyLeVayNH) || 0,
        ...templatePrintText(inst),
      } as PaymentSchedule;
    });

    // Tính tuần tự để PrevTuongUng/PrevVAT/PrevPBT/PrevTongCong cộng dồn đúng giữa các đợt
    const nextRows = recalcPaymentScheduleSequential(baseRows);
    setPaymentSchedule(nextRows);
    scheduleSnapshotRef.current = serializeSchedule(nextRows);
    setLoadingSchedule(false);
    toast.success("Đã load lịch thanh toán");
  };
  const openCoOwnerDialog = () => {
    setCoOwnerType("individual");
    setCoOwnerForm({
      title: "Ông",
      name: "",
      cmnd: "",
      ngayCap: null,
      noiCap: "",
      phone: "",
      email: "",
      diaChi: "",
      diaChiLH: "",
      tenDoanhNghiep: "",
      maSoThue: "",
      nguoiDaiDien: "",
      chucVu: "",
      maKH: null,
    });
    setCoOwnerSearch("");
    setShowCoOwnerCustomerDropdown(false);
    setCoOwnerDuplicateCMND(null);
    setCoOwnerDuplicatePhone(null);
    setSelectedCoOwnerCustomerId(null); // Reset to enable duplicate checking for new entry
    setShowCoOwnerDialog(true);
  };
  const saveCoOwner = async () => {
    if (coOwnerType === "individual" && !coOwnerForm.name.trim()) {
      toast.error("Vui lòng nhập họ tên");
      return;
    }
    if (coOwnerType === "business" && !coOwnerForm.tenDoanhNghiep.trim()) {
      toast.error("Vui lòng nhập tên doanh nghiệp");
      return;
    }

    let maKH: any = coOwnerForm.maKH;

    // Nếu chưa chọn từ kho -> tạo mới khách hàng để lấy MaKH
    if (!maKH) {
      try {
        setSavingCoOwner(true);
        const payload: any = {
          IsPersonal: coOwnerType === "individual",
          TenKH:
            coOwnerType === "individual"
              ? coOwnerForm.name
              : coOwnerForm.tenDoanhNghiep,
          SoCMND: coOwnerForm.cmnd || null,
          NgayCap: coOwnerForm.ngayCap
            ? format(coOwnerForm.ngayCap as any, "yyyy-MM-dd")
            : null,
          NoiCap: coOwnerForm.noiCap || null,
          DiDong: coOwnerForm.phone || null,
          Email: coOwnerForm.email || null,
          ThuongTru: coOwnerForm.diaChi || null,
          // Business fields
          TenCongTy: coOwnerForm.tenDoanhNghiep || null,
          MaSoThueCT: coOwnerForm.maSoThue || null,
          NguoiDaiDienPL:
            coOwnerType === "business" ? coOwnerForm.nguoiDaiDien : null,
          ChucVu: coOwnerForm.chucVu || null,
        };

        // Người đồng đứng tên thêm mới (chưa có MaKH) ⇒ không ghi đè khách trùng CCCD/SĐT trong phạm vi (BUG-001, TK4)
        const res = await CustomerService.upcert(payload, { forceNew: true });
        if (res?.status !== 2000) {
          throw new Error(res?.message || "Không thể tạo khách hàng");
        }
        maKH = res.data;
      } catch (err: any) {
        toast.error(err?.message || "Có lỗi khi tạo khách hàng");
        setSavingCoOwner(false);
        return;
      } finally {
        setSavingCoOwner(false);
      }
    }

    setCoOwners([
      ...coOwners,
      {
        ...coOwnerForm,
        id: crypto.randomUUID(),
        type: coOwnerType,
        maKH,
        title: coOwnerForm.title,
        name: coOwnerForm.name,
        cmnd: coOwnerForm.cmnd,
        ngayCap: coOwnerForm.ngayCap,
        noiCap: coOwnerForm.noiCap,
        phone: coOwnerForm.phone,
        email: coOwnerForm.email,
        diaChi: coOwnerForm.diaChi,
        diaChiLH: coOwnerForm.diaChiLH,
        tenDoanhNghiep: coOwnerForm.tenDoanhNghiep,
        maSoThue: coOwnerForm.maSoThue,
        nguoiDaiDien: coOwnerForm.nguoiDaiDien,
        chucVu: coOwnerForm.chucVu,
      },
    ]);
    setShowCoOwnerDialog(false);
    toast.success("Đã thêm người đồng đứng tên");
  };
  const removeCoOwner = (id: string) => {
    setCoOwners(coOwners.filter((c) => c.id !== id));
  };
  useEffect(() => {
    if (!coOwnerSearch) {
      setCoOwnerOptions([]);
      return;
    }
    if (coOwnerSearchTimeoutRef.current) {
      clearTimeout(coOwnerSearchTimeoutRef.current);
    }
    if (coOwnerSearchTimeoutRef.current) {
      clearTimeout(coOwnerSearchTimeoutRef.current);
    }
    const reqId = ++coOwnerSearchReqIdRef.current;
    coOwnerSearchTimeoutRef.current = setTimeout(async () => {
      setLoadingCoOwnerKH(true);
      try {
        let list: any[] = [];
        if (coOwnerType === "business") {
          const res: any = await CustomerService.getList({
            MaTT: null,
            MaNguon: null,
            InputSearch: coOwnerSearch,
            PageIndex: 1,
            PageSize: 50,
            IsPersonal: false,
          });
          list = Array.isArray(res?.data) ? res.data : [];
        } else {
          const res = await CustomerService.filter({
            Limit: 10,
            Offset: 1,
            MaNKH: 0,
            MaNVCS: 0,
            MaTT: 0,
            inputSearch: coOwnerSearch,
          });
          list = res?.data?.length ? res.data : [];
        }
        // Chỉ apply nếu là request mới nhất (chống race-condition)
        if (reqId !== coOwnerSearchReqIdRef.current) return;
        setCoOwnerOptions(list);
      } catch (err) {
        if (reqId !== coOwnerSearchReqIdRef.current) return;
        setCoOwnerOptions([]);
      } finally {
        if (reqId === coOwnerSearchReqIdRef.current) {
          setLoadingCoOwnerKH(false);
        }
      }
    }, 500);

    return () => {
      if (coOwnerSearchTimeoutRef.current)
        clearTimeout(coOwnerSearchTimeoutRef.current);
    };
  }, [coOwnerSearch, coOwnerType]);
  const handleCoOwnerApiCustomerSelect = (customer: any) => {
    setSelectedCoOwnerCustomerId(customer.MaKH || customer.maKH || null);
    setCoOwnerForm({
      ...coOwnerForm,
      ...customer,
      name: customer.tenKH || customer.TenKH || "",
      cmnd: customer.soCMND || customer.SoCMND || "",
      ngayCap:
        customer.ngayCap || customer.NgayCap
          ? new Date(customer.ngayCap || customer.NgayCap)
          : null,
      noiCap: customer.noiCap || customer.NoiCap || "",
      phone: customer.diDong || customer.DiDong || "",
      email: customer.email || customer.Email || "",
      diaChi: customer.diaChi || customer.ThuongTru || "",
      diaChiLH: customer.diaChi || customer.ThuongTru || "",
    });
    setCoOwnerSearch("");
    setShowCoOwnerCustomerDropdown(false);
    toast.success(`Đã chọn khách hàng: ${customer.tenKH || customer.TenKH}`);
  };
  const handleCoOwnerApiBusinessSelect = (customer: any) => {
    setSelectedCoOwnerCustomerId(customer.MaKH || null);
    setCoOwnerForm({
      ...coOwnerForm,
      tenDoanhNghiep: customer.TenCongTy || "",
      maSoThue: customer.MaSoThueCT || "",
      diaChi: customer.DiaChiCT || "",
      email: customer.EmailCT || "",
      phone: customer.DienThoaiCT || "",
      nguoiDaiDien: customer.TenKH || customer.NguoiDaiDienPL || "",
      chucVu: customer.ChucVu || "",
    });
    setCoOwnerSearch("");
    setShowCoOwnerCustomerDropdown(false);
    toast.success(
      `Đã chọn doanh nghiệp: ${customer.TenCongTy || customer.TenKH}`
    );
  };
  const handleCustomerSelect = (customer: any) => {
    setShowCustomerDropdown(false);
    setCustomerSearch("");
    setSelectedCustomerId(String(customer.MaKH || ""));

    if (formData.customerType === "business") {
      setFormData((prev) => ({
        ...prev,
        MaKH: customer.MaKH ?? null,
        TenCongTy: customer?.TenCongTy,
        MaSoThueCT: customer?.MaSoThueCT,
        DiaChiCT: customer?.DiaChiCT,
        EmailCT: customer?.EmailCT,
        DienThoaiCT: customer?.DienThoaiCT,
        NguoiDaiDienPL: customer?.TenKH,
        ChucVu: customer?.ChucVu,
        NgayCapGPKD: customer?.NgayCapGPKD,
        NoiCapGPKD: customer?.NoiCapGPKD,
        SoGPKD: customer?.SoGPKD,
        MaSoKH: customer?.MaSoKH,
      }));
      toast.success(
        `Đã chọn doanh nghiệp: ${customer?.TenCongTy || customer?.TenKH}`
      );
    } else {
      setFormData((prev) => ({
        ...prev,
        MaKH: customer?.MaKH ?? null,
        TenKH: customer?.TenKH,
        SoCMND: customer?.SoCMND,
        DiDong: customer?.DiDong,
        Email: customer?.Email,
        DiaChi: customer?.DiaChi,
        ThuongTru: customer?.ThuongTru,
        NgaySinh: customer?.NgaySinh ? new Date(customer?.NgaySinh) : null,
        NgayCap: customer?.NgayCap ? new Date(customer?.NgayCap) : null,
        NoiCap: customer?.NoiCap,
        MaQD: customer?.MaQD ?? null,
        MaSoKH: customer?.MaSoKH,
      }));
      toast.success(`Đã chọn khách hàng: ${customer?.TenKH}`);
    }
  };
  useEffect(() => {
    if (!customerSearch) {
      setCustomerOptions([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const reqId = ++customerSearchReqIdRef.current;
    searchTimeoutRef.current = setTimeout(async () => {
      setLoadingKH(true);
      try {
        const res: any = await CustomerService.getList({
          MaTT: null,
          MaNguon: null,
          InputSearch: customerSearch,
          PageIndex: 1,
          PageSize: 50,
          IsPersonal: formData.customerType === "individual",
        });
        const list = Array.isArray(res?.data) ? res.data : [];

        if (reqId !== customerSearchReqIdRef.current) return;
        setCustomerOptions(list);
      } catch (err) {
        if (reqId !== customerSearchReqIdRef.current) return;
        setCustomerOptions([]);
      } finally {
        if (reqId === customerSearchReqIdRef.current) {
          setLoadingKH(false);
        }
      }
    }, 500);

    return () => clearTimeout(searchTimeoutRef.current);
  }, [customerSearch, formData.customerType]);
  const buildAdvisorContext = () => {
    const n = (v: any) => Number(v) || 0;
    return {
      customer360,
      product: {
        kyHieu: (product as any)?.KyHieu || (formData as any)?.maSanPham || "",
        duAn:
          (formData as any)?.duAn ||
          (product as any)?.TenDA ||
          (product as any)?.project_name ||
          "",
        loaiBDS:
          (product as any)?.TenLoaiBDS || (formData as any)?.loaiSP || "",
        huong: (product as any)?.Huong || (product as any)?.TenView || "",
        dienTichThongThuy:
          n((formData as any)?.dienTichThongThuy) ||
          n((product as any)?.DienTichThongThuy),
        dienTichTimTuong:
          n((formData as any)?.dienTichTimTuong) ||
          n((product as any)?.DienTichTimTuong),
        dienTichDat: n((product as any)?.DienTichDat),
        tang: (product as any)?.Tang ?? null,
      },
      totals: {
        donGiaVAT: n((formData as any)?.donGiaVAT),
        tongGiaTriHD: n((calculations as any)?.tongGiaTriHD),
        tongGomVAT: n((calculations as any)?.tongGomVAT),
        tienChietKhau: n((calculations as any)?.tienChietKhau),
        tyLeChietKhau: n((calculations as any)?.totalDiscountPercent),
        phiBaoTri: n((calculations as any)?.phiBaoTri),
      },
      policy: {
        id: selectedPolicyId || null,
        ten:
          (chinhSachBH || []).find((p: any) => p?.ID === selectedPolicyId)
            ?.TenChinhSach || "",
      },
      policyRounds: enabledRoundsWithResults(policyRounds, (calculations as any)?.roundResults)
        .map(({ round: r, result }, i: number) => ({
          ten: r?.name || `Chiết khấu ${i + 1}`,
          tyLe: n(r?.discountPercent),
          soTien: n(result?.tongCK) || n(r?.tienCK),
        })),
      promotions: (selectedPromotion || []).map((g: any) => ({
        ten: g?.TenQuaTang,
        soLuong: n(g?.SoLuong),
        giaTri: n(g?.GiaTri),
      })),
      schedule: {
        ten:
          (lichThanhToan || []).find((t: any) => t?.MaTH === selectedTemplateId)
            ?.TenTH || "",
        dot: (paymentSchedule || []).map((row: any, i: number) => ({
          dot: row?.dot ?? i + 1,
          dienGiai: row?.kieuThanhToan || row?.dienGiai || `Đợt ${i + 1}`,
          tyLe: n(row?.tyLeTT),
          // Ngày TT như bảng lịch (đã chọn / đã lưu, hoặc tính theo loại ngày)
          ngayTT: dueDatesOf(paymentSchedule || [])[i],
          soTien: n(row?.tongGiaTri) || n(row?.soTien),
        })),
      },
      policyOptions: (chinhSachBH || []).map((p: any) => ({
        id: p?.ID,
        ten: p?.TenChinhSach,
        soChietKhau: p?.SoChietKhau ?? null,
      })),
      scheduleOptions: (lichThanhToan || []).map((t: any) => ({
        id: t?.MaTH,
        ten: t?.TenTH,
      })),
    };
  };
  return { sections, steps, maPGC, prefillMaPGC, initialMaKH, tenMau, setTenMau, fetchedProduct, setFetchedProduct, product, lastProductFetchKeyRef, loadDocMaPGC, isDocPrefill, currentStep, setCurrentStep, customer360, setCustomer360, patchCustomer360, isEditMode, setIsEditMode, editContractData, setEditContractData, effectiveMaDA, setEffectiveMaDA, hasApprovalFlow, setHasApprovalFlow, approvalProjectKey, formContentRef, summaryScrollRef, selectedPolicyId, setSelectedPolicyId, expiryPolicyRef, selectedPolicyIdRef, discounts, setDiscounts, selectedDiscountIds, setSelectedDiscountIds, priceSheets, setPriceSheets, selectedPriceSheetId, setSelectedPriceSheetId, priceLists, setPriceLists, selectedPriceListId, setSelectedPriceListId, selectedPriceListIdRef, loadChinhSachKeyRef, policyDetailCacheRef, configRoundsCacheRef, scheduleDetailCacheRef, getPolicyDetail, getScheduleDetail, policyHandledRef, scheduleHandledRef, paymentTemplates, setPaymentTemplates, selectedTemplateId, setSelectedTemplateId, policyRounds, setPolicyRounds, configRoundsTemplate, setConfigRoundsTemplate, policyDetailCount, setPolicyDetailCount, policyDetailCountRef, policyDetailRowsRef, policyRoundsRunRef, scheduleSnapshotRef, restoreTemplateIdRef, restorePriceCfgIdRef, policyConfigs, setPolicyConfigs, selectedPolicyConfigId, setSelectedPolicyConfigId, inventoryProducts, setInventoryProducts, cauHinhCS, setCauHinhCS, handoverStandard, setHandoverStandard, htlsProgram, setHtlsProgram, productPriceInputs, setProductPriceInputs, lichThanhToan, setLichThanhToan, bangGia, setBangGia, chinhSachBH, setChinhSachBH, chinhSachBHDetails, setChinhSachBHDetails, selectedPolicyRow, reopenDetails, khuyenMai, setKhuyenMai, selectedInventoryProductId, setSelectedInventoryProductId, productSelectionCollapsed, setProductSelectionCollapsed, selectedPromotionId, setSelectedPromotionId, selectedPromotion, setSelectedPromotion, selectKey, setSelectKey, pendingRestoreChinhSach, setPendingRestoreChinhSach, pendingRestoreLichTT, setPendingRestoreLichTT, restoredChinhSachSnapshot, setRestoredChinhSachSnapshot, financialEdited, setFinancialEdited, restorePolicyConfigIdRef, skipPolicyAutoCalcRef, bookingRestoreInfo, setBookingRestoreInfo, bookingRestoreDoneRef, restoreRoundsRef, autoAppliedPolicyKeyRef, restoreRoundsTick, setRestoreRoundsTick, restoredSnapshotRef, markFinancialEdited, loading, setLoading, coOwners, setCoOwners, customerFormRef, handleAddCoOwnerFromForm, removeCoOwnerByPascal, showCoOwnerDialog, setShowCoOwnerDialog, coOwnerType, setCoOwnerType, coOwnerForm, setCoOwnerForm, customers, setCustomers, customerSearch, setCustomerSearch, showCustomerDropdown, setShowCustomerDropdown, duplicateCMND, setDuplicateCMND, duplicatePhone, setDuplicatePhone, selectedCustomerId, setSelectedCustomerId, coOwnerDuplicateCMND, setCoOwnerDuplicateCMND, coOwnerDuplicatePhone, setCoOwnerDuplicatePhone, coOwnerSearch, setCoOwnerSearch, showCoOwnerCustomerDropdown, setShowCoOwnerCustomerDropdown, selectedCoOwnerCustomerId, setSelectedCoOwnerCustomerId, formData, setFormData, listNhanVienKD, listSanGiaoDich, quyDanhOptions, nganHangOptions, congTyBanHangId, setCongTyBanHangId, congTyBanHangTen, setCongTyBanHangTen, salesCompanyOptions, nameOfCongTyBanHang, salesCompanyLocked, salesCompanyRequired, salesCompanyAutoId, salesCompanyLoadFailed, optionViewer, salesCompanyRule, gate, companyChanged, markCompanyChanged, resetCompanyChanged, paymentSchedule, setPaymentSchedule, printTemplate, savedPrintScheduleRef, appliedDiscounts, setAppliedDiscounts, paymentSchedules, setPaymentSchedules, promotionsRaw, setPromotionsRaw, isSaving, setIsSaving, isSavingRef, interestIncentive, setInterestIncentive, rightTab, setRightTab, loadingPolicies, setLoadingPolicies, policiesLoadedMaDA, setPoliciesLoadedMaDA, catalogMaDA, policyCatalogReady, productUuid, unitFund, loadingPriceCalc, setLoadingPriceCalc, loadingSchedule, setLoadingSchedule, loadingPriceList, setLoadingPriceList, savingCoOwner, setSavingCoOwner, prevOpenRef, customerOptions, setCustomerOptions, loadingKH, setLoadingKH, searchTimeoutRef, customerSearchReqIdRef, coOwnerSearchReqIdRef, coOwnerOptions, setCoOwnerOptions, loadingCoOwnerKH, setLoadingCoOwnerKH, coOwnerSearchTimeoutRef, coOwnerRef, contractData, setContractData, latestCalculationsRef, latestHdmbLanRef, latestVatCuoiPbtRef, formulaCtx, getPaymentFormulaVars, calculatePaymentScheduleRow, getRestoredRoundResults, recalcPaymentScheduleSequential, dueDatesOf, calculations, hdmbLanSig, calcBaseSigRef, mapApiDetailsToFormulas, criteria, optionHighRise, optionChecked, optionUsage, exceptionIds, optionNgay, priorSheet, allocRequired, optionCtx, optionCtxRef, policyRoundsRef, replayIdle, templateReplayStep, templateReplayBusy, loadRoundsFromApi, applyCsbhDetailsToRounds, maxRounds, canAddRound, handlePolicyConfigChange, lateRestoreConfigRef, depositFromDoc, ngayTinhKey, PRICE_FIELD_MAP, handleProductPriceInputs, isLowProductForPrice, priceCfg, priceCodeValues, priceSyncRef, isRestoringSheet, serializeSchedule, isScheduleDirty, applyPolicyRounds, handleSelectCSBH, getProductDefaults, policyPickedRef, handleBG, handleSave, removePaymentRow, handleTemplateSelect, openCoOwnerDialog, saveCoOwner, removeCoOwner, handleCoOwnerApiCustomerSelect, handleCoOwnerApiBusinessSelect, handleCustomerSelect, buildAdvisorContext };
}

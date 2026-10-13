import { useCallback, useMemo, useRef, useState } from "react";

import { computePriceSheet } from "@/lib/priceSheetCalc";
import {
  applyPolicyDetailsToRounds,
  buildRoundTemplate,
  computeAllFormulas,
  getPriceFieldsFromApi,
  normalizePolicyDetail,
  type PolicyDiscountRound,
} from "@/lib/priceSheetFormulas";
import {
  appEditBlockReason,
  applyPriceInputs,
  applyPriceListItem,
  buildPayload,
  buildSaveRow,
  customerFromSheet,
  formFromProduct,
  formFromSheet,
  priceCodeValues,
  productIsLowRise,
  roundsFromSheet,
  type SheetCustomer,
  type SheetDraft,
  type SheetForm,
  type SheetPromotion,
} from "@/lib/priceSheetPayload";
import { recalcPaymentScheduleSequential, scheduleRowsFromTemplate, type ScheduleRow } from "@/lib/priceSheetSchedule";
import { PriceSheetService, type PriceSheetRow } from "@/sevicesSupabase/PriceSheetService";

type Option = { id: string; name: string };
type PolicyOption = Option & { pricingConfigId: string | null; scheduleId: string | null };

export interface SalesConfig {
  priceLists: any[];
  policies: PolicyOption[];
  schedules: Option[];
  promotions: SheetPromotion[];
  policyConfigs: any[];
}

const EMPTY_CONFIG: SalesConfig = { priceLists: [], policies: [], schedules: [], promotions: [], policyConfigs: [] };

/**
 * Bản nháp phiếu tính giá – chạy đúng chuỗi của web (PriceSheetForm):
 * căn → giá theo cấu hình tính giá sản phẩm → bảng giá ưu tiên cao nhất (handleBG) → chính sách gắn với bảng giá
 * (handleSelectCSBH: chi tiết CK + cấu hình CSBH → khung vòng) → tiến độ của chính sách (handleTemplateSelect).
 * Tiền tính bằng lib thuần (priceSheetCalc / priceSheetSchedule), lưu bằng fn_price_sheet_save.
 */
export function usePriceSheetDraft() {
  const [product, setProduct] = useState<any>(null);
  const [form, setForm] = useState<SheetForm | null>(null);
  const [config, setConfig] = useState<SalesConfig>(EMPTY_CONFIG);
  const [priceListId, setPriceListId] = useState<string | null>(null);
  const [policyId, setPolicyId] = useState<string | null>(null);
  const [policyName, setPolicyName] = useState("");
  const [policyConfigId, setPolicyConfigId] = useState<string | null>(null);
  const [policyDetails, setPolicyDetails] = useState<any[]>([]);
  const [roundTemplate, setRoundTemplate] = useState<PolicyDiscountRound[]>([]);
  const [rounds, setRounds] = useState<PolicyDiscountRound[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [templateRows, setTemplateRows] = useState<ScheduleRow[]>([]);
  const [promotions, setPromotions] = useState<SheetPromotion[]>([]);
  const [customer, setCustomer] = useState<SheetCustomer | null>(null);
  const [editing, setEditing] = useState<PriceSheetRow | null>(null);
  const [busy, setBusy] = useState<null | "product" | "priceList" | "policy" | "schedule">(null);
  /** Chặn kết quả cũ khi người dùng đổi nhanh (đổi căn / bảng giá / chính sách liên tiếp) */
  const seq = useRef({ product: 0, priceList: 0, policy: 0, schedule: 0 });

  const calc = useMemo(() => (form ? computePriceSheet(form, rounds) : null), [form, rounds]);
  const schedule = useMemo(
    () =>
      calc && form
        ? recalcPaymentScheduleSequential(templateRows, { calculations: calc, rawTongGiaChuaVAT: form.rawTongGiaChuaVAT })
        : [],
    [templateRows, calc, form]
  );

  const loadTemplate = useCallback(async (id: string | null, isLow: boolean, tyLeVAT: number) => {
    const s = ++seq.current.schedule;
    setTemplateId(id);
    if (!id) {
      setTemplateRows([]);
      setTemplateName("");
      return;
    }
    setBusy("schedule");
    try {
      const res = await PriceSheetService.getSchedule(id);
      if (s !== seq.current.schedule) return;
      setTemplateName(res?.name || "");
      if (!res?.details?.length) throw new Error("Tiến độ thanh toán chưa có chi tiết");
      setTemplateRows(scheduleRowsFromTemplate(res.details, isLow, tyLeVAT));
    } finally {
      if (s === seq.current.schedule) setBusy(null);
    }
  }, []);

  /** Chọn chính sách – handleSelectCSBH (template theo cấu hình của chính sách, không có thì cấu hình mặc định) */
  const loadPolicy = useCallback(
    async (
      id: string | null,
      ctx: { isLow: boolean; tyLeVAT: number; configs: any[]; currentConfigId: string | null; currentTemplate: PolicyDiscountRound[]; currentScheduleId: string | null }
    ) => {
      const s = ++seq.current.policy;
      setPolicyId(id);
      if (!id) {
        setPolicyName("");
        setPolicyDetails([]);
        setRounds([]);
        return;
      }
      setBusy("policy");
      try {
        const policy = await PriceSheetService.getPolicy(id);
        if (s !== seq.current.policy) return;
        if (!policy) throw new Error("Không tìm thấy chính sách bán hàng");
        const details = policy.detail.map(normalizePolicyDetail);
        let template = ctx.currentTemplate;
        let configId = ctx.currentConfigId;
        const pick = policy.pricingConfigId
          ? String(policy.pricingConfigId)
          : !ctx.currentConfigId
            ? (ctx.configs.find((c) => c?.Status) || ctx.configs[0])?.ID ?? null
            : null;
        if (pick) {
          template = buildRoundTemplate(await PriceSheetService.getConfigRounds(String(pick)), ctx.isLow);
          if (s !== seq.current.policy) return;
          configId = String(pick);
        }
        setPolicyName(policy.name);
        setPolicyConfigId(configId);
        setRoundTemplate(template);
        setPolicyDetails(details);
        setRounds(applyPolicyDetailsToRounds(details, template));
        if (policy.scheduleId && String(policy.scheduleId) !== String(ctx.currentScheduleId || "")) {
          await loadTemplate(String(policy.scheduleId), ctx.isLow, ctx.tyLeVAT);
        }
      } finally {
        if (s === seq.current.policy) setBusy(null);
      }
    },
    [loadTemplate]
  );

  /** Bảng giá – handleBG (+ tự chọn chính sách theo sales_policy_id của bảng giá) */
  const loadPriceList = useCallback(
    async (
      id: string | null,
      ctx: { product: any; cfg: SalesConfig; currentPolicyId: string | null; currentConfigId: string | null; currentTemplate: PolicyDiscountRound[]; currentScheduleId: string | null; tyLeVAT: number }
    ) => {
      const s = ++seq.current.priceList;
      setPriceListId(id);
      setBusy("priceList");
      try {
        const item = id ? await PriceSheetService.getPriceListItem(id, ctx.product) : null;
        if (s !== seq.current.priceList) return;
        setForm((f) => (f ? applyPriceListItem(f, item, ctx.product) : f));
      } finally {
        if (s === seq.current.priceList) setBusy(null);
      }
      const row = ctx.cfg.priceLists.find((b) => String(b?.id) === String(id));
      const autoPolicy = row?.sales_policy_id ? String(row.sales_policy_id) : null;
      if (
        autoPolicy &&
        ctx.cfg.policies.some((p) => p.id === autoPolicy) &&
        autoPolicy !== String(ctx.currentPolicyId || "")
      ) {
        await loadPolicy(autoPolicy, {
          isLow: productIsLowRise(ctx.product),
          tyLeVAT: ctx.tyLeVAT,
          configs: ctx.cfg.policyConfigs,
          currentConfigId: ctx.currentConfigId,
          currentTemplate: ctx.currentTemplate,
          currentScheduleId: ctx.currentScheduleId,
        });
      }
    },
    [loadPolicy]
  );

  /**
   * Phiếu mới cho 1 căn. Lỗi ở bước tự chọn (bảng giá → chính sách → tiến độ) không chặn lập phiếu:
   * trả `warning` để màn báo, người dùng chọn tay.
   */
  const startNew = useCallback(
    async (productId: string): Promise<{ warning: string | null }> => {
      const s = ++seq.current.product;
      setBusy("product");
      try {
        const p = await PriceSheetService.getProduct(productId);
        if (s !== seq.current.product) return { warning: null };
        if (!p) throw new Error("Không tìm thấy sản phẩm");
        let f = formFromProduct(p);
        const [cfg, priceConfigs] = await Promise.all([
          PriceSheetService.getSalesConfig(p.MaDA, f.isLowRise),
          PriceSheetService.getProductPricingConfigs(p.MaDA, f.isLowRise),
        ]);
        if (s !== seq.current.product) return { warning: null };
        // Cấu hình tính giá sản phẩm: ưu tiên cấu hình gắn với căn, rồi cấu hình mặc định (useProductPriceConfig)
        const preferred =
          priceConfigs.find((c) => String(c?.ID ?? "") === String(p.MaCauHinhTinhGia ?? "")) ||
          priceConfigs.find((c) => c?.Status === true) ||
          priceConfigs[0];
        const fields = getPriceFieldsFromApi(priceConfigs, preferred?.ID);
        if (fields.length) f = applyPriceInputs(f, computeAllFormulas(priceCodeValues(f), fields));

        setProduct(p);
        setForm(f);
        setConfig(cfg);
        setPolicyId(null);
        setPolicyName("");
        setPolicyConfigId(null);
        setPolicyDetails([]);
        setRoundTemplate([]);
        setRounds([]);
        setTemplateId(null);
        setTemplateName("");
        setTemplateRows([]);
        setPromotions([]);
        setPriceListId(null);
        setBusy(null);
        const first = cfg.priceLists[0];
        if (first?.id) {
          try {
            await loadPriceList(String(first.id), {
              product: p,
              cfg,
              currentPolicyId: null,
              currentConfigId: null,
              currentTemplate: [],
              currentScheduleId: null,
              tyLeVAT: f.tyLeVAT,
            });
          } catch (e: any) {
            return { warning: e?.message || "Không tự chọn được chính sách / tiến độ – chọn lại" };
          }
        }
        return { warning: null };
      } finally {
        if (s === seq.current.product) setBusy((b) => (b === "product" ? null : b));
      }
    },
    [loadPriceList]
  );

  /**
   * Sửa phiếu đã lưu (chỉ phiếu app sửa được – appEditBlockReason). Giá gốc lấy từ GiaTriHopDong đã lưu,
   * vòng CK từ snapshot.policyRounds + công thức cấu hình hiện tại. Trả cảnh báo nếu tính lại lệch số đã lưu.
   */
  const startEdit = useCallback(async (sheetId: string): Promise<{ blocked: string | null }> => {
    const s = ++seq.current.product;
    setBusy("product");
    try {
      const sheet = await PriceSheetService.get(sheetId);
      if (s !== seq.current.product) return { blocked: null };
      const blocked = appEditBlockReason(sheet);
      if (blocked || !sheet) return { blocked: blocked || "Không tải được phiếu" };
      const snap = sheet.snapshot || sheet.payload?._snapshot || {};
      const tt = sheet.payload?.TTHopDong || {};
      const p = snap.product || (sheet.san_pham_id ? await PriceSheetService.getProduct(sheet.san_pham_id) : null);
      if (!p) return { blocked: "Phiếu thiếu dữ liệu sản phẩm – sửa trên web" };
      // Phiếu cũ thiếu snapshot.product ⇒ dùng căn nạp lại làm nguồn giá dự phòng
      const f = formFromSheet(snap.product ? sheet : { ...sheet, snapshot: { ...snap, product: p } });
      const configId = tt.CauHinhTinhGiaID ? String(tt.CauHinhTinhGiaID) : null;
      const scheduleId = (sheet.payload?.LichThanhToan || []).find((l: any) => l?.MaTH)?.MaTH ?? null;
      const [cfg, cfgRounds, policy, sched] = await Promise.all([
        PriceSheetService.getSalesConfig(p.MaDA, f.isLowRise),
        configId ? PriceSheetService.getConfigRounds(configId) : Promise.resolve([]),
        tt.MaCS ? PriceSheetService.getPolicy(String(tt.MaCS)).catch(() => null) : Promise.resolve(null),
        scheduleId ? PriceSheetService.getSchedule(String(scheduleId)).catch(() => null) : Promise.resolve(null),
      ]);
      if (s !== seq.current.product) return { blocked: null };
      const template = buildRoundTemplate(cfgRounds, f.isLowRise);
      setEditing(sheet);
      setProduct(p);
      setForm(f);
      setConfig(cfg);
      setPriceListId(tt.MaDotGia ? String(tt.MaDotGia) : null);
      setPolicyId(tt.MaCS ? String(tt.MaCS) : null);
      setPolicyName(snap.policyName || policy?.name || "");
      setPolicyConfigId(configId);
      setPolicyDetails((policy?.detail || []).map(normalizePolicyDetail));
      setRoundTemplate(template);
      setRounds(roundsFromSheet(sheet, template));
      setTemplateId(scheduleId ? String(scheduleId) : null);
      setTemplateName(snap.scheduleName || sched?.name || "");
      setTemplateRows(sched?.details?.length ? scheduleRowsFromTemplate(sched.details, f.isLowRise, f.tyLeVAT) : []);
      setPromotions(
        (sheet.payload?.KhuyenMai || []).map((g: any) => ({
          ID: String(g.PromotionID),
          TenQuaTang: g.TieuDe || "",
          SoLuong: Number(g.SoLuong) || 0,
          GiaTri: Number(g.SoTien) || 0,
        }))
      );
      setCustomer(customerFromSheet(sheet));
      return { blocked: null };
    } finally {
      if (s === seq.current.product) setBusy(null);
    }
  }, []);

  /** Bỏ căn đang chọn (phiếu mới) → quay lại chọn căn */
  const reset = useCallback(() => {
    seq.current.product++;
    seq.current.priceList++;
    seq.current.policy++;
    seq.current.schedule++;
    setProduct(null);
    setForm(null);
    setConfig(EMPTY_CONFIG);
    setPriceListId(null);
    setPolicyId(null);
    setPolicyName("");
    setPolicyConfigId(null);
    setPolicyDetails([]);
    setRoundTemplate([]);
    setRounds([]);
    setTemplateId(null);
    setTemplateName("");
    setTemplateRows([]);
    setPromotions([]);
    setBusy(null);
  }, []);

  const isLow = !!form?.isLowRise;

  const selectPriceList = useCallback(
    (id: string | null) =>
      loadPriceList(id, {
        product,
        cfg: config,
        currentPolicyId: policyId,
        currentConfigId: policyConfigId,
        currentTemplate: roundTemplate,
        currentScheduleId: templateId,
        tyLeVAT: form?.tyLeVAT ?? 10,
      }),
    [loadPriceList, product, config, policyId, policyConfigId, roundTemplate, templateId, form?.tyLeVAT]
  );

  const selectPolicy = useCallback(
    (id: string | null) =>
      loadPolicy(id, {
        isLow,
        tyLeVAT: form?.tyLeVAT ?? 10,
        configs: config.policyConfigs,
        currentConfigId: policyConfigId,
        currentTemplate: roundTemplate,
        currentScheduleId: templateId,
      }),
    [loadPolicy, isLow, form?.tyLeVAT, config.policyConfigs, policyConfigId, roundTemplate, templateId]
  );

  const selectTemplate = useCallback(
    (id: string | null) => loadTemplate(id, isLow, form?.tyLeVAT ?? 10),
    [loadTemplate, isLow, form?.tyLeVAT]
  );

  const updateRound = useCallback((index: number, patch: Partial<PolicyDiscountRound>) => {
    setRounds((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }, []);

  const updateForm = useCallback((patch: Partial<SheetForm>) => {
    setForm((f) => (f ? { ...f, ...patch } : f));
  }, []);

  const togglePromotion = useCallback((promo: SheetPromotion) => {
    setPromotions((prev) => (prev.some((p) => p.ID === promo.ID) ? prev.filter((p) => p.ID !== promo.ID) : [...prev, promo]));
  }, []);

  const draft: SheetDraft | null = useMemo(
    () =>
      form
        ? {
            product,
            form,
            priceListId,
            policyId,
            policyName,
            policyConfigId,
            policyDetails,
            rounds,
            templateId,
            templateName,
            schedule,
            promotions,
            customer,
          }
        : null,
    [product, form, priceListId, policyId, policyName, policyConfigId, policyDetails, rounds, templateId, templateName, schedule, promotions, customer]
  );

  /** Lưu (tạo mới / cập nhật) – trả bản ghi máy chủ */
  const save = useCallback(async (): Promise<PriceSheetRow> => {
    if (!draft || !calc) throw new Error("Chưa có dữ liệu phiếu");
    const { payload, snapshot } = buildPayload(draft, calc);
    const row = buildSaveRow(payload, snapshot, {
      id: editing?.id ?? null,
      sheetCode: editing?.sheet_code ?? null,
      product,
    });
    const saved = await PriceSheetService.save(row);
    setEditing(saved);
    return saved;
  }, [draft, calc, editing, product]);

  return {
    product,
    form,
    config,
    priceListId,
    policyId,
    policyName,
    policyConfigId,
    rounds,
    templateId,
    templateName,
    schedule,
    promotions,
    customer,
    editing,
    calc,
    busy,
    startNew,
    startEdit,
    reset,
    selectPriceList,
    selectPolicy,
    selectTemplate,
    updateRound,
    updateForm,
    togglePromotion,
    setCustomer,
    save,
  };
}

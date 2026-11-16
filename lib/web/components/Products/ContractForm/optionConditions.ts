// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/optionConditions.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * Điều kiện áp dụng của mức chiết khấu (spec dieu-kien-chi-tiet-ck). Hàm thuần, dùng chung cho
 * Phiếu tính giá và Hợp đồng: mức không đạt hiện mờ, không tick được.
 */
import type {
  CatalogRef,
  ConditionField,
  ConditionOp,
  ConditionRow,
  OptionCondition,
  PolicyDiscountOption,
} from "../../../services/DaSalesPolicyService";
import type { PolicyKhoStock } from "../../../services/projects/gift-warehouse/policyKho";

// Định dạng tiền như `money` của discountOptions; không import để discountOptions dùng được module này
const money = (n: unknown) => String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Bối cảnh của căn đang tính. `pending`: dữ liệu sản phẩm / số suất đang tải, chưa tự tick mức mang điều kiện.
 * `ngay`: ngày chứng từ YYYY-MM-DD (thiếu = hôm nay); `usage`: số chứng từ đã dùng từng mức (thiếu = không kiểm số lượng).
 */
export type OptionCtx = {
  loaiCan?: string;
  toaId?: string;
  giaGomVAT?: number;
  lichTTId?: string;
  /** Quỹ căn (dm_quy_can.id) — chỉ tiêu chí QUY_CAN của Chính sách CTBH / hoa hồng */
  quyCanId?: string;
  /** Phòng ngủ (uuid danh mục phong_ngu = bds_products.ma_so_pn) / Vị trí (uuid danh mục vi_tri = bds_products.vi_tri) của căn */
  phongNguId?: string;
  viTriId?: string;
  /** Tầng của căn (uuid danh mục tang = bds_products.ma_tang) */
  tangId?: string;
  pending?: boolean;
  ngay?: string;
  usage?: Record<string, number>;
  /** Công ty bán hàng của chứng từ; `usageByCompany`: mức → công ty (id chữ thường, "" = không có) → số đã dùng */
  congTyBanHangId?: string | null;
  usageByCompany?: Record<string, Record<string, number>>;
  /**
   * Trạng thái đã lưu của chứng từ (R-8, mirror `_sp_option_quota_guard`): `priorPickIds` mức đã chọn trên chứng từ đang lưu (miễn thời gian);
   * cùng `priorCongTyId` = công ty hiện tại và `priorHoldsSlot` (cọc / HĐ đã giữ suất cùng chính sách; phiếu tính giá luôn true) ⇒ miễn phân bổ.
   * `isPriceSheet`: phiếu tính giá đang sửa, mức đã có trên phiếu miễn cả tổng (fix-wave B2).
   */
  priorPickIds?: string[];
  priorCongTyId?: string | null;
  priorHoldsSlot?: boolean;
  isPriceSheet?: boolean;
  /** Chỉ đối soát mức có phân bổ, không tự tick (đối soát bật chỉ vì người dùng đổi Công ty bán hàng trên chứng từ đã lưu) */
  onlyAllocated?: boolean;
  /**
   * R-2d: ID các mức phải phân bổ của chính sách đang chọn (`allocationRequiredIds`): chính sách bật "Áp dụng phân bổ CTBH" (`ApDungPhanBo`)
   * và dòng không có "Không cần phân bổ CTBH" (`KhongCanPhanBo`) ⇒ mức không có PhanBo không chọn được, trừ mức chứng từ đã giữ từ trước
   * (`priorPickIds` + `priorHoldsSlot`, không cần công ty không đổi), như `_sp_option_quota_guard`. Lấy theo chi tiết chính sách (không theo dòng
   * của chứng từ), như máy chủ đọc trên chính sách.
   */
  allocationRequiredIds?: readonly string[];
  /**
   * Chính sách theo kho (spec chinh-sach-theo-kho D6, D7): tồn của dòng kho theo mức (option.ID, `fn_gift_warehouse_stock_for_policy`, đã trừ
   * chứng từ đang sửa) và dự án của căn (kiểm phạm vi kho cùng `toaId`). Thiếu `khoStock` ⇒ không kiểm kho (máy chủ vẫn chặn).
   */
  khoStock?: Record<string, PolicyKhoStock>;
  projectId?: string;
  /**
   * Người đang xem (spec chi-tiet-ck-theo-phan-bo, chủ dự án 2026-11-15): "CTBH" = nhân viên CTBH / đại lý (`fn_caller_sales_company` có nguồn
   * hoặc bị khóa công ty) ⇒ chỉ thấy mức đã phân bổ cho Công ty bán hàng của chứng từ, không thấy kho và phân bổ của công ty khác;
   * "CDT" (hoặc thiếu) = nhân viên chủ đầu tư ⇒ thấy hết (mức ngoài phân bổ hiện mờ kèm lý do).
   */
  viewer?: OptionViewer;
};

export type OptionViewer = "CDT" | "CTBH";

const lc = (v: unknown) => String(v ?? "").toLowerCase();
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const pad = (n: number) => String(n).padStart(2, "0");
/** Hôm nay theo giờ máy, YYYY-MM-DD */
export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
/** YYYY-MM-DD → dd/MM/yyyy */
const viDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
};
const rangeText = (tu?: string, den?: string) =>
  tu && den ? `từ ${viDate(tu)} đến ${viDate(den)}` : tu ? `từ ${viDate(tu)}` : den ? `đến ${viDate(den)}` : "";

/** Giới hạn của mức cho tooltip / cột Giá trị: "còn 3/10 · đến 31/12/2026"; không cài gì thì rỗng */
export function availabilityText(o: PolicyDiscountOption, used?: number): string {
  const parts: string[] = [];
  if (o?.SoLuong) parts.push(used == null ? `${o.SoLuong} suất` : `còn ${Math.max(o.SoLuong - used, 0)}/${o.SoLuong}`);
  const r = rangeText(o?.TuNgay, o?.DenNgay);
  if (r) parts.push(r);
  return parts.join(" · ");
}

/**
 * Phân bổ theo công ty bán hàng: có số đã dùng ⇒ "CTBH A: còn 2/6 · CTBH B: còn 1/3"; không có (màn chính sách) ⇒ "CTBH A: 6 · CTBH B: 3";
 * mức không phân bổ ⇒ rỗng
 */
export function allocationText(o: PolicyDiscountOption, byCompany?: Record<string, number>): string {
  return (o?.PhanBo ?? [])
    .map((p) =>
      byCompany
        ? `${p.TenCongTy || p.CongTyId}: còn ${Math.max(p.SoLuong - (Number(byCompany[lc(p.CongTyId)]) || 0), 0)}/${p.SoLuong}`
        : `${p.TenCongTy || p.CongTyId}: ${p.SoLuong}`,
    )
    .join(" · ");
}

/**
 * Phân bổ CHỜ DUYỆT của mức (spec phan-bo-ctbh-duyet): "chờ duyệt: A 8 · B 1"; [] ⇒ "chờ duyệt: bỏ phân bổ"; không có bản chờ ⇒ rỗng.
 * Chỉ để hiển thị ở màn cấu hình; phiếu / hợp đồng chỉ dùng bản hiệu lực (PhanBo).
 */
export function pendingAllocationText(o: PolicyDiscountOption): string {
  if (!Array.isArray(o?.PhanBoCho)) return "";
  if (o.PhanBoCho.length === 0) return "chờ duyệt: bỏ phân bổ";
  return `chờ duyệt: ${o.PhanBoCho.map((p) => `${p.TenCongTy || p.CongTyId} ${p.SoLuong}`).join(" · ")}`;
}

/** Mức có phân bổ theo Công ty bán hàng (PhanBo không rỗng) */
export const hasAllocation = (o: Pick<PolicyDiscountOption, "PhanBo"> | null | undefined): boolean => (o?.PhanBo?.length ?? 0) > 0;

/** Lý do trên phiếu tính giá / hợp đồng và lời nhắc trên màn chính sách cho mức phải phân bổ mà chưa phân bổ (R-2d) */
export const UNALLOCATED_REASON = "Chưa phân bổ cho Công ty bán hàng";
export const UNALLOCATED_HINT = "Chưa phân bổ: không chọn được trên phiếu tính giá / hợp đồng";
/** Giải thích ô "Áp dụng phân bổ CTBH" của chính sách — luôn bật với cao tầng (chủ dự án 2026-11-15) */
export const POLICY_ALLOCATION_TIP =
  'Bắt buộc với mọi chính sách cao tầng: chi tiết chưa phân bổ cho Công ty bán hàng sẽ không hiện với nhân viên CTBH và không chọn được trên phiếu tính giá / hợp đồng (trừ dòng "Không cần phân bổ CTBH")';
/** Giải thích ô / tag "Không cần phân bổ CTBH" của dòng chiết khấu (R-2d) */
export const ALLOCATION_EXEMPT_TIP = "Dòng này dùng được cho mọi Công ty bán hàng, không cần phân bổ";

/**
 * Dòng chi tiết chính sách: `ApDungPhanBo` là ô "Áp dụng phân bổ CTBH" của CHÍNH SÁCH, dịch vụ chép vào từng dòng khi đọc
 * (`DaSalesPolicyService.mapRow`, không gửi lại máy chủ); `KhongCanPhanBo` là ô "Không cần phân bổ CTBH" của dòng.
 */
type PolicyRow = { ApDungPhanBo?: boolean | null; KhongCanPhanBo?: boolean | null; LuaChon?: PolicyDiscountOption[] | null } | null | undefined;

/** R-2d: dòng phải phân bổ = chính sách bật "Áp dụng phân bổ CTBH" và dòng không có "Không cần phân bổ CTBH" */
export const rowRequiresAllocation = (d: PolicyRow): boolean => !!d?.ApDungPhanBo && !d?.KhongCanPhanBo;

/** R-2d: ID các mức (detail[].LuaChon[]) của những dòng phải phân bổ (`rowRequiresAllocation`) */
export function allocationRequiredIds(details: readonly PolicyRow[] | null | undefined): string[] {
  return (details ?? []).flatMap((d) => (rowRequiresAllocation(d) ? (d?.LuaChon ?? []).map((o) => String(o?.ID ?? "")).filter(Boolean) : []));
}

/** Bối cảnh khi dựng dòng từ chi tiết chính sách vừa tải: mức phải phân bổ lấy theo `details` (bối cảnh của form có thể còn là chính sách trước) */
export const withAllocationRequired = (ctx: OptionCtx | undefined, details: readonly PolicyRow[]): OptionCtx | undefined =>
  ctx && { ...ctx, allocationRequiredIds: allocationRequiredIds(details) };

/** R-2d: mức phải phân bổ (thuộc `allocationRequiredIds`) mà chưa phân bổ (PhanBo rỗng) */
export const lacksRequiredAllocation = (o: PolicyDiscountOption | null | undefined, ctx: Pick<OptionCtx, "allocationRequiredIds">): boolean =>
  !!ctx.allocationRequiredIds?.includes(String(o?.ID ?? "")) && !hasAllocation(o);

/**
 * Dòng phân bổ dưới mức ở ô Chi tiết CK (§5.2.4): đã chọn công ty ⇒ chỉ dòng của công ty đó ("CTBH A: còn 2/6", công ty ngoài phân bổ ⇒ rỗng,
 * lý do đã có ở matchOption); chưa chọn ⇒ mọi công ty. Số đã dùng chưa tải xong ⇒ chỉ số phân bổ.
 */
export function allocationHint(o: PolicyDiscountOption, ctx?: OptionCtx): string {
  if (!o?.PhanBo?.length) return "";
  const by = ctx?.usageByCompany && !ctx.pending ? (ctx.usageByCompany[String(o.ID ?? "")] ?? {}) : undefined;
  // Nhân viên CTBH không xem phân bổ của công ty khác
  if (!ctx?.congTyBanHangId) return ctx?.viewer === "CTBH" ? "" : allocationText(o, by);
  const own = o.PhanBo.find((p) => lc(p.CongTyId) === lc(ctx.congTyBanHangId));
  return own ? allocationText({ ...o, PhanBo: [own] }, by) : "";
}

/**
 * Mức bị ẩn khỏi ô Chi tiết CK (spec chi-tiet-ck-theo-phan-bo): chỉ với nhân viên CTBH (`viewer` "CTBH"), mức chưa phân bổ cho Công ty bán hàng
 * của chứng từ — mức phải phân bổ mà PhanBo rỗng, hoặc có PhanBo nhưng không có công ty này. Mức chứng từ đã giữ từ trước (R-8, như `matchOption`)
 * vẫn hiện. Mức hết phân bổ KHÔNG ẩn (hiện mờ "Hết số lượng phân bổ"). Chưa chọn công ty ⇒ ẩn mọi mức có / phải phân bổ (form đã khóa chính sách).
 */
export function isOptionHidden(o: PolicyDiscountOption | null | undefined, ctx?: OptionCtx): boolean {
  if (!o || ctx?.viewer !== "CTBH") return false;
  const prior = !!ctx.priorPickIds?.includes(String(o.ID ?? "")) && !!ctx.priorHoldsSlot;
  if (lacksRequiredAllocation(o, ctx)) return !prior;
  if (!o.PhanBo?.length) return false;
  if (!ctx.congTyBanHangId) return true;
  const co = lc(ctx.congTyBanHangId);
  if (o.PhanBo.some((p) => lc(p.CongTyId) === co)) return false;
  return !(prior && !!ctx.priorCongTyId && lc(ctx.priorCongTyId) === co);
}

export const CONDITION_FIELD_LABELS: Record<ConditionField, string> = {
  LOAI_CAN: "Loại căn",
  TOA: "Tòa",
  LICH_TT: "Lịch thanh toán",
  /** Mã giữ nguyên; so với giá gốc gồm VAT + KPBT trên bảng giá (listedGomVATPBT, spec phan-bo-ctbh-duyet §11.1) */
  GIA_GOM_VAT: "Giá niêm yết VAT + KPBT",
  QUY_CAN: "Quỹ",
  PHONG_NGU: "Phòng ngủ",
  VI_TRI: "Vị trí",
  TANG: "Tầng",
  TRANG_THAI: "Trạng thái giao dịch",
  TY_LE_TT_HD: "Tỷ lệ TT / Tổng giá trị HĐMB",
};

export const OPS_BY_FIELD: Record<ConditionField, ConditionOp[]> = {
  LOAI_CAN: ["IN", "NOT_IN"],
  TOA: ["IN", "NOT_IN"],
  LICH_TT: ["IN", "NOT_IN"],
  GIA_GOM_VAT: ["GTE", "LTE", "GT", "LT", "EQ", "BETWEEN"],
  QUY_CAN: ["IN", "NOT_IN"],
  PHONG_NGU: ["IN", "NOT_IN"],
  VI_TRI: ["IN", "NOT_IN"],
  TANG: ["IN", "NOT_IN"],
  TRANG_THAI: ["IN", "NOT_IN"],
  TY_LE_TT_HD: ["GTE", "LTE", "GT", "LT", "EQ", "BETWEEN"],
};

export const OP_LABELS: Record<ConditionOp, string> = {
  IN: "=",
  NOT_IN: "≠",
  GTE: "≥",
  LTE: "≤",
  GT: ">",
  LT: "<",
  EQ: "=",
  BETWEEN: "Trong khoảng",
};

const norm = (v: unknown) => String(v ?? "").trim().toLowerCase();

const listText = (row: ConditionRow): string =>
  (Array.isArray(row.GiaTri) ? row.GiaTri : [])
    .map((v) => (typeof v === "string" ? v : (v as CatalogRef).Ten || (v as CatalogRef).ID))
    .join(", ");

const rowText = (row: ConditionRow): string => {
  const label = CONDITION_FIELD_LABELS[row.Truong];
  if (row.Truong === "TY_LE_TT_HD") {
    return row.ToanTu === "BETWEEN"
      ? `${label} Trong khoảng ${row.GiaTri}% – ${row.GiaTriDen}%`
      : `${label} ${OP_LABELS[row.ToanTu]} ${row.GiaTri}%`;
  }
  if (row.Truong !== "GIA_GOM_VAT") return `${label} ${OP_LABELS[row.ToanTu]} ${listText(row)}`;
  if (row.ToanTu === "BETWEEN") return `${label} Trong khoảng ${money(row.GiaTri)} – ${money(row.GiaTriDen)}`;
  return `${label} ${OP_LABELS[row.ToanTu]} ${money(row.GiaTri)}`;
};

const activeRows = (dk: OptionCondition | undefined): ConditionRow[] =>
  (dk?.Dong ?? []).filter((r) => r && r.Bat !== false);

/** Mức có ít nhất 1 dòng điều kiện đang bật */
export const hasActiveCondition = (o: PolicyDiscountOption | undefined): boolean => activeRows(o?.DieuKien).length > 0;

/** Chữ tóm tắt các dòng đang bật; Và nối bằng « · », Hoặc nối bằng « hoặc » */
export function conditionText(dk: OptionCondition | undefined): string {
  const rows = activeRows(dk);
  return rows.map(rowText).join(dk?.KetHop === "OR" ? " hoặc " : " · ");
}

/** Giá trị của bối cảnh cho một tiêu chí; undefined = chưa xác định được */
const ctxValue = (field: ConditionField, ctx: OptionCtx): string | number | undefined => {
  if (field === "LOAI_CAN") return norm(ctx.loaiCan) || undefined;
  if (field === "TOA") return lc(ctx.toaId) || undefined;
  if (field === "LICH_TT") return lc(ctx.lichTTId) || undefined;
  if (field === "QUY_CAN") return lc(ctx.quyCanId) || undefined;
  if (field === "PHONG_NGU") return lc(ctx.phongNguId) || undefined;
  if (field === "VI_TRI") return lc(ctx.viTriId) || undefined;
  if (field === "TANG") return lc(ctx.tangId) || undefined;
  // Tiêu chí tiến độ của Chính sách hoa hồng: chỉ máy chủ so (_agency_fee_unit_eval), form chứng từ không có bối cảnh
  if (field === "TRANG_THAI" || field === "TY_LE_TT_HD") return undefined;
  return Number(ctx.giaGomVAT) > 0 ? Number(ctx.giaGomVAT) : undefined;
};

/** Một dòng: true / false, hoặc null khi bối cảnh thiếu dữ liệu của tiêu chí */
const evalRow = (row: ConditionRow, ctx: OptionCtx): boolean | null => {
  const v = ctxValue(row.Truong, ctx);
  if (v === undefined) return null;
  if (row.Truong === "GIA_GOM_VAT") {
    const g = Number(v);
    const a = Number(row.GiaTri);
    switch (row.ToanTu) {
      case "GTE": return g >= a;
      case "LTE": return g <= a;
      case "GT": return g > a;
      case "LT": return g < a;
      case "EQ": return g === a;
      case "BETWEEN": return g >= a && g <= Number(row.GiaTriDen);
      default: return false;
    }
  }
  const values = (Array.isArray(row.GiaTri) ? row.GiaTri : []).map((x) =>
    row.Truong === "LOAI_CAN" ? norm(x) : lc((x as CatalogRef)?.ID),
  );
  const hit = values.includes(String(v));
  return row.ToanTu === "NOT_IN" ? !hit : hit;
};

/** Mức có đạt điều kiện với căn đang tính không; không đạt thì kèm lý do để hiện trên ô Chi tiết CK */
export function matchOption(option: PolicyDiscountOption, ctx: OptionCtx): { ok: boolean; reason?: string; info?: string; warn?: boolean } {
  // Thời gian, số lượng, chưa phân bổ (R-2d), phân bổ, rồi mới tới điều kiện. Mức đã có trên chứng từ đang lưu được miễn như máy chủ (R-8)
  const prior = !!ctx.priorPickIds?.includes(String(option?.ID ?? ""));
  if ((option?.TuNgay || option?.DenNgay) && !prior) {
    const day = (ctx.ngay || todayISO()).slice(0, 10);
    if ((option.TuNgay && day < option.TuNgay) || (option.DenNgay && day > option.DenNgay)) {
      return { ok: false, reason: `Chỉ áp dụng ${rangeText(option.TuNgay, option.DenNgay)}` };
    }
  }
  if (option?.SoLuong && ctx.usage && !(prior && ctx.isPriceSheet)) {
    const used = Number(ctx.usage[String(option.ID ?? "")]) || 0;
    if (used >= option.SoLuong) return { ok: false, reason: `Hết số lượng (${used}/${option.SoLuong})` };
  }
  // Mức theo kho (D6): như _sp_option_quota_guard — sau hạn mức của chính sách; chứng từ đã giữ mức từ trước (R-8) được miễn
  const ks = option?.MaDongKho ? ctx.khoStock?.[String(option.ID ?? "")] : undefined;
  let kinfo: { info?: string; warn?: boolean } = {};
  if (ks && !(prior && (ctx.priorHoldsSlot || ctx.isPriceSheet))) {
    const day = (ctx.ngay || todayISO()).slice(0, 10);
    // Nhân viên CTBH không thấy kho (kho là việc của chủ đầu tư): lý do chung, không tên kho, không dòng tồn
    const ctbh = ctx.viewer === "CTBH";
    if (!ks.kho_active || day < ks.tu_ngay || (ks.den_ngay && day > ks.den_ngay)) return { ok: false, reason: ctbh ? "Tạm ngưng áp dụng" : `Kho «${ks.kho_ten}» đang ngưng hoặc hết hạn` };
    // Chưa biết dự án (mã không phải uuid) / tòa (đang tải) ⇒ không chặn phần đó; máy chủ kiểm lại
    const prj = ctx.projectId && UUID_RE.test(ctx.projectId) ? lc(ctx.projectId) : "";
    const inScope = !prj || ks.pham_vi.length === 0
      || ks.pham_vi.some((s) => lc(s.da_project_id) === prj && (!s.toa_id || !ctx.toaId || lc(s.toa_id) === lc(ctx.toaId)));
    if (!inScope) return { ok: false, reason: ctbh ? "Không áp dụng cho căn này" : `Kho «${ks.kho_ten}» không áp dụng cho căn này` };
    if (ks.con_lai <= 0) return { ok: false, reason: ctbh ? "Đã hết số lượng" : `Hết hàng trong kho «${ks.kho_ten}»` };
    if (!ctbh) kinfo = { info: `Kho «${ks.kho_ten}»: còn ${ks.con_lai}`, ...(ks.con_lai <= ks.nguong ? { warn: true } : {}) };
  }
  // R-2d: chính sách bật "Áp dụng phân bổ CTBH", dòng không miễn ⇒ mức không có PhanBo chỉ giữ được khi chứng từ đã giữ nó từ trước (sau tổng, trước phân bổ)
  if (lacksRequiredAllocation(option, ctx) && !(prior && ctx.priorHoldsSlot)) return { ok: false, reason: UNALLOCATED_REASON };
  if (option?.PhanBo?.length && ctx.usageByCompany) {
    if (!ctx.congTyBanHangId) return { ok: false, reason: "Chọn Công ty bán hàng để chọn chính sách bán hàng" };
    const co = lc(ctx.congTyBanHangId);
    // Chứng từ đã giữ suất, công ty không đổi ⇒ bỏ qua "ngoài danh sách" và "hết phân bổ" (phân bổ giảm chỉ chặn chứng từ mới)
    const keep = prior && !!ctx.priorHoldsSlot && !!ctx.priorCongTyId && lc(ctx.priorCongTyId) === co;
    const alloc = option.PhanBo.find((p) => lc(p.CongTyId) === co);
    if (!keep && !alloc) {
      return { ok: false, reason: ctx.viewer === "CTBH" ? UNALLOCATED_REASON : `Chỉ áp dụng cho: ${option.PhanBo.map((p) => p.TenCongTy || p.CongTyId).join(", ")}` };
    }
    const used = Number(ctx.usageByCompany[String(option.ID ?? "")]?.[co]) || 0;
    if (!keep && alloc && used >= alloc.SoLuong) return { ok: false, reason: `Hết số lượng phân bổ cho ${alloc.TenCongTy || alloc.CongTyId} (${used}/${alloc.SoLuong})` };
  }
  const dk = option?.DieuKien;
  const rows = activeRows(dk);
  if (rows.length === 0) return { ok: true, ...kinfo };
  const results = rows.map((r) => evalRow(r, ctx));
  const ok = dk?.KetHop === "OR" ? results.some((r) => r === true) : results.every((r) => r === true);
  if (ok) return { ok: true, ...kinfo };
  // Lý do: thiếu dữ liệu của tiêu chí đầu tiên chưa xác định; còn lại là tóm tắt điều kiện
  const missing = rows.find((_, i) => results[i] === null);
  if (missing?.Truong === "LICH_TT") return { ok: false, reason: "Chưa chọn Lịch thanh toán" };
  if (missing) return { ok: false, reason: `Chưa xác định ${CONDITION_FIELD_LABELS[missing.Truong]} của sản phẩm` };
  return { ok: false, reason: `Chỉ áp dụng: ${conditionText(dk)}` };
}

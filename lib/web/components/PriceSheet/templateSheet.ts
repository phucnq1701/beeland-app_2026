// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/PriceSheet/templateSheet.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
import type { PriceSheetTemplate } from "../../_stubs/services/products/price-sheet-template";

/** Dữ liệu gieo vào form khi lập phiếu từ mẫu */
export interface FromTemplateSeed {
  templateId: string;
  maMau: string;
  quyCanId: string | null;
  congTyBanHangId: string | null;
  policyId: string | null;
  priceListId: string | null;
  scheduleId: string | null;
  /** ID các mức chiết khấu đã tick (cùng dạng `PickedOption.ID`) = `pickedOptions[].ID` */
  pickedOptionIds: string[];
  /** Các mức đã tick kèm tên lúc lưu mẫu: báo tên mức không còn trong chính sách hiện tại */
  pickedOptions: { ID: string; Ten: string }[];
  /** `payload.KhuyenMai` của mẫu, form sẽ áp lại */
  promotions: any[];
}

const clone = <T,>(v: T): T => (v == null ? v : JSON.parse(JSON.stringify(v)));
const str = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return s || null;
};

/** Bản sao payload đã bỏ phần thuộc về khách / phiếu cụ thể. Không sửa bản gốc. */
export function stripCustomerParts(payload: any): any {
  const p = clone(payload) || {};
  delete p.TTKhachHang;
  delete p.TT360KhachHang;
  if (p.TTHopDong) {
    const tt = p.TTHopDong;
    tt.SoPhieu = "";
    delete tt.MaPGC;
    delete tt.NgayHetHan;
    delete tt.MaKH;
    delete tt.MaPDK;
  }
  if (p._snapshot) {
    delete p._snapshot.coOwners;
    delete p._snapshot.customer360;
  }
  return p;
}

/** Từ payload `onSaveSuccess` của form ra dòng gửi `priceSheetTemplateService.save` */
export function templateRowFromFormPayload(
  payload: any,
  ctx: { id?: string | null; tenMau: string; product: any; isLow: boolean }
): Partial<PriceSheetTemplate> & { ten_mau: string } {
  const clean = stripCustomerParts(payload);
  const tt = clean.TTHopDong || {};
  const snap = clean._snapshot || {};
  const t = snap.totals || {};
  const product = ctx.product || {};
  const base = Number(t.totalContractValue ?? tt.GiaTriHopDongSauCK ?? tt.GiaTriHopDong ?? 0);
  const row: Partial<PriceSheetTemplate> & { ten_mau: string } = {
    ten_mau: String(ctx.tenMau ?? "").trim(),
    product_type: ctx.isLow ? "Thấp tầng" : "Cao tầng",
    ma_quy_can: str(tt.MaQuyCan),
    cong_ty_ban_hang_id: str(tt.CongTyBanHangId),
    sales_policy_id: str(tt.MaCS ?? clean.ChinhSach?.[0]?.MaCS),
    price_list_id: str(tt.MaDotGia),
    payment_schedule_id: str(clean.LichThanhToan?.[0]?.MaTH ?? tt.MaTDTT),
    policy_name: snap.policyName || null,
    base_price: Number.isFinite(base) ? base : 0,
    payload: clean,
    snapshot: snap,
  };
  if (ctx.id) row.id = ctx.id;
  const spId = str(product.id ?? product.san_pham_id);
  if (spId) row.san_pham_id = spId;
  const code = str(snap.productCode ?? tt.MaCan ?? product.KyHieu);
  if (code) row.product_code = code;
  return row;
}

/** Các mức đã tick trong các dòng chiết khấu đang bật (`luaChonDaChon[]`), không trùng ID; thiếu tên thì lấy ID */
const pickedOptionsOf = (snapshot: any): { ID: string; Ten: string }[] => {
  const out: { ID: string; Ten: string }[] = [];
  for (const r of Array.isArray(snapshot?.policyRounds) ? snapshot.policyRounds : []) {
    if (r?.enabled === false) continue;
    for (const o of Array.isArray(r?.luaChonDaChon) ? r.luaChonDaChon : []) {
      const id = String(o?.ID ?? "").trim();
      if (id && !out.some((x) => x.ID === id)) out.push({ ID: id, Ten: String(o?.Ten ?? "").trim() || id });
    }
  }
  return out;
};

/** Từ mẫu ra payload/snapshot gieo cho form + thông tin liên kết mẫu */
export function sheetSeedFromTemplate(t: PriceSheetTemplate): {
  payload: any;
  snapshot: any;
  fromTemplate: FromTemplateSeed;
} {
  const payload = stripCustomerParts(t.payload || {});
  const snapshot = clone(t.snapshot ?? payload._snapshot ?? {}) || {};
  delete snapshot.coOwners;
  delete snapshot.customer360;
  const pickedOptions = pickedOptionsOf(snapshot);
  return {
    payload,
    snapshot,
    fromTemplate: {
      templateId: t.id,
      maMau: t.ma_mau,
      quyCanId: t.ma_quy_can ?? null,
      congTyBanHangId: t.cong_ty_ban_hang_id ?? null,
      policyId: t.sales_policy_id ?? null,
      priceListId: t.price_list_id ?? null,
      scheduleId: t.payment_schedule_id ?? null,
      pickedOptionIds: pickedOptions.map((o) => o.ID),
      pickedOptions,
      promotions: Array.isArray(payload.KhuyenMai) ? clone(payload.KhuyenMai) : [],
    },
  };
}

/**
 * Dòng mẫu đầy đủ (`priceSheetTemplateService.get`) ra dạng phiếu cho `printPriceSheetRecord` + tiêu đề cửa sổ in.
 * Mẫu đã lưu `snapshot.printData` + `printTemplate` khi bấm Lưu mẫu (cùng form với phiếu thật). Mã mẫu làm số phiếu; không có ngày tạo
 * (ô "Căn cứ Đơn đăng ký ... ngày" để chấm điền tay như phiếu chưa lưu).
 */
export interface TemplatePrintSheet {
  id: string;
  sheet_code: string;
  product_code: string | null;
  product_type: string;
  project_name: string | null;
  policy_name: string | null;
  created_at: null;
  snapshot: Record<string, unknown>;
  payload: Record<string, unknown>;
}

export function templatePrintRecord(t: PriceSheetTemplate): { sheet: TemplatePrintSheet; title: string } {
  const { payload, snapshot } = sheetSeedFromTemplate(t);
  const code = str(t.product_code);
  return {
    sheet: {
      id: t.id,
      sheet_code: t.ma_mau,
      product_code: code,
      product_type: t.product_type,
      project_name: t.project_name ?? null,
      policy_name: t.policy_name ?? null,
      created_at: null,
      snapshot,
      payload,
    },
    title: `Phiếu tính giá mẫu ${t.ma_mau}${code ? ` – ${code}` : ""}`,
  };
}

/** Gắn vết mẫu vào payload khi lưu phiếu (bản sao) */
export function withTemplateTrace(payload: any, seed: FromTemplateSeed): any {
  const p = clone(payload) || {};
  p.TTHopDong = { ...(p.TTHopDong || {}), MauId: seed.templateId, MaMau: seed.maMau };
  return p;
}

/**
 * Vết mẫu (`TTHopDong.MauId` / `MaMau`) của phiếu đang sửa (`initialSheet`, có `payload` hoặc chính là payload) để giữ khi lưu lại:
 * form dựng `TTHopDong` từ danh sách khóa cố định nên không có bước này thì lần sửa đầu làm mất liên kết mẫu. Không có ⇒ {}.
 */
export function templateTraceOf(sheet: unknown): { MauId?: string; MaMau?: string } {
  type Src = { TTHopDong?: { MauId?: string; MaMau?: string } | null } | null | undefined;
  const sh = sheet as (Src & { payload?: Src }) | null | undefined;
  const tt = (sh?.payload || sh)?.TTHopDong;
  const out: { MauId?: string; MaMau?: string } = {};
  if (tt?.MauId) out.MauId = tt.MauId;
  if (tt?.MaMau) out.MaMau = tt.MaMau;
  return out;
}

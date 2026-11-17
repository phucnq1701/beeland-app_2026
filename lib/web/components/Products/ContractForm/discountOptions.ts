// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/discountOptions.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import type { PolicyDiscountOption } from "../../../services/DaSalesPolicyService";
import { matchOption, type OptionCtx } from "./optionConditions";

/** Mức đã tick trên phiếu/hợp đồng: ảnh chụp tên, đơn vị và giá trị lúc chọn */
export type PickedOption = { ID: string; Ten: string; GiaTri: number; DonViTinh?: string; MaKho?: string; MaDongKho?: string };

/**
 * Định dạng tiền dạng chữ (1.234.567). Không dùng `Format_Currency` vì hàm đó trả về
 * phần tử JSX `<p>`, không ghép được vào chuỗi.
 */
export const money = (n: unknown) =>
  String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/** Dòng chiết khấu loại % (mọi giá trị khác là VNĐ) */
export const isPercentLoai = (loai: unknown) => loai === "percentage";

/** Giá trị của một mức theo loại dòng: % giữ số lẻ, VNĐ định dạng tiền */
export const optionValueText = (loai: unknown, v: unknown): string =>
  isPercentLoai(loai) ? `${Number(v) || 0}%` : money(v);

/** Mọi loại chiết khấu đều cấu hình chi tiết (giá trị nằm ở chi tiết) */
export const canConfigureOptions = (_d?: { Loai?: string; GiaTri?: unknown }): boolean => true;

/** Chữ cho cột Giá trị của bảng chiết khấu. Dòng kiểu cũ (giá trị ở dòng, chưa có chi tiết) vẫn hiện giá trị đó */
export const discountValueText = (d: {
  Loai?: string;
  GiaTri?: unknown;
  LuaChon?: PolicyDiscountOption[];
}): string => {
  const opts = Array.isArray(d?.LuaChon) ? d.LuaChon : [];
  if (opts.length === 0) return Number(d?.GiaTri ?? 0) > 0 ? optionValueText(d?.Loai, d?.GiaTri) : "—";
  if (opts.length === 1) return optionValueText(d?.Loai, opts[0].GiaTri);
  const values = opts.map((o) => Number(o.GiaTri) || 0);
  return `${opts.length} mức: ${optionValueText(d?.Loai, Math.min(...values))} – ${optionValueText(d?.Loai, Math.max(...values))}`;
};

/** Tổng các mức đã tick, làm tròn (VNĐ). `percent` = dòng %: giữ 4 chữ số lẻ */
export const sumPicked = (picked: PickedOption[], percent = false): number => {
  const total = (picked || []).reduce((s, o) => s + (Number(o?.GiaTri) || 0), 0);
  return percent ? Math.round(total * 10000) / 10000 : Math.round(total);
};

/** Bản chụp mức đã tick (LuaChonDaChon): tên / giá trị / ĐVT + kho / dòng kho của mức theo kho (D9 — truy vết, in) */
export const toPicked = (item: PickedOption): PickedOption => ({
  ID: item.ID,
  Ten: item.Ten,
  GiaTri: item.GiaTri,
  ...(item.DonViTinh ? { DonViTinh: item.DonViTinh } : {}),
  ...(item.MaKho ? { MaKho: item.MaKho } : {}),
  ...(item.MaDongKho ? { MaDongKho: item.MaDongKho } : {}),
});

/** Danh sách trong dropdown: mức hiện có + mức đã tick nhưng không còn trong chính sách (stale) */
export const mergePickedOptions = (
  options: PolicyDiscountOption[] | undefined,
  picked: PickedOption[] | undefined,
): (PickedOption & { stale?: boolean })[] => {
  const current = (options || []).map((o) => ({
    ID: String(o.ID ?? ""),
    Ten: o.Ten,
    GiaTri: o.GiaTri,
    ...(o.DonViTinh ? { DonViTinh: o.DonViTinh } : {}),
    ...(o.MaKho ? { MaKho: o.MaKho } : {}),
    ...(o.MaDongKho ? { MaDongKho: o.MaDongKho } : {}),
  }));
  const ids = new Set(current.map((o) => o.ID));
  const stale = (picked || [])
    .filter((p) => !ids.has(String(p.ID)))
    .map((p) => ({ ...p, stale: true as const }));
  return [...current, ...stale];
};

const detailKey = (d: any) => String(d?.MaCK ?? d?.ID ?? "");

/** maCK kiểu cũ: trống hoặc chỉ gồm chữ số (số thứ tự dòng) */
export const isLegacyCode = (v: unknown) => v == null || /^\d*$/.test(String(v).trim());

/** Dò dòng chính sách của 1 dòng bảng: theo mã; chỉ dò theo vị trí khi maCK trống hoặc là số kiểu cũ */
export const findDetailForRound = (
  details: any[],
  round: { maCK?: unknown },
  idx: number,
): any | undefined => {
  const list = details || [];
  if (isLegacyCode(round?.maCK)) return list[idx];
  const key = String(round.maCK);
  return list.find((d) => detailKey(d) === key);
};

/** Dòng chính sách đầu tiên chưa có trong bảng (so theo mã) */
export const nextDetailForRound = (
  details: any[],
  rounds: { maCK?: unknown }[],
): any | undefined => {
  const list = details || [];
  // Dòng cũ (maCK trống/số) chiếm chi tiết cùng vị trí, không dò theo mã
  const used = new Set<string>();
  (rounds || []).forEach((r, i) => {
    if (isLegacyCode(r?.maCK)) {
      if (list[i]) used.add(detailKey(list[i]));
    } else used.add(String(r.maCK));
  });
  return list.find((d) => !used.has(detailKey(d)));
};

/**
 * Áp các mức đã tick. Dòng VNĐ: tiền CK bằng tổng, CK % về 0. Dòng %: CK % bằng tổng, tiền CK về 0.
 * Dòng "Không trừ vào giá HĐ": vẫn ghi nhận các mức đã tick nhưng CK về 0.
 */
export const applyPicked = <T>(
  round: T,
  picked: PickedOption[],
): T & { tienCK: number; discountPercent: number; luaChonDaChon: PickedOption[] } => {
  const r = round as any;
  const pct = isPercentLoai(r?.loai);
  const off = !!r?.khongTruGiaHD;
  return {
    ...round,
    tienCK: off || pct ? 0 : sumPicked(picked),
    discountPercent: off || !pct ? 0 : sumPicked(picked, true),
    luaChonDaChon: picked,
  };
};

/**
 * Trường của dòng bảng lấy từ 1 dòng chi tiết chính sách (trừ tên và công thức). Dòng có chi tiết (LuaChon) luôn bắt đầu
 * chưa tick, CK bằng 0 — người dùng tự tick mức thỏa điều kiện (chủ dự án 2026-11-11, bỏ tự tick khi chỉ 1 mức đạt).
 * Dòng "Không trừ vào giá HĐ" có CK bằng 0. `ctx` giữ để nơi gọi không đổi.
 */
export const policyRoundFields = (d: any, _ctx?: OptionCtx) => {
  const luaChon: PolicyDiscountOption[] | undefined = d?.LuaChon;
  const base = {
    discountPercent: Number(d?.CKPT) || 0,
    heSo: Number(d?.HeSo) || 1,
    // Chi tiết chính sách trả tiền CK ở `CKTien`; `CKDonGia` là tên cũ
    tienCK: Math.round(Number(d?.CKTien ?? d?.CKDonGia) || 0),
    enabled: true,
    maCK: d?.MaCK,
    luaChon,
    loai: d?.Loai as string | undefined,
    khongTruGiaHD: !!d?.IsKhongTruGiaHD,
    mocTinh: !!d?.IsMocTinh,
    mocTinhTyLe: !!d?.IsMocTinhTyLe && d?.Loai === "percentage",
  };
  if ((luaChon?.length ?? 0) > 0) return applyPicked(base, []);
  return base.khongTruGiaHD ? { ...base, tienCK: 0, discountPercent: 0, luaChonDaChon: [] } : { ...base, luaChonDaChon: [] };
};

/** Dòng có chi tiết thì khóa ô CK % và CK Tiền */
export const isRoundLocked = (round: any): boolean =>
  (round?.luaChon?.length ?? 0) > 0 || (round?.luaChonDaChon?.length ?? 0) > 0;

/**
 * Dòng chính sách dùng khi lưu (mã, MaKTT): chỉ dò theo mã. Dòng cũ (maCK trống/số)
 * không lấy theo vị trí, vì sau khi kéo thả vị trí không còn đúng dòng.
 */
export const savedDetailForRound = (details: any[], round: { maCK?: unknown }, idx: number): any | undefined =>
  isLegacyCode(round?.maCK) ? undefined : findDetailForRound(details, round, idx);

/** Chính sách không có chi tiết: dòng có mức trở về rỗng, tiền về 0; dòng thường giữ nguyên */
export const clearRoundOptions = <T>(round: T): T =>
  isRoundLocked(round)
    ? { ...applyPicked(round, []), maCK: undefined, luaChon: undefined }
    : round;

/** Dòng nào được lưu vào ChinhSach: bật, và có CK hoặc có cấu hình chi tiết */
export const shouldSaveRound = (round: any): boolean => {
  if (!round?.enabled) return false;
  if ((Number(round.tienCK) || 0) > 0 || (Number(round.discountPercent) || 0) > 0) return true;
  // Mức giá trị 0 còn được chọn (tổng 0) vẫn phải lưu
  return (round.luaChon?.length ?? 0) > 0 || (round.luaChonDaChon?.length ?? 0) > 0;
};

type SavedExtras = {
  TenChietKhau: string;
  HeSo: number;
  LuaChonDaChon?: PickedOption[];
  Loai?: string;
  IsMocTinh?: boolean;
  IsKhongTruGiaHD?: boolean;
  IsMocTinhTyLe?: boolean;
};

/**
 * Trường bổ sung của dòng ChinhSach khi lưu: tên, hệ số, ảnh chụp các mức đã chọn, và loại / mốc tính /
 * không trừ giá HĐ để mở lại ghép đúng công thức như lúc lưu.
 */
export const savedRoundExtras = (round: any): SavedExtras => {
  const extras: SavedExtras = {
    TenChietKhau: String(round?.name ?? ""),
    // Hệ số là số liệu của chứng từ, không dò lại từ chính sách khi mở lại
    HeSo: Number(round?.heSo) || 1,
  };
  if ((round?.luaChonDaChon?.length ?? 0) > 0) extras.LuaChonDaChon = round.luaChonDaChon;
  if (round?.loai) extras.Loai = round.loai;
  if (round?.mocTinh) extras.IsMocTinh = true;
  if (round?.khongTruGiaHD) extras.IsKhongTruGiaHD = true;
  if (round?.mocTinhTyLe) extras.IsMocTinhTyLe = true;
  return extras;
};

/**
 * Đối chiếu các mức đã tick khi bối cảnh đổi (lịch thanh toán, giá...): mức đã tick nhưng không còn đạt thì bỏ
 * (CK về 0) và trả qua `dropped`. Không bao giờ tự tick mức khác (2026-11-11: người dùng tự tick). Mức đã tick
 * nhưng không còn trong chính sách thì giữ nguyên. `ctx.onlyAllocated`: chỉ xét mức có phân bổ. Không đổi gì thì trả đúng `round` cũ.
 */
export function reconcilePicks<T>(round: T, ctx: OptionCtx): { round: T; dropped?: PickedOption } {
  const r = round as any;
  const opts: PolicyDiscountOption[] = r?.luaChon ?? [];
  if (opts.length === 0) return { round };
  const picked: PickedOption[] = r?.luaChonDaChon ?? [];
  const byId = new Map(opts.map((o) => [String(o.ID ?? ""), o]));
  // onlyAllocated: điều kiện khác của chứng từ cũ không liên quan việc đổi công ty ⇒ chỉ xét mức có phân bổ
  const dropped = picked.find((p) => {
    const o = byId.get(String(p.ID));
    return !!o && (!ctx.onlyAllocated || (o.PhanBo?.length ?? 0) > 0) && !matchOption(o, ctx).ok;
  });
  const kept = dropped ? picked.filter((p) => p !== dropped) : picked;
  return dropped ? { round: applyPicked(round, kept), dropped } : { round };
}

/** Giá niêm yết gồm VAT của căn (như GiaGocGomVAT của vòng tính): tổng gồm VAT của lưới, không có thì DT × đơn giá */
export const listedGomVAT = (formData: any): number => {
  const raw = Number(formData?.rawTongGiaDaVAT) || 0;
  return raw > 0 ? raw : (Number(formData?.dienTichThongThuy) || 0) * (Number(formData?.donGiaSuDungDat) || 0);
};

/**
 * Giá niêm yết VAT + KPBT của căn — giá trị so với tiêu chí điều kiện GIA_GOM_VAT (spec phan-bo-ctbh-duyet §11.1, G-2):
 * tổng gồm VAT + phí bảo trì của bảng giá (`rawTongGomPBT`); không có thì giá gồm VAT + phí bảo trì; không có giá ⇒ 0 (chưa xác định).
 * Giá gốc trên bảng giá, chưa trừ chiết khấu.
 */
export const listedGomVATPBT = (formData: unknown): number => {
  const f = (formData ?? {}) as { rawTongGomPBT?: unknown; rawTienPhiBaoTri?: unknown };
  const tongGomPBT = Number(f.rawTongGomPBT) || 0;
  if (tongGomPBT > 0) return tongGomPBT;
  const gomVAT = listedGomVAT(formData);
  return gomVAT > 0 ? gomVAT + (Number(f.rawTienPhiBaoTri) || 0) : 0;
};

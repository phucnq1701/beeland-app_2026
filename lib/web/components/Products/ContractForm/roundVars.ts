// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/roundVars.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
/**
 * Biến của một lần chiết khấu cao tầng, dùng chung cho phiếu tính giá và form
 * đặt cọc/hợp đồng để hai nơi ra cùng số.
 */
import { NAKED_KEEP_FORMULA, type RoundFormulas, roundFormulaText } from "./formulas";

/** `GiaNaked` được seed bằng lần trước, công thức sẽ ghi đè khi tính. */
export function nakedRoundVars(
  goc: number,
  prev: number
): { GiaNakedGoc: number; GiaNaked_Prev: number; GiaNaked: number } {
  return { GiaNakedGoc: goc, GiaNaked_Prev: prev, GiaNaked: prev };
}

/**
 * `TongCK_Prev` là Tổng CK của lần đang bật liền trước, không cộng dồn; bên gọi giữ giá trị này như các biến `prev*`.
 * `TienVAT`, `TienPBT` tính từ giá gốc nên không đổi qua các lần. Tỷ lệ theo phần trăm (10 là 10%).
 */
export function highRiseBaseVars(
  giaGoc: number,
  tyLeVATPercent: number,
  tyLePBTPercent: number,
  prevTongCK: number,
  goc?: { tienVAT?: number; tienPBT?: number }
): { TongCK_Prev: number; TienVAT: number; TienPBT: number } {
  return {
    TongCK_Prev: prevTongCK,
    TienVAT: goc?.tienVAT ?? (giaGoc * tyLeVATPercent) / 100,
    TienPBT: goc?.tienPBT ?? (giaGoc * tyLePBTPercent) / 100,
  };
}

/**
 * Tiền VAT / PBT gốc của căn cao tầng, lấy như khung "Thông tin sản phẩm": số của bảng giá trước; thiếu thì
 * Gồm VAT − Chưa VAT (VAT) và Tổng gồm PBT − Gồm VAT (PBT); thiếu nữa mới tính theo % trên giá gốc chưa VAT.
 * VAT của bảng giá thường KHÁC % × giá chưa VAT vì tiền đất không chịu VAT.
 */
export function highRiseGocVatPbt(
  formData: any,
  giaGoc: number,
  tyLeVATPercent: number,
  tyLePBTPercent: number
): { tienVAT: number; tienPBT: number } {
  const num = (v: unknown) => Number(v) || 0;
  const chua = num(formData?.rawTongGiaChuaVAT);
  const gom = num(formData?.rawTongGiaDaVAT);
  const gomPBT = num(formData?.rawTongGomPBT);
  const tienVAT =
    num(formData?.rawTienVAT) || (gom > 0 && chua > 0 ? gom - chua : 0) || (giaGoc * (Number(tyLeVATPercent) || 0)) / 100;
  const tienPBT =
    num(formData?.rawTienPhiBaoTri) || (gomPBT > 0 && gom > 0 ? gomPBT - gom : 0) || (giaGoc * (Number(tyLePBTPercent) || 0)) / 100;
  return { tienVAT, tienPBT };
}

/**
 * Tổng gồm VAT + PBT: gốc (giá gốc gồm VAT + Tiền PBT gốc), lần trước (Tổng gồm VAT + Phí bảo trì của lần
 * đang bật liền trước), lần này (theo số đang có trong `vars`, gọi lại `syncGomVatPbt` sau mỗi lượt tính).
 * PBT lấy theo công thức của vòng, đúng số đang hiện trên bảng.
 */
export function gomVatPbtVars(
  giaGocGomVAT: number,
  tienPBTGoc: number,
  prevTongGomVAT: number,
  prevPhiBaoTri: number
): { TongGomVATPBTGoc: number; TongGomVATPBT_Prev: number } {
  return {
    TongGomVATPBTGoc: giaGocGomVAT + tienPBTGoc,
    TongGomVATPBT_Prev: prevTongGomVAT + prevPhiBaoTri,
  };
}

/** Cập nhật `TongGomVATPBT` (lần này) theo `TongGomVAT` + `PhiBaoTri` hiện tại; true nếu giá trị đổi */
export function syncGomVatPbt(vars: Record<string, number>): boolean {
  const next = (Number(vars.TongGomVAT) || 0) + (Number(vars.PhiBaoTri) || 0);
  const changed = vars.TongGomVATPBT !== next;
  vars.TongGomVATPBT = next;
  return changed;
}

/**
 * `TongChuaVATMoc`: Tổng chưa VAT tại dòng mốc tính (vị trí 1-based, tính cả dòng tắt như biến theo lần).
 * Dòng mốc chưa tính tới hoặc không có mốc thì bằng 0.
 */
export function mocRoundVar(rows: { tongChuaVAT: number }[], moc: number): { TongChuaVATMoc: number } {
  return { TongChuaVATMoc: moc > 0 && rows.length >= moc ? Number(rows[moc - 1]?.tongChuaVAT) || 0 : 0 };
}

export const GOM_VAT_PBT_VAR_SOURCES = {
  TongGomVATPBTGoc: "Giá gốc gồm VAT + Tiền PBT gốc",
  TongGomVATPBT_Prev: "Tổng gồm VAT + Phí bảo trì của lần đang bật liền trước",
  TongGomVATPBT: "Tổng gồm VAT + Phí bảo trì của lần này (sau công thức)",
  TongChuaVATMoc: "Tổng chưa VAT tại dòng mốc tính (chưa tới mốc = 0)",
  LuyKeCKTyLe: "Tổng Tỷ lệ CK của các dòng tick Mốc tính tỷ lệ phía trên (dòng không tick = 0)",
  LuyKeTienCKTyLe: "Tổng cột Tổng CK của các dòng tick Mốc tính tỷ lệ phía trên (dòng không tick = 0)",
};

const ROUND_REF_LABELS = new Map([
  ["TongChuaVATLan", "Tổng chưa VAT lần"],
  ["TienCKLan", "Tiền CK lần"],
]);

/** Mã trong danh mục của biến theo lần (không kèm số, client nối số lần vào sau). */
export const isRoundRefCode = (code: string): boolean => ROUND_REF_LABELS.has(code);

/** Tách `TienCKLan2` thành mã và số lần. Không phải biến theo lần hợp lệ thì trả null. */
export function parseRoundRef(token: string): { code: string; round: number } | null {
  const match = /^(TongChuaVATLan|TienCKLan)([1-9]\d*)$/.exec(token);
  return match ? { code: match[1], round: Number(match[2]) } : null;
}

/**
 * Biến theo lần của các dòng đã tính. Số lần là vị trí dòng trên bảng, tính cả dòng tắt:
 * dòng tắt giữ Tổng chưa VAT của dòng trước và có CK bằng 0, đúng như số đang hiện.
 */
export function roundRefVars(
  rows: { tongChuaVAT: number; tongCK: number }[]
): Record<string, number> {
  const vars: Record<string, number> = {};
  rows.forEach((row, idx) => {
    vars[`TongChuaVATLan${idx + 1}`] = row.tongChuaVAT;
    vars[`TienCKLan${idx + 1}`] = row.tongCK;
  });
  return vars;
}

export function roundRefSources(count: number): Record<string, string> {
  const sources: Record<string, string> = {};
  for (let round = 1; round <= count; round++) {
    sources[`TongChuaVATLan${round}`] = `Tổng chưa VAT của lần ${round}`;
    sources[`TienCKLan${round}`] = `Tổng CK của lần ${round}`;
  }
  return sources;
}

/** Biến theo lần mà lần đang cấu hình chưa có số liệu (từ chính lần đó trở đi), không lặp. */
export function futureRoundRefs(formula: string, roundIndex: number): string[] {
  const tokens = formula.match(/\b(?:TongChuaVATLan|TienCKLan)[1-9]\d*\b/g) || [];
  return [...new Set(tokens)].filter((token) => (parseRoundRef(token)?.round ?? 0) > roundIndex);
}

/** So khớp nguyên tên biến, để `TienCKLan1` không kéo theo `TienCK` hay `TienCKLan10`. */
export const formulaUsesVar = (formula: string, key: string): boolean =>
  new RegExp(`\\b${key}\\b`).test(formula);

/** Tên hiển thị của biến theo lần, ví dụ "Tiền CK lần 2". Biến khác trả null. */
export function roundRefLabel(token: string): string | null {
  const ref = parseRoundRef(token);
  return ref ? `${ROUND_REF_LABELS.get(ref.code)} ${ref.round}` : null;
}

/** Ô Tổng CK: hiện cả số âm để thấy lần CK đang làm tăng giá; chỉ ẩn khi bằng 0 hoặc dòng tắt. */
export const showsTongCK = (enabled: boolean, value: number): boolean => enabled && value !== 0;

export const HIGH_RISE_BASE_VAR_SOURCES = {
  TongCK_Prev: "Tổng CK của lần đang bật liền trước",
  TienVAT: "Tiền VAT gốc của bảng giá (thiếu thì Giá gốc chưa VAT × % VAT)",
  TienPBT: "Tiền PBT gốc của bảng giá (thiếu thì Giá gốc chưa VAT × % PBT)",
};

const NAKED_VARIABLE = /\b(?:GiaNaked|GiaNaked_Prev|GiaNakedGoc)\b/;

/**
 * Kết quả Giá Naked của một lần. Công thức trống giữ nguyên lần trước, kể cả khi
 * lần trước chưa có giá (`null` khác 0). Lần trước chưa có giá mà công thức dùng
 * biến Naked thì vẫn là `null`, vì số tính ra chỉ dựa trên gốc 0. Còn lại lấy số
 * đã tính; vòng không tính bước này (`value` trống) cũng giữ lần trước.
 */
export function nakedRoundResult(
  formulaText: string,
  value: number | undefined,
  prev: number | null
): number | null {
  const text = formulaText.trim();
  if (!text || text === NAKED_KEEP_FORMULA) return prev;
  if (prev === null && NAKED_VARIABLE.test(text)) return null;
  return value ?? prev;
}

/**
 * Giá Naked gốc của phiếu đã lưu: giá đã chốt, rồi bảng giá, rồi sản phẩm hiện tại.
 * Chỉ đọc nguồn sau khi nguồn trước trống. Nguồn đọc lỗi coi như trống.
 */
export async function resolveSavedNakedGoc(
  saved: unknown,
  sources: {
    readPriceList: () => Promise<unknown>;
    readProduct: () => Promise<unknown>;
  }
): Promise<number | null> {
  const read = async (source: () => Promise<unknown>) => {
    try {
      return parseNaked(await source());
    } catch {
      return null;
    }
  };
  return (
    parseNaked(saved) ??
    (await read(sources.readPriceList)) ??
    (await read(sources.readProduct))
  );
}

/** Nguồn gốc của từng biến, hiển thị ở popover xem công thức. */
export function highRiseVarSources(
  roundNumber: number,
  seedLabel: string
): Record<string, string> {
  return {
    GiaGoc: "Giá gốc chưa VAT (raw API hoặc DT × ĐG)",
    GiaGocGomVAT: "Giá gốc gồm VAT (raw API hoặc DT × ĐG)",
    GiaTruocCK: `Tổng chưa VAT trước CK (${seedLabel})`,
    TongChuaVAT_Prev: seedLabel,
    TongGomVAT_Prev: seedLabel,
    TongGiaTriHD_Prev: seedLabel,
    TyLeCK: `Cấu hình CSBH lần ${roundNumber}`,
    TienCKTienMat: `CK Tiền nhập tay - lần ${roundNumber}`,
    TienCK: "TienCKTienMat + TongChuaVAT_Prev × TyLeCK% × HeSo",
    HeSo: `Cấu hình CSBH lần ${roundNumber}`,
    TyLeVAT: "Form: % VAT",
    TyLePBT: "Form: % Phí bảo trì",
    DienTichThongThuy: "Form: DT thông thủy",
    DGDatPB: "Form: ĐG đất phân bổ",
    TongChuaVAT: `Seed = ${seedLabel} (chưa qua công thức)`,
    TongGomVAT: `Seed = ${seedLabel} (chưa qua công thức)`,
    VAT: "Seed = TongChuaVAT_Prev × TyLeVAT (chưa qua công thức)",
    PhiBaoTri: "Seed = TongChuaVAT_Prev × TyLePBT (chưa qua công thức)",
    TongGiaTriHD: `Seed = ${seedLabel} (chưa qua công thức)`,
    GiaNakedGoc: "Giá Naked gốc của căn",
    GiaNaked_Prev: seedLabel,
    GiaNaked: `Seed = ${seedLabel} (chưa qua công thức)`,
    ...HIGH_RISE_BASE_VAR_SOURCES,
    ...GOM_VAT_PBT_VAR_SOURCES,
    ...roundRefSources(roundNumber - 1),
  };
}

/** Tên biến hiển thị ở popover xem công thức của bảng lần chiết khấu cao tầng. */
export const HIGH_RISE_VAR_LABELS: Record<string, string> = {
  GiaGoc: "Giá gốc (chưa VAT)",
  GiaGocGomVAT: "Giá gốc (gồm VAT)",
  GiaTruocCK: "Giá trước CK",
  TongChuaVAT_Prev: "Tổng chưa VAT (trước)",
  TongGomVAT_Prev: "Tổng gồm VAT (trước)",
  TongGiaTriHD_Prev: "Tổng giá trị HĐ (trước)",
  TyLeCK: "Tỷ lệ CK (%)",
  TienCK: "Tiền CK (tổng cũ)",
  TienCKTienMat: "CK tiền mặt",
  HeSo: "Hệ số",
  TyLeVAT: "% VAT",
  TyLePBT: "% Phí bảo trì",
  DienTichThongThuy: "DT thông thủy",
  DGDatPB: "ĐG đất phân bổ",
  TongCK: "Tổng CK",
  TongChuaVAT: "Tổng chưa VAT",
  VAT: "VAT",
  TongGomVAT: "Tổng gồm VAT",
  PhiBaoTri: "Phí bảo trì",
  TongGiaTriHD: "Tổng giá trị HĐ",
  GiaNakedGoc: "Giá Naked",
  GiaNaked_Prev: "Giá Naked lần trước",
  GiaNaked: "Giá Naked lần này",
  TongCK_Prev: "Tổng CK (lần trước)",
  TienVAT: "Tiền VAT gốc",
  TienPBT: "Tiền PBT gốc",
  TongGomVATPBTGoc: "Tổng gồm VAT + PBT gốc",
  TongGomVATPBT_Prev: "Tổng gồm VAT + PBT (lần trước)",
  TongGomVATPBT: "Tổng gồm VAT + PBT (lần này)",
  TongChuaVATMoc: "Tổng chưa VAT theo mốc tính",
  LuyKeCKTyLe: "Lũy kế chiết khấu tỷ lệ",
  LuyKeTienCKTyLe: "Lũy kế tiền chiết khấu tỷ lệ",
};

export const highRiseVarLabel = (code: string): string =>
  HIGH_RISE_VAR_LABELS[code] || roundRefLabel(code) || code;

/** Điền công thức Naked mặc định, để dòng đọc công thức của form dùng trực tiếp. */
export function withNakedFormula<T extends { formulas: RoundFormulas }>(
  round: T
): T {
  return {
    ...round,
    formulas: {
      ...round.formulas,
      giaNaked: roundFormulaText(round.formulas, "giaNaked"),
    },
  };
}

/** Giá trị đưa vào cấu hình tính giá khi sửa một ô giá. Xóa ô Giá Naked ra `null`, các ô khác ra 0. */
export function priceCellValue(code: string, value: unknown): unknown {
  return value ?? (code === "GiaNaked" ? null : 0);
}

/** `null` nghĩa là chưa nhập, khác với 0. */
export function parseNaked(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Khóa `GiaNaked` để trải vào dữ liệu lưu. Vắng khóa thì backend giữ giá cũ, nên
 * thấp tầng và giá trống không gửi khóa này.
 */
export function nakedPayload(
  isLowRise: boolean,
  value: unknown
): { GiaNaked?: number } {
  if (isLowRise) return {};
  const parsed = parseNaked(value);
  return parsed === null ? {} : { GiaNaked: parsed };
}

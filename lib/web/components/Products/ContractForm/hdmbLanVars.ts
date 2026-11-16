// ⚠️ TỰ SINH — bản chép nguyên văn web src/components/Products/ContractForm/hdmbLanVars.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
/**
 * Biến "Giá trị HĐMB lần n" của công thức tiến độ thanh toán cao tầng: `GiaTriHDMBLan{n}`, n = 1…6
 * = cột "Giá HĐMB chưa TT lần n" (price_list_items.gia_hdmb_chua_tt_lan_n) của sản phẩm trong bảng giá.
 * Danh mục biến chỉ có mã `GiaTriHDMBLan` (nhóm THEOLAN), số lần nối vào khi chèn công thức.
 * Lưu kèm phiếu ở GiaTriHopDong.GiaHDMBChuaTTLan1…6 để mở lại dùng đúng số lúc lập phiếu.
 */
export const HDMB_LAN_CODE = "GiaTriHDMBLan";
export const HDMB_LAN_MAX = 6;

const LANS = Array.from({ length: HDMB_LAN_MAX }, (_, i) => i + 1);
const savedKey = (lan: number) => `GiaHDMBChuaTTLan${lan}`;

/** Số của bảng giá / phiếu: trống hoặc không phải số ⇒ null (khác 0) */
const num = (v: unknown): number | null =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);

/** `GiaTriHDMBLan3` ⇒ { lan: 3 }; lần ngoài 1…6 hoặc không kèm số ⇒ null */
export function parseHdmbLan(token: string): { lan: number } | null {
  const m = /^GiaTriHDMBLan([1-9]\d*)$/.exec(token);
  const lan = m ? Number(m[1]) : 0;
  return lan >= 1 && lan <= HDMB_LAN_MAX ? { lan } : null;
}

/** Tên hiển thị, ví dụ "Giá trị HĐMB lần 3"; biến khác ⇒ null */
export function hdmbLanLabel(token: string): string | null {
  const ref = parseHdmbLan(token);
  return ref ? `Giá trị HĐMB lần ${ref.lan}` : null;
}

/** 6 cột "Giá HĐMB chưa TT lần n" của dòng bảng giá (kết quả getSPByBG) */
export function hdmbLanFromPriceList(bg: Record<string, unknown> | null | undefined): (number | null)[] {
  return LANS.map((lan) => num(bg?.[`gia_hdmb_chua_tt_lan_${lan}`]));
}

/** Số đã lưu kèm phiếu; phiếu lưu trước khi có khoá (không có khoá nào) ⇒ undefined để rơi về bảng giá */
export function hdmbLanFromSaved(gt: Record<string, unknown> | null | undefined): (number | null)[] | undefined {
  if (!gt || !LANS.some((lan) => savedKey(lan) in gt)) return undefined;
  return LANS.map((lan) => num(gt[savedKey(lan)]));
}

/**
 * Khoá lưu trong GiaTriHopDong: đủ 6 khoá, phần tử thiếu ⇒ null. Chưa có số (chưa chọn bảng giá / phiếu cũ) ⇒ không ghi khoá
 * nào, để lần mở sau còn rơi về bảng giá thay vì coi 6 ô trống là "số lúc lập phiếu"
 */
export function hdmbLanPayload(values: (number | null)[] | null | undefined): Record<string, number | null> {
  if (!values) return {};
  return Object.fromEntries(LANS.map((lan) => [savedKey(lan), num(values?.[lan - 1])]));
}

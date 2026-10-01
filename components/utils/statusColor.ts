/**
 * Màu trạng thái dùng chung: nền lấy CHÍNH XÁC từ color_code của dữ liệu,
 * chữ/icon tự điều chỉnh theo nền để dễ đọc.
 */

/** Chuẩn hoá về dạng #RRGGBB; trả về null nếu không hợp lệ. */
export function normalizeHexColor(color: unknown): string | null {
  let c = String(color ?? "").trim();
  if (!c) return null;
  if (!c.startsWith("#")) c = `#${c}`;
  if (c.length === 4) {
    c = "#" + c.slice(1).split("").map((ch) => ch + ch).join("");
  }
  return /^#[0-9A-Fa-f]{6}$/.test(c) ? c.toUpperCase() : null;
}

/** Nền sáng → chữ cùng tông nhưng tối hơn; nền tối → chữ trắng. */
export function statusTextColorOf(bg: string): string {
  const hex = normalizeHexColor(bg);
  if (!hex) return "#1F2937";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance <= 0.6) return "#FFFFFF";
  const toHex = (v: number) => Math.round(v * 0.4).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

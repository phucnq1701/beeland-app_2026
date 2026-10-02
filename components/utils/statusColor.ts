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

/**
 * Màu preset của Tag antd – web lưu color_code dạng tên (blue, green…) ở Danh mục khách hàng.
 * bg = màu-1, border = màu-3, fg = màu-7 của @ant-design/colors, đúng như Tag trên web.
 */
const ANTD_TAG_PRESETS: Record<string, { bg: string; fg: string; border: string }> = {
  red: { bg: "#FFF1F0", fg: "#CF1322", border: "#FFA39E" },
  volcano: { bg: "#FFF2E8", fg: "#D4380D", border: "#FFBB96" },
  orange: { bg: "#FFF7E6", fg: "#D46B08", border: "#FFD591" },
  gold: { bg: "#FFFBE6", fg: "#D48806", border: "#FFE58F" },
  yellow: { bg: "#FEFFE6", fg: "#D4B106", border: "#FFFB8F" },
  lime: { bg: "#FCFFE6", fg: "#7CB305", border: "#EAFF8F" },
  green: { bg: "#F6FFED", fg: "#389E0D", border: "#B7EB8F" },
  cyan: { bg: "#E6FFFB", fg: "#08979C", border: "#87E8DE" },
  blue: { bg: "#E6F4FF", fg: "#0958D9", border: "#91CAFF" },
  geekblue: { bg: "#F0F5FF", fg: "#1D39C4", border: "#ADC6FF" },
  purple: { bg: "#F9F0FF", fg: "#531DAB", border: "#D3ADF7" },
  magenta: { bg: "#FFF0F6", fg: "#C41D7F", border: "#FFADD2" },
};

/** Tên màu preset antd → màu Tag; không phải preset (hex, "default", rỗng) → null. */
export function antdPresetTagColor(color: unknown): { bg: string; fg: string; border: string } | null {
  return ANTD_TAG_PRESETS[String(color ?? "").trim().toLowerCase()] ?? null;
}

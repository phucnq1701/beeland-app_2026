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
 * Giữ tông màu web nhưng vẽ theo kiểu soft của app (không viền, cùng độ đậm với nền *Subtle):
 * bg = màu-6 (@ant-design/colors) phủ 14% trên trắng, fg = màu-8 (gold/yellow/lime: màu-9 cho đủ tương phản ≥ 4.5).
 */
const ANTD_TAG_PRESETS: Record<string, { bg: string; fg: string }> = {
  red: { bg: "#FEE0E2", fg: "#A8071A" },
  volcano: { bg: "#FEE7DF", fg: "#AD2102" },
  orange: { bg: "#FEEFDE", fg: "#AD4E00" },
  gold: { bg: "#FEF4DE", fg: "#874D00" },
  yellow: { bg: "#FEFADE", fg: "#876800" },
  lime: { bg: "#F2FADE", fg: "#3F6600" },
  green: { bg: "#E7F7DF", fg: "#237804" },
  cyan: { bg: "#DEF6F6", fg: "#006D75" },
  blue: { bg: "#DEECFF", fg: "#003EB3" },
  geekblue: { bg: "#E2E7FC", fg: "#10239E" },
  purple: { bg: "#EBE2F9", fg: "#391085" },
  magenta: { bg: "#FCE2F0", fg: "#9E1068" },
};

/** Tên màu preset antd → màu badge; không phải preset (hex, "default", rỗng) → null. */
export function antdPresetTagColor(color: unknown): { bg: string; fg: string } | null {
  return ANTD_TAG_PRESETS[String(color ?? "").trim().toLowerCase()] ?? null;
}

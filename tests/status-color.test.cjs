const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const c = loadTs("components/utils/statusColor.ts");

test("antd preset color names (web Danh mục) map to the web Tag colors", () => {
  assert.deepEqual({ ...c.antdPresetTagColor("blue") }, { bg: "#DEECFF", fg: "#003EB3" });
  assert.equal(c.antdPresetTagColor(" Green ").fg, "#237804");
  for (const name of ["blue", "green", "orange", "red", "purple", "magenta", "gold", "cyan", "geekblue"]) {
    assert.ok(c.antdPresetTagColor(name), name);
  }
});

test("preset badge text keeps WCAG AA contrast on its background", () => {
  const lum = (h) => {
    const [r, g, b] = [1, 3, 5].map((i) => {
      const v = parseInt(h.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const name of ["red", "volcano", "orange", "gold", "yellow", "lime", "green", "cyan", "blue", "geekblue", "purple", "magenta"]) {
    const { bg, fg } = c.antdPresetTagColor(name);
    const ratio = (lum(bg) + 0.05) / (lum(fg) + 0.05);
    assert.ok(ratio >= 4.5, `${name}: ${ratio.toFixed(2)}`);
  }
});

test("hex, 'default' and empty are not presets", () => {
  assert.equal(c.antdPresetTagColor("#3B82F6"), null);
  assert.equal(c.antdPresetTagColor("default"), null);
  assert.equal(c.antdPresetTagColor(null), null);
  assert.equal(c.normalizeHexColor("blue"), null);
});

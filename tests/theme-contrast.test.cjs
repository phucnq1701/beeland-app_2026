const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const { colors } = loadTs("theme/colors.ts");

function luminance(hex) {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("text on buttons and badges meets WCAG AA 4.5:1", () => {
  const pairs = [
    ["onPrimary", "primary"], ["onPrimary", "primaryPressed"], ["onPrimarySubtle", "primarySubtle"],
    ["textSecondary", "surface"], ["textSecondary", "bg"], ["textTertiary", "surface"], ["text", "bg"],
    ["onInverse", "inverse"], ["onSuccessSubtle", "successSubtle"], ["onWarningSubtle", "warningSubtle"],
    ["onDangerSubtle", "dangerSubtle"], ["onInfoSubtle", "infoSubtle"], ["onPrimary", "danger"],
    ["primary", "surface"], ["onPrimary", "success"],
  ];
  for (const [fg, bg] of pairs) assert.ok(ratio(colors[fg], colors[bg]) >= 4.5, `${fg} on ${bg}`);
});

test("showcase text meets AA on navy", () => {
  for (const fg of ["accent", "text", "textMuted"]) {
    assert.ok(ratio(colors.showcase[fg], colors.showcase.bg) >= 4.5, fg);
  }
});

test("primary button is distinguishable on showcase navy (non-text 3:1)", () => {
  assert.ok(ratio(colors.primary, colors.showcase.bg) >= 3);
});

test("brand orange is never used as the primary action colour", () => {
  assert.notEqual(colors.primary, colors.brand);
});

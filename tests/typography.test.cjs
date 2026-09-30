const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const t = loadTs("theme/typography.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

test("caption is 14/20 (user feedback: 13 was too small); label stays the 12 minimum", () => {
  assert.equal(t.typography.caption.fontSize, 14);
  assert.equal(t.typography.caption.lineHeight, 20);
  assert.equal(t.typography.label.fontSize, 12);
  for (const v of Object.values(t.typography)) assert.ok(v.fontSize >= 12);
});

test("loaded fonts pick the weight's font file", () => {
  assert.deepEqual(plain(t.fontStyleFor("semibold", true)), { fontFamily: "BeVietnamPro-SemiBold" });
});

test("when fonts fail to load, weight falls back to fontWeight on the system font", () => {
  assert.deepEqual(plain(t.fontStyleFor("bold", false)), { fontWeight: "700" });
  assert.deepEqual(plain(t.fontStyleFor("regular", false)), { fontWeight: "400" });
});

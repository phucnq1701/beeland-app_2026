const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const c = loadTs("components/utils/statusColor.ts");

test("antd preset color names (web Danh mục) map to the web Tag colors", () => {
  assert.deepEqual({ ...c.antdPresetTagColor("blue") }, { bg: "#E6F4FF", fg: "#0958D9", border: "#91CAFF" });
  assert.equal(c.antdPresetTagColor(" Green ").fg, "#389E0D");
  for (const name of ["blue", "green", "orange", "red", "purple", "magenta", "gold", "cyan", "geekblue"]) {
    assert.ok(c.antdPresetTagColor(name), name);
  }
});

test("hex, 'default' and empty are not presets", () => {
  assert.equal(c.antdPresetTagColor("#3B82F6"), null);
  assert.equal(c.antdPresetTagColor("default"), null);
  assert.equal(c.antdPresetTagColor(null), null);
  assert.equal(c.normalizeHexColor("blue"), null);
});

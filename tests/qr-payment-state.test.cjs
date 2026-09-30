const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const q = loadTs("lib/qrPaymentState.ts");

const base = {
  loading: false, loadError: null, paid: false, hasActiveVa: false,
  amountMismatch: false, remainingSec: 600, hadPreviousQr: false,
};
const s = (o) => q.getQrScreenState({ ...base, ...o });

test("precedence", () => {
  assert.equal(s({ loading: true, loadError: "x", paid: true }), "loading");
  assert.equal(s({ loadError: "x", paid: true }), "error");
  assert.equal(s({ paid: true, remainingSec: 0 }), "paid");
  assert.equal(s({ remainingSec: null, hasActiveVa: true }), "noDeadline");
  assert.equal(s({ remainingSec: 0, hasActiveVa: true }), "expired");
  assert.equal(s({ hasActiveVa: true, amountMismatch: true }), "mismatch");
  assert.equal(s({ hasActiveVa: true }), "active");
  assert.equal(s({ hadPreviousQr: true }), "needsNewQr");
  assert.equal(s({}), "needsQr");
});

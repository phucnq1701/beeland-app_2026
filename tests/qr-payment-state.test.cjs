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
  assert.equal(s({ remainingSec: null }), "noDeadline");
  assert.equal(s({ remainingSec: 0, hasActiveVa: true }), "expired");
  assert.equal(s({ hasActiveVa: true, amountMismatch: true }), "mismatch");
  assert.equal(s({ hasActiveVa: true }), "active");
  assert.equal(s({ hadPreviousQr: true }), "needsNewQr");
  assert.equal(s({}), "needsQr");
});

test("a live QR is still shown when the booking has no hold deadline", () => {
  assert.equal(s({ remainingSec: null, hasActiveVa: true }), "active");
  assert.equal(s({ remainingSec: null, hasActiveVa: true, amountMismatch: true }), "mismatch");
  assert.equal(s({ remainingSec: null }), "noDeadline");
  assert.equal(s({ remainingSec: null, hadPreviousQr: true }), "noDeadline");
});

test("the QR image is only rendered in the active state (never for a wrong amount)", () => {
  for (const st of ["loading", "error", "paid", "noDeadline", "expired", "mismatch", "needsNewQr", "needsQr"]) {
    assert.equal(q.showsQrImage(st), false, st);
  }
  assert.equal(q.showsQrImage("active"), true);
});

test("deposit QR (requiresDeadline false) never expires and needs no deadline", () => {
  const dep = (o) => s({ remainingSec: null, requiresDeadline: false, ...o });
  assert.equal(dep({}), "needsQr");
  assert.equal(dep({ hadPreviousQr: true }), "needsNewQr");
  assert.equal(dep({ hasActiveVa: true }), "active");
  assert.equal(dep({ paid: true }), "paid");
});

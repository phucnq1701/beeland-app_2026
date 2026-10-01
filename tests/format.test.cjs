const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const f = loadTs("lib/format.ts");
const c = loadTs("lib/countdown.ts");

test("formatVND handles numbers, numeric strings and junk", () => {
  assert.equal(f.formatVND(50000000), "50.000.000 ₫");
  assert.equal(f.formatVND(0), "0 ₫");
  assert.equal(f.formatVND(-1500), "-1.500 ₫");
  assert.equal(f.formatVND(1234.6), "1.235 ₫");
  assert.equal(f.formatVND("1500000"), "1.500.000 ₫");
  for (const bad of [null, undefined, "abc", NaN, ""]) assert.equal(f.formatVND(bad), "—");
});

test("formatVNDShort", () => {
  assert.equal(f.formatVNDShort(3482600000), "3,48 tỷ");
  assert.equal(f.formatVNDShort(3000000000), "3 tỷ");
  assert.equal(f.formatVNDShort(3500000000), "3,5 tỷ");
  assert.equal(f.formatVNDShort(850000000), "850 triệu");
  assert.equal(f.formatVNDShort(12500000), "12,5 triệu");
  assert.equal(f.formatVNDShort(950000), "950.000 ₫");
  assert.equal(f.formatVNDShort(null), "—");
});

test("parseVND and formatNumberVN", () => {
  assert.equal(f.parseVND("50.000.000 ₫"), 50000000);
  assert.equal(f.parseVND("0"), 0);
  assert.equal(f.parseVND(""), null);
  assert.equal(f.parseVND("abc"), null);
  assert.equal(f.formatNumberVN(50000000), "50.000.000");
});

test("dates are local, invalid input is a dash", () => {
  const d = new Date(2026, 8, 30, 10, 42);
  assert.equal(f.formatDate(d), "30/09/2026");
  assert.equal(f.formatDateTime(d), "10:42 30/09/2026");
  assert.equal(f.formatDate(d.toISOString()), "30/09/2026");
  assert.equal(f.formatDate(d.getTime()), "30/09/2026");
  for (const bad of [null, undefined, "not a date", ""]) assert.equal(f.formatDate(bad), "—");
});

test("maskPhone and getInitials", () => {
  assert.equal(f.maskPhone("0912345486"), "0912 *** 486");
  assert.equal(f.maskPhone("12345"), "12345");
  assert.equal(f.maskPhone(""), "");
  assert.equal(f.maskPhone(null), "");
  assert.equal(f.getInitials("Nguyễn Minh Anh"), "MA");
  assert.equal(f.getInitials("  trần   hoàng "), "TH");
  assert.equal(f.getInitials("An"), "A");
  assert.equal(f.getInitials(""), "?");
});

test("countdown", () => {
  const now = Date.UTC(2026, 8, 30, 3, 0, 0);
  assert.equal(c.remainingSeconds(new Date(now + 892000).toISOString(), now), 892);
  assert.equal(c.remainingSeconds(now - 5000, now), 0);
  assert.equal(c.remainingSeconds(null, now), null);
  assert.equal(c.remainingSeconds("garbage", now), null);
  assert.equal(c.formatCountdown(892), "14:52");
  assert.equal(c.formatCountdown(0), "00:00");
  assert.equal(c.formatCountdown(-5), "00:00");
  assert.equal(c.formatCountdown(3725), "1:02:05");
  assert.equal(c.countdownTone(null), "none");
  assert.equal(c.countdownTone(0), "expired");
  assert.equal(c.countdownTone(179), "urgent");
  assert.equal(c.countdownTone(180), "normal");
});

test("foldVietnamese strips diacritics and đ for accent-insensitive search", () => {
  assert.equal(f.foldVietnamese("Hà Nội"), "ha noi");
  assert.equal(f.foldVietnamese("Sàn Đông Đô"), "san dong do");
  assert.equal(f.foldVietnamese("NGUYỄN"), "nguyen");
  assert.equal(f.foldVietnamese(""), "");
});

test("formatArea keeps up to 2 decimals with a Vietnamese comma", () => {
  assert.equal(f.formatArea(73.9), "73,9 m²");
  assert.equal(f.formatArea(70), "70 m²");
  assert.equal(f.formatArea("1250"), "1.250 m²");
  assert.equal(f.formatArea(73.456), "73,46 m²");
  for (const bad of [null, undefined, "", "abc"]) assert.equal(f.formatArea(bad), "—");
});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const a = loadTs("lib/agencySan.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

const SAN = "46c33dd4-c311-4769-8333-01b78e2f7a32";
const OTHER = "23a7bca0-e282-40a9-b69f-58c96a9ee753";
const list = [
  { ID: OTHER, MaSan: "MEG", TenSan: "SÀN MEGAN" },
  { ID: SAN, MaSan: SAN, TenSan: "SÀN BEELAND" },
];

test("agencySanId: chỉ tài khoản AGENCY có sàn, sàn = branch_id hợp lệ (uuid)", () => {
  assert.equal(a.agencySanId("AGENCY", SAN), SAN);
  assert.equal(a.agencySanId("agency", ` ${SAN} `), SAN);
  assert.equal(a.agencySanId("SYSTEM", SAN), null);
  assert.equal(a.agencySanId("AGENCY", ""), null);
  assert.equal(a.agencySanId("AGENCY", "408"), null);
});

test("bookingSan nội bộ: giữ sàn người dùng chọn (kể cả không qua sàn)", () => {
  const picked = list[0];
  assert.deepEqual(plain(a.bookingSan({ isAgency: false, agencySan: null, selected: picked, sanList: list })), { ok: true, san: picked });
  assert.deepEqual(plain(a.bookingSan({ isAgency: false, agencySan: null, selected: null, sanList: list })), { ok: true, san: null });
});

test("bookingSan đại lý: luôn là sàn của tài khoản, bỏ qua sàn khác được truyền vào (như web enforceAgencySan)", () => {
  const r = plain(a.bookingSan({ isAgency: true, agencySan: SAN, selected: list[0], sanList: list }));
  assert.deepEqual(r, { ok: true, san: { ID: SAN, MaSan: SAN, TenSan: "SÀN BEELAND" } });
  const noName = plain(a.bookingSan({ isAgency: true, agencySan: SAN, selected: null, sanList: [] }));
  assert.deepEqual(noName, { ok: true, san: { ID: SAN, MaSan: SAN, TenSan: "Sàn của tài khoản" } });
});

test("bookingSan đại lý không xác định được sàn: chặn tạo (không gửi sàn khác / không qua sàn)", () => {
  const r = plain(a.bookingSan({ isAgency: true, agencySan: null, selected: list[0], sanList: list }));
  assert.equal(r.ok, false);
  assert.match(r.message, /sàn/i);
});

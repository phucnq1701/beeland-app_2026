const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const s = loadTs("lib/signing.ts");
const plain = (v) => JSON.parse(JSON.stringify(v));

// Nguồn web: beeland/src/pages/sales/giao-dich/dat-lich-ky/types.ts + services/SigningAppointmentCloudService.ts

test("statusMeta: 3 trạng thái, mặc định Chờ xác nhận", () => {
  assert.equal(s.statusMeta("CONFIRMED").label, "Đã xác nhận");
  assert.equal(s.statusMeta("rejected").label, "Từ chối");
  assert.equal(s.statusMeta(null).label, "Chờ xác nhận");
  assert.equal(s.statusMeta("lạ").value, "PENDING");
});

test("toVNStore giữ nguyên giờ đã nhập theo +07:00", () => {
  assert.equal(s.toVNStore("2026-10-05T08:30"), "2026-10-05T08:30:00+07:00");
  assert.equal(s.toVNStore("2026-10-05 13:30:15"), "2026-10-05T13:30:15+07:00");
  assert.equal(s.toVNStore(""), null);
  assert.equal(s.toVNStore(null), null);
});

test("fromVNStore đọc ra giờ VN dạng naive", () => {
  assert.equal(s.fromVNStore("2026-10-05T01:30:00+00:00"), "2026-10-05T08:30:00");
  assert.equal(s.fromVNStore("2026-10-04T20:00:00Z"), "2026-10-05T03:00:00");
  assert.equal(s.fromVNStore(null), null);
});

test("ngày/giờ VN, cộng ngày", () => {
  assert.equal(s.dateKey("2026-10-05T08:30:00"), "2026-10-05");
  assert.equal(s.timeOf("2026-10-05T08:30:00"), "08:30");
  assert.equal(s.addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(s.addDays("2026-03-01", -1), "2026-02-28");
  // 2026-10-04 17:30Z = 05/10 00:30 giờ VN
  assert.equal(s.todayVN(Date.UTC(2026, 9, 4, 17, 30)), "2026-10-05");
  assert.deepEqual(plain(s.quickDays("2026-10-30", 3)), ["2026-10-30", "2026-10-31", "2026-11-01"]);
});

test("monthGrid: 42 ô, bắt đầu từ Thứ 2", () => {
  const g = s.monthGrid("2026-10-15");
  assert.equal(g.length, 42);
  // 01/10/2026 là Thứ 5 → ô đầu là Thứ 2 28/09
  assert.equal(g[0], "2026-09-28");
  assert.equal(g[3], "2026-10-01");
  assert.equal(s.weekdayIndex("2026-10-05"), 0); // Thứ 2
  assert.equal(s.weekdayIndex("2026-10-11"), 6); // Chủ nhật
});

test("mapListRow theo fn_signing_appointment_list", () => {
  const r = s.mapListRow({
    seq: 12,
    id: "u-1",
    state: "confirmed",
    is_personal: true,
    ngay_book_ky: "2026-09-24T03:00:00+00:00",
    ma_can: "A1-12B09",
    ten_kh: "Nguyễn Thị Tám",
    so_giay_to: "0123",
    dien_thoai: "0909",
    ten_san: "BEELAND",
    ma_phan_loai_kh: 1,
    la_chuyen_khoan: true,
    co_bao_lanh: false,
    ten_ca: "Ca sáng 1 (08:00-10:00)",
    project_id: "p-1",
  });
  assert.equal(r.ID, 12);
  assert.equal(r.UID, "u-1");
  assert.equal(r.State, "CONFIRMED");
  assert.equal(r.NgayBookKy, "2026-09-24T10:00:00");
  assert.equal(r.PhanLoai, "Khách hàng cá nhân");
  assert.equal(r.HinhThucTT, "Chuyển khoản");
  assert.equal(r.BaoLanh, "Không bảo lãnh");
  assert.equal(r.SoGiayTo, "0123");
  assert.equal(r.DaiLy, "BEELAND");
  assert.equal(r.MaDA, "p-1");
});

test("mapDeposit theo fn_signing_deposit_search", () => {
  const d = s.mapDeposit({
    id: "pgc-1",
    so_phieu: "DC-1",
    so_phieu_gc: "BK-1",
    project_id: "p",
    san_pham_id: "sp",
    ma_can: "A1-01",
    khach_hang_id: "kh",
    ten_kh: "An",
    is_personal: false,
    san_id: "san",
    ten_san: "Sàn A",
    co_owners: [{ MaKH: "kh2" }],
  });
  assert.equal(d.MaPGC, "pgc-1");
  assert.equal(d.SoPhieu, "DC-1");
  assert.equal(d.MaCan, "A1-01");
  assert.equal(d.KhachHang, "An");
  assert.equal(d.IsPersonal, false);
  assert.equal(d.CoOwners.length, 1);
});

test("groupByDay cho chế độ lịch", () => {
  const g = s.groupByDay([
    { ID: 1, NgayBookKy: "2026-10-05T08:00:00" },
    { ID: 2, NgayBookKy: "2026-10-05T10:00:00" },
    { ID: 3, NgayBookKy: null },
  ]);
  assert.equal(g.byDay["2026-10-05"].length, 2);
  assert.equal(g.noDate.length, 1);
});

test("fileUrl: giữ URL đầy đủ, link tương đối → upload.beesky.vn; nhận diện ảnh", () => {
  assert.equal(s.fileUrl("https://r2.x/a.pdf"), "https://r2.x/a.pdf");
  assert.equal(s.fileUrl("/uploads/a.jpg"), "https://upload.beesky.vn/uploads/a.jpg");
  assert.equal(s.fileUrl(""), "");
  assert.equal(s.isImageFile("a.JPG?x=1"), true);
  assert.equal(s.isImageFile("a.pdf"), false);
  assert.equal(s.fileExt("Hop dong.PDF"), "pdf");
});

test("sortForAgenda: sắp tới (gần nhất trước) rồi đã qua (mới nhất trước), chưa có ngày cuối", () => {
  const rows = [
    { id: "a", NgayBookKy: "2026-11-10T08:00:00" },
    { id: "b", NgayBookKy: "2026-11-19T08:00:00" },
    { id: "c", NgayBookKy: null },
    { id: "d", NgayBookKy: "2026-11-17T13:30:00" },
    { id: "e", NgayBookKy: "2026-11-14T08:00:00" },
    { id: "f", NgayBookKy: "2026-11-17T08:00:00" },
  ];
  assert.deepEqual(plain(s.sortForAgenda(rows, "2026-11-17").map((r) => r.id)), ["f", "d", "b", "e", "a", "c"]);
});

test("dayLabel: Hôm nay / Ngày mai / Hôm qua, còn lại thứ + ngày (khác năm mới thêm năm); shiftShort bỏ giờ trong ngoặc", () => {
  assert.equal(s.dayLabel("2026-11-17", "2026-11-17"), "Hôm nay");
  assert.equal(s.dayLabel("2026-11-18", "2026-11-17"), "Ngày mai");
  assert.equal(s.dayLabel("2026-11-16", "2026-11-17"), "Hôm qua");
  assert.equal(s.dayLabel("2026-11-19", "2026-11-17"), "T5, 19/11");
  assert.equal(s.dayLabel("2026-11-22", "2026-11-17"), "CN, 22/11");
  assert.equal(s.dayLabel("2027-01-04", "2026-11-17"), "T2, 04/01/2027");
  assert.equal(s.dayLabel("", "2026-11-17"), "");
  assert.equal(s.shiftShort("Ca sáng 1 (08:00-10:00)"), "Ca sáng 1");
  assert.equal(s.shiftShort("Ca chiều"), "Ca chiều");
  assert.equal(s.shiftShort(null), "");
});

test("agendaSections: nhãn Sắp tới ở dòng đầu, Đã qua ở dòng đã qua đầu tiên", () => {
  const rows = s.sortForAgenda(
    [
      { id: "a", NgayBookKy: "2026-11-10T08:00:00" },
      { id: "b", NgayBookKy: "2026-11-19T08:00:00" },
      { id: "c", NgayBookKy: null },
    ],
    "2026-11-17"
  );
  assert.deepEqual(plain(s.agendaSections(rows, "2026-11-17")), { 0: "Sắp tới", 1: "Đã qua" });
  assert.deepEqual(plain(s.agendaSections([{ NgayBookKy: "2026-11-10T08:00:00" }], "2026-11-17")), { 0: "Đã qua" });
  assert.deepEqual(plain(s.agendaSections([], "2026-11-17")), {});
});

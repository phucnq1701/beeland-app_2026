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

test("ngày/giờ VN, cộng ngày, ghép giờ ca", () => {
  assert.equal(s.dateKey("2026-10-05T08:30:00"), "2026-10-05");
  assert.equal(s.timeOf("2026-10-05T08:30:00"), "08:30");
  assert.equal(s.addDays("2026-10-31", 1), "2026-11-01");
  assert.equal(s.addDays("2026-03-01", -1), "2026-02-28");
  // 2026-10-04 17:30Z = 05/10 00:30 giờ VN
  assert.equal(s.todayVN(Date.UTC(2026, 9, 4, 17, 30)), "2026-10-05");
  assert.deepEqual(plain(s.quickDays("2026-10-30", 3)), ["2026-10-30", "2026-10-31", "2026-11-01"]);
  assert.equal(s.withTime("2026-10-05", "13:30"), "2026-10-05T13:30:00");
  assert.equal(s.withTime("2026-10-05", ""), "2026-10-05T00:00:00");
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

test("phân loại khách theo phiếu: có đồng đứng tên → 2, doanh nghiệp → 3, còn lại 1", () => {
  assert.equal(s.phanLoaiFromDeposit({ IsPersonal: true }, 1), 2);
  assert.equal(s.phanLoaiFromDeposit({ IsPersonal: false }, 0), 3);
  assert.equal(s.phanLoaiFromDeposit({ IsPersonal: true }, 0), 1);
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
  assert.equal(s.depositLabel(d), "DC-1 | An | A1-01");
});

test("shiftOptions: chỉ ca còn lượt + giữ ca đang chọn; ca sắp hết", () => {
  const slots = [
    { id: "a", name: "Ca 1", from: "08:00", to: "10:00", capacity: 10, used: 10, remaining: 0 },
    { id: "b", name: "Ca 2", from: "10:00", to: "12:00", capacity: 10, used: 8, remaining: 2 },
  ];
  assert.deepEqual(plain(s.shiftOptions(slots, null, null).map((o) => o.id)), ["b"]);
  assert.deepEqual(plain(s.shiftOptions(slots, "a", null).map((o) => o.id)), ["a", "b"]);
  const kept = s.shiftOptions(slots, "x", "Ca cũ (07:00-08:00)");
  assert.equal(kept[0].id, "x");
  assert.equal(kept[0].slot, null);
  assert.equal(s.isLowSlot(slots[1]), true);
  assert.equal(s.isLowSlot({ capacity: 10, remaining: 5 }), false);
});

test("availability: tổng sức chứa ca có thủ tục trừ lượt đã đặt (bỏ Từ chối)", () => {
  const shifts = [
    { id: "a", is_active: true, so_khach: 3, procedure_ids: ["p1"] },
    { id: "b", is_active: true, so_khach: 2, procedure_ids: ["p2"] },
    { id: "c", is_active: false, so_khach: 5, procedure_ids: ["p1"] },
  ];
  const appts = [
    { ca_lam_viec_id: "a", ngay_book_ky: "2026-10-05T01:00:00Z", state: "PENDING" },
    { ca_lam_viec_id: "a", ngay_book_ky: "2026-10-05T02:00:00Z", state: "REJECTED" },
    { ca_lam_viec_id: "b", ngay_book_ky: "2026-10-05T02:00:00Z", state: "PENDING" },
    { ca_lam_viec_id: "a", ngay_book_ky: "2026-10-06T02:00:00Z", state: "CONFIRMED" },
  ];
  const out = s.availabilityFrom(shifts, appts, "p1", ["2026-10-05", "2026-10-06", "2026-10-07"]);
  assert.deepEqual(plain(out), { "2026-10-05": 2, "2026-10-06": 2, "2026-10-07": 3 });
  assert.deepEqual(plain(s.availabilityFrom(shifts, appts, null, ["2026-10-05"])), {});
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

test("buildUpsertPayload như web toRow + upcert", () => {
  const p = s.buildUpsertPayload(
    {
      ID: 7,
      State: "confirmed",
      MaDA: "11111111-1111-1111-1111-111111111111",
      MaPGC: "22222222-2222-2222-2222-222222222222",
      MaSP: "33333333-3333-3333-3333-333333333333",
      MaKH: "44444444-4444-4444-4444-444444444444",
      MaSan: "55555555-5555-5555-5555-555555555555",
      IsPersonal: true,
      NgayBookKy: "2026-10-05T08:00:00",
      MaPhanLoaiKH: 2,
      MaPhuongAnTT: "TRA_THANG",
      LaChuyenKhoan: false,
      CoBaoLanh: null,
      MaCa: "66666666-6666-6666-6666-666666666666",
      LoaiThuTuc: "not-uuid",
      DongSoHuuIds: ["77777777-7777-7777-7777-777777777777", "x"],
      GhiChu: "",
      TaiLieu: [{ fileName: "a.jpg", url: "u" }],
    },
    {
      tenantId: "88888888-8888-8888-8888-888888888888",
      employeeId: "99999999-9999-9999-9999-999999999999",
      agencySanId: null,
      actorId: "NV01",
      actorName: "An",
    }
  );
  assert.equal(p.seq, 7);
  assert.equal(p.state, "CONFIRMED");
  assert.equal(p.ma_ctdk_uid, "88888888-8888-8888-8888-888888888888");
  assert.equal(p.nguoi_nhap_id, "99999999-9999-9999-9999-999999999999");
  assert.equal(p.ngay_book_ky, "2026-10-05T08:00:00+07:00");
  assert.equal(p.is_personal, true);
  // Web lưu num(): mã phương án dạng chữ → null
  assert.equal(p.ma_phuong_an_tt, null);
  assert.equal(p.la_chuyen_khoan, false);
  assert.equal(p.co_bao_lanh, null);
  assert.equal(p.loai_thu_tuc_id, null);
  assert.deepEqual(plain(p.dong_so_huu_ids), ["77777777-7777-7777-7777-777777777777"]);
  assert.equal(p.actor_id, "NV01");
  assert.equal(p.tai_lieu.length, 1);
  // Đại lý đăng nhập: sàn luôn là sàn của tài khoản
  const q = s.buildUpsertPayload(
    { MaSan: "55555555-5555-5555-5555-555555555555", IsPersonal: false },
    { tenantId: "t", employeeId: "", agencySanId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", actorId: "", actorName: "" }
  );
  assert.equal(q.san_id, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
  assert.equal(q.seq, null);
  assert.equal(q.state, "PENDING");
  assert.equal(q.is_personal, false);
  assert.equal(q.ma_ctdk_uid, null);
});

test("coOwnerIdsToSave: chỉ cá nhân + phân loại đồng sở hữu", () => {
  const list = [{ MaKH: "a" }, { MaKH: null }, { MaKH: "b" }];
  assert.deepEqual(plain(s.coOwnerIdsToSave(true, 2, list)), ["a", "b"]);
  assert.deepEqual(plain(s.coOwnerIdsToSave(true, 1, list)), []);
  assert.deepEqual(plain(s.coOwnerIdsToSave(false, 2, list)), []);
});

test("missingRequired: bỏ trường ẩn, trường ngoài danh mục; nhãn theo danh mục", () => {
  const values = { MaPGC: "x", NgayBookKy: null, GhiChu: "  ", DongSoHuu: [] };
  const out = s.missingRequired(["MaPGC", "NgayBookKy", "GhiChu", "DongSoHuu", "Khac", "MaSan"], new Set(["MaSan"]), values);
  assert.deepEqual(plain(out.map((m) => m.label)), ["Ngày giờ book ký", "Ghi chú", "Đồng sở hữu"]);
  assert.equal(s.signingFormKey(true), "agency_signing");
  assert.equal(s.signingFormKey(false), "signing");
});

test("canQuerySlots cần đủ ngày, phiếu, loại thủ tục", () => {
  assert.equal(s.canQuerySlots({ NgayBookKy: "2026-10-05T08:00:00", MaPGC: "p", LoaiThuTuc: "l" }), true);
  assert.equal(s.canQuerySlots({ NgayBookKy: "2026-10-05T08:00:00", MaPGC: "p" }), false);
});

test("fileUrl: giữ URL đầy đủ, link tương đối → upload.beesky.vn; nhận diện ảnh", () => {
  assert.equal(s.fileUrl("https://r2.x/a.pdf"), "https://r2.x/a.pdf");
  assert.equal(s.fileUrl("/uploads/a.jpg"), "https://upload.beesky.vn/uploads/a.jpg");
  assert.equal(s.fileUrl(""), "");
  assert.equal(s.isImageFile("a.JPG?x=1"), true);
  assert.equal(s.isImageFile("a.pdf"), false);
  assert.equal(s.fileExt("Hop dong.PDF"), "pdf");
});

test("requiredValues: gộp form + hồ sơ khách theo key cấu hình web", () => {
  const v = s.requiredValues(
    { MaPGC: "p", LaChuyenKhoan: false, CoBaoLanh: null, CoOwners: [{ MaKH: "a" }] },
    { tenKH: "An", cccd: "012", dien_thoai: "09", thuong_tru: "HN", dia_chi: "", nguoi_dai_dien_pl: "B", ma_so_thue_ct: "MST" }
  );
  assert.equal(v.TenKH, "An");
  assert.equal(v.SoCMND, "012");
  assert.equal(v.DiaChiTT, "HN");
  assert.equal(v.DiaChiLH, "");
  assert.equal(v.NguoiDaiDien, "B");
  assert.equal(v.MST, "MST");
  assert.equal(v.DongSoHuu.length, 1);
  // Như web: key cấu hình MaHinhThucTT / MaBaoLanh không có trong form → luôn báo thiếu
  const miss = s.missingRequired(["MaHinhThucTT", "MaBaoLanh"], new Set(), v);
  assert.deepEqual(plain(miss.map((m) => m.key)), ["MaHinhThucTT", "MaBaoLanh"]);
});

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { loadTs } = require("./helpers/loadTs.cjs");

const signing = loadTs("lib/signing.ts");
const r = loadTs("lib/customerRequest.ts", { modules: { "./signing": signing } });
const plain = (v) => JSON.parse(JSON.stringify(v));

// Nguồn web: beeland/src/services/CustomerRequest.js, src/lib/customerRequestRefs.ts,
// src/lib/customerRequestCatalogs.ts; máy chủ: scripts/selfhost/0140_cloud_customer_requests.sql (_ccr_json).

test("catKey: rỗng / null / NaN → null, còn lại chuỗi đã trim", () => {
  assert.equal(r.catKey(null), null);
  assert.equal(r.catKey(""), null);
  assert.equal(r.catKey("  "), null);
  assert.equal(r.catKey(Number.NaN), null);
  assert.equal(r.catKey(1), "1");
  assert.equal(r.catKey(" new "), "new");
});

test("mapCatalog: ID = raw.ID ?? item_code ?? mã theo loại ?? Code (như _ccr_json), mục cố định lên đầu", () => {
  const rows = [
    { id: "u1", item_code: "Moi", item_name: "Mới", raw: { ID: null, Name: "Mới", Color: "blue" } },
    { id: "u2", item_code: "processing", item_name: "Đang xử lý", raw: { ID: null, Color: "orange", GhiChu: "x" } },
    { id: "u3", item_code: "new", item_name: "Mới tiếp nhận", raw: { ID: null, Color: "blue" } },
    { id: "u4", item_code: null, item_name: null, raw: { ID: 7, State: "old", Name: "Cũ" } },
    { id: "u5", item_code: "new", item_name: "Trùng mã", raw: {} },
  ];
  const out = plain(r.mapCatalog(rows, "dm_trang_thai_yeu_cau"));
  assert.deepEqual(
    out.map((c) => c.ID),
    ["new", "processing", "Moi", "7"],
  );
  assert.deepEqual(out[0], { ID: "new", Name: "Mới tiếp nhận", Color: "blue", GhiChu: null });
  assert.equal(out[1].GhiChu, "x");
  assert.equal(out[3].Name, "Cũ");
});

test("mapCatalog: không có dữ liệu → bộ cố định của web (chỉ đọc, không ghi)", () => {
  const out = plain(r.mapCatalog([], "dm_uu_tien_yeu_cau"));
  assert.deepEqual(out.map((c) => c.ID), ["low", "normal", "high", "urgent"]);
  assert.equal(out[3].Color, "red");
  assert.equal(plain(r.mapCatalog(null, "dm_loai_yeu_cau")).length, 8);
});

test("fromApiItem: map trường _ccr_json → app", () => {
  const it = r.fromApiItem({
    ID: "a1",
    MaYC: "YC261007-0001",
    MaKH: "k1",
    TenKH: "Nguyễn A",
    DienThoai: "0901",
    Email: "a@x.vn",
    MaDA: "DA01",
    ProjectId: "p-uuid",
    TenDA: "Dự án A",
    MaHD: "pgc-uuid",
    TieuDe: "Hỏi tiến độ",
    NoiDung: "Nội dung",
    MaLoai: "consult",
    TenLoai: "Tư vấn – hỏi đáp",
    MaNguon: "app",
    TenNguon: "App khách hàng",
    MucUuTien: "high",
    TenUuTien: "Cao",
    State: "new",
    TenTrangThai: "Mới tiếp nhận",
    ThoiHan: "2026-10-08T03:00:00+00:00",
    MaNVTN: "NV01",
    TenNVTN: "Lan",
    MaNVXL: "NV02",
    HoTenNVXL: "Minh",
    GhiChu: "nội bộ",
    ListAttach: ["drive-files:bee/yeu-cau/k1/x.jpg", "", null],
    NgayTao: "2026-10-07T01:00:00+00:00",
    NgayCapNhat: "2026-10-07T02:00:00+00:00",
  });
  assert.equal(it.id, "a1");
  assert.equal(it.code, "YC261007-0001");
  assert.equal(it.projectCode, "DA01");
  assert.equal(it.projectUuid, "p-uuid");
  assert.equal(it.contractId, "pgc-uuid");
  assert.equal(it.status, "new");
  assert.equal(it.statusName, "Mới tiếp nhận");
  assert.equal(it.receiverId, "NV01");
  assert.equal(it.assigneeName, "Minh");
  assert.equal(it.internalNote, "nội bộ");
  assert.deepEqual(plain(it.attachments), ["drive-files:bee/yeu-cau/k1/x.jpg"]);
});

test("fromApiItem: thiếu mã YC → YC + 5 số như web; thiếu dữ liệu không lỗi", () => {
  const it = r.fromApiItem({ ID: "12", State: null, ListAttach: null });
  assert.equal(it.code, "YC00012");
  assert.equal(it.status, null);
  assert.deepEqual(plain(it.attachments), []);
});

test("toStored: URL ký drive-files → 'drive-files:<path>'; URL khác giữ nguyên", () => {
  assert.equal(
    r.toStored("https://api-beelandv2.beesky.vn/storage/v1/object/sign/drive-files/bee/yeu-cau/k%201/a.jpg?token=abc"),
    "drive-files:bee/yeu-cau/k 1/a.jpg",
  );
  assert.equal(r.toStored("drive-files:x/y.png"), "drive-files:x/y.png");
  assert.equal(r.toStored("https://cdn.x/a.pdf"), "https://cdn.x/a.pdf");
  assert.equal(r.isStoredFile("drive-files:x/y.png"), true);
  assert.equal(r.storedPath("drive-files:x/y.png"), "x/y.png");
  assert.equal(r.attachmentName("drive-files:bee/yeu-cau/k1/a%20b.jpg"), "a b.jpg");
});

test("toApiPayload: cùng khoá JSON kiểu cũ web gửi fn_customer_request_save", () => {
  const p = plain(
    r.toApiPayload({
      id: "a1",
      projectCode: "DA01",
      contractId: "pgc-uuid",
      customerId: "k1",
      customerName: " Nguyễn A ",
      customerPhone: "0901",
      customerEmail: "",
      title: "  Hỏi tiến độ ",
      content: "",
      category: "consult",
      source: null,
      priority: "high",
      status: "new",
      dueDate: "2026-10-08T10:00:00",
      receiverId: "NV01",
      assigneeId: null,
      internalNote: "",
      attachments: [
        "https://api-beelandv2.beesky.vn/storage/v1/object/sign/drive-files/a/b.jpg?token=1",
        "https://cdn.x/c.pdf",
      ],
    }),
  );
  assert.deepEqual(p, {
    ID: "a1",
    MaKH: "k1",
    MaHD: "pgc-uuid",
    TenKH: "Nguyễn A",
    DienThoai: "0901",
    Email: null,
    TieuDe: "Hỏi tiến độ",
    NoiDung: null,
    MaLoai: "consult",
    MaNguon: null,
    MucUuTien: "high",
    State: "new",
    ThoiHan: "2026-10-08T10:00:00+07:00",
    MaNVTN: "NV01",
    MaNVXL: null,
    GhiChu: null,
    MaDA: "DA01",
    ListAttach: ["drive-files:a/b.jpg", "https://cdn.x/c.pdf"],
  });
  assert.equal(r.toApiPayload({ title: "x" }).ID, null);
});

test("validateRequestForm: bắt buộc dự án, tên khách, tiêu đề (như form web)", () => {
  assert.deepEqual(plain(r.validateRequestForm({ projectCode: "", customerName: " ", title: "" })), {
    projectCode: "Vui lòng chọn dự án",
    customerName: "Vui lòng nhập tên khách hàng",
    title: "Vui lòng nhập tiêu đề",
  });
  assert.deepEqual(plain(r.validateRequestForm({ projectCode: "DA01", customerName: "A", title: "B" })), {});
});

test("isOverdue: quá hạn khi hạn đã qua và chưa Đã xử lý / Đã đóng / Đã huỷ (như báo cáo web)", () => {
  const now = Date.parse("2026-10-07T05:00:00Z");
  assert.equal(r.isOverdue({ dueDate: "2026-10-07T04:00:00Z", status: "processing" }, now), true);
  assert.equal(r.isOverdue({ dueDate: "2026-10-07T04:00:00Z", status: null }, now), true);
  assert.equal(r.isOverdue({ dueDate: "2026-10-07T04:00:00Z", status: "completed" }, now), false);
  assert.equal(r.isOverdue({ dueDate: "2026-10-07T04:00:00Z", status: "closed" }, now), false);
  assert.equal(r.isOverdue({ dueDate: "2026-10-07T04:00:00Z", status: "cancelled" }, now), false);
  assert.equal(r.isOverdue({ dueDate: "2026-10-07T06:00:00Z", status: "new" }, now), false);
  assert.equal(r.isOverdue({ dueDate: null, status: "new" }, now), false);
});

test("mapLog: dòng fn_customer_request_logs", () => {
  const l = plain(
    r.mapLog({ ID: "l1", State: "processing", Name: "Đang xử lý", Color: "orange", NoiDung: "Đã gọi", NgayXL: "2026-10-07T01:00:00Z", HoTen: "Lan" }),
  );
  assert.deepEqual(l, {
    id: "l1",
    status: "processing",
    statusName: "Đang xử lý",
    color: "orange",
    note: "Đã gọi",
    at: "2026-10-07T01:00:00Z",
    by: "Lan",
  });
  assert.equal(r.mapLog({ ID: "l2", Color: "blue" }).statusName, null);
});

test("projectValueOf: MaDA cũ (mã hoặc uuid) → uuid dự án của ô chọn; saveCode → mã dự án", () => {
  const projects = [
    { id: "p1", ma_da_code: "DA01" },
    { id: "p2", ma_da_code: null },
  ];
  assert.equal(r.projectValueOf(projects, "DA01", null), "p1");
  assert.equal(r.projectValueOf(projects, "p2", "p2"), "p2");
  assert.equal(r.projectValueOf(projects, "zzz", "p1"), "p1");
  assert.equal(r.projectValueOf(projects, null, null), null);
  assert.equal(r.projectValueOf(projects, "lạ", null), null);
  assert.equal(r.projectSaveCode(projects, "p1"), "DA01");
  assert.equal(r.projectSaveCode(projects, "p2"), "p2");
  assert.equal(r.projectSaveCode(projects, null), null);
});

test("timeOptions + splitDue/joinDue: hạn xử lý ngày + giờ (giờ VN)", () => {
  const opts = plain(r.timeOptions());
  assert.equal(opts.length, 48);
  assert.equal(opts[0].value, "00:00");
  assert.equal(opts[35].value, "17:30");
  assert.deepEqual(plain(r.splitDue("2026-10-08T10:15:00+00:00")), { day: "2026-10-08", time: "17:15" });
  assert.deepEqual(plain(r.splitDue(null)), { day: null, time: null });
  assert.equal(r.joinDue("2026-10-08", "17:15"), "2026-10-08T17:15:00");
  assert.equal(r.joinDue("2026-10-08", null), "2026-10-08T17:00:00");
  assert.equal(r.joinDue(null, "10:00"), null);
});

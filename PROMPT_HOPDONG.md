# PROMPT HỎI AI WEB — MODULE HỢP ĐỒNG (HDMB)

> Mục đích: lấy đầy đủ chi tiết backend cloud (Supabase REST + RPC) của module **Hợp đồng**
> trên web để clone sang app mobile (React Native / Expo).
> Cách làm **giống hệt đã làm cho module ĐẶT CỌC** (đã có `fn_deposit_list`,
> `cloud_pgc_phieu_giucho giai_doan='DATCOC'`, `cloud_catalogs catalog_type='pgc_trang_thai'`,
> `cloud_catalogs catalog_type='lich_tt_hd'`, `cloud_cash_voucher_details loai_phieu='THU'`).
> Vì vậy hãy trả lời **cùng độ chi tiết, cùng format** như bên đặt cọc.

---

## 0. BỐI CẢNH / CONTEXT

App mobile đang gọi lại đúng dữ liệu mà web đang hiển thị, thông qua:
- `axiosApiSupabase` (Supabase REST `rest/v1/...`) + RPC (`rest/v1/rpc/<fn_name>`).
- Tenant UUID lấy từ claim `company_id` trong JWT → truyền vào tham số `p_ma_ctdk_uid`
  (giống `p_ma_ctdk_uid` của `fn_deposit_list`).
- Dự án filter: `ma_da_code` (text) phải resolve sang `da_projects.id` (uuid) trước khi gọi RPC
  (giống `resolveProjectUuids` bên đặt cọc).

Hiện tại app mobile đang dùng API cũ (sai):
- `POST api/admin/ListHopDong`
- `POST api/admin/ChiTietLichTT`
- `POST api/admin/ChiTietThuChi`

Mình cần **thay bằng cloud RPC/table giống web**. Dưới đây là các màn hình web tương ứng
để bạn đối chiếu (mô tả từ screenshot web):

### A) Màn "DS Hợp đồng" (danh sách hợp đồng — tab trong module Hợp đồng)
Cột lưới theo thứ tự:
`STT | Ngày ký | Số HDMB | Mã sản phẩm | Tên KH | CMND | Di động | Trạng thái | Thao tác`
- Trạng thái hiển thị dạng chip màu, ví dụ "HĐMB chờ duyệt" (xanh lá).
- Thanh filter phía trên: ô tìm kiếm (tìm hợp đồng, khách hàng, sản phẩm...),
  chip dự án (vd "BRG Smart City"), dropdown loại ("Hợp đồng"),
  dropdown công ty, nút "Bộ lọc".
- Phân trang ở đáy: "7 sản phẩm", `< 1 >`, "50 / trang".
- Menu trái module Hợp đồng có các mục: HĐ Góp vốn, DS Hợp đồng, Xử lý, Phụ lục, Bàn giao,
  Sơ đồ, Vay ngân hàng.

### B) Màn "Chi tiết hợp đồng" (drawer/panel chi tiết)
Các tab (thanh ngang): **Lịch thanh toán**, Lịch thanh toán theo nguồn vốn, Biểu mẫu, Tài liệu,
Phiếu thu, Phiếu chi, Chuyển nhượng, Tài khoản định danh, Lịch sử hợp đồng, Phiếu tính giá.
Menu "..." có thêm "Phiếu tính giá".

Tab **Lịch thanh toán** — bảng:
`Đợt TT | Ngày | Tỷ lệ | Phải thu | Đã thu | Còn lại | Phải thu PBT | Đã thu PBT`
+ dòng **Tổng** cộng các cột tiền.
Ví dụ dữ liệu:
| Đợt TT | Ngày | T lệ | Phải thu | Đã thu | Còn lại | Phải thu PBT | Đã thu PBT |
|---|---|---|---|---|---|---|---|
| 1 | 26/09/2026 | 30% | 2.241.235.442 | 2.241.235.442 | -0 | 0 | 0 |
| 2 | 16/10/2026 | 40% | 2.988.313.922 | 50.000.000 | 2.938.313.922 | 0 | 0 |
| 3 | 15/11/2026 | 15% | 1.259.621.458 | 0 | 1.259.621.458 | 139.003.737 | 0 |
| 4 | 15/12/2026 | 15% | 1.120.617.721 | 0 | 1.120.617.721 | 0 | 0 |
| **Tổng** | | | 7.609.788.542 | 2.291.235.442 | 5.318.553.100 | 0 | 0 |

---

## 1. YÊU CẦU TRẢ LỜI (bắt buộc theo format)

Với **mỗi** hạng mục dưới đây, trả lời đủ 4 phần:
1. **Nguồn dữ liệu**: là RPC hay REST table? Tên chính xác (vd `fn_contract_list`)?
2. **Tham số / filter**: tên param, kiểu, ý nghĩa, giá trị mặc định, cách phân trang
   (0-based hay 1-based), tham số tenant/dự án/tìm kiếm/trạng thái.
3. **Bảng + cột liên quan**: tên bảng cloud (vd `cloud_contracts`, `cloud_pgc_phieu_giucho`,
   `cloud_contract_details`, `cloud_catalogs`, `cloud_cash_vouchers`...), tên cột snake_case
   và join (FK) giữa các bảng.
4. **Mapping ra UI**: cột nào của bảng → cột nào trên màn hình (nêu ở mục 0).

> Nếu có, **dán luôn định nghĩa SQL của RPC** (CREATE OR REPLACE FUNCTION ...) và **1 đoạn code
> JS/Supabase mẫu** web đang gọi (giống cách `fn_deposit_list` được gọi).

---

## 2. CÂU HỎI CHI TIẾT

### PHẦN A — DANH SÁCH HỢP ĐỒNG (DS Hp đồng)

**A1.** Web load danh sách hợp đồng bằng **RPC nào**? (nghi ngờ có `fn_contract_list` /
`fn_hopdong_list` / `fn_list_hopdong` — hãy xác nhận tên thật).
- Nếu là RPC: liệt kê **đầy đủ tham số** (giống `fn_deposit_list`:
  `p_ma_ctdk_uid, p_project_id, p_tu_ngay, p_den_ngay, p_input_search, p_ma_tt, p_offset, p_limit`).
- Nếu dùng REST trực tiếp: nêu tên bảng + query params (`select`, `order`, `limit`, `offset`).

**A2.** Bảng gốc của hợp đồng mua bán là gì? Xác nhận:
- Có phải dùng chung `cloud_pgc_phieu_giucho` với `giai_doan='HDMB'` (giống đặt cọc dùng
  `giai_doan='DATCOC'`) không? Hay có bảng riêng `cloud_contracts`?
- Bảng chi tiết/đợt thanh toán hợp đồng là bảng nào?

**A3.** Liệt kê **các cột trả về** của list và mapping sang lưới UI:
| Cột lưới UI | Cột dữ liệu (bảng.cột) | Ghi chú |
|---|---|---|
| Ngày ký | ? | |
| Số HDMB | ? | (app cũ dùng `soHDMB` / `so_phieu` / `so_hdmb`?) |
| Mã sản phẩm | ? | (app cũ dùng `maSP` / `ky_hieu`?) |
| Tên KH | ? | |
| CMND | ? | |
| Di động | ? | |
| Trạng thái | ? | (xem A4) |
| Màu trạng thái | ? | (cột color, giống `color_code`/`mau_nen`) |
| Giá trị hợp đồng | ? | (app cũ dùng `tongGiaGomVAT` / `gia_tri_hd_sau_ck`?) |
| Mã dự án | ? | |

**A4.** Trạng thái hợp đồng lấy từ đâu?
- Có phải `cloud_catalogs` với `catalog_type='<gì>'` không? (đặt cọc dùng `pgc_trang_thai`;
  hợp đồng có thể là `hdmb_trang_thai` / `contract_trang_thai` / `hd_trang_thai`).
- `ma_ctdk` scope là `'global'` hay theo tenant?
- Cột nào là mã trạng thái (item_code), tên (item_name), màu (color_code)?
- Danh sách các trạng thái hợp đồng (mã + tên + màu), ví dụ "HĐMB chờ duyệt".

**A5.** Bộ lọc ở đầu trang DS Hợp đồng:
- **Dự án** (chip "BRG Smart City"): web map sang tham số nào? có phải `p_project_id`
  (chuỗi uuid nối dấu phẩy, null = tất cả) giống `fn_deposit_list`?
- **Loại hợp đồng** ("Hp đồng"): giá trị này là gì (enum/hằng số)? ảnh hưởng tham số nào?
- **Công ty**: lọc thế nào (company_ids / branch_id)?
- **Bộ lọc** (nâng cao): gồm những tiêu chí nào (khoảng ngày, khu, sàn, nhân viên...)?
- Ô tìm kiếm: web search trên những cột nào? (tên KH, số HĐ, mã SP, CMND, điện thoại...)

**A6.** Phân trang: web gửi `offset`/`limit` thế nào? trang hiển thị "50 / trang" thì giá trị limit
mặc định là 50? RPC trả `total_count` ở đâu (giống `total_count` của `fn_deposit_list`)?

---

### PHẦN B — CHI TIẾT HỢP ĐỒNG (drawer "Chi tiết hợp đồng")

**B1. Header thông tin hợp đồng** — web lấy từ đâu (RPC detail hay đọc bảng theo id)?
Liệt kê các field đang hiển thị: Số HĐMB, Dự án, Khách hàng, Mã SP, Ngày ký, Giá trị HĐ,
Trạng thái, CMND/CCCD, Điện thoại, Email, Địa chỉ, Loại căn, Diện tích, Đơn giá...
→ với mỗi field: **bảng.cột** nguồn (vd `cloud_customers.ten_kh`, `bds_products.ma_sp`,
`cloud_pgc_phieu_giucho.dien_tich`, `...don_gia_gom_vat`).

**B2. Tab "Lịch thanh toán"** (bảng Đợt TT / Ngày / Tỷ lệ / Phải thu / Đã thu / Còn lại /
Phải thu PBT / Đã thu PBT):
- Nguồn là `cloud_catalogs catalog_type='lich_tt_hd'` với `parent_code = <id hợp đồng>` không?
  (đặt cọc dùng đúng cách này — hãy xác nhận cho hợp đồng).
- Hay là bảng riêng / JSONB `lich_thanh_toan` trên row?
- Cấu trúc `raw` (JSONB) gồm những key nào: `DotTT`, `NgayTT`, `TyLeTT`, `PhaiThu`, `DaThu`,
  `PhaiThuPBT`, `DaThuPBT`, `ConNoPBT`, `DienGiai`...?
- Cách web tính **"Đã thu"** cho từng đợt: có phải cộng từ phiếu thu rồi allocate
  (đổ đầy đợt 1 → đợt 2 → ... → PBT) giống `allocatePaidToSchedule` bên đặt cọc không?
- Dòng **Tổng** tính như thế nào?
- Tab **"Lịch thanh toán theo nguồn vốn"**: nguồn dữ liệu + ý nghĩa (khác gì tab Lịch thanh toán)?
  Cột hiển thị gồm gì?

**B3. Tab "Phiếu thu"**:
- Nguồn: `cloud_cash_voucher_details` lọc `loai_phieu='THU'` + khóa `hd_id`/`pgc_id` = id hợp đồng?
  → join `cloud_cash_vouchers` (`so_phieu, ngay_phieu, so_tien, dien_giai, nguoi_nop, hinh_thuc`).
- Cột hiển thị trên UI và mapping.

**B4. Tab "Phiếu chi"**:
- Khác phiếu thu ở `loai_phieu='CHI'`? Tên bảng/khóa join là gì?
- Cột hiển thị.

**B5. Tab "Biểu mẫu"**: dữ liệu lấy từ đâu (bảng templates/generated files)? Có cột nào?
**B6. Tab "Tài liệu"**: bảng nào (vd `cloud_documents`, `cloud_contract_files`...)?
  có `contract_id`, `loai_file`, `url`, `ten_file`, `ngay_tao`... không?
**B7. Tab "Chuyển nhượng"**: bảng/logic gì (bảng chuyển nhượng hợp đồng)?
**B8. Tab "Tài khoản định danh"**: bảng nào (số tài khoản NH gắn hợp đồng)?
**B9. Tab "Lịch sử hợp đồng"**: log thao tác ở bảng nào (audit/history), cột nào
  (thời gian, người thao tác, hành động, nội dung)?
**B10. Tab "Phiếu tính giá"** (cả trong menu "..."): bảng/RPC nào, cột nào?

**B11. Cột "Thao tác" ở lưới DS Hợp đồng** (nút "..."): gồm những hành động nào
  (vd cập nhật trạng thái "HĐMB chờ duyệt" → "đã duyệt", in hợp đồng, xuất phiếu...)?
  Nếu có API đổi trạng thái thì nêu tên RPC/table + param.

**B12. Menu module Hợp đồng** (HĐ Góp vốn, Xử lý, Phụ lục, Bàn giao, Sơ đồ, Vay ngân hàng):
- Hiện tại app chỉ cần **DS Hợp đồng + Chi tiết**. Hãy cho biết nhanh mỗi mục con dùng
  bảng/RPC nào (để sau này mở rộng), và mục nào **dùng chung dữ liệu** với DS Hợp đồng.

---

## 3. VÍ DỤ FORMAT MONG MUỐN (tham chiếu bên ĐẶT CỌC đã làm)

Ví dụ cách mình đã mô tả ĐẶT CỌC sau khi có câu trả lời của web — Hợp đồng cần **tương tự**:

```ts
// Danh sách đặt cọc
POST rest/v1/rpc/fn_deposit_list
body = {
  p_ma_ctdk_uid: <tenant uuid>,     // claim company_id
  p_project_id: "<uuid1,uuid2>" | null,
  p_tu_ngay: <ISO|null>, p_den_ngay: <ISO|null>,
  p_input_search: <string|null>,
  p_ma_tt: <number|null>,
  p_offset: (page-1)*limit, p_limit: limit,
}
// trạng thái
GET rest/v1/cloud_catalogs?catalog_type=eq.pgc_trang_thai&ma_ctdk=eq.global&order=item_code.asc
// lịch thanh toán
GET rest/v1/cloud_catalogs?catalog_type=eq.lich_tt_hd&parent_code=eq.<id>
// phiếu thu
GET rest/v1/cloud_cash_voucher_details?loai_phieu=eq.THU&pgc_id=eq.<id>
  → GET rest/v1/cloud_cash_vouchers?id=in.(...)&select=so_phieu,ngay_phieu,so_tien,dien_giai,nguoi_nop,hinh_thuc
```

→ Hợp đồng: hãy trả về **đúng kiểu** như trên, nhưng thay bằng:
`fn_contract_list` (tên thật), bảng hợp đồng thật, catalog trạng thái thật, nguồn lịch TT thật,
phiếu thu/chi thật.

---

## 4. YÊU CẦU OUTPUT CUỐI CÙNG

Trả lời gọn, có cấu trúc, ưu tiên **code/SQL thật** hơn mô tả. Cụ thể:
1. Tên & định nghĩa RPC list hợp đồng + body mẫu.
2. Tên bảng + cột (snake_case) cho: list, header detail, lịch thanh toán (+ nguồn vốn),
   phiếu thu, phiếu chi, tài liệu, lịch sử, chuyển nhượng, tài khoản định danh, phiếu tính giá.
3. Catalog trạng thái (catalog_type + danh sách mã/tên/màu).
4. Mapping cột → UI cho lưới DS Hợp đồng và các tab chi tiết.
5. Cách tính "Đã thu"/allocate lịch TT và các cột PBT.
6. Nếu có: SQL `CREATE FUNCTION` của RPC, và 1 đoạn JS gọi mẫu.
</content>
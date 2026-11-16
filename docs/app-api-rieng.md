# App nhân viên — bộ API riêng (.NET + SQL Server)

Bắt đầu 2026-11-16. Người dùng giao toàn quyền làm từ đầu đến cuối (BE + app), điều kiện: **không ảnh hưởng luồng web** — chỗ nào
phải đụng SP/bảng/endpoint web đang dùng thì DỪNG hỏi.

## Quyết định đã chốt (2026-11-16)
1. Phạm vi: rà + làm lại TOÀN BỘ app, cả đọc lẫn ghi.
2. **Lõi chung**: SP app dùng chung hàm lõi với web (phạm vi `app_agency_product_ids`, `_da_project_scope`, `_ds_*`, quyền
   `_perm_guard`/`app_has_perm`, che trường `_fm_*`, trạng thái…). Đọc: SP app tự chọn ít cột, trả đúng dạng app cần.
   Ghi: SP app gọi lại SP ghi của web (không viết lại nghiệp vụ).
3. Tên: route `api/app-nhan-vien/fn_nv_app_*` ↔ `dbo.usp_nv_app_*`, thư mục `database/sp/63_app_nhan_vien/`,
   C# module `AppNhanVien`.
4. Bỏ hẳn Supabase: không `rest/v1`, `functions/v1`, `storage/v1`, `apikey`, không gọi API cũ `api-beeland.beesky.vn`.
5. Claude viết cả SP + C# + app; người dùng build/deploy API.

## Nhánh / thư mục
- BE: `_wt/be-app-nv` nhánh `app-nhan-vien` (từ origin/main 40145206).
- App: `_wt/app-nv` nhánh `app-nhan-vien-api` (từ devhuan2 d1cfbd32).
- Web tham chiếu (chỉ đọc): `_wt/web-ref` = origin/main web 71720aeb.
- Script thử: `_wt/app_nv_scripts/q.py` (mọi thứ trong 1 lô BEGIN TRAN … ROLLBACK; `--as login@ma_ctdk` giả lập phiên).

## Quy tắc thử trên BEELAND26 (prod duy nhất)
- Đọc/nạp thử SP: chỉ qua q.py (rollback). Không chạy lặp bộ nạp lớn (log đầy 9002).
- Triển khai thật: chỉ đối tượng MỚI (`usp_nv_app_*`, `_nv_app_*`), không ALTER đối tượng web.

## Thứ tự làm — THEO LUỒNG (16-11: user dặn làm liền mạch từng luồng, không rời rạc; giữ nguyên luồng app, không thêm luồng web mới)
App chủ yếu dùng để bán hàng (lock → booking → đặt cọc). Mỗi luồng làm trọn: SP (lõi chung) → so với web → C# → app → test
xuyên luồng trên máy ảo, xong mới sang luồng sau.

| # | Luồng | Gồm | Trạng thái |
|---|---|---|---|
| L0 | Đăng nhập & phiên | đăng nhập / làm mới / đăng xuất / hết phiên, Face ID kiểm MK, hồ sơ | XONG (chờ deploy API) |
| L1 | Bán hàng từ căn | Dự án → Sản phẩm (DS / lưới / tổng quan) → Chi tiết căn ✔ · Lock căn → Căn đã lock → Tạo booking (chọn / tạo khách, sàn, giá theo bảng giá & chính sách, ảnh chứng từ, QR thanh toán) → DS / chi tiết Booking → Đặt cọc (DS / chi tiết / QR) → Hợp đồng + tiến độ TT · Phiếu tính giá: xem / xoá / lịch sử (duyệt: web; lập / sửa: tạm khoá, viết lại form khớp web ở cuối luồng) | ĐANG LÀM (DA/SP xong; BE phiếu tính giá + cấu hình bán hàng xong) |
| L2 | Khách hàng | DS / chi tiết / thêm / sửa, trùng khách, yêu cầu KH, luật nhập | |
| L3 | Lịch ký & báo cáo | đặt lịch ký (đại lý), lịch hẹn (ẩn), báo cáo | |
| L4 | Liên lạc & tài khoản | chat, thông báo, tài liệu / ảnh, đổi-quên MK, xoá TK, realtime, upload chung | |
| L5 | Dọn & test toàn bộ | bỏ sevicesSupabase / sevices cũ, đổi khoá lưu, kịch bản e2e toàn app | |

Bảng kê chi tiết từng lệnh gọi (2026-11-16): xem `docs/app-api-inventory/` (A sản phẩm, B bán hàng, C khách hàng, D lõi).

## Nhật ký
### 2026-11-16 — Phần 0 + 1
- BE (`_wt/be-app-nv`): module `AppNhanVien` — `NvAppAuthController` (fn_nv_app_dang_nhap / lam_moi_phien / dang_xuat, bọc
  CloudAuthService: lỗi ⇒ HTTP thật) + `NvAppSanPhamController` (5 endpoint) + SP `63_app_nhan_vien/10–14`. Unit test 7/7.
- SP đã triển khai BEELAND26 (5 đối tượng mới, `_wt/app_nv_scripts/deploy.py`, gỡ: `--rollback`). API CHƯA deploy.
- So sánh với SP web trên 19 tài khoản (BRG/MSR/Mega/mgltest, đại lý / nội bộ / toàn quyền) — `cmp.py du_an|san_pham_list|so_do|
  chi_tiet|khoa|bo_loc`: ĐẠT hết (danh sách: cùng thứ tự id + tổng ở 172 ca).
- App (`_wt/app-nv`): `services/` (config, session, nvApi, AuthApi, SanPhamApi) + `lib/jwt.ts`, `lib/nvSanPham.ts`; Login/Đăng xuất/
  Hồ sơ/Face ID kiểm MK chuyển API riêng; phiên tự làm mới (JWT < 1 ngày / 401), hết phiên ⇒ SessionGuard về Đăng nhập;
  Dự án / Sản phẩm (danh sách, khu, trạng thái, sơ đồ, chi tiết + ảnh + giá + lock) qua API riêng. Test 304 đạt, tsc sạch.
- Lệch web chờ quyết định: nút Lock / Booking ở chi tiết căn — web ẩn theo nhóm quyền (LOCK/BOOKING của /products/high-rise|low-rise),
  app đang hiện cho mọi người khi căn "Mở bán". API đã trả `quyen`.

### 2026-11-16 — L1: phiếu tính giá + cấu hình bán hàng (BE)
- 16 SP mới đã lên BEELAND26 (20–22, 24–36; bỏ 23 duyệt — duyệt để web). BE commit 67c7a037. So HTTP app ↔ web (5 tài khoản): giống hệt.
- Quyết định user: duyệt phiếu tính giá tạm để web; lập / sửa phiếu tạm khoá trên app ("lập trên web") tới khi form khớp web.

### 2026-11-16 — L1: lock căn + booking (BE xong, app đang nối)
- App: phiếu tính giá chuyển API riêng (commit 11a3d219): bỏ Duyệt / Từ chối (duyệt trên web), khoá Lập / Sửa
  (`PRICE_SHEET_CREATE_LOCKED` trong lib/featureConfig.ts) — mở lại khi viết lại form khớp web (cuối L1).
- BE 4c5a197e: SP 40–43 lock (tạo 1 giao dịch, list, chi tiết, hết hạn = fn_product_lock_expire_due trả căn về 2),
  50 booking_tao (máy chủ điền công ty / người nhập / ngày / tiền giữ chỗ / hạn như web), 51 booking_chi_tiet (1 lời gọi,
  phạm vi + che = fn_sales_doc_get), 52 booking_list. Đã lên BEELAND26; thử rollback: lock 2→18, hết hạn 18→2, booking
  tiền / hạn đúng cài đặt dù app gửi số sai.
- Việc tiếp (app): BookingService createLock / listProductLocks / getLockDetailCloud / sweepExpiredLocks / createBooking /
  listBookings / getBookingEditDetail ⇒ fn_nv_app_*; rồi: chứng từ booking (ảnh), QR thanh toán (payment-gateway), sàn GD,
  cấu hình bán hàng của form booking, Đặt cọc (list / chi tiết / QR), Hợp đồng, Tiến độ TT, chọn / tạo khách trong booking.

### 2026-11-16 — L1: booking (app) + QR + đặt cọc / hợp đồng / tiến độ TT
- Booking app xong (BookingService hết rest/v1; chứng từ 54–55, sàn 53, cài đặt bán hàng 56, tải tệp fn_nv_app_tai_tep).
- QR VA: `fn_nv_app_cong_thanh_toan {p_action: accounts|create|delete|expire_sweep|list}` (C# bọc PaymentGatewayEdgeService, BE 1ff2be05;
  app 01ca746e). So HTTP với api/fn/payment-gateway: đọc giống hệt; lỗi cùng thông điệp (app nhận HTTP 400 thay vì 200 {error}).
  Prod chưa có VA nào ⇒ chưa thử create/delete thật (không tạo VA thật).
- SP 60–65 (BE f74e3874, đã lên BEELAND26): trang_thai_list (= fn_status_catalog_list), dat_coc_list (= fn_deposit_list, p_transfer 0),
  dat_coc_chi_tiet (fn_sales_doc_get + đúng dòng _deposit_rows_hoan + loại căn/hướng + cờ QR), hop_dong_list (= fn_sale_contract_list,
  transfer_only 0), lich_tt_phieu (= fn_contract_payment_schedule, nhận id phiếu/HĐ/cọc), phieu_thu_phieu (= fn_cash_vouchers_by_pgc).
  Thử 1 lô rollback 7 tài khoản (`t_dat_coc.py`) + HTTP 4 tài khoản: ĐẠT (con_lai = giây đếm ngược, lệch theo giờ gọi).
- App 117cf994: DatCoc / HopDong / PaymentProgress qua API riêng; bỏ lịch dự phòng ở máy (web cũng không còn); nút QR cọc như web
  (PAYMENT_QR + không đổi căn / hoàn cọc chờ duyệt, fail-closed). Máy ảo: HĐ list 10 + chi tiết + lịch; cọc list 25 + chi tiết + QR (lỗi
  "chưa cấu hình ClientId" đúng như web, nút tạo khoá). Test 314 đạt, tsc + eslint sạch.
- CHỜ USER: nút QR booking theo quyền web? (web: PAYMENT_QR /sales/bookings + khoá khi đổi căn chờ duyệt; admin/hanhnh/devtest MSR không có
  quyền xem /sales/bookings ⇒ sẽ mất nút QR booking trên app).
- Còn L1: chọn / tạo khách trong form booking (customerLookup, fn_customer_get_by_ids / picker), viết lại form phiếu tính giá (2b), e2e L1.

### 2026-11-16 (tối) — L1: QR booking theo quyền + chọn khách
- User chốt: nút QR booking THEO WEB. SP 51 trả `quyen.payment_qr` (/sales/bookings) + `doi_can_cho_duyet` (đã triển khai, BE 124e0e79);
  app 95a0daed: chi tiết booking ẩn "Thu tiền QR", màn QR khoá tạo + báo lý do. (MSR admin/hanhnh/devtest mất nút — đúng như web.)
- SP 66 khach_hang_chon (= fn_customer_picker), 67 khach_hang_theo_id (= fn_customer_get_by_ids) — BE 8393d5a0, đã triển khai.
  Thử rollback 6 tài khoản × 3 từ khoá + HTTP 4 tài khoản: ĐẠT. App: customerLookup qua API riêng (dùng chung booking / lịch ký /
  phiếu tính giá / chat / báo cáo). Test 315 đạt.
- Chưa thử trên máy ảo màn tạo booking (lệnh điều khiển máy ảo tới Lock căn / tạo booking bị chặn vì app nối dữ liệu prod).
- "Thêm khách mới" trong form booking mở màn customer/new — vẫn ghi qua rest/v1 ⇒ làm ở L2 (Khách hàng).

### 2026-11-16 (tối) — L1 2b: form phiếu tính giá = chép nguyên văn web (user chốt)
- `scripts/sync-web-pricing.cjs` (commit 90a3ed06): chép NGUYÊN VĂN 28 module thuần của web vào `lib/web/` (chỉ đổi đường dẫn import),
  trích kiểu từ module không thuần (`_stubs`), trích hàm thuần (`_extract`), trích logic ngay trong PriceSheetForm.tsx thành hàm
  `fn(ctx)` (`PriceSheetForm.logic.ts`: webCalculations, webGetRestoredRoundResults, webFormulaCtx, webRecalcPaymentScheduleSequential,
  webDueDatesOf, webBuildSave). Shim viết tay `lib/web/_shims/` (supabase ⇒ chỉ rpc đọc đã đối chiếu sang fn_nv_app_*, sonner, session).
  `--check` so khớp web; web đổi ⇒ chạy lại script. Repo web cho test: `_wt/beeland` → `_wt/web-ref` (symlink).
- dayjs 1.11.20 (bản web dùng) — chỉ thêm đúng mục dayjs vào package-lock (lock vốn lệch package.json; npm install đầy đủ sẽ nâng gói khác).
- Test: phiếu BRG thật tính bằng bản chép ⇒ đúng từng số web đã lưu (3 vòng CK). 9 test cũ so bản sao CŨ của app với web nay đỏ
  (lộ ra khi nối repo web) — sẽ bỏ khi thay lib cũ (priceSheetCalc / Formulas / Schedule / payload) bằng lib/web.
- Việc còn (lớp điều phối form, port từ PriceSheetForm + hook web): endpoint app mới cần (đọc): fn_price_list_quy_can_options (quỹ căn),
  fn_caller_sales_company (công ty bán hàng), fn_sales_policy_option_usage (đã dùng tùy chọn), fn_exception_request_active (ngoại lệ),
  tồn kho quà (policyKho), cấu hình tính giá sản phẩm (PricingConfigCloudService), fn_generate_form_code (số phiếu — ghi bộ đếm, kiểm kỹ);
  rồi viết lại usePriceSheetDraft + màn new.tsx theo luồng app (thêm Quỹ căn, Công ty bán hàng, chọn chính sách trước bảng giá, tick tùy chọn
  theo điều kiện, Ngày hết hạn, mẫu in tự chọn), duyệt vẫn trên web; mở PRICE_SHEET_CREATE_LOCKED khi test xong.

### 2026-11-16 (đêm) — L1 2b XONG: Lập / Sửa phiếu tính giá = logic form web chép nguyên văn (cờ PRICE_SHEET_CREATE_LOCKED = false)
- BE (đã triển khai BEELAND26): SP 70 quy_can_list, 71 cong_ty_ban_hang_cua_toi, 72 cong_ty_dai_ly, 73 tuy_chon_da_dung, 74 ton_kho_qua,
  75 ngoai_le_hieu_luc (bọc SP web, so rollback 6 tài khoản + HTTP: ĐẠT); 34 trả mọi cột price_list_items; 35/36 thêm cột thô + @p_id
  (THÊM THAM SỐ ⇒ restart API khi deploy). BE b9df4383, 6b82eacc.
- App: lib/web 104 module + hook useWebPriceSheetForm (244/246 câu thân PriceSheetForm web) + trích trang web (handleEdit /
  handlePriceSheetSaved); shim supabase (RPC_MAP ⇒ fn_nv_app_*, .from chỉ 4 bảng đọc), Product / Project / Customer / NhanVienService /
  CodeGenService / session / sonner / priceSheetConstants; stub chạy thật cho module không thuần. Màn new.tsx (3 bước) + WebRoundCard.
  Xoá editor + lõi tính cũ của app. Test 306 đạt; máy ảo: lập (C6-2301: CS lọc theo tòa, CK theo phân bổ / kho, CK tiền, lịch 5 đợt) +
  sửa (S4-1401 chuyển nhượng, đúng số đã lưu) — CHƯA bấm Lưu thật (ghi prod); lưu đã thử rollback (máy chủ cấp số PTG-CS-0001).
- Khác web có chủ đích: số phiếu không xem trước (máy chủ cấp khi lưu); không có bước 360 / người đồng sở hữu (giữ nguyên dữ liệu phiếu
  cũ khi sửa); "Lưu & gửi duyệt" không có (duyệt trên web).
- Web đổi form ⇒ `node scripts/sync-web-pricing.cjs` (test web-pricing báo lệch); RPC mới chưa có trong RPC_MAP ⇒ log "app không hỗ trợ".
- Ghi nhớ khác: form booking web đã đổi nhiều (Công ty bán hàng, bỏ quà / ưu tiên, chính sách trước bảng giá) — app booking chưa theo.

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
| L1 | Bán hàng từ căn | Dự án → Sản phẩm (DS / lưới / tổng quan) → Chi tiết căn ✔ · Lock căn → Căn đã lock → Tạo booking (chọn / tạo khách, sàn, giá theo bảng giá & chính sách, ảnh chứng từ, QR thanh toán) → DS / chi tiết Booking → Đặt cọc (DS / chi tiết / QR) → Hợp đồng + tiến độ TT · Phiếu tính giá: xem / xoá / lịch sử (duyệt: web; lập / sửa: tạm khoá, viết lại form khớp web ở cuối luồng) | XONG 16-11 (booking thật BK-BF228DD95B đạt; chờ deploy API) |
| L2 | Khách hàng | DS / chi tiết / thêm / sửa, trùng khách, yêu cầu KH, luật nhập | XONG 16-11 (SP 78–96; chờ deploy API) |
| L3 | Lịch ký & báo cáo | đặt lịch ký (đại lý), lịch hẹn (ẩn), báo cáo | XONG 16-11 (SP A0–A3, B0–B9; lịch hẹn ẩn để L5; chờ deploy API) |
| L4 | Liên lạc & tài khoản | chat, thông báo, tài liệu / ảnh, đổi-quên MK, xoá TK, realtime, upload chung | XONG 16-11 (SP C0–E6; tệp chat chưa thử được ở API local; chờ deploy API) |
| L5 | Dọn & test toàn bộ | bỏ sevicesSupabase / sevices cũ, đổi khoá lưu, kịch bản e2e toàn app | XONG 17-11 |

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

### 2026-11-16 (đêm) — L1 3: form booking = chép nguyên form web (BookingFormDialog → useWebBookingForm)
- BE (đã nạp BEELAND26, API local đã restart; API thật cần build + restart): SP 76 `ma_phieu` (= usp_generate_form_code, công ty từ phiên;
  CHỈ ĐỌC — _form_code_next_p khoá + đọc bộ đếm / số lớn nhất, không UPDATE; test t_ma_phieu.py 24/24 khớp + bộ đếm không đổi),
  SP 77 `gia_can_bang_gia` (= usp_get_price_list_item_by_product, HTTP app = web từng byte). BE 8530ef7b.
- App 381e8d8f: hook web chép (khai báo cấp module + import động); shim: addBookingAPI (body web ⇒ fn_nv_app_booking_tao, báo phiếu vừa tạo),
  CodeGenService (số phiếu xem trước + {TenDA} viết tắt), bảng bds_products (+ `.or`), cloud_code_rules rỗng, HeThongService.CaiDat rỗng.
  Màn create.tsx giữ luồng app (căn / lock ⇒ form; Thêm mới khách ⇒ customer/new ⇒ handleCustomerSaved; lưu xong vào chi tiết thu tiền),
  thêm ô như web: Công ty bán hàng (bắt buộc theo tài khoản), Đại lý phân phối lọc theo CTBH, Quỹ căn (khoá), Chính sách (lọc tòa / quỹ / hạn),
  Bảng giá theo chính sách, giá theo bảng giá. Test 309 đạt.
- Đã thử: mô phỏng bấm Lưu với API thật (e2e_booking_form.cjs, chặn lệnh ghi) ⇒ payload; lưu payload đó trong ROLLBACK (t_bk_luu.py) ⇒
  phiếu Chờ duyệt, căn sang 11, đủ CTBH / quỹ / đại lý / chính sách, rollback xong căn vẫn Mở bán. Máy ảo: mở form C6-2301, chọn khách,
  CTBH AN PHÚ ⇒ 3 đại lý — CHƯA bấm Giữ chỗ thật (ghi prod).
- Khác web có chủ đích: thứ tự ô CTBH trước Đại lý (CTBH lọc đại lý); căn chưa có tổng giá HĐ ⇒ HIỂN THỊ giá trị HĐ theo bảng giá (lưu không đổi);
  chưa có sửa booking (app không có luồng sửa). Quy trình bán hàng sau booking (triggerSalesProcess ⇒ av2_jobs): app không chạy — bước "booking"
  của BRG trỏ workflow đã xoá, job cuối 2026-09-09 ⇒ web hiện cũng không chạy được; khi bật lại cần endpoint riêng.
- Còn lại của lớp cũ (dọn ở L5): BookingService.createBooking / getBookingSalesConfig, lib/bookingPayload, lib/bookingPrice, lib/agencySan.bookingSan.

### 2026-11-16 (đêm) — L1 chốt + L2 Khách hàng XONG
- L1: bấm Giữ chỗ thật trên máy ảo (user cho phép) ⇒ BK-BF228DD95B (C6-2301, [DEMO] Kim Ngọc Anh, CTBH AN PHÚ, 50 tr, 30 phút) —
  DB đúng (PENDING, căn 11, nhật ký BOOKING_CREATE), vào thẳng chi tiết thu tiền. Phiếu thử này CÒN trên prod (Chờ duyệt).
- L2a (BE 0df4b35e, app fc3ea77a): SP 78 danh_muc, 79–82 khach_hang_list / chi_tiet / luu / xoa (bọc usp_customer_*), 83 khach_hang_giao_dich
  (luật quyền xem khách + phạm vi giao dịch web). Bỏ đọc cloud_catalogs có lần thử KHÔNG lọc công ty.
- L2b (BE 16e86564, app 1582c3a9): SP 84 cau_hinh_truong (fn_field_config_effective), 85 trung_cau_hinh, 86 trung_kiem, 87 trung_yeu_cau_tao,
  88 khoa_dinh_danh, 89 khoa_giao_dich. LỆCH ĐÃ SỬA THEO WEB: (1) cấu hình trùng — app đọc bảng cũ (rỗng) ⇒ mặc định defaultMode = block
  (chặn mọi tiêu chí); nay = web (chưa cài = không kiểm, BRG: CCCD chặn); (2) bắt buộc / ẩn / chỉ xem — app đọc 2 bảng cũ web đã bỏ, nay
  fn_field_config_effective + luật web chép (lib/web fieldConfigRules / catalog); tải lỗi lúc lưu ⇒ chặn như web; (3) khoá sửa theo giao dịch
  (Đặt cọc / HĐMB đã duyệt) — app chưa có, nay màn Sửa báo khoá. Lịch ký (L3) dùng chung getRulesForForm: trường có điều kiện (doanh nghiệp)
  chưa kiểm phía app ⇒ xem lại ở L3.
- L2c (BE 135fb46b, app b3311ec0): SP 90–95 yeu_cau_* (bọc fn_customer_request_*; 91 kèm SoHD), 96 nhan_vien_list; endpoint C#
  fn_nv_app_yeu_cau_tep_ky ký tệp drive-files CHỈ khi yêu cầu xem được + tệp thuộc ListAttach (edge web không kiểm). Tài khoản MSR không
  có quyền "Yêu cầu khách hàng" (lời máy chủ hiện nguyên).
- Test: t_kh2.py / t_kh3.py / t_yc.py (rollback, nhiều tài khoản) app = web; HTTP app = web; app 319 test; máy ảo: DS khách / lọc trạng thái /
  chi tiết / giao dịch / Sửa bị khoá / form Thêm khách / DS + chi tiết yêu cầu.
- API thật cần build + restart cho endpoint mới SP 76–96 + 2 endpoint C# (ký tệp).

### 2026-11-16 (khuya) — L3 Lịch ký & báo cáo XONG
- L3a (BE ace29407, app 0d8d694e): SP A0 bao_cao_tien_do, A1 da_thu_phieu, A2 phieu_thu_list, A3 phieu_thu_chi_tiet. LỆCH ĐÃ SỬA: "Đợt quá hạn"
  lẫn đợt đã tất toán ("done".startsWith("d")) — 89 ⇒ 67 đợt trên máy ảo.
- L3b (BE 3ab28f0b, app 6d639d85 + 1a3f4d50): user chọn "theo luồng web mới". SP B0–B3 lich_ky_list / chi_tiet / luu / xoa, B4 tim_coc,
  B5 tim_hd, B6 tuy_chon, B7 cho_trong, B8 ca, B9 danh_muc_ma (mã chữ công ty phiên). Form app = logic web chép (SigningDrawer /
  ShiftPickerFields / SigningFundField ⇒ hook): Nguồn Đặt cọc/HĐ → Quỹ → Điểm ký → Thủ tục → ngày (14 ngày / lịch tháng, chỗ còn) → Ca,
  hồ sơ theo phân loại khách + tệp theo hồ sơ, phương án TT khoá theo lịch TT, đồng sở hữu, lưu = submit web (bắt buộc theo cấu hình,
  kiểm lại chỗ ca). Bỏ "Đổi khách" (web khoá khách theo chứng từ). Duyệt / từ chối lịch: chỉ web (shim trả APP_UNSUPPORTED).
- Đã thử: harness API thật mở từ phiếu 9E4DA56D… ⇒ payload; lưu payload trong ROLLBACK (t_lk_luu.py) ⇒ PENDING đúng. Bấm Lưu thiếu trường
  (harness, chặn lệnh ghi) ⇒ "Vui lòng nhập: Ca book ký, Loại thủ tục". Máy ảo (tạm bật nút vì tài khoản thử không phải đại lý, đã hoàn lại):
  mở từ phiếu cọc C7-0909 (nguồn khoá, Quỹ CĐT, điểm, thủ tục Ký TTĐC, chỗ theo ngày, 4 ca, tóm tắt lịch hẹn, hồ sơ CCCD); sửa lịch 96501
  (nạp đủ điểm / ngày / ca); thêm mới chọn HĐ HD-C6-2309 (nạp khách, phương án TT khoá theo lịch TT); lịch tháng. KHÔNG lưu thật.
- Chưa thấy tận mắt toast báo thiếu trường trên máy ảo (lệnh bấm Lưu thứ 2 bị chặn để tránh ghi prod) — logic web đã đúng câu báo.
- Còn lại (L5): màn Lịch hẹn ẩn (api-beeland cũ), helper cũ lib/signing (buildUpsertPayload, availability…) không còn dùng ở form.

### 2026-11-16 (khuya) — L4 Liên lạc & tài khoản XONG
- BE 4273833d, app 752cc4f5. SP C0–E1 usp_nv_app_chat_* bọc 22 SP chat web (t_chat.py: brg + msr app = web, gửi tin rollback phát 3 dòng
  rt_outbox). C# NvAppChatTepController: tệp 1 bước (attach_create ⇒ StorageSignService.UploadAsync) + link ký 300 s.
- LỆCH ĐÃ SỬA THEO WEB (user chốt): thông báo — chuông web từ 15-11 chỉ hiện hộp thư theo kịch bản (tb_nb_hop_thu), app đọc bảng
  notifications cũ ⇒ nay E2/E3 + realtime tb:u:<nv> tb_moi; bấm tin mở màn app có (804 / 824 / 832 / 9002; booking = id phiếu giữ chỗ,
  phiếu thu = màn mẫu ⇒ không mở). Tài liệu / ảnh — app đọc thẳng bảng cloud_doc_* (phẳng) ⇒ nay cây fn_doc_tree / fn_doc_file_list
  (E4/E5, chỉ 488 / 323), đi xuống thư mục con; dự án theo uuid.
- Xoá tài khoản (user chốt "bỏ qua chặn cho chính mình"): web chặn tự xoá / tự khoá ở SP + trigger dm_employees ⇒ nút cũ của app (DELETE REST)
  luôn lỗi. E6 usp_nv_app_xoa_tai_khoan chỉ chạy quyền nội bộ; C# lấy nhân viên / công ty từ JWT. t_l4.py (rollback): NV tạm ⇒ xoa,
  NV có bds_product_changes ⇒ khoa (lock=1), quản trị ⇒ chặn, gọi bằng JWT ⇒ chặn. Không xoá cloud_users (như web).
- Quên MK: fn_nv_app_quen_mat_khau = StaffResetPasswordService web (thử 1 request tài khoản không tồn tại ⇒ ghi 1 dòng OTP như web).
- Đổi MK khi đăng nhập: app vẫn không có (MK tạm ⇒ máy chủ chặn app, đổi trên web) — giữ luồng.
- Máy ảo: thông báo (6 chưa đọc, đúng chuông web), chat (inbox / hội thoại / đã đọc), tài liệu + thư viện ảnh Capital Square 2.
  Ảnh / tệp chat KHÔNG thử được ở API local (thiếu cấu hình kho — edge chat-files web cũng lỗi y vậy) ⇒ thử sau deploy API.
- lib/web đồng bộ web main a33e9790 (kho quà hạn mức nhóm). 328 test đạt.
- Còn lại (L5): xoá axiosApiSupabase.ts / cloudTenant còn dùng, màn Lịch hẹn ẩn, receipt/[id] mẫu.

### 2026-11-17 — L5 Dọn & thử toàn app XONG
- User chốt: xoá màn Lịch hẹn (gọi API .NET cũ đã ngừng; tính năng id 3 bỏ hẳn) + thư mục sevices/; xoá màn mẫu Phiếu thu
  (receipts, receipt/[id]) và Bàn giao (handovers, handover/[id]) + mock. Chi tiết phiếu thu thật vẫn là reports/receipt/[id].
- Bỏ cloudTenant.ts + axiosApiSupabase.ts; gộp sevicesSupabase/ vào services/. Khoá lưu: màn đọc `getSessionInfo()` (người dùng
  phiên, thiếu thì claim JWT); saveSession không ghi + dọn 12 khoá cũ (@type_account, @company_id…). GIỮ tên @supabase_jwt / @token /
  @nv_user để bản cập nhật không đăng xuất người dùng.
- Code chết: BookingService.createBooking / getBookingSalesConfig, lib/bookingPayload, lib/agencySan, phần lib/bookingPrice và
  lib/signing không còn dùng (form dùng logic web), components/utils/common.ts; test tương ứng bỏ / rút gọn. Không còn tệp nào
  không ai import (scratchpad unused.cjs). App gọi 117 endpoint = BE có 117 (không thừa / thiếu).
- BE: cs-sp.json sinh lại bằng công cụ (c4d29dea). Unit test BE: 2 lỗi KHÔNG thuộc app (manual 160/180 dùng sqlcmd,
  CashVoucherHieuLuc — code khác trên main).
- Thử máy ảo (tài khoản admin BRG, chỉ xem): Trang chủ, Dự án, Sản phẩm + chi tiết căn, Lock căn, Booking + chi tiết, Khách hàng +
  chi tiết, Hợp đồng + chi tiết, Đặt cọc, Báo cáo, Yêu cầu KH, Phiếu tính giá, Tài khoản; trước đó L1–L4 (booking thật, lịch ký,
  thông báo, chat, tài liệu). API local: mọi lệnh 200. CHƯA thử tài khoản đại lý trên máy ảo (không có mật khẩu đại lý thử).
- docs/*.md + CLAUDE.md viết lại theo bộ API riêng. tsc sạch, lint 0 lỗi, 304 test đạt, lib/web khớp web.
- Còn chờ: user build + restart API thật (SP 76–E6 + endpoint C# L2–L4), thử ảnh / tệp chat trên API thật, thử bằng tài khoản đại lý.

### 2026-11-17 — Phân quyền như web (menu + nút) — nhánh `app-nv-phan-quyen`
- User chốt: ánh xạ module ↔ màn web; máy chủ chặn như web (không thêm chặn mới); đại lý giữ như cũ. Chi tiết + cách quay lại:
  `docs/permissions.md`.
- BE `app-nv-phan-quyen` 195881d1: SP E7 `usp_nv_app_quyen_man` (ĐÃ nạp BEELAND26) + endpoint `fn_nv_app_quyen_man`; phiên app trả
  `menu` / `menu_cong_ty` (C# — cần deploy API). Trước khi deploy: app như cũ.
- Đính chính rà quyền: lưu KH CÓ kiểm ADD/EDIT ở lõi `_ds5_customer_save` (p_scoped = 1, app + web đều truyền).
- Phát hiện (chưa làm, chờ user): `lib/web` lệch web main 17-11 (~10 tệp form tính giá / booking do đồng nghiệp đổi chính sách bán
  hàng) ⇒ test "lib/web khớp nguyên văn web" đỏ; cần 1 đợt đồng bộ riêng.

# Truy cập dữ liệu

## Hai nguồn

| Nguồn | Client | Base URL | Dùng cho |
|---|---|---|---|
| Supabase self-host | `sevicesSupabase/axiosApiSupabase.ts` | `https://api-beelandv2.beesky.vn` (`rest/v1/…`, `rest/v1/rpc/…`, `functions/v1/…`) | Gần như toàn app |
| API .NET cũ | `sevices/axiosApi.ts` (và `sevicesSupabase/axiosApi.ts`) | `https://api-beeland.beesky.vn/` | Quên/đặt lại mật khẩu, thông báo, video dự án, lịch hẹn (đang ẩn), kiểm tra phiên bản, SignalR |

- Web đã chạy **Cloud-only**: `cloud_global_settings.legacy_api_mode = {"mode":"off"}` (đọc ngày 01/10/2026, cập nhật
  22/08/2026). Các màn app còn gọi API cũ (bảng trên) **chưa kiểm chứng** còn hoạt động.
- Không có môi trường test riêng: mọi thao tác ghi đi vào dữ liệu thật.

## Phiên và header (axiosApiSupabase)

- Request: `apikey` = anon key; `Authorization: Bearer <cloud JWT>` (`@supabase_jwt`) nếu còn hạn, hết hạn → anon key
  (RLS trả rỗng). Không tự refresh JWT – hết hạn thì về màn đăng nhập (`app/(tabs)/home.tsx` kiểm tra lúc mở).
- Response lỗi luôn `Promise.reject` → lỗi `RAISE EXCEPTION` của hàm SQL nằm ở `error.response.data.message`.
- Edge function `payment-gateway` xác thực bằng token phiên `@token` (header `x-cloud-token`), không phải JWT.

## Tenant – khoá công ty (bẫy hay gặp)

`sevicesSupabase/cloudTenant.ts`:

| Hàm | Trả | Lấy từ |
|---|---|---|
| `getCompanyId()` = `getTenantId()` | **uuid** công ty đăng ký | claim JWT (`company_id`…), rồi `@tenant_id`/`@company_id`/`maCTDK_UUID`; không có uuid → `""` |
| `getCompanyCode()` | **mã chữ** công ty (vd `BeeSky1`) | claim `company_code`…, rồi `@company_code`/`tenCTDKVT`/`maCTDK` |
| `getEmployeeId()`, `getBranchId()`, `getTypeAccount()`, `getMaNv()` | uuid NV, uuid chi nhánh, `SYSTEM`/`AGENCY`, mã NV | JWT rồi AsyncStorage |

Mỗi bảng lọc tenant **khác nhau** – làm theo web (`../beeland/src/services/CloudMirror.ts` `tenant()` = mã chữ thường;
`lib/catalogTenantRewrite.ts` đổi `cloud_catalogs.ma_ctdk` → `ma_ctdk_uid`):

| Bảng / hàm | Cột | Giá trị |
|---|---|---|
| `cloud_customers`, `cloud_bookings`, `cloud_doc_folders/files` | `ma_ctdk` / `ma_ctdk_id` | uuid |
| `cloud_pgc_phieu_giucho`, `cloud_pre_bookings`, `cloud_signing_appointments` | `ma_ctdk_uid` | uuid |
| `cloud_catalogs` (cấu hình theo công ty) | `ma_ctdk_uid` | uuid · danh mục dùng chung: `ma_ctdk=eq.global` |
| `cloud_catalogs` lịch `lich_tt_hd` | `ma_ctdk` | **mã chữ thường** (như web ContractCloudService) |
| `cloud_customer_activities`, `cloud_customer_dup_requests(_logs)`, `cloud_required_field_configs`, `cloud_field_visibility_configs`, `cloud_debts` | `ma_ctdk` | **mã chữ thường** |
| `cloud_cash_voucher_details` | `ma_ctdk` | uuid |
| RPC `fn_*` | `p_ma_ctdk_uid` / `p_ma_ctdk` | uuid (xem từng hàm) |

## Quy ước service

- Service trả shape PascalCase cũ cho màn (`MaSP`, `TenTT`…); dữ liệu Supabase snake_case được map trong service.
- Không embed FK (`table!fk(...)`) ở chỗ mới: schema cache self-host từng thiếu FK → lỗi 400. Tra bảng phụ bằng
  `id=in.(…)`, **chia nhóm ~100 id** (URL dài lỗi im lặng). Một số chỗ cũ còn embed (`BOOKING_SELECT_FULL` có fallback).
- Hàm máy chủ mới trả `{ rows, total_count }`, bản cũ trả mảng dòng kèm `total_count` → dùng `rpcRows()` (`DatCocService.ts`).
- Ngày lọc gửi theo giờ VN: `vnDayBound()` (`DatCocService.ts`) = `YYYY-MM-DDT00:00:00.000+07:00` / `…T23:59:59.999+07:00`;
  không lọc → `null` (không gửi khoảng 2000–2100).
- Mã sản phẩm: `normalizeProduct` (`ProductService.ts`) trả uuid ở **`ID`** (không phải `id`/`Id`); `MaSP` = `ma_sp`.
- Mã dự án ở màn = `MaDA` = `ma_da_code` (mã cũ), thiếu thì uuid (`ProjectService.ts`). Service tự đổi sang uuid khi cần.

## Hàm máy chủ app đang gọi (chỉ có trên server, không có trong repo web)

`fn_booking_list`, `fn_booking_create`, `fn_product_transaction`, `fn_customer_list`, `fn_deposit_list`, `fn_contract_list`,
`fn_contract_payment_schedule`, `fn_cash_vouchers_by_pgc`, `fn_cash_voucher_list`, `fn_get_current_price_lists`,
`fn_get_sales_policies`, `fn_get_price_list_item_by_product`, `get_active_price_for_product`. Tham số lấy theo code web gọi;
kết quả trả về **chưa kiểm chứng trực tiếp** cho các hàm không có migration trong `../beeland/supabase/migrations`.
Edge function: `cloud-auth`, `payment-gateway`, `upload-file`.

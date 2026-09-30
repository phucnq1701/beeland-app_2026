# Redesign UI Beeland Sales – Giai đoạn 4 (Khách hàng) – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa 6 màn Khách hàng sang design system **và** cho kết quả nghiệp vụ giống web (kiểm tra trùng khách, bắt buộc nhập, ẩn/khoá trường, khoá định danh, điều kiện xoá), sửa các lỗi dữ liệu đang có ở màn khách hàng.

**Architecture:** Luật nghiệp vụ chép từ web vào hàm thuần `lib/customerRules.ts` (có test). Đọc/ghi Supabase cho các luật đó ở `sevicesSupabase/CustomerRulesService.ts` (chỉ gọi bảng/cột web đang dùng – không sửa server). Form tạo/sửa dùng chung `components/customer/CustomerForm.tsx`; hộp trùng khách `components/customer/DuplicateSheet.tsx`.

**Tech Stack:** như GĐ0–3.

**Spec:** `docs/superpowers/specs/2026-09-30-ui-redesign-design.md` (mục 0 – web là chuẩn, không sửa server; mục 6; mục 7 dòng GĐ4). Nền tảng: plan GĐ0–1, GĐ2, GĐ3.

## Global Constraints

- Nhánh `devhuan2`. **Chỉ commit local**; không push, không PR, không `eas update`/`eas build`.
- **Không sửa phía server** (SQL, migration, edge function, bảng, trigger, RLS, dữ liệu). Lỗi server → spec mục 0.2.
- Web là chuẩn nghiệp vụ; mỗi luật chép từ web ghi nguồn (file web) trong chú thích.
- Commit giai đoạn: `feat(ui): phase 4 – khách hàng` + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sửa sau review commit riêng.
- Màu chỉ từ `@/theme`; file migrate vào `UI_STRICT_FILES`. Toast/confirm theo D7; chạm ≥ 44; icon-only có nhãn; caption 14/20, nhỏ nhất 12.
- Giữ nguyên route/param: `/customers`, `/customer/new` (`returnToBooking`, `dataBooking`), `/customer/[id]`, `/customer/[id]/edit`, `/customer/[id]/contracts`, `/contacts`; `CustomersScreen({ embedded })` dùng trong `FeatureTabScreen`.

**Baseline** (trên `ab689ec0`): `tsc` 5; lint 11 errors / 52 warnings; `node --test tests/` 87 pass.

## Nghiệp vụ web phải chép (nguồn)

| # | Luật web | Nguồn web | App hiện tại |
|---|---|---|---|
| W1 | **Trùng khách**: cấu hình `cloud_catalogs` (`catalog_type=customer_duplicate`, `item_code=default`, theo `ma_ctdk_uid`); mặc định mọi tiêu chí (CCCD, SĐT, email, MST, họ tên) = **block**. Mỗi khách trùng tính **mức bảo vệ** (HĐ/cọc/giữ chỗ/chăm sóc) → nâng cách xử lý; khách do chính mình tạo → `ownDuplicateMode`. Kết quả `allow` (lưu) / `request` (gửi yêu cầu `cloud_customer_dup_requests` + log) / `block` (không lưu). Sửa khách: bỏ qua chính nó. | `services/CustomerDuplicateService.ts`, `CustomerDuplicateConfigService.ts`, `CustomerDupRequestService.ts`, `components/Customers/DuplicateGuardModal.tsx` | Chỉ cảnh báo SĐT/CCCD, vẫn cho tạo trùng |
| W2 | **Bắt buộc nhập** theo cấu hình `cloud_required_field_configs` (`ma_ctdk` = mã công ty, `form_key` `customer`/`customer_org`, tài khoản đại lý dùng `agency_*` nếu có), bỏ trường bị ẩn | `services/RequiredFieldService.ts`, `config/requiredFieldCatalog.ts` | Cố định: tên, SĐT (+MST với DN) |
| W3 | **Ẩn / chỉ đọc trường** theo `cloud_field_visibility_configs` (cấu hình chung + riêng nhóm quyền; tài khoản `is_full_access` không bị ẩn) | `services/FieldVisibilityService.ts` | Không có |
| W4 | **Khoá định danh**: khách có lịch ký cá nhân (`cloud_signing_appointments`, `is_personal=true`) → không sửa Họ tên & CCCD | `services/CustomerIdentityLockService.ts` | Không có |
| W5 | **Xoá khách**: chặn khi có phiếu booking thiện chí (`cloud_pre_bookings`, `deleted_at is null`), thông báo "Khách hàng đã có N phiếu booking, không được phép xóa." | `pages/Customers/CustomerList/index.tsx`, `services/preBooking/read.ts` | Kiểm tra `cloud_pgc_phieu_giucho` + `cloud_bookings`, thiếu `cloud_pre_bookings` |
| W6 | Giai đoạn chứng từ: GIUCHO Giữ chỗ / booking · DATCOC Đặt cọc · HDGV HĐ góp vốn · HDMB HĐ mua bán · THANHLY Thanh lý | `services/SalesDocListService.ts`, `CustomerDuplicateService.txnInfo` | — |

## Lỗi app phát hiện khi đọc code (sửa trong GĐ4)

| # | Lỗi | Sửa |
|---|---|---|
| B1 | `getCustomerTransactions` chọn cột `tong_gia_tri`, `tien_giu_cho` **không có** trong `cloud_pgc_phieu_giucho` → truy vấn lỗi → màn "Lịch sử hợp đồng" luôn rỗng | Chọn `gia_tri_hd, gia_tri_hd_sau_ck, tien_coc, da_thu, deleted_at`; bỏ embed FK, tra dự án/sản phẩm/trạng thái theo id (như `getBookingEditDetail`); bỏ dòng `deleted_at` khác null |
| B2 | Màn `customer/[id]/contracts` đọc `soHopDong/ngayKy/tongGiaTri/trangThai` trong khi service trả `soPhieu/createdAt/tongGia/status` → cột trống | Màn đọc đúng trường (Task 5) |
| B3 | Tạo khách từ màn tạo booking: `customer/new` trả param `createdCustomer` (bản ghi thô) nhưng `booking/create` đọc `newCustomer` → KH mới **không được chọn sẵn**; `router.replace` sinh thêm một màn tạo booking trong stack | `customer/new` gọi `router.dismissTo('/booking/create', { dataBooking, newCustomer })`; `booking/create` chuẩn hoá bằng `normalizeCustomer` và chọn khi param đổi |

## Quyết định mặc định (theo web, không dừng hỏi – ghi vào báo cáo)

| # | Điểm | Mặc định |
|---|---|---|
| R1 | Cấu hình bắt buộc có trường **app không có trên form** (vd Ngày sinh, Nơi cấp, ảnh CCCD) | Không cho lưu, báo "Công ty yêu cầu nhập: …. Mục này chưa có trên app – vui lòng nhập khách hàng trên web." (kết quả không lệch web: không tạo khách thiếu trường bắt buộc) |
| R2 | Web còn nhánh tra nhóm quyền qua bảng phụ khi không có claim `per_id` và `dm_employees.perm_group_uid` | App dùng claim `per_id`, rồi `dm_employees.perm_group_uid`; không có → chỉ áp cấu hình chung |
| R3 | Xoá khách: web chỉ kiểm `cloud_pre_bookings` (phần còn lại dựa vào ràng buộc DB) | Thêm kiểm `cloud_pre_bookings` như web **và giữ** kiểm phiếu giữ chỗ/booking hiện có (an toàn hơn; kết quả web với các khách này phụ thuộc ràng buộc DB – không kiểm được phía client) |
| R4 | Nhật ký chăm sóc trên chi tiết khách đang bị comment (ẩn) | Giữ ẩn (đóng băng tính năng); xoá modal chết không mở được |
| R5 | `contacts.tsx` dùng dữ liệu mẫu (danh bạ chat), chỉ mở từ tab AI chat (ngoài phạm vi) | Chỉ restyle, giữ nguyên dữ liệu mẫu và điều hướng |
| R6 | Web đã có `findApprovalFor` (yêu cầu trùng được duyệt) nhưng **không nơi nào dùng** → trên web, NV đã được duyệt vẫn bị chặn khi nhập lại | App làm giống web (không dùng); ghi vào spec 0.2 để báo đội web |

## Review Focus

1. **Cấu hình trùng/bắt buộc không đọc được** (mạng lỗi, bảng rỗng, JSON hỏng) → dùng mặc định web (`block` mọi tiêu chí; không ràng buộc bắt buộc thêm), không crash, không chặn nhầm vĩnh viễn – test ở Task 1/2.
2. **Sửa khách không bị báo trùng với chính nó** (`excludeId`) – test Task 2.
3. **Tạo khách từ luồng booking** → quay về đúng màn tạo booking cũ, KH mới được chọn sẵn, không nhân đôi màn – kiểm tay Task 4.
4. **Bấm Lưu / Gửi yêu cầu / Xoá liên tiếp** → một lần ghi (ref + `loading`) – Task 3/4/5.
5. **Khách doanh nghiệp vs cá nhân**: đổi loại khi đang nhập không làm mất lỗi/giá trị sai trường (CCCD ↔ MST), form key `customer` vs `customer_org` đúng – test Task 1.

---

## File Structure

```
lib/customerRules.ts                   luật thuần chép từ web (W1–W6, R1)                 [Task 1]
tests/customer-rules.test.cjs                                                           [Task 1]
sevicesSupabase/CustomerRulesService.ts   đọc cấu hình trùng/bắt buộc/ẩn, kiểm trùng,
                                          gửi yêu cầu trùng, khoá định danh, đếm pre-booking [Task 2]
sevicesSupabase/CustomerService.ts        B1 getCustomerTransactions; W5 deleteCustomer     [Task 2]
tests/customer-rules-service.test.cjs                                                   [Task 2]
components/customer/CustomerForm.tsx      form dùng chung tạo/sửa                          [Task 3]
components/customer/DuplicateSheet.tsx    hộp trùng khách (block/request)                  [Task 3]
components/customer/CustomerListItem.tsx  dòng danh sách (memo)                            [Task 4]
app/customers.tsx                                                                        [Task 4]
app/customer/new.tsx, app/customer/[id]/edit.tsx, app/booking/create.tsx (B3)            [Task 4]
app/customer/[id]/index.tsx, app/customer/[id]/contracts.tsx, app/customer/[id]/_layout.tsx [Task 5]
app/contacts.tsx, eslint.config.js, docs/superpowers/specs (0.2: R6)                     [Task 6]
```

---

### Task 1: `lib/customerRules.ts` – luật thuần theo web

**Interfaces – Produces:**
- `type DuplicateMode = 'allow'|'request'|'block'`, `type DuplicateField = 'cccd'|'phone'|'email'|'tax_code'|'full_name'`, `type ProtectionRuleKey`, `type CustomerDuplicateConfig` – y hệt web.
- `DEFAULT_CUSTOMER_DUPLICATE`, `normalizeDuplicateConfig(raw)`, `modeOf(cfg, field)`, `strictest(a, b)`, `PROTECTION_RULES` (thứ tự mạnh → yếu), `DUPLICATE_FIELD_LABEL` – chép web.
- `evaluateProtection(input: { stages: string[]; careCount: number; lastCareAt: string|null; createdAt: string|null; now: number }, cfg)` → `DuplicateProtection` (level, score, reasons, ruleKey, ruleLabel, ruleMode) – thân chép `evaluateProtection` web, phần truy vấn tách ra (stages = `giai_doan` các phiếu).
- `finalDuplicateMode(fieldModes: DuplicateMode[], protection, isOwn, cfg)` → mode của một khách trùng (own → `cfg.ownDuplicateMode`; khác → `applyProtection`).
- `duplicateValues(form: CustomerFormValues)` → `Partial<Record<DuplicateField,string>>` (full_name = tên công ty nếu DN, else họ tên; phone = SĐT chính; tax_code chỉ DN).
- `type CustomerFormValues = { isPersonal: boolean; name; phone; phone2; email; cccd; taxCode; diaChi; statusId; sourceId; notes; nguoiDaiDienPl; chucVu; nddDienThoai; nddEmail; nddSoCccd }` (chuỗi).
- `customerFormKey(isPersonal, isAgency, knownKeys: string[])` → `'customer'|'customer_org'|'agency_customer'|'agency_customer_org'` (agency chỉ khi có trong `knownKeys` – như `agencyFormKey`).
- `APP_FIELD_OF: Record<string, keyof CustomerFormValues>` – ánh xạ key cấu hình web → trường form app: cá nhân `TenKH→name, DiDong→phone, Email→email, SoCMND→cccd, MaSoTTNCN→taxCode, DiaChi→diaChi, ThuongTru→diaChi, MaTT→statusId, MaNguon→sourceId`; DN `TenCongTy→name, DienThoaiCT→phone, EmailCT→email, MaSoThueCT→taxCode, DiaChiCT→diaChi, MaTT, MaNguon, NguoiDaiDienPL→nguoiDaiDienPl, ChucVu→chucVu, NDDDienThoai→nddDienThoai, NDDEmail→nddEmail, NDDSoCCCD→nddSoCccd`; `MaSoKH` coi như có (app tự sinh).
- `checkRequired(requiredKeys: string[], hidden: Set<string>, values, labels: Record<string,string>)` → `{ ok; fieldErrors: Partial<Record<keyof CustomerFormValues,string>>; unsupported: string[] (nhãn); message }` – trường ẩn bỏ qua; key có trong `APP_FIELD_OF` mà rỗng → lỗi dưới trường "Vui lòng nhập {nhãn}"; key không có trên app → `unsupported` (R1).
- `STAGE_LABEL` + `stageLabel(code)` (W6; lạ → chính mã).
- `mapCustomerTransaction(row, lookups: { products; projects; statuses })` → `{ id; soPhieu; giaiDoan; stageLabel; tenDA; kyHieu; giaTri; tienCoc; daThu; status; statusColor; createdAt }` (giá trị = `gia_tri_hd_sau_ck ?? gia_tri_hd`).

- [ ] **Step 1: Test** `tests/customer-rules.test.cjs` (loadTs): `normalizeDuplicateConfig(null)` = mặc định (defaultMode block, ownDuplicateMode block, protection contract/deposit block, booking request, care_recent request 30 ngày, care_old tắt 90, new_contact request 7); JSON thiếu/sai kiểu giữ mặc định từng trường; `modeOf` tiêu chí chưa cài → defaultMode; `evaluateProtection` với stages `['HDMB']` → level high, ruleKey contract, ruleMode block; `['GIUCHO']` → booking/request/medium; chăm sóc 10 ngày trước → care_recent; khách tạo 3 ngày có 1 chăm sóc (không giao dịch) → care_recent trước new_contact (thứ tự web); `protectionEnabled=false` → ruleMode null; `finalDuplicateMode(['allow'], prot request, false)` → request, `isOwn` → ownDuplicateMode; `duplicateValues` DN lấy tên công ty + MST, cá nhân bỏ MST; `customerFormKey(false, true, ['customer_org'])` → `customer_org`, `(true, true, ['agency_customer'])` → `agency_customer`; `checkRequired(['TenKH','NgaySinh','Email'], new Set(['Email']), {name:''…})` → fieldErrors.name, unsupported ['Ngày sinh'], không có lỗi Email (bị ẩn); `stageLabel('DATCOC')` "Đặt cọc"; `mapCustomerTransaction` lấy `gia_tri_hd_sau_ck` trước `gia_tri_hd`.
- [ ] **Step 2: Chạy** → FAIL. **Step 3: Viết.** **Step 4: Chạy** → PASS.

---

### Task 2: `CustomerRulesService` + sửa `CustomerService` (B1, W5)

**Interfaces – Consumes:** Task 1. **Produces:**
- `getDuplicateConfig(): Promise<CustomerDuplicateConfig>` – `cloud_catalogs` `select=raw`, `ma_ctdk_uid=eq.{companyId}`, `catalog_type=eq.customer_duplicate`, `item_code=eq.default`; lỗi/rỗng → `DEFAULT_CUSTOMER_DUPLICATE`.
- `checkDuplicate(values: CustomerFormValues, excludeId?: string|null): Promise<{ mode; matches: DuplicateMatch[] }>` – mỗi tiêu chí (bỏ `allow`/rỗng): `cloud_customers` `select=id,ten_kh,ten_cong_ty,ma_so_kh,di_dong,dien_thoai,cccd,created_by_id`, `ma_ctdk=eq.{companyId}`, `or=(cột.eq.giá trị)` (cột theo web `FIELD_COLUMNS`, bỏ ký tự `,)`), `id=neq.{excludeId}`, `limit=10`; gộp theo id; mỗi khách: phiếu (`cloud_pgc_phieu_giucho` `select=giai_doan`, `khach_hang_id`, `deleted_at=is.null`, limit 200), chăm sóc (`cloud_customer_activities` `select=thoi_gian`, `ma_ctdk`, `khach_hang_id`, `order=thoi_gian.desc`, `limit=1`, `Prefer: count=exact`), `created_at`, tên người tạo (`dm_employees` `ho_ten,ma_nv`) → `evaluateProtection` + `finalDuplicateMode` (isOwn = `created_by_id === getEmployeeId()`).
- `createDuplicateRequest(match, values, note): Promise<{ ok; message? }>` – insert `cloud_customer_dup_requests` với các cột y hệt web `CustomerDupRequestService.create` (`ma_ctdk` = **mã công ty chữ thường** `getCompanyCode()`, `company_id` = `getBranchId()` nếu uuid, `trang_thai: 'pending'`, `new_customer_payload` dạng PascalCase như form web: `IsPersonal, TenKH, TenCongTy, DiDong, DiDong2, Email, SoCMND, MaSoThueCT, MaSoTTNCN, DiaChi, MaTT, MaNguon`), rồi insert log `cloud_customer_dup_request_logs` (`hanh_dong: 'create'`, lỗi log không chặn).
- `getFormRules(isPersonal): Promise<{ formKey; required: string[]; hidden: Set<string>; readonly: Set<string>; labels }>` – `cloud_required_field_configs` (`ma_ctdk=eq.{mã công ty}`, `is_active` khác false) + `cloud_field_visibility_configs` (chung + riêng nhóm `per_id`/`dm_employees.perm_group_uid` (R2), nhóm ghi đè chung; claim `is_full_access` → không ẩn); lỗi → không ràng buộc thêm. Nhãn trường chép từ `requiredFieldCatalog` web cho các key ở `APP_FIELD_OF` + các key thường gặp khác (key lạ → hiện chính key).
- `hasIdentityLock(customerId): Promise<boolean>` – `cloud_signing_appointments` `select=seq`, `ma_ctdk_uid=eq.{companyId}`, `is_personal=eq.true`, `khach_hang_id=eq.{id}`, `Prefer: count=exact`, `limit=1`; lỗi → false (như web).
- `CustomerService.deleteCustomer`: thêm kiểm `cloud_pre_bookings` (`ma_ctdk_uid`, `khach_hang_id`, `deleted_at=is.null`, count) trước → `{ status: 400, message: 'Khách hàng đã có {n} phiếu booking, không được phép xóa.' }`; giữ kiểm hiện có (R3).
- `CustomerService.getCustomerTransactions` (B1): chọn cột đúng, không embed, lọc `deleted_at=is.null`, tra `bds_products(id,ma_sp,ky_hieu)`, `da_projects(id,ten_da)`, `cloud_catalogs(id,item_name,color_code)` bằng `id=in.(…)`, map bằng `mapCustomerTransaction`.

- [ ] **Step 1: Test** `tests/customer-rules-service.test.cjs` (vm harness tự chứa như `booking-write.test.cjs`): cấu hình rỗng → mặc định; `checkDuplicate` SĐT trùng khách có phiếu HDMB → mode block, match có protection high; `excludeId` được gửi `id=neq.`; tiêu chí `allow` không truy vấn; `createDuplicateRequest` ghi `ma_ctdk` = mã chữ thường, `trang_thai` pending, payload PascalCase, rồi ghi log; `deleteCustomer` có pre-booking → 400 với đúng câu, không gọi DELETE; `getCustomerTransactions` không dùng `!` trong select, không chọn `tong_gia_tri`, trả `giaTri`, `tenDA`, `kyHieu`, `stageLabel`.
- [ ] **Step 2–4:** FAIL → viết → PASS. Check chuẩn.

---

### Task 3: `CustomerForm` + `DuplicateSheet`

**Interfaces – Produces:**
- `CustomerForm({ mode: 'create'|'edit'; initial?: Partial<CustomerFormValues>; customerId?: string; statusOptions; sourceOptions; onSaved: (row) => void; submitLabel })` – quản lý state, lỗi, loading; khi lưu: `checkRequired` (lỗi dưới trường; `unsupported` → toast error R1) → `checkDuplicate` (bỏ qua chính nó khi sửa) → `allow` lưu `saveCustomerCloud` (payload giữ nguyên như màn cũ) / khác → mở `DuplicateSheet`. Ref chặn lưu 2 lần.
- Bố cục: `SegmentedControl` Cá nhân / Doanh nghiệp (khi sửa giữ được đổi như cũ); `TextField` (họ tên/tên công ty, SĐT chính, SĐT phụ, email, CCCD hoặc MST, địa chỉ, ghi chú khi tạo); DN thêm mục "Người đại diện" (5 trường như màn sửa cũ); `SelectField` Trạng thái & Nguồn khách (thay hàng chip ngang); dấu * theo cấu hình (W2) + luật app cũ (tên, SĐT; MST với DN); trường `hidden` không hiện; `readonly` và khoá định danh (W4: tên + CCCD, kèm `helper` = câu web "Khách hàng đã có lịch ký — …") → `editable={false}`.
- `DuplicateSheet({ visible; result; values; onClose; onUseExisting(match); onRequested })` – `BottomSheet`: tiêu đề theo mode ("Không cho phép trùng khách hàng" / "Khách hàng bị trùng — cần gửi yêu cầu"), mỗi khách trùng: tên, mã, SĐT, người phụ trách, tiêu chí trùng, `Badge` mức bảo vệ (none neutral / low info / medium warning / high danger) + lý do; nút "Dùng khách này" (tạo từ booking → chọn cho booking, còn lại → mở hồ sơ); mode request: `TextField` ghi chú + nút "Gửi yêu cầu" (`createDuplicateRequest`, toast success "Đã gửi yêu cầu, chờ quản lý phân xử" rồi `onRequested`).

- [ ] Step 1: Viết 2 component. Step 2: Check chuẩn.

---

### Task 4: Danh sách, Thêm, Sửa khách + luồng từ booking (B3)

- **`customers.tsx`:** giữ `fetchCustomers` (params, phân trang, `authError`), `useFocusEffect` tải lại, `embedded`. `Screen` + `AppHeader "Khách hàng"` (subtitle "{total} khách hàng", action `IconButton Plus` "Thêm khách hàng", `hideBack={embedded}`) → sticky: `SearchBar` (debounce 300 bằng `useDebouncedValue`, thay 400 tự viết) + `SegmentedControl` Tất cả / Cá nhân / Doanh nghiệp + hàng `Chip` trạng thái (màu từ danh mục) → `FlatList` `CustomerListItem` (memo: `Avatar` tên, tên `subhead`, mã · loại `caption`, SĐT đã che (`maskPhone`) hoặc CCCD/MST, `StatusBadge` trạng thái; nút `IconButton Phone` "Gọi" và "Zalo" ≥ 44) → skeleton / lỗi phiên (EmptyState + "Đăng nhập lại") / rỗng (có CTA "Thêm khách hàng") / tải thêm. Nhấn giữ để xoá → **bỏ** (xoá ở chi tiết, tránh xoá nhầm); không có SĐT → nút gọi ẩn (thay Alert).
- **`customer/new.tsx`:** `AppHeader "Thêm khách hàng"` + `CustomerForm mode="create"`; lưu xong: từ booking → `router.dismissTo({ pathname: '/booking/create', params: { dataBooking, newCustomer: JSON.stringify(row) } })` (B3); còn lại toast success + `router.back()`. Phiên hết hạn (`needLogin`) → `confirm` "Đăng nhập lại".
- **`booking/create.tsx`** (B3): `newCustomer` parse → `normalizeCustomer`; `useEffect` theo param để chọn KH khi quay về.
- **`customer/[id]/edit.tsx`:** `AppHeader "Sửa khách hàng"` + `CustomerForm mode="edit"` (tải chi tiết + `hasIdentityLock`); lưu xong toast + back.

- [ ] Step 1: `CustomerListItem` + `customers.tsx`. Step 2: new/edit/booking. Step 3: Check chuẩn + `npx expo export --platform ios` BUNDLE_OK.

---

### Task 5: Chi tiết khách & Giao dịch

- **`customer/[id]/index.tsx`:** giữ `getCustomerDetailCloud`, tải lại khi focus. `AppHeader "Khách hàng"` (actions: `IconButton Pencil` "Sửa", `IconButton Trash2` "Xoá") → khối đầu: `Avatar size 56`, tên `title`, công ty/sàn, `Badge` mã KH + `StatusBadge` trạng thái (ẩn khi chưa có – như danh sách) → hàng nút nhanh Gọi / Zalo / Email (≥ 44; thiếu dữ liệu thì ẩn) → `Card` "Thông tin" `KeyValueRow` (SĐT chính/phụ, email, CCCD, MST, nguồn, địa chỉ, người đại diện + chức vụ với DN) → `ListItem` "Giao dịch" (chevron → contracts). Xoá: `confirm` destructive → `deleteCustomer` → toast + back; lỗi → toast error với message service. Bỏ modal nhật ký chết (R4). Skeleton khi tải, `ErrorState` khi không tìm thấy.
- **`customer/[id]/contracts.tsx`:** `AppHeader "Giao dịch của khách"` + `SearchBar` (số phiếu, căn, dự án) + `FlatList` `ListItem`: tiêu đề số phiếu, dòng phụ "{dự án} · {căn}", meta "{giai đoạn} · {ngày}", trailing giá trị `MoneyText short` + `StatusBadge` (B2); skeleton / rỗng / lỗi; kéo làm mới.
- `_layout.tsx`: `headerShown: false` cho cả 3 màn (dùng `AppHeader`).

- [ ] Step 1: chi tiết. Step 2: giao dịch. Step 3: Check chuẩn.

---

### Task 6: contacts, lint strict, spec, commit, review

- `contacts.tsx` (R5): `AppHeader "Danh bạ"`, `SearchBar`, `SectionList` theo chữ cái, `ListItem` + `Avatar`; giữ mock + điều hướng chat.
- `UI_STRICT_FILES` += `'app/customers.tsx'`, `'app/customer/**/*.{ts,tsx}'`, `'app/contacts.tsx'`, `'components/customer/**/*.{ts,tsx}'`.
- Spec mục 0.2 thêm R6.
- [ ] Check chuẩn + `npx expo export --platform ios|web` + lint tổng không tăng → commit `feat(ui): phase 4 – khách hàng`. **Không push.**
- [ ] Review toàn giai đoạn bằng agent riêng (opus); sửa Critical/Important trong commit riêng.

## Ngoài phạm vi Giai đoạn 4

- Trường form web chưa có trên app (danh xưng, ngày sinh, nơi cấp, ảnh CCCD, tài khoản ngân hàng, người uỷ quyền…) – R1 chặn khi bị bắt buộc.
- Nhật ký chăm sóc (R4), yêu cầu trùng: danh sách/huỷ/phân xử (chỉ quản lý dùng trên web).

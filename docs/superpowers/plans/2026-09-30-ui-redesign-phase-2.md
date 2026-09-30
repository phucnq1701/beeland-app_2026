# Redesign UI Beeland Sales – Giai đoạn 2 (Điều hướng & Trang chủ) – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa khung điều hướng (tab bar) và các màn "vỏ" của app – Trang chủ, Tất cả quản lý, Tài khoản, Thông tin cá nhân – sang design system đã có ở Giai đoạn 0–1.

**Architecture:** Dùng lại `components/ui` + token `theme/`. Logic chọn/sắp xếp mục tính năng và bảng tuyến đường tính năng (đang bị viết lặp ở 3 màn) gom vào hàm thuần `lib/featureConfig.ts` có test. Màn lớn tách khối con vào `components/home/`. Không đổi service/API, khoá AsyncStorage hay điều hướng.

**Tech Stack:** như Giai đoạn 0–1 (Expo 54, RN 0.81, expo-router 6, lucide, `node:test`).

**Spec:** `docs/superpowers/specs/2026-09-30-ui-redesign-design.md` (mục 7, dòng GĐ2). Nền tảng: plan `docs/superpowers/plans/2026-09-30-ui-redesign-phase-0-1.md`.

## Global Constraints

- Nhánh `devhuan2`. **Chỉ commit local**; không push, không PR, không `eas update`/`eas build`.
- **1 commit cho cả giai đoạn**: `feat(ui): phase 2 – điều hướng & trang chủ` + dòng `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Không thêm dependency. Không đổi lời gọi service, payload, khoá AsyncStorage (`@home_features_config`, `@menu_tabs_config`, `@type_account`, `@token`, `@supabase_jwt`), logic kiểm tra token ở Home, hay đường dẫn điều hướng.
- Màu chỉ từ `@/theme`; file đã migrate vào `UI_STRICT_FILES` (lint chặn hex/rgba).
- Chữ qua `Text` (caption 14/20, nhỏ nhất 12). Chạm ≥ 44. Nút chỉ có icon phải có `accessibilityLabel`.
- Toast cho thông báo thường; `confirm()` cho thao tác phá huỷ; lỗi chặn mới dùng Alert.
- Icon tính năng: **một tông** (nền `primarySubtle`, icon `brand`) – bỏ 9 màu cầu vồng (spec 1.2). Dữ liệu `mocks/features.ts` (id, title, icon) giữ nguyên; bỏ qua `backgroundColor`/`iconColor`.

**Baseline** (trên `ae26cbcb`): `tsc` 5 lỗi cũ; `npx expo lint` 11 errors / 91 warnings; `node --test tests/` 55 pass. "Check chuẩn" như plan GĐ0–1 (tsc = 5, test 0 fail, eslint file đụng tới sạch, `npx expo export --platform ios` → BUNDLE_OK).

## Quyết định cần người dùng xác nhận trước khi chạy plan

Plan đã chọn mặc định (ghi **[MĐ]**); đổi thì sửa task tương ứng trước khi thực thi.

| # | Phát hiện | Mặc định |
|---|---|---|
| Q1 | `app/notifications.tsx` gọi `NotificationService.getNotifications` nhưng **chỉ `console.log`**, màn vẫn hiển thị `mocks/notifications`. Badge chuông ở Home cũng đếm từ mock → số chưa đọc là **số giả**. | **[MĐ]** Theo D11 (màn mock không tái cấu trúc): **không sửa màn Thông báo** ở GĐ2; ở Home **bỏ số trên badge** (chuông vẫn mở màn Thông báo). Nối dữ liệu thật để một đợt riêng khi có API rõ trường "đã đọc". |
| Q2 | `app/manage-features.tsx` **không có màn nào điều hướng tới**, trùng chức năng tab "Trang chủ" của `all-management`. | **[MĐ]** Xoá (như `booking/payment-method` ở GĐ1). |
| Q3 | Mục "Cài đặt" ở tab Tài khoản bấm **không làm gì**. | **[MĐ]** Đổi thành "Cấu hình trang chủ & menu" → mở `/all-management`. |
| Q4 | Tính năng "Hoa hồng" (id 7) chưa có màn; bấm hiện không phản hồi. | **Đã chốt:** ẩn mọi tính năng chưa có màn (`routeForFeature` = null) khỏi Home, Tất cả quản lý, tab menu, Tài khoản cho đến khi có màn thật. |

## Review Focus

1. **Tài khoản đại lý (`@type_account = 'AGENCY'`)** chỉ được thấy/chọn các mục `1, 2, 5, 13` ở cả Home, Tất cả quản lý và tab menu – test ở Task 1.
2. **Cấu hình AsyncStorage cũ/hỏng** (id không còn trong `features`, JSON lỗi, mảng rỗng) → Home vẫn hiện mặc định, không crash – test ở Task 1 (`normalizeSelection`).
3. **Home khi một nguồn dữ liệu lỗi** (vd DatCoc lỗi, Booking OK) → chỉ khối đó báo lỗi + "Thử lại", các khối khác vẫn hiển thị – kiểm ở Task 3.
4. **Tab bar với cỡ chữ hệ thống lớn / tên tính năng dài** ("Khách hàng", "Hợp đồng") → nhãn 1 dòng, không đẩy lệch icon – kiểm ở Task 2.
5. **Đăng xuất / Xoá tài khoản bấm liên tiếp** → chỉ một lần gọi service (nút `loading`) – kiểm ở Task 5.

---

## File Structure

```
lib/featureConfig.ts              FEATURE_ROUTES, routeForFeature, AGENCY_FEATURE_IDS,
                                  visibleFeatureIds, toggleSelection, moveItem, normalizeSelection   [Task 1]
tests/feature-config.test.cjs                                                                        [Task 1]
components/ui/SegmentedControl.tsx   chọn 2–3 phân đoạn (tab Trang chủ / Tab menu)                    [Task 4]
components/home/FeatureTile.tsx      ô tính năng một tông (+ trạng thái chọn/sắp xếp ở chế độ sửa)    [Task 3]
components/home/HomeHeader.tsx       chào + chuông                                                   [Task 3]
components/home/ProjectCarousel.tsx  dự án nổi bật (card trưng bày navy)                             [Task 3]
components/home/RecentSection.tsx    khối "gần đây" có skeleton / rỗng / lỗi                         [Task 3]
app/(tabs)/_layout.tsx               tab bar                                                        [Task 2]
app/(tabs)/home.tsx                  trang chủ                                                      [Task 3]
app/all-management.tsx               tất cả quản lý + cấu hình                                      [Task 4]
app/(tabs)/account.tsx, app/profile.tsx                                                             [Task 5]
app/manage-features.tsx              xoá (Q2)                                                        [Task 6]
eslint.config.js                     mở rộng UI_STRICT_FILES                                         [Task 6]
```

---

### Task 1: `lib/featureConfig.ts` – gom logic tính năng

**Files:**
- Create: `lib/featureConfig.ts` (không import gì), `tests/feature-config.test.cjs`

**Interfaces – Produces:**
- `FEATURE_ROUTES: Record<string, string>` = `{ '1': '/projects', '2': '/products', '3': '/appointments', '4': '/locked-units', '5': '/bookings', '6': '/customers', '8': '/contracts', '9': '/reports', '13': '/deposits' }` (đúng như `all-management.tsx` hiện tại; id 7 không có).
- `routeForFeature(id: string): string | null`
- `AGENCY_FEATURE_IDS = ['1', '2', '5', '13'] as const`
- `visibleFeatureIds(allIds: string[], opts: { isAgency: boolean; menuOnly: boolean; menuEligible: string[] }): string[]` – thứ tự giữ theo `allIds`; **luôn loại id không có route** (Q4).
- `type ToggleResult = { next: string[]; error: string | null }`
- `toggleSelection(selected: string[], id: string, opts: { min: number; max: number; tooManyMessage: string; tooFewMessage: string }): ToggleResult` – bỏ chọn khi `selected.length <= min` → giữ nguyên + `tooFewMessage`; chọn thêm khi `>= max` → giữ nguyên + `tooManyMessage`.
- `moveItem(list: string[], id: string, dir: -1 | 1): string[]` – ngoài biên hoặc không có id → trả mảng mới giống cũ.
- `normalizeSelection(raw: unknown, allIds: string[], fallback: string[]): string[]` – nhận giá trị đã `JSON.parse` (hoặc bất kỳ); lấy `raw.selectedIds` nếu là mảng, lọc id không còn tồn tại, bỏ trùng; kết quả rỗng → `fallback`.

- [ ] **Step 1: Viết test** (nạp bằng `tests/helpers/loadTs.cjs`, so object qua `JSON`):
```js
test("routes match the existing screens; commission has none", () => {
  assert.equal(f.routeForFeature("5"), "/bookings");
  assert.equal(f.routeForFeature("13"), "/deposits");
  assert.equal(f.routeForFeature("7"), null);
  assert.equal(f.routeForFeature("99"), null);
});
test("agency accounts only see projects, products, bookings, deposits", () => {
  const all = ["1","2","3","4","5","6","7","8","9","13"];
  const menuEligible = ["1","2","3","4","5","6","8","9","13"];
  assert.deepEqual(plain(f.visibleFeatureIds(all, { isAgency: true, menuOnly: false, menuEligible })), ["1","2","5","13"]);
  assert.deepEqual(plain(f.visibleFeatureIds(all, { isAgency: false, menuOnly: true, menuEligible })), menuEligible);
  assert.deepEqual(plain(f.visibleFeatureIds(all, { isAgency: false, menuOnly: false, menuEligible })), all.filter((id) => id !== "7"));
});
test("toggleSelection enforces min and max with the given messages", () => {
  const o = { min: 1, max: 2, tooManyMessage: "max", tooFewMessage: "min" };
  assert.deepEqual(plain(f.toggleSelection(["1"], "2", o)), { next: ["1","2"], error: null });
  assert.deepEqual(plain(f.toggleSelection(["1","2"], "3", o)), { next: ["1","2"], error: "max" });
  assert.deepEqual(plain(f.toggleSelection(["1"], "1", o)), { next: ["1"], error: "min" });
  assert.deepEqual(plain(f.toggleSelection(["1","2"], "1", o)), { next: ["2"], error: null });
});
test("moveItem swaps neighbours and ignores out-of-range moves", () => {
  assert.deepEqual(plain(f.moveItem(["a","b","c"], "b", -1)), ["b","a","c"]);
  assert.deepEqual(plain(f.moveItem(["a","b","c"], "c", 1)), ["a","b","c"]);
  assert.deepEqual(plain(f.moveItem(["a","b"], "x", 1)), ["a","b"]);
});
test("normalizeSelection survives stale or corrupted storage", () => {
  const all = ["1","2","5"];
  assert.deepEqual(plain(f.normalizeSelection({ selectedIds: ["5","99","5","1"] }, all, ["1"])), ["5","1"]);
  assert.deepEqual(plain(f.normalizeSelection({ selectedIds: [] }, all, ["1","2"])), ["1","2"]);
  assert.deepEqual(plain(f.normalizeSelection(null, all, ["1"])), ["1"]);
  assert.deepEqual(plain(f.normalizeSelection("garbage", all, ["2"])), ["2"]);
});
```
- [ ] **Step 2: Chạy** `node --test tests/feature-config.test.cjs` → FAIL (ENOENT).
- [ ] **Step 3: Viết `lib/featureConfig.ts`.**
- [ ] **Step 4: Chạy lại** → PASS (5 test). **Step 5: Check chuẩn.**

---

### Task 2: Tab bar (`app/(tabs)/_layout.tsx`)

**Files:** Modify `app/(tabs)/_layout.tsx`

- Giữ nguyên cơ chế 2 tab động (`loadMenuTabIds`, `useFocusEffect`) và tên route.
- `tabBarActiveTintColor = colors.primary`, `tabBarInactiveTintColor = colors.textTertiary`; nền `colors.surface`, viền trên `colors.border` hairline, bóng `elevation.raised` (bỏ khối `Platform.select` viết tay).
- Nhãn: `tabBarLabel` render `Text variant="label"` (12/16, không in hoa, `letterSpacing: 0`), `numberOfLines={1}`, màu theo `focused`; `tabBarAllowFontScaling: false` cho nhãn tab (tránh vỡ thanh – ngoại lệ có chủ đích với MAX_FONT_SCALE).
- Icon 24, `strokeWidth` 2.25 khi focused / 1.75 khi không; icon tính năng lấy từ `features` như cũ nhưng **cùng màu** active/inactive ở trên.
- Chiều cao: `56 + insets.bottom`, `paddingTop: 6`.
- `tabBarAccessibilityLabel` = tên tab.

- [ ] **Step 1: Sửa file.** **Step 2: Check chuẩn.**
- [ ] **Step 3: Kiểm tay (người dùng):** 4 tab hiển thị 1 dòng nhãn với cỡ chữ hệ thống lớn nhất; đổi 2 tab giữa trong Tất cả quản lý → quay lại tab bar cập nhật tên + icon.

---

### Task 3: Trang chủ (`app/(tabs)/home.tsx`)

**Files:**
- Modify: `app/(tabs)/home.tsx`
- Create: `components/home/HomeHeader.tsx`, `components/home/FeatureTile.tsx`, `components/home/ProjectCarousel.tsx`, `components/home/RecentSection.tsx`

**Interfaces – Produces:**
- `HomeHeader({ name?: string | null; onBellPress: () => void })` – dòng 1 caption `textSecondary` "Xin chào", dòng 2 `title` tên (không có → "Beeland Sales"); bên phải `IconButton icon={Bell} accessibilityLabel="Thông báo"`, **không badge số** (Q1).
- `FeatureTile({ feature: { id: string; title: string; icon: LucideIcon }; onPress: () => void; selected?: boolean; editing?: boolean; order?: number })` – ô vuông: icon 24 `brand` trên nền `primarySubtle` 48×48 radius `md`, nhãn `caption` 2 dòng giữa; `editing` → viền 2px `primary` khi `selected`, số thứ tự `order` ở góc (Badge brand); `accessibilityState={{ selected }}` khi editing.
- `ProjectCarousel({ projects: any[]; loading: boolean; error: boolean; onRetry: () => void; onPress: (p) => void; onSeeAll: () => void })` – `FlatList` ngang, card 280×200 tone showcase: ảnh (`expo-image`, fallback `DEFAULT_PROJECT_IMAGE` hiện có) + lớp phủ `showcase.bg` phía dưới chứa tên dự án (`heading` màu `showcase.text`) và vị trí (`caption` `showcase.textMuted`); chấm phân trang dưới carousel (chấm active `brand`).
- `RecentSection<T>({ title: string; items: T[]; loading: boolean; error: boolean; onRetry: () => void; onSeeAll: () => void; renderItem: (item: T) => ReactNode; emptyText: string })` – `SectionHeader` + `Card padding={0}`: loading → `SkeletonList count={3}`; error → dòng `caption danger` "Không tải được" + link "Thử lại"; rỗng → `caption textSecondary` `emptyText`; có dữ liệu → các dòng `ListItem` phân cách hairline.

**Hành vi màn:**
- Giữ nguyên: kiểm tra token/JWT → `/login`, `loadFeatureConfiguration`, các loader (`ProjectService.getProjects`, `BookingService.listBookingsFromCloud`, `DatCocService.get` khi không phải đại lý, `CustomerService.getCustomers`, `LichHenService.listRecent`), `useFocusEffect` làm mới booking, điều hướng `router.push` hiện có.
- Thêm state lỗi theo khối (`projectsError`, `bookingsError`, `depositsError`, `customersError`) set trong `catch` sẵn có; `loading*` theo khối (true từ lúc gọi đến `finally`).
- `normalizeSelection` (Task 1) thay đoạn đọc cấu hình tự viết; đại lý lọc bằng `visibleFeatureIds`.
- Bố cục (`Screen` scroll, `onRefresh` gọi lại tất cả loader song song): `HomeHeader` → lưới `FeatureTile` 3 cột (tối đa 6 mục + ô "Tất cả" (icon `LayoutGrid`) → `/all-management`) → `ProjectCarousel` → `RecentSection` Booking (ListItem như danh sách booking GĐ1: Avatar, tên KH, mã căn · dự án, MoneyText short + StatusBadge) → Đặt cọc (nếu không phải đại lý) → Khách hàng (Avatar, tên, `maskPhone`).
- Bỏ: `LinearGradient` nền, các animation `headerOpacity/headerTranslateY/featuresAnimations/badgePulse/cardsScale/shimmerAnim`, `Dimensions.get` (dùng `useWindowDimensions` nếu cần), `mocks/notifications`.
- Bấm tính năng: `routeForFeature(id)` (mục không có route đã bị ẩn – Q4; nếu vẫn gặp `null` thì bỏ qua).
- Tab bar nổi → `Screen` cần chừa đáy: thêm `contentContainerStyle` padding đáy 100 (như `bookings` khi `embedded`) – dùng prop mới `bottomInset?: number` của `Screen` (sửa `components/ui/Screen.tsx`, mặc định 0).

- [ ] **Step 1: Thêm prop `bottomInset` vào `Screen`.** Check chuẩn.
- [ ] **Step 2: Viết 4 component `components/home/*`.** Check chuẩn.
- [ ] **Step 3: Viết lại JSX `home.tsx`** theo bố cục; màn < 400 dòng.
- [ ] **Step 4: Check chuẩn** + `grep -c "mocks/notifications" "app/(tabs)/home.tsx"` → 0.
- [ ] **Step 5: Kiểm tay (người dùng):** kéo làm mới; bật máy bay rồi kéo → từng khối báo "Không tải được · Thử lại", header + lưới tính năng vẫn dùng được; tài khoản đại lý không thấy khối Đặt cọc và chỉ thấy 4 tính năng; không còn thấy mục "Hoa hồng".

---

### Task 4: Tất cả quản lý (`app/all-management.tsx`) + `SegmentedControl`

**Files:**
- Create: `components/ui/SegmentedControl.tsx` (+ export ở `components/ui/index.ts`)
- Modify: `app/all-management.tsx`

**Interfaces – Produces:**
- `SegmentedControl<T extends string>({ value: T; options: { value: T; label: string }[]; onChange: (v: T) => void })` – nền `surfaceMuted` radius `md` padding 4; đoạn chọn: nền `surface` + `elevation.raised`, chữ `subhead`; đoạn khác chữ `textSecondary`; mỗi đoạn cao ≥ 40, `accessibilityRole="tab"`, `accessibilityState={{ selected }}`.

**Hành vi màn:**
- Giữ nguyên: đọc/ghi AsyncStorage (khoá, `saveMenuTabIds`), `handleTabSwitch` huỷ thay đổi chưa lưu, `isEditMode`, điều hướng.
- Thay logic trong `handleFeatureToggle`, `handleMoveUp/Down`, `selectableFeatures`, `handleFeaturePress` bằng `toggleSelection` / `moveItem` / `visibleFeatureIds` / `routeForFeature` (Task 1) với đúng giới hạn & câu chữ hiện có (`MAX_HOME_FEATURES`, `MAX_MENU_TABS`, min 1 cho tab menu, min 0 cho trang chủ).
- Thông báo: 5 cặp `alert`/`Alert.alert` (web/native) → **toast**: lưu thành công → success "Đã lưu cấu hình"; lưu lỗi → error "Không thể lưu cấu hình"; vượt giới hạn → info với câu `error` từ `toggleSelection`.
- Bố cục: `AppHeader title="Tất cả quản lý"` + action `Button ghost` "Sửa"/"Huỷ" → `SegmentedControl` (Trang chủ / Tab menu) → khi sửa: dòng gợi ý `editModeHintText` + danh sách "đã chọn" dạng `ListItem` có 2 `IconButton` (`ChevronUp` "Lên trên", `ChevronDown` "Xuống dưới") → `SectionHeader` "Tất cả các mục" → lưới `FeatureTile` 3 cột (`editing`, `selected`, `order`). `footer` khi sửa: `BottomActionBar` [Huỷ] [**Lưu cấu hình**].

- [ ] **Step 1: Viết `SegmentedControl`**, thêm vào UI Gallery (`app/dev/ui-gallery.tsx`, mục "Phân đoạn"). Check chuẩn.
- [ ] **Step 2: Viết lại `all-management.tsx`.** Sau bước này `grep -cE "Alert\.alert|alert\(" app/all-management.tsx` → 0.
- [ ] **Step 3: Check chuẩn.**
- [ ] **Step 4: Kiểm tay (người dùng):** chọn quá 6 mục trang chủ → toast; bỏ hết tab menu → toast "Cần chọn ít nhất 1 mục…"; đổi thứ tự rồi Lưu → Home và tab bar phản ánh đúng; chuyển tab khi đang sửa → thay đổi bị huỷ.

---

### Task 5: Tài khoản (`app/(tabs)/account.tsx`) & Thông tin cá nhân (`app/profile.tsx`)

**Files:** Modify `app/(tabs)/account.tsx`, `app/profile.tsx`

**Tài khoản – giữ nguyên:** `CloudProfileService.userInfo`, `@type_account`, `handleLogout`, luồng xoá tài khoản (`AccountDeletionService` và các nhánh `employeeDeleted`), mục quản lý nhanh (`showAllManagement`), dòng UI Gallery (dev).
- Bố cục: `Screen` (`bottomInset` 100) → card hồ sơ (Avatar 56 + tên `title` + vai trò/đơn vị `caption`; chạm → `/profile`) → `SectionHeader` "Quản lý nhanh" + lưới `FeatureTile` (thu gọn/mở rộng như hiện có) → `SectionHeader` "Cài đặt" + `Card` các `ListItem chevron`: "Thông tin cá nhân" (`/profile`), **"Cấu hình trang chủ & menu" (`/all-management`, Q3)**, "Xoá tài khoản" (chữ `danger`) → `Button variant="secondary" icon={LogOut}` "Đăng xuất" (`loading` khi đang xử lý).
- Xoá tài khoản: `Alert.alert` xác nhận (dòng ~174) → `confirm({ destructive: true, confirmText: 'Xoá tài khoản' })` giữ nguyên câu chữ; `Alert.alert(title, message)` báo lỗi/kết quả (dòng ~154) → toast error/success. Overlay "Đang xoá hồ sơ…" → `Modal` giữ nguyên nhưng nội dung dùng `Card` + `ActivityIndicator` `colors.primary` + `Text`.
- Bỏ `LinearGradient`.

**Thông tin cá nhân:** `AppHeader title="Thông tin cá nhân"`; loading → `SkeletonDetail`; chưa đăng nhập → `EmptyState` + nút "Đăng nhập" (`/login` như cũ); có dữ liệu → Avatar 56 + tên, `Card` các `KeyValueRow` (các trường đang hiển thị), SĐT/email có `copyValue`.

- [ ] **Step 1: Viết lại `account.tsx`.** Sau bước này chỉ còn `Alert` cho lỗi chặn (nếu có); ghi lại số `grep -c "Alert.alert"` trong báo cáo.
- [ ] **Step 2: Viết lại `profile.tsx`.**
- [ ] **Step 3: Check chuẩn.**
- [ ] **Step 4: Kiểm tay (người dùng):** bấm "Đăng xuất" 2 lần nhanh → một lần; xoá tài khoản → hộp thoại xác nhận nút đỏ, huỷ thì không gọi service; "Cấu hình trang chủ & menu" mở đúng màn.

---

### Task 6: Dọn dẹp, lint strict, commit Giai đoạn 2

**Files:** Delete `app/manage-features.tsx` (Q2); Modify `eslint.config.js`

- [ ] **Step 1:** `git rm app/manage-features.tsx`; `grep -rn "manage-features" app components` → không còn (trừ không có). Kiểm tra `app/_layout.tsx` không khai báo route này.
- [ ] **Step 2:** Thêm vào `UI_STRICT_FILES`: `'app/(tabs)/_layout.tsx'`, `'app/(tabs)/home.tsx'`, `'app/(tabs)/account.tsx'`, `'app/all-management.tsx'`, `'app/profile.tsx'`, `'components/home/**/*.{ts,tsx}'`.
- [ ] **Step 3: Check chuẩn** + `npx expo export --platform web` → WEB_OK + `npx expo lint` tổng không tăng so với baseline.
- [ ] **Step 4: Commit**
```bash
git add lib/featureConfig.ts tests/feature-config.test.cjs components/ui components/home "app/(tabs)" app/all-management.tsx app/profile.tsx app/manage-features.tsx app/dev/ui-gallery.tsx eslint.config.js
git status --short   # chỉ các file trên
git commit -m "feat(ui): phase 2 – điều hướng & trang chủ

- Tab bar, Trang chủ, Tất cả quản lý, Tài khoản, Thông tin cá nhân theo design system
- Icon tính năng một tông; Home có kéo làm mới, trạng thái tải/lỗi theo từng khối
- Gom logic chọn/sắp xếp/tuyến đường tính năng vào lib/featureConfig (có test)
- Alert → toast/confirm; xoá manage-features (không có đường vào)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
**Không push.**

## Ngoài phạm vi Giai đoạn 2

- `app/notifications.tsx` (Q1 – đang dùng dữ liệu mock).
- Các màn khác dùng `AppHeader` ở giai đoạn của chúng (GĐ3–6). "Dùng AppHeader toàn app" trong spec được hiểu là hoàn tất dần qua các giai đoạn, không làm hết ở GĐ2.

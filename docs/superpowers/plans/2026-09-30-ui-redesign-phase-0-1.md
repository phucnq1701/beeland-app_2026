# Redesign UI Beeland Sales – Giai đoạn 0 (Nền tảng) & 1 (Booking & Thanh toán) – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dựng design system (token, font, component `components/ui/`) rồi thiết kế lại luồng Booking → Thu tiền QR theo spec.

**Architecture:** Token thuần TS trong `theme/`, hàm thuần trong `lib/` (có test `node:test`), component React Native `StyleSheet`
trong `components/ui/` chỉ đọc token. Màn hình cũ vẫn chạy nhờ shim `constants/colors.ts`. Giai đoạn 1 viết lại phần giao diện
của 4 màn booking, **giữ nguyên mọi lời gọi service và logic nghiệp vụ**.

**Tech Stack:** Expo 54, React Native 0.81, expo-router 6, lucide-react-native, expo-font, expo-haptics, expo-clipboard,
expo-status-bar, react-native-safe-area-context, TypeScript strict, `node:test` + `typescript.transpileModule` + `vm` (như `tests/*.test.cjs`).

**Spec:** `docs/superpowers/specs/2026-09-30-ui-redesign-design.md`

## Global Constraints

- Làm trên nhánh `devhuan2`. **Chỉ commit local. Không `git push`, không tạo PR, không chạy `eas update`/`eas build`.**
- **Mỗi giai đoạn đúng 1 commit** (người dùng yêu cầu để dễ quay lại). Các task trong giai đoạn không commit; task cuối của giai đoạn commit.
  Message: `feat(ui): phase 0 – nền tảng design system` và `feat(ui): phase 1 – luồng booking & thanh toán QR`, kết thúc bằng dòng
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Không thêm dependency npm. Chỉ dùng gói đã có trong `package.json`.
- Không đổi lời gọi service/API, payload, param điều hướng hiện có (trừ điều hướng sau khi tạo booking – D8).
- Màu chỉ lấy từ `theme/colors.ts`. Không viết mã hex/rgba trong `components/ui/**`, `lib/**`, `app/dev/**` và các màn đã migrate (lint chặn, Task 11/17).
- Nút chính toàn app: `#C9501A` (`colors.primary`). `#E86F25` (`colors.brand`) không làm nền cho chữ.
- Chữ: Be Vietnam Pro; body 15/22; không cỡ chữ nào < 12; `maxFontSizeMultiplier` 1.3.
- Chạm tối thiểu 44×44; nút chỉ có icon phải có `accessibilityLabel`; dùng `Pressable`.
- Toast cho thông báo thường; `Alert`/`confirm()` chỉ cho thao tác phá huỷ và lỗi chặn; lỗi form hiện dưới ô nhập.
- Không tự tạo QR ngầm. QR cũ đã bị huỷ/hết hạn → hỏi `confirm()` trước khi tạo mã mới.
- Copy tiếng Việt có dấu, đúng như ghi trong plan/spec.

**Baseline (đo ngày 2026-09-30 trên `devhuan2` @ `b2fbae60`):**
- `npx tsc --noEmit 2>&1 | grep -c "error TS"` → **5** (4 ở `components/UpdateManager.tsx`, 1 ở `app/verify-otp.tsx`). Không được tăng.
- `npx expo lint` → 13 errors, 96 warnings. Không được tăng; file mới/đã migrate phải 0 error 0 warning.
- `node --test tests/` → 27 pass.

**Lệnh kiểm tra dùng lặp lại (gọi là "Check chuẩn"):**
```bash
npx tsc --noEmit 2>&1 | grep -c "error TS"          # kỳ vọng: 5
node --test tests/                                   # kỳ vọng: 0 fail
npx eslint <các file vừa tạo/sửa>                    # kỳ vọng: không output
npx expo export --platform ios --output-dir .expo/export-check > /dev/null && echo BUNDLE_OK   # kỳ vọng: BUNDLE_OK
```

## Review Focus

1. **Web build** (`react-native-web`, app có chạy bản web): `Alert.alert` nhiều nút không hoạt động trên web → `confirm()` phải dùng `window.confirm` khi `Platform.OS === 'web'`; haptics phải no-op trên web. Test ở Task 6.
2. **Số tiền/ngày rỗng hoặc sai kiểu** từ API (`null`, `undefined`, chuỗi `"1500000"`, `NaN`, ISO string, ngày không hợp lệ) → hiển thị `—`, không crash, không ra `NaN ₫`. Test ở Task 2.
3. **Booking không có `hetHanLuc` / `tienGiuCho = 0`** → không coi là đã thu tiền, không tính là hết hạn, màn QR không cho tạo mã (trạng thái `noDeadline`). Test ở Task 12.
4. **Font chưa nạp được** (lỗi asset, mạng khi OTA) → splash không bị kẹt: ẩn splash sau tối đa 3 giây và dùng font hệ thống. Kiểm ở Task 3.
5. **Bấm lặp nút tạo booking/tạo QR** khi mạng chậm → chỉ một request (Button `loading` chặn `onPress`). Kiểm ở Task 5 (gallery) và Task 14/16.

---

## File Structure

```
theme/colors.ts            palette + token ngữ nghĩa (work + showcase)          [Task 1]
theme/typography.ts        fonts, 7 variant, MAX_FONT_SCALE                      [Task 1]
theme/spacing.ts           space, radius, elevation, motion, hitSlop, MIN_TOUCH  [Task 1]
theme/index.ts             re-export                                             [Task 1]
lib/format.ts              định dạng tiền/ngày/SĐT/viết tắt tên                  [Task 2]
lib/countdown.ts           remainingSeconds, countdownTone                       [Task 2]
lib/useDebouncedValue.ts   hook debounce                                         [Task 2]
lib/haptics.ts             hapticSuccess/Error/Light                             [Task 6]
lib/bookingProgress.ts     suy ra 4 bước tiến độ booking                         [Task 12]
lib/qrPaymentState.ts      suy ra trạng thái màn QR                              [Task 12]
assets/fonts/*.ttf, OFL.txt                                                      [Task 3]
constants/colors.ts        shim tên cũ → token                                   [Task 4]
components/ui/*.tsx        component chuẩn + index.ts                            [Task 5–10]
app/dev/ui-gallery.tsx     màn xem component (chỉ __DEV__)                       [Task 11]
eslint.config.js           rule chặn hex trong file "strict"                     [Task 11, 17]
tests/theme-contrast.test.cjs, tests/format.test.cjs, tests/booking-progress.test.cjs, tests/qr-payment-state.test.cjs
```

Trong `tests/`, nạp file TS theo đúng mẫu `tests/document-links.test.cjs` (hàm `compile(file)` + `vm.runInNewContext` với `exports`).
Chỉ test file **không import react-native** (theme/colors.ts, lib/format.ts, lib/countdown.ts, lib/bookingProgress.ts, lib/qrPaymentState.ts).

---

# GIAI ĐOẠN 0 – Nền tảng

### Task 1: Token (`theme/`) + test tương phản

**Files:**
- Create: `theme/colors.ts`, `theme/typography.ts`, `theme/spacing.ts`, `theme/index.ts`
- Test: `tests/theme-contrast.test.cjs`

**Interfaces:**
- Produces:
  - `colors` (default + named export, `as const`) với các khoá: `primary '#C9501A'`, `primaryPressed '#A84314'`, `onPrimary '#FFFFFF'`,
    `brand '#E86F25'`, `primarySubtle '#FFF1E8'`, `onPrimarySubtle '#9A3412'`, `bg '#F6F7F9'`, `surface '#FFFFFF'`, `surfaceMuted '#F1F5F9'`,
    `border '#E4E7EC'`, `borderStrong '#CBD5E1'`, `text '#0F172A'`, `textSecondary '#475569'`, `textTertiary '#64748B'`,
    `inverse '#1E293B'`, `onInverse '#FFFFFF'`, `success '#15803D'`, `successSubtle '#DCFCE7'`, `onSuccessSubtle '#166534'`,
    `warning '#B45309'`, `warningSubtle '#FEF3C7'`, `onWarningSubtle '#92400E'`, `danger '#B91C1C'`, `dangerSubtle '#FEE2E2'`,
    `onDangerSubtle '#991B1B'`, `info '#1D4ED8'`, `infoSubtle '#DBEAFE'`, `onInfoSubtle '#1E40AF'`, `backdrop 'rgba(15, 23, 42, 0.45)'`,
    `skeleton '#EEF1F5'`, `showcase: { bg '#16233B', surface '#243556', accent '#F59E6B', paper '#F7F5F2', text '#FFFFFF', textMuted '#CBD5E1' }`.
  - `type ColorToken = Exclude<keyof typeof colors, 'showcase'>`
  - `fonts = { regular: 'BeVietnamPro-Regular', medium: 'BeVietnamPro-Medium', semibold: 'BeVietnamPro-SemiBold', bold: 'BeVietnamPro-Bold' }`
  - `type TextVariant = 'display' | 'title' | 'heading' | 'subhead' | 'body' | 'caption' | 'label'`
  - `typography: Record<TextVariant, { fontFamily: string; fontSize: number; lineHeight: number; letterSpacing?: number }>` với giá trị:
    display 28/36 bold · title 22/28 bold · heading 17/24 semibold · subhead 15/22 semibold · body 15/22 regular · caption 13/18 regular · label 12/16 semibold (letterSpacing 0.4).
  - `MAX_FONT_SCALE = 1.3`
  - `space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, x3: 32, x4: 40 }`, `radius = { sm: 8, md: 12, lg: 16, xl: 20, full: 999 }`
  - `elevation: Record<'raised' | 'overlay' | 'modal', ViewStyle>` qua `Platform.select` (iOS shadow*, Android `elevation` 4/8/16, web `boxShadow`); màu bóng `#0F172A`.
  - `motion = { press: 100, enter: 200, exit: 150 }`, `hitSlop = { top: 10, bottom: 10, left: 10, right: 10 }`, `MIN_TOUCH = 44`
  - `theme/index.ts`: `export * from './colors'; export * from './typography'; export * from './spacing';`
- `theme/colors.ts` **không import gì** (để test nạp được).

- [ ] **Step 1: Viết test tương phản** `tests/theme-contrast.test.cjs`

Hàm `ratio(a, b)` theo WCAG 2.x (relative luminance sRGB). Các test:
```js
test("text on buttons and badges meets WCAG AA 4.5:1", () => {
  const pairs = [
    ["onPrimary", "primary"], ["onPrimary", "primaryPressed"], ["onPrimarySubtle", "primarySubtle"],
    ["textSecondary", "surface"], ["textSecondary", "bg"], ["textTertiary", "surface"], ["text", "bg"],
    ["onInverse", "inverse"], ["onSuccessSubtle", "successSubtle"], ["onWarningSubtle", "warningSubtle"],
    ["onDangerSubtle", "dangerSubtle"], ["onInfoSubtle", "infoSubtle"], ["onPrimary", "danger"],
    ["primary", "surface"], ["onPrimary", "success"],
  ];
  for (const [fg, bg] of pairs) assert.ok(ratio(colors[fg], colors[bg]) >= 4.5, `${fg} on ${bg}`);
});
test("showcase text meets AA on navy", () => {
  for (const fg of ["accent", "text", "textMuted"]) assert.ok(ratio(colors.showcase[fg], colors.showcase.bg) >= 4.5, fg);
});
test("primary button is distinguishable on showcase navy (non-text 3:1)", () => {
  assert.ok(ratio(colors.primary, colors.showcase.bg) >= 3);
});
test("brand orange is never used as the primary action colour", () => {
  assert.notEqual(colors.primary, colors.brand);
});
```

- [ ] **Step 2: Chạy test, xác nhận FAIL** — `node --test tests/theme-contrast.test.cjs` → FAIL (không tìm thấy `theme/colors.ts`).
- [ ] **Step 3: Tạo 4 file `theme/` theo Interfaces.**
- [ ] **Step 4: Chạy lại test** → PASS (4 test). Nếu cặp nào < 4.5 thì spec sai – dừng và báo, không tự đổi màu.
- [ ] **Step 5: Check chuẩn** (tsc = 5, eslint 4 file mới sạch).

---

### Task 2: `lib/format.ts`, `lib/countdown.ts`, `lib/useDebouncedValue.ts`

**Files:**
- Create: `lib/format.ts`, `lib/countdown.ts`, `lib/useDebouncedValue.ts`
- Test: `tests/format.test.cjs` (nạp cả `lib/format.ts` và `lib/countdown.ts`)

**Interfaces:**
- Produces (`lib/format.ts`, không import gì; **không dùng `Intl`/`toLocaleString`** vì Hermes/Android có thể thiếu locale `vi-VN` – tự nhóm hàng nghìn bằng regex):
  - `formatNumberVN(value: unknown): string` – `"50.000.000"`; không hợp lệ → `"—"`
  - `formatVND(value: unknown): string` – `"50.000.000 ₫"`, làm tròn đơn vị đồng
  - `formatVNDShort(value: unknown): string` – ≥ 1e9: tối đa 2 số lẻ `"3,48 tỷ"`; ≥ 1e6: tối đa 1 số lẻ `"12,5 triệu"`; nhỏ hơn → `formatVND`; bỏ số 0 thừa
  - `parseVND(text: string): number | null` – bỏ mọi ký tự không phải số; rỗng → `null`
  - `formatDate(value: unknown): string` – `"dd/MM/yyyy"` giờ địa phương; `formatDateTime(value: unknown): string` – `"HH:mm dd/MM/yyyy"`
  - `maskPhone(phone: string | null | undefined): string` – ≥ 7 ký tự: 4 đầu + `" *** "` + 3 cuối; ngắn hơn giữ nguyên; rỗng → `""`
  - `getInitials(name: string | null | undefined): string` – chữ cái đầu của 2 từ cuối, in hoa; rỗng → `"?"`
  - `EMPTY = "—"`
- Produces (`lib/countdown.ts`, không import gì):
  - `remainingSeconds(expiresAt: unknown, nowMs: number): number | null` – `null` nếu không parse được; không âm
  - `formatCountdown(seconds: number): string` – `"mm:ss"`, ≥ 3600 → `"h:mm:ss"`, âm → `"00:00"`
  - `countdownTone(seconds: number | null): 'none' | 'normal' | 'urgent' | 'expired'` – null → none; ≤ 0 → expired; < 180 → urgent; còn lại normal
  - `URGENT_THRESHOLD_SEC = 180`
- Produces (`lib/useDebouncedValue.ts`): `useDebouncedValue<T>(value: T, delayMs = 300): T`

- [ ] **Step 1: Viết test** `tests/format.test.cjs`:
```js
test("formatVND handles numbers, numeric strings and junk", () => {
  assert.equal(f.formatVND(50000000), "50.000.000 ₫");
  assert.equal(f.formatVND(0), "0 ₫");
  assert.equal(f.formatVND(-1500), "-1.500 ₫");
  assert.equal(f.formatVND(1234.6), "1.235 ₫");
  assert.equal(f.formatVND("1500000"), "1.500.000 ₫");
  for (const bad of [null, undefined, "abc", NaN, ""]) assert.equal(f.formatVND(bad), "—");
});
test("formatVNDShort", () => {
  assert.equal(f.formatVNDShort(3482600000), "3,48 tỷ");
  assert.equal(f.formatVNDShort(3000000000), "3 tỷ");
  assert.equal(f.formatVNDShort(3500000000), "3,5 tỷ");
  assert.equal(f.formatVNDShort(850000000), "850 triệu");
  assert.equal(f.formatVNDShort(12500000), "12,5 triệu");
  assert.equal(f.formatVNDShort(950000), "950.000 ₫");
  assert.equal(f.formatVNDShort(null), "—");
});
test("parseVND and formatNumberVN", () => {
  assert.equal(f.parseVND("50.000.000 ₫"), 50000000);
  assert.equal(f.parseVND("0"), 0);
  assert.equal(f.parseVND(""), null);
  assert.equal(f.parseVND("abc"), null);
  assert.equal(f.formatNumberVN(50000000), "50.000.000");
});
test("dates are local, invalid input is a dash", () => {
  const d = new Date(2026, 8, 30, 10, 42);
  assert.equal(f.formatDate(d), "30/09/2026");
  assert.equal(f.formatDateTime(d), "10:42 30/09/2026");
  assert.equal(f.formatDate(d.toISOString()), "30/09/2026");
  assert.equal(f.formatDate(d.getTime()), "30/09/2026");
  for (const bad of [null, undefined, "not a date", ""]) assert.equal(f.formatDate(bad), "—");
});
test("maskPhone and getInitials", () => {
  assert.equal(f.maskPhone("0912345486"), "0912 *** 486");
  assert.equal(f.maskPhone("12345"), "12345");
  assert.equal(f.maskPhone(""), "");
  assert.equal(f.maskPhone(null), "");
  assert.equal(f.getInitials("Nguyễn Minh Anh"), "MA");
  assert.equal(f.getInitials("  trần   hoàng "), "TH");
  assert.equal(f.getInitials("An"), "A");
  assert.equal(f.getInitials(""), "?");
});
test("countdown", () => {
  const now = Date.UTC(2026, 8, 30, 3, 0, 0);
  assert.equal(c.remainingSeconds(new Date(now + 892000).toISOString(), now), 892);
  assert.equal(c.remainingSeconds(now - 5000, now), 0);
  assert.equal(c.remainingSeconds(null, now), null);
  assert.equal(c.remainingSeconds("garbage", now), null);
  assert.equal(c.formatCountdown(892), "14:52");
  assert.equal(c.formatCountdown(0), "00:00");
  assert.equal(c.formatCountdown(-5), "00:00");
  assert.equal(c.formatCountdown(3725), "1:02:05");
  assert.equal(c.countdownTone(null), "none");
  assert.equal(c.countdownTone(0), "expired");
  assert.equal(c.countdownTone(179), "urgent");
  assert.equal(c.countdownTone(180), "normal");
});
```
- [ ] **Step 2: Chạy** `node --test tests/format.test.cjs` → FAIL.
- [ ] **Step 3: Viết 3 file theo Interfaces.**
- [ ] **Step 4: Chạy lại** → PASS (6 test).
- [ ] **Step 5: Check chuẩn.**

---

### Task 3: Font Be Vietnam Pro trên mọi nền tảng + root layout

**Files:**
- Create: `assets/fonts/BeVietnamPro-Regular.ttf`, `-Medium.ttf`, `-SemiBold.ttf`, `-Bold.ttf`, `assets/fonts/OFL.txt`
- Modify: `app/_layout.tsx`

**Interfaces:**
- Consumes: `fonts` (Task 1).
- Produces: font đã đăng ký dưới đúng các tên trong `fonts`; `<StatusBar style="dark" />` toàn app.

- [ ] **Step 1: Tải font (giấy phép OFL)**
```bash
mkdir -p assets/fonts
for w in Regular Medium SemiBold Bold; do
  curl -fsSL -o "assets/fonts/BeVietnamPro-$w.ttf" "https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/BeVietnamPro-$w.ttf"
done
curl -fsSL -o assets/fonts/OFL.txt https://raw.githubusercontent.com/google/fonts/main/ofl/bevietnampro/OFL.txt
file assets/fonts/*.ttf
```
Kỳ vọng: 4 dòng `TrueType Font data`. Nếu tải lỗi → dừng, báo người dùng (không thay font khác).

- [ ] **Step 2: Sửa `app/_layout.tsx`**
  - `useFonts({ [fonts.regular]: require('../assets/fonts/BeVietnamPro-Regular.ttf'), … })` từ `expo-font`.
  - Giữ nguyên đoạn kiểm tra AsyncStorage hiện có. Chỉ gọi `SplashScreen.hideAsync()` khi **cả hai**: kiểm tra AsyncStorage xong **và**
    (`fontsLoaded || fontError || đã quá 3000ms`). Gọi đúng một lần.
  - Thêm `<StatusBar style="dark" />` (`expo-status-bar`) trong `RootLayout`.
  - Giữ `applyWebFont()` như cũ.
- [ ] **Step 3: Check chuẩn.**
- [ ] **Step 4: Kiểm thử tay (ghi vào báo cáo cuối giai đoạn, người dùng chạy):** mở app iOS/Android → chữ ở màn chưa migrate vẫn là font hệ thống (đúng: chỉ component `Text` mới dùng Be Vietnam Pro); đổi tên một file font tạm thời → app vẫn mở sau ≤ 3 giây.

---

### Task 4: Shim `constants/colors.ts`

**Files:**
- Modify: `constants/colors.ts`
- Test: `tests/colors-shim.test.cjs`

**Interfaces:**
- Consumes: `colors` (Task 1).
- Produces: object `Colors` mặc định với **đúng tập khoá hiện có** (không xoá khoá nào – 59 file đang import).

Chỉ đổi các giá trị sau (mọi khoá khác giữ nguyên giá trị cũ, bao gồm `accent.*`, `feature*`, `icon*`, `glass.*`, `glow.*`, `gradients.*`):

| Khoá | Giá trị mới |
|---|---|
| `primary` | `colors.primary` |
| `primaryDark` | `colors.primaryPressed` |
| `primaryLight` | `colors.brand` |
| `text` | `colors.text` |
| `textSecondary` | `colors.textSecondary` |
| `textTertiary`, `textLight` | `colors.textTertiary` |
| `border` | `colors.border` |
| `success` / `warning` / `error` / `info` | `colors.success` / `colors.warning` / `colors.danger` / `colors.info` |

`background`, `backgroundSecondary`, `backgroundTertiary`, `white` **giữ nguyên** (đổi nền toàn app để các giai đoạn sau làm theo từng màn).
Thêm comment đầu file: shim tạm, màn mới import từ `@/theme`, xoá ở Giai đoạn 6.

- [ ] **Step 1: Viết test** `tests/colors-shim.test.cjs` – nạp bản gốc bằng `git show b2fbae60:constants/colors.ts` (qua `child_process.execSync`) và bản mới
  từ đĩa; bản mới được chạy trong `vm` với `require` ánh xạ `'../theme/colors'` → `theme/colors.ts` đã transpile. Hàm `keys(obj)` trả danh sách khoá dạng `a.b` (mảng coi là lá).
```js
test("shim keeps every legacy key", () => assert.deepEqual(keys(after).sort(), keys(before).sort()));
test("shim maps legacy names to tokens", () => {
  assert.equal(after.primary, "#C9501A"); assert.equal(after.primaryDark, "#A84314"); assert.equal(after.primaryLight, "#E86F25");
  assert.equal(after.text, "#0F172A"); assert.equal(after.textSecondary, "#475569");
  assert.equal(after.textTertiary, "#64748B"); assert.equal(after.textLight, "#64748B"); assert.equal(after.border, "#E4E7EC");
  assert.equal(after.success, "#15803D"); assert.equal(after.warning, "#B45309"); assert.equal(after.error, "#B91C1C"); assert.equal(after.info, "#1D4ED8");
});
test("backgrounds and decorative palettes are untouched", () => {
  for (const k of ["background", "backgroundSecondary", "backgroundTertiary", "white"]) assert.equal(after[k], before[k]);
  assert.deepEqual(after.accent, before.accent); assert.deepEqual(after.gradients, before.gradients);
});
```
- [ ] **Step 2: Chạy** `node --test tests/colors-shim.test.cjs` → FAIL ở test thứ 2.
- [ ] **Step 3: Sửa `constants/colors.ts` theo bảng** – import `colors` bằng đường dẫn tương đối `'../theme/colors'` (để test nạp được).
- [ ] **Step 4: Chạy lại** → PASS (3 test).
- [ ] **Step 5: Check chuẩn.**

---

### Task 5: `Text`, `Button`, `IconButton`

**Files:**
- Create: `components/ui/Text.tsx`, `components/ui/Button.tsx`, `components/ui/IconButton.tsx`, `components/ui/index.ts`

**Interfaces:**
- Consumes: `colors`, `ColorToken`, `typography`, `fonts`, `MAX_FONT_SCALE`, `radius`, `space`, `motion`, `hitSlop`, `MIN_TOUCH`.
- Produces:
  - `Text(props: RNTextProps & { variant?: TextVariant = 'body'; color?: ColorToken | string; weight?: keyof typeof fonts; numeric?: boolean; align?: 'left' | 'center' | 'right' })`
    – `color` nhận token (tra `colors[token]`) hoặc chuỗi màu động (dùng cho `showcase.*` và màu từ dữ liệu); `numeric` → `fontVariant: ['tabular-nums']`;
    luôn đặt `maxFontSizeMultiplier={MAX_FONT_SCALE}`. Đây là nơi duy nhất đặt `fontFamily`.
  - `Button({ title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' = 'primary'; size?: 'md' | 'lg' = 'md'; loading?: boolean; disabled?: boolean; icon?: LucideIcon; fullWidth?: boolean; accessibilityLabel?: string; testID?: string; style?: StyleProp<ViewStyle> })`
    – cao 44 (md) / 52 (lg), radius `md`, chữ `subhead` (lg: 16/22). primary: nền `primary`, nhấn `primaryPressed`; secondary: nền `surface`, viền `borderStrong`, chữ `inverse`;
    ghost: nền trong suốt, chữ `primary`; danger: nền `danger`. Disabled: nền `surfaceMuted`, chữ `textTertiary`.
    `loading` → `ActivityIndicator` thay icon, **bỏ qua `onPress`**, `accessibilityState={{ busy: true, disabled: true }}`.
  - `IconButton({ icon: LucideIcon; onPress: () => void; accessibilityLabel: string; variant?: 'plain' | 'filled' | 'onDark' = 'plain'; color?: string; disabled?: boolean })`
    – 44×44, icon 22, `hitSlop`, `accessibilityRole="button"`. `accessibilityLabel` **bắt buộc** trong kiểu.
  - `components/ui/index.ts` re-export mọi component (cập nhật ở mỗi task sau).

- [ ] **Step 1: Viết 3 component + index theo Interfaces.**
- [ ] **Step 2: Check chuẩn.** Thêm kiểm tra kiểu: tạo tạm `components/ui/__typecheck.tsx` chứa `<IconButton icon={X} onPress={() => {}} />` (thiếu label) → `npx tsc --noEmit` báo lỗi `accessibilityLabel`; xoá file tạm, tsc về 5.

---

### Task 6: Phản hồi – `ToastProvider`/`useToast`, `confirm()`, haptics

**Files:**
- Create: `components/ui/Toast.tsx`, `components/ui/confirm.ts`, `lib/haptics.ts`
- Modify: `app/_layout.tsx` (bọc `<ToastProvider>` bên trong `GestureHandlerRootView`, bao quanh `RootLayoutNav`), `components/ui/index.ts`

**Interfaces:**
- Produces:
  - `ToastProvider({ children })`, `useToast(): { show(opts: ToastOptions): void; hide(): void }`
  - `type ToastOptions = { type: 'success' | 'error' | 'info'; message: string; action?: { label: string; onPress: () => void }; duration?: number }`
    – mặc định 3000ms; có `action` → 5000ms. Một toast mỗi lúc (mới thay cũ). Vị trí: `top = insets.top + 56`, lề ngang 16.
    success/error: nền `inverse`, chữ `onInverse`, chấm icon `success`/`danger` (lucide `Check`/`AlertCircle`); info: nền `surface`, viền `border`, chữ `text`, icon `info`.
    Vào 200ms (opacity + translateY −8→0), ra 150ms; reduce motion → không animate. `accessibilityLiveRegion="polite"` + `AccessibilityInfo.announceForAccessibility(message)`.
    Chạm toast → ẩn. `useToast` gọi ngoài provider → throw Error rõ ràng.
  - `confirm(opts: { title: string; message?: string; confirmText?: string = 'Đồng ý'; cancelText?: string = 'Không'; destructive?: boolean }): Promise<boolean>`
    – native: `Alert.alert` 2 nút (nút xác nhận `style: destructive` khi `destructive`), `cancelable: true` → đóng ngoài = `false`;
    **web: `window.confirm(title + (message ? '\n\n' + message : ''))`**.
  - `lib/haptics.ts`: `hapticSuccess()`, `hapticError()`, `hapticLight()` – bọc `expo-haptics` (`notificationAsync`/`impactAsync`), web → no-op, nuốt mọi lỗi. Kiểu trả về `void`.

- [ ] **Step 1: Viết `lib/haptics.ts`, `confirm.ts`, `Toast.tsx`; gắn `ToastProvider` vào `app/_layout.tsx`.**
- [ ] **Step 2: Check chuẩn.**
- [ ] **Step 3: Kiểm trên web** – `npx expo export --platform web --output-dir .expo/export-web-check > /dev/null && echo WEB_OK` → `WEB_OK` (đảm bảo `window.confirm`/haptics không làm vỡ bundle web).

---

### Task 7: Component hiển thị

**Files:**
- Create: `components/ui/Card.tsx`, `Badge.tsx` (gồm `Badge` và `StatusBadge`), `Chip.tsx`, `Avatar.tsx`, `MoneyText.tsx`, `KeyValueRow.tsx`, `ListItem.tsx`, `SectionHeader.tsx`, `Skeleton.tsx`, `EmptyState.tsx`, `ErrorState.tsx`
- Modify: `components/ui/index.ts`

**Interfaces:**
- Consumes: Task 1, 2, 5, 6; `normalizeHexColor`, `statusTextColorOf` từ `components/utils/statusColor.ts`.
- Produces:
  - `Card({ children; onPress?; padding?: number = space.lg; tone?: 'work' | 'showcase' = 'work'; style?; accessibilityLabel? })` – work: nền `surface`, viền `border`, radius `lg`, không bóng; showcase: nền `showcase.surface`, không viền. Có `onPress` → Pressable, nhấn opacity 0.85.
  - `Badge({ label: string; tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' = 'neutral'; icon?: LucideIcon })` – pill, chữ `label` 12/16; màu nền/chữ = cặp `*Subtle`/`on*Subtle` (brand → `primarySubtle`/`onPrimarySubtle`; neutral → `surfaceMuted`/`textSecondary`).
  - `StatusBadge({ label: string; color?: string | null })` – nền = `normalizeHexColor(color) ?? colors.surfaceMuted`; chữ = có màu hợp lệ ? `statusTextColorOf(nền)` : `colors.textSecondary`.
  - `Chip({ label: string; selected?: boolean; count?: number; onPress: () => void })` – cao 36 (hitSlop đạt 44), selected: nền `inverse` chữ `onInverse`; `accessibilityState={{ selected }}`; hiển thị `label · count` khi có count.
  - `Avatar({ name: string; uri?: string | null; size?: 32 | 40 | 56 = 40 })` – ảnh (expo-image) hoặc `getInitials(name)` trên `primarySubtle`/`onPrimarySubtle`, radius `md`.
  - `MoneyText({ value: unknown; short?: boolean; variant?: TextVariant = 'body'; color?: ColorToken | string })` – `numeric`, dùng `formatVND`/`formatVNDShort`.
  - `KeyValueRow({ label: string; value: React.ReactNode; copyValue?: string; last?: boolean })` – có `copyValue` → cả dòng chạm được, icon `Copy`, `Clipboard.setStringAsync(copyValue)` + `toast.show({ type: 'success', message: 'Đã sao chép ' + label.toLowerCase() })` + `hapticLight()`.
  - `ListItem` = `React.memo(({ title: string; subtitle?: string; meta?: string; leading?: ReactNode; trailing?: ReactNode; chevron?: boolean; onPress?: () => void; accessibilityLabel?: string }) => …)` – minHeight 64, padding dọc 12, `title` subhead (1 dòng), `subtitle` caption textSecondary (1 dòng), `meta` caption textTertiary.
  - `SectionHeader({ title: string; actionLabel?: string; onAction?: () => void })` – title kiểu `label`, in hoa, `textTertiary`; action là `Button` ghost cỡ chữ 13.
  - `Skeleton({ width?: DimensionValue = '100%'; height: number; radius?: number = radius.sm; style? })` – nền `skeleton`, opacity nhấp nháy 0.5↔1 (1000ms, `useNativeDriver`), reduce motion → tĩnh. `SkeletonList({ count?: number = 6 })` (hàng giống ListItem), `SkeletonDetail()` (khối 120 + 3 dòng).
  - `EmptyState({ icon?: LucideIcon = Inbox; title: string; description?: string; actionLabel?: string; onAction?: () => void })`
  - `ErrorState({ title?: string = 'Không tải được dữ liệu'; description?: string = 'Kiểm tra kết nối mạng rồi thử lại.'; onRetry: () => void })` – nút `Button` secondary "Thử lại".

- [ ] **Step 1: Viết các component theo Interfaces, cập nhật index.**
- [ ] **Step 2: Check chuẩn.**

---

### Task 8: Bố cục & lớp phủ – `Screen`, `AppHeader`, `BottomActionBar`, `BottomSheet`

**Files:**
- Create: `components/ui/Screen.tsx`, `AppHeader.tsx`, `BottomActionBar.tsx`, `BottomSheet.tsx`
- Modify: `components/ui/index.ts`

**Interfaces:**
- Produces:
  - `Screen({ children; header?: ReactNode; footer?: ReactNode; scroll?: boolean = true; refreshing?: boolean; onRefresh?: () => void; tone?: 'work' | 'showcase' = 'work'; padded?: boolean = true; keyboardAware?: boolean })`
    – `SafeAreaView` edges `['top','left','right']`, nền `bg` (showcase: `showcase.paper`); `header` trên cùng (ngoài scroll), `footer` dưới cùng (ngoài scroll);
    scroll → `ScrollView` với `contentContainerStyle` padding 16, gap 12, `RefreshControl` (tint `primary`) khi có `onRefresh`;
    `scroll={false}` → `View flex:1` (dùng cho màn có `FlatList` riêng). `keyboardAware` → `KeyboardAvoidingView` (`padding` trên iOS).
  - `AppHeader({ title: string; subtitle?: string; onBack?: () => void; hideBack?: boolean; actions?: ReactNode; variant?: 'light' | 'dark' | 'transparent' = 'light' })`
    – cao 56, light: nền `surface` + viền dưới `border`; dark: nền `showcase.bg`, chữ `showcase.text`; transparent: không nền.
    Back mặc định: `router.canGoBack() ? router.back() : router.replace('/(tabs)/home')`, `IconButton` icon `ChevronLeft`, label `'Quay lại'`. Title `heading` 1 dòng.
  - `BottomActionBar({ children })` – nền `surface`, viền trên `border`, `elevation.raised`, padding 12/16, `paddingBottom = max(insets.bottom, 12)`, hàng ngang gap 8.
  - `BottomSheet({ visible: boolean; onClose: () => void; title?: string; children; maxHeightRatio?: number = 0.85 })`
    – RN `Modal` `transparent` `animationType="none"` + `Animated` (nền `backdrop` fade 200ms, sheet trượt lên spring; đóng 150ms rồi mới `onClose`);
    `onRequestClose` = đóng (nút back Android); chạm nền để đóng; thanh kéo 36×4 `borderStrong`; radius trên `xl`; `paddingBottom` theo safe-area; reduce motion → không animate.
  - `SheetOption({ icon?: LucideIcon; label: string; onPress: () => void; destructive?: boolean })` (export từ `BottomSheet.tsx`) – cao 52, viền dưới `border`.

- [ ] **Step 1: Viết component, cập nhật index.**
- [ ] **Step 2: Check chuẩn.**

---

### Task 9: Form – `TextField`, `SearchBar`, `SelectField`

**Files:**
- Create: `components/ui/TextField.tsx`, `SearchBar.tsx`, `SelectField.tsx`
- Modify: `components/ui/index.ts`

`MoneyField` và `DateField` (spec 4.6) **không làm ở giai đoạn này** vì Giai đoạn 1 không dùng; sẽ làm trong plan của giai đoạn đầu tiên cần chúng (GĐ4/GĐ5).

**Interfaces:**
- Produces:
  - `TextField(props: TextInputProps & { label: string; helper?: string; error?: string | null; required?: boolean; prefix?: ReactNode; suffix?: ReactNode; containerStyle? })`
    – label `caption` weight semibold phía trên (+ `' *'` màu `danger` khi required); ô cao 48, radius `md`, viền `borderStrong`; focus: viền 2px `primary`; error: viền 2px `danger`;
    dưới ô: `error` (màu `danger`) ưu tiên hơn `helper` (`textSecondary`); `placeholderTextColor = colors.textTertiary`; `accessibilityLabel = label`; font qua `fonts.regular` 15.
  - `SearchBar({ value: string; onChangeText: (t: string) => void; placeholder?: string = 'Tìm kiếm'; autoFocus?: boolean })` – icon `Search`, nút xoá (`IconButton` `X`, label `'Xoá tìm kiếm'`) khi có chữ; cao 44; nền `surface`. Debounce do màn tự làm bằng `useDebouncedValue`.
  - `SelectField<T extends string | number>({ label: string; value: T | null; options: { value: T; label: string; description?: string }[]; onChange: (v: T) => void; placeholder?: string = 'Chọn'; error?: string | null; required?: boolean; loading?: boolean; sheetTitle?: string })`
    – hiển thị như TextField (chevron `ChevronDown`), chạm → `BottomSheet` danh sách (dấu `Check` màu `primary` ở mục đang chọn); > 8 mục → có `SearchBar` lọc theo label (không dấu/phân biệt hoa thường: so sánh sau `normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()`).

- [ ] **Step 1: Viết component, cập nhật index.**
- [ ] **Step 2: Check chuẩn.**

---

### Task 10: `ProgressSteps`, `CountdownPill`

**Files:**
- Create: `components/ui/ProgressSteps.tsx`, `components/ui/CountdownPill.tsx`
- Modify: `components/ui/index.ts`

**Interfaces:**
- Consumes: `remainingSeconds`, `formatCountdown`, `countdownTone` (Task 2).
- Produces:
  - `ProgressSteps({ steps: readonly string[]; current: number; cancelled?: boolean })` – thanh 4px chia đoạn, gap 4; đoạn `i <= current`: `brand`, còn lại `border`;
    nhãn dưới (`caption` 12): bước `current` đậm màu `text`, còn lại `textSecondary`; `cancelled` → mọi đoạn `border`, opacity 0.6.
    `accessibilityLabel`: `'Tiến độ: bước ' + (current + 1) + '/' + steps.length + ', ' + steps[current]`.
  - `CountdownPill({ expiresAt: unknown; label?: string = 'Giữ chỗ còn'; onExpire?: () => void; compact?: boolean })`
    – cập nhật mỗi 1s; tone normal: `warningSubtle`/`onWarningSubtle`; urgent: `dangerSubtle`/`onDangerSubtle`; expired: hiện `'Đã hết hạn giữ chỗ'` tone danger;
    none: render `null`. Gọi `onExpire` **một lần** khi chuyển sang expired. Số bằng `Text numeric` 15 semibold. Icon `Timer`.

- [ ] **Step 1: Viết component, cập nhật index.**
- [ ] **Step 2: Check chuẩn.**

---

### Task 11: UI Gallery, lint chặn hex, commit Giai đoạn 0

**Files:**
- Create: `app/dev/ui-gallery.tsx`
- Modify: `app/(tabs)/account.tsx` (thêm 1 dòng "UI Gallery (dev)" chỉ khi `__DEV__`, `router.push('/dev/ui-gallery')`), `eslint.config.js`

**Interfaces:**
- Consumes: toàn bộ `components/ui`.

- [ ] **Step 1: Viết `app/dev/ui-gallery.tsx`** – `if (!__DEV__) return <Redirect href="/" />`; `<Stack.Screen options={{ headerShown: false }} />`; dùng `Screen` + `AppHeader title="UI Gallery"`.
  Các mục (mỗi mục một `SectionHeader`): Text (7 variant), Button (4 variant × md/lg, loading, disabled; một nút `loading` có `onPress` đếm số lần bấm hiển thị ra màn để chứng minh không nhận bấm lặp),
  IconButton, Badge (6 tone), StatusBadge (`#3B82F6`, `#FDE68A`, `null`), Chip, Avatar, MoneyText (50000000, 3482600000 short, null), KeyValueRow copyable,
  ListItem, Card (work/showcase), Skeleton/SkeletonList, EmptyState, ErrorState, TextField (thường/lỗi/required), SearchBar, SelectField (12 mục),
  ProgressSteps (current 0..3, cancelled), CountdownPill (hết hạn sau 200s, 90s, đã hết), nút mở BottomSheet có 3 SheetOption,
  nút hiện toast success/error (có action)/info, nút gọi `confirm({ destructive: true })` và hiện kết quả bằng toast.
  Các mã màu mẫu cho StatusBadge (mô phỏng `color_code` từ API) là ngoại lệ duy nhất: đặt trong một mảng hằng, mỗi dòng có `// eslint-disable-next-line no-restricted-syntax -- mô phỏng color_code từ API`.
- [ ] **Step 2: Thêm rule vào `eslint.config.js`**
```js
const UI_STRICT_FILES = [
  'components/ui/**/*.{ts,tsx}',
  'lib/**/*.{ts,tsx}',
  'app/dev/**/*.{ts,tsx}',
];
// … trong defineConfig([...]):
{
  files: UI_STRICT_FILES,
  rules: {
    'no-restricted-syntax': ['error',
      { selector: 'Literal[value=/^#[0-9a-fA-F]{3,8}$/]', message: 'Dùng token trong @/theme thay vì mã hex.' },
      { selector: 'Literal[value=/^rgba?\\(/]', message: 'Dùng token trong @/theme thay vì rgba().' },
    ],
  },
},
```
- [ ] **Step 3: Kiểm rule hoạt động** – tạo tạm `components/ui/__lintcheck.ts` với `export const x = '#fff';` → `npx eslint components/ui/__lintcheck.ts` báo lỗi "Dùng token trong @/theme"; xoá file.
- [ ] **Step 4: Check chuẩn** + `npx eslint components/ui lib app/dev theme` → không output. `npx expo lint` tổng không tăng so với baseline (13 errors / 96 warnings).
- [ ] **Step 5: Kiểm trực quan trên web** – `npx expo start --web`, mở `/dev/ui-gallery`, chụp màn hình toàn trang (nếu có công cụ trình duyệt) hoặc ghi rõ "chưa kiểm trực quan" trong báo cáo. Kiểm: font Be Vietnam Pro hiển thị dấu đúng; nút loading không tăng bộ đếm khi bấm; confirm hiện `window.confirm`.
- [ ] **Step 6: Commit Giai đoạn 0**
```bash
git add theme lib assets/fonts components/ui app/dev constants/colors.ts app/_layout.tsx 'app/(tabs)/account.tsx' eslint.config.js tests/theme-contrast.test.cjs tests/format.test.cjs tests/colors-shim.test.cjs
git status --short   # chỉ các file trên; không có file lạ
git commit -m "feat(ui): phase 0 – nền tảng design system

- Token màu/chữ/khoảng cách (theme/), font Be Vietnam Pro mọi nền tảng
- components/ui: Text, Button, IconButton, Toast, confirm, Card, Badge, StatusBadge, Chip, Avatar,
  MoneyText, KeyValueRow, ListItem, SectionHeader, Skeleton, EmptyState, ErrorState, Screen,
  AppHeader, BottomActionBar, BottomSheet, TextField, SearchBar, SelectField, ProgressSteps, CountdownPill
- lib/format, lib/countdown, lib/haptics; shim constants/colors.ts; lint chặn hex; UI Gallery (dev)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
**Không push.**

---

# GIAI ĐOẠN 1 – Booking & Thanh toán QR

Quy tắc chung cho Task 13–16:
- Đầu màn: `<Stack.Screen options={{ headerShown: false }} />`, dùng `Screen` + `AppHeader` + (nếu có) `BottomActionBar` qua prop `footer`.
- **Giữ nguyên** mọi `useState`/`useEffect`/handler gọi service, payload và param; chỉ thay JSX, style, cách báo lỗi/thành công.
- Xoá `StyleSheet` cũ không còn dùng. Style còn lại chỉ dùng token.
- Màn > 400 dòng sau khi làm: tách khối UI con ra file cùng thư mục, ví dụ `app/booking/_components/…` (thư mục bắt đầu bằng `_` để expo-router không coi là route).
- Mỗi `Alert.alert` cũ phải được phân loại theo bảng D7 của spec; ghi trong báo cáo task: dòng cũ → cách mới.

### Task 12: `lib/bookingProgress.ts`, `lib/qrPaymentState.ts`

**Files:**
- Create: `lib/bookingProgress.ts`, `lib/qrPaymentState.ts` – hai file **không import gì** (thời gian hiện tại truyền vào qua tham số `nowMs`) để test nạp được
- Test: `tests/booking-progress.test.cjs`, `tests/qr-payment-state.test.cjs`

**Interfaces:**
- Produces:
  - `BOOKING_STEPS = ['Giữ chỗ', 'Đã thu tiền', 'Đặt cọc', 'Hợp đồng'] as const`
  - `type BookingProgressInput = { giaiDoan?: string | null; daThu?: number | string | null; tienGiuCho?: number | string | null; state?: string | null; hetHanLuc?: string | null }`
  - `getBookingProgress(b: BookingProgressInput, nowMs: number): { current: 0 | 1 | 2 | 3; paid: boolean; cancelled: boolean; expired: boolean }`
    – `paid = (tienGiuCho > 0 && daThu >= tienGiuCho) || giaiDoan ∈ {DATCOC, HDMB}`; `current`: HDMB → 3, DATCOC → 2, paid → 1, còn lại 0;
    `cancelled = state === 'CANCELLED'`; `expired = !paid && !cancelled && hetHanLuc hợp lệ && hetHanLuc <= nowMs && (giaiDoan rỗng hoặc 'GIUCHO')`. Số dạng chuỗi được `Number()`; không hợp lệ coi như 0.
  - `type QrScreenState = 'loading' | 'error' | 'paid' | 'noDeadline' | 'expired' | 'mismatch' | 'active' | 'needsNewQr' | 'needsQr'`
  - `getQrScreenState(i: { loading: boolean; loadError: string | null; paid: boolean; hasActiveVa: boolean; amountMismatch: boolean; remainingSec: number | null; hadPreviousQr: boolean }): QrScreenState`
    – thứ tự ưu tiên đúng như danh sách kiểu: loading → error → paid → (`remainingSec === null` → noDeadline) → (`remainingSec <= 0` → expired) → (`hasActiveVa && amountMismatch` → mismatch) → (`hasActiveVa` → active) → (`hadPreviousQr` → needsNewQr) → needsQr.

- [ ] **Step 1: Viết test** `tests/booking-progress.test.cjs`:
```js
const NOW = Date.UTC(2026, 8, 30, 3, 0, 0);
const future = new Date(NOW + 600000).toISOString(), past = new Date(NOW - 1000).toISOString();
test("fresh booking holds a slot", () => assert.deepEqual(
  p.getBookingProgress({ giaiDoan: "GIUCHO", daThu: 0, tienGiuCho: 50000000, state: "PENDING", hetHanLuc: future }, NOW),
  { current: 0, paid: false, cancelled: false, expired: false }));
test("paid when daThu reaches tienGiuCho (strings accepted)", () =>
  assert.equal(p.getBookingProgress({ daThu: "50000000", tienGiuCho: 50000000, hetHanLuc: past }, NOW).current, 1));
test("zero or missing tienGiuCho never counts as paid", () => {
  assert.equal(p.getBookingProgress({ daThu: 0, tienGiuCho: 0 }, NOW).paid, false);
  assert.equal(p.getBookingProgress({}, NOW).paid, false);
});
test("deposit and contract stages", () => {
  assert.deepEqual(p.getBookingProgress({ giaiDoan: "DATCOC" }, NOW), { current: 2, paid: true, cancelled: false, expired: false });
  assert.equal(p.getBookingProgress({ giaiDoan: "HDMB" }, NOW).current, 3);
});
test("expiry only applies to unpaid holds with a valid deadline", () => {
  assert.equal(p.getBookingProgress({ giaiDoan: "GIUCHO", hetHanLuc: past, tienGiuCho: 1 }, NOW).expired, true);
  assert.equal(p.getBookingProgress({ daThu: 1, tienGiuCho: 1, hetHanLuc: past }, NOW).expired, false);
  assert.equal(p.getBookingProgress({ hetHanLuc: null }, NOW).expired, false);
  assert.equal(p.getBookingProgress({ hetHanLuc: "garbage" }, NOW).expired, false);
});
test("cancelled", () => {
  const r = p.getBookingProgress({ state: "CANCELLED", hetHanLuc: past }, NOW);
  assert.equal(r.cancelled, true); assert.equal(r.expired, false);
});
test("steps copy", () => assert.deepEqual([...p.BOOKING_STEPS], ["Giữ chỗ", "Đã thu tiền", "Đặt cọc", "Hợp đồng"]));
```
`tests/qr-payment-state.test.cjs`:
```js
const base = { loading: false, loadError: null, paid: false, hasActiveVa: false, amountMismatch: false, remainingSec: 600, hadPreviousQr: false };
const s = (o) => q.getQrScreenState({ ...base, ...o });
test("precedence", () => {
  assert.equal(s({ loading: true, loadError: "x", paid: true }), "loading");
  assert.equal(s({ loadError: "x", paid: true }), "error");
  assert.equal(s({ paid: true, remainingSec: 0 }), "paid");
  assert.equal(s({ remainingSec: null, hasActiveVa: true }), "noDeadline");
  assert.equal(s({ remainingSec: 0, hasActiveVa: true }), "expired");
  assert.equal(s({ hasActiveVa: true, amountMismatch: true }), "mismatch");
  assert.equal(s({ hasActiveVa: true }), "active");
  assert.equal(s({ hadPreviousQr: true }), "needsNewQr");
  assert.equal(s({}), "needsQr");
});
```
- [ ] **Step 2: Chạy 2 test** → FAIL.
- [ ] **Step 3: Viết 2 file.**
- [ ] **Step 4: Chạy lại** → PASS (8 test).
- [ ] **Step 5: Check chuẩn.**

---

### Task 13: Danh sách booking (`app/bookings.tsx`) + `FilterPanel`

**Files:**
- Modify: `app/bookings.tsx`, `components/FilterPanel.tsx`

**Interfaces:**
- Consumes: `Screen`, `AppHeader`, `SearchBar`, `Chip`, `ListItem`, `Avatar`, `MoneyText`, `StatusBadge`, `SkeletonList`, `EmptyState`, `ErrorState`, `useToast`, `formatDate`, `useDebouncedValue`.
- `components/FilterPanel.tsx`: **giữ nguyên tên export và props** (`FilterToggleButton`, `FilterPanel`, `FilterSection`, `FilterOption`) vì 5 màn đang dùng;
  chỉ thay style bằng token + `Chip` cho lựa chọn (màu từ `option.color` vẫn hiển thị dạng chấm tròn 8px trước label).

Bố cục mới:
- `AppHeader title="Booking"` + `actions` = `FilterToggleButton` hiện có.
- Dưới header: `SearchBar` (placeholder `"Mã booking, khách hàng, căn"`) → giá trị debounce 300ms đưa vào logic tìm kiếm hiện có (thay debounce/`setTimeout` cũ nếu có).
- Hàng `Chip` ngang cuộn được: trạng thái từ `statusList` hiện có, có `count` như logic đếm hiện có.
- `FlatList` (thay `ScrollView` + `.map`): item = `ListItem` với `leading=<Avatar name={khachHang} />`, `title=khachHang || '—'`, `subtitle={maSanPham} · {tenDA}`,
  `meta=formatDate(ngayGiuCho)`, `trailing` = cột phải `MoneyText short value={tongGia}` + `StatusBadge label={tenTT} color={colorCode}`; `onPress` giữ đúng `router.push` hiện có.
  `keyExtractor = item.id ?? item.maPGC`; `onEndReached` → hàm tải trang tiếp hiện có (`pageIndex`); `ListFooterComponent` = `ActivityIndicator` nhỏ khi `loadingMore`.
  `refreshControl` → tải lại trang 1.
- Trạng thái: lần tải đầu → `SkeletonList`; lỗi tải (thêm state `loadError` bắt trong `catch` hiện có) → `ErrorState onRetry`;
  rỗng không lọc → `EmptyState title="Chưa có booking nào" description="Tạo booking từ màn Sản phẩm hoặc Lock căn." actionLabel="Đến Sản phẩm" onAction={() => router.push('/products')}`;
  rỗng khi đang lọc/tìm → `EmptyState title="Không có booking phù hợp" actionLabel="Xoá bộ lọc" onAction={clearFilters}`.

- [ ] **Step 1: Sửa `FilterPanel.tsx` (chỉ style).** Check chuẩn; mở tay 1 màn khác đang dùng FilterPanel (vd `deposits`) → vẫn hiển thị và lọc được.
- [ ] **Step 2: Viết lại JSX `bookings.tsx` theo bố cục trên.**
- [ ] **Step 3: Check chuẩn** + `npx eslint app/bookings.tsx components/FilterPanel.tsx` → không output.
- [ ] **Step 4: Kiểm tay (người dùng):** kéo làm mới, cuộn tải thêm, lọc trạng thái, tìm kiếm, bật máy bay → ErrorState → tắt máy bay → Thử lại.

---

### Task 14: Tạo booking (`app/booking/create.tsx`)

**Files:**
- Modify: `app/booking/create.tsx` (có thể tách `app/booking/_components/CustomerPicker.tsx`)

**Interfaces:**
- Consumes: `Screen`, `AppHeader`, `Card`, `SearchBar`, `SelectField`, `BottomActionBar`, `Button`, `Text`, `MoneyText`, `Avatar`, `SkeletonList`, `EmptyState`, `useToast`, `hapticSuccess`, `hapticError`, `maskPhone`, `formatVNDShort`, `useDebouncedValue`.
- Giữ nguyên: `normalizeCustomer`, `loadSanList`, `loadData`, toàn bộ payload `initDataBooking` trong `handleContinue`, cơ chế param `dataBooking`/`newCustomer`, Alert "Sản phẩm này đã có người booking rồi…" (lỗi chặn – giữ Alert).

Bố cục (spec 5.2):
- `AppHeader title="Tạo booking"`.
- Card căn hộ: ký hiệu `bookingData.KyHieu`, dự án `bookingData.TenDA`, giá `formatVNDShort(TongGiaTriHDMB ?? TongGomPBT)`.
- `SectionHeader title="Khách hàng *"`, `SearchBar` placeholder `"Tên, SĐT hoặc mã KH"` (giá trị debounce 300ms → `loadData`, thay `setTimeout` 500ms cũ);
  danh sách KH: mỗi dòng Pressable (radio): `Avatar`, tên, `maskPhone(diDong)`; đang chọn → viền 2px `primary` + nền `primarySubtle`, `accessibilityState={{ selected: true }}`;
  đang tải → `SkeletonList count={4}`; rỗng → `EmptyState title="Không tìm thấy khách hàng"`. Nút `Button variant="ghost" icon={UserPlus} title="Thêm khách hàng mới"` → điều hướng `customer/new` như cũ.
  Lỗi chọn KH hiển thị ngay dưới tiêu đề mục (chữ `danger`, caption): state mới `customerError: string | null`, xoá khi chọn KH.
- `SelectField label="Sàn giao dịch"` từ `sanList` (value = `ID || MaSan`, label = `TenSan`), `loading={loadingSan}`, `onChange` → `handleSelectSan`.
- `footer`: `BottomActionBar` gồm dòng "Tiền giữ chỗ" (nếu `bookingData` có giá trị tiền giữ chỗ; không có thì bỏ dòng) và `Button size="lg" fullWidth title="Tạo booking" loading={creatingBooking}`.

Đổi hành vi `handleContinue` (chỉ phần phản hồi, **không đổi payload**):
| Cũ | Mới |
|---|---|
| `Alert "Vui lòng chọn khách hàng"` | `setCustomerError('Vui lòng chọn khách hàng')` + `hapticError()` |
| `Alert "Khách hàng chưa có mã để ghép vào booking"` | `setCustomerError('Khách hàng chưa có mã để ghép vào booking')` |
| thành công `router.replace('/bookings')` | `hapticSuccess()`; `toast.show({ type: 'success', message: 'Đã tạo booking cho ' + tenKH })`; có `resultBooking.id` → `router.replace({ pathname: '/booking/[id]', params: { id: String(resultBooking.id) } })`; không có → `router.replace('/bookings')` |
| `Alert "Lỗi" …` (2 chỗ) | `toast.show({ type: 'error', message: resultBooking?.message \|\| error?.message \|\| 'Không thể tạo booking' })` + `hapticError()`; giữ nguyên lựa chọn |

- [ ] **Step 1: Viết lại JSX + đổi phản hồi theo bảng.**
- [ ] **Step 2: Check chuẩn** + eslint file.
- [ ] **Step 3: Kiểm tay (người dùng):** từ `product/[id]` → Tạo booking → không chọn KH bấm Tạo → lỗi dưới mục KH, không Alert → chọn KH → Tạo → toast + vào thẳng chi tiết booking vừa tạo; bấm nhanh 2 lần khi mạng chậm → chỉ 1 booking.

---

### Task 15: Chi tiết booking (`app/booking/[id].tsx`)

**Files:**
- Modify: `app/booking/[id].tsx`; tách khối con vào `app/booking/_components/` (vd `BookingHero.tsx`, `BookingProgressCard.tsx`, `BookingDocuments.tsx`, `CollapsibleSection.tsx`)

**Interfaces:**
- Consumes: `getBookingProgress`, `BOOKING_STEPS` (Task 12); `Screen`, `AppHeader`, `CountdownPill`, `Card`, `ProgressSteps`, `StatusBadge`, `KeyValueRow`, `MoneyText`, `Text`, `BottomActionBar`, `Button`, `BottomSheet`, `SheetOption`, `Skeleton`, `SkeletonDetail`, `ErrorState`, `useToast`.
- Giữ nguyên: tải dữ liệu (`getBookingEditDetail`, `getListImageGC`, `useFocusEffect`), upload (`uploadBookingImage`, `addBookingImages`), `isActiveBooking`, tính giá theo bảng giá, quà tặng, xem ảnh, điều hướng tới QR (`/booking/qr-payment` + params hiện có).

Bố cục (spec 5.3), trên xuống:
1. `AppHeader title={soPhieu}`.
2. `CountdownPill expiresAt={data.hetHanLuc}` – chỉ khi `isActiveBooking && !progress.paid`; `onExpire` → tải lại dữ liệu.
3. Khối tiền (nền `inverse`, radius `lg`, padding 16): nhãn `"Tiền booking cần thu"` (caption `onInverse` opacity 0.8), `MoneyText variant="display" value={tienGiuCho} color={colors.onInverse}`, dòng dưới: ký hiệu căn · `"Giá HĐ " + formatVNDShort(tongGia)`.
4. Card "Tiến độ": `ProgressSteps steps={BOOKING_STEPS} current={progress.current} cancelled={progress.cancelled}` + `StatusBadge label={data.tenTT} color={data.colorCode}`.
5. Card thông tin: `KeyValueRow` Khách hàng / SĐT (`maskPhone`) / Sàn / Nhân viên / Ngày giữ chỗ (`formatDateTime`).
6. `CollapsibleSection` (tự viết trong `_components`, header Pressable + `ChevronDown` xoay, mặc định đóng): "Giá theo bảng giá" (nội dung giá hiện có), "Quà tặng / Khuyến mãi", "Chứng từ (n)" (lưới ảnh hiện có; ảnh đang tải → `Skeleton` 72×72; lỗi → ô có nút thử lại gọi lại `getListImageGC`).
7. `footer` `BottomActionBar`: luôn có `Button variant="secondary" icon={Upload} title="Chứng từ" loading={uploading}` mở BottomSheet; khi `isActiveBooking && !progress.paid` thêm `Button title="Thu tiền QR" icon={QrCode}` (flex 1) điều hướng tới QR như cũ.

`progress = getBookingProgress({ giaiDoan: data.giaiDoan, daThu: data.daThu, tienGiuCho: data.tienGiuCho, state: data.state, hetHanLuc: data.hetHanLuc }, Date.now())`.

Thay Alert:
| Cũ | Mới |
|---|---|
| `Alert "Tải chứng từ" — "Chọn nguồn ảnh"` 3 nút | `BottomSheet title="Tải chứng từ"` với `SheetOption` "Chụp ảnh" (`Camera`), "Chọn từ thư viện" (`Image`) |
| `"Cần cấp quyền truy cập camera"` / `"…thư viện ảnh"` | giữ Alert (lỗi chặn) |
| `"Không xác định được phiếu booking để lưu chứng từ"` | toast error |
| thông báo tải chứng từ thành công/thất bại (2 Alert cuối) | toast success `"Đã tải lên {n} chứng từ"` / toast error có `action: { label: 'Thử lại', onPress: <mở lại sheet> }` |

Trạng thái màn: đang tải lần đầu → `SkeletonDetail`; lỗi tải → `ErrorState onRetry`; không tìm thấy → `EmptyState title="Không tìm thấy booking" actionLabel="Về danh sách"`.

- [ ] **Step 1: Tách khối con, viết lại JSX, thay Alert theo bảng.**
- [ ] **Step 2: Check chuẩn** + eslint các file đụng tới.
- [ ] **Step 3: Kiểm tay (người dùng):** booking mới (đếm ngược + 2 nút), booking đã thu (không đếm ngược, bước 2 sáng, chỉ nút Chứng từ), booking huỷ (tiến độ mờ), tải chứng từ bằng camera và thư viện, từ chối quyền camera → Alert.

---

### Task 16: Thanh toán QR (`app/booking/qr-payment.tsx`)

**Files:**
- Modify: `app/booking/qr-payment.tsx`; tách khối con vào `app/booking/_components/` (vd `QrCard.tsx`, `QrResult.tsx`)

**Interfaces:**
- Consumes: `getQrScreenState` (Task 12), `remainingSeconds` (Task 2); `Screen`, `AppHeader`, `IconButton`, `CountdownPill`, `Card`, `Text`, `MoneyText`, `KeyValueRow`, `Button`, `BottomActionBar`, `BottomSheet`, `SheetOption`, `SkeletonDetail`, `ErrorState`, `useToast`, `confirm`, `hapticSuccess`.
- Giữ nguyên: `load`, `checkPaid`, polling 5s, `AppState` listener, `expireSweep` khi hết giờ, payload `PaymentGatewayService.create`, `handleCancelVA` (phần gọi service), lưu/chia sẻ ảnh QR, `vietQrUrl`, chọn tài khoản `maTk`.

Thay đổi logic nhỏ (được phép vì thuộc hiển thị):
- State mới `hadPreviousQr: boolean` – trong `load()`: `list?.accounts?.some(a => a.module === 'BOOKING' && a.status === 'DELETED') ?? false`; và set `true` ở mọi chỗ đang `setExpiredNotice(true)`.
- `screenState = getQrScreenState({ loading, loadError, paid, hasActiveVa: !!va, amountMismatch, remainingSec: remainingSeconds(booking?.hetHanLuc, now), hadPreviousQr })`.
- `handleCreate`: nếu `screenState === 'needsNewQr'` → `if (!(await confirm({ title: 'Tạo mã QR mới?', message: 'Mã QR cũ đã hết hạn hoặc đã bị huỷ và sẽ được thay bằng mã mới.', confirmText: 'Tạo mã mới' }))) return;` rồi mới chạy phần gọi service cũ.
- Khi `paid` chuyển `false → true` (useEffect theo `paid`): `hapticSuccess()` một lần.

Hiển thị theo `screenState` (spec 5.4, 5.5):
| State | Nội dung chính | `footer` |
|---|---|---|
| loading | `SkeletonDetail` | – |
| error | `ErrorState onRetry={onRefresh}` | – |
| paid | icon `CheckCircle2` 56 màu `success` trên `successSubtle`, `"Đã nhận " + formatVND(va.paid_amount)`, `formatDateTime` thời điểm nếu có, `bookingCode` | `Button size="lg" fullWidth title="Xem chi tiết booking" onPress={router.back}` |
| noDeadline | `EmptyState icon={Clock} title="Booking chưa có hạn giữ chỗ" description="Không thể tạo mã QR cho booking này."` | – |
| expired | icon `AlertTriangle` màu `danger`, `"Hết thời gian giữ chỗ"`, `"Mã QR đã bị huỷ. Căn có thể đã được mở bán lại."` | `Button variant="secondary" fullWidth title="Về chi tiết booking"` |
| mismatch | banner `dangerSubtle`: `"Số tiền trên mã QR (x) khác số tiền booking (y). Vui lòng huỷ mã này để tạo lại."` + QR mờ (opacity 0.3, không cho lưu/chia sẻ) | `Button variant="danger" fullWidth title="Huỷ mã QR" onPress={handleCancelVA}` |
| active | `CountdownPill` trên cùng; card: "Số tiền cần chuyển" + `MoneyText variant="display"`, ảnh QR 200×200 nền trắng viền `border`, chỉ báo chấm `warning` + `"Đang chờ tiền về · tự cập nhật"`; card `KeyValueRow` Ngân hàng / Số tài khoản (`copyValue`) / Chủ tài khoản / Nội dung (`copyValue`) | `[Lưu QR]` secondary + `[Gửi QR cho khách]` primary (share) |
| needsQr / needsNewQr | `CountdownPill`; số tiền `display`; `SelectField "Tài khoản nhận tiền"` khi `accounts.length > 1` (1 tài khoản → `KeyValueRow`); lỗi tài khoản/số tiền (`accountsError`, `amountError`) hiển thị dạng banner `warningSubtle` ngay trên nút | `Button size="lg" fullWidth icon={QrCode} title={needsNewQr ? 'Tạo mã QR mới' : 'Tạo mã QR'} loading={creating} disabled={!acc \|\| !expectedAmount}` |

- Header: `AppHeader title="Thu tiền booking"`; khi state `active` thêm `actions` = `IconButton icon={MoreVertical} accessibilityLabel="Tuỳ chọn"` mở `BottomSheet` với `SheetOption destructive label="Huỷ mã QR này để tạo lại"` → `handleCancelVA`.
- `handleCancelVA`: thay `Alert.alert` 2 nút bằng `await confirm({ title: 'Huỷ mã QR', message: 'Huỷ tài khoản {số TK} ({số tiền})? Người chuyển tiền vào tài khoản này sẽ không được ghi nhận.', confirmText: 'Huỷ mã QR', destructive: true })`.

Thay 11 Alert:
| Cũ | Mới |
|---|---|
| lỗi `expireSweep` | toast error |
| 3 Alert chặn trong `handleCreate` (hết giờ / chưa có số tiền / chưa có phiếu) | không thể xảy ra vì nút ẩn/disabled theo state; giữ `return` phòng thủ + toast error cùng nội dung |
| Alert cảnh báo lệch số tiền sau khi tạo | bỏ (state `mismatch` tự hiển thị) |
| lỗi tạo QR | toast error |
| xác nhận huỷ QR | `confirm(destructive)` |
| lỗi huỷ QR | toast error |
| thiếu quyền lưu ảnh | giữ Alert (lỗi chặn) |
| lưu QR thành công | toast success `"Đã lưu mã QR vào thư viện ảnh"` |
| lỗi lưu QR | toast error |

Chạm dòng để sao chép dùng `KeyValueRow copyValue` (thay state `copiedKey` và dòng "Chạm vào dòng có biểu tượng để sao chép" cũ).

- [ ] **Step 1: Thêm `hadPreviousQr`, `screenState`, confirm khi `needsNewQr`, haptic khi paid.**
- [ ] **Step 2: Viết lại JSX theo bảng state; thay 11 Alert theo bảng.** Sau bước này `grep -c "Alert.alert" app/booking/qr-payment.tsx` → **1** (quyền lưu ảnh).
- [ ] **Step 3: Check chuẩn** + eslint các file đụng tới.
- [ ] **Step 4: Kiểm tay (người dùng, môi trường thử):** booking chưa có QR → nút "Tạo mã QR" (không tự tạo) → tạo → state active; sao chép số TK → toast; huỷ QR qua menu ⋯ → confirm → về needsNewQr → bấm "Tạo mã QR mới" → confirm → tạo; chuyển khoản thử số nhỏ → trong ≤ 5 giây chuyển "Đã nhận" + rung → "Xem chi tiết booking" → tiến độ bước 2; để hết giờ giữ chỗ → state expired.

---

### Task 17: Nút vào luồng, xoá màn thừa, lint strict, commit Giai đoạn 1

**Files:**
- Modify: `app/product/[id].tsx`, `app/locked/[id].tsx` (chỉ nút "Tạo booking"), `eslint.config.js`
- Delete: `app/booking/payment-method.tsx`, `app/payment/[id].tsx` (và thư mục `app/payment/` nếu rỗng); `mocks/bookings.ts` chỉ khi không còn import

- [ ] **Step 1: Nút "Tạo booking"** ở `product/[id]` và `locked/[id]`: thay phần tử bấm hiện tại bằng `Button size="lg" fullWidth icon={CalendarPlus} title="Tạo booking"`, `onPress` giữ nguyên `router.push({ pathname: '/booking/create', params: { dataBooking: … } })`. Không đổi phần khác của 2 màn (thuộc Giai đoạn 3).
- [ ] **Step 2: Xoá màn thừa**
```bash
git rm app/booking/payment-method.tsx 'app/payment/[id].tsx'
grep -rnE "payment-method|/payment/|\"payment/\[id\]\"" app components || echo NO_REFS
grep -rn "mocks/bookings" app components sevices sevicesSupabase || git rm mocks/bookings.ts
```
Kỳ vọng: `NO_REFS`. Nếu `mocks/bookings` còn được import thì giữ file.
- [ ] **Step 3: Mở rộng `UI_STRICT_FILES`** thêm: `'app/bookings.tsx'`, `'app/booking/**/*.{ts,tsx}'`, `'components/FilterPanel.tsx'`.
  Riêng `StatusBadge` nhận màu từ dữ liệu nên không có literal – nếu eslint báo hex nào trong các file trên thì đó là style cũ chưa chuyển token: sửa, không tắt rule.
- [ ] **Step 4: Check chuẩn** + `npx eslint app/bookings.tsx app/booking components/FilterPanel.tsx 'app/product/[id].tsx' 'app/locked/[id].tsx'` (2 file cuối: không tăng số lỗi so với trước khi sửa) + `npx expo lint` tổng không tăng.
- [ ] **Step 5: Đếm Alert** – `grep -c "Alert.alert" app/bookings.tsx app/booking/create.tsx 'app/booking/[id].tsx' app/booking/qr-payment.tsx` → lần lượt `0, 1, 2, 1` (create: "đã có người booking"; [id]: 2 quyền camera/thư viện; qr: quyền lưu ảnh). Khác → giải thích trong báo cáo.
- [ ] **Step 6: Commit Giai đoạn 1**
```bash
git add -A app/bookings.tsx app/booking 'app/product/[id].tsx' 'app/locked/[id].tsx' components/FilterPanel.tsx lib/bookingProgress.ts lib/qrPaymentState.ts tests/booking-progress.test.cjs tests/qr-payment-state.test.cjs eslint.config.js app/payment mocks/bookings.ts
git status --short   # chỉ các file trên
git commit -m "feat(ui): phase 1 – luồng booking & thanh toán QR

- Tạo booking xong vào thẳng chi tiết booking (toast + haptic)
- Chi tiết booking: đếm ngược giữ chỗ, tiến độ 4 bước, thanh hành động cố định đáy
- Màn QR: nút tạo QR nổi bật, xác nhận khi thay QR cũ, trạng thái đã thu/hết hạn ngay trên màn
- Danh sách booking: FlatList, skeleton/rỗng/lỗi, kéo làm mới
- Thay Alert bằng toast/confirm theo quy tắc; xoá booking/payment-method và payment/[id]

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
**Không push, không `eas update`.** Báo người dùng danh sách màn cần tự kiểm (Task 13–16 Step "Kiểm tay").

---

## Sau Giai đoạn 1

Viết plan riêng cho Giai đoạn 2–6 sau khi người dùng kiểm xong Giai đoạn 0–1 trên máy thật (component có thể cần chỉnh theo phản hồi).
Plan GĐ4/GĐ5 bổ sung `MoneyField`, `DateField`.

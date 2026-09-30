# Redesign UI Beeland Sales – Giai đoạn 3 (Sản phẩm & Dự án) – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa các màn Dự án, Sản phẩm, Lock căn sang design system, với **phong cách trưng bày** (navy + cam sáng, ảnh lớn) cho màn giới thiệu dự án/căn hộ (spec 4.7, D2).

**Architecture:** Dùng lại `components/ui` + `theme` (có `colors.showcase.*`). Trạng thái căn (6 loại của màn Tổng quan) và định dạng diện tích gom vào hàm thuần có test. Màn `products.tsx` (1.852 dòng, 3 chế độ xem + realtime SignalR) tách khối con vào `components/product/`. Không đổi service/API, SignalR, payload, param điều hướng.

**Tech Stack:** như GĐ0–2.

**Spec:** `docs/superpowers/specs/2026-09-30-ui-redesign-design.md` (mục 4.7, 7 – dòng GĐ3). Nền tảng: plan GĐ0–1 và GĐ2.

## Global Constraints

- Nhánh `devhuan2`. **Chỉ commit local**; không push, không PR, không `eas update`/`eas build`.
- **1 commit cho giai đoạn**: `feat(ui): phase 3 – sản phẩm & dự án` + `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Sửa sau review commit riêng.
- Không đổi lời gọi service (`ProjectService`, `ProductService`, `FilterService`, `PriceServices`, `BookingService.createLock/sweepExpiredLocks/listProductLocks/getLockDetailCloud`), kết nối SignalR (`ChangeTable`), logic phân trang/tìm kiếm/lọc, đếm ngược lock, param điều hướng (`/product/[id]`, `/booking/create` + `dataBooking`, `/products?MaDA=`, `/folders/`, `/photo-gallery?projectId=`, `/diagram/`).
- Màu chỉ từ `@/theme`; file migrate vào `UI_STRICT_FILES`. Màu trạng thái lấy từ dữ liệu (`color_code`/số màu) dùng `StatusBadge`; trạng thái cố định của màn Tổng quan dùng `Badge` tone (Task 1).
- Màn trưng bày (`project/[id]`, `product/[id]`, `locked/[id]`): `Screen tone="showcase"`, khối ảnh đầu màn, `AppHeader variant="dark"` hoặc `transparent` đè ảnh, giá dùng `colors.showcase.accent`, **nút chính vẫn `colors.primary`** (D3).
- Toast/confirm theo quy tắc; chạm ≥ 44; icon-only có nhãn; caption 14/20, nhỏ nhất 12.

**Baseline** (trên `12ac94ac`): `tsc` 5; lint 11 errors / 81 warnings; `node --test tests/` 63 pass. "Check chuẩn" như các giai đoạn trước.

## Quyết định cần người dùng xác nhận trước khi chạy

| # | Phát hiện | Mặc định **[MĐ]** |
|---|---|---|
| Q1 | `app/price-calculator/[id].tsx` chạy **hoàn toàn bằng dữ liệu mẫu** (`mocks/properties`, `mocks/paymentPolicies`); nút "Tính giá" ở chi tiết sản phẩm mở máy tính với số liệu giả. | Ẩn nút "Tính giá" cho đến khi có API thật; không sửa màn máy tính (D11). |
| Q2 | Chia sẻ sản phẩm gửi link giả `https://app.com/product/<id>` cho khách. | Bỏ link khỏi nội dung chia sẻ; chỉ gửi tên dự án, ký hiệu căn, diện tích, giá, địa chỉ. |
| Q3 | `components/PriceStatusTable.tsx` (+ `mocks/priceTable.ts`) không nơi nào dùng. | Xoá. |

Không cần hỏi (sửa luôn): `app/product/BlockGrid.tsx` là component nhưng nằm trong `app/` → expo-router tạo route thừa `/product/BlockGrid`. Chuyển sang `components/product/BlockGrid.tsx`.

## Review Focus

1. **Realtime SignalR** (`ChangeTable`) cập nhật trạng thái căn khi đang ở chế độ Danh sách / Lưới / Tổng quan → ô/dòng đổi màu đúng, không reset bộ lọc, không nhân đôi kết nối khi rời/quay lại màn – kiểm ở Task 4.
2. **Đếm ngược lock ở chi tiết sản phẩm / lock căn** về 0 → gọi `sweepExpiredLocks` đúng một lần, nút trở lại "Lock căn", không vòng lặp tải lại (bài học GĐ1) – kiểm ở Task 5, 6.
3. **Sản phẩm thiếu dữ liệu** (không ảnh, không giá, diện tích dạng chuỗi/số lẻ, `KyHieu` rỗng) → hiện "—"/ảnh mặc định, không crash – test ở Task 1 (`formatArea`) + kiểm Task 5.
4. **Danh sách sản phẩm lớn** (hàng trăm căn, chế độ Lưới/Tổng quan) cuộn mượt – `FlatList`/memo, không render lại toàn bộ khi 1 căn đổi trạng thái – kiểm Task 4.
5. **Bấm "Lock căn"/"Tạo booking" liên tiếp** → một lần gọi (Button `loading` + ref) – kiểm Task 5, 6.

---

## File Structure

```
lib/productStatus.ts          UNIT_STATUS_META (6 trạng thái Tổng quan → nhãn + BadgeTone)        [Task 1]
lib/format.ts                 + formatArea(value, digits=2) → "73,9 m²"                           [Task 1]
tests/product-status.test.cjs, tests/format.test.cjs (bổ sung)                                    [Task 1]
components/product/BlockGrid.tsx        (chuyển từ app/product/BlockGrid.tsx)                     [Task 2]
components/product/ProductListItem.tsx  dòng sản phẩm (memo)                                      [Task 4]
components/product/UnitCell.tsx         ô căn trong Lưới/Tổng quan (memo)                         [Task 4]
components/product/OverviewView.tsx     chế độ Tổng quan (tầng → ô căn, tóm tắt trạng thái)        [Task 4]
components/product/ImageCarousel.tsx    ảnh đầu màn trưng bày + chấm phân trang + xem toàn màn     [Task 3]
components/product/PriceBreakdown.tsx   bảng giá (cao tầng / thấp tầng)                           [Task 5]
components/booking/BookingPriceAndGifts.tsx  dùng formatArea mới (bỏ hàm cục bộ)                  [Task 1]
app/projects.tsx, app/project/[id].tsx                                                          [Task 3]
app/products.tsx                                                                                [Task 4]
app/product/[id].tsx                                                                            [Task 5]
app/locked-units.tsx, app/locked/[id].tsx                                                       [Task 6]
app/diagram/[mada].tsx                                                                          [Task 7]
eslint.config.js                                                                                [Task 7]
```

---

### Task 1: `lib/productStatus.ts` + `formatArea`

**Interfaces – Produces:**
- `type UnitStatus = 'available' | 'deposit' | 'holding' | 'pending_kitchen' | 'sold' | 'locked'` (khớp `mocks/overviewUnits.UnitStatus`).
- `UNIT_STATUS_META: Record<UnitStatus, { label: string; tone: 'success' | 'info' | 'warning' | 'brand' | 'danger' | 'neutral' }>` – nhãn giữ nguyên: Trống / Đã cọc / Giữ chỗ / Bếp chờ / Đã bán / Lock; tone lần lượt success / info / warning / brand / danger / neutral.
- `unitStatusMeta(status: unknown): { label: string; tone }` – không nhận ra → `{ label: 'Khác', tone: 'neutral' }`.
- `lib/format.ts`: `formatArea(value: unknown, digits = 2): string` – số nguyên → `formatNumberVN` + " m²"; số lẻ → làm tròn `digits`, dấu phẩy thập phân; không hợp lệ/rỗng → "—".

- [ ] **Step 1: Test** – `tests/product-status.test.cjs`: 6 nhãn đúng chữ; tone đúng; `unitStatusMeta('xyz')` → Khác/neutral. Bổ sung `tests/format.test.cjs`: `formatArea(73.9)` "73,9 m²"; `formatArea(70)` "70 m²"; `formatArea("1250")` "1.250 m²"; `formatArea(73.456)` "73,46 m²"; `formatArea(null)`/`("")`/`("abc")` "—".
- [ ] **Step 2: Chạy** → FAIL. **Step 3: Viết.** **Step 4: Chạy** → PASS.
- [ ] **Step 5:** `components/booking/BookingPriceAndGifts.tsx` dùng `formatArea` thay hàm `formatValue` phần diện tích (giữ nguyên kết quả hiển thị). Check chuẩn.

---

### Task 2: Dọn file sai chỗ / không dùng

- [ ] **Step 1:** `git mv app/product/BlockGrid.tsx components/product/BlockGrid.tsx`; sửa import ở `app/products.tsx` (`./product/BlockGrid` → `@/components/product/BlockGrid`). Restyle `BlockGrid` bằng token + `UnitCell` (làm ở Task 4 – bước này chỉ di chuyển).
- [ ] **Step 2 (Q3):** `grep -rn "PriceStatusTable\|mocks/priceTable" app components` → chỉ còn chính nó → `git rm components/PriceStatusTable.tsx`; `mocks/priceTable.ts` xoá nếu không còn ai import.
- [ ] **Step 3:** Check chuẩn + `npx expo export --platform ios` → BUNDLE_OK (xác nhận route `/product/BlockGrid` không còn và không vỡ import).

---

### Task 3: Dự án – danh sách (`projects.tsx`) & chi tiết (`project/[id].tsx`) + `ImageCarousel`

**Interfaces – Produces:** `ImageCarousel({ images: string[]; fallback: string; height?: number = 260; onOpen?: (index: number) => void })` – `FlatList` ngang `pagingEnabled`, `expo-image` `contentFit="cover"`, chấm phân trang (active `showcase.accent`), bộ đếm "1/12" góc dưới phải (nền `showcase.bg`), chạm ảnh → `ImageViewerModal` (có sẵn) khi không truyền `onOpen`.

**Danh sách dự án:** `AppHeader "Dự án"` + `SearchBar` (lọc cục bộ theo tên nếu màn hiện có tìm kiếm; không thì bỏ) → `FlatList` thẻ dự án kiểu trưng bày (ảnh 16:9 + khối `showcase.bg` chứa tên `heading`, vị trí `caption`, badge trạng thái như carousel trang chủ – dùng lại `projectStatus` bằng cách chuyển hàm này từ `components/home/ProjectCarousel.tsx` sang `lib/productStatus.ts` và test thêm 3 ca) → skeleton / lỗi / rỗng, kéo làm mới. Điều hướng giữ nguyên.

**Chi tiết dự án:** `Screen tone="showcase"`; `ImageCarousel` (ảnh dự án, fallback ảnh mặc định) với `AppHeader variant="transparent"` đè lên (nút back nền `showcase.surface`); khối thông tin navy: tên `title` màu `showcase.text`, địa chỉ, badge trạng thái; danh sách lối tắt (Sản phẩm, Tài liệu, Thư viện ảnh, Sơ đồ phân lô – giữ nguyên route) dạng `ListItem` trong `Card` nền `showcase.paper`, icon một tông.

- [ ] Step 1: `ImageCarousel` + chuyển `projectStatus` (test). Step 2: `projects.tsx`. Step 3: `project/[id].tsx`. Step 4: Check chuẩn. Step 5: Kiểm tay – ảnh lỗi → ảnh mặc định; back hoạt động trên nền ảnh sáng/tối.

---

### Task 4: Sản phẩm (`products.tsx`)

**Giữ nguyên:** SignalR (`initSignalR`, `ChangeTable`, `localChange`), `loadProducts/searchProducts/loadMore`, `handleFormGrid`, `buildOverviewData`, `buildStatusSummary`, `mapStatusByTT`, bộ lọc (`FilterPanel` – đã restyle ở GĐ1), `getDefaultMaDA`, param `MaDA` từ route.

**Thay đổi:**
- Xoá mã chết: `_statusSummaryItems`, `overviewStats`, `currentOverviewBlock`, import `overviewBlocks`/`getOverviewStats` (dùng dữ liệu giả, không được render). `statusConfig` từ mock → `UNIT_STATUS_META` (Task 1).
- Header: `AppHeader "Sản phẩm"` + actions: `FilterToggleButton`. Dưới header: `SearchBar` + `SegmentedControl` 3 chế độ (**Danh sách / Lưới / Tổng quan**) thay 3 nút icon.
- **Danh sách:** `FlatList` + `ProductListItem` (memo): ký hiệu căn `subhead`, dự án · khu `caption`, diện tích (`formatArea`) · hướng, giá `MoneyText short`, `StatusBadge` màu từ dữ liệu (`getHexColor(...)` hiện có → truyền chuỗi hex vào `StatusBadge`); kéo làm mới; tải thêm khi cuộn (`onEndReached` thay `handleScroll`); skeleton / lỗi / rỗng ("Không có sản phẩm phù hợp" + Xoá bộ lọc).
- **Lưới:** `BlockGrid` (đã chuyển) vẽ bằng `UnitCell` (memo; nền = màu trạng thái dữ liệu, chữ = `statusTextColorOf`, ô ≥ 44×44, nhãn = ký hiệu căn).
- **Tổng quan:** `OverviewView` – hàng chip tóm tắt trạng thái (`Chip` có `count`, chọn để lọc) + mỗi tầng một `Card` (tiêu đề "Tầng N · a/b căn") và lưới `UnitCell` với màu theo `UNIT_STATUS_META` (Badge tone → cặp `*Subtle` / `on*Subtle`, đạt tương phản – thay nền xanh chữ trắng 2,3:1 cũ).
- Chú thích màu (legend) thành `BottomSheet` mở từ nút "Chú thích" (thay khối `legendExpanded`).
- Màn < 500 dòng sau khi tách.

- [ ] Step 1: `ProductListItem`, `UnitCell`, restyle `BlockGrid`, `OverviewView`. Check chuẩn.
- [ ] Step 2: Viết lại JSX `products.tsx` + xoá mã chết. Check chuẩn.
- [ ] Step 3: Kiểm tay (người dùng): mở `/products?MaDA=…` từ chi tiết dự án → lọc đúng dự án; đổi 3 chế độ; một căn đổi trạng thái trên web → trong vài giây ô/dòng đổi màu (SignalR); cuộn danh sách dài mượt.

---

### Task 5: Chi tiết sản phẩm (`product/[id].tsx`) + `PriceBreakdown`

**Giữ nguyên:** `getBannerProduct`, `getDetailProducts`, `handleLock` (`createLock`), đếm ngược lock + `sweepExpiredLocks` khi về 0, `isBookingStatus`, `data.isHienThiBook`, điều hướng `/booking/create` + `dataBooking`, chia sẻ (nội dung theo Q2).

**Bố cục trưng bày:** `ImageCarousel` (banner) + `AppHeader transparent` (actions: `IconButton Share2` "Chia sẻ") → khối navy: dự án `caption` `showcase.textMuted`, ký hiệu căn `title`, giá `formatVNDShort` màu `showcase.accent` cỡ `display`, hàng thông số (diện tích thông thủy `formatArea`, diện tích tim tường, hướng, tầng) → `Card` "Chi tiết giá" = `PriceBreakdown({ data })` (các dòng hiện có: đơn giá chưa VAT, tổng chưa VAT, VAT, gồm VAT, phí bảo trì, gồm PBT, tổng HĐMB, ghi chú; nhánh thấp tầng giữ nguyên) dùng `KeyValueRow` + dòng tổng nền `primarySubtle` → `BottomActionBar`: [**Lock căn**] (secondary; khi đang lock: `CountdownPill compact` "Lock còn mm:ss", disabled) + [**Tạo booking**] (primary, đã làm ở GĐ1; ẩn khi `!data.isHienThiBook` như cũ).
- Nút "Tính giá": theo Q1 (mặc định ẩn).
- `Alert` (nếu có ở luồng lock) phân loại theo D7: lỗi lock → toast error; thành công → toast success + `hapticSuccess`.
- `formatCurrency` cục bộ (Intl) → `lib/format`.

- [ ] Step 1: `PriceBreakdown`. Step 2: viết lại JSX. Step 3: Check chuẩn + `grep -c "mocks/" "app/product/[id].tsx"` → 0 (import type `Property` thay bằng kiểu cục bộ). Step 4: Kiểm tay – lock → đếm ngược chạy, về 0 → nút trở lại "Lock căn" đúng 1 lần gọi sweep; bấm "Lock căn" 2 lần nhanh → 1 lock.

---

### Task 6: Lock căn – danh sách (`locked-units.tsx`) & chi tiết (`locked/[id].tsx`)

**Giữ nguyên:** `listProductLocks`, `sweepExpiredLocks` lúc mở màn, lọc dự án, `getLockDetailCloud`, `getBannerProduct`, `getDetailProducts`, `createLock` (gia hạn/lock lại nếu có), điều hướng `/booking/create`.

- **Danh sách:** `AppHeader "Căn đã lock"` + `FilterToggleButton`; `FlatList` `ListItem`: ký hiệu căn · dự án, người lock + thời gian (`formatDateTime`), bên phải `CountdownPill compact` (còn hạn) hoặc `Badge danger` "Hết hạn"/`Badge neutral` "Đã mở"; bỏ emoji 🔒 ⚠ 🔓 (dùng icon lucide `Lock`, `AlertTriangle`, `LockOpen`); skeleton / lỗi / rỗng; kéo làm mới.
- **Chi tiết:** bố cục trưng bày như Task 5 (dùng `ImageCarousel`, `PriceBreakdown`), `CountdownPill` lớn dưới khối navy, `BottomActionBar` [Tạo booking] (khi còn hạn, như cũ `remainingSeconds > 0`).

- [ ] Step 1: `locked-units.tsx`. Step 2: `locked/[id].tsx`. Step 3: Check chuẩn + `grep -cP "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" app/locked-units.tsx` → 0. Step 4: Kiểm tay – lock hết hạn trong lúc đang xem danh sách → dòng chuyển "Hết hạn" không tải lại liên tục.

---

### Task 7: Sơ đồ phân lô, "Tính giá", lint strict, commit

- **`diagram/[mada].tsx`:** `AppHeader "Sơ đồ phân lô"`; `WebView` với `startInLoadingState` + `renderLoading` = `SkeletonDetail`; lỗi tải (`onError`/`onHttpError`) → `ErrorState` + "Thử lại" (tăng `key` để tải lại) thay `Alert`.
- **Q1:** ẩn nút "Tính giá" ở `product/[id]` (đã làm ở Task 5); `price-calculator/[id].tsx` không sửa.
- `UI_STRICT_FILES` += `'app/projects.tsx'`, `'app/project/**/*.{ts,tsx}'`, `'app/products.tsx'`, `'app/product/**/*.{ts,tsx}'`, `'app/locked-units.tsx'`, `'app/locked/**/*.{ts,tsx}'`, `'app/diagram/**/*.{ts,tsx}'`, `'components/product/**/*.{ts,tsx}'`.
- [ ] Check chuẩn + WEB_OK + lint tổng không tăng → commit `feat(ui): phase 3 – sản phẩm & dự án` (chỉ các file trên). **Không push.**
- [ ] Review toàn nhánh bằng agent riêng (như GĐ0–2); sửa Critical/Important trong commit riêng.

## Ngoài phạm vi Giai đoạn 3

- `price-calculator/[id]` (mock – Q1), `photo-gallery`, `folders`, `documents`, `videos` (media – GĐ6).

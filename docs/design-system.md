# Design system và quy tắc giao diện

## Token (`theme/` – import `@/theme`)

| Nhóm | Ghi chú |
|---|---|
| `colors` | `primary` #C9501A (nút chính, một màu chính), `bg`, `surface`, `surfaceMuted`, `border(Strong)`, `text`, `textSecondary`, `textTertiary`, `onPrimary`, cặp trạng thái `success/warning/danger/info` + `*Subtle` + `on*Subtle`, `backdrop`, `skeleton` |
| `colors.showcase` | Navy + cam sáng cho màn trưng bày dự án/căn (`bg` #16233B, `surface`, `accent`, `paper`, `text`, `textMuted`); `scrim` (3 điểm gradient phủ ảnh cho `expo-linear-gradient`), `glass`/`glassBorder` (nút kính mờ trên ảnh) |
| `typography` | display 28 · title 22 · heading 17 · subhead/body 15 · caption 14 · label 12 (**nhỏ nhất**) |
| `space`, `radius` (`sm…xl`, `xxl` 24, `x3` 28, `full`), `elevation` (`soft` · `raised` · `overlay` · `modal`) | khoảng cách, bo góc, đổ bóng. `soft` = bóng rất nhẹ cho card bo tròn lớn không viền (trang chủ); card có bóng mà cần `overflow: hidden` thì tách 2 lớp (ngoài bóng, trong cắt) vì iOS mất bóng |
| `fontStyleFor(weight, fontsLoaded)` | nơi duy nhất đặt fontFamily ngoài `Text` (font Be Vietnam Pro, dự phòng font hệ thống) |

Lint: file trong `UI_STRICT_FILES` (`eslint.config.js`) cấm literal `#hex`/`rgba()` → thêm màn mới vào danh sách. Màu theo
dữ liệu (màu trạng thái từ danh mục) dùng `StatusBadge color=…`: nhận hex (nền đặc, chữ tự tính) hoặc tên preset
antd mà web lưu (`blue`, `green`, `orange`, `red`, `purple`, `magenta`, `gold`, `cyan`, `geekblue`… → giữ tông Tag web nhưng
kiểu soft: nền nhạt cùng độ đậm `*Subtle`, chữ đậm, không viền; bảng màu ở `components/utils/statusColor.ts`); `default`/không hợp lệ → trung tính. `size="sm"` = chữ 11 cho góc card. Test tương phản: `tests/theme-contrast.test.cjs`.

## Component (`components/ui`, xem trực quan ở `app/dev/ui-gallery.tsx` – chỉ `__DEV__`)

`Text` (variant, color token, `numeric`), `Button` (primary/secondary/ghost/danger, `loading` chặn bấm lặp), `IconButton`
(bắt buộc `accessibilityLabel`; `soft` = tròn trắng bóng nhẹ; `glass` = tròn kính mờ trên ảnh), `Card`, `ListItem` (memo), `KeyValueRow`, `SectionHeader`, `Badge`/`StatusBadge`, `Chip` (`variant="soft"` = không viền, bóng nhẹ),
`Avatar` (`size` 32/40/44/56, `round` = tròn), `MoneyText` (`short`), `SearchBar` (focus đổi viền/icon sang `primary` có chuyển động, nút xoá mờ dần; `variant="soft"` bo tròn hẳn + bóng nhẹ), `TextField`, `SelectField` (bottom sheet, tìm khi nhiều mục; cả hai có `variant="soft"` = nền xám nhạt không viền, bo 16, focus nền trắng viền `primary` – dùng trong card trắng; `SelectField` thêm `raised` = viên thuốc trắng bóng nhẹ, đặt thẳng trên nền màn), `DateField`,
`SegmentedControl` (`variant="soft"` = viên thuốc; `accent` = viên thuốc rãnh cam nhạt, chữ cam), `BottomSheet` (`onClosed` sau khi đóng hẳn), `BottomActionBar`, `Screen` (`header`, `footer`, `scroll`,
`keyboardAware`, `tone`), `AppHeader` (light/dark/transparent/`soft` – hoà nền `bg`, nút quay lại tròn, tiêu đề 20; `hideBack`), `EmptyState`, `ErrorState`, `Skeleton*`,
`CountdownPill`, `ProgressSteps`, `FocusStatusBar`, `Toast` (`useToast`), `confirm()`.

## Quy tắc màn

- **Màn danh sách:** skeleton → dữ liệu / rỗng (có CTA "Xoá bộ lọc" khi đang lọc) / lỗi (có "Thử lại"); `FlatList` + item memo;
  kéo làm mới; tải thêm khi cuộn có chặn gọi đôi; `SearchBar` debounce 300ms (`lib/useDebouncedValue`); bỏ kết quả cũ khi
  lọc đổi nhanh (biến `version`/`requestId`). Khung sẵn: `SalesDocList`, `ReportList`, `FolderListScreen`, `FileListScreen`.
- **Phản hồi:** toast cho thành công/lỗi thường (toast hiện **dưới**, tự né `BottomActionBar`); lỗi nhập dưới trường;
  `confirm()` cho xoá/huỷ (web dùng `window.confirm`); `Alert` chỉ cho lỗi chặn/nghiêm trọng và xin quyền.
- **Định dạng:** tiền/ngày/SĐT qua `lib/format.ts` (`formatVND`, `formatVNDShort`, `formatDate(Time)`, `maskPhone`,
  `formatArea`, `foldVietnamese`). Bảng tiền (lịch thanh toán) hiện **đủ số đồng**, không rút gọn.
- **Trợ năng:** vùng chạm ≥ 44; icon-only phải có nhãn; tối đa phóng chữ `MAX_FONT_SCALE` 1.3.
- **Status bar:** `FocusStatusBar` theo màn (màn trưng bày nền tối dùng `light`).
- Màn nằm trong tab nhận prop `embedded` (ẩn back, chừa 100 cho tab bar).
- App cố định giao diện sáng (`app.json` `userInterfaceStyle: "light"`, cần build store mới có hiệu lực).

## Tồn đọng

- Màn mẫu (chat, phiếu thu, bàn giao, AI chat, tính giá) chỉ đổi sang token, chưa thiết kế lại; chữ trắng trên nền màu ở đó
  đang dùng `colors.surface` thay vì `colors.onPrimary` (cùng giá trị).

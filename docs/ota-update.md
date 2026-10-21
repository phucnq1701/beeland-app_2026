# Cập nhật OTA khi mở app (EAS Update)

App dùng **EAS Update** (`expo-updates`, `app.json` › `updates.url`, `runtimeVersion.policy = appVersion`).
Không dùng hot-updater như BeePoker: hai cơ chế cùng thay chỗ nạp bundle native nên không chạy song song được.
App khách hàng `beeland-app-KH` làm cùng cách (`beeland-app-KH/docs/ota-update.md`).

## Luồng khi mở app (`components/UpdateManager.tsx`)

1. Hỏi máy chủ EAS có bản JS mới cho đúng `runtimeVersion` (= version app native) không. Tối đa 8 giây.
2. Không có bản mới → vào app ngay.
3. Có bản mới → hiện màn **"BeeLand đang cập nhật dữ liệu mới. Xin vui lòng chờ ..."** (`components/OtaUpdateScreen.tsx`:
   logo, giờ, thứ ngày, % tải). Bắt buộc, không có nút bỏ qua. Tải xong app tự reload sang bản mới.
4. Offline, máy chủ lỗi, hỏi quá 8 giây hoặc tải quá 90 giây → bỏ màn chờ, vào app bằng bản đang có.
5. Sau đó mới kiểm tra version Store (`UserService.checkVersion`) như trước: có bản native mới thì hiện hộp "PHIÊN BẢN MỚI".

Logic thuần (test được) ở `lib/otaUpdate.ts`, test: `tests/ota-update.test.cjs`.
Dev (`__DEV__`), Expo Go và web: `expo-updates` tắt nên bỏ qua bước OTA.

Lệnh JS của expo-updates xếp hàng sau quy trình khởi động native. Nếu lúc khởi động native đang tải ngầm bản mới
lâu hơn 8 giây thì app vào luôn, và bản mới áp dụng ở lần mở sau (hành vi mặc định của expo-updates).

## Đẩy bản

```bash
npm run update        # = eas update --branch production --message 'update new'
```

Chỉ người dùng tự chạy (CLAUDE.md quy tắc 6). Bản đẩy lên chỉ tới máy có **cùng version native**:

| Version native (`app.json` › `version`) | Nhận bản OTA |
|---|---|
| 10.6 (hiện tại) | `npm run update` khi `app.json` đang là 10.6 |
| Bản cũ hơn trên máy khách | Phải đổi `version` về đúng số đó rồi đẩy riêng, hoặc chờ khách lên Store |

Build native mới với version mới → OTA sau đó chỉ tới máy có version mới.

**Lần đầu đưa màn chờ này ra:** máy đang chạy JS cũ (chưa có màn) vẫn tải bản mới theo cách cũ (popup nhỏ "Đang cập nhật
phiên bản mới..."). Từ lần đẩy kế tiếp, máy đã có JS mới sẽ hiện màn chờ đầy đủ. Không cần build Store vì `expo-updates`
đã có sẵn trong bản native.

## Kiểm tra máy đã nhận bản nào

Tab **Tài khoản**, dưới nút Đăng xuất: `BeeLand <version> · <8 ký tự mã bản>`.
`gốc` = đang chạy bản đóng gói trong build (chưa nhận OTA nào). So 8 ký tự với cột ID ở `eas update:list`
hoặc trang Updates trên expo.dev.

## Rollback

```bash
npx eas-cli@latest update:list --branch production          # xem các bản, lấy group ID
npx eas-cli@latest update:republish --group <group-id-cũ>   # đẩy lại bản cũ làm bản mới nhất
npx eas-cli@latest update:rollback                          # hoặc: quay về bản trước / bản gốc trong build (hỏi tương tác)
```

## Giới hạn

- OTA chỉ cập nhật JS và ảnh. Thêm thư viện native, đổi quyền, icon, splash hay version → build Store.
- Không chạy trong Expo Go; thử bằng bản release / TestFlight.

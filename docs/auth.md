# Đăng nhập, phiên, tài khoản

## Màn

| Màn | File |
|---|---|
| Đăng nhập (Nội bộ / Đại lý). Kiểu bo tròn: form trong card trắng bo `radius.x3`, ô nhập `soft`, chọn Nội bộ/Đại lý `SegmentedControl variant="accent"` (rãnh cam nhạt), nút dạng viên. Tự cuộn ô đang nhập lên trên bàn phím (ScrollView riêng + `Keyboard` show → `scrollTo` vị trí ô); Enter chuyển ô kế tiếp | `app/login.tsx` |
| Quên mật khẩu → OTP → đặt lại | `app/forgot-password.tsx` → `app/verify-otp.tsx` → `app/reset-password.tsx` |
| Đăng ký (chỉ hướng dẫn, lối vào đã ẩn) | `app/register.tsx` |
| Tài khoản, xoá tài khoản, công tắc Face ID / vân tay. Kiểu bo tròn: tiêu đề 28, card hồ sơ bo `radius.x3` (avatar tròn, nút ›), "Quản lý nhanh" là `FeatureGrid columns={4} compact`, cài đặt trong card bo `radius.xxl`, nút Đăng xuất dạng viên | `app/(tabs)/account.tsx`, `components/account/BiometricLoginSetting.tsx` |
| Hồ sơ (kiểu bo tròn: header `soft`, card avatar + tên + email bo `radius.x3`, thông tin liên hệ trong card bo `radius.xxl`) | `app/profile.tsx` |
| Điểm vào | `app/index.tsx` → redirect `/(tabs)/home` |

## Luồng đăng nhập

1. `login.tsx handleLogin` → `AuthSupabaseService.login` (`sevicesSupabase/AuthService.ts`) → edge function
   `functions/v1/cloud-auth` (`action: login`, `maCTDK`, `email`, `password`, `typeAccount` SYSTEM|AGENCY).
2. Thành công (status 200): lấy token phiên (`acessToken`/`accessToken`/`token`) và cloud JWT (`jwt`/`cloud_jwt`/…,
   không thấy thì `findJwtInObject` quét đệ quy).
3. Xoá khoá phiên cũ (`@token`, `@supabase_jwt`, `@company_id`, `@tenant_id`, `@employee_id`, `@branch_id`, `@ma_nv`,
   `@type_account`, `@home_features_config`, …) rồi ghi lại: `@token`, `@supabase_jwt`, `maCTDK`, `tenCTDKVT`,
   `@type_account`, `setAccountScope` (`components/utils/accountScope`), `persistTenantFromJwt`, `cacheCloudProfile`.
4. `getSessionStatus()` thiếu tenant → `Alert` (lỗi cấu hình tài khoản) và dừng; ổn → hỏi bật Face ID (mục dưới) →
   `router.replace("/(tabs)/home")`.
5. Lưu `@last_login` = tài khoản vừa đăng nhập (`loginType`, `companyCode`, `username`, **không có mật khẩu**) → lần sau
   màn Đăng nhập điền sẵn, mật khẩu luôn để trống.

- Sai tài khoản / mật khẩu: cloud-auth trả **HTTP 200** kèm `{ status: 401, message }` (khoá tài khoản: 403) → toast
  `message`. Lỗi mạng mới ném (axios).
- **Không còn "Nhớ mật khẩu"** (bỏ 2026-11-02, bản 10.7): bản ≤ 10.6 lưu `@remember_login` gồm mật khẩu dạng chữ.
  `purgeLegacyRememberedLogin()` (gọi trong `app/_layout.tsx` lúc mở app) chép tài khoản sang `@last_login` rồi xoá khoá cũ.

## Đăng nhập bằng Face ID / vân tay (bản 10.7)

Tính năng riêng của app (web không có). Code: `lib/biometric.ts` (Keychain / Keystore + LocalAuthentication),
`lib/biometricLogin.ts` (logic thuần, `tests/biometric-login.test.cjs`), `app/login.tsx`,
`components/account/BiometricLoginSetting.tsx`. Cần build native mới (`expo-secure-store`, `expo-local-authentication`)
– **không OTA được lên bản 10.6**.

- **Lưu gì:** `beeland.biometricLogin` trong SecureStore = tài khoản + mật khẩu, `requireAuthentication: true`,
  `WHEN_PASSCODE_SET_THIS_DEVICE_ONLY`. iOS `biometryCurrentSet` / Android `BIOMETRIC_STRONG` → **không mở bằng mật mã
  máy**; thêm / xoá vân tay, khuôn mặt → hệ điều hành huỷ khoá, đọc ra `null`. `@biometric_account` (AsyncStorage) = tài
  khoản đã bật, không mật khẩu – để biết có hiện nút mà không phải quét. Chỉ nhớ **1 tài khoản (gần nhất)**.
- **Máy hỗ trợ:** có phần cứng + đã cài sinh trắc học + `SecureStore.canUseBiometricAuthentication()`; Android chỉ có mở
  khoá khuôn mặt loại yếu → không hiện. Web → không hiện. Tên: iOS "Face ID"/"Touch ID", Android "vân tay" (ưu tiên).
- **Hỏi bật:** sau đăng nhập bằng mật khẩu thành công, nếu Face ID chưa bật cho tài khoản này và chưa từng chọn "Không"
  (`@biometric_declined`) → `confirm()` "Bật". Đang bật cho **tài khoản khác** → xoá cái cũ trước. iOS: quét xác nhận
  rồi mới ghi (ghi không tự hỏi); Android: ghi Keystore tự bật hộp quét.
- **Màn Đăng nhập:** nút "Đăng nhập bằng Face ID" (bấm mới quét, không tự quét) + dòng `Nội bộ · mã công ty · ngu***`.
  Quét → đọc mật khẩu → `signIn` như đăng nhập thường (không hỏi bật lại).
  - Huỷ quét → im lặng. Sai quá nhiều (lockout) → toast, giữ tính năng.
  - Đọc ra `null` (sinh trắc học trên máy đã đổi) → tắt + toast "đăng nhập bằng mật khẩu rồi bật lại".
  - Máy chủ từ chối (thường do **đổi mật khẩu trên web**) → tắt + toast `message`. Lỗi mạng → giữ.
- **Tài khoản > Cài đặt:** công tắc "Đăng nhập bằng Face ID" (ẩn khi máy không hỗ trợ). Bật → nhập mật khẩu →
  `AuthSupabaseService.verifyPassword` (cloud-auth `login` rồi `logout` ngay phiên vừa cấp; `login` không thu hồi phiên
  khác) → quét → lưu. Tắt → xoá ngay. Tài khoản đang đăng nhập lấy từ `@last_login`; máy lên từ bản cũ chưa có thì dựng
  lại từ `@account_scope` + `tenCTDKVT` + `@type_account` (username chữ thường).
- **Đăng xuất:** giữ (để lần sau dùng Face ID). **Xoá tài khoản:** xoá.

- Phiên: JWT không tự làm mới. Trang chủ kiểm tra lúc mở: không có token/JWT hoặc JWT hết hạn → `/login`.
- Hồ sơ: `CloudProfileService.userInfo()` đọc claim JWT + cache `@cloud_profile`, không gọi máy chủ.
- Xoá tài khoản: `AccountDeletionService.deleteCurrentEmployee` → `DELETE rest/v1/dm_employees` (dòng của chính NV),
  hỏi `confirm()` trước.

## Quên mật khẩu (API .NET cũ – `sevices/AuthService.ts`)

| Bước | Endpoint | Thành công |
|---|---|---|
| Gửi OTP | `api/FogotPassword` (`TenCTDKVT`, `Email`) | `status === 200` |
| Xác thực OTP | `api/admin/Staff/Authentication_OTP` (`TenCTDKVT`, `Email`, `OTP`) | `status === 200` |
| Đặt lại | `api/admin/Staff/RestPassword` (`TenCTDK`, `Password`, `PasswordRe`, `MaNV: Number(otp)`) | báo lỗi chỉ khi có `status` khác 200 |

## Bẫy / điểm dễ sai

- Đổi tài khoản phải xoá đủ khoá phiên (bước 3) – sót `@home_features_config` hay `@type_account` sẽ lộ tính năng của tài khoản trước.
- `getCompanyId()` trả `""` nếu không có uuid công ty → service phải coi là hết phiên, không gọi API với mã chữ.
- Không lưu mật khẩu ngoài SecureStore có khoá sinh trắc học (`lib/biometric.ts`) – không đưa lại "Nhớ mật khẩu" vào AsyncStorage.
- Face ID: SecureStore iOS lưu mục có / không xác thực ở 2 truy vấn khác nhau → đọc, ghi, xoá phải dùng cùng
  `SECURE_OPTIONS`. Expo Go trên iOS không dùng được Face ID → thử bằng dev build.
- Web build: `components/UpdateManager.tsx` luôn hiện "Phiên bản mới" (phiên bản native = 0 trên web). Chỉ ảnh hưởng web.

## Tồn đọng

- Dạng trả về của `RestPassword` khi thành công **chưa kiểm chứng** (không màn web nào gọi endpoint này).
- Các endpoint quên mật khẩu thuộc API cũ – còn hoạt động khi web đã Cloud-only hay không: **chưa kiểm chứng**.
- Đăng ký: màn cũ báo thành công giả; hiện chỉ hướng dẫn liên hệ quản trị. Muốn có đăng ký thật cần API.

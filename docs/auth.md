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

1. `login.tsx signIn` → `AuthApi.login` (`services/AuthApi.ts`) → `fn_nv_app_dang_nhap` (không JWT; `p_ma_ctdk`,
   `p_tai_khoan`, `p_mat_khau`, `p_loai_tk` SYSTEM|AGENCY). Máy chủ bọc lõi đăng nhập web (CloudAuthService).
2. Thành công: `{ jwt (7 ngày), token (token phiên, xoay mỗi lần làm mới, tối đa 30 ngày), nguoi_dung }` →
   `clearSession()` rồi `saveSession()` (`services/session.ts`): ghi `@supabase_jwt`, `@token`, `@nv_user`, `tenCTDKVT` (mã công ty
   đã gõ, để hiển thị) và xoá khoá cũ của lớp Supabase (`@company_id`, `@tenant_id`, `@type_account`, `@ma_nv`, `@employee_id`…
   – không còn ghi). Tên khoá `@supabase_jwt` / `@token` giữ nguyên có chủ ý (đổi tên sẽ đăng xuất mọi người).
3. `setAccountScope` (`components/utils/accountScope`), lưu `@last_login`. `nguoi_dung.company_id` trống → `Alert` (tài khoản
   thiếu công ty) và dừng; ổn → hỏi bật Face ID (mục dưới) → `resetChatSession()` + `chatAuthChanged(true)` →
   `router.replace("/(tabs)/home")`.
4. `@last_login` = tài khoản vừa đăng nhập (`loginType`, `companyCode`, `username`, **không có mật khẩu**) → lần sau màn
   Đăng nhập điền sẵn, mật khẩu luôn để trống.

- Màn đọc thông tin phiên bằng `getSessionInfo()` (`companyId`, `employeeId`, `maNv`, `typeAccount`, `isAgency`, `companyCode`
  – lấy từ `@nv_user`, thiếu thì claim JWT). Máy chủ vẫn là nơi kiểm quyền.
- Sai tài khoản / mật khẩu / bị khoá: HTTP 4xx → `NvApiError` → `{ status: "rejected", message }` → toast `message`.
  Mất mạng / 5xx → `{ status: "network" }`.
- **Không còn "Nhớ mật khẩu"** (bỏ 2026-11-02, bản 10.7): bản ≤ 10.6 lưu `@remember_login` gồm mật khẩu dạng chữ.
  `purgeLegacyRememberedLogin()` (gọi trong `app/_layout.tsx` lúc mở app) chép tài khoản sang `@last_login` rồi xoá khoá cũ.
  `loadLastLogin()` đọc cả `@remember_login` khi chưa có `@last_login` — màn Đăng nhập chạy song song với `_layout`, có thể
  đọc trước khi chép xong (lỗi bắt được khi chạy thử 2026-11-02: lần mở đầu sau cập nhật không điền sẵn).

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
- **Màn Đăng nhập:** nút tròn icon Face ID / vân tay cùng hàng, bên phải nút "Đăng nhập" (cao 52 = Button lg, màu như
  Button `secondary`; người dùng chốt bố cục 2026-11-02), bấm mới quét; "Quên mật khẩu?" căn trái ngay dưới hàng nút.
  Không có dòng tài khoản (mã công ty + tài khoản đã điền sẵn ở ô); nhãn trợ năng nút tròn đọc `Nội bộ · brg · adm***`.
  Quét → đọc mật khẩu → `signIn` như đăng nhập thường (không hỏi bật lại). Bật xong mà vẫn ở màn này (đăng nhập bị chặn)
  → cập nhật state để nút hiện ngay.
  - Huỷ quét → im lặng. Sai quá nhiều (lockout) → toast, giữ tính năng.
  - Đọc ra `null` (sinh trắc học trên máy đã đổi) → tắt + toast "đăng nhập bằng mật khẩu rồi bật lại".
  - Máy chủ từ chối (thường do **đổi mật khẩu trên web**) → tắt + toast `message`. Lỗi mạng → giữ.
- **Tài khoản > Cài đặt:** công tắc "Đăng nhập bằng Face ID" (ẩn khi máy không hỗ trợ). Bật → nhập mật khẩu →
  `AuthApi.verifyPassword` (`fn_nv_app_dang_nhap` rồi `fn_nv_app_dang_xuat` ngay phiên vừa cấp; không đụng phiên đang dùng)
  → quét → lưu. Tắt → xoá ngay. Tài khoản đang đăng nhập lấy từ `@last_login`; máy lên từ bản cũ chưa có thì dựng
  lại từ `@account_scope` + `tenCTDKVT` + `@type_account` (username chữ thường).
- **Đăng xuất:** giữ (để lần sau dùng Face ID). **Xoá tài khoản:** xoá.

## Phiên, đăng xuất, hồ sơ, xoá tài khoản

- **Phiên** (`services/session.ts`): `getFreshJwt()` tự làm mới (`fn_nv_app_lam_moi_phien { p_token }`, xoay token) khi JWT
  còn < 1 ngày; máy chủ trả 401 ⇒ làm mới 1 lần rồi gửi lại. Nhiều lời gọi chờ dùng chung một lần làm mới. Làm mới bị
  từ chối (401/403: quá 30 ngày, bị khoá, đổi mật khẩu…) ⇒ `clearSession()` + `onSessionExpired` → `components/SessionGuard.tsx`
  (gắn ở `app/_layout.tsx`) toast lý do, xoá cache, về `/login`. Lỗi mạng ⇒ giữ phiên. Trang chủ kiểm lúc mở: không có token
  hoặc không lấy được JWT → `/login`.
- **Đăng xuất** (`account.tsx handleLogout`): gỡ push (`unregisterChatPush`, cần JWT cũ) → `logoutCurrentSession()`
  (`services/LogoutService.ts` → `AuthApi.logout`: `fn_nv_app_dang_xuat { p_token }` thu hồi phiên trên máy chủ – lỗi mạng bỏ
  qua – rồi `clearSession()` xoá `SESSION_KEYS` của `lib/sessionKeys.ts` + `@nv_user`) → `queryClient.clear()` → `dismissAll` +
  `router.replace("/login")`. Giữ `@last_login`, `@account_scope`, `@home_features_config`, Face ID.
- **Hồ sơ:** `CloudProfileService.userInfo()` đọc `nguoi_dung` của phiên (`@nv_user`, cập nhật mỗi lần làm mới), không gọi
  máy chủ riêng.
- **Xoá tài khoản** (Apple 5.1.1(v)): `confirm()` → `AccountDeletionService.deleteCurrentEmployee` → `fn_nv_app_xoa_tai_khoan {}`
  – máy chủ lấy nhân viên / công ty từ JWT, xoá như lõi xoá nhân viên của web; nhân viên còn chứng từ ⇒ **khoá** tài khoản
  (`ket_qua: "khoa"`, không đăng nhập được nữa); tài khoản quản trị / nhóm toàn quyền ⇒ máy chủ từ chối (lời báo hiện nguyên).
  Xong → gỡ push → `clearDeletedEmployeeSession` (đăng xuất phiên máy chủ + `clearSession`) → toast "Đã xóa" / "Đã bị khóa".

## Quên mật khẩu – OTP email (`fn_nv_app_quen_mat_khau`)

Endpoint app bọc `StaffResetPasswordService` của API .NET (cùng thân / kết quả edge `staff-reset-password` cũ) – web không có
luồng tương ứng cho nhân viên (chỉ liên kết email cho đại lý). Áp cho mọi tài khoản đăng nhập `cloud_users` (Nội bộ + Đại lý).
Gọi khi chưa đăng nhập (axios riêng, không JWT). App: `services/StaffResetPasswordService.ts`, `lib/staffResetPassword.ts`
(test `tests/staff-reset-password.test.cjs`).

| Bước | Màn | Gửi | Trả về |
|---|---|---|---|
| 1. Gửi mã | `app/forgot-password.tsx` (điền sẵn mã công ty + tài khoản từ màn đăng nhập) | `{action:"request", maCTDK, account}` | `{otpId, expiresIn: 600, resendAfter: 60}` – **cùng một dạng** dù tài khoản có email hay không |
| 2. Nhập mã | `app/verify-otp.tsx` (một ô nhập ẩn + 6 ô hiển thị, tự điền mã iOS) | `{action:"verify", otpId, code}` | `{resetToken, expiresIn: 900}` |
| 3. Mật khẩu mới | `app/reset-password.tsx` | `{action:"reset", resetToken, newPassword}` | `{success}` → về màn đăng nhập |

- Thân gửi `{ action, … }` như bảng trên, `POST {API}/api/app-nhan-vien/fn_nv_app_quen_mat_khau`.
- Lỗi: HTTP 400/500 `{error}` (axios ném) – đọc bằng `resetErrorMessage`; chờ gửi lại có `retryAfter` (`retryAfterOf`).
- Máy chủ: mã 6 số hạn 10 phút, sai 5 lần huỷ mã; chờ 60 s, tối đa 5 lần / giờ theo mã công ty|tài khoản; email nhận =
  email hồ sơ nhân viên, không có thì tên đăng nhập nếu là email. Đặt xong thu hồi mọi phiên đăng nhập.
- Bản giả khi BE chưa triển khai: `EXPO_PUBLIC_STAFF_RESET_MOCK=1` (`mocks/staffResetPassword.ts`, mã đúng 123456).

## Bẫy / điểm dễ sai

- Không đọc lại khoá lưu cũ (`@type_account`, `@company_id`, `@ma_nv`…) để biết tài khoản – dùng `getSessionInfo()`.
  Ngoại lệ duy nhất: dựng lại tài khoản Face ID cho máy lên từ bản cũ (`lib/biometric.ts`).
- Cấu hình trang chủ `@home_features_config` khoá theo tài khoản (`getScopedKey`) nên đổi tài khoản không lộ tính năng của
  tài khoản trước.
- Không lưu mật khẩu ngoài SecureStore có khoá sinh trắc học (`lib/biometric.ts`) – không đưa lại "Nhớ mật khẩu" vào AsyncStorage.
- Face ID: SecureStore iOS lưu mục có / không xác thực ở 2 truy vấn khác nhau → đọc, ghi, xoá phải dùng cùng
  `SECURE_OPTIONS`. Expo Go trên iOS không dùng được Face ID → thử bằng dev build.
- Web build: `components/UpdateManager.tsx` luôn hiện "Phiên bản mới" (phiên bản native = 0 trên web). Chỉ ảnh hưởng web.

## Tồn đọng

- Bộ API riêng (đăng nhập, quên mật khẩu, xoá tài khoản…) chờ người dùng build + deploy API (`docs/app-api-rieng.md`).
  Quên mật khẩu cần email hồ sơ nhân viên (nhiều tài khoản chưa có).
- Đổi mật khẩu khi đăng nhập bằng mật khẩu tạm: app chưa có (máy chủ chặn app, đổi trên web).
- Đăng ký: màn cũ báo thành công giả; hiện chỉ hướng dẫn liên hệ quản trị. Muốn có đăng ký thật cần API.

# Đăng nhập, phiên, tài khoản

## Màn

| Màn | File |
|---|---|
| Đăng nhập (Nội bộ / Đại lý). Kiểu bo tròn: form trong card trắng bo `radius.x3`, ô nhập `soft`, chọn Nội bộ/Đại lý `SegmentedControl variant="accent"` (rãnh cam nhạt), nút dạng viên. Tự cuộn ô đang nhập lên trên bàn phím (ScrollView riêng + `Keyboard` show → `scrollTo` vị trí ô); Enter chuyển ô kế tiếp | `app/login.tsx` |
| Quên mật khẩu → OTP → đặt lại | `app/forgot-password.tsx` → `app/verify-otp.tsx` → `app/reset-password.tsx` |
| Đăng ký (chỉ hướng dẫn, lối vào đã ẩn) | `app/register.tsx` |
| Tài khoản, xoá tài khoản. Kiểu bo tròn: tiêu đề 28, card hồ sơ bo `radius.x3` (avatar tròn, nút ›), "Quản lý nhanh" là `FeatureGrid columns={4} compact`, cài đặt trong card bo `radius.xxl`, nút Đăng xuất dạng viên | `app/(tabs)/account.tsx` |
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
4. `getSessionStatus()` thiếu tenant → `Alert` (lỗi cấu hình tài khoản) và dừng; ổn → `router.replace("/(tabs)/home")`.
5. "Nhớ mật khẩu" lưu `@remember_login` (gồm cả mật khẩu, dạng chữ) – có sẵn từ trước, giữ nguyên.

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
- Web build: `components/UpdateManager.tsx` luôn hiện "Phiên bản mới" (phiên bản native = 0 trên web). Chỉ ảnh hưởng web.

## Tồn đọng

- Dạng trả về của `RestPassword` khi thành công **chưa kiểm chứng** (không màn web nào gọi endpoint này).
- Các endpoint quên mật khẩu thuộc API cũ – còn hoạt động khi web đã Cloud-only hay không: **chưa kiểm chứng**.
- Đăng ký: màn cũ báo thành công giả; hiện chỉ hướng dẫn liên hệ quản trị. Muốn có đăng ký thật cần API.

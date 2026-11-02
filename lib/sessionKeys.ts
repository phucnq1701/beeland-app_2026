/**
 * Khoá AsyncStorage của phiên đăng nhập (token, JWT, tenant, hồ sơ cache…) – xoá khi đăng xuất / xoá tài khoản.
 * KHÔNG gồm: `@last_login` (điền sẵn), `@account_scope` + `@home_features_config` (cấu hình theo tài khoản),
 * `@biometric_*` (Face ID – đăng xuất giữ, docs/auth.md).
 */
export const SESSION_KEYS = [
  "@token", "@supabase_jwt", "@cloud_profile", "@company_id", "@tenant_id",
  "@cloud_company_id", "@employee_id", "@user_company_id", "@branch_id",
  "@ma_nv", "@type_account", "@company_code", "maCTDK_UUID", "maCTDK", "tenCTDKVT",
];

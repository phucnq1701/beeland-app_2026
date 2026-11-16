# Inventory D: transport and core layer (beeland-app_2026)

Repo: `/Users/huaan/Documents/Project-cong-ty/MegaBeeland/beeland-app_2026` (read-only inventory, 2026-11-16).
Paths below are relative to the repo. `L` = line number.

---

## 1. Transport

### 1.1 Base URLs

| Constant | Value | File |
|---|---|---|
| `API_URL` (exported) | `https://api-beeland26.beesky.vn` (no trailing slash) | `sevicesSupabase/axiosApiSupabase.ts:9` |
| `axiosApiSupabase.defaults.baseURL` | `API_URL`. Callers pass relative paths **without a leading slash** (`rest/v1/...`, `functions/v1/...`) | `axiosApiSupabase.ts:14-22` |
| Realtime hub | `${API_URL}/api/realtime` (SignalR, WebSocket only) | `sevicesSupabase/realtimeHub.ts:117` |
| Old .NET API (`axiosApi`) | `https://api-beeland.beesky.vn/` | `sevices/axiosApi.ts:21` (only the hidden appointments screen uses it) |
| File server | `https://upload.beesky.vn/` (relative file links + fallback `api/Upload`) | several, see section 4 |
| App version API | `https://api-bms.beesky.vn/api/app/get-version` | `sevicesSupabase/UserService.ts:12` |

### 1.2 The axios instance `axiosApiSupabase` (`sevicesSupabase/axiosApiSupabase.ts`)

- `axios.create({ baseURL: API_URL, timeout: 30000, headers: { "Content-Type": "application/json", Accept: "application/json", apikey: SUPABASE_ANON_KEY } })`.
- `SUPABASE_ANON_KEY` (L11) is a hard-coded HS256 JWT with `{"role":"anon","iss":"supabase","iat":1787546844,"exp":1945226844}`. It is exported and used in `realtimeHub.ts`, `ChatService.ts` and `AccountDeletionService.ts`.
- **Request interceptor (L24-56):**
  - Always sets `config.headers.apikey = SUPABASE_ANON_KEY`.
  - If `config.url?.startsWith("rest/v1")`: `Authorization: Bearer <getValidSupabaseJwt()>` (the `@supabase_jwt` value if it has not expired, with a 30 s leeway). If the JWT is missing or expired, it silently falls back to `Authorization: Bearer SUPABASE_ANON_KEY` and only logs a message. RLS then returns empty results and the user sees no error.
  - Any other URL (`functions/v1/*`, absolute URLs): `Authorization: Bearer <AsyncStorage "@token">`, or the anon key if there is no token. So **edge functions get the opaque cloud session token `@token`, not the JWT.**
  - The prefix test is a plain string match. A URL starting with `/rest/v1` would not be detected.
- **Response interceptor (L58-85):** logging only (`ECONNABORTED` → timeout log, no response → network log, otherwise status and data). If the status is 401 and the body contains `"JWT expired"`, it logs PGRST303. **There is no retry, no refresh and no forced logout.** The error is always re-thrown.
- **No tenant header.** Nothing like `x-tenant`, `x-company` or `Accept-Profile` is ever sent. The tenant always travels in the payload, either as `p_ma_ctdk` / `p_ma_ctdk_uid` / `p_company_id` (RPC) or as `ma_ctdk=eq.` / `ma_ctdk_uid=eq.` / `ma_ctdk_id=eq.` (REST filter). Each service builds this by hand.
- **Other headers seen elsewhere:**
  - `x-cloud-token: <@token>`, plus `token` in the body: `PaymentGatewayService.ts:16` (`functions/v1/payment-gateway`) and `CustomerRequestService.ts:68` (`functions/v1/storage-broker`).
  - `Prefer: count=exact`: `BookingService.ts:1312`, `LichHenService.ts:39`.
  - `Prefer: resolution=merge-duplicates,return=minimal`: `BookingService.ts:1595` (upsert).
  - `Prefer: return=representation`: `AccountDeletionService.ts:51`.
  - `Content-Type: multipart/form-data`: `BookingService.ts:357`.

**Calls that bypass the interceptor (they set their own headers):**

| File:L | How | Headers |
|---|---|---|
| `ChatService.ts:49` | `fetch` POST `${API_URL}/functions/v1/chat-files` | `apikey: anon`, `Authorization: Bearer <JWT>` (on purpose: the interceptor would send `@token`) |
| `ChatService.ts:75-84` | `XMLHttpRequest` PUT `${API_URL}/storage/v1/object/upload/sign/chat-files/<path>?token=<t>` | `apikey: anon`, `Authorization: Bearer anon`, `x-upsert: false` |
| `AccountDeletionService.ts:46` | plain `axios.delete` on `${baseURL}/rest/v1/dm_employees` | `apikey: anon`, `Authorization: Bearer <JWT>` (fixed value, no anon fallback), `Prefer: return=representation` |
| `BookingService.ts:374` | `fetch` POST `https://upload.beesky.vn/api/Upload` | none |
| `UserService.ts:11` | plain `axios.post` to api-bms | `Content-Type` only |

### 1.3 Token lifecycle

**Login** (`app/login.tsx` `signIn`, L103-220 → `AuthSupabaseService.login`, `AuthService.ts:4-8`):
- Sends `POST functions/v1/cloud-auth` with body `{ action: "login", maCTDK: <company code typed by the user>, email: <username>, password, typeAccount: "SYSTEM" | "AGENCY" }`.
- Because the URL is not `rest/v1`, the request carries `Authorization: Bearer <old @token or anon>`.
- **Success is decided by `res.status === 200` in the JSON body.** cloud-auth returns HTTP 200 with `{ status: 401, message }` for a wrong password, so `res.message` becomes the error toast.

The response fields the app reads:
- **Session token → `@token`:** `acessToken` (sic) ?? `accessToken` ?? `token`, then the same names under `data.*`.
- **App JWT → `@supabase_jwt`:** `jwt` ?? `cloud_jwt` ?? `supabase_jwt` ?? `cloudJwt`, then the same under `data.*`, then `data.access_token`. If none of these looks like a JWT, it falls back to `findJwtInObject(res)`, a recursive scan for any 3-part JWT string under a key matching `/jwt|token/`.
- **Text company code `maCTDK`:** `data.maCTDK` ?? `maCTDK` → stored in AsyncStorage `maCTDK`.
- **Read by `persistTenantFromJwt(jwt, companyCode, res)`:**
  - `companyId`, `employeeId`, `employee.id`, `branchId`, `employee.companyId`
  - `ma_nv` / `maNV`, `type_account` / `typeAccount`
  - the same names under `data.*`
  - `findTenantUuidInObject` as a last resort
- **Read by `cacheCloudProfile(res, jwt)` (`CloudProfileService.ts:18-47`):**
  - `id`, `companyId`, `fullName`, `hoTen`, `email`, `phone`
  - `employee.{email, hoTen, dienThoai}`
  - `employeeRow.{email, ho_ten, dien_thoai}`
  - The profile is cached only if `id === claims.sub` and `companyId === claims.company_id`.

The AsyncStorage keys written at login:
- **Cleared first:** `@cloud_profile`, `@token`, `@supabase_jwt`, `@company_id`, `@tenant_id`, `@cloud_company_id`, `@employee_id`, `@user_company_id`, `@branch_id`, `@ma_nv`, `@type_account`, `maCTDK_UUID`, `@home_features_config`.
- **Then set:**
  - `@token`, `@supabase_jwt`, `maCTDK`
  - `tenCTDKVT` (= the code the user typed), `@type_account`
  - `@account_scope`, `@last_login`
  - `@tenant_id` = `@company_id` = `maCTDK_UUID` = `@cloud_company_id` (tenant UUID)
  - `@employee_id`, `@branch_id` = `@user_company_id`
  - `@ma_nv`, `@company_code`, `@cloud_profile`

After saving, `getSessionStatus()` must return `ok` (JWT present, not expired, tenant UUID found). Otherwise the app shows an `Alert` and blocks entry. On success, `resetChatSession()` and `chatAuthChanged(true)` run (re-subscribe to chat, register push), then `router.replace("/(tabs)/home")`.

**JWT claims the app reads** (`cloudTenant.ts`, `CloudProfileService.ts`, `AccountDeletionService.ts`, `login.tsx`):

| Claim | Used for |
|---|---|
| `exp` | `isJwtExpired` (30 s leeway; a token with no `exp` counts as never expiring) |
| `sub` | Profile cache match; account deletion requires it to be present |
| `company_id` (first of `TENANT_KEYS`, UUID only; `user_metadata` / `app_metadata` also checked) | Tenant UUID (`getTenantId` / `getCompanyId`) |
| `employee_id` (`EMPLOYEE_KEYS`) | `getEmployeeId`; `DELETE dm_employees?id=eq.` |
| `branch_id` | `getBranchId`, `getUserCompanyId` |
| `type_account` | `getTypeAccount` (SYSTEM / AGENCY) |
| `ma_nv` | `getMaNv` |
| `company_code` / `companyCode` / `ma_ctdk_code` / `tenant_code` / `tenCTDKVT` | `getCompanyCode` (text code) |
| `company_ids` / `allowed_company_ids` / `user_metadata.company_ids` | `getUserCompanyIds`, which **is never called** (dead code) |
| `role` | Logged only |

**Refresh:** there is no refresh token and no automatic refresh. The only path that renews the JWT is `CloudProfileService.userInfo()` (`CloudProfileService.ts:50-101`):
- It is called from `app/profile.tsx:32` and the focus handler of `app/(tabs)/account.tsx:94`.
- If the cached profile does not match or the JWT has expired, it calls `cloud-auth { action: "verify", token: @token }`.
- If the response contains `jwt` / `cloud_jwt` / `supabase_jwt` / `cloudJwt` (top level or under `data`), the profile matches, and that JWT has not expired, it overwrites `@supabase_jwt`.

**Expiry handling:**
- `app/(tabs)/home.tsx:70-95` redirects to `/login` when `@token` is missing, `@supabase_jwt` is missing, or the JWT has expired.
- Every service that calls `getValidSupabaseJwt()` returns empty data or throws a "Phiên đăng nhập đã hết hạn…" error when it gets `null`. The `diagram/[mada]` comment says the JWT lasts 7 days.

**Verify password** (`AuthService.verifyPassword`, L14-31, used by `components/account/BiometricLoginSetting.tsx:100` to enable Face ID):
- Calls `cloud-auth login` with the same body as a normal login.
- If that succeeds, it fires `cloud-auth { action: "logout", token: res.token ?? res.data.token }` to kill the session it just created. Errors are ignored.

**Logout** (`LogoutService.logoutCurrentSession`, called from `app/(tabs)/account.tsx:76`):
1. `unregisterChatPush()` first, which runs `fn_chat_push_huy` and needs the JWT.
2. `chatAuthChanged(false)`.
3. `POST functions/v1/cloud-auth { action: "logout", token: @token }` with an 8 s timeout; errors are ignored.
4. `AsyncStorage.multiRemove(SESSION_KEYS)`.
5. `queryClient.clear()`, then `router.replace("/login")`.

`SESSION_KEYS` (`lib/sessionKeys.ts`): `@token`, `@supabase_jwt`, `@cloud_profile`, `@company_id`, `@tenant_id`, `@cloud_company_id`, `@employee_id`, `@user_company_id`, `@branch_id`, `@ma_nv`, `@type_account`, `@company_code`, `maCTDK_UUID`, `maCTDK`, `tenCTDKVT`. Logout keeps `@last_login`, `@account_scope`, `@home_features_config` and `@biometric_*`.

**Face ID** (`lib/biometricLogin.ts`): pure logic, **no network**. The Keychain/Keystore side lives in `lib/biometric.ts` (SecureStore). A Face ID login reads `{loginType, companyCode, username, password}` and replays the normal `signIn` (cloud-auth login). If that is rejected, Face ID is turned off.

**`app/_layout.tsx`: no network of its own.** It only checks `@home_features_config` and calls `purgeLegacyRememberedLogin()`. It mounts:
- `<ChatNotifier/>`: chat realtime `chat:u:*` and push registration.
- `<UpdateManager/>`: `UserService.checkVersion()` against api-bms, plus expo-updates OTA.

### 1.4 What `cloudTenant.ts` does (509 lines). It does NOT rewrite requests or responses.

`cloudTenant.ts` has **no interceptor, no request mutation and no response mutation.** It is a pure helper module: a JWT decoder plus AsyncStorage readers and writers that **derive tenant and identity values the services then put into their own params.** In detail:

- **L3-52 `base64UrlDecodeToString` / `decodeJwtPayload`:** a hand-written base64url decoder (Hermes has no `atob`/`Buffer`), with UTF-8 via `TextDecoder` or a `decodeURIComponent` fallback. It does not verify the signature.
- **L54-67 `UUID_RE`, `isUuidLike`, `looksLikeJwt`:** small validators.
- **L69-91 `pickFirst` / `pickFirstUuid`:**
  - Both return the first non-empty value among a list of keys.
  - The UUID variant skips anything that is not a UUID.
  - Why it matters: `ma_ctdk` / `maCTDK` is a TEXT code (for example `msr`, `BRGHN-1`), while the tenant UUID is `company_id` / `companyId`. Skipping non-UUIDs means key order can no longer pick the wrong tenant.
- **L99-138 key lists:**
  - `TENANT_KEYS` (15 aliases, `company_id` first)
  - `EMPLOYEE_KEYS` (`employee_id`…; deliberately not `sub`, which is the cloud_users id)
  - `USER_COMPANY_KEYS` (branch first, then tenant)
- **L144-199 `findJwtInObject` / `findTenantUuidInObject`:**
  - These recursively scan the login response (depth 4) in case the backend renames keys.
  - The tenant scan also looks inside `user_metadata`, `app_metadata`, `user`, `data`, `profile`, `employee`, `staff` and `employeeRow`.
- **L201-223 `isJwtExpired` (30 s leeway) / `getValidSupabaseJwt`:** returns `@supabase_jwt`, or `null` if it is missing or expired.
- **L230-378 getters.** Each reads JWT claims first, then falls back to AsyncStorage:
  - `getTenantId` = `getCompanyId`: tenant UUID, from `@tenant_id` / `@company_id` / `maCTDK_UUID` / `maCTDK`. It never returns the text code; it returns `""` instead.
  - `getEmployeeId`, `getBranchId`, `getTypeAccount` (upper-cased), `getMaNv`
  - `getUserCompanyId`: branch, falling back to tenant
  - `getUserCompanyIds`: AGENCY → `branch_id`, SYSTEM → `""` (server scopes by employee). Unused.
  - `getCompanyCode`: text code, from `@company_code` / `tenCTDKVT` / `maCTDK`
- **L388-478 `persistTenantFromJwt`:** writes the identity keys listed in 1.3 at login.
- **L481-509 `getSessionStatus`:** `{hasToken, hasJwt, jwtExpired, tenantId, hasTenant, ok, reason}`, used only by `login.tsx`.

**Where tenant substitution actually happens:** inside each service, by hand. For example, `ma_ctdk_uid: eq.${getCompanyId()}` in `ProjectService.ts:92,159` and `CustomerRequestService.ts:156`, or `p_ma_ctdk_uid: tenant` in `SigningService.ts:98,149,165`. `docs/data-access.md:41-55` documents which table uses the UUID and which uses the lower-case text code.

The `catalogTenantRewrite` that `docs/data-access.md:43` mentions (`cloud_catalogs.ma_ctdk` → `ma_ctdk_uid`) is **the web's** `lib/catalogTenantRewrite.ts`. **There is no such file in the app.**

How many modules use the helpers:
- `getCompanyId`: 12 services plus `app/products.tsx`
- `getValidSupabaseJwt`: 15 services, `diagram/[mada]`, `ChatNotifier`, `chatPush`
- `getCompanyCode`: 5 services
- `getTypeAccount`: 4 screens and 3 services
- `getMaNv`: 4
- `getEmployeeId`: 3
- `getBranchId`: 2
- `getTenantId`, `getUserCompanyId`: `CustomerService` only

When the JWT carries identity server-side, most of these become unnecessary.

---

## 2. Every network call in the core files

R/W: R = read, W = write, A = auth.

| # | file:line | Target | R/W | Params | Result fields used by callers | Screens | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `sevicesSupabase/AuthService.ts:5-7` (`login`) | POST `functions/v1/cloud-auth` | A | `{action:"login", maCTDK, email, password, typeAccount:"SYSTEM"\|"AGENCY"}` | see 1.3 for the full list; the main ones are body `status` (200 = ok), `message`, the token and JWT fields, and `maCTDK` | `app/login.tsx:113` (password + Face ID) | Bearer = old `@token` or anon |
| 2 | `AuthService.ts:5-7` (`login` with `{action:"verify", token}`) | POST `functions/v1/cloud-auth` | A/R | `{action:"verify", token:@token}` | `status`; profile fields (`id`, `companyId`, `employee.*`, `employeeRow.*`, `fullName`, `hoTen`, `email`, `phone`); refreshed `jwt` / `cloud_jwt` / `supabase_jwt` / `cloudJwt` (top level or `data.*`) | `app/profile.tsx:32`, `app/(tabs)/account.tsx:94` via `CloudProfileService.userInfo` (`CloudProfileService.ts:75`) | Only JWT "refresh" path |
| 3 | `AuthService.ts:18-24` (`verifyPassword`) | POST `functions/v1/cloud-auth` login | A | same as #1 | `status`, `message`, `token` / `data.token` | `components/account/BiometricLoginSetting.tsx:100` | Followed by #4 |
| 4 | `AuthService.ts:28` | POST `functions/v1/cloud-auth` | A/W | `{action:"logout", token:<token of the new session>}` | none (fire and forget) | as #3 | Kills the throwaway session |
| 5 | `AuthService.ts:32-36` (`loginAgency`) | POST `functions/v1/cloud-auth` | A | any | – | **unused** | Dead code |
| 6 | `sevicesSupabase/LogoutService.ts:15-17` | POST `functions/v1/cloud-auth` | A/W | `{action:"logout", token:@token}`, timeout 8000 | none | `app/(tabs)/account.tsx:76` | Errors swallowed |
| 7 | `sevicesSupabase/AccountDeletionService.ts:46-59` | DELETE `rest/v1/dm_employees` (direct axios) | W | query `ma_ctdk=eq.<claims.company_id>`, `id=eq.<claims.employee_id>`, `select=id`; header `Prefer: return=representation` | response array: exactly one row with `id === employee_id`; error `status` 401/403, `data.code` `42501` / `23503` | `app/(tabs)/account.tsx:113` (Xoá tài khoản) | Apple-required account deletion. Needs an app-only endpoint |
| 8 | `sevicesSupabase/StaffResetPasswordService.ts:16,20-21` | POST `functions/v1/staff-reset-password` | A | `{action:"request", ...normalizeLogin(companyCode, account)}` | `otpId`, `expiresIn`, `resendAfter`, `message`; error `{error, retryAfter}` | `app/forgot-password.tsx:31`, `app/verify-otp.tsx:66` (resend) | Mock via `EXPO_PUBLIC_STAFF_RESET_MOCK=1`; already a .NET-native function |
| 9 | `StaffResetPasswordService.ts:23` | POST `functions/v1/staff-reset-password` | A | `{action:"verify", otpId, code}` | `resetToken`, `expiresIn` | `app/verify-otp.tsx:48` | |
| 10 | `StaffResetPasswordService.ts:25-26` | POST `functions/v1/staff-reset-password` | W | `{action:"reset", resetToken, newPassword}` | `message` | `app/reset-password.tsx:34` | |
| 11 | `ChatService.ts:91` `me` | POST `rest/v1/rpc/fn_chat_me` | R | `{}` | `data.{employee_id, ho_ten, anh, is_dai_ly, san_id, ten_san, is_chat_dai_ly, is_admin, tenant, kenh:{user, presence}}` | all chat screens via `components/chat/useChat.ts:27` (`loadChatMe`), `ChatNotifier`, `app/chat/manage-members/[groupId].tsx:42` | All `fn_chat_*` go through `chatRpc` (L31-42): JWT required, result is `{data}` or `{error}`; an error saying "phiên đăng nhập không hợp lệ" becomes "Tài khoản chưa có hồ sơ nhân viên…" |
| 12 | `ChatService.ts:92` `danhBa` | `rpc/fn_chat_danh_ba` | R | `p_tab: "noi_bo"\|"dai_ly"`, `p_q` | `ChatContact[]`: `employee_id`, `ho_ten`, `anh`, `chuc_vu`, `phong_ban`, `san_id`, `ten_san` | `components/chat/ContactPicker.tsx:43` (used by `app/contacts.tsx`, `create-group`, `manage-members`) | |
| 13 | `ChatService.ts:93` `inbox` | `rpc/fn_chat_inbox` | R | `p_filter: {khu: "beechat"\|"noi_bo"\|"dai_ly"\|"tat_ca", limit, q?, cursor?, chua_doc?}` | `items[]` of `{conversation{id, loai, ten, anh_dai_dien, san_id, ten_san, trang_thai, tags, kenh, widget_id, ten_widget, last_message_at, last_message_preview}, doi_dien, contact, thanh_vien, unread, pinned, muted, la_thanh_vien}`, `next_cursor` | `app/chat/index.tsx` (`useChatInbox`, useChat.ts:136,161); unread badge `useChatUnreadCount` (useChat.ts:212: `{khu:"tat_ca", chua_doc:true, limit:50}`) on `app/(tabs)/home.tsx` | |
| 14 | `ChatService.ts:94` `conversationGet` | `rpc/fn_chat_conversation_get` | R | `p_id` | `ChatConversationDetail`: `conversation`, `members[]{employee_id, ho_ten, anh, vai_tro, nguon_them, last_read_at, is_dai_ly}`, `me{vai_tro, pinned, muted, last_read_at}`, `contact{id, nguon, ho_ten, dien_thoai, email, last_seen_at, channel_key, customer{id, ten_kh, ma_so_kh}}`, `goi_y_khach_hang[]` | `app/chat/[id].tsx` (`useChatThread`, useChat.ts:273), `manage-members/[groupId].tsx:42` | |
| 15 | `ChatService.ts:95-98` `messages` | `rpc/fn_chat_messages` | R | `p_id`, `p_before`, `p_after`, `p_limit` (50 / 100) | `items[]` (ChatMessage: `id`, `conversation_id`, `sender_type`, `sender{id, ten, anh, loai}`, `loai`, `noi_dung`, `reply_to`, `mentions`, `system_event`, `edited_at`, `recalled_at`, `trang_thai_gui`, `client_msg_id`, `created_at`, `attachments[]{id, ten_tep, mime, kich_thuoc, rong, cao}`), `doc_boi[]`, `contact_last_read_at`, `has_more` | `app/chat/[id].tsx` (useChat.ts:281,297,370) | |
| 16 | `ChatService.ts:99-102` `send` | `rpc/fn_chat_send` | W | `p_id`, `p_msg{client_msg_id, noi_dung, attachment_ids?, reply_to_id?, mentions?}` | ChatMessage | `app/chat/[id].tsx` (useChat.ts:392) | |
| 17 | `ChatService.ts:103-104` `edit` | `rpc/fn_chat_edit` | W | `p_message_id`, `p_noi_dung` | ChatMessage | chat thread (useChat.ts:463) | |
| 18 | `ChatService.ts:105` `recall` | `rpc/fn_chat_recall` | W | `p_message_id` | ChatMessage | useChat.ts:467 | |
| 19 | `ChatService.ts:106-107` `pref` | `rpc/fn_chat_pref` | W | `p_id`, `p_patch{pinned?, muted?}` | Detail | `manage-members/[groupId].tsx:93` | |
| 20 | `ChatService.ts:108` `customerTags` | `rpc/fn_chat_customer_tags` | W | `p_id`, `p_tags` | Detail | `manage-members:96` | |
| 21 | `ChatService.ts:109-110` `customerLink` | `rpc/fn_chat_customer_link` | W | `p_id`, `p_customer_id` (or null) | Detail | `manage-members:107`, `components/chat/CustomerLinkSheet.tsx:70` | |
| 22 | `ChatService.ts:111` `requestInfo` | `rpc/fn_chat_request_info` | W | `p_id` | ChatMessage | `manage-members:112` | |
| 23 | `ChatService.ts:112` `markRead` | `rpc/fn_chat_mark_read` | W | `p_id` | `last_read_at` | useChat.ts:360 | |
| 24 | `ChatService.ts:113` `directOpen` | `rpc/fn_chat_direct_open` | W | `p_employee_id` | Detail (`conversation.id`) | `app/contacts.tsx:25` | |
| 25 | `ChatService.ts:114-115` `groupCreate` | `rpc/fn_chat_group_create` | W | `p_ten`, `p_employee_ids` | Detail | `app/chat/create-group.tsx:46` | |
| 26 | `ChatService.ts:116` `membersAdd` | `rpc/fn_chat_members_add` | W | `p_id`, `p_employee_ids` | Detail | `manage-members:117` | |
| 27 | `ChatService.ts:117-118` `membersRemove` | `rpc/fn_chat_members_remove` | W | `p_id`, `p_employee_ids` | Detail | `manage-members:78` | |
| 28 | `ChatService.ts:119` `leave` | `rpc/fn_chat_leave` | W | `p_id` | `conversation_id` | `manage-members:86` | |
| 29 | `ChatService.ts:120` `join` | `rpc/fn_chat_join` | W | `p_id` | Detail | `app/chat/[id].tsx:70` | |
| 30 | `ChatService.ts:121-122` `customerStatus` | `rpc/fn_chat_customer_status` | W | `p_id`, `p_trang_thai: "open"\|"closed"` | Detail | `app/chat/[id].tsx:79` | |
| 31 | `ChatService.ts:124-125` `pushRegister` | `rpc/fn_chat_push_dang_ky` | W | `p_push_token` (Expo push token), `p_nen_tang: "ios"\|"android"` | `ok` | `components/chat/chatPush.ts:90` (after login, from ChatNotifier) | Gets the Expo token via `expo-notifications getExpoPushTokenAsync` |
| 32 | `ChatService.ts:126` `pushUnregister` | `rpc/fn_chat_push_huy` | W | `p_push_token` | `so` | `chatPush.ts:119` (logout) | Needs the JWT, so it must run before the session is cleared |
| 33 | `ChatService.ts:45-60,130-132` `upload` step 1 | `fetch` POST `${API_URL}/functions/v1/chat-files` | W | `{action:"upload_url", conversation_id, ten_tep, mime, kich_thuoc}`; Bearer JWT | `data.{attachment_id, path, token}` | `app/chat/[id].tsx` composer (useChat.ts:389) | |
| 34 | `ChatService.ts:69-86,134` `upload` step 2 | XHR PUT `${API_URL}/storage/v1/object/upload/sign/chat-files/<encoded path>?token=<token>` | W | multipart: `cacheControl=3600`, file field with an **empty name** `""` = `{uri, name, type}`; headers `apikey` / `Authorization: anon`, `x-upsert: false` | HTTP status only (413 means "Tệp quá lớn") | as #33 | Supabase Storage signed upload; returns the `attachment_id` |
| 35 | `ChatService.ts:139-147` `fileUrl` | `fetch` POST `functions/v1/chat-files` | R | `{action:"file_url", attachment_id}` | `data.url`, rewritten by `toPublicUrl` (anything after `/storage/v1/` is re-based onto `API_URL`, because the server returns the internal `http://api-gw:8000/storage/v1/…`); cached for 240 s (server signs for 300 s) | `components/chat/MessageRow.tsx:18` (`WebBrowser.openBrowserAsync`), `:30` (image `uri`) | |
| 36 | `realtimeHub.ts:116-125,145` | WebSocket `${API_URL}/api/realtime` (SignalR) | R | see section 3 | – | chat, products, notifications | |

Files with **no network calls**: `cloudTenant.ts`, `lib/chat.ts` (pure types and helpers, "KHÔNG import"), `lib/chatNotify.ts` (pure banner logic for `message_new` events and push `data{type:"chat", conversation_id, message_id}`), `lib/productRealtime.ts` (pure; maps a `bds_products` row `{ma_sp, ma_tt, mau_nen, ma_khu, ma_tang, vi_tri}` onto the grid), `lib/sessionKeys.ts`, `lib/biometricLogin.ts`, `app/_layout.tsx`.

---

## 3. Realtime (`sevicesSupabase/realtimeHub.ts`)

- **Hub:**
  - `new HubConnectionBuilder().withUrl(`${API_URL}/api/realtime`, { accessTokenFactory, skipNegotiation: true, transport: HttpTransportType.WebSockets })`.
  - `withAutomaticReconnect` with backoff `min(30 s, 1 s × 2^n)`, log level None.
  - If the hub closes for good, it retries every 5 s while any topic is still open.
  - One shared connection; topics are reference-counted. When the last topic closes, the connection is dropped.
- **Auth:**
  - `accessTokenFactory` returns `getValidSupabaseJwt() || SUPABASE_ANON_KEY` and is re-run on every connect or reconnect. SignalR sends it as the `access_token` query string on the WebSocket URL.
  - `syncRealtimeAuth()` drops and reconnects if the stored JWT is different from the token the connection used. It runs before private or table channels.
  - The anon key can only join the public `chatv:*` channels.
- **Client → server hub methods:**
  - `Join(ref, topic, { private, self:false, postgresChanges:[{id, event, schema:"public", table, filter}] })` → `{ok, error}`
  - `Leave(ref)`
  - `Broadcast(ref, event, payload)`
  - `ref` = `r<seq>`
- **Server → client events:**
  - `broadcast(topic, isPrivate, event, payload)`
  - `postgres_changes(ref, ids[], data{eventType, new, old (primary key only), commit_timestamp})`

Topics joined:

| Topic | Private | Joined by | Events consumed | Payload fields used |
|---|---|---|---|---|
| `chat:u:<employee_id>` | yes (JWT) | `ChatService.subscribeChatUser` (L160-182) ← `useChat.ts retain` (shared by `ChatNotifier` in `_layout`, the chat screens and the home badge) | `message_new`, `message_updated`, `conversation_updated`, `member_changed`, `read` (`CHAT_EVENT_NAMES`) | `message_new`: `{message, conversation, muted}` (banner, `lib/chatNotify.bannerFromEvent`); the others are handled in `useChat` (merge and reload) |
| `chat:c:<conversation_id>` | yes (JWT) | `ChatService.subscribeTyping` (internal or group conversation) | `typing`: `{employee_id}`; sends `typing {employee_id: me}` at most once every 3 s | `employee_id` |
| `chatv:<contact.channel_key>` | no (anon is fine) | `subscribeTyping` (customer conversation) | `typing` where `payload.from === "visitor"`; sends `typing {t:"typing", from:"agent"}` | `from` |
| `product-status-<companyId>-<ts><seq>` (table channel) | no, but needs a JWT (server rejects anon) | `app/products.tsx:116` `subscribeTableChanges` | `postgres_changes` on `{event:"UPDATE", table:"bds_products", filter:"ma_ctdk=eq.<tenant uuid>"}` | `new.{ma_sp, ma_tt, mau_nen, ma_khu, ma_tang, vi_tri}` |
| `layout-notifications-<ts><seq>` | no, needs a JWT | `NotificationService.subscribe` (`NotificationService.ts:44-45`) ← `app/notifications.tsx:38` | `postgres_changes` on `{event:"INSERT", table:"notifications"}` (no filter; server scopes by company) | only the trigger matters (it reloads the list) |

`ChatMe.kenh.presence` is returned by `fn_chat_me` but the app never joins a presence channel.

---

## 4. Uploads and storage

| # | Where | Endpoint | Auth | Request | Response used | Callers |
|---|---|---|---|---|---|---|
| U1 | `BookingService.ts:344-365` `uploadTenantFile(file, folder)` | POST `functions/v1/upload-file` (axios, multipart, timeout 120 s) | Bearer `@token` (interceptor; not `rest/v1`) | FormData `file` = `{uri, name, type}`, `ma_ctdk` = `getCompanyCode().toLowerCase()` (**text code, not the UUID**), `folder` | `error`, `provider`, `url`, `link` (`provider === "DOTNET"` → `link`, else `url \|\| link`) | `BookingService.uploadBookingImage` (folder `booking`) ← `app/booking/[id].tsx:215`; `app/signing/form.tsx:389` (folder `signing`); `CustomerRequestService.upload` (folder `yeu-cau`, `CustomerRequestService.ts:231-232`) ← `app/request/form.tsx:281` |
| U2 | `BookingService.ts:370-385` (fallback when U1 throws or there is no company code) | `fetch` POST `https://upload.beesky.vn/api/Upload` | none | FormData `Image`, `TenCTDK` = code (or `beeland`), `Project=beeland_admin_web` | `status === 2000`, `data[0]` (relative link), `message` | same as U1 |
| U3 | `ChatService.upload` | `functions/v1/chat-files` `upload_url`, then PUT `storage/v1/object/upload/sign/chat-files/…` | JWT, then anon + signed token | see #33 and #34 | `attachment_id` | chat composer |
| D1 | `ChatService.fileUrl` | `functions/v1/chat-files` `file_url` | JWT | `attachment_id` | signed `storage/v1/...` URL re-based onto `API_URL` | `MessageRow` |
| D2 | `CustomerRequestService.ts:62-74` `signDriveFile` | POST `functions/v1/storage-broker` | Bearer `@token` + header `x-cloud-token: @token` + body `token` | `{action:"sign-download", bucket:"drive-files", path, expiresIn:3600, token}` | `error`, `data.signedUrl` (re-based by `toPublicStorageUrl`, L57-60) | `resolveAttachments` ← `app/request/[id].tsx:77`, `app/request/form.tsx:187` (files the customer sent, stored as `drive-files:<path>`) |
| D3 | `BookingService.ts:1496-1512` | GET `rest/v1/upload_configs?select=provider,config&ma_ctdk=eq.<uuid>&ma_ct=is.null&limit=1` | JWT | – | `config.public_base_url` (base for relative booking image paths; default `https://upload.beesky.vn/`) | booking images (`app/booking/[id].tsx`) |
| D4 | Building `https://upload.beesky.vn/<relative>` | static file host | none | – | – | `DocumentService.ts:45`, `ProjectService.ts:6` (`FILE_SERVER`), `ProductService.ts:399`, `lib/signing.ts:212`, `app/photo-gallery.tsx:7`, `app/documents/[folderId].tsx:40`, `app/photos/[folderId].tsx:57`, `CustomerRequestService.fileUrl` |
| D5 | `app/documents/viewer.tsx:67` `fetch(decodedLink)` (txt files); `:95` `File.downloadFileAsync(decodedLink, …)` (download and share) | the document URL from D4 | none | – | – | document viewer |
| D6 | `DocumentService.ts:66`, `components/utils/documentLinks.ts:58` | `https://view.officeapps.live.com/op/view.aspx?src=<url>` | none | – | – | Office preview (WebView / browser) |
| D7 | `app/booking/qr-payment.tsx:384`, `app/deposit/qr-payment.tsx:319` `FileSystem.downloadAsync(vietQrUrl(va), …)` | `https://img.vietqr.io/image/<bank_code>-<account_number>-compact2.png?amount=…&addInfo=…&accountName=…` (`PaymentGatewayService.ts:73-78`) | none | – | – | save QR image |
| D8 | Placeholder images | `https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/...` | none | – | – | `app/projects.tsx:23`, `app/locked/[id].tsx:28`, `app/project/[id].tsx:15`, `app/product/[id].tsx:36`, `components/home/ProjectCarousel.tsx:28`, `ProductService.ts:112` |

---

## 5. Other direct network calls elsewhere in the app

| Where | Call | Notes |
|---|---|---|
| `sevicesSupabase/PaymentGatewayService.ts:10-21` | POST `functions/v1/payment-gateway` `{action, token, ...payload}`, header `x-cloud-token: @token`, timeout 45 s | Uses `@token`, not the JWT. Belongs to another inventory group, but it is part of the edge-function transport |
| `sevicesSupabase/UserService.ts:11` | plain `axios.post("https://api-bms.beesky.vn/api/app/get-version", {MaLoaiApp:1})` → `data.{VesionIOS, VesionAndroid, linkIOS, linkAndroid}` | `components/UpdateManager.tsx:51,67`. A separate system, not BEELAND; keep it |
| `sevices/axiosApi.ts` (old .NET `https://api-beeland.beesky.vn/`, Bearer `@token`) | `CongViecService.addGhiChuCV`/`addLichHen` (`api/admin/KhachHang/AddNhatKy`, `AddLichSuLamViec`); `sevices/CustomerService.*` (`api/admin/Getlist_Customer`, `Customer/ViewChiTiet`, `AddCustom`, `DelteteCustomer`, `NguonDen`, `NhomKH`, `khTrangThai`, `KhachHang/ListNhatKyKH`, `KhachHang/List_LichSuLamViec`, `hop-dong/danh-sach`, `getQRCode` → `https://api.vietqr.io/v2/generate`) | Only `app/appointments.tsx` imports them (`getLichHenByMaKH` L122/289, `addLichHen` L518), and that screen is hidden. `getQRCode` is unused |
| `app/diagram/[mada].tsx:11,34-37` | WebView `https://real.beesky.vn/products/sodophanlo-app?jwt=<JWT>&token=<JWT>&mada=<code>` | **The JWT is passed in the query string.** The web page authenticates with it, so the JWT format must stay accepted by the web |
| `components/chat/chatPush.ts:88` | `expo-notifications getExpoPushTokenAsync` (Expo push service) | The token goes to `fn_chat_push_dang_ky` |
| `components/UpdateManager.tsx` / `lib/otaUpdate.ts` | `expo-updates` check, fetch and reload (EAS Update) | not the BEELAND API |
| `constants/webFont.ts:8` | Google Fonts (web build only) | – |
| `components/customer/CustomerListItem.tsx:11` | `Linking.openURL("https://zalo.me/<phone>")` | external link |
| `components/priceSheet/ProductPicker.tsx:65,122` | `fetch(...)` is a **local function name** (it pages through services), not the global `fetch` | false positive |

Everything else goes through `axiosApiSupabase`. As of today:
- **`rest/v1/rpc/*`:** 15 service files (largest counts: `SigningService` 7, `BookingService` 5, `ReportService` / `PriceSheetService` 3).
- **`rest/v1/<table>`:** 18 service files (largest: `BookingService` 28, `ProductService` 9, `DatCocService` 6).

These are the other inventories' scope. Grep for anything not already listed above found no other `fetch`, `XMLHttpRequest`, `new WebSocket`, `axios.create` or absolute API URL in `app/`, `components/`, `lib/`, `sevicesSupabase/` or `sevices/`. There is no `hooks/` or `contexts/` directory.

---

## Migration notes (findings that matter for `/api/<module>/<fn>`)

1. **Two credentials are in use.**
   - `@supabase_jwt` (claims `sub`, `company_id`, `employee_id`, `branch_id`, `type_account`, `ma_nv`, `company_code`, `exp`) is used for `rest/v1`, `chat-files`, realtime and the diagram WebView.
   - `@token` (opaque cloud session) is used for every `functions/v1/*` call through the interceptor: cloud-auth logout and verify, `payment-gateway`, `storage-broker` (`x-cloud-token`), `upload-file` and `staff-reset-password`.
   - A new transport has to decide which one the new endpoints accept. The JWT alone is enough if the server reads tenant and employee from the claims.
2. **The silent anon fallback** for expired JWTs on `rest/v1` turns expiry into empty lists. New endpoints should return 401 instead, and the app should handle it centrally (redirect to login). Today only the home screen's check and each service's own `getValidSupabaseJwt()` guard catch it. There is no refresh token; the only renewal is `cloud-auth verify` from the profile and account screens.
3. **`cloudTenant.ts` rewrites nothing.** Tenant and identity are passed by hand from 12+ services as UUID or text code, depending on the table (`docs/data-access.md` table). App-only endpoints that derive the tenant from the JWT would make most of `getCompanyId` / `getCompanyCode` / `getEmployeeId` / `getMaNv` / `getTypeAccount` unnecessary. Note that `upload-file` takes the **lower-case text code** in `ma_ctdk`.
4. **Supabase Storage is used in a few places:**
   - The chat upload is a two-step signed PUT to `storage/v1/object/upload/sign/chat-files/...` with the anon key.
   - The download URLs from `chat-files` and `storage-broker` come back as internal `http://api-gw:8000/storage/v1/...` and are re-based onto `API_URL` on the client.
   - These need .NET-native equivalents, or the server has to return public URLs directly.
5. **Direct table write outside the interceptor:** `DELETE rest/v1/dm_employees` (account deletion, required by Apple) is the only raw-axios Supabase-style call. It needs an app-only endpoint such as `/api/<auth>/delete-self`. The realtime hub protocol (`Join` / `Leave` / `Broadcast`, `postgres_changes`) is already .NET SignalR and does not depend on Supabase except for using the anon key as a fallback token.

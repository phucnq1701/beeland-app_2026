// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/restWriteGuard.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { RpcError } from "./rpcError";

/**
 * GHI THẲNG BẢNG QUA POSTGREST (UPDATE / DELETE) — RLS lọc mất dòng thì PostgREST vẫn trả 200 với 0 dòng ⇒ màn hình từng báo
 * "thành công" dù không đổi gì (task C2 Đợt 5). Gọi kèm `.select(...)` rồi kiểm số dòng bằng `assertRowsAffected`.
 */
export const NO_PERMISSION_MESSAGE = "Không có quyền thực hiện";

type PgErr = { code?: string; message?: string; status?: number; details?: string } | null | undefined;

/** Thông điệp kỹ thuật của Postgres / PostgREST khi bị chặn quyền (không có chữ tiếng Việt cho người dùng) */
const TECHNICAL_DENY = /row-level security|permission denied|violates.*policy|insufficient.privilege|forbidden/i;

/** Lỗi ghi ⇒ RpcError thân thiện: chặn quyền (42501 / 403) ⇒ «Không có quyền thực hiện» (giữ thông điệp tiếng Việt của máy chủ) */
export const friendlyWriteError = (error: PgErr): RpcError => {
  const msg = String(error?.message || "").trim();
  const denied = error?.code === "42501" || error?.status === 403 || error?.status === 401;
  if (denied) {
    const text = !msg || TECHNICAL_DENY.test(msg) ? NO_PERMISSION_MESSAGE : msg;
    return new RpcError(text, "42501");
  }
  return new RpcError(msg || "Lỗi máy chủ", error?.code);
};

/**
 * Kiểm kết quả UPDATE / DELETE có `.select()`:
 * - lỗi ⇒ ném `friendlyWriteError`;
 * - ít dòng hơn `expected` (mặc định 1) ⇒ nếu có `stillExists` và bản ghi đã không còn (xoá trước đó) thì bỏ qua,
 *   ngược lại ném 42501 «Không có quyền thực hiện».
 * Trả số dòng đã ghi.
 */
export const assertRowsAffected = async (
  res: { data: unknown; error: PgErr },
  opts: { expected?: number; stillExists?: () => Promise<boolean> } = {},
): Promise<number> => {
  if (res.error) throw friendlyWriteError(res.error);
  const n = Array.isArray(res.data) ? res.data.length : res.data ? 1 : 0;
  const expected = Math.max(1, opts.expected ?? 1);
  if (n >= expected) return n;
  if (opts.stillExists && !(await opts.stillExists())) return n;
  throw new RpcError(NO_PERMISSION_MESSAGE, "42501");
};

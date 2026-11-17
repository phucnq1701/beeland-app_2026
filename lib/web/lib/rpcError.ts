// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/rpcError.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/** Lỗi gọi RPC giữ mã Postgres (42501 = không có quyền, 22023 = dữ liệu không hợp lệ…) để màn hình phân biệt */
export class RpcError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = "RpcError";
    this.code = code;
  }
}

/** Từ lỗi supabase-js (`{ message, code }`) */
export const toRpcError = (error: { message?: string; code?: string } | null | undefined) =>
  new RpcError(error?.message || "Lỗi máy chủ", error?.code);

/** Máy chủ từ chối vì phạm vi / quyền (SQLSTATE 42501) */
export const isPermissionDenied = (e: unknown): boolean => (e as { code?: string } | null)?.code === "42501";

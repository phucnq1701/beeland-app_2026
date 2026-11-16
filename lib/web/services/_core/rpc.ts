// ⚠️ TỰ SINH — bản chép nguyên văn web src/services/_core/rpc.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../../_shims/integrations/supabase/client";

/**
 * Lõi gọi RPC dùng chung cho service theo module (`src/services/<module>/…`).
 * Gom các bản sao `rpc`/`rpcError` cục bộ — giữ đúng ngữ nghĩa lỗi cũ (message, `details`).
 */

export type RpcArgs = Record<string, unknown>;

export interface RpcOptions {
  /** Thông điệp khi lỗi PostgREST không có `message` */
  fallback?: string;
  /** Đổi lỗi PostgREST thành thông điệp hiển thị (vd. `thongDiepLoi`) */
  mapError?: (error: any) => string;
}

/** Thông điệp lỗi PostgREST (đã trim) — máy chủ trả thông điệp nghiệp vụ: thiếu quyền, ngoài phạm vi… */
const messageOf = (error: any): string => String(error?.message || "").trim();

/** Lỗi PostgREST → Error(message || fallback) */
export const rpcError = (error: any, fallback: string): Error => new Error(messageOf(error) || fallback);

const call = async (fn: string, args: RpcArgs | undefined, opts: RpcOptions) => {
  const { data, error } = await supabase.rpc(fn as any, (args ?? {}) as any);
  if (error) {
    // Giữ nguyên message; thêm `code` (SQLSTATE: 55000, 22023, 42501, P0002...) để nơi gọi phân loại lỗi
    throw Object.assign(new Error(opts.mapError ? opts.mapError(error) : messageOf(error) || opts.fallback), {
      code: (error?.code as string | undefined) ?? null,
    });
  }
  return data as unknown;
};

/** Trả `data` thô. `errorField: true` → `data.error` có giá trị thì ném Error(String(data.error)). */
export async function rpcRaw<T>(
  fn: string,
  args?: RpcArgs,
  opts: RpcOptions & { errorField?: boolean } = {}
): Promise<T> {
  const data = await call(fn, args, opts);
  if (opts.errorField && (data as any)?.error) throw new Error(String((data as any).error));
  return data as T;
}

/**
 * Hàm trả phong bì `{ data?, error?, chi_tiet? }`: lỗi nghiệp vụ ném Error(error) kèm
 * `details = chi_tiet` để nơi gọi hiển thị bảng lỗi theo từng dòng; trả `result?.data`.
 */
export async function rpcEnvelope<T>(fn: string, args?: RpcArgs, opts: RpcOptions = {}): Promise<T> {
  const result = (await call(fn, args, opts)) as { data?: T; error?: string; chi_tiet?: unknown } | null;
  if (result && typeof result === "object" && "error" in result && result.error) {
    throw Object.assign(new Error(String(result.error)), { details: result.chi_tiet });
  }
  return result?.data as T;
}

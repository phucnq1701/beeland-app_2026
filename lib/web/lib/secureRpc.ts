// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/secureRpc.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
import { supabase } from "../_shims/integrations/supabase/client";

const cloudToken = () => {
  try {
    return localStorage.getItem("cloud_auth_token") || "";
  } catch {
    return "";
  }
};

/**
 * Gọi các hàm SECURITY DEFINER qua edge function `secure-rpc`.
 * Các hàm này đã bị thu hồi quyền EXECUTE của anon/authenticated,
 * nên client không gọi trực tiếp bằng supabase.rpc được nữa.
 */
export async function secureRpc<T = unknown>(
  fn: string,
  args: Record<string, unknown> = {},
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke("secure-rpc", {
      body: { fn, args, token: cloudToken() },
      headers: { "x-cloud-token": cloudToken() },
    });
    if (error) return { data: null, error: error.message };
    if ((data as any)?.error) return { data: null, error: String((data as any).error) };
    return { data: ((data as any)?.data ?? null) as T, error: null };
  } catch (e: any) {
    return { data: null, error: e?.message || "Không gọi được máy chủ" };
  }
}

export default secureRpc;

/**
 * SHIM VIẾT TAY — `message` của antd (web dùng để báo kết quả trong logic form, ví dụ SigningDrawer.submit) ⇒ toast app qua shim
 * sonner (màn app nghe onWebToast). Chỉ thông báo, không vẽ.
 */
import { toast } from "./sonner";

const say = (fn: (m: string) => unknown) => (content: unknown) => {
  const text = typeof content === "string" ? content : (content as any)?.content ?? String(content ?? "");
  fn(String(text));
  return Promise.resolve(true);
};

export const message = {
  success: say((m) => toast.success(m)),
  error: say((m) => toast.error(m)),
  warning: say((m) => toast.warning(m)),
  info: say((m) => toast.info(m)),
  loading: say(() => undefined),
};

export default message;

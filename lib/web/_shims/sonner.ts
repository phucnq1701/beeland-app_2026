/**
 * SHIM VIẾT TAY — thay thư viện `sonner` (toast web) cho module web chép ở lib/web.
 * Module web gọi toast.warning/info/error/success(...) ⇒ phát tới bộ nhận do màn app đăng ký (onWebToast), chưa có ⇒ ghi log.
 */
export type WebToastType = "success" | "error" | "warning" | "info";
type Listener = (t: { type: WebToastType; message: string }) => void;

const listeners = new Set<Listener>();

/** Màn app đăng ký hiện toast (vd: useEffect(() => onWebToast((t) => toast.show(...)), [])) — trả hàm huỷ */
export function onWebToast(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const emit = (type: WebToastType) => (message: unknown) => {
  const m = String(message ?? "");
  if (!listeners.size) console.log(`[web toast ${type}] ${m}`);
  listeners.forEach((l) => l({ type, message: m }));
};

export const toast = Object.assign(emit("info"), {
  success: emit("success"),
  error: emit("error"),
  warning: emit("warning"),
  info: emit("info"),
  message: emit("info"),
});

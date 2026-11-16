/**
 * SHIM VIẾT TAY — môi trường tối thiểu cho module web chép ở lib/web trên React Native: localStorage / sessionStorage trong bộ nhớ
 * (web lưu cờ / bộ nhớ đệm phụ), window.addEventListener / dispatchEvent / location, CustomEvent — chỉ cài khi THIẾU.
 * Gọi installWebRuntime() trước khi dùng module web (useWebPriceSheet gọi khi mở màn).
 */
const memoryStorage = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
};

export function installWebRuntime(): void {
  const g: any = globalThis as any;
  if (!g.localStorage) g.localStorage = memoryStorage();
  if (!g.sessionStorage) g.sessionStorage = memoryStorage();
  if (!g.window) g.window = g;
  const w = g.window;
  if (typeof w.addEventListener !== "function") w.addEventListener = () => {};
  if (typeof w.removeEventListener !== "function") w.removeEventListener = () => {};
  if (typeof w.dispatchEvent !== "function") w.dispatchEvent = () => true;
  if (!w.location) w.location = { pathname: "", search: "", hash: "", href: "" };
  if (typeof g.CustomEvent !== "function")
    g.CustomEvent = class CustomEvent {
      type: string;
      detail: unknown;
      constructor(type: string, init?: { detail?: unknown }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
}

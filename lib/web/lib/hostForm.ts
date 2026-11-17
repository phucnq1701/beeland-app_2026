// ⚠️ TỰ SINH — bản chép nguyên văn web src/lib/hostForm.ts (scripts/sync-web-pricing.cjs). KHÔNG SỬA TAY: sửa ở web rồi chạy lại script.
// Web biên dịch với strict: false ⇒ bỏ kiểm kiểu strict của app cho tệp chép (hành vi kiểm bằng test so web).
// @ts-nocheck
/**
 * MÀN NGUỒN của thao tác (spec 2026-11-11-tinh-nang-theo-nut-dot-1, RS2 / RS10 / RS15): quyền của nút nằm ở màn có nút, máy chủ kiểm
 * tính năng ở màn này (`p_host_form` / `host_form`). Thao tác luôn bấm trên tab đang hiện ⇒ màn nguồn = đường dẫn trang đang mở;
 * màn chi tiết (`/contracts/deposits/:id`…) không phải đường dẫn chức năng nên tự đăng ký màn nguồn khi mở (`useRegisterHostForm`).
 */
import { useEffect } from "react";

let override: { pathname: string; form: string } | null = null;

const norm = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/** Đường dẫn cũ (App.tsx giữ để link cũ còn mở được) → đường dẫn chức năng máy chủ biết */
const LEGACY_PREFIX: [string, string][] = [
  ["/handover/red-book", "/contracts/red-book"],
  ["/handover/", "/contracts/handover/"],
];

const canonical = (p: string) => {
  for (const [from, to] of LEGACY_PREFIX) if (p === from || p.startsWith(from)) return to + p.slice(from.length);
  return p;
};

/** Màn nguồn hiện tại — gửi kèm RPC lập phiếu từ màn khác */
export function getHostForm(): string | null {
  if (typeof window === "undefined") return null;
  const path = norm(window.location.pathname || "");
  if (override && override.pathname === path) return override.form;
  return canonical(path) || null;
}

/** Màn chi tiết đăng ký màn nguồn (đường dẫn chức năng) trong lúc đang mở */
export function useRegisterHostForm(form: string | null | undefined) {
  useEffect(() => {
    if (!form || typeof window === "undefined") return;
    const entry = { pathname: norm(window.location.pathname || ""), form };
    override = entry;
    return () => {
      if (override === entry) override = null;
    };
  }, [form]);
}

/** Loại phiếu trên đường dẫn màn chi tiết → chức năng mặc định khi mở thẳng bằng link (RS15) */
export const DETAIL_DEFAULT_FORM: Record<string, string> = {
  deposits: "/sales/deposits",
  investment: "/contracts/investment",
  list: "/contracts/list",
  "transfer-contract": "/contracts/transfer-contract",
};

/** Danh sách được phép mở màn chi tiết của từng loại (state.fromForm khác danh sách này ⇒ dùng mặc định) */
export const DETAIL_ALLOWED_FROM: Record<string, string[]> = {
  deposits: ["/sales/deposits", "/contracts/deposit-agreements"],
  investment: ["/contracts/investment"],
  list: ["/contracts/list"],
  "transfer-contract": ["/contracts/transfer-contract", "/contracts/list"],
};

/** Màn nguồn của màn chi tiết `/contracts/<loai>/:id` (RS15): danh sách đã mở (state.fromForm) nếu hợp lệ, không thì theo loại phiếu */
export function detailHostForm(pathname: string, fromForm?: string | null): string | null {
  const m = /^\/contracts\/(deposits|investment|list|transfer-contract)\/[^/]+$/.exec(norm(pathname));
  if (!m) return null;
  const loai = m[1];
  if (fromForm && DETAIL_ALLOWED_FROM[loai].includes(norm(fromForm))) return norm(fromForm);
  return DETAIL_DEFAULT_FORM[loai];
}

import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useReducer } from "react";

import { APP_FORMS, hasFeature, type FormFeatures } from "@/lib/permissions";
import { callNv, NvApiError } from "@/services/nvApi";
import { getSessionInfo, getUser } from "@/services/session";

/**
 * Tính năng của người dùng ở các màn app — như web `usePerm(form)` (fn_perm_form_features): MỘT lời gọi `fn_nv_app_quyen_man`
 * cho mọi màn app dùng, giữ 10 phút theo phiên (công ty | nhóm quyền | nhân viên), như staleTime của web.
 * - Đang tải / lỗi mạng ⇒ không có quyền (ẩn nút, như web fail-closed; máy chủ vẫn chặn khi thao tác) — lần mở màn sau tải lại.
 * - Máy chủ chưa có endpoint (API chưa triển khai bản này, 404) ⇒ KHÔNG ẩn gì (giữ hành vi cũ, máy chủ vẫn chặn).
 * - Tài khoản đại lý ⇒ không ẩn nút theo đợt này (user chốt 2026-11-17: đại lý giữ như hiện tại).
 */
const STALE_MS = 10 * 60_000;

type Status = "idle" | "loading" | "ok" | "error" | "unsupported";
let state: { key: string; at: number; status: Status; data: FormFeatures | null; agency: boolean } = {
  key: "",
  at: 0,
  status: "idle",
  data: null,
  agency: false,
};
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

async function sessionKey(): Promise<{ key: string; agency: boolean }> {
  const [s, u] = await Promise.all([getSessionInfo(), getUser()]);
  return { key: [s.companyId, u?.nhom_quyen_id ?? "", s.employeeId].join("|"), agency: s.isAgency };
}

/** Nạp (nếu hết hạn / đổi phiên). force = bỏ qua hạn 10 phút. */
export async function loadPermissions(force = false): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { key, agency } = await sessionKey();
      const fresh = state.key === key && state.status === "ok" && Date.now() - state.at < STALE_MS;
      if (!force && fresh) return;
      if (state.key !== key) state = { key, at: 0, status: "loading", data: null, agency };
      else state = { ...state, status: state.data ? state.status : "loading", agency };
      emit();
      try {
        const data = await callNv<FormFeatures>("fn_nv_app_quyen_man", { p_forms: APP_FORMS });
        state = { key, at: Date.now(), status: "ok", data: data && typeof data === "object" ? data : {}, agency };
      } catch (e) {
        const unsupported = e instanceof NvApiError && (e.status === 404 || e.code === "404");
        state = { key, at: Date.now(), status: unsupported ? "unsupported" : "error", data: state.data, agency };
      }
      emit();
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Xoá bộ nhớ quyền (đăng xuất / đổi tài khoản). */
export function resetPermissions(): void {
  state = { key: "", at: 0, status: "idle", data: null, agency: false };
  emit();
}

/** Hỏi đồng bộ theo bộ nhớ hiện tại (dùng ngoài React). */
export function canNow(form: string, feature: string): boolean {
  if (state.agency || state.status === "unsupported") return true;
  return hasFeature(state.data, form, feature);
}

/**
 * Như web `usePerm(formPath)`: `can("ADD")`… theo nhóm quyền. `ready` = đã biết quyền (dùng để không nháy nút khi đang tải).
 * Mở màn (focus) ⇒ nạp lại nếu quá 10 phút.
 */
export function usePerm(form: string): { can: (feature: string) => boolean; ready: boolean; agency: boolean } {
  const [, tick] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    listeners.add(tick);
    return () => {
      listeners.delete(tick);
    };
  }, []);
  useFocusEffect(
    useCallback(() => {
      void loadPermissions();
    }, [])
  );
  const ready = state.status === "ok" || state.status === "unsupported" || state.status === "error" || state.agency;
  return { can: (feature: string) => canNow(form, feature), ready, agency: state.agency };
}

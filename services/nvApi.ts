import axios from "axios";

import { NV_API_BASE } from "./config";
import { getFreshJwt, recoverFrom401 } from "./session";

/**
 * Gọi bộ API riêng của app nhân viên: `POST {API}/api/app-nhan-vien/<fn>` body JSON `{ p_x: … }`, Bearer JWT.
 * Máy chủ tự lấy công ty / nhân viên / quyền từ JWT — KHÔNG gửi mã công ty, id nhân viên từ máy.
 * Lỗi ⇒ ném NvApiError (status HTTP + code + message của máy chủ) — không nuốt lỗi thành danh sách rỗng.
 */
export class NvApiError extends Error {
  status: number;
  code: string;
  details: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = "NvApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Không có mạng / máy chủ không trả lời. */
export const NETWORK_ERROR = "NETWORK";

export interface CallOptions {
  /** Không gắn JWT (chỉ cho API đăng nhập / quên mật khẩu). */
  anonymous?: boolean;
  timeout?: number;
  signal?: AbortSignal;
}

function toError(e: any): NvApiError {
  const res = e?.response;
  if (!res) {
    const timeout = e?.code === "ECONNABORTED";
    return new NvApiError(
      timeout ? "Máy chủ phản hồi chậm, vui lòng thử lại" : "Không kết nối được máy chủ, kiểm tra mạng",
      0, NETWORK_ERROR,
    );
  }
  const d = res.data || {};
  const msg = typeof d?.message === "string" && d.message.trim() ? d.message.trim() : `Lỗi máy chủ (${res.status})`;
  return new NvApiError(msg, res.status, String(d?.code ?? res.status), d?.details);
}

async function post(fn: string, args: object, jwt: string, opt: CallOptions) {
  return axios.post(`${NV_API_BASE}/${fn}`, args, {
    timeout: opt.timeout ?? 30000,
    signal: opt.signal,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
    },
  });
}

export async function callNv<T = any>(fn: string, args: object = {}, opt: CallOptions = {}): Promise<T> {
  const jwt = opt.anonymous ? "" : await getFreshJwt();
  if (!opt.anonymous && !jwt) throw new NvApiError("Phiên đăng nhập hết hạn, vui lòng đăng nhập lại", 401, "401");
  try {
    const res = await post(fn, args, jwt, opt);
    return res.data as T;
  } catch (e: any) {
    if (!opt.anonymous && e?.response?.status === 401) {
      const next = await recoverFrom401();
      if (next && next !== jwt) {
        try {
          const res = await post(fn, args, next, opt);
          return res.data as T;
        } catch (e2) {
          throw toError(e2);
        }
      }
    }
    throw toError(e);
  }
}

/** Thông điệp hiển thị cho người dùng từ lỗi bất kỳ. */
export function errorMessage(e: unknown, fallback = "Có lỗi xảy ra, vui lòng thử lại"): string {
  if (e instanceof NvApiError) return e.message;
  const m = (e as any)?.message;
  return typeof m === "string" && m.trim() ? m : fallback;
}

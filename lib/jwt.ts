/** Đọc payload JWT (KHÔNG kiểm chữ ký — chỉ để biết hạn / claim hiển thị; máy chủ mới là nơi kiểm). */

function base64UrlDecode(input: string): string {
  let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4;
  if (pad) b64 += "=".repeat(4 - pad);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; ) {
    const e1 = chars.indexOf(clean.charAt(i++));
    const e2 = chars.indexOf(clean.charAt(i++));
    const e3 = chars.indexOf(clean.charAt(i++));
    const e4 = chars.indexOf(clean.charAt(i++));
    bytes.push((e1 << 2) | (e2 >> 4));
    if (e3 !== 64 && e3 !== -1) bytes.push(((e2 & 15) << 4) | (e3 >> 2));
    if (e4 !== 64 && e4 !== -1) bytes.push(((e3 & 3) << 6) | e4);
  }
  let s = "";
  for (const b of bytes) s += "%" + ("00" + b.toString(16)).slice(-2);
  try {
    return decodeURIComponent(s);
  } catch {
    return String.fromCharCode(...bytes);
  }
}

export function jwtPayload(token: string | null | undefined): Record<string, any> {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return {};
    return JSON.parse(base64UrlDecode(parts[1])) || {};
  } catch {
    return {};
  }
}

/** Số giây còn lại của JWT (âm = đã hết; null = không đọc được exp). */
export function jwtSecondsLeft(token: string | null | undefined, nowMs = Date.now()): number | null {
  const exp = Number(jwtPayload(token).exp || 0);
  if (!exp) return null;
  return exp - Math.floor(nowMs / 1000);
}

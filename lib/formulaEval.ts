/**
 * Tính biểu thức số học thay cho `new Function("use strict"; return (expr))` của web
 * (beeland/src/components/Products/ContractForm/formulas.ts, beeland/src/utils/pricingEngine.ts).
 * App không dùng `new Function` (Hermes + an toàn) nên tự phân tích, giữ đúng hành vi JS strict
 * với các chuỗi web cho qua bộ lọc ký tự:
 *  - toán tử + - * / ngoặc, số thập phân, toán tử dấu phẩy (trả vế cuối);
 *  - `--` / `++` là lỗi cú pháp (JS đọc thành toán tử tăng/giảm), số có 0 đứng đầu (vd `05`) là lỗi strict;
 *  - lời gọi hàm chỉ khi truyền `fns` (vd round/floor/ceil của pricingEngine).
 * Lỗi cú pháp → ném Error (bên gọi tự quy về 0 / null như web).
 * Không import gì để test nạp trực tiếp.
 */

type Fn = (...args: number[]) => number;

type Token =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string };

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      const m = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(src.slice(i));
      if (!m) throw new Error("Số không hợp lệ");
      const text = m[0];
      // "use strict": 05, 08, 00 … là lỗi cú pháp
      if (/^0\d/.test(text)) throw new Error("Số có 0 đứng đầu");
      out.push({ t: "num", v: Number(text) });
      i += text.length;
      // JS không cho số dính liền chữ cái / số khác (vd 1.2.3, 5x)
      if (i < src.length && /[0-9.A-Za-z_]/.test(src[i])) throw new Error("Số không hợp lệ");
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i))!;
      out.push({ t: "id", v: m[0] });
      i += m[0].length;
      continue;
    }
    if ((c === "+" || c === "-") && src[i + 1] === c) throw new Error("Toán tử tăng/giảm");
    if ("+-*/(),".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
      continue;
    }
    throw new Error(`Ký tự không hợp lệ: ${c}`);
  }
  return out;
}

export function evalArithmetic(expr: string, fns: Record<string, Fn> = {}): number {
  const tokens = tokenize(String(expr ?? ""));
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (v: string) => tokens[pos]?.t === "op" && tokens[pos].v === v;
  const expectOp = (v: string) => {
    if (!isOp(v)) throw new Error(`Thiếu "${v}"`);
    pos++;
  };

  // comma := additive (',' additive)*  → giá trị vế cuối (toán tử dấu phẩy của JS)
  const comma = (): number => {
    let v = additive();
    while (isOp(",")) {
      pos++;
      v = additive();
    }
    return v;
  };
  const additive = (): number => {
    let v = multiplicative();
    while (isOp("+") || isOp("-")) {
      const op = (tokens[pos++] as { v: string }).v;
      const r = multiplicative();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  };
  const multiplicative = (): number => {
    let v = unary();
    while (isOp("*") || isOp("/")) {
      const op = (tokens[pos++] as { v: string }).v;
      const r = unary();
      v = op === "*" ? v * r : v / r;
    }
    return v;
  };
  const unary = (): number => {
    if (isOp("-")) {
      pos++;
      return -unary();
    }
    if (isOp("+")) {
      pos++;
      return +unary();
    }
    return primary();
  };
  const primary = (): number => {
    const tok = peek();
    if (!tok) throw new Error("Thiếu toán hạng");
    if (tok.t === "num") {
      pos++;
      return tok.v;
    }
    if (tok.t === "op" && tok.v === "(") {
      pos++;
      const v = comma();
      expectOp(")");
      return v;
    }
    if (tok.t === "id") {
      const fn = fns[tok.v];
      if (!fn) throw new Error(`Không có biến/hàm ${tok.v}`);
      pos++;
      expectOp("(");
      const args: number[] = [];
      if (!isOp(")")) {
        args.push(additive());
        while (isOp(",")) {
          pos++;
          args.push(additive());
        }
      }
      expectOp(")");
      return fn(...args);
    }
    throw new Error("Biểu thức không hợp lệ");
  };

  const result = comma();
  if (pos !== tokens.length) throw new Error("Thừa ký tự cuối biểu thức");
  return result;
}

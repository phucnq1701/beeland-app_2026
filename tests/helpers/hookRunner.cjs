/**
 * Bộ chạy hook React tối giản cho test node (không DOM): useState / useReducer / useEffect / useLayoutEffect / useMemo / useCallback /
 * useRef / useContext / useId / useImperativeHandle. Render ⇒ chạy effect có deps đổi ⇒ setState ⇒ render lại, lặp tới khi ổn định (await các Promise
 * giữa các lượt). Dùng để chạy hook chép nguyên văn từ web (lib/web) với API giả.
 *   const r = createHookRunner(); const React = r.React; … r.render(() => useX(props)); await r.settle(); r.result
 */
function createHookRunner() {
  let slots = [], i = 0, dirty = false, effects = [], hookFn = null, result, renders = 0, cleanups = [];
  const same = (a, b) => a && b && a.length === b.length && a.every((v, k) => Object.is(v, b[k]));
  const React = {
    useState(init) {
      const k = i++;
      if (!(k in slots)) slots[k] = { v: typeof init === "function" ? init() : init };
      const s = slots[k];
      if (!s.set) s.set = (nv) => { const next = typeof nv === "function" ? nv(s.v) : nv; if (!Object.is(next, s.v)) { s.v = next; dirty = true; } };
      return [s.v, s.set];
    },
    useReducer(red, init, initFn) {
      const [v, set] = React.useState(() => (initFn ? initFn(init) : init));
      return [v, (a) => set((cur) => red(cur, a))];
    },
    useRef(init) { const k = i++; if (!(k in slots)) slots[k] = { current: init }; return slots[k]; },
    useMemo(fn, deps) { const k = i++; const s = slots[k]; if (!s || !deps || !same(s.deps, deps)) slots[k] = { v: fn(), deps }; return slots[k].v; },
    useCallback(fn, deps) { return React.useMemo(() => fn, deps); },
    useImperativeHandle(ref, fn) { i++; if (ref && typeof ref === "object") ref.current = fn(); },
    useEffect(fn, deps) { const k = i++; const s = slots[k]; if (!s || !deps || !same(s.deps, deps)) { slots[k] = { deps }; effects.push({ k, fn }); } },
    useLayoutEffect(fn, deps) { return React.useEffect(fn, deps); },
    useContext(ctx) { return ctx?._currentValue; },
    useId() { const k = i++; if (!(k in slots)) slots[k] = { v: `id${k}` }; return slots[k].v; },
    useTransition() { return [false, (f) => f()]; },
    useDeferredValue(v) { return v; },
    createContext(v) { return { _currentValue: v, Provider: () => null }; },
    Fragment: "Fragment",
    createElement: () => null,
  };
  React.default = React;
  const renderOnce = () => {
    i = 0; dirty = false; effects = []; renders++;
    result = hookFn();
    const run = effects; effects = [];
    for (const e of run) {
      const prev = cleanups[e.k]; if (typeof prev === "function") prev();
      cleanups[e.k] = e.fn();
    }
  };
  return {
    React,
    render(fn) { hookFn = fn; renderOnce(); },
    rerender() { renderOnce(); },
    /** Render lại tới khi không còn setState (chờ Promise giữa các lượt) */
    /** pending(): số lời gọi mạng đang chạy (bên test đếm) — chờ hết mới coi là ổn định */
    async settle(maxRounds = 60, pending = () => 0) {
      for (let n = 0; n < maxRounds; n++) {
        await new Promise((r) => setTimeout(r, 0));
        let idle = 0;
        while (!dirty && idle < 40) {
          await new Promise((r) => setTimeout(r, pending() > 0 ? 20 : 5));
          idle = pending() > 0 ? 0 : idle + 1;
          if (idle >= 3) break;
        }
        if (!dirty) return;
        renderOnce();
      }
      throw new Error(`hook không ổn định sau ${maxRounds} lượt`);
    },
    get result() { return result; },
    get renders() { return renders; },
  };
}
module.exports = { createHookRunner };

/**
 * 旧内核兼容补丁（小工具要求兼容 Android WebView / Chrome 61）。
 *
 * 只补本项目及其依赖（React、motion）在运行时真正用到、而 Chrome 61 没有的 API。
 * 每一项都先检测，原生支持时什么都不做。必须在其他模块之前导入（见 main.tsx）。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const g: any = typeof window !== 'undefined' ? window : {};

// globalThis：motion 直接读取 globalThis.__MOTION_INSPECT__（Chrome 71）
if (typeof g.globalThis === 'undefined') g.globalThis = g;

// queueMicrotask：motion 的帧调度（Chrome 71）
if (typeof g.queueMicrotask !== 'function') {
  g.queueMicrotask = (cb: () => void) => {
    Promise.resolve()
      .then(cb)
      .catch((e) => setTimeout(() => { throw e; }, 0));
  };
}

// Object.fromEntries：游戏数据表（Chrome 73）
if (typeof (Object as any).fromEntries !== 'function') {
  (Object as any).fromEntries = (entries: Iterable<[PropertyKey, unknown]>) => {
    const out: Record<PropertyKey, unknown> = {};
    for (const [k, v] of entries) out[k as string] = v;
    return out;
  };
}

// Array.prototype.flat / flatMap：motion（Chrome 69）
function define(proto: object, name: string, value: unknown) {
  if (!(name in proto)) Object.defineProperty(proto, name, { value, configurable: true, writable: true });
}
define(Array.prototype, 'flat', function flat(this: unknown[], depth = 1): unknown[] {
  const out: unknown[] = [];
  const walk = (arr: unknown[], d: number) => {
    for (const v of arr) {
      if (Array.isArray(v) && d > 0) walk(v, d - 1);
      else out.push(v);
    }
  };
  walk(this, Math.floor(depth) || 0);
  return out;
});
define(Array.prototype, 'flatMap', function flatMap(this: unknown[], fn: (v: unknown, i: number, a: unknown[]) => unknown, thisArg?: unknown) {
  const out: unknown[] = [];
  this.forEach((v, i, a) => {
    const r = fn.call(thisArg, v, i, a);
    if (Array.isArray(r)) out.push(...r);
    else out.push(r);
  });
  return out;
});

// Promise.prototype.finally（Chrome 63）、Promise.allSettled（Chrome 76）
define(Promise.prototype, 'finally', function (this: Promise<unknown>, fn?: () => unknown) {
  if (typeof fn !== 'function') return this.then();
  const P = (this.constructor as PromiseConstructor) || Promise;
  return this.then(
    (v) => P.resolve(fn()).then(() => v),
    (e) => P.resolve(fn()).then(() => { throw e; }),
  );
});
if (typeof (Promise as any).allSettled !== 'function') {
  (Promise as any).allSettled = (items: Iterable<unknown>) =>
    Promise.all(
      Array.from(items, (p) =>
        Promise.resolve(p).then(
          (value) => ({ status: 'fulfilled', value }),
          (reason) => ({ status: 'rejected', reason }),
        ),
      ),
    );
}

// AbortController（Chrome 66）+ addEventListener 的 { signal } 选项（Chrome 90）：
// motion 的点击/悬停手势用它来解绑事件，旧内核不支持时监听器会一直挂着。
let polyfilledAbort = false;
if (typeof g.AbortController !== 'function' && typeof g.EventTarget === 'function') {
  polyfilledAbort = true;
  class SimpleAbortSignal {
    aborted = false;
    reason: unknown = undefined;
    onabort: ((e: Event) => void) | null = null;
    private listeners: Array<() => void> = [];
    addEventListener(type: string, fn: () => void) {
      if (type === 'abort') this.listeners.push(fn);
    }
    removeEventListener(type: string, fn: () => void) {
      if (type === 'abort') this.listeners = this.listeners.filter((l) => l !== fn);
    }
    _abort(reason: unknown) {
      if (this.aborted) return;
      this.aborted = true;
      this.reason = reason;
      const listeners = this.listeners.slice();
      this.listeners = [];
      for (const l of listeners) l();
      if (this.onabort) this.onabort({ type: 'abort' } as Event);
    }
  }
  g.AbortSignal = SimpleAbortSignal;
  g.AbortController = class {
    signal = new SimpleAbortSignal();
    abort(reason?: unknown) {
      this.signal._abort(reason);
    }
  };
}
if (typeof g.EventTarget === 'function') {
  let signalSupported = false;
  try {
    const probe = {} as AddEventListenerOptions;
    Object.defineProperty(probe, 'signal', { get: () => ((signalSupported = true), undefined) });
    g.addEventListener('mt-probe', () => {}, probe);
  } catch {
    /* 不支持选项对象的内核不会走到这里（Chrome 61 已支持） */
  }
  // 原生不认 signal 选项，或者 AbortController 是上面补的（原生不接受补丁版 signal）时，
  // 由这里接管：把 signal 从选项里拿掉，abort 时自己解绑
  if (!signalSupported || polyfilledAbort) {
    const proto = g.EventTarget.prototype;
    const add = proto.addEventListener;
    proto.addEventListener = function (this: EventTarget, type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions) {
      type SignalLike = { aborted: boolean; addEventListener(t: string, f: () => void): void };
      const signal = opts && typeof opts === 'object' ? (opts.signal as unknown as SignalLike | undefined) : undefined;
      if (!signal || (signalSupported && !(signal instanceof g.AbortSignal))) return add.call(this, type, fn, opts);
      if (signal.aborted) return;
      const rest: AddEventListenerOptions = { capture: (opts as AddEventListenerOptions).capture, once: (opts as AddEventListenerOptions).once, passive: (opts as AddEventListenerOptions).passive };
      signal.addEventListener('abort', () => this.removeEventListener(type, fn, rest));
      return add.call(this, type, fn, rest);
    };
  }
}

/** Flex gap 行为检测：不支持时给 <html> 加 no-flexgap，启用构建时生成的 margin 回退样式。 */
export function detectFlexGap() {
  if (typeof document === 'undefined' || !document.body) return;
  const flex = document.createElement('div');
  flex.style.position = 'absolute';
  flex.style.visibility = 'hidden';
  flex.style.display = 'flex';
  flex.style.flexDirection = 'column';
  flex.style.rowGap = '1px';
  flex.appendChild(document.createElement('div'));
  flex.appendChild(document.createElement('div'));
  document.body.appendChild(flex);
  const supported = flex.scrollHeight === 1;
  document.body.removeChild(flex);
  if (!supported) document.documentElement.classList.add('no-flexgap');
}

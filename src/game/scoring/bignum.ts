/**
 * 极简大数：value = m × 10^e，1 ≤ |m| < 10（或 m = 0）。
 * 只实现游戏需要的非负数运算：加、乘、比较、格式化。
 * 全部是纯数据对象，可以直接 JSON 序列化进存档和事件日志。
 */
export interface Big {
  m: number;
  e: number;
}

export const ZERO: Big = { m: 0, e: 0 };

function norm(m: number, e: number): Big {
  if (m === 0 || !Number.isFinite(m)) {
    if (!Number.isFinite(m)) throw new Error('Big: non-finite mantissa');
    return { m: 0, e: 0 };
  }
  const shift = Math.floor(Math.log10(Math.abs(m)));
  let mm = m / Math.pow(10, shift);
  let ee = e + shift;
  // 处理浮点误差导致的 9.9999999 / 10.0000001
  if (Math.abs(mm) >= 10) {
    mm /= 10;
    ee += 1;
  } else if (Math.abs(mm) < 1) {
    mm *= 10;
    ee -= 1;
  }
  return { m: mm, e: ee };
}

export function big(n: number | Big): Big {
  if (typeof n !== 'number') return n;
  if (!Number.isFinite(n)) throw new Error('Big: cannot convert non-finite number');
  return norm(n, 0);
}

export function add(a: Big | number, b: Big | number): Big {
  const x = big(a);
  const y = big(b);
  if (x.m === 0) return y;
  if (y.m === 0) return x;
  const [hi, lo] = x.e >= y.e ? [x, y] : [y, x];
  const diff = hi.e - lo.e;
  if (diff > 17) return hi;
  return norm(hi.m + lo.m / Math.pow(10, diff), hi.e);
}

export function mul(a: Big | number, b: Big | number): Big {
  const x = big(a);
  const y = big(b);
  if (x.m === 0 || y.m === 0) return ZERO;
  return norm(x.m * y.m, x.e + y.e);
}

export function cmp(a: Big | number, b: Big | number): -1 | 0 | 1 {
  const x = big(a);
  const y = big(b);
  if (x.m === 0 && y.m === 0) return 0;
  if (x.m === 0) return y.m > 0 ? -1 : 1;
  if (y.m === 0) return x.m > 0 ? 1 : -1;
  if (x.m > 0 !== y.m > 0) return x.m > 0 ? 1 : -1;
  if (x.e !== y.e) return (x.e > y.e) === x.m > 0 ? 1 : -1;
  if (Math.abs(x.m - y.m) < 1e-12) return 0;
  return x.m > y.m ? 1 : -1;
}

export const gte = (a: Big | number, b: Big | number) => cmp(a, b) >= 0;
export const gt = (a: Big | number, b: Big | number) => cmp(a, b) > 0;

/** 向下取整（只在 e < 16 时有意义，更大的数本来就超出 double 精度） */
export function floor(a: Big): Big {
  if (a.e >= 15 || a.m === 0) return a;
  return big(Math.floor(toNumber(a) + 1e-9));
}

export function toNumber(a: Big): number {
  if (a.e > 308) return Infinity;
  return a.m * Math.pow(10, a.e);
}

export function log10(a: Big): number {
  if (a.m <= 0) return -Infinity;
  return Math.log10(a.m) + a.e;
}

/**
 * 格式化：
 *  - < 1e11：整数带千分位（倍率等小数最多保留 2 位）
 *  - 更大：科学计数法 1.23e15
 */
export function format(a: Big | number, opts: { decimals?: number } = {}): string {
  const x = big(a);
  if (x.m === 0) return '0';
  if (x.e < 11) {
    const n = toNumber(x);
    const decimals = opts.decimals ?? 0;
    const rounded = decimals > 0 ? Math.round(n * 10 ** decimals) / 10 ** decimals : Math.floor(n + 1e-9);
    return rounded.toLocaleString('en-US', { maximumFractionDigits: decimals });
  }
  const m = Math.floor(x.m * 100 + 1e-9) / 100;
  return `${m.toFixed(2)}e${x.e}`;
}

/** 中文量级提示：1.2万、3.4亿、5.6万亿… 超过 1e16 用 e 记法 */
export function formatCn(a: Big | number): string {
  const x = big(a);
  const n = toNumber(x);
  if (x.e < 4) return format(x);
  if (x.e < 8) return `${trim(n / 1e4)}万`;
  if (x.e < 12) return `${trim(n / 1e8)}亿`;
  if (x.e < 16) return `${trim(n / 1e12)}万亿`;
  return format(x);
}

function trim(n: number): string {
  return (Math.floor(n * 100) / 100).toString();
}

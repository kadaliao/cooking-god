/**
 * 全屏特效层：粒子爆发 + 屏幕震动。用 Canvas 2D，独立于 React 渲染。
 */
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  shape: 'circle' | 'star' | 'rect';
  rot: number;
  vr: number;
}

let canvas: HTMLCanvasElement | null = null;
let g: CanvasRenderingContext2D | null = null;
let particles: Particle[] = [];
let running = false;

export function attachFxCanvas(el: HTMLCanvasElement | null) {
  canvas = el;
  g = el?.getContext('2d') ?? null;
  resize();
}

function resize() {
  if (!canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  g?.setTransform(dpr, 0, 0, dpr, 0, 0);
}
if (typeof window !== 'undefined') window.addEventListener('resize', resize);

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function burst(
  x: number,
  y: number,
  opts: { count?: number; colors?: string[]; power?: number; gravity?: boolean; shapes?: Particle['shape'][] } = {},
) {
  if (!g || reduceMotion()) return;
  const count = Math.min(opts.count ?? 24, 220);
  const colors = opts.colors ?? ['#ffd166', '#ef476f', '#ffffff'];
  const power = opts.power ?? 6;
  const shapes = opts.shapes ?? ['circle', 'star', 'rect'];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = power * (0.4 + Math.random() * 0.8);
    particles.push({
      x,
      y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - (opts.gravity ? power * 0.6 : 0),
      life: 0,
      max: 40 + Math.random() * 30,
      size: 3 + Math.random() * 5,
      color: colors[i % colors.length],
      shape: shapes[i % shapes.length],
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.4,
    });
  }
  if (particles.length > 600) particles = particles.slice(-600);
  if (!running) {
    running = true;
    requestAnimationFrame(tick);
  }
}

export function burstAt(el: Element | null | undefined, opts: Parameters<typeof burst>[2] = {}) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  burst(r.left + r.width / 2, r.top + r.height / 2, opts);
}

function star(ctx: CanvasRenderingContext2D, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

function tick() {
  if (!g || !canvas) {
    running = false;
    return;
  }
  g.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter((p) => p.life < p.max);
  for (const p of particles) {
    p.life++;
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.18;
    p.vx *= 0.98;
    p.rot += p.vr;
    const alpha = 1 - p.life / p.max;
    g.save();
    g.globalAlpha = alpha;
    g.fillStyle = p.color;
    g.translate(p.x, p.y);
    g.rotate(p.rot);
    if (p.shape === 'circle') {
      g.beginPath();
      g.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      g.fill();
    } else if (p.shape === 'star') star(g, p.size);
    else g.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    g.restore();
  }
  if (particles.length > 0) requestAnimationFrame(tick);
  else {
    g.clearRect(0, 0, canvas.width, canvas.height);
    running = false;
  }
}

/** 屏幕震动：强度 1~4 */
export function shake(intensity = 1) {
  if (reduceMotion()) return;
  const root = document.getElementById('shake-root');
  if (!root) return;
  const level = Math.max(1, Math.min(4, Math.round(intensity)));
  root.classList.remove('shake-1', 'shake-2', 'shake-3', 'shake-4');
  void root.offsetWidth;
  root.classList.add(`shake-${level}`);
  window.setTimeout(() => root.classList.remove(`shake-${level}`), 500);
}

/** 结算事件之间的间隔：越往后越快，形成加速的节奏 */
export function eventDelay(kind: string, index: number, speed: number): number {
  const base: Record<string, number> = {
    recipe: 700,
    cardStart: 240,
    chips: 230,
    mult: 260,
    xmult: 480,
    technique: 320,
    retrigger: 380,
    growth: 240,
    gold: 240,
    note: 200,
    disabled: 380,
    final: 400,
  };
  const accel = Math.max(0.3, Math.pow(0.95, index));
  return ((base[kind] ?? 220) * accel) / speed;
}

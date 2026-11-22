/**
 * Web Audio 合成音效，不依赖任何音频文件。
 */
let ctx: AudioContext | null = null;
let enabled = true;
let master: GainNode | null = null;

function ac(): AudioContext | null {
  if (!enabled || typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.5, slideTo?: number, delay = 0) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol = 0.3, filterFreq = 3000, delay = 0) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + delay;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filterFreq;
  f.Q.value = 0.8;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

// 五声音阶，连锁越长音越高
const PENTA = [0, 2, 4, 7, 9];
const step = (n: number) => 440 * Math.pow(2, (Math.floor(n / 5) * 12 + PENTA[n % 5]) / 12);

export const sfx = {
  setEnabled(v: boolean) {
    enabled = v;
  },
  click() {
    tone(660, 0.06, 'triangle', 0.25);
  },
  select() {
    tone(520, 0.08, 'triangle', 0.3, 780);
  },
  deselect() {
    tone(600, 0.08, 'triangle', 0.25, 380);
  },
  sizzle() {
    noise(0.7, 0.25, 4500);
    noise(0.4, 0.15, 1800, 0.1);
  },
  chip(n = 0) {
    tone(step(Math.min(n, 24)) / 2, 0.09, 'square', 0.12);
  },
  mult(n = 0) {
    tone(step(Math.min(n, 24)), 0.12, 'triangle', 0.3);
  },
  xmult(n = 0) {
    const f = step(Math.min(n, 24));
    tone(f, 0.25, 'sawtooth', 0.18, f * 2);
    tone(f * 1.5, 0.3, 'triangle', 0.25, undefined, 0.05);
    noise(0.15, 0.2, 800);
  },
  retrigger() {
    tone(880, 0.08, 'square', 0.15);
    tone(1320, 0.1, 'square', 0.12, undefined, 0.07);
  },
  technique() {
    tone(392, 0.1, 'triangle', 0.3);
    tone(523, 0.12, 'triangle', 0.3, undefined, 0.08);
  },
  coin() {
    tone(988, 0.07, 'square', 0.15);
    tone(1319, 0.15, 'square', 0.15, undefined, 0.07);
  },
  buy() {
    tone(523, 0.08, 'triangle', 0.3);
    tone(784, 0.08, 'triangle', 0.3, undefined, 0.07);
    tone(1047, 0.15, 'triangle', 0.3, undefined, 0.14);
  },
  error() {
    tone(220, 0.15, 'square', 0.15, 160);
  },
  final(big = 0) {
    tone(262, 0.4, 'triangle', 0.35);
    tone(330, 0.4, 'triangle', 0.3, undefined, 0.06);
    tone(392, 0.5, 'triangle', 0.3, undefined, 0.12);
    if (big > 0) {
      tone(523, 0.7, 'sawtooth', 0.15, 1046, 0.2);
      noise(0.8, 0.3, 600, 0.15);
    }
  },
  win() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.3, undefined, i * 0.1));
  },
  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone(f, 0.3, 'triangle', 0.3, undefined, i * 0.15));
  },
};

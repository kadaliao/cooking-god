// 逐帧录制真实小工具画面：注入假时钟，每步推进 1/30 秒再截图，画面顺滑、可复现。
// 先 pnpm build:minitool、node promo/prep.cjs，再：node promo/capture.cjs [镜头名...]
// 输出 promo/build/shots/<镜头>/f00001.jpg 和 taps.json（点击位置，视频里画手指用）
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));

const DIST = path.resolve(__dirname, '../dist-minitool');
const OUT = path.join(__dirname, 'build', 'shots');
const FPS = 30;
const DT = 1000 / FPS;
const KEY = 'cooking-god:v1';

const FAKE_CLOCK = `(() => {
  let T = 0;
  const base = Date.now();
  performance.now = () => T;
  Date.now = () => base + T;
  let rafQ = [], rafId = 0, timers = [], tid = 0;
  window.requestAnimationFrame = cb => { rafQ.push([++rafId, cb]); return rafId; };
  window.cancelAnimationFrame = id => { rafQ = rafQ.filter(x => x[0] !== id); };
  window.setTimeout = (fn, ms, ...a) => { timers.push({ id: ++tid, at: T + (+ms || 0), fn, a }); return tid; };
  window.clearTimeout = id => { timers = timers.filter(t => t.id !== id); };
  window.setInterval = (fn, ms, ...a) => { const id = ++tid; const rep = () => { timers.push({ id, at: T + Math.max(1, +ms || 0), fn: () => { rep(); fn(...a); }, a: [] }); }; rep(); return id; };
  window.clearInterval = window.clearTimeout;
  const born = new WeakMap();
  window.__step = dt => {
    T += dt;
    for (let guard = 0; guard < 500; guard++) {
      timers.sort((x, y) => x.at - y.at || x.id - y.id);
      if (!timers.length || timers[0].at > T) break;
      const t = timers.shift();
      try { typeof t.fn === 'function' ? t.fn(...t.a) : 0; } catch (e) { console.error(e); }
    }
    const q = rafQ; rafQ = [];
    q.forEach(([, cb]) => { try { cb(T); } catch (e) { console.error(e); } });
    document.getAnimations().forEach(a => {
      if (!born.has(a)) born.set(a, T - dt);
      a.pause();
      a.currentTime = T - born.get(a);
    });
  };
})();`;


// 假的 AudioContext：游戏音效（src/audio/sfx.ts）只用到振荡器、增益、滤波和噪声缓冲。
// 这里不出声，只把每个音记下来（时间按假时钟），audio.html 再原样合成进音轨。
const FAKE_AUDIO = `(() => {
  const log = window.__sfx = [];
  class P { constructor() { this.v = 0; this.peak = 0; this.slide = null; this.end = null; }
    set value(v) { this.v = v; this.peak = Math.max(this.peak, v); } get value() { return this.v; }
    setValueAtTime(v) { this.v = v; this.first = this.first == null ? v : this.first; this.peak = Math.max(this.peak, v); }
    linearRampToValueAtTime(v, t) { this.peak = Math.max(this.peak, v); this.end = t; }
    exponentialRampToValueAtTime(v, t) { this.peak = Math.max(this.peak, v); this.ramps = (this.ramps || []).concat([[v, t]]); this.end = t; }
    setTargetAtTime() {} cancelScheduledValues() {} }
  class N { constructor(c) { this.context = c; this.outs = []; } connect(n) { this.outs.push(n); return n; } disconnect() {} }
  class Osc extends N { constructor(c) { super(c); this.type = 'sine'; this.frequency = new P(); this.detune = new P(); }
    start(t) { this.t0 = t; } stop(t) {
      const g = this.outs[0]; const f = this.frequency;
      log.push({ k: 'tone', at: this.t0, type: this.type, freq: f.first, slide: f.ramps ? f.ramps[0][0] : null, vol: g ? g.gain.peak : 0.3, dur: t - 0.02 - this.t0 });
    } }
  class Gain extends N { constructor(c) { super(c); this.gain = new P(); this.gain.v = 1; } }
  class Biq extends N { constructor(c) { super(c); this.type = 'lowpass'; this.frequency = new P(); this.Q = new P(); this.gain = new P(); } }
  class Src extends N { constructor(c) { super(c); this.buffer = null; this.playbackRate = new P(); }
    start(t) { const f = this.outs[0]; const g = f && f.outs[0];
      log.push({ k: 'noise', at: t, dur: this.buffer ? this.buffer.length / this.buffer.sampleRate : 0.2, vol: g ? g.gain.v : 0.3, filter: f ? f.frequency.v : 3000 }); }
    stop() {} }
  class AC { constructor() { this.sampleRate = 48000; this.state = 'running'; this.destination = new N(this); }
    get currentTime() { return performance.now() / 1000; }
    resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); }
    createOscillator() { return new Osc(this); } createGain() { return new Gain(this); } createBiquadFilter() { return new Biq(this); }
    createBufferSource() { return new Src(this); }
    createBuffer(ch, len, sr) { const d = new Float32Array(len); return { length: len, sampleRate: sr, duration: len / sr, numberOfChannels: ch, getChannelData: () => d }; } }
  window.AudioContext = AC; window.webkitAudioContext = AC;
})();`;

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
  const srv = http.createServer((req, res) => {
    const p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
    if (!p.startsWith(DIST) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => srv.listen(0, () => r(srv)));
}

class Rec {
  constructor(page, name) {
    this.page = page; this.name = name; this.n = 0; this.taps = []; this.t0 = null;
    this.dir = path.join(OUT, name);
    fs.rmSync(this.dir, { recursive: true, force: true });
    fs.mkdirSync(this.dir, { recursive: true });
  }
  async frame(record = true) {
    await this.page.evaluate(dt => window.__step(dt), DT);
    if (!record) return;
    this.n++;
    if (this.t0 == null) this.t0 = await this.page.evaluate(() => performance.now() / 1000);
    await this.page.screenshot({ path: path.join(this.dir, `f${String(this.n).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 });
  }
  async wait(sec, record = true) { for (let i = 0; i < Math.round(sec * FPS); i++) await this.frame(record); }
  // 点一个元素（找不到就报错），记录点击时刻和位置（390×844 坐标）
  async tap(finder, arg) {
    const box = await this.page.evaluate(([f, a]) => {
      const el = (new Function('a', 'return (' + f + ')(a)'))(a);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      el.click();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }, [finder.toString(), arg]);
    if (!box) throw new Error(`${this.name}: 找不到 ${arg}`);
    this.taps.push({ f: this.n + 1, x: box.x, y: box.y });
  }
  async card(name) { await this.tap(n => [...document.querySelectorAll('.hand .icard')].find(e => e.querySelector('.icard-name').textContent === n), name); }
  async button(text) { await this.tap(t => [...document.querySelectorAll('button')].find(e => e.textContent.includes(t) && !e.disabled), text); }
  // 音效时间换算成“第几帧”（小数，第 1 帧 = 1）
  async save() {
    const sfx = (await this.page.evaluate(() => window.__sfx || [])).filter(x => x.at >= this.t0 - 0.001).map(x => Object.assign(x, { f: 1 + (x.at - this.t0) * FPS }));
    fs.writeFileSync(path.join(this.dir, 'taps.json'), JSON.stringify({ frames: this.n, taps: this.taps, sfx })); console.log(`${this.name}: ${this.n} 帧，${this.taps.length} 次点击`); }
}

// ---------- 局面
function baseSave() { return JSON.parse(fs.readFileSync(path.join(__dirname, 'build', 'base.json'), 'utf8')); }

// 第 7 关的肉类乘算构筑（和 README 截图同一套）：大蒜炝锅 + 牛肉猪肉鸡肉 + 白菜，打出两百多万
function bbqSave() {
  const save = baseSave();
  const st = save.state;
  st.settings = { speed: 1, sound: true, tutorialDone: true, vibrate: true };
  st.screen = 'game';
  const run = st.run;
  const hand = [];
  const byDef = id => run.deck.find(c => c.defId === id && !hand.includes(c.uid)).uid;
  for (const id of ['garlic', 'beef', 'pork', 'chicken', 'cabbage', 'chili', 'egg', 'rice']) hand.push(byDef(id));
  const beef = run.deck.find(c => c.uid === hand[1]);
  beef.enhancement = 'charred'; beef.level = 2;
  run.hand = hand;
  run.pot = [];
  run.drawPile = run.deck.map(c => c.uid).filter(u => !hand.includes(u));
  run.discardPile = [];
  run.phase = 'playing';
  run.level = 7;
  run.gold = 23;
  run.recipeLevels = { bbq: 3, jiachang: 2 };
  run.tools = [
    { uid: 'tA', defId: 'grill', data: {} },
    { uid: 'tB', defId: 'heirloomWok', data: {} },
    { uid: 'tC', defId: 'autoWok', data: {} },
    { uid: 'tD', defId: 'goldenSpatula', data: {} },
    { uid: 'tE', defId: 'centuryBroth', data: { chips: 150 } },
  ];
  run.levelState = { target: { m: 7.5, e: 4 }, score: { m: 3.12, e: 4 }, cooksLeft: 3, discardsLeft: 2, cooksDone: 1, usedRecipes: ['jiachang'] };
  return save;
}

const SHOTS = {
  // 标题画面
  async title(r) {
    await r.wait(2.4);
  },
  // 第 1 关开场：目标分数 + 开火
  async intro(r) {
    await r.wait(0.6);
    await r.button('开火');
    await r.wait(1.4);
  },
  // 选五张下锅
  async pick(r) {
    await r.wait(0.5);
    for (const n of ['大蒜', '牛肉', '猪肉', '鸡肉', '白菜']) { await r.card(n); await r.wait(0.75); }
    await r.wait(1.0);
  },
  // 开始烹饪：逐条结算到出锅、过关
  async cook(r) {
    for (const n of ['大蒜', '牛肉', '猪肉', '鸡肉', '白菜']) { await r.card(n); await r.wait(0.9, false); }
    await r.wait(1.2, false);
    r.taps = [];   // 选牌那几下没录进画面
    await r.wait(0.3);
    await r.button('开始烹饪');
    await r.wait(24);
  },
  // 商店：买一件厨具
  async shop(r) {
    await r.wait(0.8);
    await r.tap(() => [...document.querySelectorAll('button')].find(e => /\$\s*8/.test(e.textContent) && !e.disabled), '$8');
    await r.wait(1.6);
  },
  // 最终 Boss 登场
  async boss(r) {
    await r.wait(2.6);
  },
};

// 每个镜头开机前的存档
const SETUP = {
  title(s) { s.state.settings = { speed: 1, sound: true, tutorialDone: true }; s.state.screen = 'title'; s.state.run = null; return s; },
  intro(s) { s.state.settings = { speed: 1, sound: true, tutorialDone: true }; s.state.run.phase = 'levelIntro'; return s; },
  pick: bbqSave,
  cook: bbqSave,
  shop() {
    const s = bbqSave(); const run = s.state.run;
    run.phase = 'shop'; run.gold = 21; run.level = 7;
    run.tools = run.tools.slice(0, 3);
    run.shop = {
      tools: [
        { kind: 'tool', defId: 'hellOil', price: 8, sold: false },
        { kind: 'tool', defId: 'molecular', price: 7, sold: false },
        { kind: 'tool', defId: 'malaChain', price: 6, sold: false },
      ],
      goods: [
        { kind: 'consumable', type: 'recipe', price: 3, sold: false, recipeId: 'bbq' },
        { kind: 'consumable', type: 'ingredient', price: 7, sold: false, ingredientId: 'caviar' },
      ],
      rerollCost: 2, removeCost: 3, removedThisShop: 0,
    };
    return s;
  },
  boss() {
    const s = bbqSave(); const run = s.state.run;
    run.phase = 'levelIntro'; run.level = 9;
    run.levelState = { target: { m: 1.2, e: 6 }, score: { m: 0, e: 0 }, cooksLeft: 4, discardsLeft: 3, cooksDone: 0, usedRecipes: [] };
    return s;
  },
};

(async () => {
  const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
  const srv = await serve();
  const url = `http://127.0.0.1:${srv.address().port}/index.html`;
  const browser = await chromium.launch({ channel: 'chrome', args: ['--force-color-profile=srgb'] });
  for (const name of want) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN' });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
    page.on('pageerror', e => console.log('[pageerror]', e.message));
    const save = SETUP[name](baseSave());
    await page.addInitScript(s => { window.__PRELOAD = s; }, JSON.stringify(save));
    await page.addInitScript({ path: path.join(__dirname, 'mock.js') });
    await page.addInitScript(FAKE_CLOCK);
    await page.addInitScript(FAKE_AUDIO);
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    // 等图片加载完：推进假时间但不录
    const r = new Rec(page, name);
    for (let i = 0; i < 90; i++) { await r.frame(false); await new Promise(res => setTimeout(res, 20)); }
    await page.evaluate(() => Promise.all([...document.images].map(i => i.decode().catch(() => {}))));
    await SHOTS[name](r);
    await r.save();
    await ctx.close();
  }
  await browser.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });

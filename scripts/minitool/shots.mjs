// 小工具产物的手机尺寸截图与冒烟测试：
//   pnpm build:minitool && node scripts/minitool/shots.mjs [宽x高] [输出目录]
// 用本机 Google Chrome 打开 dist-minitool，注入一个模拟的 window.xhs（Storage 存在内存里），
// 依次截标题、开局、选牌、结算、商店等画面。只用来看布局和流程，不能代替小红书模拟器和真机。
import puppeteer from 'puppeteer-core';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join, normalize } from 'node:path';

const [w, h] = (process.argv[2] ?? '390x844').split('x').map(Number);
const OUT = process.argv[3] ?? 'minitool-release/shots';
const ROOT = 'dist-minitool';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(OUT, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^\/+/, '') || 'index.html';
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const PAGE_URL = `http://127.0.0.1:${server.address().port}/index.html`;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  userDataDir: mkdtempSync(join(tmpdir(), 'cg-mt-')),
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => (errors.push(`pageerror: ${e.message}`), console.log('PAGEERROR', e.message, (e.stack || '').split('\n').slice(0, 3).join(' | '))));
page.on('console', (m) => m.type() === 'error' && !/status of 404/.test(m.text()) && errors.push(`console: ${m.text()}`));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
page.on('response', (r) => r.status() >= 400 && !r.url().endsWith('/favicon.ico') && errors.push(`http ${r.status()}: ${r.url()}`));

// LEGACY=1：删掉 Chrome 61 没有的 API，并强制启用 flex gap 的 margin 回退样式，粗略模拟旧内核
// （真正的旧内核验证仍要在 Android 真机上做）
if (process.env.LEGACY) {
  await page.evaluateOnNewDocument(() => {
    delete window.queueMicrotask;
    delete window.structuredClone;
    delete window.AbortController;
    delete window.AbortSignal;
    delete Object.fromEntries;
    delete Array.prototype.flat;
    delete Array.prototype.flatMap;
    delete Promise.allSettled;
    delete Promise.prototype.finally;
    document.addEventListener('DOMContentLoaded', () => document.documentElement.classList.add('no-flexgap'));
  });
}

// 模拟容器：客户端 9.55、胶囊在右上角、Storage 存在 window.__mtStore
await page.evaluateOnNewDocument(() => {
  const store = () => (window.__mtStore = window.__mtStore || {});
  const ok = (api, extra) => Promise.resolve(Object.assign({ errMsg: `${api}:ok` }, extra));
  const calls = (window.__mtCalls = []);
  window.xhs = {
    launchOptions: { miniToolEnv: { buildVersion: 9550001, userDataPath: '/usr' } },
    miniTool: {
      getLaunchOptions: () => ok('getLaunchOptions', { miniToolEnv: { buildVersion: 9550001 } }),
      setStorage: ({ key, data }) => (calls.push(['setStorage', key]), (store()[key] = data), ok('setStorage')),
      getStorage: ({ key }) => ok('getStorage', { data: key in store() ? store()[key] : null }),
      getStorageInfo: () => ok('getStorageInfo', { keys: Object.keys(store()), usedBytes: 0, limitBytes: 10485760 }),
      removeStorage: ({ key }) => (delete store()[key], ok('removeStorage')),
      clearStorage: () => ok('clearStorage'),
      getWindowInfo: () => {
        const W = window.innerWidth;
        return ok('getWindowInfo', {
          pixelRatio: 3,
          windowWidth: W,
          windowHeight: window.innerHeight,
          statusBarHeight: 47,
          safeArea: { left: 0, top: 47, right: W, bottom: window.innerHeight - 34, width: W, height: window.innerHeight - 81 },
          menuButtons: { capsule: { left: W - 95, top: 51, right: W - 8, bottom: 83, width: 87, height: 32 }, back: null, me: null, share: null },
        });
      },
      vibrateShort: (o) => (calls.push(['vibrateShort', o.type]), ok('vibrateShort')),
      vibrateLong: () => (calls.push(['vibrateLong']), ok('vibrateLong')),
      setKeepScreenOn: (o) => (calls.push(['setKeepScreenOn', o.keepScreenOn]), ok('setKeepScreenOn')),
      share: (o) => (calls.push(['share', o.type]), ok('share')),
    },
  };
  document.addEventListener('DOMContentLoaded', () => {
    const c = document.createElement('div');
    c.style.cssText = `position:fixed;z-index:9999;left:${window.innerWidth - 95}px;top:51px;width:87px;height:32px;border-radius:16px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.5);pointer-events:none`;
    document.documentElement.appendChild(c);
  });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => {
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log('shot', name);
};
const clickText = async (text, sel = 'button') => {
  const found = await page.evaluate(
    (sel, text) => {
      const el = [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(text) && !e.disabled);
      if (el) el.click();
      return !!el;
    },
    sel,
    text,
  );
  if (!found) errors.push(`missing button: ${text}`);
  await sleep(900);
};
const tapHand = async (n) => {
  for (let i = 0; i < n; i++) {
    // 等上一张牌飞进锅的动画（约 0.8 秒）结束，否则算出的点击位置会落在飞行中的牌上
    await page.tap('.hand .hand-slot:last-child .icard');
    await sleep(1100);
  }
};

await page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await page.goto(PAGE_URL, { waitUntil: 'networkidle0' });
await sleep(1500);
await shot('01-title');
await clickText('新的一局');
await shot('02-intro');
await clickText('开火');
await sleep(600);
await shot('03-tutorial');
await clickText('跳过教程');
await tapHand(4);
console.log('pot cards', await page.evaluate(() => document.querySelectorAll('.pot-row .icard').length));
await shot('04-pot');
const overflow = await page.evaluate(() => ({
  scrollW: document.documentElement.scrollWidth,
  scrollH: document.documentElement.scrollHeight,
  vw: window.innerWidth,
  vh: window.innerHeight,
}));
console.log('page size', JSON.stringify(overflow));
await clickText('开始烹饪');
await sleep(1500);
await shot('05-scoring');
await clickText('跳过演出');
await sleep(600);
await clickText('继续');
await sleep(1200);
await shot('06-after');
const saved = await page.evaluate(() => Object.keys(window.__mtStore));
const calls = await page.evaluate(() => window.__mtCalls.map((c) => c.join(':')));
console.log('storage keys', saved.join(','));
console.log('xhs calls', [...new Set(calls)].join(' '));

// 重新打开：确认存档能从容器 Storage 读回
const store = await page.evaluate(() => window.__mtStore);
await page.evaluateOnNewDocument((s) => (window.__mtStore = s), store);
await page.reload({ waitUntil: 'networkidle0' });
await sleep(1500);
await shot('07-reopen');
const resumed = await page.evaluate(
  () => !!document.querySelector('.game') || [...document.querySelectorAll('button')].some((b) => b.textContent.includes('继续游戏')),
);
console.log('resumed after reopen', resumed);
if (!resumed) errors.push('重新打开后没有恢复进度');

// 商店、弹窗、失败结算：直接改存档里的局面再重开
const withRun = async (name, mutate, after) => {
  const st = await page.evaluate(() => window.__mtStore);
  const save = JSON.parse(st['cooking-god:v1']);
  mutate(save.state.run, save.state);
  st['cooking-god:v1'] = JSON.stringify(save);
  await page.evaluateOnNewDocument((s) => (window.__mtStore = s), st);
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1500);
  if (after) await after();
  await shot(name);
};
await withRun('08-shop', (run) => {
  run.phase = 'shop';
  run.gold = 21;
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
    rerollCost: 2,
    removeCost: 3,
    removedThisShop: 0,
  };
});
await withRun(
  '09-tools',
  (run) => {
    run.phase = 'playing';
    run.shop = null;
    run.tools = [
      { uid: 'tA', defId: 'grill', data: {} },
      { uid: 'tB', defId: 'heirloomWok', data: {} },
      { uid: 'tC', defId: 'autoWok', data: {} },
      { uid: 'tD', defId: 'goldenSpatula', data: {} },
      { uid: 'tE', defId: 'centuryBroth', data: { chips: 150 } },
    ];
  },
  () => tapHand(3),
);
await clickText('📖');
await shot('10-rules');
await page.evaluate(() => document.querySelector('.modal-backdrop')?.click());
await sleep(600);
await clickText('⚙️');
await shot('11-settings');
await withRun('12-gameover', (run, state) => {
  run.phase = 'gameOver';
  state.screen = 'game';
});

await browser.close();
server.close();
if (errors.length) {
  console.log('ERRORS\n' + errors.join('\n'));
  process.exitCode = 1;
}

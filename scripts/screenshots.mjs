// 生成 README 截图：node scripts/screenshots.mjs [url]
// 需要本机安装 Google Chrome 和 cwebp，并先启动 pnpm dev。输出到 docs/screenshots/*.webp
import puppeteer from 'puppeteer-core';
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const URL = process.argv[2] ?? 'http://localhost:5179/';
const OUT = 'docs/screenshots';
const KEY = 'cooking-god:v1';
mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  userDataDir: mkdtempSync(join(tmpdir(), 'cg-shot-')),
  args: ['--hide-scrollbars', '--force-color-profile=srgb'],
});
const page = await browser.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });
const clickText = async (sel, text) => {
  await page.evaluate(
    (sel, text) => [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(text))?.click(),
    sel,
    text,
  );
  await sleep(700);
};
const getSave = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const putSave = async (save) => {
  await page.evaluate((k, v) => localStorage.setItem(k, JSON.stringify(v)), KEY, save);
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(1500);
};
const pickCards = async (names) => {
  for (const n of names) {
    await page.evaluate((n) => {
      const el = [...document.querySelectorAll('.hand .icard')].find((e) => e.querySelector('.icard-name').textContent === n);
      el?.click();
    }, n);
    await sleep(900);
  }
};

await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.evaluate((k) => {
  localStorage.clear();
  localStorage.setItem(k, JSON.stringify({ state: { run: null, settings: { speed: 1, sound: false, tutorialDone: true }, records: { runs: 0, wins: 0, bestLevel: 0, bestCook: { m: 0, e: 0 } }, screen: 'title' }, version: 1 }));
}, KEY);
await page.reload({ waitUntil: 'networkidle0' });
await sleep(6000);
await shot('title');

// 开一局并进入第 7 关，配一套肉类乘算构筑
await clickText('button', '新的一局');
await clickText('button', '开火');
let save = await getSave();
let run = save.state.run;
const byDef = (id, skip = []) => run.deck.find((c) => c.defId === id && !skip.includes(c.uid)).uid;
const hand = [];
for (const id of ['garlic', 'beef', 'pork', 'chicken', 'cabbage', 'chili', 'egg', 'rice']) hand.push(byDef(id, hand));
run.deck.find((c) => c.uid === hand[1]).enhancement = 'charred';
run.deck.find((c) => c.uid === hand[1]).level = 2;
run.hand = hand;
run.pot = [];
run.drawPile = run.deck.map((c) => c.uid).filter((u) => !hand.includes(u));
run.discardPile = [];
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
save.state.screen = 'game';
await putSave(save);
await pickCards(['大蒜', '牛肉', '猪肉', '鸡肉', '白菜']);
await page.mouse.move(10, 10);
await sleep(600);
await shot('gameplay');

// 结算演出：中途 + 出锅
await clickText('button', '开始烹饪');
await sleep(4200);
await shot('scoring');
await page.waitForSelector('.final-pop', { timeout: 60000 });
await sleep(700);
await shot('final');

// 商店
save = await getSave();
run = save.state.run;
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
await putSave(save);
await shot('shop');

// 最终 Boss
save = await getSave();
run = save.state.run;
run.phase = 'levelIntro';
run.shop = null;
run.level = 9;
run.levelState = { target: { m: 1.2, e: 6 }, score: { m: 0, e: 0 }, cooksLeft: 4, discardsLeft: 3, cooksDone: 0, usedRecipes: [] };
await putSave(save);
await sleep(800);
await shot('boss');

// 手机
save = await getSave();
run = save.state.run;
run.phase = 'playing';
run.level = 7;
run.levelState = { target: { m: 7.5, e: 4 }, score: { m: 3.12, e: 4 }, cooksLeft: 3, discardsLeft: 2, cooksDone: 1, usedRecipes: [] };
run.hand = hand;
run.pot = [];
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await putSave(save);
await pickCards(['大蒜', '牛肉', '猪肉', '鸡肉']);
await sleep(600);
await shot('mobile');

await browser.close();
for (const f of readdirSync(OUT).filter((f) => f.endsWith('.png'))) {
  execFileSync('cwebp', ['-quiet', '-q', '84', `${OUT}/${f}`, '-o', `${OUT}/${f.replace('.png', '.webp')}`]);
  rmSync(`${OUT}/${f}`);
}
console.log('done');

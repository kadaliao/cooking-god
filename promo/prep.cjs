// 用真实时钟开一局，拿到一份基础存档 build/base.json（之后由 capture.cjs 改成想要的局面）
const path = require('path'), fs = require('fs'), http = require('http');
const { chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'));
const DIST = path.resolve(__dirname, '../dist-minitool');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.woff2': 'font/woff2' };
const srv = http.createServer((req, res) => {
  const p = path.join(DIST, decodeURIComponent(req.url.split('?')[0]).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(DIST) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
});
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  await new Promise(r => srv.listen(0, r));
  const b = await chromium.launch({ channel: 'chrome' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'zh-CN' });
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.addInitScript({ path: path.join(__dirname, 'mock.js') });
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
  await sleep(2500);
  await page.screenshot({ path: path.join(__dirname, 'build/p_title.png') });
  const click = t => page.evaluate(t => { const e = [...document.querySelectorAll('button')].find(e => e.textContent.includes(t) && !e.disabled); e && e.click(); return !!e; }, t);
  console.log('new', await click('新的一局')); await sleep(1200);
  await page.screenshot({ path: path.join(__dirname, 'build/p_intro.png') });
  console.log(await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent.trim()).join(' | ')));
  console.log('fire', await click('开火')); await sleep(1500);
  await page.screenshot({ path: path.join(__dirname, 'build/p_game.png') });
  console.log(await page.evaluate(() => [...document.querySelectorAll('button')].map(b => b.textContent.trim()).join(' | ')));
  await sleep(800);
  const save = await page.evaluate(() => window.__mtStore['cooking-god:v1']);
  fs.writeFileSync(path.join(__dirname, 'build/base.json'), save);
  console.log('saved', save.length);
  await b.close(); srv.close();
})().catch(e => { console.error(e); process.exit(1); });

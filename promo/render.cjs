// 逐帧渲染 video.html → mp4（无声）。用法：node promo/render.cjs [--still 1.0,5.2,...] [--audio]
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, execSync } = require('child_process');
const { chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'));

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(__dirname, 'build');

function serve() {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.wav': 'audio/wav', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
  const srv = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => srv.listen(0, () => r(srv)));
}

(async () => {
  const args = process.argv.slice(2);
  const stillIdx = args.indexOf('--still');
  const stills = stillIdx >= 0 ? args[stillIdx + 1].split(',').map(Number) : null;
  const srv = await serve();
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('console', m => { if (m.type() === 'error') console.log('[page]', m.text()); });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${srv.address().port}/promo/video.html`);
  await page.evaluate(() => window.ready);
  const { END, FPS } = await page.evaluate(() => ({ END: TL.END, FPS: TL.FPS }));

  if (args.includes('--audio')) {
    await page.goto(`http://127.0.0.1:${srv.address().port}/promo/audio.html`);
    for (const bgm of [true, false]) {
      const b64 = await page.evaluate(o => window.mix(o), { bgm });
      const f = path.join(BUILD, bgm ? 'mix_bgm.wav' : 'mix_nobgm.wav');
      fs.writeFileSync(f, Buffer.from(b64, 'base64'));
      console.log(f);
    }
  } else if (stills) {
    fs.mkdirSync(path.join(BUILD, 'stills'), { recursive: true });
    for (const t of stills) {
      await page.evaluate(t => window.render(t), t);
      await page.screenshot({ path: path.join(BUILD, 'stills', `t${t.toFixed(2)}.jpg`), type: 'jpeg', quality: 85 });
    }
  } else {
    const out = path.join(BUILD, 'video_silent.mp4');
    const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(FPS), out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const N = Math.round(END * FPS);
    for (let i = 0; i < N; i++) {
      await page.evaluate(t => window.render(t), i / FPS);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) console.log(`frame ${i}/${N}`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
    console.log(out);
  }
  await browser.close();
  srv.close();
})().catch(e => { console.error(e); process.exit(1); });

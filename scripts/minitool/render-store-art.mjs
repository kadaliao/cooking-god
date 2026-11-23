// 渲染小工具发布用的图标和封面：node scripts/minitool/render-store-art.mjs
// 输出 minitool/store/icon.png（1024×1024）和 cover.jpg（1080×1440，3:4）
import puppeteer from 'puppeteer-core';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--allow-file-access-from-files', '--force-color-profile=srgb'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 2500, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve('minitool/store/store-art.html')).href, { waitUntil: 'networkidle0' });
await page.evaluate(() => document.fonts.ready);
await (await page.$('#icon')).screenshot({ path: 'minitool/store/icon.png' });
await (await page.$('#cover')).screenshot({ path: 'minitool/store/cover.jpg', type: 'jpeg', quality: 88 });
await browser.close();
console.log('minitool/store/icon.png, minitool/store/cover.jpg');

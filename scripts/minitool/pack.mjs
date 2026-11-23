// 小工具打包：检查 dist-minitool 是否符合容器规范，再压成 zip。
//   pnpm build:minitool          （构建 + 本脚本）
// 产物：minitool-release/cooking-god-minitool-<版本>.zip
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

const DIST = 'dist-minitool';
const OUT_DIR = 'minitool-release';
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const ZIP = join(OUT_DIR, `cooking-god-minitool-${version}.zip`);
const ALLOWED = new Set(['.html', '.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.woff', '.woff2', '.json']);

const errors = [];
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative(DIST, p).split('\\').join('/'));
  }
};
walk(DIST);

// 文件类型与目录
const htmls = files.filter((f) => f.endsWith('.html'));
if (htmls.length !== 1 || htmls[0] !== 'index.html') errors.push(`入口必须是根目录唯一的 index.html，实际：${htmls.join(', ')}`);
for (const f of files) {
  if (!ALLOWED.has(extname(f).toLowerCase())) errors.push(`不允许的文件类型：${f}`);
  if (/(^|\/)\./.test(f) || f.endsWith('.map')) errors.push(`不该打进包的文件：${f}`);
}
if (files.some((f) => f.startsWith('assets/') && /\.(js|css|html)$/.test(f))) errors.push('入口 JS/CSS 不能放在 assets/（平台会把 assets/ 里的资源外移）');

// index.html：经典外置脚本、无外链、无内联脚本
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) errors.push('index.html 有内联脚本');
if (/type="module"/i.test(html)) errors.push('index.html 有 module 脚本');
if (/\son[a-z]+="/i.test(html)) errors.push('index.html 有行内事件');
if (/<base\s|<iframe|<object|http-equiv="Content-Security-Policy"/i.test(html)) errors.push('index.html 有 base / iframe / object / 自建 CSP');
if (!/viewport-fit=cover/.test(html)) errors.push('viewport 缺少 viewport-fit=cover');
for (const m of html.matchAll(/\s(?:src|href)="([^"]+)"/g)) {
  const ref = m[1];
  if (/^(https?:)?\/\//.test(ref) || ref.startsWith('/')) errors.push(`index.html 引用了外部或绝对路径：${ref}`);
  else if (!existsSync(join(DIST, ref))) errors.push(`index.html 引用的文件不存在：${ref}`);
}

// JS / CSS：禁用能力扫描
const FORBIDDEN = [
  [/\bfetch\(/, 'fetch'],
  [/new XMLHttpRequest/, 'XMLHttpRequest'],
  [/new WebSocket\(/, 'WebSocket'],
  [/new EventSource\(/, 'EventSource'],
  [/\beval\(/, 'eval'],
  [/new Function\(/, 'new Function'],
  [/WebAssembly\./, 'WebAssembly'],
  // zustand persist 的默认参数会读一下 window.localStorage 属性（随后被我们的容器存储替换），
  // 这里只拦真正的读写调用
  [/(localStorage|sessionStorage)\.(getItem|setItem|removeItem|clear)\(|indexedDB\.open\(|document\.cookie\s*=/, '浏览器存储读写'],
  [/navigator\.(geolocation|clipboard|serviceWorker|getBattery|bluetooth|usb|serial|hid|credentials|locks)/, '禁用的 navigator 能力'],
  [/requestFullscreen/, '全屏 API'],
  [/window\.open\(|window\.prompt\(/, 'window.open / prompt'],
  [/\bimport\(|^\s*import\s|^\s*export\s/m, 'ESM 语法'],
];
for (const f of files.filter((f) => f.endsWith('.js'))) {
  const src = readFileSync(join(DIST, f), 'utf8');
  for (const [re, name] of FORBIDDEN) if (re.test(src)) errors.push(`${f} 里有被禁用的能力：${name}`);
}
for (const f of files.filter((f) => /\.(css|js|html)$/.test(f))) {
  const src = readFileSync(join(DIST, f), 'utf8');
  const ext = src.match(/url\(\s*['"]?(https?:)?\/\/[^)]+\)/);
  if (ext) errors.push(`${f} 里有外部 url()：${ext[0]}`);
  for (const m of src.matchAll(/data:[^;,"')\s]+;base64,([A-Za-z0-9+/=]{1000,})/g)) {
    const bytes = (m[1].length * 3) / 4;
    if (bytes > 100 * 1024) errors.push(`${f} 里有超过 100 KiB 的 Base64（约 ${Math.round(bytes / 1024)} KiB）`);
  }
}

if (errors.length) {
  console.error('小工具产物检查没通过：\n- ' + errors.join('\n- '));
  process.exit(1);
}

// 压缩：进入目录压缩“内容”，保证 index.html 在 zip 根
mkdirSync(OUT_DIR, { recursive: true });
rmSync(ZIP, { force: true });
execFileSync('zip', ['-r', '-X', '-q', join('..', ZIP), '.', '-x', '*.DS_Store'], { cwd: DIST });
const size = statSync(ZIP).size;
const sha = createHash('sha256').update(readFileSync(ZIP)).digest('hex');
const unzipped = files.reduce((n, f) => n + statSync(join(DIST, f)).size, 0);
console.log(`小工具包：${ZIP}`);
console.log(`  ${files.length} 个文件，解压后 ${(unzipped / 1048576).toFixed(2)} MiB，zip ${(size / 1048576).toFixed(2)} MiB`);
console.log(`  sha256 ${sha}`);
if (size > 10 * 1048576) {
  console.error('zip 超过 10 MiB 上限');
  process.exit(1);
}
if (size > 2 * 1048576) console.warn('  提示：zip 超过建议的 2 MiB');

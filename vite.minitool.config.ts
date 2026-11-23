/**
 * 小红书小工具构建：pnpm build:minitool
 *
 * 和网页版共用源码，区别只在产物形态：
 * - 经典脚本（IIFE + defer），不用 type="module"，目标 ES2017 / Chrome 61
 * - 入口 JS/CSS 放在 static/，不占用平台会外移资源的 assets/ 目录
 * - 字体换成只含游戏用字的子集（scripts/minitool/subset-font.py 生成）
 * - index.html 带静态首屏，JS 还没跑起来时也能看到标题和加载状态
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
// @ts-expect-error 纯 JS 构建脚本，没有类型声明
import { compatCss } from './scripts/minitool/css-compat.mjs';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

function minitoolHtml(): Plugin {
  return {
    name: 'minitool-html',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const shell = readFileSync(here('./minitool/shell.html'), 'utf8');
        const out = html
          // 经典脚本：容器里 module 脚本的相对加载不可靠
          .replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, '<script defer src="$1"></script>')
          .replace(/<link rel="stylesheet" crossorigin href=/g, '<link rel="stylesheet" href=')
          // 网页版的图标和主题色在容器里没用
          .replace(/\s*<link rel="icon"[^>]*>/, '')
          .replace(/\s*<meta name="theme-color"[^>]*>/, '')
          .replace(
            'content="width=device-width, initial-scale=1.0, viewport-fit=cover"',
            'content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"',
          )
          .replace('<div id="root"></div>', `<div id="root">${shell}</div>`);
        if (/<script(?![^>]*\bsrc=)[^>]*>/.test(out)) throw new Error('minitool: index.html 里不能有内联脚本');
        if (/type="module"/.test(out)) throw new Error('minitool: index.html 里不能有 module 脚本');
        return out;
      },
    },
  };
}

/** 给最终 CSS 补 Chrome 61 可用的回退写法（见 scripts/minitool/css-compat.mjs） */
function minitoolCss(): Plugin {
  return {
    name: 'minitool-css-compat',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.css')) continue;
        const { css, problems, stats } = compatCss(String(file.source));
        if (problems.length) this.error(`minitool: CSS 里有没法自动回退的写法：\n${problems.join('\n')}`);
        file.source = css;
        this.info(`css-compat ${file.fileName}: ${JSON.stringify(stats)}`);
      }
    },
  };
}

export default defineConfig({
  mode: 'minitool',
  base: './',
  plugins: [react(), minitoolHtml(), minitoolCss()],
  resolve: {
    alias: {
      '@fontsource/zcool-kuaile/400.css': here('./minitool/font.css'),
    },
  },
  build: {
    outDir: 'dist-minitool',
    emptyOutDir: true,
    assetsDir: 'static',
    target: ['es2017', 'chrome61'],
    cssTarget: ['chrome61'],
    modulePreload: false,
    sourcemap: false,
    assetsInlineLimit: 0,
    // 抽出独立 CSS 文件；不拆的话 iife 会把样式塞进 JS 运行时注入，首屏要等 JS
    cssCodeSplit: false,
    rolldownOptions: {
      output: {
        format: 'iife',
        entryFileNames: 'static/app.[hash].js',
        assetFileNames: 'static/[name].[hash][extname]',
      },
    },
  },
});

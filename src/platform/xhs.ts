/**
 * 小红书小工具容器能力（window.xhs.miniTool）。
 *
 * 规则来自小工具在线文档（2026-11-19 版）：
 * - 调用前逐级判空，核对最低客户端版本，再确认方法是函数；版本达标也要处理失败。
 * - buildVersion 末三位是编译序号，比较时去掉（9462004 → 9462，即 9.46.2）。
 * - 版本未知、SDK 缺失或调用失败时，不回退到 localStorage 等浏览器存储。
 * 普通浏览器里 window.xhs 不存在，这里的函数都会安静地返回“不支持”。
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export const IS_MINITOOL = import.meta.env.MODE === 'minitool';

type MiniTool = Record<string, (opts?: any) => Promise<any>>;

export const MIN_VERSION = {
  storage: 9460,
  windowInfo: 9490,
  vibrate: 9500,
  share: 9530,
  keepScreenOn: 9550,
} as const;

function readBuildVersion(launchOptions: any): number | null {
  const value = launchOptions && launchOptions.miniToolEnv && launchOptions.miniToolEnv.buildVersion;
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (!/^[1-9]\d{6,}$/.test(String(value))) return null;
  const v = Number(value);
  return Number.isSafeInteger(v) ? v : null;
}

let buildVersionPromise: Promise<number | null> | null = null;

/** 客户端 buildVersion；拿不到时为 null（版本未知）。 */
export function getBuildVersion(): Promise<number | null> {
  if (buildVersionPromise) return buildVersionPromise;
  buildVersionPromise = (async () => {
    const xhs = (window as any).xhs;
    const sync = readBuildVersion(xhs && xhs.launchOptions);
    if (sync !== null) return sync;
    const miniTool = xhs && xhs.miniTool;
    if (!miniTool || typeof miniTool.getLaunchOptions !== 'function') return null;
    try {
      return readBuildVersion(await miniTool.getLaunchOptions());
    } catch {
      return null;
    }
  })();
  return buildVersionPromise;
}

export function clientVersion(buildVersion: number | null): number | null {
  return buildVersion !== null && buildVersion > 0 ? Math.floor(buildVersion / 1000) : null;
}

/** 版本达标且方法都存在时返回 miniTool，否则 null。 */
export async function miniToolFor(minVersion: number, methods: string[]): Promise<MiniTool | null> {
  const v = clientVersion(await getBuildVersion());
  if (v === null || v < minVersion) return null;
  const miniTool = (window as any).xhs && (window as any).xhs.miniTool;
  if (!miniTool || !methods.every((m) => typeof miniTool[m] === 'function')) return null;
  return miniTool as MiniTool;
}

// ───────── 窗口信息：避让状态栏和右上角胶囊 ─────────

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

const visible = (r: Rect | null | undefined): r is Rect => !!r && r.width > 0 && r.height > 0;

/**
 * 把容器的安全区和顶部按钮换算成 CSS 变量：
 *   --mt-top        顶部按钮所在那一行的上边（没有按钮时为安全区上边）
 *   --mt-nav-h      顶部按钮行的高度（标题和胶囊对齐）
 *   --mt-nav-left / --mt-nav-right   这一行左右两侧要让出的宽度
 *   --mt-bottom     底部安全区高度
 */
function applyWindowInfo(info: any) {
  if (!info || !info.safeArea) return;
  const W = Number(info.windowWidth) || window.innerWidth;
  const H = Number(info.windowHeight) || window.innerHeight;
  const safe: Rect = info.safeArea;
  const buttons = info.menuButtons || {};
  const rects: Rect[] = visible(buttons.capsule) ? [buttons.capsule] : [buttons.back, buttons.me, buttons.share].filter(visible);
  let top = Math.max(0, safe.top || 0);
  let navH = 0;
  let left = 0;
  let right = 0;
  if (rects.length) {
    top = Math.min(...rects.map((r) => r.top));
    navH = Math.max(...rects.map((r) => r.bottom)) - top;
    for (const r of rects) {
      if (r.left + r.width / 2 < W / 2) left = Math.max(left, r.right + 8);
      else right = Math.max(right, W - r.left + 8);
    }
  }
  const root = document.documentElement.style;
  root.setProperty('--mt-top', `${top}px`);
  root.setProperty('--mt-nav-h', `${navH || 30}px`);
  root.setProperty('--mt-nav-left', `${left}px`);
  root.setProperty('--mt-nav-right', `${right}px`);
  root.setProperty('--mt-bottom', `${Math.max(0, H - (safe.bottom || H))}px`);
  document.documentElement.classList.add('mt-window');
}

/** 启动时先用启动参数里的快照排版，再取一次实测值；窗口尺寸变化后重新取。 */
export function setupWindowInfo() {
  const xhs = (window as any).xhs;
  const snapshot = xhs && xhs.launchOptions && xhs.launchOptions.miniToolEnv && xhs.launchOptions.miniToolEnv.windowInfo;
  if (snapshot) applyWindowInfo(snapshot);
  const refresh = async () => {
    const miniTool = await miniToolFor(MIN_VERSION.windowInfo, ['getWindowInfo']);
    if (!miniTool) return;
    try {
      applyWindowInfo(await miniTool.getWindowInfo());
    } catch {
      /* 拿不到就保持 CSS 安全区回退 */
    }
  };
  window.setTimeout(refresh, 0);
  let t: number | undefined;
  window.addEventListener('resize', () => {
    window.clearTimeout(t);
    t = window.setTimeout(refresh, 200);
  });
}

// ───────── 振动、常亮、分享 ─────────

let vibrateOn = true;
let lastVibrate = 0;
export function setVibrateEnabled(on: boolean) {
  vibrateOn = on;
}

/** 触感反馈。限频，避免结算演出里连着震。 */
export function vibrate(type: 'light' | 'medium' | 'heavy' | 'long') {
  if (!IS_MINITOOL || !vibrateOn) return;
  const now = Date.now();
  if (now - lastVibrate < 120) return;
  lastVibrate = now;
  void (async () => {
    const miniTool = await miniToolFor(MIN_VERSION.vibrate, [type === 'long' ? 'vibrateLong' : 'vibrateShort']);
    if (!miniTool) return;
    try {
      if (type === 'long') await miniTool.vibrateLong();
      else await miniTool.vibrateShort({ type });
    } catch {
      /* 设备不支持时忽略 */
    }
  })();
}

export async function canVibrate() {
  return IS_MINITOOL && !!(await miniToolFor(MIN_VERSION.vibrate, ['vibrateShort']));
}

let screenOn: boolean | null = null;
/** 对局中保持屏幕常亮，回到标题时撤销。 */
export function keepScreenOn(on: boolean) {
  if (!IS_MINITOOL || screenOn === on) return;
  screenOn = on;
  void (async () => {
    const miniTool = await miniToolFor(MIN_VERSION.keepScreenOn, ['setKeepScreenOn']);
    if (!miniTool) return;
    try {
      await miniTool.setKeepScreenOn({ keepScreenOn: on });
    } catch {
      /* 旧客户端或会话失效时不影响游戏 */
    }
  })();
}

export async function canShare() {
  return IS_MINITOOL && !!(await miniToolFor(MIN_VERSION.share, ['share']));
}

/** 拉起分享面板分享小工具卡片。返回给用户看的失败原因，成功或用户取消时返回 null。 */
export async function shareCard(): Promise<string | null> {
  const miniTool = await miniToolFor(MIN_VERSION.share, ['share']);
  if (!miniTool) return '当前版本暂不支持分享，请升级小红书 App';
  try {
    await miniTool.share({ type: 'card' });
    return null;
  } catch (e: any) {
    if (e && e.errCode === 15503) return '今天的分享次数用完了，明天再来吧';
    if (e && e.errCode === 15502) return '当前页面暂时无法分享';
    return '分享没有成功，稍后再试';
  }
}

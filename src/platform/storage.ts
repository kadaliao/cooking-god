/**
 * 存档存储。网页版用 localStorage；小工具里用容器 Storage（客户端 9.46+）。
 *
 * 小工具规则（在线文档 §2.4 / §3.7）：
 * - 版本未知、低于 9.46、SDK 缺失、调用失败，都不能改用 localStorage 等浏览器存储。
 *   这时进度只留在内存里，并告诉玩家“没法保存”。
 * - 读取失败不等于没有存档：不能拿默认值覆盖，所以读失败后本次不再写入。
 * - 单个 key 最大 1MB；data 必须是 JSON 字符串（zustand 序列化后的字符串正好是）。
 *
 * 写入做了合并：状态频繁变化时 400ms 内只写最后一次，切到后台时立刻写。
 */
import type { StateStorage } from 'zustand/middleware';
import { IS_MINITOOL, MIN_VERSION, miniToolFor } from './xhs';

export type SaveStatus = 'ok' | 'unsupported' | 'readError' | 'writeError' | 'tooLarge';

let statusHandler: (s: SaveStatus) => void = () => {};
let status: SaveStatus = 'ok';
export function onSaveStatus(fn: (s: SaveStatus) => void) {
  statusHandler = fn;
  if (status !== 'ok') fn(status);
}
function setStatus(s: SaveStatus) {
  if (status === s) return;
  // 读失败 / 不支持是本次会话的最终状态，写失败可以在下一次成功后恢复
  if (status === 'readError' || status === 'unsupported') return;
  status = s;
  statusHandler(s);
}

const MAX_BYTES = 1024 * 1024;
const STORAGE_METHODS = ['getStorage', 'setStorage', 'removeStorage'];

function containerStorage(): StateStorage {
  let canWrite = false;
  const pending = new Map<string, string | null>();
  let timer: number | undefined;
  let chain: Promise<void> = Promise.resolve();

  const flush = () => {
    window.clearTimeout(timer);
    timer = undefined;
    if (!canWrite || pending.size === 0) return chain;
    const batch = Array.from(pending.entries());
    pending.clear();
    chain = chain.then(async () => {
      const miniTool = await miniToolFor(MIN_VERSION.storage, STORAGE_METHODS);
      if (!miniTool) return setStatus('unsupported');
      for (const [key, value] of batch) {
        try {
          if (value === null) {
            await miniTool.removeStorage({ key });
            continue;
          }
          // 按 UTF-8 估算字节数，超过单 key 上限就不写，避免半截存档
          if (value.length * 3 > MAX_BYTES && new Blob([value]).size > MAX_BYTES) {
            setStatus('tooLarge');
            continue;
          }
          const result = await miniTool.setStorage({ key, data: value });
          if (result && result.errMsg === 'setStorage:ok') setStatus('ok');
          else retry(key, value);
        } catch {
          retry(key, value);
        }
      }
    });
    return chain;
  };

  const schedule = (delay = 400) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(flush, delay);
  };
  // 写失败：保留这份数据（期间有更新的就用更新的），3 秒后再试
  const retry = (key: string, value: string | null) => {
    setStatus('writeError');
    if (!pending.has(key)) pending.set(key, value);
    schedule(3000);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  window.addEventListener('pagehide', () => void flush());

  return {
    async getItem(key) {
      const miniTool = await miniToolFor(MIN_VERSION.storage, STORAGE_METHODS);
      if (!miniTool) {
        setStatus('unsupported');
        return null;
      }
      try {
        const res = await miniTool.getStorage({ key });
        canWrite = true;
        return res && typeof res.data === 'string' ? res.data : null;
      } catch {
        setStatus('readError');
        return null;
      }
    },
    setItem(key, value) {
      if (!canWrite) return;
      pending.set(key, value);
      schedule();
    },
    removeItem(key) {
      if (!canWrite) return;
      pending.set(key, null);
      schedule();
    },
  };
}

function browserStorage(): StateStorage {
  return {
    getItem: (key) => {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, value);
      } catch {
        setStatus('writeError');
      }
    },
    removeItem: (key) => {
      try {
        localStorage.removeItem(key);
      } catch {
        /* 忽略 */
      }
    },
  };
}

export const gameStorage: StateStorage = IS_MINITOOL ? containerStorage() : browserStorage();

export const SAVE_STATUS_TEXT: Record<Exclude<SaveStatus, 'ok'>, string> = {
  unsupported: '当前小红书版本无法保存游戏进度，退出后进度会丢失。升级 App 后即可自动存档。',
  readError: '存档读取失败，本次游玩不会覆盖原有进度。请退出后重新打开再试。',
  writeError: '进度保存失败，稍后会自动重试。',
  tooLarge: '存档过大，无法保存这一局的进度。',
};

// 模拟小红书小工具容器（与 scripts/minitool/shots.mjs 一致）：客户端 9.55、右上角胶囊、Storage 存在 window.__mtStore。
// 录制时可以先往 window.__PRELOAD 塞一份存档（JSON 字符串），容器 Storage 读到的就是它。
(() => {
  const store = () => (window.__mtStore = window.__mtStore || (window.__PRELOAD ? { 'cooking-god:v1': window.__PRELOAD } : {}));
  const ok = (api, extra) => Promise.resolve(Object.assign({ errMsg: `${api}:ok` }, extra));
  window.xhs = {
    launchOptions: { miniToolEnv: { buildVersion: 9550001, userDataPath: '/usr' } },
    miniTool: {
      getLaunchOptions: () => ok('getLaunchOptions', { miniToolEnv: { buildVersion: 9550001 } }),
      setStorage: ({ key, data }) => ((store()[key] = data), ok('setStorage')),
      getStorage: ({ key }) => ok('getStorage', { data: key in store() ? store()[key] : null }),
      getStorageInfo: () => ok('getStorageInfo', { keys: Object.keys(store()), usedBytes: 0, limitBytes: 10485760 }),
      removeStorage: ({ key }) => (delete store()[key], ok('removeStorage')),
      clearStorage: () => ok('clearStorage'),
      getWindowInfo: () => {
        const W = window.innerWidth;
        return ok('getWindowInfo', {
          pixelRatio: 3, windowWidth: W, windowHeight: window.innerHeight, statusBarHeight: 47,
          safeArea: { left: 0, top: 47, right: W, bottom: window.innerHeight - 34, width: W, height: window.innerHeight - 81 },
          menuButtons: { capsule: { left: W - 95, top: 51, right: W - 8, bottom: 83, width: 87, height: 32 }, back: null, me: null, share: null },
        });
      },
      vibrateShort: () => ok('vibrateShort'),
      vibrateLong: () => ok('vibrateLong'),
      setKeepScreenOn: () => ok('setKeepScreenOn'),
      share: () => ok('share'),
    },
  };
})();

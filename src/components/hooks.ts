import { useEffect, useMemo, useState } from 'react';
import { previewCook } from '../game/engine/run';
import { useGame } from '../game/state/store';

export function useMediaQuery(q: string) {
  const [m, setM] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(q).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    // 旧版 WebView 的 MediaQueryList 只有 addListener
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', on);
      return () => mq.removeEventListener('change', on);
    }
    mq.addListener(on);
    return () => mq.removeListener(on);
  }, [q]);
  return m;
}

export const useIsMobile = () => useMediaQuery('(max-width: 760px)');

/** 视口宽度（跟随窗口尺寸变化） */
export function useViewportWidth() {
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1024));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

/** 当前锅的预览结算（不改变状态） */
export function usePreview() {
  const run = useGame((s) => s.run);
  return useMemo(() => {
    if (!run || run.phase !== 'playing') return null;
    try {
      return previewCook(run);
    } catch {
      return null;
    }
  }, [run]);
}

/** 当前结算演出的事件 */
export function useAnimEvent() {
  const anim = useGame((s) => s.anim);
  if (!anim || anim.cursor < 0) return { anim, ev: null };
  return { anim, ev: anim.result.events[anim.cursor] };
}

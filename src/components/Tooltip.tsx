import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { create } from 'zustand';

interface TipState {
  content: ReactNode | null;
  rect: DOMRect | null;
  owner: number;
  show(content: ReactNode, rect: DOMRect, owner?: number): void;
  hide(): void;
}

export const useTipStore = create<TipState>((set) => ({
  content: null,
  rect: null,
  owner: 0,
  show: (content, rect, owner = 0) => set({ content, rect, owner }),
  hide: () => set({ content: null, rect: null, owner: 0 }),
}));

let tipIds = 1;

/**
 * 悬停（桌面）或长按（触屏）显示说明。
 * 返回需要展开到目标元素上的事件处理器。
 */
export function useTip(content: () => ReactNode) {
  const timer = useRef<number | undefined>(undefined);
  const longPressed = useRef(false);
  const id = useRef(0);
  if (id.current === 0) id.current = tipIds++;
  const show = (c: ReactNode, r: DOMRect) => useTipStore.getState().show(c, r, id.current);
  const hide = useTipStore((s) => s.hide);
  // 元素卸载（例如弹窗关闭）时，收起属于它的提示
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (useTipStore.getState().owner === id.current) useTipStore.getState().hide();
    },
    [],
  );
  return {
    onMouseEnter: (e: React.MouseEvent) => {
      if (matchMedia('(hover: hover)').matches) show(content(), (e.currentTarget as Element).getBoundingClientRect());
    },
    onMouseLeave: () => hide(),
    onMouseDown: () => hide(),
    onTouchStart: (e: React.TouchEvent) => {
      const el = e.currentTarget as Element;
      longPressed.current = false;
      timer.current = window.setTimeout(() => {
        longPressed.current = true;
        show(content(), el.getBoundingClientRect());
      }, 420);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      window.clearTimeout(timer.current);
      if (longPressed.current) {
        e.preventDefault();
        window.setTimeout(hide, 1600);
      }
    },
    onTouchMove: () => window.clearTimeout(timer.current),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

export function TooltipLayer() {
  const { content, rect } = useTipStore();
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!content || !rect || !ref.current) {
      setPos(null);
      return;
    }
    const tip = ref.current.getBoundingClientRect();
    const margin = 8;
    let left = rect.left + rect.width / 2 - tip.width / 2;
    left = Math.max(margin, Math.min(window.innerWidth - tip.width - margin, left));
    let top = rect.top - tip.height - 10;
    if (top < margin) top = rect.bottom + 10;
    if (top + tip.height > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - tip.height - margin);
    setPos({ left, top });
  }, [content, rect]);

  if (!content) return null;
  return (
    <div
      ref={ref}
      className="tooltip"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
    >
      {content}
    </div>
  );
}

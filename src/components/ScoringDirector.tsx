import { useEffect, useRef } from 'react';
import { burstAt, eventDelay, shake, burst } from '../animations/fx';
import { sfx } from '../audio/sfx';
import { log10 } from '../game/scoring/bignum';
import { useGame } from '../game/state/store';
import type { ScoreEvent } from '../game/types';

export function eventTarget(e: ScoreEvent): Element | null {
  if (e.src.kind === 'tool') return document.querySelector(`[data-tool-uid="${e.src.uid}"]`);
  if (e.cardIndex !== undefined) return document.querySelector(`[data-pot-index="${e.cardIndex}"]`);
  return document.querySelector('[data-fx="score"]');
}

/** 驱动结算演出：按事件日志推进游标，并触发音效与粒子 */
export function ScoringDirector() {
  const anim = useGame((s) => s.anim);
  const speed = useGame((s) => s.settings.speed);
  const advance = useGame((s) => s.advanceAnim);
  const finish = useGame((s) => s.finishAnim);
  const chain = useRef(0);
  const played = useRef<{ result: unknown; cursor: number }>({ result: null, cursor: -1 });

  // 游标变化时播放该事件的音效与特效（跳过时直接播放最终事件）
  useEffect(() => {
    if (!anim || anim.cursor < 0) return;
    if (played.current.result === anim.result && played.current.cursor === anim.cursor) return;
    played.current = { result: anim.result, cursor: anim.cursor };
    play(anim.result.events[anim.cursor], anim.cursor, chain);
  }, [anim]);

  // 定时推进游标
  useEffect(() => {
    if (!anim) return;
    const events = anim.result.events;
    const cursor = anim.cursor;
    if (cursor >= events.length - 1) {
      const t = window.setTimeout(finish, 1500 / speed + 400);
      return () => window.clearTimeout(t);
    }
    const delay = cursor < 0 ? 450 : eventDelay(events[cursor].kind, cursor, speed);
    const t = window.setTimeout(() => advance(cursor + 1), delay);
    return () => window.clearTimeout(t);
  }, [anim, speed, advance, finish]);

  return null;
}

function play(e: ScoreEvent, i: number, chain: React.MutableRefObject<number>) {
  if (i === 0) chain.current = 0;
  const el = () => eventTarget(e);
  switch (e.kind) {
    case 'chips':
      chain.current++;
      sfx.chip(chain.current);
      requestAnimationFrame(() => burstAt(el(), { count: 8, colors: ['#4ea8de', '#ffffff'], power: 3 }));
      break;
    case 'mult':
      chain.current++;
      sfx.mult(chain.current);
      requestAnimationFrame(() => burstAt(el(), { count: 10, colors: ['#ff595e', '#ffca3a'], power: 3.5 }));
      break;
    case 'xmult': {
      chain.current += 2;
      sfx.xmult(chain.current);
      const f = e.amount ?? 1;
      if (f < 1) {
        shake(2);
        break;
      }
      shake(f >= 4 ? 3 : f >= 2 ? 2 : 1);
      requestAnimationFrame(() =>
        burstAt(el(), { count: 18 + Math.min(40, f * 6), colors: ['#ff006e', '#ffbe0b', '#fb5607', '#ffffff'], power: 6 }),
      );
      break;
    }
    case 'technique':
      sfx.technique();
      break;
    case 'retrigger':
      sfx.retrigger();
      break;
    case 'gold':
      sfx.coin();
      break;
    case 'growth':
      sfx.mult(chain.current);
      break;
    case 'final': {
      const mag = log10(e.chips) + log10(e.mult);
      sfx.final(mag >= 5 ? 1 : 0);
      shake(mag >= 7 ? 4 : mag >= 5 ? 3 : mag >= 3.5 ? 2 : 1);
      const scoreEl = document.querySelector('[data-fx="final"]') ?? document.querySelector('[data-fx="score"]');
      requestAnimationFrame(() => {
        burstAt(scoreEl, { count: Math.min(200, 30 + mag * 20), power: 7 + mag, gravity: true });
        if (mag >= 6) {
          const w = window.innerWidth;
          for (let k = 0; k < 5; k++)
            window.setTimeout(() => burst(w * (0.15 + 0.175 * k), window.innerHeight * 0.3, { count: 60, power: 9, gravity: true }), k * 120);
        }
      });
      break;
    }
  }
}

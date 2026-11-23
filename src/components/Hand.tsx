import { AnimatePresence, motion } from 'motion/react';
import { cardByUid, clearPot, discard as discardAction, sortHand, togglePot } from '../game/engine/run';
import { useGame } from '../game/state/store';
import { sfx } from '../audio/sfx';
import { IngredientCard } from './IngredientCard';
import { useIsMobile, useViewportWidth } from './hooks';

export function Hand() {
  const run = useGame((s) => s.run)!;
  const anim = useGame((s) => s.anim);
  const act = useGame((s) => s.act);
  const mobile = useIsMobile();
  const cards = run.hand.filter((u) => !run.pot.includes(u)).map((u) => cardByUid(run, u));
  const n = cards.length;
  // 手机上 8 张牌一行放不下：按屏宽算叠放量，让所有牌都露出一截可以点，不用横向滑动
  const vw = useViewportWidth();
  const CARD_W = 72;
  const GAP = 3;
  const overlap = mobile && n > 1 ? Math.max(0, (n * CARD_W + (n - 1) * GAP - (vw - 16)) / (n - 1)) : 0;

  return (
    <section className={`hand ${anim ? 'locked' : ''}`} data-tut="hand">
      <div className="hand-cards">
        <AnimatePresence mode="popLayout">
          {cards.map((c, i) => {
            const mid = (n - 1) / 2;
            const rot = mobile ? 0 : (i - mid) * 2.2;
            const lift = mobile ? 0 : Math.abs(i - mid) * 3;
            return (
              <motion.div
                key={c.uid}
                layoutId={`card-${c.uid}`}
                className="hand-slot"
                style={overlap && i > 0 ? { marginLeft: -overlap } : undefined}
                initial={{ opacity: 0, y: 80, rotate: 0 }}
                animate={{ opacity: 1, y: lift, rotate: rot }}
                exit={{ opacity: 0, y: 60 }}
                whileHover={anim ? undefined : { y: lift - 14, rotate: 0, scale: 1.06, zIndex: 10 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30, delay: anim ? 0 : 0 }}
              >
                <IngredientCard
                  card={c}
                  size={mobile ? 'sm' : 'md'}
                  onClick={() => {
                    if (anim) return;
                    if (act((s) => togglePot(s, c.uid))) sfx.select();
                  }}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="hand-meta">
        <span className="muted small">
          牌堆 {run.drawPile.length} · 弃牌堆 {run.discardPile.length}
        </span>
        <div className="sort-btns">
          <button className="btn btn-mini" onClick={() => act((s) => sortHand(s, 'type'), 'click')}>
            按类型
          </button>
          <button className="btn btn-mini" onClick={() => act((s) => sortHand(s, 'chips'), 'click')}>
            按筹码
          </button>
          {run.pot.length > 0 && (
            <button className="btn btn-mini" onClick={() => act(clearPot, 'deselect')}>
              清空锅
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export function Actions() {
  const run = useGame((s) => s.run)!;
  const anim = useGame((s) => s.anim);
  const act = useGame((s) => s.act);
  const cook = useGame((s) => s.cook);
  const ls = run.levelState;
  const canCook = !anim && run.pot.length > 0 && run.phase === 'playing';
  return (
    <div className="actions" data-tut="actions">
      <button
        className="btn btn-discard"
        disabled={!canCook || ls.discardsLeft <= 0}
        onClick={() => act((s) => (s.pot.length ? discardAction(s) : s), 'deselect')}
        title="弃掉锅中选中的食材，换新的"
      >
        弃牌 <span className="btn-count">{ls.discardsLeft}</span>
      </button>
      <motion.button
        className="btn btn-cook"
        disabled={!canCook}
        onClick={cook}
        whileTap={{ scale: 0.94 }}
        animate={canCook ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={canCook ? { repeat: Infinity, duration: 1.6 } : undefined}
      >
        🔥 开始烹饪 <span className="btn-count">{ls.cooksLeft}</span>
      </motion.button>
    </div>
  );
}


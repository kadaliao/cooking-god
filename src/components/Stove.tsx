import { AnimatePresence, Reorder, motion } from 'motion/react';
import { useRef } from 'react';
import { TECHNIQUES } from '../game/data/techniques';
import { cardByUid, maxSelect, setPotOrder, togglePot } from '../game/engine/run';
import { format, log10 } from '../game/scoring/bignum';
import { buildPot } from '../game/scoring/recipeMatch';
import { useGame } from '../game/state/store';
import type { Tag } from '../game/types';
import { art } from './art';
import { useAnimEvent, usePreview } from './hooks';
import { IngredientCard } from './IngredientCard';
import { sfx } from '../audio/sfx';

function finalTier(mag: number, ratio: number): { text: string; cls: string } | null {
  if (mag >= 9) return { text: '宇宙级料理！！！', cls: 'tier-5' };
  if (mag >= 7) return { text: '神之一手！！', cls: 'tier-4' };
  if (mag >= 5.5) return { text: '惊天美味！', cls: 'tier-3' };
  if (ratio >= 1) return { text: '一锅定音！', cls: 'tier-2' };
  if (mag >= 3) return { text: '好香！', cls: 'tier-1' };
  return null;
}

export function Stove() {
  const run = useGame((s) => s.run)!;
  const act = useGame((s) => s.act);
  const preview = usePreview();
  const { anim, ev } = useAnimEvent();
  const dragging = useRef(false);

  const cards = anim ? anim.cards : run.pot.map((u) => cardByUid(run, u));
  const tools = anim ? anim.tools : run.tools;
  const result = anim ? anim.result : preview;
  const disabled = new Set(result?.disabledIndexes ?? []);
  const techs = result?.techniques ?? [];
  const pot = cards.length ? buildPot(cards, tools, undefined) : [];
  const activeIdx = ev?.cardIndex;
  const slots = Math.max(0, maxSelect(run) - cards.length);
  const isFinal = ev?.kind === 'final';
  const finalScore = anim?.result.score;
  const mag = finalScore ? log10(finalScore) : 0;
  const ratio = finalScore ? Math.pow(10, mag - log10(run.levelState.target)) : 0;
  const tier = isFinal ? finalTier(mag, ratio) : null;

  return (
    <section className={`stove ${anim ? 'cooking' : ''}`} data-tut="pot">
      <img className="wok-img" src={art('scene/wok')} alt="" draggable={false} />
      {anim && <div className="flames" />}
      {cards.length === 0 && (
        <div className="pot-empty">
          <div>点击下方食材放入锅中</div>
          <div className="muted">最多 {maxSelect(run)} 张 · 放入的顺序就是下锅顺序</div>
        </div>
      )}
      <Reorder.Group
        axis="x"
        values={anim ? cards.map((c) => c.uid) : run.pot}
        onReorder={(order) => {
          if (!anim) act((s) => setPotOrder(s, order));
        }}
        className="pot-row"
      >
        {cards.map((c, i) => {
          const extra = pot[i] ? ([...pot[i].tags] as Tag[]) : undefined;
          const cardTechs = techs.filter((t) => t.index === i);
          const showLabel = ev && activeIdx === i && ev.src.kind !== 'tool' && ev.kind !== 'cardStart';
          return (
            <Reorder.Item
              key={c.uid}
              value={c.uid}
              dragListener={!anim}
              className="pot-slot"
              data-pot-index={i}
              onDragStart={() => (dragging.current = true)}
              onDragEnd={() => window.setTimeout(() => (dragging.current = false), 50)}
              whileDrag={{ scale: 1.08, zIndex: 5 }}
            >
              {i > 0 && <span className="pot-arrow">➜</span>}
              <motion.div
                layoutId={anim ? undefined : `card-${c.uid}`}
                animate={
                  activeIdx === i
                    ? { y: -18, scale: 1.08, rotate: ev?.kind === 'xmult' ? [0, -6, 6, 0] : 0 }
                    : { y: 0, scale: 1, rotate: 0 }
                }
                transition={{ type: 'spring', stiffness: 500, damping: 22 }}
              >
                <IngredientCard
                  card={c}
                  size="lg"
                  order={i + 1}
                  disabled={disabled.has(i)}
                  active={activeIdx === i}
                  extraTags={extra}
                  onClick={() => {
                    if (anim || dragging.current) return;
                    sfx.deselect();
                    act((s) => togglePot(s, c.uid));
                  }}
                />
              </motion.div>
              <div className="pot-techs">
                {cardTechs.map((t) => (
                  <span key={t.id} className="tech-badge" title={TECHNIQUES[t.id].desc}>
                    {TECHNIQUES[t.id].name}
                  </span>
                ))}
              </div>
              <AnimatePresence>
                {showLabel && (
                  <motion.div
                    key={anim!.cursor}
                    className={`float-label kind-${ev!.kind}`}
                    initial={{ opacity: 0, y: 10, scale: 0.5 }}
                    animate={{ opacity: 1, y: -6, scale: ev!.kind === 'xmult' ? 1.25 : 1 }}
                    exit={{ opacity: 0, y: -24 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 20 }}
                  >
                    {ev!.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </Reorder.Item>
          );
        })}
        {!anim &&
          Array.from({ length: slots }).map((_, i) => (
            <div key={`empty${i}`} className="pot-slot ghost">
              {(cards.length > 0 || i > 0) && <span className="pot-arrow faint">➜</span>}
              <div className="ghost-card">{cards.length + i + 1}</div>
            </div>
          ))}
      </Reorder.Group>
      {cards.length > 1 && !anim && <div className="pot-hint">↔ 拖动食材调整下锅顺序</div>}

      <AnimatePresence>
        {isFinal && finalScore && (
          <motion.div
            className={`final-pop ${tier?.cls ?? ''}`}
            data-fx="final"
            initial={{ scale: 0.2, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 1.4 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          >
            {tier && <div className="final-tier">{tier.text}</div>}
            <div className="final-score">+{format(finalScore)}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

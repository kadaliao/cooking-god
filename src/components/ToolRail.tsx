import { AnimatePresence, Reorder, motion } from 'motion/react';
import { RULES } from '../game/data/levels';
import { TOOLS } from '../game/data/tools';
import { reorderTools } from '../game/engine/shop';
import { copyTargetOf } from '../game/effects/dispatch';
import { useGame } from '../game/state/store';
import { ToolCard } from './ToolCard';
import { useAnimEvent, useIsMobile } from './hooks';

export function ToolRail({ onToolClick }: { onToolClick?: (uid: string) => void }) {
  const run = useGame((s) => s.run)!;
  const act = useGame((s) => s.act);
  const { anim, ev } = useAnimEvent();
  const mobile = useIsMobile();
  const tools = anim ? anim.tools : run.tools;
  const activeUid = ev?.src.kind === 'tool' ? ev.src.uid : undefined;
  const locked = !!anim;

  return (
    <aside className="toolrail">
      <div className="rail-head">
        <span>厨具与技能</span>
        <span className="muted">
          {tools.length}/{RULES.toolSlots}
        </span>
      </div>
      {tools.length === 0 && <div className="rail-empty">过关后在商店购买厨具。厨具会在烹饪时自动触发。</div>}
      <Reorder.Group
        axis={mobile ? 'x' : 'y'}
        values={tools.map((t) => t.uid)}
        onReorder={(order) => !locked && act((s) => reorderTools(s, order))}
        className="rail-list"
      >
        {tools.map((t, i) => {
          const copy = TOOLS[t.defId].copiesLeft ? copyTargetOf(tools, t.uid) : undefined;
          return (
            <Reorder.Item key={t.uid} value={t.uid} dragListener={!locked} className="rail-item" data-tool-uid={t.uid}>
              <span className="rail-order">{i + 1}</span>
              <ToolCard
                defId={t.defId}
                inst={t}
                active={activeUid === t.uid}
                compact={mobile}
                copyName={copy ? TOOLS[copy.defId].name : undefined}
                onClick={() => onToolClick?.(t.uid)}
              />
              <AnimatePresence>
                {activeUid === t.uid && ev && (
                  <motion.div
                    key={anim!.cursor}
                    className={`float-label tool-label kind-${ev.kind}`}
                    initial={{ opacity: 0, x: -10, scale: 0.6 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    {ev.text}
                  </motion.div>
                )}
              </AnimatePresence>
            </Reorder.Item>
          );
        })}
      </Reorder.Group>
      {tools.length > 1 && <div className="rail-hint">⇅ 拖动调整触发顺序（从上到下依次触发）</div>}
    </aside>
  );
}

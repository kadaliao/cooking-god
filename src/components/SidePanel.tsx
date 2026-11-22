import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef } from 'react';
import { BOSSES } from '../game/data/bosses';
import { RECIPES, recipeBase } from '../game/data/recipes';
import { TECHNIQUES } from '../game/data/techniques';
import { TOOLS } from '../game/data/tools';
import { currentBossId } from '../game/engine/run';
import { format, gte, add } from '../game/scoring/bignum';
import { useGame } from '../game/state/store';
import type { ScoreEvent } from '../game/types';
import { dishArt } from './art';
import { useAnimEvent, usePreview } from './hooks';

const KIND_ICON: Record<string, string> = {
  recipe: '📜',
  chips: '🔵',
  mult: '🔴',
  xmult: '✖️',
  gold: '💰',
  retrigger: '🔁',
  technique: '🥢',
  growth: '📈',
  disabled: '🚫',
  note: '💬',
  final: '🍽️',
};

function srcName(e: ScoreEvent, toolsById: Record<string, string>): string {
  switch (e.src.kind) {
    case 'tool':
      return toolsById[e.src.uid] ?? TOOLS[e.src.defId]?.name ?? '';
    case 'technique':
      return '';
    case 'boss':
      return BOSSES[e.src.id]?.name ?? 'Boss';
    default:
      return '';
  }
}

function ChipsMult({ chips, mult, bumpKey, kind }: { chips: string; mult: string; bumpKey: number; kind?: string }) {
  return (
    <div className="cm-row" data-fx="score">
      <motion.div
        key={`c${kind === 'chips' || kind === 'recipe' ? bumpKey : 'x'}`}
        className="cm-box chips"
        initial={{ scale: 1.25 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 15 }}
      >
        {chips}
      </motion.div>
      <span className="cm-x">×</span>
      <motion.div
        key={`m${kind === 'mult' || kind === 'xmult' || kind === 'recipe' ? bumpKey : 'x'}`}
        className={`cm-box mult ${kind === 'xmult' ? 'xflash' : ''}`}
        initial={{ scale: kind === 'xmult' ? 1.6 : 1.25 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 12 }}
      >
        {mult}
      </motion.div>
    </div>
  );
}

export function SidePanel() {
  const run = useGame((s) => s.run)!;
  const preview = usePreview();
  const { anim, ev } = useAnimEvent();
  const logRef = useRef<HTMLDivElement>(null);
  const bossId = currentBossId(run);
  const boss = bossId ? BOSSES[bossId] : undefined;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' });
  }, [anim?.cursor]);

  if (anim) {
    const r = anim.result;
    const recipe = RECIPES[r.recipeId];
    const shown = r.events.slice(0, anim.cursor + 1).filter((e) => e.kind !== 'cardStart');
    const toolsById = Object.fromEntries(anim.tools.map((t) => [t.uid, TOOLS[t.defId].name]));
    const chips = ev ? format(ev.chips) : '0';
    const mult = ev ? format(ev.mult, { decimals: 2 }) : '0';
    return (
      <aside className="sidepanel scoring">
        <div className="recipe-head">
          <motion.img
            className="dish"
            src={dishArt(recipe.id)}
            alt=""
            initial={{ scale: 0, rotate: -30 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          />
          <div>
            <div className="recipe-name">{recipe.name}</div>
            <div className="muted">Lv.{r.recipeLevel}</div>
          </div>
        </div>
        <ChipsMult chips={chips} mult={mult} bumpKey={anim.cursor} kind={ev?.kind} />
        <div className="event-log" ref={logRef}>
          <AnimatePresence initial={false}>
            {shown.map((e, i) => (
              <motion.div
                key={i}
                className={`log-line kind-${e.kind}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.15 }}
              >
                <span className="log-icon">{KIND_ICON[e.kind] ?? '·'}</span>
                {srcName(e, toolsById) && <b className="log-src">{srcName(e, toolsById)}</b>}
                <span>{e.kind === 'final' ? `出锅！${format(r.chips)} × ${format(r.mult, { decimals: 2 })} = ${format(r.score)}` : e.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <SkipButton />
      </aside>
    );
  }

  if (!preview) {
    return (
      <aside className="sidepanel" data-tut="preview">
        <div className="panel-title">料理预览</div>
        <div className="muted small">选好食材后，这里会显示匹配的料理、技法与预估得分。</div>
        {boss && (
          <div className="boss-reminder">
            <b>{boss.name}</b>
            {boss.rules.map((r) => (
              <div key={r}>· {r}</div>
            ))}
          </div>
        )}
        <div className="tips">
          <div>💡 高级料理基础倍率更高</div>
          <div>💡 顺序会触发烹饪技法：香料→肉 = 爆炒</div>
          <div>💡 长按/悬停卡牌查看详细效果</div>
        </div>
      </aside>
    );
  }

  const recipe = RECIPES[preview.recipeId];
  const base = recipeBase(recipe, preview.recipeLevel);
  const enough = gte(add(run.levelState.score, preview.score), run.levelState.target);
  const usedBefore = bossId === 'pickyGourmet' && run.levelState.usedRecipes.includes(recipe.id);
  return (
    <aside className="sidepanel" data-tut="preview">
      <div className="panel-title">料理预览</div>
      <div className="recipe-head">
        <img className="dish" src={dishArt(recipe.id)} alt="" />
        <div>
          <div className="recipe-name">{recipe.name}</div>
          <div className="muted small">
            Lv.{preview.recipeLevel} · {recipe.condition}
          </div>
        </div>
      </div>
      <div className="base-line">
        基础 <span className="chips-text">{base.chips}</span> × <span className="mult-text">{base.mult}</span>
      </div>
      {preview.techniques.length > 0 && (
        <div className="tech-list">
          {preview.techniques.map((t) => (
            <div key={`${t.id}${t.index}`} className="tech-line">
              🥢 <b>{TECHNIQUES[t.id].name}</b> <span className="muted">{TECHNIQUES[t.id].desc}</span>
            </div>
          ))}
        </div>
      )}
      {preview.disabledIndexes.length > 0 && <div className="warn">🚫 有 {preview.disabledIndexes.length} 张食材被 Boss 判定无效</div>}
      {usedBefore && <div className="warn">⚠️ 这道菜本关已经做过，美食家只给 25% 分数</div>}
      <div className="estimate">
        <div className="muted small">预估得分</div>
        <div className="estimate-num">
          {format(preview.chips)} × {format(preview.mult, { decimals: 2 })} =<b>{format(preview.score)}</b>
        </div>
        {enough && <div className="enough">✔ 这一锅就能过关！</div>}
      </div>
    </aside>
  );
}

function SkipButton() {
  const anim = useGame((s) => s.anim);
  const advance = useGame((s) => s.advanceAnim);
  const finish = useGame((s) => s.finishAnim);
  if (!anim) return null;
  const atEnd = anim.cursor >= anim.result.events.length - 1;
  return (
    <button
      className="btn btn-ghost skip"
      onClick={() => (atEnd ? finish() : advance(anim.result.events.length - 1))}
    >
      {atEnd ? '继续 ▶' : '跳过演出 ⏭'}
    </button>
  );
}

import { motion } from 'motion/react';
import { BOSSES } from '../game/data/bosses';
import { levelInfo } from '../game/data/levels';
import { add, format, formatCn, log10, toNumber } from '../game/scoring/bignum';
import { useGame } from '../game/state/store';

export function TopBar() {
  const run = useGame((s) => s.run)!;
  const anim = useGame((s) => s.anim);
  const setModal = useGame((s) => s.setModal);
  const info = levelInfo(run.level);
  const ls = run.levelState;
  const finalShown = anim && anim.result.events[anim.cursor]?.kind === 'final';
  const shownScore = anim ? (finalShown ? add(anim.scoreBefore, anim.result.score) : anim.scoreBefore) : ls.score;
  const ratio = Math.min(1, toNumber(shownScore) / Math.max(1, toNumber(ls.target)));
  const boss = info.bossId ? BOSSES[info.bossId] : undefined;
  return (
    <header className="topbar">
      <div className="tb-level">
        <div className="tb-chapter">{run.endless ? '无尽模式' : `第 ${info.chapter} 章 · 第 ${info.level} 关`}</div>
        <div className="tb-name">
          {boss ? <span className="boss-tag">BOSS · {boss.name}</span> : info.name}
        </div>
      </div>
      <div className="tb-score" data-fx="level-score">
        <div className="tb-score-row">
          <span className="tb-label">本关</span>
          <motion.span key={format(shownScore)} className="tb-score-num" initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
            {format(shownScore)}
          </motion.span>
          <span className="tb-label">/ 目标</span>
          <span className="tb-target" title={formatCn(ls.target)}>
            {format(ls.target)}
          </span>
        </div>
        <div className="progress">
          <motion.div className="progress-fill" animate={{ width: `${ratio * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 18 }} />
          {log10(shownScore) >= log10(ls.target) && <div className="progress-done">达成！</div>}
        </div>
      </div>
      <div className="tb-stats">
        <div className="stat" title="剩余烹饪次数">
          <span className="stat-icon">🍳</span>
          <b>{ls.cooksLeft}</b>
        </div>
        <div className="stat" title="剩余弃牌次数">
          <span className="stat-icon">🗑️</span>
          <b>{ls.discardsLeft}</b>
        </div>
        <div className="stat gold" title="金币">
          <span className="stat-icon">💰</span>
          <b>${run.gold}</b>
        </div>
      </div>
      <div className="tb-buttons">
        <button className="icon-btn" onClick={() => setModal('deck')} title="查看卡组">
          🧺<span>{run.deck.length}</span>
        </button>
        <button className="icon-btn" onClick={() => setModal('rules')} title="规则与图鉴">
          📖
        </button>
        <button className="icon-btn" onClick={() => setModal('settings')} title="设置">
          ⚙️
        </button>
      </div>
    </header>
  );
}

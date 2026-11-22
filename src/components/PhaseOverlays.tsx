import { motion } from 'motion/react';
import { useEffect } from 'react';
import { burst } from '../animations/fx';
import { BOSSES } from '../game/data/bosses';
import { levelInfo } from '../game/data/levels';
import { RECIPES } from '../game/data/recipes';
import { TOOLS } from '../game/data/tools';
import { collectReward, continueEndless, startLevel } from '../game/engine/run';
import { format, formatCn } from '../game/scoring/bignum';
import { useGame } from '../game/state/store';
import type { RunState } from '../game/types';
import { art, bossArt, dishArt, toolArt } from './art';
import { Modal } from './Modal';

export function LevelIntro() {
  const run = useGame((s) => s.run)!;
  const act = useGame((s) => s.act);
  const info = levelInfo(run.level);
  const boss = info.bossId ? BOSSES[info.bossId] : undefined;
  return (
    <Modal className={`level-intro ${boss ? 'boss' : ''}`}>
      <div className="intro-chapter">{run.endless ? '无尽模式' : `第 ${info.chapter} 章 · 第 ${info.stage} 关`}</div>
      <h2>{info.name}</h2>
      {boss ? (
        <div className="boss-card">
          <motion.img
            src={bossArt(boss.id)}
            alt=""
            initial={{ scale: 0.6, rotate: -6, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
          />
          <div>
            <div className="boss-name">{boss.name}</div>
            <div className="boss-quote">{boss.quote}</div>
            <div className="boss-rules">
              <b>特殊规则</b>
              {boss.rules.map((r) => (
                <div key={r}>⚠️ {r}</div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <img className="intro-mascot" src={art('scene/mascot')} alt="" />
      )}
      <div className="intro-target">
        目标分数 <b>{format(run.levelState.target)}</b>
        {run.levelState.target.e >= 4 && <span className="muted">（{formatCn(run.levelState.target)}）</span>}
      </div>
      <div className="intro-limits">
        🍳 烹饪 {run.levelState.cooksLeft} 次 · 🗑️ 弃牌 {run.levelState.discardsLeft} 次
      </div>
      <button className="btn btn-primary big" onClick={() => act(startLevel, 'buy')} autoFocus>
        开火！
      </button>
    </Modal>
  );
}

export function LevelWon() {
  const run = useGame((s) => s.run)!;
  const act = useGame((s) => s.act);
  const r = run.reward!;
  useEffect(() => {
    burst(window.innerWidth / 2, window.innerHeight / 3, { count: 120, power: 10, gravity: true });
  }, []);
  const isFinal = run.level === 9 && !run.endless;
  return (
    <Modal className="level-won">
      <h2>🎉 过关！</h2>
      <div className="won-score">
        本关得分 <b>{format(run.levelState.score)}</b> / {format(run.levelState.target)}
      </div>
      <div className="reward-table">
        <div>
          <span>过关奖励</span>
          <b>${r.base}</b>
        </div>
        <div>
          <span>剩余烹饪 × {run.levelState.cooksLeft}</span>
          <b>${r.cooksBonus}</b>
        </div>
        <div>
          <span>利息（每 $5 得 $1，最多 $5）</span>
          <b>${r.interest}</b>
        </div>
        <div className="total">
          <span>合计</span>
          <b>+${r.total}</b>
        </div>
      </div>
      <button className="btn btn-primary big" onClick={() => act(collectReward, 'coin')} autoFocus>
        {isFinal ? '领取奖励 · 迎接终局' : '领取奖励 · 去商店'}
      </button>
    </Modal>
  );
}

function Stats({ run }: { run: RunState }) {
  const fav = Object.entries(run.stats.recipeCounts).sort((a, b) => b[1] - a[1])[0];
  const minutes = Math.max(1, Math.round((Date.now() - run.stats.startedAt) / 60000));
  return (
    <div className="stats-grid">
      <div>
        <span>到达关卡</span>
        <b>{run.level}</b>
      </div>
      <div>
        <span>最高单次得分</span>
        <b>{format(run.stats.bestCook)}</b>
      </div>
      <div>
        <span>最强一锅</span>
        <b>{run.stats.bestCookRecipe ? RECIPES[run.stats.bestCookRecipe].name : '—'}</b>
      </div>
      <div>
        <span>累计得分</span>
        <b>{format(run.stats.totalScore)}</b>
      </div>
      <div>
        <span>最常做的菜</span>
        <b>{fav ? `${RECIPES[fav[0]].name} ×${fav[1]}` : '—'}</b>
      </div>
      <div>
        <span>最大单次乘算</span>
        <b>×{run.stats.biggestXMult}</b>
      </div>
      <div>
        <span>烹饪 / 弃牌</span>
        <b>
          {run.stats.cooks} / {run.stats.discards}
        </b>
      </div>
      <div>
        <span>赚取金币</span>
        <b>${run.stats.goldEarned}</b>
      </div>
      <div>
        <span>用时</span>
        <b>{minutes} 分钟</b>
      </div>
      <div>
        <span>种子</span>
        <b className="mono">{run.seed}</b>
      </div>
      <div className="stats-tools">
        {run.tools.map((t) => (
          <img key={t.uid} src={toolArt(t.defId)} alt={TOOLS[t.defId].name} title={TOOLS[t.defId].name} />
        ))}
      </div>
    </div>
  );
}

export function GameOver() {
  const run = useGame((s) => s.run)!;
  const newRun = useGame((s) => s.newRun);
  const abandon = useGame((s) => s.abandonRun);
  return (
    <Modal className="game-over" wide>
      <h2>😵 料理失败……</h2>
      <div className="muted">
        第 {run.level} 关得分 {format(run.levelState.score)}，目标 {format(run.levelState.target)}。
        {run.lastResult && <> 最后一锅：{RECIPES[run.lastResult.recipeId].name}</>}
      </div>
      <Stats run={run} />
      <div className="row-btns">
        <button className="btn btn-primary big" onClick={() => newRun()} autoFocus>
          再来一局
        </button>
        <button className="btn" onClick={() => newRun(run.seed)}>
          同种子重开
        </button>
        <button className="btn btn-ghost" onClick={abandon}>
          回到标题
        </button>
      </div>
    </Modal>
  );
}

export function Victory() {
  const run = useGame((s) => s.run)!;
  const act = useGame((s) => s.act);
  const newRun = useGame((s) => s.newRun);
  const abandon = useGame((s) => s.abandonRun);
  useEffect(() => {
    const w = window.innerWidth;
    for (let k = 0; k < 8; k++)
      window.setTimeout(
        () => burst(w * Math.random(), window.innerHeight * (0.2 + Math.random() * 0.3), { count: 80, power: 10, gravity: true }),
        k * 250,
      );
  }, []);
  return (
    <Modal className="victory" wide>
      <motion.img
        className="victory-god"
        src={bossArt('foodGod')}
        alt=""
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      />
      <h2>👑 你成为了料理之神！</h2>
      <div className="muted">终极食神放下了金勺：「……再来一碗。」</div>
      <img className="victory-dish" src={dishArt(run.stats.bestCookRecipe ?? 'hotpot')} alt="" />
      <Stats run={run} />
      <div className="row-btns">
        <button className="btn btn-primary big" onClick={() => act(continueEndless, 'buy')}>
          继续无尽模式 ∞
        </button>
        <button className="btn" onClick={() => newRun()}>
          新的一局
        </button>
        <button className="btn btn-ghost" onClick={abandon}>
          回到标题
        </button>
      </div>
    </Modal>
  );
}

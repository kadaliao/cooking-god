import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { INGREDIENT_LIST } from '../game/data/ingredients';
import { levelInfo } from '../game/data/levels';
import { format } from '../game/scoring/bignum';
import { useGame } from '../game/state/store';
import { art, ingredientArt } from './art';
import { SAVE_STATUS_TEXT } from '../platform/storage';
import { IS_MINITOOL } from '../platform/xhs';

export function TitleScreen() {
  const run = useGame((s) => s.run);
  const records = useGame((s) => s.records);
  const newRun = useGame((s) => s.newRun);
  const cont = useGame((s) => s.continueRun);
  const setModal = useGame((s) => s.setModal);
  const saveStatus = useGame((s) => s.saveStatus);
  const [seed, setSeed] = useState('');
  const [showSeed, setShowSeed] = useState(false);
  const canContinue = run && run.phase !== 'gameOver';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !showSeed) (canContinue ? cont : () => newRun())();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canContinue, cont, newRun, showSeed]);

  const floaters = INGREDIENT_LIST.filter((_, i) => i % 3 === 0);
  return (
    <div className="title-screen">
      <div className="title-floaters" aria-hidden>
        {floaters.map((d, i) => (
          <motion.img
            key={d.id}
            src={ingredientArt(d.id)}
            alt=""
            style={{ left: `${(i * 97) % 100}%`, width: 64 + (i % 3) * 16 }}
            initial={{ y: '110vh', rotate: 0 }}
            animate={{ y: '-20vh', rotate: 360 * (i % 2 ? 1 : -1) }}
            transition={{ duration: 14 + (i % 5) * 3, repeat: Infinity, delay: i * 1.3, ease: 'linear' }}
          />
        ))}
      </div>
      <motion.img
        className="title-mascot"
        src={art('scene/mascot')}
        alt=""
        animate={{ y: [0, -14, 0], rotate: [0, 2, 0, -2, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.h1 className="logo" initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12 }}>
        料理之神
        <small>COOKING GOD</small>
      </motion.h1>
      <div className="title-sub">抽食材 · 排顺序 · 连锁乘算 · 爆分出锅</div>
      <div className="title-menu">
        {canContinue && (
          <button className="btn btn-primary big" onClick={cont}>
            继续游戏 <span className="small">（{levelInfo(run!.level).name} · ${run!.gold}）</span>
          </button>
        )}
        <button className={`btn ${canContinue ? '' : 'btn-primary'} big`} onClick={() => newRun()}>
          新的一局
        </button>
        {/* 指定种子开局只在网页版提供；小工具面向普通玩家，不露出这个概念 */}
        {IS_MINITOOL ? null : showSeed ? (
          <form
            className="seed-form"
            onSubmit={(e) => {
              e.preventDefault();
              newRun(seed.trim() || undefined);
            }}
          >
            <input autoFocus value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="输入种子，如 SPICY123" maxLength={16} />
            <button className="btn" type="submit">
              开始
            </button>
          </form>
        ) : (
          <button className="btn btn-ghost" onClick={() => setShowSeed(true)}>
            🎲 指定种子开局
          </button>
        )}
        <div className="row-btns">
          <button className="btn btn-ghost" onClick={() => setModal('rules')}>
            📖 规则与图鉴
          </button>
          <button className="btn btn-ghost" onClick={() => setModal('settings')}>
            ⚙️ 设置
          </button>
        </div>
      </div>
      {(saveStatus === 'unsupported' || saveStatus === 'readError') && (
        <div className="save-notice" role="status">
          {SAVE_STATUS_TEXT[saveStatus]}
        </div>
      )}
      {records.runs > 0 && (
        <div className="records">
          已开局 {records.runs} 次 · 通关 {records.wins} 次 · 最远第 {records.bestLevel} 关 · 最高单锅 {format(records.bestCook)}
        </div>
      )}
    </div>
  );
}

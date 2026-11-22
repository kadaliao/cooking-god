import { motion } from 'motion/react';
import { useLayoutEffect, useState } from 'react';
import { useGame } from '../game/state/store';
import { art } from './art';

const STEPS = [
  {
    anchor: null,
    title: '欢迎来到料理之神！',
    text: '用食材做菜，让分数从几百一路涨到天文数字。每关有 4 次烹饪机会，攒够目标分数就过关。',
  },
  { anchor: 'hand', title: '① 选食材', text: '点击手牌，把食材放进锅里。一次最多 5 张。长按或悬停可以看每张牌的详细效果。' },
  {
    anchor: 'pot',
    title: '② 排顺序',
    text: '锅里的顺序就是下锅顺序。拖动可以调整。比如「大蒜 → 牛肉」会触发炝锅 + 爆炒，顺序不同效果不同！',
  },
  { anchor: 'preview', title: '③ 看预览', text: '这里显示能做出的料理、触发的技法和预估得分。得分 = 筹码 × 倍率。' },
  { anchor: 'actions', title: '④ 开火！', text: '点「开始烹饪」结算。手牌不好可以「弃牌」换新的（次数有限）。' },
  {
    anchor: 'tools',
    title: '⑤ 厨具是关键',
    text: '过关后去商店买厨具。它们会在烹饪时自动触发，产生 ×2、×3 的连锁乘算，并且按从上到下的顺序触发。祝你爆分！',
  },
];

export function Tutorial() {
  const [i, setI] = useState(0);
  const setModal = useGame((s) => s.setModal);
  const update = useGame((s) => s.updateSettings);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const step = STEPS[i];

  useLayoutEffect(() => {
    const el = step.anchor ? document.querySelector(`[data-tut="${step.anchor}"]`) : null;
    setRect(el ? el.getBoundingClientRect() : null);
  }, [step]);

  const close = () => {
    update({ tutorialDone: true });
    setModal(null);
  };
  const pad = 8;
  const tipBelow = rect ? rect.top < window.innerHeight / 2 : false;
  return (
    <div className="tutorial">
      {rect ? (
        <div
          className="tut-hole"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }}
        />
      ) : (
        <div className="tut-dim" />
      )}
      <motion.div
        key={i}
        className="tut-box"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={
          rect
            ? {
                left: Math.max(12, Math.min(window.innerWidth - 352, rect.left + rect.width / 2 - 170)),
                top: tipBelow ? Math.min(window.innerHeight - 220, rect.bottom + 16) : Math.max(12, rect.top - 200),
              }
            : { left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }
        }
      >
        {!rect && <img className="tut-mascot" src={art('scene/mascot')} alt="" />}
        <div className="tut-title">{step.title}</div>
        <div className="tut-text">{step.text}</div>
        <div className="tut-btns">
          <button className="btn btn-ghost btn-mini" onClick={close}>
            跳过教程
          </button>
          <span className="muted small">
            {i + 1}/{STEPS.length}
          </span>
          <button className="btn btn-primary btn-mini" onClick={() => (i < STEPS.length - 1 ? setI(i + 1) : close())}>
            {i < STEPS.length - 1 ? '下一步' : '开始做饭！'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

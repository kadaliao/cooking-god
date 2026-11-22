import { useState } from 'react';
import { BOSS_LIST } from '../game/data/bosses';
import { INGREDIENT_LIST, describeIngredientEffect } from '../game/data/ingredients';
import { RECIPE_LIST, recipeBase } from '../game/data/recipes';
import { ENHANCEMENT_INFO, RARITY_INFO, TAG_INFO } from '../game/data/tags';
import { TECHNIQUE_LIST } from '../game/data/techniques';
import { ROUTE_INFO, TOOL_LIST } from '../game/data/tools';
import { useGame } from '../game/state/store';
import { bossArt, dishArt, ingredientArt, toolArt } from './art';
import { Modal } from './Modal';

const TABS = ['玩法', '料理', '技法', '厨具', '食材', 'Boss'] as const;

export function RulesModal({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>('玩法');
  const run = useGame((s) => s.run);
  return (
    <Modal onClose={onClose} wide className="rules-modal">
      <h2>📖 料理规则与图鉴</h2>
      <div className="tabs">
        {TABS.map((t) => (
          <button key={t} className={`tab ${tab === t ? 'on' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="tab-body">
        {tab === '玩法' && (
          <div className="howto">
            <p>
              <b>目标：</b>每关有 4 次烹饪、3 次弃牌机会。累计得分达到目标即过关，否则游戏结束。共 3 章 9 关，第 3、6、9 关是 Boss。
            </p>
            <p>
              <b>一次烹饪：</b>从 8 张手牌里选最多 5 张放进锅里，拖动调整顺序，点「开始烹饪」。
            </p>
            <div className="formula">
              最终得分 = <span className="chips-text">筹码</span> × <span className="mult-text">倍率</span>
            </div>
            <ol>
              <li>
                <b>匹配料理：</b>锅里的食材决定做出哪道菜（取等级最高的），给出基础筹码与倍率。任何组合至少能做出「家常乱炖」。
              </li>
              <li>
                <b>按顺序逐张结算：</b>每张食材加筹码 → 食材效果 → 强化 → 烹饪技法 → 厨具对这张牌的反应。
              </li>
              <li>
                <b>收尾：</b>「结束时」类厨具按从上到下的顺序乘算，最后应用 Boss 规则。
              </li>
            </ol>
            <p>
              <b>加法与乘法：</b>「+倍率」是加上去，「×倍率」是乘上去。所以 +倍率的厨具放在 ×倍率的厨具前面更划算——厨具可以拖动排序！
            </p>
            <p>
              <b>重复触发：</b>黄金锅铲、压轴汤勺会让一张食材的全部效果再结算一次（包括厨具对它的反应）。每张牌最多重复 6 次。
            </p>
            <p>
              <b>商店：</b>过关获得金币（基础 + 每剩 1 次烹饪 $1 + 每 $5 利息 $1，最多 $5）。厨具最多 5 件，满了可以卖掉旧的。
            </p>
            <p>
              <b>食材强化：</b>
              {Object.values(ENHANCEMENT_INFO).map((e) => (
                <span key={e.name} style={{ color: e.color }}>
                  【{e.name}】{e.desc}
                </span>
              ))}
            </p>
            <p>
              <b>三条经典路线：</b>
              <br />🥩 肉类乘算：祖传铁锅 + 炭火烤架 + 分子料理机，做烧烤拼盘。
              <br />🌶 辣味连锁：地狱辣油 + 麻辣连锁 + 黄金锅铲，把辣椒放第一位。
              <br />📈 永久成长：百年老汤 + 腌菜坛 + 回锅秘术，越打越强。
            </p>
          </div>
        )}
        {tab === '料理' && (
          <div className="grid-list">
            {RECIPE_LIST.slice()
              .reverse()
              .map((r) => {
                const lv = run?.recipeLevels[r.id] ?? 1;
                const b = recipeBase(r, lv);
                return (
                  <div key={r.id} className="glist-item">
                    <img src={dishArt(r.id)} alt="" />
                    <div>
                      <div className="glist-title">
                        {r.name} <span className="muted small">Lv.{lv}</span>
                      </div>
                      <div className="small">{r.condition}</div>
                      <div className="small">
                        <span className="chips-text">{b.chips}</span> × <span className="mult-text">{b.mult}</span>
                        <span className="muted">（每级 +{r.levelChips} / +{r.levelMult}）</span>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
        {tab === '技法' && (
          <div className="grid-list one">
            <p className="muted">烹饪技法由食材的下锅顺序触发。只看没被禁用的食材，「紧跟」指相邻位置。</p>
            {TECHNIQUE_LIST.map((t) => (
              <div key={t.id} className="glist-item">
                <div className="tech-badge big">{t.name}</div>
                <div>{t.desc}</div>
              </div>
            ))}
          </div>
        )}
        {tab === '厨具' && (
          <div className="grid-list">
            {TOOL_LIST.map((t) => (
              <div key={t.id} className="glist-item">
                <img src={toolArt(t.id)} alt="" />
                <div>
                  <div className="glist-title">
                    {t.name}{' '}
                    <span className="small" style={{ color: RARITY_INFO[t.rarity].color }}>
                      {RARITY_INFO[t.rarity].name}
                      {t.kind === 'skill' ? '技能' : '厨具'} ${t.price}
                    </span>
                  </div>
                  <div className="small">{t.desc}</div>
                  <div className="route-row">
                    {t.routes.map((r) => (
                      <span key={r} className="route">
                        {ROUTE_INFO[r]}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === '食材' && (
          <div className="grid-list">
            {INGREDIENT_LIST.map((d) => (
              <div key={d.id} className="glist-item">
                <img src={ingredientArt(d.id)} alt="" />
                <div>
                  <div className="glist-title">
                    {d.name} <span className="chips-text small">+{d.chips}</span>
                  </div>
                  <div className="tag-row">
                    {[...d.types, ...d.flavors].map((t) => (
                      <span key={t} className="tag" style={{ background: TAG_INFO[t].color }}>
                        {TAG_INFO[t].name}
                      </span>
                    ))}
                  </div>
                  {describeIngredientEffect(d) && <div className="small effect">✦ {describeIngredientEffect(d)}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
        {tab === 'Boss' && (
          <div className="grid-list one">
            {BOSS_LIST.map((b, i) => (
              <div key={b.id} className="glist-item boss-item">
                <img src={bossArt(b.id)} alt="" />
                <div>
                  <div className="glist-title">
                    第 {(i + 1) * 3} 关 · {b.name}
                  </div>
                  <div className="muted small">{b.quote}</div>
                  {b.rules.map((r) => (
                    <div key={r} className="small">
                      ⚠️ {r}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

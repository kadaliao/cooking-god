import { AnimatePresence, Reorder, motion } from 'motion/react';
import { useState } from 'react';
import { BOSSES } from '../game/data/bosses';
import { INGREDIENTS } from '../game/data/ingredients';
import { RULES, levelInfo } from '../game/data/levels';
import { RECIPES } from '../game/data/recipes';
import { ENHANCEMENT_INFO, RARITY_INFO } from '../game/data/tags';
import { ROUTE_INFO, TOOLS } from '../game/data/tools';
import { leaveShop } from '../game/engine/run';
import { CONSUMABLE_INFO, MIN_DECK_SIZE, buyConsumable, buyTool, removeCard, reorderTools, reroll, sellPrice, sellTool } from '../game/engine/shop';
import { copyTargetOf } from '../game/effects/dispatch';
import { baseTarget } from '../game/data/levels';
import { format, mul, big } from '../game/scoring/bignum';
import { useGame } from '../game/state/store';
import type { CardInstance, ConsumableOffer } from '../game/types';
import { art, bossArt, ingredientArt, toolArt } from './art';
import { DeckModal } from './DeckModal';
import { ToolCard } from './ToolCard';
import { useIsMobile } from './hooks';

function consumableText(o: ConsumableOffer): { title: string; desc: string; img: string } {
  switch (o.type) {
    case 'recipe': {
      const r = RECIPES[o.recipeId!];
      return { title: `配方秘籍：${r.name}`, desc: `${r.name} 升 1 级（+${r.levelChips} 筹码，+${r.levelMult} 倍率）`, img: art('items/recipeScroll') };
    }
    case 'enhance': {
      const e = ENHANCEMENT_INFO[o.enhancement!];
      return { title: `神秘调料：${e.name}`, desc: `为一张食材附加【${e.name}】：${e.desc}`, img: art('items/enhanceJar') };
    }
    case 'star':
      return { title: '升星粉', desc: '一张食材品质 +1 星（+10 筹码）', img: art('items/starPowder') };
    case 'ingredient': {
      const d = INGREDIENTS[o.ingredientId!];
      return { title: `新鲜食材：${d.name}`, desc: `把一张${d.name}加入卡组`, img: ingredientArt(d.id) };
    }
    case 'clone':
      return { title: '复制食材', desc: '复制卡组中的一张食材（保留星级与强化）', img: art('items/ingredientBasket') };
  }
}

export function ShopScreen() {
  const run = useGame((s) => s.run)!;
  const act = useGame((s) => s.act);
  const setModal = useGame((s) => s.setModal);
  const mobile = useIsMobile();
  const [picker, setPicker] = useState<null | { title: string; hint?: string; onPick: (c: CardInstance) => void }>(null);
  const shop = run.shop!;
  const next = levelInfo(run.level + 1);
  const nextBoss = next.bossId ? BOSSES[next.bossId] : undefined;
  const nextTarget = mul(baseTarget(run.level + 1), big(nextBoss?.targetMult ?? 1));

  const buyGood = (i: number) => {
    const o = shop.goods[i];
    if (CONSUMABLE_INFO[o.type].needsTarget) {
      const t = consumableText(o);
      setPicker({
        title: `选择一张食材：${t.title}`,
        hint: t.desc,
        onPick: (c) => {
          act((s) => buyConsumable(s, i, c.uid), 'buy');
          setPicker(null);
        },
      });
    } else act((s) => buyConsumable(s, i), 'buy');
  };

  return (
    <div className="shop">
      <div className="shop-head">
        <div>
          <h2>🛒 食神杂货铺</h2>
          <div className="muted small">过关奖励已到账。买点好东西，强化你的构筑吧。</div>
        </div>
        <div className="shop-gold">💰 ${run.gold}</div>
      </div>

      <div className="shop-body">
        <section className="shop-section owned">
          <div className="section-title">
            我的厨具 {run.tools.length}/{RULES.toolSlots}
            <span className="muted small"> · 拖动排序，从上到下触发</span>
          </div>
          {run.tools.length === 0 && <div className="muted small">还没有厨具。</div>}
          <Reorder.Group
            axis={mobile ? 'x' : 'y'}
            values={run.tools.map((t) => t.uid)}
            onReorder={(o) => act((s) => reorderTools(s, o))}
            className="owned-list"
          >
            {run.tools.map((t) => {
              const copy = TOOLS[t.defId].copiesLeft ? copyTargetOf(run.tools, t.uid) : undefined;
              return (
                <Reorder.Item key={t.uid} value={t.uid} className="owned-item">
                  <ToolCard defId={t.defId} inst={t} compact={mobile} copyName={copy ? TOOLS[copy.defId].name : undefined} />
                  <button className="btn btn-mini btn-sell" onClick={() => act((s) => sellTool(s, t.uid), 'coin')}>
                    卖 ${sellPrice(t.defId)}
                  </button>
                </Reorder.Item>
              );
            })}
          </Reorder.Group>
        </section>

        <section className="shop-section wares">
          <div className="section-title">厨具与技能</div>
          <div className="offer-row">
            <AnimatePresence mode="popLayout">
              {shop.tools.map((o, i) => {
                const def = TOOLS[o.defId];
                return (
                  <motion.div
                    key={`${o.defId}-${shop.rerollCost}`}
                    className={`offer tool-offer rarity-${def.rarity} ${o.sold ? 'sold' : ''}`}
                    initial={{ rotateY: 90, opacity: 0 }}
                    animate={{ rotateY: 0, opacity: 1 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <div className="offer-rarity" style={{ background: RARITY_INFO[def.rarity].color }}>
                      {RARITY_INFO[def.rarity].name}
                      {def.kind === 'skill' ? ' · 技能' : ' · 厨具'}
                    </div>
                    <img src={toolArt(def.id)} alt="" />
                    <div className="offer-name">{def.name}</div>
                    <div className="offer-desc">{def.desc}</div>
                    <div className="route-row">
                      {def.routes.map((r) => (
                        <span key={r} className="route">
                          {ROUTE_INFO[r]}
                        </span>
                      ))}
                    </div>
                    <button
                      className="btn btn-buy"
                      disabled={o.sold || run.gold < o.price}
                      onClick={() => act((s) => buyTool(s, i), 'buy')}
                    >
                      {o.sold ? '已购买' : `$${o.price}`}
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>

          <div className="section-title">秘方与食材</div>
          <div className="offer-row goods">
            {shop.goods.map((o, i) => {
              const t = consumableText(o);
              return (
                <motion.div
                  key={`${i}-${shop.rerollCost}`}
                  className={`offer good-offer ${o.sold ? 'sold' : ''}`}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                >
                  <img src={t.img} alt="" />
                  <div>
                    <div className="offer-name">{t.title}</div>
                    <div className="offer-desc">{t.desc}</div>
                  </div>
                  <button className="btn btn-buy" disabled={o.sold || run.gold < o.price} onClick={() => buyGood(i)}>
                    {o.sold ? '已购买' : `$${o.price}`}
                  </button>
                </motion.div>
              );
            })}
          </div>

          <div className="services">
            <button className="btn" disabled={run.gold < shop.rerollCost} onClick={() => act(reroll, 'click')}>
              🔄 刷新商品 ${shop.rerollCost}
            </button>
            <button
              className="btn"
              disabled={run.gold < shop.removeCost || run.deck.length <= MIN_DECK_SIZE}
              onClick={() =>
                setPicker({
                  title: `精简卡组（$${shop.removeCost}）`,
                  hint: `选择一张食材永久移除。卡组至少保留 ${MIN_DECK_SIZE} 张。`,
                  onPick: (c) => {
                    act((s) => removeCard(s, c.uid), 'coin');
                    setPicker(null);
                  },
                })
              }
            >
              🗑️ 移除食材 ${shop.removeCost}
            </button>
            <button className="btn" onClick={() => setModal('deck')}>
              🧺 查看卡组
            </button>
          </div>
        </section>
      </div>

      <div className="shop-foot">
        <div className={`next-level ${nextBoss ? 'boss' : ''}`}>
          {nextBoss && <img src={bossArt(nextBoss.id)} alt="" />}
          <div>
            <div className="muted small">下一关</div>
            <b>{next.name}</b> · 目标 {format(nextTarget)}
            {nextBoss && <div className="small">⚠️ {nextBoss.rules[0]}</div>}
          </div>
        </div>
        <button className="btn btn-primary big" onClick={() => act(leaveShop, 'click')}>
          出发 ▶
        </button>
      </div>
      {picker && <DeckModal run={run} onClose={() => setPicker(null)} pick={picker} />}
    </div>
  );
}

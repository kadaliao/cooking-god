import { INGREDIENTS, INGREDIENT_LIST } from '../data/ingredients';
import { RULES } from '../data/levels';
import { DEFAULT_RECIPE_ID, RECIPE_LIST } from '../data/recipes';
import { RARITY_INFO } from '../data/tags';
import { TOOLS, TOOL_LIST } from '../data/tools';
import type { ConsumableKind, ConsumableOffer, Enhancement, RunState, ShopState, ToolOffer } from '../types';
import { randInt, weightedPick } from './rng';
import { GameError, cardByUid, clone, makeCard, newUid } from './run';

export const MIN_DECK_SIZE = 12;

const CONSUMABLE_WEIGHTS: Record<ConsumableKind, number> = {
  recipe: 30,
  enhance: 25,
  star: 15,
  ingredient: 20,
  clone: 10,
};

export const CONSUMABLE_INFO: Record<ConsumableKind, { name: string; art: string; needsTarget: boolean }> = {
  recipe: { name: '配方秘籍', art: 'items/recipeScroll', needsTarget: false },
  enhance: { name: '神秘调料', art: 'items/enhanceJar', needsTarget: true },
  star: { name: '升星粉', art: 'items/starPowder', needsTarget: true },
  ingredient: { name: '新鲜食材', art: 'items/ingredientBasket', needsTarget: false },
  clone: { name: '复制食材', art: 'items/ingredientBasket', needsTarget: true },
};

function rollToolOffers(s: RunState, n: number): ToolOffer[] {
  const owned = new Set(s.tools.map((t) => t.defId));
  const offers: ToolOffer[] = [];
  for (let i = 0; i < n; i++) {
    const pool = TOOL_LIST.filter((t) => !owned.has(t.id) && !offers.some((o) => o.defId === t.id));
    const pick = weightedPick(s, pool, (t) => RARITY_INFO[t.rarity].weight);
    if (!pick) break;
    offers.push({ kind: 'tool', defId: pick.id, price: pick.price, sold: false });
  }
  return offers;
}

function rollConsumable(s: RunState): ConsumableOffer {
  const kinds = Object.keys(CONSUMABLE_WEIGHTS) as ConsumableKind[];
  const type = weightedPick(s, kinds, (k) => CONSUMABLE_WEIGHTS[k])!;
  switch (type) {
    case 'recipe': {
      const pool = RECIPE_LIST.filter((r) => r.id !== DEFAULT_RECIPE_ID);
      return { kind: 'consumable', type, price: 3, sold: false, recipeId: pool[randInt(s, pool.length)].id };
    }
    case 'enhance': {
      const list: Enhancement[] = ['fresh', 'marinated', 'charred', 'gilded'];
      return { kind: 'consumable', type, price: 4, sold: false, enhancement: list[randInt(s, list.length)] };
    }
    case 'ingredient': {
      const weights = { common: 25, uncommon: 40, rare: 25, legendary: 10 };
      const pick = weightedPick(s, INGREDIENT_LIST, (d) => weights[d.rarity])!;
      return { kind: 'consumable', type, price: pick.price, sold: false, ingredientId: pick.id };
    }
    case 'star':
      return { kind: 'consumable', type, price: 3, sold: false };
    case 'clone':
      return { kind: 'consumable', type, price: 4, sold: false };
  }
}

export function generateShop(s: RunState): ShopState {
  return {
    tools: rollToolOffers(s, 3),
    goods: [rollConsumable(s), rollConsumable(s)],
    rerollCost: RULES.rerollBase,
    removeCost: RULES.removeCost,
    removedThisShop: 0,
  };
}

function requireShop(s: RunState): ShopState {
  if (s.phase !== 'shop' || !s.shop) throw new GameError('不在商店中');
  return s.shop;
}

function pay(s: RunState, price: number) {
  if (s.gold < price) throw new GameError('金币不足');
  s.gold -= price;
}

export function buyTool(prev: RunState, index: number): RunState {
  const s = clone(prev);
  const shop = requireShop(s);
  const offer = shop.tools[index];
  if (!offer || offer.sold) throw new GameError('该商品已售出');
  if (s.tools.length >= RULES.toolSlots) throw new GameError(`厨具栏已满（${RULES.toolSlots} 件），先卖掉一件`);
  pay(s, offer.price);
  const def = TOOLS[offer.defId];
  s.tools.push({ uid: newUid(s, 't'), defId: def.id, data: { ...(def.initData ?? {}) } });
  offer.sold = true;
  s.stats.toolsBought += 1;
  return s;
}

export function sellPrice(defId: string): number {
  return Math.max(1, Math.floor(TOOLS[defId].price * RULES.sellRatio));
}

export function sellTool(prev: RunState, uid: string): RunState {
  const s = clone(prev);
  if (s.phase !== 'shop' && s.phase !== 'playing' && s.phase !== 'levelIntro') throw new GameError('现在不能出售');
  const t = s.tools.find((x) => x.uid === uid);
  if (!t) throw new GameError('没有这件厨具');
  s.gold += sellPrice(t.defId);
  s.tools = s.tools.filter((x) => x.uid !== uid);
  return s;
}

export function reorderTools(prev: RunState, order: string[]): RunState {
  if (order.length !== prev.tools.length || !order.every((u) => prev.tools.some((t) => t.uid === u)))
    throw new GameError('厨具顺序无效');
  const s = clone(prev);
  s.tools = order.map((u) => s.tools.find((t) => t.uid === u)!);
  return s;
}

export function buyConsumable(prev: RunState, index: number, targetUid?: string): RunState {
  const s = clone(prev);
  const shop = requireShop(s);
  const offer = shop.goods[index];
  if (!offer || offer.sold) throw new GameError('该商品已售出');
  const needsTarget = CONSUMABLE_INFO[offer.type].needsTarget;
  if (needsTarget && !targetUid) throw new GameError('请选择一张食材');
  const target = targetUid ? cardByUid(s, targetUid) : undefined;
  pay(s, offer.price);
  switch (offer.type) {
    case 'recipe':
      s.recipeLevels[offer.recipeId!] = (s.recipeLevels[offer.recipeId!] ?? 1) + 1;
      break;
    case 'enhance':
      target!.enhancement = offer.enhancement;
      break;
    case 'star':
      target!.level += 1;
      break;
    case 'ingredient':
      if (!INGREDIENTS[offer.ingredientId!]) throw new GameError('未知食材');
      s.deck.push(makeCard(s, offer.ingredientId!));
      break;
    case 'clone': {
      const copy = makeCard(s, target!.defId);
      copy.level = target!.level;
      copy.enhancement = target!.enhancement;
      s.deck.push(copy);
      break;
    }
  }
  offer.sold = true;
  return s;
}

export function reroll(prev: RunState): RunState {
  const s = clone(prev);
  const shop = requireShop(s);
  pay(s, shop.rerollCost);
  shop.rerollCost += 1;
  shop.tools = rollToolOffers(s, 3);
  shop.goods = [rollConsumable(s), rollConsumable(s)];
  return s;
}

export function removeCard(prev: RunState, uid: string): RunState {
  const s = clone(prev);
  const shop = requireShop(s);
  if (s.deck.length <= MIN_DECK_SIZE) throw new GameError(`卡组至少保留 ${MIN_DECK_SIZE} 张`);
  cardByUid(s, uid);
  pay(s, shop.removeCost);
  s.deck = s.deck.filter((c) => c.uid !== uid);
  shop.removedThisShop += 1;
  shop.removeCost += 1;
  return s;
}

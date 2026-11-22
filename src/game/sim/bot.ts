/**
 * 自动玩家：用于平衡性模拟和「完整胜利路线」测试。
 * 只调用公开的引擎动作，不作弊。
 */
import { INGREDIENTS } from '../data/ingredients';
import { RULES } from '../data/levels';
import { TOOLS } from '../data/tools';
import * as run from '../engine/run';
import * as shop from '../engine/shop';
import { gte, toNumber, type Big, add, cmp, big } from '../scoring/bignum';
import { scoreCook } from '../scoring/score';
import type { RunState } from '../types';

function combos<T>(arr: T[], k: number, start = 0, acc: T[] = [], out: T[][] = []): T[][] {
  if (acc.length === k) {
    out.push(acc.slice());
    return out;
  }
  for (let i = start; i < arr.length; i++) {
    acc.push(arr[i]);
    combos(arr, k, i + 1, acc, out);
    acc.pop();
  }
  return out;
}

const ORDER_KEY: Record<string, number> = { garlic: 0, ginger: 0 };
function orderKey(s: RunState, uid: string): number {
  const c = run.cardByUid(s, uid);
  const d = INGREDIENTS[c.defId];
  if (ORDER_KEY[d.id] !== undefined) return ORDER_KEY[d.id];
  const t = d.types[0];
  return { spice: 1, meat: 2, seafood: 3, mushroom: 4, veg: 5, egg: 6, special: 6.5, staple: 7, broth: 8 }[t] ?? 6;
}

export function candidateOrders(s: RunState, subset: string[]): string[][] {
  const base = subset.slice().sort((a, b) => orderKey(s, a) - orderKey(s, b));
  const orders = [base];
  // 每张牌轮流放第一位（黄金锅铲等）
  for (let i = 1; i < base.length; i++) orders.push([base[i], ...base.filter((_, j) => j !== i)]);
  // 肉在前、香料在后（腌制）
  const marinate = base.slice().sort((a, b) => {
    const ka = orderKey(s, a) === 2 ? 0 : orderKey(s, a) === 1 ? 1 : orderKey(s, a) + 2;
    const kb = orderKey(s, b) === 2 ? 0 : orderKey(s, b) === 1 ? 1 : orderKey(s, b) + 2;
    return ka - kb;
  });
  orders.push(marinate);
  return orders;
}

export function bestPot(s: RunState): { pot: string[]; score: Big } {
  const max = Math.min(run.maxSelect(s), s.hand.length);
  let best: { pot: string[]; score: Big } = { pot: [s.hand[0]], score: big(0) };
  for (let k = 1; k <= max; k++) {
    for (const subset of combos(s.hand, k)) {
      for (const order of candidateOrders(s, subset)) {
        const r = scoreCook({ ...run.cookInput({ ...s, pot: order }, true) });
        if (cmp(r.score, best.score) > 0) best = { pot: order, score: r.score };
      }
    }
  }
  return best;
}

export function playLevel(state: RunState): RunState {
  let s = state;
  if (s.phase === 'levelIntro') s = run.startLevel(s);
  while (s.phase === 'playing') {
    const best = bestPot(s);
    const ls = s.levelState;
    const remaining = toNumber(ls.target) - toNumber(ls.score);
    const enough = toNumber(best.score) >= remaining;
    const pace = toNumber(best.score) * ls.cooksLeft >= remaining;
    if (!enough && !pace && ls.discardsLeft > 0) {
      const junk = s.hand.filter((u) => !best.pot.includes(u)).slice(0, RULES.maxSelect);
      if (junk.length > 0) {
        s = { ...s, pot: junk };
        s = run.discard(s);
        continue;
      }
    }
    s = run.cook({ ...s, pot: best.pot });
  }
  return s;
}

const TOOL_VALUE: Record<string, number> = {
  goldenSpatula: 10,
  heirloomWok: 10,
  hellOil: 9,
  molecular: 7,
  autoWok: 8,
  michelin: 8,
  twiceCooked: 8,
  darkCookbook: 5,
  msg: 6,
  malaChain: 6,
  grill: 6,
  centuryBroth: 6,
  pickleJar: 6,
  timer: 5,
  wokToss: 5,
  knife: 5,
  ladle: 6,
  board: 4,
  steamer: 3,
  luckyCat: 5,
  fridge: 4,
  mitts: 4,
  prepStation: 6,
};

export function shopTurn(state: RunState): RunState {
  let s = state;
  const value = (id: string) => TOOL_VALUE[id] ?? 3;
  for (let round = 0; round < 3; round++) {
    // 买厨具
    let bought = true;
    while (bought) {
      bought = false;
      const offers = s.shop!.tools
        .map((o, i) => ({ o, i }))
        .filter(({ o }) => !o.sold && o.price <= s.gold)
        .sort((a, b) => value(b.o.defId) - value(a.o.defId));
      for (const { o, i } of offers) {
        if (s.tools.length < RULES.toolSlots) {
          s = shop.buyTool(s, i);
          bought = true;
          break;
        }
        const worst = s.tools.slice().sort((a, b) => value(a.defId) - value(b.defId))[0];
        if (value(o.defId) > value(worst.defId) + 1 && o.price <= s.gold + shop.sellPrice(worst.defId)) {
          s = shop.sellTool(s, worst.uid);
          s = shop.buyTool(s, i);
          bought = true;
          break;
        }
      }
    }
    // 买消耗品
    const fav = Object.entries(s.stats.recipeCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
    s.shop!.goods.forEach((g, i) => {
      if (g.sold || g.price > s.gold - 2) return;
      const has = (id: string) => s.tools.some((t) => t.defId === id);
      const wants = (defId: string) => {
        const d = INGREDIENTS[defId];
        if (has('hellOil') || has('malaChain')) return d.flavors.includes('spicy') || d.flavors.includes('numbing');
        if (has('heirloomWok') || has('grill')) return d.types.includes('meat');
        if (has('msg')) return d.flavors.includes('umami');
        if (has('pickleJar') || has('knife')) return d.types.includes('veg');
        return d.rarity === 'rare';
      };
      if (g.type === 'recipe' && g.recipeId === fav) s = shop.buyConsumable(s, i);
      else if (g.type === 'ingredient' && wants(g.ingredientId!)) s = shop.buyConsumable(s, i);
      else if (g.type === 'clone') {
        const target = s.deck.find((c) => wants(c.defId)) ?? s.deck.find((c) => has('darkCookbook') && c.defId === 'beef');
        if (target) s = shop.buyConsumable(s, i, target.uid);
      }
      else if (g.type === 'star' || g.type === 'enhance') {
        const target = s.deck.slice().sort((a, b) => INGREDIENTS[b.defId].chips - INGREDIENTS[a.defId].chips)[0];
        s = shop.buyConsumable(s, i, target.uid);
      }
    });
    // 自动炒锅放最后（复制上方最强的），其余按价值排序
    const order = s.tools
      .slice()
      .sort((a, b) => (TOOLS[a.defId].copiesLeft ? 1 : 0) - (TOOLS[b.defId].copiesLeft ? 1 : 0) || value(a.defId) - value(b.defId));
    s = shop.reorderTools(
      s,
      order.map((t) => t.uid),
    );
    if (s.gold >= s.shop!.rerollCost + 8 && s.tools.length < RULES.toolSlots) s = shop.reroll(s);
    else break;
  }
  return run.leaveShop(s);
}

export interface SimResult {
  seed: string;
  won: boolean;
  level: number;
  best: Big;
  total: Big;
  tools: string[];
  final: RunState;
}

export function simulate(seed: string, maxLevel = 9): SimResult {
  let s = run.createRun(seed);
  let total = big(0);
  while (true) {
    s = playLevel(s);
    total = add(total, s.levelState.score);
    if (s.phase === 'gameOver') break;
    s = run.collectReward(s);
    if (s.phase === 'victory') break;
    if (s.level >= maxLevel) break;
    s = shopTurn(s);
  }
  return {
    seed,
    won: s.phase === 'victory',
    level: s.level,
    best: s.stats.bestCook,
    total,
    tools: s.tools.map((t) => t.defId),
    final: s,
  };
}

export const reached = (r: SimResult, target: Big) => gte(r.best, target);

import * as run from '../engine/run';
import * as shop from '../engine/shop';
import { RULES } from '../data/levels';
import { INGREDIENTS } from '../data/ingredients';
import { simulate } from '../sim/bot';
import { gte, toNumber } from '../scoring/bignum';
import type { RunState } from '../types';

const roundtrip = (s: RunState): RunState => JSON.parse(JSON.stringify(s));

function cheapestCard(s: RunState) {
  return s.hand
    .slice()
    .sort((a, b) => INGREDIENTS[run.cardByUid(s, a).defId].chips - INGREDIENTS[run.cardByUid(s, b).defId].chips)[0];
}

describe('run lifecycle', () => {
  it('same seed produces the same deal', () => {
    const a = run.startLevel(run.createRun('SEED'));
    const b = run.startLevel(run.createRun('SEED'));
    const c = run.startLevel(run.createRun('OTHER'));
    expect(a.hand).toEqual(b.hand);
    expect(a.hand.map((u) => run.cardByUid(a, u).defId)).not.toEqual(c.hand.map((u) => run.cardByUid(c, u).defId));
    expect(a.hand).toHaveLength(RULES.handSize);
  });

  it('enforces selection limit and ordering', () => {
    let s = run.startLevel(run.createRun('SEL'));
    for (const u of s.hand.slice(0, 5)) s = run.togglePot(s, u);
    expect(() => run.togglePot(s, s.hand[5])).toThrow(run.GameError);
    const reversed = s.pot.slice().reverse();
    s = run.setPotOrder(s, reversed);
    expect(s.pot).toEqual(reversed);
    expect(() => run.setPotOrder(s, [s.hand[6]])).toThrow();
  });

  it('failure route: missing the target ends the run, and a new run starts clean', () => {
    let s = run.startLevel(run.createRun('LOSE'));
    for (let i = 0; i < RULES.cooksPerLevel; i++) {
      expect(s.phase).toBe('playing');
      s = run.togglePot(s, cheapestCard(s));
      s = run.cook(s);
    }
    expect(s.phase).toBe('gameOver');
    expect(() => run.cook(s)).toThrow();
    const fresh = run.createRun('LOSE');
    expect(fresh.phase).toBe('levelIntro');
    expect(fresh.level).toBe(1);
    expect(toNumber(fresh.levelState.score)).toBe(0);
  });

  it('discard replaces cards and triggers discard growth', () => {
    let s = run.createRun('DISC');
    s.tools.push({ uid: 'tf', defId: 'fridge', data: { chips: 0 } });
    s = run.startLevel(s);
    const before = s.hand.slice(0, 3);
    for (const u of before) s = run.togglePot(s, u);
    s = run.discard(s);
    expect(s.levelState.discardsLeft).toBe(RULES.discardsPerLevel - 1);
    expect(s.hand).toHaveLength(RULES.handSize);
    expect(s.hand.some((u) => before.includes(u))).toBe(false);
    expect(s.tools[0].data.chips).toBe(30);
  });

  it('winning a level pays rewards and opens the shop', () => {
    let s = run.createRun('WIN');
    s.tools.push({ uid: 'tw', defId: 'heirloomWok', data: {} }, { uid: 'tg', defId: 'goldenSpatula', data: {} });
    s = run.startLevel(s);
    while (s.phase === 'playing') {
      s = run.togglePot(s, s.hand[0]);
      s = run.cook(s);
    }
    if (s.phase === 'levelWon') {
      const gold = s.gold;
      const reward = s.reward!;
      expect(reward.total).toBe(reward.base + reward.cooksBonus + reward.interest);
      s = run.collectReward(s);
      expect(s.phase).toBe('shop');
      expect(s.gold).toBe(gold + reward.total);
      expect(s.shop!.tools.length).toBe(3);
      s = run.leaveShop(s);
      expect(s.level).toBe(2);
      expect(s.phase).toBe('levelIntro');
    }
  });
});

describe('shop', () => {
  function shopState(gold = 50): RunState {
    const s = run.createRun('SHOP');
    s.phase = 'shop';
    s.gold = gold;
    s.shop = shop.generateShop(s);
    return s;
  }

  it('buys and sells tools', () => {
    let s = shopState();
    const offer = s.shop!.tools[0];
    s = shop.buyTool(s, 0);
    expect(s.gold).toBe(50 - offer.price);
    expect(s.tools.map((t) => t.defId)).toEqual([offer.defId]);
    expect(() => shop.buyTool(s, 0)).toThrow('已售出');
    const gold = s.gold;
    s = shop.sellTool(s, s.tools[0].uid);
    expect(s.tools).toHaveLength(0);
    expect(s.gold).toBe(gold + shop.sellPrice(offer.defId));
  });

  it('rejects purchases without enough gold', () => {
    const s = shopState(0);
    expect(() => shop.buyTool(s, 0)).toThrow('金币不足');
  });

  it('enforces the tool slot limit', () => {
    let s = shopState(999);
    for (let i = 0; i < RULES.toolSlots; i++) s.tools.push({ uid: `x${i}`, defId: 'board', data: {} });
    expect(() => shop.buyTool(s, 0)).toThrow('厨具栏已满');
    s = shop.sellTool(s, 'x0');
    expect(() => shop.buyTool(s, 0)).not.toThrow();
  });

  it('applies consumables', () => {
    let s = shopState();
    const target = s.deck[0];
    s.shop!.goods = [
      { kind: 'consumable', type: 'recipe', price: 3, sold: false, recipeId: 'bbq' },
      { kind: 'consumable', type: 'enhance', price: 4, sold: false, enhancement: 'charred' },
      { kind: 'consumable', type: 'star', price: 3, sold: false },
      { kind: 'consumable', type: 'ingredient', price: 6, sold: false, ingredientId: 'truffle' },
      { kind: 'consumable', type: 'clone', price: 4, sold: false },
    ];
    const deckSize = s.deck.length;
    s = shop.buyConsumable(s, 0);
    expect(s.recipeLevels.bbq).toBe(2);
    expect(() => shop.buyConsumable(s, 1)).toThrow('请选择');
    s = shop.buyConsumable(s, 1, target.uid);
    s = shop.buyConsumable(s, 2, target.uid);
    expect(s.deck[0]).toMatchObject({ enhancement: 'charred', level: 2 });
    s = shop.buyConsumable(s, 3);
    s = shop.buyConsumable(s, 4, target.uid);
    expect(s.deck).toHaveLength(deckSize + 2);
    expect(s.deck.at(-1)).toMatchObject({ defId: target.defId, level: 2, enhancement: 'charred' });
    expect(s.gold).toBe(50 - 3 - 4 - 3 - 6 - 4);
  });

  it('reroll costs more each time and remove-card respects the minimum deck', () => {
    let s = shopState();
    s = shop.reroll(s);
    expect(s.gold).toBe(48);
    s = shop.reroll(s);
    expect(s.gold).toBe(45);
    const size = s.deck.length;
    s = shop.removeCard(s, s.deck[0].uid);
    expect(s.deck).toHaveLength(size - 1);
    s.deck = s.deck.slice(0, shop.MIN_DECK_SIZE);
    expect(() => shop.removeCard(s, s.deck[0].uid)).toThrow('至少保留');
  });

  it('reorders tools', () => {
    let s = shopState();
    s.tools.push({ uid: 'a', defId: 'knife', data: {} }, { uid: 'b', defId: 'board', data: {} });
    s = shop.reorderTools(s, ['b', 'a']);
    expect(s.tools.map((t) => t.uid)).toEqual(['b', 'a']);
  });
});

describe('save & restore', () => {
  it('a JSON round-tripped state continues identically', () => {
    let s = run.startLevel(run.createRun('SAVE'));
    s = run.togglePot(s, s.hand[0]);
    s = run.togglePot(s, s.hand[1]);
    const restored = roundtrip(s);
    expect(restored).toEqual(s);
    const step = (x: RunState) => {
      let y = run.discard(x);
      y = run.togglePot(y, y.hand[0]);
      y = run.cook(y);
      return y;
    };
    const a = step(s);
    const b = step(restored);
    expect(b).toEqual(a);
    expect(b.lastResult).not.toBeNull();
  });
});

describe('full victory route', () => {
  it('the auto-player can clear all 9 levels on a known seed', () => {
    const wins = ['SIM2', 'SIM3', 'SIM6'].map((seed) => simulate(seed));
    const won = wins.find((r) => r.won);
    expect(won).toBeDefined();
    const f = won!.final;
    expect(f.phase).toBe('victory');
    expect(f.level).toBe(9);
    expect(f.stats.levelsCleared).toBe(9);
    expect(gte(f.levelState.score, f.levelState.target)).toBe(true);
    // 可以继续无尽模式
    const endless = run.continueEndless(f);
    expect(endless.phase).toBe('shop');
    expect(run.leaveShop(endless).level).toBe(10);
  }, 120000);
});

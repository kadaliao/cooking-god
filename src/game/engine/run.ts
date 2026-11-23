import { BOSSES } from '../data/bosses';
import { INGREDIENTS, STARTING_DECK } from '../data/ingredients';
import { FINAL_LEVEL, RULES, baseTarget, levelInfo } from '../data/levels';
import { TOOLS } from '../data/tools';
import { passiveBonus } from '../effects/dispatch';
import { add, big, gt, gte, mul } from '../scoring/bignum';
import { scoreCook, type CookInput } from '../scoring/score';
import type { CardInstance, CookResult, LevelReward, LevelState, RunState } from '../types';
import { hashSeed, shuffle } from './rng';
import { generateShop } from './shop';

export class GameError extends Error {}

// 存档本来就要能 JSON 序列化，所以没有 structuredClone 的旧内核（Chrome < 98）用 JSON 深拷贝即可
export const clone = <T>(v: T): T =>
  typeof structuredClone === 'function' ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T);

export function newUid(s: RunState, prefix: string) {
  return `${prefix}${s.nextUid++}`;
}

export function makeCard(s: RunState, defId: string): CardInstance {
  if (!INGREDIENTS[defId]) throw new GameError(`未知食材 ${defId}`);
  return { uid: newUid(s, 'c'), defId, level: 1 };
}

export const handSize = (s: RunState) => RULES.handSize + passiveBonus(s.tools, 'handSize');
export const maxSelect = (s: RunState) => RULES.maxSelect + passiveBonus(s.tools, 'maxSelect');
export const cardByUid = (s: RunState, uid: string) => {
  const c = s.deck.find((d) => d.uid === uid);
  if (!c) throw new GameError(`卡牌不存在 ${uid}`);
  return c;
};

export function makeLevelState(s: RunState, level: number): LevelState {
  const info = levelInfo(level);
  const boss = info.bossId ? BOSSES[info.bossId] : undefined;
  return {
    target: mul(baseTarget(level), big(boss?.targetMult ?? 1)),
    score: big(0),
    cooksLeft: RULES.cooksPerLevel + passiveBonus(s.tools, 'cooks'),
    discardsLeft: RULES.discardsPerLevel + passiveBonus(s.tools, 'discards'),
    cooksDone: 0,
    usedRecipes: [],
  };
}

export function createRun(seed: string): RunState {
  const s: RunState = {
    version: 1,
    seed,
    rng: hashSeed(seed),
    phase: 'levelIntro',
    level: 1,
    endless: false,
    gold: RULES.startingGold,
    deck: [],
    drawPile: [],
    hand: [],
    discardPile: [],
    pot: [],
    tools: [],
    recipeLevels: {},
    levelState: undefined as unknown as LevelState,
    shop: null,
    reward: null,
    stats: {
      cooks: 0,
      discards: 0,
      bestCook: big(0),
      recipeCounts: {},
      totalScore: big(0),
      goldEarned: 0,
      levelsCleared: 0,
      toolsBought: 0,
      biggestXMult: 1,
      startedAt: Date.now(),
    },
    lastResult: null,
    nextUid: 1,
  };
  for (const [id, n] of Object.entries(STARTING_DECK)) for (let i = 0; i < n; i++) s.deck.push(makeCard(s, id));
  s.levelState = makeLevelState(s, 1);
  return s;
}

export const currentBossId = (s: RunState) => levelInfo(s.level).bossId;

function drawToHand(s: RunState) {
  const size = handSize(s);
  while (s.hand.length < size) {
    if (s.drawPile.length === 0) {
      if (s.discardPile.length === 0) break;
      s.drawPile = shuffle(s, s.discardPile);
      s.discardPile = [];
    }
    s.hand.push(s.drawPile.pop()!);
  }
}

/** 关卡介绍 → 正式开始：洗牌、抽牌 */
export function startLevel(prev: RunState): RunState {
  if (prev.phase !== 'levelIntro') throw new GameError('现在不能开始关卡');
  const s = clone(prev);
  s.levelState = makeLevelState(s, s.level);
  s.drawPile = shuffle(
    s,
    s.deck.map((c) => c.uid),
  );
  s.hand = [];
  s.discardPile = [];
  s.pot = [];
  s.lastResult = null;
  drawToHand(s);
  s.phase = 'playing';
  return s;
}

export function togglePot(prev: RunState, uid: string): RunState {
  if (prev.phase !== 'playing') return prev;
  const s = clone(prev);
  if (s.pot.includes(uid)) {
    s.pot = s.pot.filter((u) => u !== uid);
  } else {
    if (!s.hand.includes(uid)) throw new GameError('这张牌不在手中');
    if (s.pot.length >= maxSelect(s)) throw new GameError(`一次最多放 ${maxSelect(s)} 张食材`);
    s.pot.push(uid);
  }
  return s;
}

export function setPotOrder(prev: RunState, order: string[]): RunState {
  const same = order.length === prev.pot.length && order.every((u) => prev.pot.includes(u));
  if (!same) throw new GameError('锅中食材不一致');
  const s = clone(prev);
  s.pot = order.slice();
  return s;
}

export function clearPot(prev: RunState): RunState {
  const s = clone(prev);
  s.pot = [];
  return s;
}

export function sortHand(prev: RunState, by: 'type' | 'chips'): RunState {
  const s = clone(prev);
  const order = ['meat', 'seafood', 'veg', 'mushroom', 'spice', 'staple', 'egg', 'broth', 'special'];
  const key = (uid: string) => {
    const c = cardByUid(s, uid);
    const d = INGREDIENTS[c.defId];
    return by === 'type' ? order.indexOf(d.types[0]) * 1000 - d.chips : -(d.chips + (c.level - 1) * 10);
  };
  s.hand.sort((a, b) => key(a) - key(b) || a.localeCompare(b));
  return s;
}

export function cookInput(s: RunState, preview: boolean): CookInput {
  return {
    cards: s.pot.map((u) => cardByUid(s, u)),
    tools: s.tools,
    recipeLevels: s.recipeLevels,
    bossId: currentBossId(s),
    cooksDoneThisLevel: s.levelState.cooksDone,
    usedRecipes: s.levelState.usedRecipes,
    gold: s.gold,
    preview,
  };
}

/** 预览：不改变状态 */
export function previewCook(s: RunState): CookResult | null {
  if (s.pot.length === 0) return null;
  return scoreCook(cookInput(s, true));
}

export function computeReward(s: RunState): LevelReward {
  const isBoss = !!currentBossId(s);
  const base = isBoss ? RULES.rewardBoss : RULES.rewardNormal;
  const cooksBonus = s.levelState.cooksLeft * RULES.rewardPerCookLeft;
  const interest = Math.min(RULES.interestMax, Math.floor(s.gold / RULES.interestPer));
  return { base, cooksBonus, interest, total: base + cooksBonus + interest };
}

export function cook(prev: RunState): RunState {
  if (prev.phase !== 'playing') throw new GameError('现在不能烹饪');
  if (prev.pot.length === 0) throw new GameError('锅里还没有食材');
  if (prev.levelState.cooksLeft <= 0) throw new GameError('没有烹饪次数了');
  const s = clone(prev);
  const result = scoreCook(cookInput(s, false));

  for (const [uid, data] of Object.entries(result.toolData)) {
    const t = s.tools.find((x) => x.uid === uid);
    if (t) t.data = { ...t.data, ...data };
  }
  s.gold += result.gold;
  s.stats.goldEarned += result.gold;

  const ls = s.levelState;
  ls.score = add(ls.score, result.score);
  ls.cooksLeft -= 1;
  ls.cooksDone += 1;
  ls.usedRecipes.push(result.recipeId);

  s.stats.cooks += 1;
  s.stats.totalScore = add(s.stats.totalScore, result.score);
  s.stats.recipeCounts[result.recipeId] = (s.stats.recipeCounts[result.recipeId] ?? 0) + 1;
  if (gt(result.score, s.stats.bestCook)) {
    s.stats.bestCook = result.score;
    s.stats.bestCookRecipe = result.recipeId;
  }
  for (const e of result.events) if (e.kind === 'xmult' && e.amount && e.amount > s.stats.biggestXMult) s.stats.biggestXMult = e.amount;

  s.hand = s.hand.filter((u) => !s.pot.includes(u));
  s.discardPile.push(...s.pot);
  s.pot = [];
  s.lastResult = result;

  if (gte(ls.score, ls.target)) {
    s.reward = computeReward(s);
    s.phase = 'levelWon';
  } else if (ls.cooksLeft <= 0) {
    s.phase = 'gameOver';
  } else {
    drawToHand(s);
  }
  return s;
}

export function discard(prev: RunState): RunState {
  if (prev.phase !== 'playing') throw new GameError('现在不能弃牌');
  if (prev.pot.length === 0) throw new GameError('先选择要弃掉的食材');
  if (prev.levelState.discardsLeft <= 0) throw new GameError('没有弃牌次数了');
  const s = clone(prev);
  const cards = s.pot.map((u) => cardByUid(s, u));
  for (const t of s.tools) {
    const def = TOOLS[t.defId];
    const next = def?.hooks.onDiscard?.(t, cards);
    if (next) t.data = { ...t.data, ...next };
  }
  s.hand = s.hand.filter((u) => !s.pot.includes(u));
  s.discardPile.push(...s.pot);
  s.pot = [];
  s.levelState.discardsLeft -= 1;
  s.stats.discards += 1;
  drawToHand(s);
  return s;
}

/** 过关结算 → 商店（或通关） */
export function collectReward(prev: RunState): RunState {
  if (prev.phase !== 'levelWon' || !prev.reward) throw new GameError('还没有过关');
  const s = clone(prev);
  s.gold += s.reward!.total;
  s.stats.goldEarned += s.reward!.total;
  s.stats.levelsCleared += 1;
  s.reward = null;
  s.hand = [];
  s.pot = [];
  if (s.level === FINAL_LEVEL && !s.endless) {
    s.phase = 'victory';
    return s;
  }
  s.phase = 'shop';
  s.shop = generateShop(s);
  return s;
}

export function continueEndless(prev: RunState): RunState {
  if (prev.phase !== 'victory') throw new GameError('还没有通关');
  const s = clone(prev);
  s.endless = true;
  s.phase = 'shop';
  s.shop = generateShop(s);
  return s;
}

export function leaveShop(prev: RunState): RunState {
  if (prev.phase !== 'shop') throw new GameError('不在商店中');
  const s = clone(prev);
  s.shop = null;
  s.level += 1;
  s.levelState = makeLevelState(s, s.level);
  s.lastResult = null;
  s.phase = 'levelIntro';
  return s;
}

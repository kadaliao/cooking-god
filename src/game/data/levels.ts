import { big, mul, type Big } from '../scoring/bignum';

export const RULES = {
  handSize: 8,
  maxSelect: 5,
  cooksPerLevel: 4,
  discardsPerLevel: 3,
  toolSlots: 5,
  startingGold: 4,
  /** 每局最多重复结算一张牌的次数（防止失控） */
  maxRetriggersPerCard: 6,
  /** 单次烹饪事件上限，超出即截断（理论上不会触发，作为死循环保险） */
  maxEvents: 4000,
  rewardNormal: 3,
  rewardBoss: 5,
  rewardPerCookLeft: 1,
  interestPer: 5,
  interestMax: 5,
  rerollBase: 2,
  removeCost: 3,
  sellRatio: 0.5,
};

export interface LevelInfo {
  level: number;
  chapter: number;
  stage: number;
  bossId?: string;
  name: string;
}

const CHAPTER_NAMES = ['街边小馆', '城市名厨', '神之厨房'];
const STAGE_NAMES = [
  ['早点摊', '大排档', 'Boss'],
  ['私房菜馆', '酒楼宴席', 'Boss'],
  ['国宴后厨', '云端御膳房', 'Boss'],
];
const BOSS_BY_LEVEL: Record<number, string> = { 3: 'blandJudge', 6: 'pickyGourmet', 9: 'foodGod' };

/** 9 关的基础目标（Boss 关还会乘上 Boss 的 targetMult） */
const BASE_TARGETS = [300, 800, 2000, 5000, 12000, 30000, 75000, 180000, 400000];

export const FINAL_LEVEL = 9;

export function levelInfo(level: number): LevelInfo {
  if (level > FINAL_LEVEL) {
    const bossCycle = ['blandJudge', 'pickyGourmet', 'foodGod'];
    const k = level - FINAL_LEVEL;
    const isBoss = k % 3 === 0;
    return {
      level,
      chapter: 4,
      stage: ((k - 1) % 3) + 1,
      bossId: isBoss ? bossCycle[(k / 3 - 1) % 3] : undefined,
      name: `无尽料理 · 第 ${k} 关`,
    };
  }
  const chapter = Math.ceil(level / 3);
  const stage = ((level - 1) % 3) + 1;
  const bossId = BOSS_BY_LEVEL[level];
  return {
    level,
    chapter,
    stage,
    bossId,
    name: `${CHAPTER_NAMES[chapter - 1]} · ${bossId ? 'Boss' : STAGE_NAMES[chapter - 1][stage - 1]}`,
  };
}

export function baseTarget(level: number): Big {
  if (level <= FINAL_LEVEL) return big(BASE_TARGETS[level - 1]);
  // 无尽模式：每关 ×4
  return mul(big(BASE_TARGETS[FINAL_LEVEL - 1] * 3), big(Math.pow(4, level - FINAL_LEVEL)));
}

import type { RecipeDef } from '../types';

export const DEFAULT_RECIPE_ID = 'luandun';

/**
 * 10 种料理 + 1 个兜底。匹配时取所有满足条件的配方中 tier 最高的；
 * tier 相同取 (筹码 × 倍率) 更高的。
 * 条件按「未被禁用的牌、有效标签」计数，一张牌可以同时满足多个条件。
 */
export const RECIPE_LIST: RecipeDef[] = [
  {
    id: 'luandun',
    name: '家常乱炖',
    tier: 0,
    chips: 10,
    mult: 1,
    levelChips: 10,
    levelMult: 1,
    requirements: [],
    condition: '任意食材（兜底料理）',
    flavorText: '什么都往锅里扔，居然也能吃。',
  },
  {
    id: 'liangban',
    name: '凉拌菜',
    tier: 1,
    chips: 30,
    mult: 2,
    levelChips: 15,
    levelMult: 1,
    requirements: [{ kind: 'tag', tag: 'veg', count: 2 }],
    condition: '至少 2 张蔬菜',
    flavorText: '清爽开胃。',
  },
  {
    id: 'hunsu',
    name: '荤素搭配',
    tier: 2,
    chips: 35,
    mult: 3,
    levelChips: 15,
    levelMult: 2,
    requirements: [
      { kind: 'tag', tag: 'meat', count: 1 },
      { kind: 'tag', tag: 'veg', count: 1 },
    ],
    condition: '肉类 + 蔬菜',
    flavorText: '营养均衡，妈妈放心。',
  },
  {
    id: 'eggrice',
    name: '蛋炒饭',
    tier: 2,
    chips: 40,
    mult: 3,
    levelChips: 20,
    levelMult: 2,
    requirements: [
      { kind: 'ingredient', ids: ['rice'], count: 1 },
      { kind: 'tag', tag: 'egg', count: 1 },
    ],
    condition: '米饭 + 鸡蛋',
    flavorText: '粒粒分明，金包银。',
  },
  {
    id: 'tomatoegg',
    name: '番茄炒蛋',
    tier: 2,
    chips: 40,
    mult: 3,
    levelChips: 20,
    levelMult: 2,
    requirements: [
      { kind: 'ingredient', ids: ['tomato'], count: 1 },
      { kind: 'tag', tag: 'egg', count: 1 },
    ],
    condition: '番茄 + 鸡蛋',
    flavorText: '国民第一菜。',
  },
  {
    id: 'jiachang',
    name: '家常小炒',
    tier: 3,
    chips: 60,
    mult: 4,
    levelChips: 25,
    levelMult: 2,
    requirements: [
      { kind: 'tag', tag: 'meat', count: 1 },
      { kind: 'tag', tag: 'veg', count: 1 },
      { kind: 'ingredient', ids: ['garlic'], count: 1 },
    ],
    condition: '肉类 + 蔬菜 + 大蒜',
    flavorText: '锅气十足。',
  },
  {
    id: 'seafood',
    name: '海鲜料理',
    tier: 3,
    chips: 60,
    mult: 4,
    levelChips: 25,
    levelMult: 2,
    requirements: [{ kind: 'tag', tag: 'seafood', count: 2 }],
    condition: '至少 2 张海鲜',
    flavorText: '一口吃掉整个大海。',
  },
  {
    id: 'bbq',
    name: '烧烤拼盘',
    tier: 4,
    chips: 80,
    mult: 5,
    levelChips: 30,
    levelMult: 3,
    requirements: [{ kind: 'tag', tag: 'meat', count: 3 }],
    condition: '至少 3 张肉类',
    flavorText: '撸串，必须的。',
  },
  {
    id: 'mala',
    name: '麻辣料理',
    tier: 4,
    chips: 90,
    mult: 5,
    levelChips: 30,
    levelMult: 3,
    requirements: [
      { kind: 'tag', tag: 'meat', count: 1 },
      { kind: 'tag', tag: 'spicy', count: 1 },
      { kind: 'tag', tag: 'numbing', count: 1 },
    ],
    condition: '肉类 + 辣味 + 麻味',
    flavorText: '又麻又辣，停不下来。',
  },
  {
    id: 'hotpot',
    name: '豪华火锅',
    tier: 5,
    chips: 120,
    mult: 7,
    levelChips: 40,
    levelMult: 3,
    requirements: [
      { kind: 'tag', tag: 'meat', count: 1 },
      { kind: 'tag', tag: 'veg', count: 1 },
      { kind: 'tag', tag: 'mushroom', count: 1 },
      { kind: 'tag', tag: 'broth', count: 1 },
    ],
    condition: '肉类 + 蔬菜 + 菌菇 + 锅底',
    flavorText: '万物皆可涮。',
  },
  {
    id: 'dark',
    name: '黑暗料理',
    tier: 6,
    chips: 150,
    mult: 8,
    levelChips: 50,
    levelMult: 4,
    requirements: [
      { kind: 'minCards', count: 5 },
      { kind: 'distinctTypes', count: 5 },
      { kind: 'tag', tag: 'special', count: 1 },
    ],
    condition: '5 张食材，覆盖至少 5 种类型，且含特殊食材',
    flavorText: '评委看了沉默，吃了流泪。',
  },
];

export const RECIPES: Record<string, RecipeDef> = Object.fromEntries(RECIPE_LIST.map((r) => [r.id, r]));

export function recipeBase(recipe: RecipeDef, level: number) {
  return {
    chips: recipe.chips + (level - 1) * recipe.levelChips,
    mult: recipe.mult + (level - 1) * recipe.levelMult,
  };
}

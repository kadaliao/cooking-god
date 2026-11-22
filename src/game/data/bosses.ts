import type { BossDef } from '../types';

export const BOSS_LIST: BossDef[] = [
  {
    id: 'blandJudge',
    name: '清淡主义评委',
    title: '第一章 Boss',
    rules: ['辣味、麻味食材全部失效：不提供筹码，不计入配方，不触发任何厨具和技法。', '「麻辣料理」在本关无法做出。'],
    targetMult: 1,
    disableCard: (tags) => tags.has('spicy') || tags.has('numbing'),
    bannedRecipes: ['mala'],
    quote: '「食物本来的味道，才是最高的味道。」',
  },
  {
    id: 'pickyGourmet',
    name: '挑剔的美食家',
    title: '第二章 Boss',
    rules: ['本关内，重复做同一种料理，该次得分 ×0.25。', '每次都要换一道菜！'],
    targetMult: 1,
    afterCook(ctx, usedRecipes) {
      if (usedRecipes.includes(ctx.recipe.id)) ctx.xMult(0.25, `又是${ctx.recipe.name}？评分 ×0.25`);
    },
    quote: '「同一道菜？我昨天已经吃过了。」',
  },
  {
    id: 'foodGod',
    name: '终极食神',
    title: '最终 Boss',
    rules: ['目标分数是平时的 3 倍。', '没有任何花招——只有成熟的连锁构筑才能打动食神。'],
    targetMult: 3,
    quote: '「让我看看，你的料理之道。」',
  },
];

export const BOSSES: Record<string, BossDef> = Object.fromEntries(BOSS_LIST.map((b) => [b.id, b]));

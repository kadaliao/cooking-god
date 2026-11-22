import type { TechniqueDef } from '../types';

/**
 * 烹饪技法：由食材在锅中的「顺序」触发。
 * 检查时只看未被禁用的牌，第 i 张牌结算时判断以它结尾的组合。
 */
export const TECHNIQUE_LIST: TechniqueDef[] = [
  {
    id: 'qianguo',
    name: '炝锅',
    desc: '第 1 张放大蒜或生姜：+3 倍率',
    match: (a, i) => i === 0 && (a[0].def.id === 'garlic' || a[0].def.id === 'ginger'),
    apply: (ctx) => ctx.addMult(3, '炝锅 +3 倍率'),
  },
  {
    id: 'baochao',
    name: '爆炒',
    desc: '香料后面紧跟肉类：+4 倍率',
    match: (a, i, has) => i >= 1 && has(a[i - 1], 'spice') && has(a[i], 'meat'),
    apply: (ctx) => ctx.addMult(4, '爆炒 +4 倍率'),
  },
  {
    id: 'yanzhi',
    name: '腌制',
    desc: '肉类后面紧跟香料：这块肉的筹码再算一遍',
    match: (a, i, has) => i >= 1 && has(a[i - 1], 'meat') && has(a[i], 'spice'),
    apply: (ctx, a, i) => {
      const meat = a[i - 1];
      const chips = meat.def.chips + (meat.card.level - 1) * 10;
      ctx.addChips(chips, `腌制：${meat.def.name} 再 +${chips} 筹码`);
    },
  },
  {
    id: 'xianxian',
    name: '鲜上加鲜',
    desc: '海鲜后面紧跟菌菇：+6 倍率',
    match: (a, i, has) => i >= 1 && has(a[i - 1], 'seafood') && has(a[i], 'mushroom'),
    apply: (ctx) => ctx.addMult(6, '鲜上加鲜 +6 倍率'),
  },
  {
    id: 'sanlian',
    name: '三连同类',
    desc: '连续 3 张拥有同一类型：+60 筹码',
    match: (a, i, has) => {
      if (i < 2) return false;
      const types = ['meat', 'seafood', 'veg', 'mushroom', 'spice', 'staple', 'egg', 'broth'] as const;
      return types.some((t) => has(a[i - 2], t) && has(a[i - 1], t) && has(a[i], t));
    },
    apply: (ctx) => ctx.addChips(60, '三连同类 +60 筹码'),
  },
  {
    id: 'shouzhi',
    name: '收汁',
    desc: '最后 1 张放主食或锅底（至少 3 张食材）：倍率 ×1.5',
    match: (a, i, has) => i === a.length - 1 && a.length >= 3 && (has(a[i], 'staple') || has(a[i], 'broth')),
    apply: (ctx) => ctx.xMult(1.5, '收汁 ×1.5 倍率'),
  },
];

export const TECHNIQUES: Record<string, TechniqueDef> = Object.fromEntries(TECHNIQUE_LIST.map((t) => [t.id, t]));

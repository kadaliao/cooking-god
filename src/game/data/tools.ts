import type { ToolDef } from '../types';
import { RECIPES } from './recipes';

/**
 * 厨具与技能（23 个）。
 *
 * 触发时机：
 *   modifyTags → onCookStart → (配方匹配) → onRecipeMatched
 *   → 逐张食材 [食材筹码 → 强化 → 食材效果 → 烹饪技法 → onIngredientPlayed] × (1 + 重复次数)
 *   → onCookEnd → Boss 规则
 * 同一时机内，厨具按玩家排列的顺序（从上到下）依次触发。
 *
 * 新增厨具：在列表里加一条，实现需要的 hooks 即可；美术在 scripts/art/manifest.json 里加 tools/<id>。
 */
export const TOOL_LIST: ToolDef[] = [
  // ───────── 肉类乘算 ─────────
  {
    id: 'heirloomWok',
    name: '祖传铁锅',
    kind: 'tool',
    rarity: 'rare',
    price: 8,
    routes: ['meat'],
    desc: '每结算一张肉类食材，倍率 ×2',
    hooks: {
      onIngredientPlayed(ctx, _self, card) {
        if (ctx.hasTag(card, 'meat')) ctx.xMult(2, `${card.def.name}是肉！×2`);
      },
    },
  },
  {
    id: 'grill',
    name: '炭火烤架',
    kind: 'tool',
    rarity: 'common',
    price: 5,
    routes: ['meat'],
    desc: '每张肉类 +20 筹码；做出「烧烤拼盘」时倍率 ×2',
    hooks: {
      onIngredientPlayed(ctx, _self, card) {
        if (ctx.hasTag(card, 'meat')) ctx.addChips(20, `炭烤${card.def.name} +20`);
      },
      onCookEnd(ctx) {
        if (ctx.recipe.id === 'bbq') ctx.xMult(2, '烧烤拼盘 ×2');
      },
    },
  },
  {
    id: 'molecular',
    name: '分子料理机',
    kind: 'tool',
    rarity: 'rare',
    price: 7,
    routes: ['meat', 'rule'],
    desc: '规则改变：所有蔬菜同时算作肉类，所有肉类同时算作蔬菜',
    hooks: {
      modifyTags(card, tags) {
        const hadMeat = tags.has('meat');
        const hadVeg = tags.has('veg');
        if (hadVeg) tags.add('meat');
        if (hadMeat) tags.add('veg');
        void card;
      },
    },
  },
  // ───────── 辣味连锁 ─────────
  {
    id: 'hellOil',
    name: '地狱辣油',
    kind: 'tool',
    rarity: 'rare',
    price: 8,
    routes: ['spicy'],
    desc: '每结算一张辣味食材，倍率 ×3',
    hooks: {
      onIngredientPlayed(ctx, _self, card) {
        if (ctx.hasTag(card, 'spicy')) ctx.xMult(3, `${card.def.name}辣爆了！×3`);
      },
    },
  },
  {
    id: 'malaChain',
    name: '麻辣连锁',
    kind: 'skill',
    rarity: 'uncommon',
    price: 6,
    routes: ['spicy', 'order'],
    desc: '每结算一次辣/麻食材，连锁数 +1，并 +3×连锁数 倍率（3、6、9…）',
    hooks: {
      onIngredientPlayed(ctx, self, card) {
        if (ctx.hasTag(card, 'spicy') || ctx.hasTag(card, 'numbing')) {
          const s = ctx.scratch(self);
          s.chain = (s.chain ?? 0) + 1;
          ctx.addMult(3 * s.chain, `麻辣 ${s.chain} 连锁 +${3 * s.chain}`);
        }
      },
    },
  },
  {
    id: 'goldenSpatula',
    name: '黄金锅铲',
    kind: 'tool',
    rarity: 'legendary',
    price: 10,
    routes: ['spicy', 'meat', 'order'],
    desc: '锅中第 1 张食材的全部效果额外触发 2 次',
    hooks: {
      retriggers(_ctx, _self, card) {
        return card.index === 0 ? 2 : 0;
      },
    },
  },
  // ───────── 永久成长 ─────────
  {
    id: 'centuryBroth',
    name: '百年老汤',
    kind: 'tool',
    rarity: 'uncommon',
    price: 6,
    routes: ['growth'],
    desc: '每完成一次料理，永久 +25 筹码',
    initData: { chips: 0 },
    status: (self) => `当前 +${self.data.chips ?? 0} 筹码`,
    hooks: {
      onRecipeMatched(ctx, self) {
        const c = self.data.chips ?? 0;
        if (c > 0) ctx.addChips(c, `老汤底蕴 +${c}`);
      },
      onCookEnd(ctx, self) {
        ctx.grow(self, 'chips', 25, '老汤又熬了一轮：永久 +25 筹码');
      },
    },
  },
  {
    id: 'pickleJar',
    name: '腌菜坛',
    kind: 'tool',
    rarity: 'uncommon',
    price: 6,
    routes: ['growth'],
    desc: '每结算一张蔬菜，坛子永久 +×0.1 倍率；每次料理结束时倍率 ×坛中数值',
    initData: { xmult: 1 },
    status: (self) => `当前 ×${(self.data.xmult ?? 1).toFixed(1)}`,
    hooks: {
      onIngredientPlayed(ctx, self, card) {
        if (ctx.hasTag(card, 'veg')) ctx.grow(self, 'xmult', 0.1, `${card.def.name}入坛：永久 +×0.1`);
      },
      onCookEnd(ctx, self) {
        const x = Math.round((self.data.xmult ?? 1) * 100) / 100;
        if (x > 1) ctx.xMult(x, `陈年酸菜 ×${x}`);
      },
    },
  },
  {
    id: 'fridge',
    name: '老冰箱',
    kind: 'tool',
    rarity: 'common',
    price: 4,
    routes: ['growth'],
    desc: '每弃掉一张食材，永久 +10 筹码',
    initData: { chips: 0 },
    status: (self) => `当前 +${self.data.chips ?? 0} 筹码`,
    hooks: {
      onRecipeMatched(ctx, self) {
        const c = self.data.chips ?? 0;
        if (c > 0) ctx.addChips(c, `冰箱存货 +${c}`);
      },
      onDiscard(self, cards) {
        return { chips: (self.data.chips ?? 0) + cards.length * 10 };
      },
    },
  },
  {
    id: 'twiceCooked',
    name: '回锅秘术',
    kind: 'skill',
    rarity: 'rare',
    price: 7,
    routes: ['growth'],
    desc: '本关每已完成一次烹饪，本次倍率额外 ×0.5（第 2 次 ×1.5、第 3 次 ×2、第 4 次 ×2.5）',
    hooks: {
      onCookEnd(ctx) {
        const n = ctx.cooksDoneThisLevel;
        if (n > 0) ctx.xMult(1 + 0.5 * n, `回锅第 ${n + 1} 次 ×${1 + 0.5 * n}`);
      },
    },
  },
  // ───────── 重复 / 黑暗 ─────────
  {
    id: 'darkCookbook',
    name: '黑暗料理秘籍',
    kind: 'tool',
    rarity: 'rare',
    price: 7,
    routes: ['combo'],
    desc: '锅中每出现一张重复食材（与前面某张同名），倍率 ×4',
    hooks: {
      onIngredientPlayed(ctx, _self, card) {
        const dup = ctx.cards.some((c) => c.index < card.index && !c.disabled && c.def.id === card.def.id);
        if (dup) ctx.xMult(4, `又是${card.def.name}！×4`);
      },
    },
  },
  {
    id: 'autoWok',
    name: '自动炒锅',
    kind: 'tool',
    rarity: 'rare',
    price: 8,
    routes: ['combo'],
    desc: '复制上方最近一件可复制厨具的效果（不能复制自动炒锅，不会重复永久成长）',
    copyable: false,
    copiesLeft: true,
    hooks: {},
  },
  {
    id: 'michelin',
    name: '米其林之星',
    kind: 'tool',
    rarity: 'rare',
    price: 7,
    routes: ['combo'],
    desc: '高品质料理（家常小炒及以上，且没有重复食材）：倍率 ×3',
    hooks: {
      onCookEnd(ctx) {
        if (ctx.recipe.tier >= 3 && !ctx.hasDuplicates()) ctx.xMult(3, '摘星！×3');
      },
    },
  },
  // ───────── 基础 / 顺序 ─────────
  {
    id: 'knife',
    name: '大菜刀',
    kind: 'tool',
    rarity: 'common',
    price: 4,
    routes: ['meat', 'growth'],
    desc: '每张蔬菜 +4 倍率',
    hooks: {
      onIngredientPlayed(ctx, _self, card) {
        if (ctx.hasTag(card, 'veg')) ctx.addMult(4, `切${card.def.name} +4 倍率`);
      },
    },
  },
  {
    id: 'board',
    name: '老砧板',
    kind: 'tool',
    rarity: 'common',
    price: 4,
    routes: ['order'],
    desc: '每张食材 +15 筹码',
    hooks: {
      onIngredientPlayed(ctx, _self, card) {
        ctx.addChips(15, `${card.def.name} +15 筹码`);
      },
    },
  },
  {
    id: 'timer',
    name: '厨房沙漏',
    kind: 'tool',
    rarity: 'common',
    price: 5,
    routes: ['order'],
    desc: '第 N 个位置的食材 +2N 倍率（越靠后越强）',
    hooks: {
      onIngredientPlayed(ctx, _self, card) {
        const n = card.index + 1;
        ctx.addMult(2 * n, `第 ${n} 位 +${2 * n} 倍率`);
      },
    },
  },
  {
    id: 'ladle',
    name: '压轴汤勺',
    kind: 'tool',
    rarity: 'uncommon',
    price: 6,
    routes: ['order'],
    desc: '锅中最后 1 张食材的全部效果额外触发 1 次',
    hooks: {
      retriggers(ctx, _self, card) {
        return card.index === ctx.cards.length - 1 ? 1 : 0;
      },
    },
  },
  {
    id: 'wokToss',
    name: '颠勺秘诀',
    kind: 'skill',
    rarity: 'uncommon',
    price: 6,
    routes: ['order'],
    desc: '所有烹饪技法（炝锅、爆炒、腌制…）额外触发 1 次',
    hooks: {
      techniqueRepeats() {
        return 1;
      },
    },
  },
  {
    id: 'steamer',
    name: '竹蒸笼',
    kind: 'tool',
    rarity: 'uncommon',
    price: 5,
    routes: ['combo'],
    desc: '小份精致：锅中有效食材不超过 3 张时，倍率 ×3',
    hooks: {
      onCookEnd(ctx) {
        if (ctx.active.length <= 3) ctx.xMult(3, '小份精致 ×3');
      },
    },
  },
  {
    id: 'msg',
    name: '鲜味结晶',
    kind: 'tool',
    rarity: 'uncommon',
    price: 6,
    routes: ['umami'],
    desc: '每结算一张鲜味食材，倍率 ×1.5',
    hooks: {
      onIngredientPlayed(ctx, _self, card) {
        if (ctx.hasTag(card, 'umami')) ctx.xMult(1.5, `${card.def.name}好鲜 ×1.5`);
      },
    },
  },
  // ───────── 经济 / 规则 ─────────
  {
    id: 'luckyCat',
    name: '招财猫',
    kind: 'tool',
    rarity: 'uncommon',
    price: 6,
    routes: ['economy'],
    desc: '每次烹饪 +$1；结算末尾倍率 ×(1 + 持有金币 × 0.05)',
    hooks: {
      onCookEnd(ctx) {
        ctx.addGold(1, '招财 +$1');
        const f = Math.round((1 + ctx.gold * 0.05) * 100) / 100;
        if (f > 1) ctx.xMult(f, `金币 $${ctx.gold} ×${f}`);
      },
    },
  },
  {
    id: 'mitts',
    name: '隔热手套',
    kind: 'tool',
    rarity: 'uncommon',
    price: 5,
    routes: ['rule'],
    desc: '手牌上限 +1，每关弃牌次数 +1',
    passive: { handSize: 1, discards: 1 },
    hooks: {},
  },
  {
    id: 'prepStation',
    name: '多层料理台',
    kind: 'tool',
    rarity: 'rare',
    price: 7,
    routes: ['rule'],
    desc: '每次烹饪最多可放 6 张食材',
    passive: { maxSelect: 1 },
    hooks: {},
  },
];

export const TOOLS: Record<string, ToolDef> = Object.fromEntries(TOOL_LIST.map((t) => [t.id, t]));

export const ROUTE_INFO: Record<string, string> = {
  meat: '肉类乘算',
  spicy: '辣味连锁',
  growth: '永久成长',
  combo: '组合爆发',
  umami: '鲜味',
  order: '顺序技法',
  economy: '经济',
  rule: '规则改变',
};

// 防止拼写错误：Boss、烤架引用的配方必须存在
if (!RECIPES.bbq) throw new Error('bbq recipe missing');

import type { IngredientDef } from '../types';

/**
 * 30 种食材。新增食材：在这里加一条，再在 scripts/art/manifest.json 里加一张图。
 * chips = 基础筹码；effect = 结算时的额外效果（可选）。
 */
export const INGREDIENT_LIST: IngredientDef[] = [
  // 肉类
  { id: 'beef', name: '牛肉', types: ['meat'], flavors: ['rich'], chips: 30, rarity: 'common', price: 3, flavorText: '大块雪花，越煎越香。' },
  { id: 'pork', name: '猪肉', types: ['meat'], flavors: ['rich'], chips: 25, rarity: 'common', price: 3, flavorText: '五花三层，肥瘦相间。' },
  { id: 'chicken', name: '鸡肉', types: ['meat'], flavors: [], chips: 20, rarity: 'common', price: 2, flavorText: '百搭的老实人。' },
  { id: 'lamb', name: '羊肉', types: ['meat'], flavors: ['rich'], chips: 28, rarity: 'uncommon', price: 4, effect: { kind: 'mult', amount: 2 }, flavorText: '自带一股草原的风。' },
  // 海鲜
  { id: 'fish', name: '鱼肉', types: ['meat', 'seafood'], flavors: ['umami'], chips: 22, rarity: 'common', price: 3, flavorText: '既是肉，也是海鲜。' },
  { id: 'shrimp', name: '虾', types: ['meat', 'seafood'], flavors: ['umami'], chips: 24, rarity: 'common', price: 3, flavorText: '弯弯的，很弹牙。' },
  { id: 'crab', name: '螃蟹', types: ['seafood'], flavors: ['umami'], chips: 35, rarity: 'uncommon', price: 5, effect: { kind: 'mult', amount: 3 }, flavorText: '横着走进了锅里。' },
  { id: 'squid', name: '鱿鱼', types: ['seafood'], flavors: ['umami'], chips: 20, rarity: 'common', price: 3, flavorText: '一遇热就卷成花。' },
  // 蔬菜
  { id: 'tomato', name: '番茄', types: ['veg'], flavors: ['sour'], chips: 15, rarity: 'common', price: 2, flavorText: '酸甜多汁，炒蛋绝配。' },
  { id: 'potato', name: '土豆', types: ['veg'], flavors: [], chips: 12, rarity: 'common', price: 2, flavorText: '朴实无华，人见人爱。' },
  { id: 'cabbage', name: '白菜', types: ['veg'], flavors: ['fresh'], chips: 10, rarity: 'common', price: 2, flavorText: '冬天的守护神。' },
  { id: 'eggplant', name: '茄子', types: ['veg'], flavors: [], chips: 14, rarity: 'common', price: 2, flavorText: '吸油能力满分。' },
  { id: 'greenpepper', name: '青椒', types: ['veg'], flavors: ['aromatic'], chips: 12, rarity: 'common', price: 2, flavorText: '看起来辣，其实不辣。' },
  { id: 'cucumber', name: '黄瓜', types: ['veg'], flavors: ['fresh'], chips: 10, rarity: 'common', price: 2, effect: { kind: 'chips', amount: 10 }, flavorText: '拍一拍更入味。' },
  // 菌菇
  { id: 'shiitake', name: '香菇', types: ['mushroom'], flavors: ['umami'], chips: 16, rarity: 'common', price: 3, flavorText: '一朵就能鲜一锅。' },
  { id: 'enoki', name: '金针菇', types: ['mushroom'], flavors: ['umami'], chips: 14, rarity: 'common', price: 3, flavorText: 'See you tomorrow.' },
  { id: 'woodear', name: '木耳', types: ['mushroom'], flavors: [], chips: 12, rarity: 'common', price: 2, effect: { kind: 'mult', amount: 1 }, flavorText: '爽脆，像在听锅说话。' },
  // 香料
  { id: 'chili', name: '辣椒', types: ['spice'], flavors: ['spicy'], chips: 10, rarity: 'common', price: 2, effect: { kind: 'mult', amount: 3 }, flavorText: '一点就着。' },
  { id: 'sichuanpepper', name: '花椒', types: ['spice'], flavors: ['numbing'], chips: 10, rarity: 'common', price: 2, effect: { kind: 'mult', amount: 2 }, flavorText: '舌头开始跳舞。' },
  { id: 'ginger', name: '生姜', types: ['spice'], flavors: ['aromatic'], chips: 8, rarity: 'common', price: 2, effect: { kind: 'mult', amount: 1 }, flavorText: '去腥担当。' },
  { id: 'garlic', name: '大蒜', types: ['spice'], flavors: ['aromatic'], chips: 8, rarity: 'common', price: 2, effect: { kind: 'mult', amount: 1 }, flavorText: '爆香第一步。' },
  // 主食
  { id: 'rice', name: '米饭', types: ['staple'], flavors: [], chips: 20, rarity: 'common', price: 2, flavorText: '隔夜饭炒饭最香。' },
  { id: 'noodles', name: '面条', types: ['staple'], flavors: [], chips: 20, rarity: 'common', price: 2, flavorText: '吸溜——' },
  { id: 'flour', name: '面粉', types: ['staple'], flavors: [], chips: 15, rarity: 'common', price: 2, effect: { kind: 'chips', amount: 15 }, flavorText: '万物皆可裹粉。' },
  // 蛋
  { id: 'egg', name: '鸡蛋', types: ['egg'], flavors: [], chips: 15, rarity: 'common', price: 2, flavorText: '先有鸡还是先有蛋炒饭？' },
  // 锅底
  { id: 'redbroth', name: '红油锅底', types: ['broth'], flavors: ['spicy'], chips: 25, rarity: 'uncommon', price: 4, effect: { kind: 'mult', amount: 4 }, flavorText: '牛油翻滚，红得发亮。' },
  { id: 'mushbroth', name: '菌汤锅底', types: ['broth'], flavors: ['umami'], chips: 25, rarity: 'uncommon', price: 4, effect: { kind: 'mult', amount: 4 }, flavorText: '先喝一碗汤。' },
  // 特殊
  { id: 'truffle', name: '松露', types: ['mushroom', 'special'], flavors: ['umami', 'aromatic'], chips: 40, rarity: 'rare', price: 6, effect: { kind: 'xmult', factor: 1.5 }, flavorText: '地下的黑钻石。' },
  { id: 'caviar', name: '鱼子酱', types: ['seafood', 'special'], flavors: ['umami'], chips: 50, rarity: 'rare', price: 7, effect: { kind: 'xmult', factor: 2 }, flavorText: '一勺抵一顿。' },
  { id: 'mystery', name: '神秘蘑菇', types: ['mushroom', 'special'], flavors: [], chips: 5, rarity: 'rare', price: 5, effect: { kind: 'mimic', amount: 3 }, flavorText: '吃了它，你会看见小人在跳舞。' },
];

export const INGREDIENTS: Record<string, IngredientDef> = Object.fromEntries(INGREDIENT_LIST.map((d) => [d.id, d]));

/** 初始卡组（28 张） */
export const STARTING_DECK: Record<string, number> = {
  beef: 2,
  pork: 2,
  chicken: 2,
  fish: 1,
  shrimp: 1,
  tomato: 2,
  potato: 2,
  cabbage: 2,
  eggplant: 1,
  greenpepper: 1,
  shiitake: 1,
  chili: 2,
  sichuanpepper: 1,
  garlic: 2,
  ginger: 1,
  rice: 1,
  egg: 2,
  noodles: 1,
  mushbroth: 1,
};

export function describeIngredientEffect(def: IngredientDef): string | undefined {
  const e = def.effect;
  if (!e) return undefined;
  switch (e.kind) {
    case 'mult':
      return `结算时 +${e.amount} 倍率`;
    case 'xmult':
      return `结算时倍率 ×${e.factor}`;
    case 'chips':
      return `结算时额外 +${e.amount} 筹码`;
    case 'mimic':
      return `复制锅中前一张食材的所有标签，并 +${e.amount} 倍率`;
  }
}

export const cardChips = (def: IngredientDef, level: number) => def.chips + (level - 1) * 10;

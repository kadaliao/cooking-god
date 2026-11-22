import { add, big, cmp, format, mul, toNumber } from '../scoring/bignum';
import { scoreCook, type CookInput } from '../scoring/score';
import { RULES } from '../data/levels';
import { TOOL_LIST } from '../data/tools';
import { INGREDIENT_LIST } from '../data/ingredients';
import { hashSeed, next, randInt } from '../engine/rng';
import type { CardInstance, ToolInstance } from '../types';

let uid = 0;
const card = (defId: string, extra: Partial<CardInstance> = {}): CardInstance => ({ uid: `c${uid++}`, defId, level: 1, ...extra });
const tool = (defId: string, data: Record<string, number> = {}): ToolInstance => ({ uid: `t${uid++}`, defId, data });

function cookOf(defIds: string[], tools: ToolInstance[] = [], extra: Partial<CookInput> = {}) {
  return scoreCook({
    cards: defIds.map((d) => card(d)),
    tools,
    recipeLevels: {},
    cooksDoneThisLevel: 0,
    usedRecipes: [],
    gold: 0,
    ...extra,
  });
}
const n = (b: { m: number; e: number }) => toNumber(b);

describe('bignum', () => {
  it('adds and multiplies', () => {
    expect(n(add(big(100), big(23)))).toBe(123);
    expect(n(mul(big(500), big(2)))).toBe(1000);
    expect(n(mul(big(0.25), big(400)))).toBeCloseTo(100);
  });
  it('does not overflow beyond double range', () => {
    let x = big(1e200);
    x = mul(x, big(1e200));
    expect(x.e).toBe(400);
    expect(cmp(x, big(1e300))).toBe(1);
    expect(format(x)).toBe('1.00e400');
  });
  it('formats with separators', () => {
    expect(format(big(1234567))).toBe('1,234,567');
    expect(format(big(1.5), { decimals: 2 })).toBe('1.5');
  });
});

describe('recipe matching', () => {
  it('falls back to default recipe', () => {
    const r = cookOf(['cabbage']);
    expect(r.recipeId).toBe('luandun');
    // 乱炖 10×1，白菜 +10 筹码
    expect(n(r.score)).toBe(20);
  });
  it('picks the highest-tier recipe', () => {
    expect(cookOf(['tomato', 'egg']).recipeId).toBe('tomatoegg');
    expect(cookOf(['beef', 'tomato', 'egg']).recipeId).toBe('tomatoegg');
    expect(cookOf(['beef', 'tomato', 'egg', 'garlic']).recipeId).toBe('jiachang');
    expect(cookOf(['beef', 'pork', 'chicken']).recipeId).toBe('bbq');
  });
  it('hotpot requires a broth ingredient', () => {
    expect(cookOf(['beef', 'cabbage', 'shiitake']).recipeId).toBe('hunsu');
    expect(cookOf(['beef', 'cabbage', 'shiitake', 'mushbroth']).recipeId).toBe('hotpot');
  });
  it('dark cuisine needs 5 types and a special', () => {
    expect(cookOf(['beef', 'cabbage', 'shiitake', 'rice', 'egg']).recipeId).not.toBe('dark');
    expect(cookOf(['beef', 'cabbage', 'truffle', 'rice', 'egg']).recipeId).toBe('dark');
  });
  it('mystery mushroom copies tags of the previous ingredient', () => {
    expect(cookOf(['beef', 'pork', 'mystery']).recipeId).toBe('bbq');
    expect(cookOf(['mystery', 'beef', 'pork']).recipeId).not.toBe('bbq');
  });
  it('recipe level increases base values', () => {
    const lv1 = cookOf(['cabbage', 'potato']);
    const lv3 = cookOf(['cabbage', 'potato'], [], { recipeLevels: { liangban: 3 } });
    // 凉拌 30×2 → Lv3 60×4；白菜10 + 土豆12
    expect(n(lv1.score)).toBe((30 + 22) * 2);
    expect(n(lv3.score)).toBe((60 + 22) * 4);
  });
});

describe('order techniques', () => {
  it('order changes the result', () => {
    const a = cookOf(['garlic', 'beef', 'cabbage']);
    const b = cookOf(['beef', 'garlic', 'cabbage']);
    expect(a.techniques.map((t) => t.id).sort()).toEqual(['baochao', 'qianguo']);
    expect(b.techniques.map((t) => t.id)).toEqual(['yanzhi']);
    expect(cmp(a.score, b.score)).not.toBe(0);
  });
  it('computes stir-fry exactly', () => {
    // 家常小炒 60×4；蒜 8 +1倍率；炝锅 +3；牛肉 30；爆炒 +4；白菜 10
    const r = cookOf(['garlic', 'beef', 'cabbage']);
    expect(n(r.chips)).toBe(60 + 8 + 30 + 10);
    expect(n(r.mult)).toBe(4 + 1 + 3 + 4);
    expect(n(r.score)).toBe(108 * 12);
  });
  it('marinate re-adds the meat chips', () => {
    const r = cookOf(['beef', 'garlic', 'cabbage']);
    expect(n(r.chips)).toBe(60 + 30 + 8 + 30 + 10);
  });
  it('finish technique multiplies at the end', () => {
    const r = cookOf(['beef', 'pork', 'rice']);
    expect(r.techniques.some((t) => t.id === 'shouzhi')).toBe(true);
  });
  it('wok toss repeats techniques', () => {
    const base = cookOf(['garlic', 'beef', 'cabbage']);
    const toss = cookOf(['garlic', 'beef', 'cabbage'], [tool('wokToss')]);
    expect(n(toss.mult) - n(base.mult)).toBe(3 + 4);
  });
});

describe('tools', () => {
  it('heirloom wok doubles per meat', () => {
    const r = cookOf(['beef', 'pork', 'chicken'], [tool('heirloomWok')]);
    // 烧烤 80×5；三连同类 +60
    expect(n(r.chips)).toBe(80 + 30 + 25 + 20 + 60);
    expect(n(r.mult)).toBe(5 * 8);
  });
  it('spec example: golden spatula retriggers hell oil on the first chili', () => {
    // 乱炖 10×1；辣椒 +10 筹码 +3 倍率；辣油 ×3；共结算 3 次
    const r = cookOf(['chili'], [tool('hellOil'), tool('goldenSpatula')]);
    expect(n(r.chips)).toBe(10 + 30);
    // ((1+3)×3 → 12；+3 → 15，×3 → 45；+3 → 48，×3 → 144)
    expect(n(r.mult)).toBe(144);
    expect(n(r.score)).toBe(40 * 144);
    expect(r.events.filter((e) => e.kind === 'retrigger')).toHaveLength(2);
  });
  it('tool order matters (+mult before ×mult)', () => {
    const a = cookOf(['cabbage', 'potato'], [tool('knife'), tool('pickleJar', { xmult: 2 })]);
    const b = cookOf(['cabbage', 'potato'], [tool('pickleJar', { xmult: 2 }), tool('knife')]);
    // 腌菜坛在结束时乘算，所以与菜刀顺序无关
    expect(n(a.score)).toBe(n(b.score));
    const c = cookOf(['chili', 'garlic'], [tool('hellOil'), tool('malaChain')]);
    const d = cookOf(['chili', 'garlic'], [tool('malaChain'), tool('hellOil')]);
    expect(n(c.score)).not.toBe(n(d.score));
  });
  it('auto wok copies the nearest tool above it', () => {
    const r = cookOf(['beef'], [tool('heirloomWok'), tool('autoWok')]);
    expect(n(r.mult)).toBe(1 * 4);
    const nothing = cookOf(['beef'], [tool('autoWok'), tool('heirloomWok')]);
    expect(n(nothing.mult)).toBe(2);
  });
  it('auto wok cannot copy itself and copies do not double growth', () => {
    const broth = tool('centuryBroth', { chips: 0 });
    const r = cookOf(['beef'], [broth, tool('autoWok'), tool('autoWok')]);
    expect(r.toolData[broth.uid].chips).toBe(25);
  });
  it('growth is recorded but inputs are not mutated', () => {
    const jar = tool('pickleJar', { xmult: 1 });
    const r = cookOf(['cabbage', 'potato'], [jar]);
    expect(jar.data.xmult).toBe(1);
    expect(r.toolData[jar.uid].xmult).toBeCloseTo(1.2);
  });
  it('molecular gastronomy turns vegetables into meat', () => {
    const r = cookOf(['cabbage', 'potato', 'tomato'], [tool('molecular'), tool('heirloomWok')]);
    expect(r.recipeId).toBe('bbq');
    expect(n(r.mult)).toBe(5 * 8);
  });
  it('dark cookbook multiplies duplicates', () => {
    const r = cookOf(['beef', 'beef', 'beef'], [tool('darkCookbook')]);
    expect(n(r.mult)).toBe(5 * 16);
  });
  it('michelin requires high tier and no duplicates', () => {
    expect(n(cookOf(['garlic', 'beef', 'cabbage'], [tool('michelin')]).mult)).toBe(12 * 3);
    expect(n(cookOf(['beef', 'beef', 'pork'], [tool('michelin')]).mult)).toBe(5);
  });
  it('retriggers are capped', () => {
    const tools = [tool('goldenSpatula'), tool('autoWok'), tool('ladle')];
    const r = cookOf(['beef'], tools);
    const passes = r.events.filter((e) => e.kind === 'cardStart').length;
    expect(passes).toBe(1 + Math.min(2 + 2 + 1, RULES.maxRetriggersPerCard));
  });
  it('passive rule tools do not break scoring', () => {
    const r = cookOf(['beef'], [tool('mitts'), tool('prepStation')]);
    expect(n(r.score)).toBe((10 + 30) * 1);
  });
});

describe('bosses', () => {
  it('bland judge disables spicy and numbing ingredients', () => {
    const r = cookOf(['beef', 'chili', 'sichuanpepper'], [tool('hellOil')], { bossId: 'blandJudge' });
    expect(r.recipeId).toBe('luandun');
    expect(r.disabledIndexes).toEqual([1, 2]);
    expect(r.events.some((e) => e.kind === 'xmult')).toBe(false);
    expect(n(r.score)).toBe((10 + 30) * 1);
  });
  it('picky gourmet punishes repeated recipes', () => {
    const fresh = cookOf(['tomato', 'egg'], [], { bossId: 'pickyGourmet' });
    const again = cookOf(['tomato', 'egg'], [], { bossId: 'pickyGourmet', usedRecipes: ['tomatoegg'] });
    expect(n(again.score)).toBe(Math.floor(n(fresh.score) * 0.25));
  });
});

describe('no runaway loops (fuzz)', () => {
  it('random builds always terminate with finite scores', () => {
    const rng = { rng: hashSeed('fuzz') };
    for (let i = 0; i < 400; i++) {
      const tools: ToolInstance[] = [];
      const pool = TOOL_LIST.slice();
      for (let k = 0; k < 5; k++) {
        const t = pool.splice(randInt(rng, pool.length), 1)[0];
        tools.push(tool(t.id, { ...(t.initData ?? {}), chips: 500, xmult: 3 }));
      }
      // 额外塞入多个复制和重复触发
      if (next(rng) < 0.5) tools.push(tool('autoWok'), tool('autoWok'));
      const cards = Array.from({ length: 1 + randInt(rng, 6) }, () => INGREDIENT_LIST[randInt(rng, INGREDIENT_LIST.length)].id);
      const r = cookOf(cards, tools, { bossId: ['blandJudge', 'pickyGourmet', undefined][randInt(rng, 3)], usedRecipes: ['bbq'], gold: 50 });
      expect(r.truncated).toBe(false);
      expect(r.events.length).toBeLessThan(RULES.maxEvents);
      expect(Number.isFinite(r.score.m)).toBe(true);
      expect(r.score.m).toBeGreaterThanOrEqual(0);
    }
  });
});

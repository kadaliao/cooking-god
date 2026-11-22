import { BOSSES } from '../data/bosses';
import { cardChips } from '../data/ingredients';
import { RULES } from '../data/levels';
import { recipeBase } from '../data/recipes';
import { TECHNIQUE_LIST } from '../data/techniques';
import { ENHANCEMENT_INFO } from '../data/tags';
import { toolCalls, type ToolCall } from '../effects/dispatch';
import type {
  CardInstance,
  CookContextApi,
  CookResult,
  EffectSource,
  PotCard,
  RecipeDef,
  ScoreEvent,
  ScoreEventKind,
  Tag,
  ToolInstance,
} from '../types';
import { add, big, floor, mul, type Big } from './bignum';
import { buildPot, matchRecipe } from './recipeMatch';

export interface CookInput {
  cards: CardInstance[];
  tools: ToolInstance[];
  recipeLevels: Record<string, number>;
  bossId?: string;
  cooksDoneThisLevel: number;
  usedRecipes: string[];
  gold: number;
  preview?: boolean;
}

class EventOverflow extends Error {}

class CookContext implements CookContextApi {
  chips: Big = big(0);
  mult: Big = big(0);
  events: ScoreEvent[] = [];
  goldGained = 0;
  toolData: Record<string, Record<string, number>> = {};
  techniques: { id: string; index: number }[] = [];
  currentIndex = -1;
  pass = 0;
  private src: EffectSource = { kind: 'system' };
  private isCopy = false;
  private scratchMap: Record<string, Record<string, number>> = {};
  readonly active: PotCard[];

  constructor(
    readonly cards: PotCard[],
    readonly recipe: RecipeDef,
    readonly recipeLevel: number,
    private input: CookInput,
  ) {
    this.active = cards.filter((c) => !c.disabled);
  }

  get bossId() {
    return this.input.bossId;
  }
  get cooksDoneThisLevel() {
    return this.input.cooksDoneThisLevel;
  }
  get gold() {
    return this.input.gold + this.goldGained;
  }
  get preview() {
    return !!this.input.preview;
  }

  hasTag(card: PotCard, tag: Tag) {
    return !card.disabled && card.tags.has(tag);
  }

  hasDuplicates() {
    const seen = new Set<string>();
    for (const c of this.active) {
      if (seen.has(c.def.id)) return true;
      seen.add(c.def.id);
    }
    return false;
  }

  push(kind: ScoreEventKind, text: string, amount?: number) {
    if (this.events.length >= RULES.maxEvents) throw new EventOverflow();
    this.events.push({
      kind,
      src: this.src,
      amount,
      chips: this.chips,
      mult: this.mult,
      text,
      cardIndex: this.currentIndex >= 0 ? this.currentIndex : undefined,
      pass: this.pass,
    });
  }

  addChips(amount: number, text: string) {
    if (amount === 0) return;
    this.chips = add(this.chips, amount);
    this.push('chips', text, amount);
  }
  addMult(amount: number, text: string) {
    if (amount === 0) return;
    this.mult = add(this.mult, amount);
    this.push('mult', text, amount);
  }
  xMult(factor: number, text: string) {
    if (factor === 1) return;
    this.mult = mul(this.mult, factor);
    this.push('xmult', text, factor);
  }
  addGold(amount: number, text: string) {
    this.goldGained += amount;
    this.push('gold', text, amount);
  }
  grow(self: ToolInstance, key: string, delta: number, text: string) {
    if (this.isCopy) return;
    const data = (this.toolData[self.uid] ??= { ...self.data });
    data[key] = (data[key] ?? 0) + delta;
    this.push('growth', text, delta);
  }
  note(text: string) {
    this.push('note', text);
  }
  scratch(self: ToolInstance) {
    // 复制品使用独立的计数器
    const key = this.isCopy ? `${self.uid}#copy:${(this.src as { uid?: string }).uid}` : self.uid;
    return (this.scratchMap[key] ??= {});
  }

  with<T>(src: EffectSource, fn: () => T, isCopy = false): T {
    const prevSrc = this.src;
    const prevCopy = this.isCopy;
    this.src = src;
    this.isCopy = isCopy;
    try {
      return fn();
    } finally {
      this.src = prevSrc;
      this.isCopy = prevCopy;
    }
  }

  runTool(call: ToolCall, fn: () => void) {
    this.with(call.src, fn, call.isCopy);
  }
}

/**
 * 纯函数：给定锅中食材（有序）与当前构筑，计算一次烹饪的完整结算和事件日志。
 * 不修改任何输入。永久成长写在 result.toolData 里，由状态层决定是否应用。
 */
export function scoreCook(input: CookInput): CookResult {
  const pot = buildPot(input.cards, input.tools, input.bossId);
  const boss = input.bossId ? BOSSES[input.bossId] : undefined;
  const active = pot.filter((c) => !c.disabled);
  const recipe = matchRecipe(active, input.bossId);
  const level = input.recipeLevels[recipe.id] ?? 1;
  const ctx = new CookContext(pot, recipe, level, input);
  let truncated = false;

  try {
    // Boss 禁用提示
    for (const c of pot) {
      if (c.disabled && boss) {
        ctx.currentIndex = c.index;
        ctx.with({ kind: 'boss', id: boss.id }, () => ctx.push('disabled', `${c.def.name}被${boss.name}判定无效`));
      }
    }
    ctx.currentIndex = -1;

    for (const call of toolCalls(input.tools, 'onCookStart')) ctx.runTool(call, () => call.def.hooks.onCookStart!(ctx, call.self));

    // 配方
    const base = recipeBase(recipe, level);
    ctx.chips = big(base.chips);
    ctx.mult = big(base.mult);
    ctx.with({ kind: 'recipe', id: recipe.id }, () =>
      ctx.push('recipe', `${recipe.name} Lv.${level}：${base.chips} × ${base.mult}`),
    );

    for (const call of toolCalls(input.tools, 'onRecipeMatched'))
      ctx.runTool(call, () => call.def.hooks.onRecipeMatched!(ctx, call.self));

    const retriggerCalls = toolCalls(input.tools, 'retriggers');
    const techRepeatCalls = toolCalls(input.tools, 'techniqueRepeats');
    const playedCalls = toolCalls(input.tools, 'onIngredientPlayed');

    for (const card of pot) {
      if (card.disabled) continue;
      ctx.currentIndex = card.index;
      let extra = 0;
      for (const call of retriggerCalls) extra += call.def.hooks.retriggers!(ctx, call.self, card);
      const reps = 1 + Math.min(Math.max(0, extra), RULES.maxRetriggersPerCard);
      const ai = active.indexOf(card);

      for (let pass = 0; pass < reps; pass++) {
        ctx.pass = pass;
        if (pass > 0) {
          const call = retriggerCalls.find((c) => c.def.hooks.retriggers!(ctx, c.self, card) > 0);
          ctx.with(call?.src ?? { kind: 'system' }, () => ctx.push('retrigger', `再来一次！（第 ${pass + 1} 次）`));
        }
        ctx.with({ kind: 'ingredient', index: card.index }, () => {
          ctx.push('cardStart', card.def.name);
          ctx.addChips(cardChips(card.def, card.card.level), `${card.def.name} +${cardChips(card.def, card.card.level)} 筹码`);
          const e = card.def.effect;
          if (e?.kind === 'mult') ctx.addMult(e.amount, `${card.def.name} +${e.amount} 倍率`);
          else if (e?.kind === 'chips') ctx.addChips(e.amount, `${card.def.name} 额外 +${e.amount} 筹码`);
          else if (e?.kind === 'xmult') ctx.xMult(e.factor, `${card.def.name} ×${e.factor}`);
          else if (e?.kind === 'mimic') ctx.addMult(e.amount, `${card.def.name}变幻 +${e.amount} 倍率`);
        });
        const enh = card.card.enhancement;
        if (enh) {
          ctx.with({ kind: 'enhancement', index: card.index }, () => {
            const n = ENHANCEMENT_INFO[enh].name;
            if (enh === 'fresh') ctx.addChips(30, `${n} +30 筹码`);
            else if (enh === 'marinated') ctx.addMult(4, `${n} +4 倍率`);
            else if (enh === 'charred') ctx.xMult(1.5, `${n} ×1.5`);
            else if (enh === 'gilded') ctx.addGold(1, `${n} +$1`);
          });
        }
        // 烹饪技法（顺序）
        for (const tech of TECHNIQUE_LIST) {
          if (!tech.match(active, ai, (c, t) => c.tags.has(t))) continue;
          if (pass === 0) ctx.techniques.push({ id: tech.id, index: card.index });
          let times = 1;
          for (const call of techRepeatCalls) times += call.def.hooks.techniqueRepeats!(ctx, call.self);
          times = Math.min(times, 1 + RULES.maxRetriggersPerCard);
          for (let k = 0; k < times; k++) {
            ctx.with({ kind: 'technique', id: tech.id, index: card.index }, () => {
              ctx.push('technique', k === 0 ? `技法·${tech.name}` : `技法·${tech.name}（颠勺再来）`);
              tech.apply(ctx, active, ai);
            });
          }
        }
        for (const call of playedCalls) ctx.runTool(call, () => call.def.hooks.onIngredientPlayed!(ctx, call.self, card));
      }
      ctx.pass = 0;
    }
    ctx.currentIndex = -1;

    for (const call of toolCalls(input.tools, 'onCookEnd')) ctx.runTool(call, () => call.def.hooks.onCookEnd!(ctx, call.self));

    if (boss?.afterCook) ctx.with({ kind: 'boss', id: boss.id }, () => boss.afterCook!(ctx, input.usedRecipes));
  } catch (err) {
    if (!(err instanceof EventOverflow)) throw err;
    truncated = true;
  }

  const score = floor(mul(ctx.chips, ctx.mult));
  ctx.currentIndex = -1;
  ctx.events.push({
    kind: 'final',
    src: { kind: 'system' },
    chips: ctx.chips,
    mult: ctx.mult,
    text: '出锅！',
  });

  return {
    recipeId: recipe.id,
    recipeLevel: level,
    chips: ctx.chips,
    mult: ctx.mult,
    score,
    events: ctx.events,
    techniques: ctx.techniques,
    gold: ctx.goldGained,
    toolData: ctx.toolData,
    potUids: input.cards.map((c) => c.uid),
    disabledIndexes: pot.filter((c) => c.disabled).map((c) => c.index),
    truncated,
  };
}

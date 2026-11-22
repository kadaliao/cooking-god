import { BOSSES } from '../data/bosses';
import { INGREDIENTS } from '../data/ingredients';
import { DEFAULT_RECIPE_ID, RECIPES, RECIPE_LIST } from '../data/recipes';
import { TYPE_TAGS } from '../data/tags';
import { toolCalls } from '../effects/dispatch';
import type { CardInstance, PotCard, RecipeDef, Requirement, Tag, ToolInstance } from '../types';

/**
 * 计算锅中每张牌的有效标签：
 * 1. 食材自带的类型 + 风味
 * 2. 神秘蘑菇（mimic）复制前一张牌的最终标签
 * 3. 厨具 modifyTags（如分子料理机）
 * 4. Boss 禁用判定
 */
export function buildPot(cards: CardInstance[], tools: ToolInstance[], bossId?: string): PotCard[] {
  const boss = bossId ? BOSSES[bossId] : undefined;
  const tagCalls = toolCalls(tools, 'modifyTags');
  const pot: PotCard[] = [];
  cards.forEach((card, index) => {
    const def = INGREDIENTS[card.defId];
    if (!def) throw new Error(`Unknown ingredient ${card.defId}`);
    const tags = new Set<Tag>([...def.types, ...def.flavors]);
    if (def.effect?.kind === 'mimic' && index > 0) {
      for (const t of pot[index - 1].tags) tags.add(t);
    }
    for (const call of tagCalls) call.def.hooks.modifyTags!(
      { index, card, def, tags, disabled: false },
      tags,
    );
    const disabled = boss?.disableCard ? boss.disableCard(tags) : false;
    pot.push({ index, card, def, tags, disabled });
  });
  return pot;
}

function meets(req: Requirement, active: PotCard[]): boolean {
  switch (req.kind) {
    case 'tag':
      return active.filter((c) => c.tags.has(req.tag)).length >= req.count;
    case 'ingredient':
      return active.filter((c) => req.ids.includes(c.def.id)).length >= req.count;
    case 'minCards':
      return active.length >= req.count;
    case 'distinctTypes': {
      const s = new Set<string>();
      for (const c of active) for (const t of c.tags) if ((TYPE_TAGS as string[]).includes(t)) s.add(t);
      return s.size >= req.count;
    }
  }
}

export function recipeSatisfied(recipe: RecipeDef, active: PotCard[]): boolean {
  if (active.length === 0) return recipe.id === DEFAULT_RECIPE_ID;
  return recipe.requirements.every((r) => meets(r, active));
}

/** 所有满足条件的配方，按优先级从高到低 */
export function matchingRecipes(active: PotCard[], bossId?: string): RecipeDef[] {
  const banned = bossId ? BOSSES[bossId]?.bannedRecipes ?? [] : [];
  return RECIPE_LIST.filter((r) => !banned.includes(r.id) && recipeSatisfied(r, active)).sort(
    (a, b) => b.tier - a.tier || b.chips * b.mult - a.chips * a.mult,
  );
}

export function matchRecipe(active: PotCard[], bossId?: string): RecipeDef {
  return matchingRecipes(active, bossId)[0] ?? RECIPES[DEFAULT_RECIPE_ID];
}

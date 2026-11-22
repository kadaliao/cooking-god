import type { Big } from './scoring/bignum';

// ───────── 标签 ─────────
export type TypeTag = 'meat' | 'seafood' | 'veg' | 'mushroom' | 'spice' | 'staple' | 'egg' | 'broth' | 'special';
export type FlavorTag = 'spicy' | 'numbing' | 'sour' | 'umami' | 'aromatic' | 'rich' | 'fresh';
export type Tag = TypeTag | FlavorTag;

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Enhancement = 'fresh' | 'marinated' | 'charred' | 'gilded';

// ───────── 食材 ─────────
export type IngredientEffect =
  | { kind: 'mult'; amount: number }
  | { kind: 'xmult'; factor: number }
  | { kind: 'chips'; amount: number }
  /** 拟态：复制锅中前一张食材的全部标签，并 +amount 倍率 */
  | { kind: 'mimic'; amount: number };

export interface IngredientDef {
  id: string;
  name: string;
  types: TypeTag[];
  flavors: FlavorTag[];
  chips: number;
  rarity: Rarity;
  /** 商店购买价格 */
  price: number;
  effect?: IngredientEffect;
  flavorText: string;
}

/** 卡组里的一张具体食材卡 */
export interface CardInstance {
  uid: string;
  defId: string;
  /** 品质星级，1 起，每升 1 星 +10 筹码 */
  level: number;
  enhancement?: Enhancement;
}

// ───────── 配方 ─────────
export type Requirement =
  | { kind: 'tag'; tag: Tag; count: number }
  | { kind: 'ingredient'; ids: string[]; count: number }
  | { kind: 'distinctTypes'; count: number }
  | { kind: 'minCards'; count: number };

export interface RecipeDef {
  id: string;
  name: string;
  /** 越高越优先匹配 */
  tier: number;
  chips: number;
  mult: number;
  levelChips: number;
  levelMult: number;
  requirements: Requirement[];
  condition: string;
  flavorText: string;
}

// ───────── 厨具 ─────────
export interface ToolInstance {
  uid: string;
  defId: string;
  /** 永久成长等可变数据 */
  data: Record<string, number>;
}

export type EffectSource =
  | { kind: 'recipe'; id: string }
  | { kind: 'ingredient'; index: number }
  | { kind: 'enhancement'; index: number }
  | { kind: 'technique'; id: string; index: number }
  | { kind: 'tool'; uid: string; defId: string; copiedFrom?: string }
  | { kind: 'boss'; id: string }
  | { kind: 'system' };

/** 锅里一张参与结算的牌 */
export interface PotCard {
  index: number;
  card: CardInstance;
  def: IngredientDef;
  tags: Set<Tag>;
  /** 被 Boss 规则禁用：不计分、不计入配方、不触发厨具 */
  disabled: boolean;
}

export interface CookContextApi {
  readonly cards: PotCard[];
  readonly active: PotCard[];
  readonly recipe: RecipeDef;
  readonly recipeLevel: number;
  readonly bossId?: string;
  /** 本关已经完成的烹饪次数（不含本次） */
  readonly cooksDoneThisLevel: number;
  readonly gold: number;
  readonly preview: boolean;
  /** 当前正在结算的牌（onIngredientPlayed 期间） */
  readonly currentIndex: number;
  hasTag(card: PotCard, tag: Tag): boolean;
  /** 本次料理是否有重复食材 */
  hasDuplicates(): boolean;
  addChips(amount: number, text: string): void;
  addMult(amount: number, text: string): void;
  xMult(factor: number, text: string): void;
  addGold(amount: number, text: string): void;
  /** 永久成长：修改该厨具的 data。复制效果（自动炒锅）调用时无效，防止重复成长 */
  grow(self: ToolInstance, key: string, delta: number, text: string): void;
  note(text: string): void;
  /** 每个厨具在单次烹饪内的临时计数器 */
  scratch(self: ToolInstance): Record<string, number>;
}

export interface ToolHooks {
  /** 计算食材的有效标签（规则改变类） */
  modifyTags?(card: PotCard, tags: Set<Tag>): void;
  /** 这张牌额外重复结算几次 */
  retriggers?(ctx: CookContextApi, self: ToolInstance, card: PotCard): number;
  /** 烹饪技法额外触发几次 */
  techniqueRepeats?(ctx: CookContextApi, self: ToolInstance): number;
  onCookStart?(ctx: CookContextApi, self: ToolInstance): void;
  onRecipeMatched?(ctx: CookContextApi, self: ToolInstance): void;
  onIngredientPlayed?(ctx: CookContextApi, self: ToolInstance, card: PotCard): void;
  onCookEnd?(ctx: CookContextApi, self: ToolInstance): void;
  /** 弃牌时（不在烹饪结算中），返回 data 变化 */
  onDiscard?(self: ToolInstance, cards: CardInstance[]): Record<string, number> | void;
}

export type BuildRoute = 'meat' | 'spicy' | 'growth' | 'combo' | 'umami' | 'order' | 'economy' | 'rule';

export interface ToolDef {
  id: string;
  name: string;
  kind: 'tool' | 'skill';
  rarity: Rarity;
  price: number;
  routes: BuildRoute[];
  /** 规则描述 */
  desc: string;
  /** 动态说明，例如成长后的当前数值 */
  status?(self: ToolInstance): string | undefined;
  /** 是否能被「自动炒锅」复制，默认 true */
  copyable?: boolean;
  /** 复制左侧最近的可复制厨具 */
  copiesLeft?: boolean;
  initData?: Record<string, number>;
  passive?: { handSize?: number; maxSelect?: number; discards?: number; cooks?: number };
  hooks: ToolHooks;
}

// ───────── 烹饪技法（顺序效果） ─────────
export interface TechniqueDef {
  id: string;
  name: string;
  desc: string;
  /** 在 active 列表里第 i 张牌结算时检查（只看未被禁用的牌，按锅中顺序） */
  match(active: PotCard[], i: number, has: (c: PotCard, t: Tag) => boolean): boolean;
  apply(ctx: CookContextApi, active: PotCard[], i: number): void;
}

// ───────── Boss ─────────
export interface BossDef {
  id: string;
  name: string;
  title: string;
  rules: string[];
  /** 目标分数在常规基础上的倍数 */
  targetMult: number;
  disableCard?(tags: Set<Tag>): boolean;
  /** 结算最后执行 */
  afterCook?(ctx: CookContextApi, usedRecipes: string[]): void;
  /** 对禁用配方的预判，供 UI 提示 */
  bannedRecipes?: string[];
  quote: string;
}

// ───────── 计分事件 ─────────
export type ScoreEventKind =
  | 'recipe'
  | 'chips'
  | 'mult'
  | 'xmult'
  | 'gold'
  | 'retrigger'
  | 'technique'
  | 'growth'
  | 'disabled'
  | 'note'
  | 'cardStart'
  | 'final';

export interface ScoreEvent {
  kind: ScoreEventKind;
  src: EffectSource;
  amount?: number;
  chips: Big;
  mult: Big;
  text: string;
  /** 关联的锅中位置（高亮用） */
  cardIndex?: number;
  /** 第几次重复结算（0 = 首次） */
  pass?: number;
}

export interface CookResult {
  recipeId: string;
  recipeLevel: number;
  chips: Big;
  mult: Big;
  score: Big;
  events: ScoreEvent[];
  techniques: { id: string; index: number }[];
  gold: number;
  /** 厨具 uid → 新 data */
  toolData: Record<string, Record<string, number>>;
  potUids: string[];
  disabledIndexes: number[];
  truncated: boolean;
}

// ───────── 商店 ─────────
export type ConsumableKind = 'recipe' | 'enhance' | 'star' | 'ingredient' | 'clone';

export interface ToolOffer {
  kind: 'tool';
  defId: string;
  price: number;
  sold: boolean;
}

export interface ConsumableOffer {
  kind: 'consumable';
  type: ConsumableKind;
  price: number;
  sold: boolean;
  recipeId?: string;
  enhancement?: Enhancement;
  ingredientId?: string;
}

export type Offer = ToolOffer | ConsumableOffer;

export interface ShopState {
  tools: ToolOffer[];
  goods: ConsumableOffer[];
  rerollCost: number;
  removeCost: number;
  removedThisShop: number;
}

// ───────── 局内状态 ─────────
export type Phase = 'levelIntro' | 'playing' | 'levelWon' | 'shop' | 'gameOver' | 'victory';

export interface LevelState {
  target: Big;
  score: Big;
  cooksLeft: number;
  discardsLeft: number;
  cooksDone: number;
  usedRecipes: string[];
}

export interface RunStats {
  cooks: number;
  discards: number;
  bestCook: Big;
  bestCookRecipe?: string;
  recipeCounts: Record<string, number>;
  totalScore: Big;
  goldEarned: number;
  levelsCleared: number;
  toolsBought: number;
  biggestXMult: number;
  startedAt: number;
}

export interface LevelReward {
  base: number;
  cooksBonus: number;
  interest: number;
  total: number;
}

export interface RunState {
  version: 1;
  seed: string;
  rng: number;
  phase: Phase;
  level: number;
  endless: boolean;
  gold: number;
  deck: CardInstance[];
  drawPile: string[];
  hand: string[];
  discardPile: string[];
  /** 锅中顺序（手牌 uid 的有序子集） */
  pot: string[];
  tools: ToolInstance[];
  recipeLevels: Record<string, number>;
  levelState: LevelState;
  shop: ShopState | null;
  reward: LevelReward | null;
  stats: RunStats;
  lastResult: CookResult | null;
  nextUid: number;
}

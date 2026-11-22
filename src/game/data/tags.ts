import type { Enhancement, FlavorTag, Rarity, Tag, TypeTag } from '../types';

export const TYPE_TAGS: TypeTag[] = ['meat', 'seafood', 'veg', 'mushroom', 'spice', 'staple', 'egg', 'broth', 'special'];
export const FLAVOR_TAGS: FlavorTag[] = ['spicy', 'numbing', 'sour', 'umami', 'aromatic', 'rich', 'fresh'];

export const TAG_INFO: Record<Tag, { name: string; color: string; icon: string }> = {
  meat: { name: '肉类', color: '#e2574c', icon: '🥩' },
  seafood: { name: '海鲜', color: '#3aa0d8', icon: '🦐' },
  veg: { name: '蔬菜', color: '#4cae4f', icon: '🥬' },
  mushroom: { name: '菌菇', color: '#a8774f', icon: '🍄' },
  spice: { name: '香料', color: '#e88a2c', icon: '🌶' },
  staple: { name: '主食', color: '#d9b45a', icon: '🍚' },
  egg: { name: '蛋', color: '#f2c84b', icon: '🥚' },
  broth: { name: '锅底', color: '#c2413b', icon: '🍲' },
  special: { name: '特殊', color: '#9b5de5', icon: '✨' },
  spicy: { name: '辣', color: '#ff4d2e', icon: '🔥' },
  numbing: { name: '麻', color: '#d6336c', icon: '⚡' },
  sour: { name: '酸', color: '#ffb703', icon: '🍋' },
  umami: { name: '鲜', color: '#2ec4b6', icon: '💧' },
  aromatic: { name: '香', color: '#f4a259', icon: '🌿' },
  rich: { name: '醇', color: '#b5651d', icon: '🧈' },
  fresh: { name: '清', color: '#8ecae6', icon: '🍃' },
};

export const RARITY_INFO: Record<Rarity, { name: string; color: string; weight: number }> = {
  common: { name: '普通', color: '#8d99ae', weight: 50 },
  uncommon: { name: '优良', color: '#3a86ff', weight: 35 },
  rare: { name: '稀有', color: '#c147e9', weight: 14 },
  legendary: { name: '传说', color: '#ffb703', weight: 4 },
};

export const ENHANCEMENT_INFO: Record<Enhancement, { name: string; desc: string; color: string }> = {
  fresh: { name: '鲜活', desc: '结算时额外 +30 筹码', color: '#4cc9f0' },
  marinated: { name: '秘制', desc: '结算时额外 +4 倍率', color: '#f72585' },
  charred: { name: '炭烤', desc: '结算时倍率 ×1.5', color: '#ff7b00' },
  gilded: { name: '镀金', desc: '结算时获得 $1', color: '#ffd60a' },
};

export const tagName = (t: Tag) => TAG_INFO[t].name;

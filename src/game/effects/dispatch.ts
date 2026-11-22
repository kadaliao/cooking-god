import { TOOLS } from '../data/tools';
import type { EffectSource, ToolDef, ToolHooks, ToolInstance } from '../types';

export interface ToolCall {
  /** 实际执行效果的厨具（被复制时是被复制的那件） */
  self: ToolInstance;
  def: ToolDef;
  /** 事件来源（复制时指向自动炒锅本身） */
  src: Extract<EffectSource, { kind: 'tool' }>;
  isCopy: boolean;
}

/**
 * 按玩家排列顺序列出某个时机要执行的厨具。
 * 「自动炒锅」会解析为它上方最近一件可复制的厨具；复制者本身不可被复制，
 * 所以复制链最多一层，不会出现递归。
 */
export function toolCalls(tools: ToolInstance[], hook: keyof ToolHooks): ToolCall[] {
  const calls: ToolCall[] = [];
  tools.forEach((inst, i) => {
    const def = TOOLS[inst.defId];
    if (!def) return;
    if (def.copiesLeft) {
      for (let j = i - 1; j >= 0; j--) {
        const tdef = TOOLS[tools[j].defId];
        if (!tdef || tdef.copyable === false || tdef.copiesLeft) continue;
        if (tdef.hooks[hook]) {
          calls.push({
            self: tools[j],
            def: tdef,
            src: { kind: 'tool', uid: inst.uid, defId: inst.defId, copiedFrom: tdef.id },
            isCopy: true,
          });
        }
        break;
      }
      return;
    }
    if (def.hooks[hook]) calls.push({ self: inst, def, src: { kind: 'tool', uid: inst.uid, defId: inst.defId }, isCopy: false });
  });
  return calls;
}

/** 自动炒锅当前复制的目标（UI 展示用） */
export function copyTargetOf(tools: ToolInstance[], uid: string): ToolInstance | undefined {
  const i = tools.findIndex((t) => t.uid === uid);
  for (let j = i - 1; j >= 0; j--) {
    const tdef = TOOLS[tools[j].defId];
    if (!tdef || tdef.copyable === false || tdef.copiesLeft) continue;
    return tools[j];
  }
  return undefined;
}

/** 被动规则加成（手牌上限、可选张数、弃牌次数） */
export function passiveBonus(tools: ToolInstance[], key: 'handSize' | 'maxSelect' | 'discards' | 'cooks'): number {
  return tools.reduce((s, t) => s + (TOOLS[t.defId]?.passive?.[key] ?? 0), 0);
}

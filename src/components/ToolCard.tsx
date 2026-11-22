import { memo } from 'react';
import { RARITY_INFO } from '../game/data/tags';
import { ROUTE_INFO, TOOLS } from '../game/data/tools';
import type { ToolInstance } from '../game/types';
import { toolArt } from './art';
import { useTip } from './Tooltip';

export function ToolInfo({ defId, inst, copyName }: { defId: string; inst?: ToolInstance; copyName?: string }) {
  const def = TOOLS[defId];
  const status = inst && def.status?.(inst);
  return (
    <div className="info">
      <div className="info-head">
        <img src={toolArt(def.id)} alt="" />
        <div>
          <div className="info-title">{def.name}</div>
          <div className="info-sub" style={{ color: RARITY_INFO[def.rarity].color }}>
            {RARITY_INFO[def.rarity].name} · {def.kind === 'skill' ? '技能' : '厨具'}
          </div>
        </div>
      </div>
      <div className="info-line effect">{def.desc}</div>
      {status && <div className="info-line growth">📈 {status}</div>}
      {def.copiesLeft && <div className="info-line muted">当前复制：{copyName ?? '（上方没有可复制的厨具）'}</div>}
      {def.passive && <div className="info-line muted">被动规则，不受排列顺序影响</div>}
      <div className="route-row">
        {def.routes.map((r) => (
          <span key={r} className="route">
            {ROUTE_INFO[r]}
          </span>
        ))}
      </div>
    </div>
  );
}

interface Props {
  defId: string;
  inst?: ToolInstance;
  active?: boolean;
  copyName?: string;
  compact?: boolean;
  onClick?: () => void;
}

export const ToolCard = memo(function ToolCard({ defId, inst, active, copyName, compact, onClick }: Props) {
  const def = TOOLS[defId];
  const tip = useTip(() => <ToolInfo defId={defId} inst={inst} copyName={copyName} />);
  const status = inst && def.status?.(inst);
  return (
    <div
      className={`tcard rarity-${def.rarity} ${active ? 'active' : ''} ${compact ? 'compact' : ''}`}
      onClick={onClick}
      {...tip}
    >
      <img className="tcard-art" src={toolArt(def.id)} alt="" draggable={false} />
      <div className="tcard-body">
        <div className="tcard-name">
          {def.name}
          {def.kind === 'skill' && <span className="skill-badge">技</span>}
        </div>
        {!compact && <div className="tcard-desc">{def.desc}</div>}
        {status && <div className="tcard-status">{status}</div>}
      </div>
    </div>
  );
});

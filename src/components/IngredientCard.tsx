import { memo } from 'react';
import { INGREDIENTS, cardChips, describeIngredientEffect } from '../game/data/ingredients';
import { ENHANCEMENT_INFO, RARITY_INFO, TAG_INFO } from '../game/data/tags';
import type { CardInstance, Tag } from '../game/types';
import { ingredientArt } from './art';
import { useTip } from './Tooltip';

export function IngredientInfo({ card, extraTags }: { card: CardInstance; extraTags?: Tag[] }) {
  const def = INGREDIENTS[card.defId];
  const eff = describeIngredientEffect(def);
  const enh = card.enhancement ? ENHANCEMENT_INFO[card.enhancement] : undefined;
  const tags = [...def.types, ...def.flavors];
  return (
    <div className="info">
      <div className="info-head">
        <img src={ingredientArt(def.id)} alt="" />
        <div>
          <div className="info-title">
            {def.name} {card.level > 1 && <span className="stars">{'★'.repeat(Math.min(card.level - 1, 5))}</span>}
          </div>
          <div className="info-sub" style={{ color: RARITY_INFO[def.rarity].color }}>
            {RARITY_INFO[def.rarity].name}食材
          </div>
        </div>
      </div>
      <div className="info-line">
        <span className="chip-badge">+{cardChips(def, card.level)}</span> 筹码
        {card.level > 1 && <span className="muted">（品质 {card.level} 星，每星 +10）</span>}
      </div>
      <div className="tag-row">
        {tags.map((t) => (
          <span key={t} className="tag" style={{ background: TAG_INFO[t].color }}>
            {TAG_INFO[t].icon} {TAG_INFO[t].name}
          </span>
        ))}
        {extraTags
          ?.filter((t) => !tags.includes(t))
          .map((t) => (
            <span key={t} className="tag tag-extra" style={{ background: TAG_INFO[t].color }}>
              +{TAG_INFO[t].name}
            </span>
          ))}
      </div>
      {eff && <div className="info-line effect">✦ {eff}</div>}
      {enh && (
        <div className="info-line" style={{ color: enh.color }}>
          【{enh.name}】{enh.desc}
        </div>
      )}
      <div className="info-flavor">{def.flavorText}</div>
    </div>
  );
}

interface Props {
  card: CardInstance;
  selected?: boolean;
  order?: number;
  disabled?: boolean;
  dim?: boolean;
  size?: 'sm' | 'md' | 'lg';
  active?: boolean;
  onClick?: () => void;
  extraTags?: Tag[];
}

export const IngredientCard = memo(function IngredientCard({
  card,
  selected,
  order,
  disabled,
  dim,
  size = 'md',
  active,
  onClick,
  extraTags,
}: Props) {
  const def = INGREDIENTS[card.defId];
  const tip = useTip(() => <IngredientInfo card={card} extraTags={extraTags} />);
  const enh = card.enhancement ? ENHANCEMENT_INFO[card.enhancement] : undefined;
  return (
    <div
      className={`icard icard-${size} rarity-${def.rarity} ${selected ? 'selected' : ''} ${disabled ? 'disabled' : ''} ${dim ? 'dim' : ''} ${active ? 'active' : ''} ${enh ? 'enhanced' : ''}`}
      style={enh ? ({ '--enh': enh.color } as React.CSSProperties) : undefined}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`${def.name}，${cardChips(def, card.level)} 筹码`}
      {...tip}
    >
      <div className="icard-chips">{cardChips(def, card.level)}</div>
      {order !== undefined && <div className="icard-order">{order}</div>}
      {card.level > 1 && <div className="icard-stars">{'★'.repeat(Math.min(card.level - 1, 3))}</div>}
      <img className="icard-art" src={ingredientArt(def.id)} alt="" draggable={false} />
      <div className="icard-name">{def.name}</div>
      <div className="icard-tags">
        {[...def.types, ...def.flavors].slice(0, 3).map((t) => (
          <span key={t} style={{ background: TAG_INFO[t].color }} title={TAG_INFO[t].name}>
            {TAG_INFO[t].name}
          </span>
        ))}
      </div>
      {enh && <div className="icard-enh">{enh.name}</div>}
      {def.effect && <div className="icard-fx">✦</div>}
      {disabled && <div className="icard-ban">🚫</div>}
    </div>
  );
});

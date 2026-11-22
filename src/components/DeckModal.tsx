import { INGREDIENTS } from '../game/data/ingredients';
import { TYPE_TAGS, TAG_INFO } from '../game/data/tags';
import type { CardInstance, RunState } from '../game/types';
import { IngredientCard } from './IngredientCard';
import { Modal } from './Modal';

export function DeckModal({
  run,
  onClose,
  pick,
}: {
  run: RunState;
  onClose: () => void;
  pick?: { title: string; hint?: string; onPick: (c: CardInstance) => void; filter?: (c: CardInstance) => boolean };
}) {
  const groups = TYPE_TAGS.map((t) => ({
    tag: t,
    cards: run.deck
      .filter((c) => INGREDIENTS[c.defId].types[0] === t)
      .sort((a, b) => a.defId.localeCompare(b.defId) || b.level - a.level),
  })).filter((g) => g.cards.length);
  const inPile = new Set(run.drawPile);
  const showPile = run.phase === 'playing';
  return (
    <Modal onClose={onClose} wide className="deck-modal">
      <h2>{pick ? pick.title : `我的食材（${run.deck.length} 张）`}</h2>
      {pick?.hint && <div className="muted">{pick.hint}</div>}
      {showPile && !pick && <div className="muted small">半透明的牌本关已经用过或在手中；亮着的还在牌堆里。</div>}
      <div className="deck-groups">
        {groups.map((g) => (
          <div key={g.tag} className="deck-group">
            <div className="deck-group-title" style={{ color: TAG_INFO[g.tag].color }}>
              {TAG_INFO[g.tag].icon} {TAG_INFO[g.tag].name} · {g.cards.length}
            </div>
            <div className="deck-cards">
              {g.cards.map((c) => {
                const allowed = !pick?.filter || pick.filter(c);
                return (
                  <IngredientCard
                    key={c.uid}
                    card={c}
                    size="sm"
                    dim={(showPile && !pick && !inPile.has(c.uid)) || !allowed}
                    onClick={pick && allowed ? () => pick.onPick(c) : undefined}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

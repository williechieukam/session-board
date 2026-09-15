import type { Card as CardModel } from '../model/types';
import { CARD_PALETTE } from '../model/palette';
import { useBoardStore } from '../store/boardStore';
import { useUiStore } from '../store/uiStore';

export function Card({ card }: { card: CardModel }) {
  const selected = useBoardStore((s) => s.selection.includes(card.id));
  const offset = useUiStore((s) => (s.dragOffset && s.dragOffset.ids.includes(card.id) ? s.dragOffset : null));
  const palette = CARD_PALETTE[card.color];
  const x = card.x + (offset?.dx ?? 0);
  const y = card.y + (offset?.dy ?? 0);
  const dots = Math.min(card.votes, 10);

  return (
    <div
      className={'card' + (selected ? ' selected' : '')}
      data-testid="card"
      data-id={card.id}
      style={{ left: x, top: y, width: card.width, height: card.height, zIndex: card.zIndex, background: palette.bg, borderColor: palette.border }}
    >
      <div className="card-text">{card.text}</div>
      {card.votes > 0 && (
        <div className="card-votes">
          {Array.from({ length: dots }, (_, i) => <span key={i} className="vote-dot" />)}
          {card.votes > 10 && <span className="vote-badge">{card.votes}</span>}
        </div>
      )}
    </div>
  );
}

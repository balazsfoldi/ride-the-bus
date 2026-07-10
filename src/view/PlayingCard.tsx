import type { CSSProperties } from 'react';
import type { AnimationPhase } from '../controller/useRideTheBusController';
import { Card, cardLabel, suitNames, suitSymbols } from '../model/cards';

type PlayingCardProps = {
  card?: Card;
  revealed: boolean;
  active: boolean;
  index: number;
  animationPhase: AnimationPhase;
  onClick: () => void;
  selectable?: boolean;
  selected?: boolean;
  canFoldCards?: boolean;
};

export function PlayingCard({
  card,
  revealed,
  active,
  index,
  animationPhase,
  onClick,
  selectable = false,
  selected = false,
  canFoldCards = true,
}: PlayingCardProps) {
  const red = card?.suit === 'hearts' || card?.suit === 'diamonds';
  const canFold = canFoldCards && Boolean(card) && revealed && animationPhase === 'awaiting-fold';
  const canClick = canFold || selectable;
  const slotClasses = [
    'card-slot',
    active && card ? 'active' : '',
    card ? 'occupied' : 'empty',
    canClick ? 'clickable' : '',
    selected ? 'selected' : '',
    `slot-${index}`,
  ]
    .filter(Boolean)
    .join(' ');

  if (!card) {
    return (
      <div className={slotClasses} style={{ '--deal-order': index } as CSSProperties} aria-label="Empty card slot">
        <span className="empty-slot-mark" />
      </div>
    );
  }

  const cardClasses = ['playing-card', revealed ? 'revealed' : '', `card-${animationPhase}`]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      className={slotClasses}
      type="button"
      style={{ '--deal-order': index } as CSSProperties}
      onClick={canClick ? onClick : undefined}
      tabIndex={canClick ? 0 : -1}
      aria-pressed={selectable ? selected : undefined}
      aria-disabled={!canClick}
      aria-label={canFold ? 'Turn revealed cards face down' : cardLabel(card)}
    >
      <span className={cardClasses}>
        <span className="card-face card-back">
          <span>RTB</span>
        </span>
        <span className={red ? 'card-face card-front red' : 'card-face card-front black'}>
          <span className="corner">{card.rank}</span>
          <span className="symbol">{suitSymbols[card.suit]}</span>
          <span className="suit-name">{suitNames[card.suit]}</span>
        </span>
      </span>
    </button>
  );
}

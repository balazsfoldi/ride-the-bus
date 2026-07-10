export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K';

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  value: number;
};

export type Guess =
  | 'red'
  | 'black'
  | 'higher'
  | 'lower'
  | 'inside'
  | 'outside'
  | 'seen'
  | 'new';

export const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const ranks: Rank[] = [
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
  'A',
];

export const suitSymbols: Record<Suit, string> = {
  hearts: '\u2665',
  diamonds: '\u2666',
  clubs: '\u2663',
  spades: '\u2660',
};

export const suitNames: Record<Suit, string> = {
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
  spades: 'Spades',
};

export function createDeck(deckCount = 2): Card[] {
  return Array.from({ length: deckCount }, (_, deckIndex) => deckIndex + 1).flatMap((deckNumber) =>
    suits.flatMap((suit) =>
      ranks.map((rank, index) => ({
        id: `${deckNumber}-${rank}-${suit}`,
        suit,
        rank,
        value: index + 2,
      })),
    ),
  );
}

export function shuffleDeck(deck: Card[], random = Math.random): Card[] {
  const shuffled = [...deck];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

export function isRed(card: Card): boolean {
  return card.suit === 'hearts' || card.suit === 'diamonds';
}

export function cardLabel(card: Card): string {
  return `${card.rank} of ${suitNames[card.suit]}`;
}
import { Card, Guess, createDeck, isRed, shuffleDeck, suitSymbols } from './cards';

export type Player = {
  id: string;
  name: string;
  hand: Card[];
  drinks: number;
  givenDrinks: number;
  completedRounds: number;
};

export type GamePhase =
  | 'ride'
  | 'ride-complete'
  | 'arrange'
  | 'pyramid-select'
  | 'pyramid-resolve'
  | 'game-over';
export type Result = 'idle' | 'correct' | 'wrong' | 'bonus' | 'round-complete';
export type MoveDirection = 'left' | 'right';

export type PyramidRoundResult = {
  playerId: string;
  selectedCardIds: string[];
  selectedCards: Card[];
  matchingCardIds: string[];
  missedCardIds: string[];
  giveDrinkAmount: number;
  drinkAmount: number;
  drinkAssignments: Record<string, number>;
  outcome: 'give' | 'drink' | 'give-and-drink' | 'pass';
};

export type GameState = {
  players: Player[];
  playerName: string;
  deck: Card[];
  activePlayerIndex: number;
  activeCards: Card[];
  revealedCount: number;
  result: Result;
  message: string;
  pendingGiveAway: boolean;
  phase: GamePhase;
  pyramidCards: Card[];
  arrangingPlayerIndex: number;
  readyPlayerIds: string[];
  pyramidRoundIndex: number;
  pyramidSelectingPlayerIndex: number;
  pyramidSelections: Record<string, string[]>;
  pyramidDrinkGiverIds: string[];
  pyramidResolvingGiverIndex: number;
  pyramidRoundResults: PyramidRoundResult[];
};

export type GuessOption = {
  guess: Guess;
  label: string;
};

export const pyramidRows = [1, 2, 3, 4];
export const pyramidCardCount = pyramidRows.reduce((sum, rowSize) => sum + rowSize, 0);
export const maxPyramidSelections = 4;

export function createInitialState(deck = shuffleDeck(createDeck())): GameState {
  return {
    players: [],
    playerName: '',
    deck,
    activePlayerIndex: 0,
    activeCards: [],
    revealedCount: 0,
    result: 'idle',
    message: 'Add players, then start the ride.',
    pendingGiveAway: false,
    phase: 'ride',
    pyramidCards: [],
    arrangingPlayerIndex: 0,
    readyPlayerIds: [],
    pyramidRoundIndex: 0,
    pyramidSelectingPlayerIndex: 0,
    pyramidSelections: {},
    pyramidDrinkGiverIds: [],
    pyramidResolvingGiverIndex: 0,
    pyramidRoundResults: [],
  };
}

export function createPlayer(name: string, id = crypto.randomUUID()): Player {
  return {
    id,
    name: name.trim(),
    hand: [],
    drinks: 0,
    givenDrinks: 0,
    completedRounds: 0,
  };
}

export function getPyramidRowStart(rowIndex: number): number {
  return pyramidRows.slice(0, rowIndex).reduce((sum, rowSize) => sum + rowSize, 0);
}

export function getPyramidRowCards(state: GameState, rowIndex = state.pyramidRoundIndex): Card[] {
  const start = getPyramidRowStart(rowIndex);
  return state.pyramidCards.slice(start, start + pyramidRows[rowIndex]);
}

export function getPlayerSelection(state: GameState, playerId: string): string[] {
  return state.pyramidSelections[playerId] ?? [];
}

export function getCurrentDrinkGiver(state: GameState): Player | undefined {
  const giverId = state.pyramidDrinkGiverIds[state.pyramidResolvingGiverIndex];
  return state.players.find((player) => player.id === giverId);
}

export function getAssignedPyramidDrinkCount(result: PyramidRoundResult): number {
  return Object.values(result.drinkAssignments).reduce((sum, drinks) => sum + drinks, 0);
}

export function getRemainingPyramidDrinkCount(result: PyramidRoundResult): number {
  return Math.max(0, result.giveDrinkAmount - getAssignedPyramidDrinkCount(result));
}

function getCurrentPyramidResult(state: GameState): PyramidRoundResult | undefined {
  const giver = getCurrentDrinkGiver(state);
  return giver ? state.pyramidRoundResults.find((result) => result.playerId === giver.id) : undefined;
}

export function getActivePlayer(state: GameState): Player | undefined {
  if (state.phase === 'arrange') {
    return state.players[state.arrangingPlayerIndex];
  }

  if (state.phase === 'pyramid-select') {
    return state.players[state.pyramidSelectingPlayerIndex];
  }

  if (state.phase === 'pyramid-resolve') {
    return getCurrentDrinkGiver(state);
  }

  return state.players[state.activePlayerIndex];
}

export function getPrompt(cardIndex: number): string {
  if (cardIndex === 0) {
    return 'Red or black?';
  }

  if (cardIndex === 1) {
    return 'Higher or lower than the first card?';
  }

  if (cardIndex === 2) {
    return 'Inside or outside the first two values?';
  }

  return 'Has this suit appeared already?';
}

export function getNextPrompt(state: GameState): string {
  const activePlayer = getActivePlayer(state);

  if (!activePlayer) {
    return 'Waiting for players';
  }

  if (state.phase === 'game-over') {
    return 'Game over.';
  }

  if (state.phase === 'pyramid-resolve') {
    const giver = getCurrentDrinkGiver(state);
    const result = getCurrentPyramidResult(state);
    const remainingDrinks = result ? getRemainingPyramidDrinkCount(result) : state.pyramidRoundIndex + 1;
    return giver ? `${giver.name}, give ${remainingDrinks} drink(s).` : 'Resolve the pyramid row.';
  }

  if (state.phase === 'pyramid-select') {
    return `${activePlayer.name}, select up to ${maxPyramidSelections} card(s), then press Ready.`;
  }

  if (state.result === 'round-complete' && state.activeCards.length > 0) {
    return state.phase === 'ride-complete'
      ? 'Review the final cards, then start the pyramid.'
      : 'Review the final cards, then press Ready for the next rider.';
  }

  if (state.phase === 'ride-complete') {
    return 'Review the final cards, then start the pyramid.';
  }

  if (state.phase === 'arrange') {
    return `${activePlayer.name}, arrange your cards and press Ready.`;
  }

  if (state.pendingGiveAway) {
    return 'Assign one drink, then continue the ride.';
  }

  if (state.activeCards.length === 0) {
    return `${activePlayer.name} is ready for four hidden cards.`;
  }

  return getPrompt(state.revealedCount);
}
export function getGuessOptions(cardIndex: number): GuessOption[] {
  if (cardIndex === 0) {
    return [
      { guess: 'red', label: 'Red' },
      { guess: 'black', label: 'Black' },
    ];
  }

  if (cardIndex === 1) {
    return [
      { guess: 'higher', label: 'Higher' },
      { guess: 'lower', label: 'Lower' },
    ];
  }

  if (cardIndex === 2) {
    return [
      { guess: 'inside', label: 'Inside' },
      { guess: 'outside', label: 'Outside' },
    ];
  }

  return [
    { guess: 'seen', label: 'Seen suit' },
    { guess: 'new', label: 'New suit' },
  ];
}

export function isCorrectGuess(cards: Card[], cardIndex: number, guess: Guess): boolean {
  const card = cards[cardIndex];

  if (cardIndex === 0) {
    return guess === (isRed(card) ? 'red' : 'black');
  }

  if (cardIndex === 1) {
    const previous = cards[0];
    if (card.value === previous.value) {
      return true;
    }

    return guess === (card.value > previous.value ? 'higher' : 'lower');
  }

  if (cardIndex === 2) {
    const low = Math.min(cards[0].value, cards[1].value);
    const high = Math.max(cards[0].value, cards[1].value);

    if (card.value === low || card.value === high) {
      return true;
    }

    const inside = card.value > low && card.value < high;

    return guess === (inside ? 'inside' : 'outside');
  }

  const previousSuits = cards.slice(0, 3).map((previousCard) => previousCard.suit);
  const hasSeenSuit = previousSuits.includes(card.suit);
  return guess === (hasSeenSuit ? 'seen' : 'new');
}

export function addPlayer(state: GameState, name: string): GameState {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return state;
  }

  if (state.phase !== 'ride' || state.activeCards.length > 0 || state.players.some((player) => player.completedRounds > 0)) {
    return { ...state, message: 'Players are locked once the ride has started.' };
  }

  return {
    ...state,
    players: [...state.players, createPlayer(trimmedName)],
    playerName: '',
    message: `${trimmedName} joined the table.`,
    result: 'idle',
  };
}

export function setPlayerName(state: GameState, playerName: string): GameState {
  return { ...state, playerName };
}

export function startTurn(state: GameState): GameState {
  const activePlayer = getActivePlayer(state);

  if (state.phase !== 'ride') {
    return state;
  }

  if (!activePlayer || state.deck.length < 4) {
    return { ...state, message: 'The deck is low. Shuffle a new game to keep playing.' };
  }

  return {
    ...state,
    activeCards: state.deck.slice(0, 4),
    deck: state.deck.slice(4),
    revealedCount: 0,
    result: 'idle',
    pendingGiveAway: false,
    message: `${activePlayer.name} gets four face-down cards.`,
  };
}

export function makeGuess(state: GameState, guess: Guess): GameState {
  const activePlayer = getActivePlayer(state);

  if (state.phase !== 'ride' || !activePlayer || state.activeCards.length === 0 || state.revealedCount > 3 || state.pendingGiveAway) {
    return state;
  }

  const guessedCard = state.activeCards[state.revealedCount];
  const correct = isCorrectGuess(state.activeCards, state.revealedCount, guess);
  const isMatchingSecondCard = state.revealedCount === 1 && guessedCard.value === state.activeCards[0].value;
  const isBoundaryThirdCard =
    state.revealedCount === 2 &&
    (guessedCard.value === state.activeCards[0].value || guessedCard.value === state.activeCards[1].value);
  const newRevealedCount = state.revealedCount + 1;

  if (!correct) {
    return {
      ...state,
      players: state.players.map((player, index) =>
        index === state.activePlayerIndex ? { ...player, drinks: player.drinks + 1 } : player,
      ),
      revealedCount: newRevealedCount,
      pendingGiveAway: false,
      result: 'wrong',
      message: `${activePlayer.name} missed on ${guessedCard.rank} ${suitSymbols[guessedCard.suit]}. Drink, then ride again from card one.`,
    };
  }

  if (isMatchingSecondCard || isBoundaryThirdCard) {
    return {
      ...state,
      revealedCount: newRevealedCount,
      pendingGiveAway: true,
      result: 'bonus',
      message: isMatchingSecondCard
        ? `${activePlayer.name} hit a matching ${guessedCard.rank}. Give one drink to any player.`
        : `${activePlayer.name} landed on the boundary with ${guessedCard.rank}. Give one drink to any player.`,
    };
  }

  if (newRevealedCount === 4) {
    const players = state.players.map((player, index) =>
      index === state.activePlayerIndex
        ? {
            ...player,
            hand: [...player.hand, ...state.activeCards],
            completedRounds: player.completedRounds + 1,
          }
        : player,
    );
    const isLastRidePlayer = state.activePlayerIndex === state.players.length - 1;

    return {
      ...state,
      players,
      revealedCount: newRevealedCount,
      pendingGiveAway: false,
      result: 'round-complete',
      phase: isLastRidePlayer ? 'ride-complete' : state.phase,
      message: isLastRidePlayer
        ? `${activePlayer.name} cleared the ride. Review the final cards, then start the pyramid.`
        : `${activePlayer.name} cleared the ride and keeps the four cards. Review them, then press Ready.`,
    };
  }

  return {
    ...state,
    revealedCount: newRevealedCount,
    result: 'correct',
    message: `${guessedCard.rank} ${suitSymbols[guessedCard.suit]} is correct. Keep going.`,
  };
}

export function assignDrink(state: GameState, targetIndex: number): GameState {
  const activePlayer = getActivePlayer(state);
  const targetName = state.players[targetIndex]?.name;

  if (!activePlayer || !state.pendingGiveAway || !targetName || targetIndex === state.activePlayerIndex) {
    return state;
  }

  return {
    ...state,
    players: state.players.map((player, index) => {
      if (index === targetIndex) {
        return { ...player, drinks: player.drinks + 1 };
      }

      if (index === state.activePlayerIndex) {
        return { ...player, givenDrinks: player.givenDrinks + 1 };
      }

      return player;
    }),
    pendingGiveAway: false,
    result: 'correct',
    message: `${activePlayer.name} gave one drink to ${targetName}. Keep going.`,
  };
}

export function skipGiveAway(state: GameState): GameState {
  const activePlayer = getActivePlayer(state);

  if (!activePlayer || !state.pendingGiveAway) {
    return state;
  }

  return {
    ...state,
    pendingGiveAway: false,
    result: 'correct',
    message: `${activePlayer.name} keeps the table merciful. Keep going.`,
  };
}

export function foldWrongGuess(state: GameState): GameState {
  const activePlayer = state.players[state.activePlayerIndex];

  if (state.phase !== 'ride' || state.result !== 'wrong' || state.activeCards.length === 0) {
    return state;
  }

  return {
    ...state,
    revealedCount: 0,
    result: 'idle',
    pendingGiveAway: false,
    message: `${activePlayer?.name ?? 'The rider'} rides again from card one.`,
  };
}
export function confirmRideComplete(state: GameState): GameState {
  const activePlayer = state.players[state.activePlayerIndex];

  if (state.phase !== 'ride' || state.result !== 'round-complete' || state.activeCards.length === 0 || state.revealedCount < 4) {
    return state;
  }

  const nextPlayerIndex = state.activePlayerIndex + 1;
  const nextPlayer = state.players[nextPlayerIndex];

  if (!activePlayer || !nextPlayer) {
    return state;
  }

  return {
    ...state,
    activePlayerIndex: nextPlayerIndex,
    activeCards: [],
    revealedCount: 0,
    pendingGiveAway: false,
    result: 'idle',
    message: `${nextPlayer.name} is ready for four hidden cards.`,
  };
}
export function startPyramidPhase(state: GameState): GameState {
  if (state.phase !== 'ride-complete') {
    return state;
  }

  if (state.deck.length < pyramidCardCount) {
    return { ...state, message: 'The deck is low. Shuffle a new game to keep playing.' };
  }

  const pyramidCards = state.deck.slice(0, pyramidCardCount);

  return {
    ...state,
    deck: state.deck.slice(pyramidCardCount),
    activeCards: [],
    revealedCount: 0,
    pendingGiveAway: false,
    phase: 'arrange',
    pyramidCards,
    arrangingPlayerIndex: 0,
    readyPlayerIds: [],
    pyramidRoundIndex: 0,
    pyramidSelectingPlayerIndex: 0,
    pyramidSelections: {},
    pyramidDrinkGiverIds: [],
    pyramidResolvingGiverIndex: 0,
    pyramidRoundResults: [],
    message: `The dealer laid out the pyramid. ${state.players[0]?.name ?? 'First player'} can arrange their cards.`,
  };
}

export function moveHandCard(state: GameState, cardIndex: number, direction: MoveDirection): GameState {
  if (state.phase !== 'arrange') {
    return state;
  }

  const player = state.players[state.arrangingPlayerIndex];
  const targetIndex = direction === 'left' ? cardIndex - 1 : cardIndex + 1;

  if (!player || targetIndex < 0 || targetIndex >= player.hand.length) {
    return state;
  }

  const hand = [...player.hand];
  [hand[cardIndex], hand[targetIndex]] = [hand[targetIndex], hand[cardIndex]];

  return {
    ...state,
    players: state.players.map((currentPlayer, index) =>
      index === state.arrangingPlayerIndex ? { ...currentPlayer, hand } : currentPlayer,
    ),
  };
}

export function markArrangementReady(state: GameState): GameState {
  if (state.phase !== 'arrange') {
    return state;
  }

  const player = state.players[state.arrangingPlayerIndex];

  if (!player) {
    return state;
  }

  const readyPlayerIds = state.readyPlayerIds.includes(player.id)
    ? state.readyPlayerIds
    : [...state.readyPlayerIds, player.id];
  const nextPlayerIndex = state.arrangingPlayerIndex + 1;

  if (nextPlayerIndex >= state.players.length) {
    return {
      ...state,
      phase: 'pyramid-select',
      readyPlayerIds,
      pyramidRoundIndex: 0,
      pyramidSelectingPlayerIndex: 0,
      pyramidSelections: {},
      pyramidDrinkGiverIds: [],
      pyramidResolvingGiverIndex: 0,
      pyramidRoundResults: [],
      message: `Pyramid round 1. ${state.players[0]?.name ?? 'First player'} selects up to ${maxPyramidSelections} cards.`,
    };
  }

  return {
    ...state,
    arrangingPlayerIndex: nextPlayerIndex,
    readyPlayerIds,
    message: `${state.players[nextPlayerIndex].name} can arrange their cards.`,
  };
}

export function togglePyramidSelection(state: GameState, cardId: string): GameState {
  if (state.phase !== 'pyramid-select') {
    return state;
  }

  const player = state.players[state.pyramidSelectingPlayerIndex];

  if (!player || !player.hand.some((card) => card.id === cardId)) {
    return state;
  }

  const currentSelection = getPlayerSelection(state, player.id);
  const isSelected = currentSelection.includes(cardId);
  const nextSelection = isSelected
    ? currentSelection.filter((selectedCardId) => selectedCardId !== cardId)
    : currentSelection.length >= maxPyramidSelections
      ? currentSelection
      : [...currentSelection, cardId];

  return {
    ...state,
    pyramidSelections: {
      ...state.pyramidSelections,
      [player.id]: nextSelection,
    },
    message:
      !isSelected && currentSelection.length >= maxPyramidSelections
        ? `You can select up to ${maxPyramidSelections} cards.`
        : `${player.name} selected ${nextSelection.length} card(s).`,
  };
}

export function markPyramidSelectionReady(state: GameState): GameState {
  if (state.phase !== 'pyramid-select') {
    return state;
  }

  const nextPlayerIndex = state.pyramidSelectingPlayerIndex + 1;

  if (nextPlayerIndex < state.players.length) {
    return {
      ...state,
      pyramidSelectingPlayerIndex: nextPlayerIndex,
      message: `${state.players[nextPlayerIndex].name} selects up to ${maxPyramidSelections} cards.`,
    };
  }

  return revealPyramidSelections(state);
}

function revealPyramidSelections(state: GameState): GameState {
  const rowDrinkAmount = state.pyramidRoundIndex + 1;
  const rowValues = new Set(getPyramidRowCards(state).map((card) => card.value));
  const results = state.players.map((player) => {
    const selectedCardIds = getPlayerSelection(state, player.id);
    const selectedCards = player.hand.filter((card) => selectedCardIds.includes(card.id));
    const matchingCardIds = selectedCards.filter((card) => rowValues.has(card.value)).map((card) => card.id);
    const missedCardIds = selectedCards.filter((card) => !rowValues.has(card.value)).map((card) => card.id);
    const giveDrinkAmount = matchingCardIds.length * rowDrinkAmount;
    const drinkAmount = missedCardIds.length * rowDrinkAmount;
    const outcome =
      selectedCards.length === 0
        ? 'pass'
        : giveDrinkAmount > 0 && drinkAmount > 0
          ? 'give-and-drink'
          : giveDrinkAmount > 0
            ? 'give'
            : 'drink';

    return {
      playerId: player.id,
      selectedCardIds,
      selectedCards,
      matchingCardIds,
      missedCardIds,
      giveDrinkAmount,
      drinkAmount,
      drinkAssignments: {},
      outcome,
    } satisfies PyramidRoundResult;
  });
  const resultByPlayerId = new Map(results.map((result) => [result.playerId, result]));
  const players = state.players.map((player) => {
    const result = resultByPlayerId.get(player.id);

    if (!result) {
      return player;
    }

    const selectedIds = new Set(result.selectedCardIds);
    const hand = player.hand.filter((card) => !selectedIds.has(card.id));

    if (result.drinkAmount > 0) {
      return { ...player, hand, drinks: player.drinks + result.drinkAmount };
    }

    return { ...player, hand };
  });
  const giverIds = results.filter((result) => result.giveDrinkAmount > 0).map((result) => result.playerId);

  if (giverIds.length === 0) {
    const anySelectedCards = results.some((result) => result.selectedCardIds.length > 0);

    return {
      ...state,
      players,
      phase: 'pyramid-resolve',
      readyPlayerIds: [],
      pyramidRoundResults: results,
      pyramidDrinkGiverIds: [],
      pyramidResolvingGiverIndex: 0,
      message: anySelectedCards
        ? 'No matching selected cards. Continue to the next pyramid row.'
        : 'Everyone passed. Continue to the next pyramid row.',
    };
  }

  const firstGiver = players.find((player) => player.id === giverIds[0]);
  const firstResult = results.find((result) => result.playerId === giverIds[0]);
  const drinkMessage = firstResult && firstResult.drinkAmount > 0 ? ` and drinks ${firstResult.drinkAmount}` : '';

  return {
    ...state,
    players,
    phase: 'pyramid-resolve',
    readyPlayerIds: [],
    pyramidRoundResults: results,
    pyramidDrinkGiverIds: giverIds,
    pyramidResolvingGiverIndex: 0,
    message: `${firstGiver?.name ?? 'Matching player'} gives ${firstResult?.giveDrinkAmount ?? rowDrinkAmount} drink(s)${drinkMessage}.`,
  };
}

export function assignPyramidDrink(state: GameState, targetIndex: number): GameState {
  if (state.phase !== 'pyramid-resolve') {
    return state;
  }

  const giver = getCurrentDrinkGiver(state);
  const target = state.players[targetIndex];
  const giverResult = getCurrentPyramidResult(state);

  if (!giver || !target || !giverResult || target.id === giver.id || getRemainingPyramidDrinkCount(giverResult) <= 0) {
    return state;
  }

  const players = state.players.map((player) => {
    if (player.id === target.id) {
      return { ...player, drinks: player.drinks + 1 };
    }

    if (player.id === giver.id) {
      return { ...player, givenDrinks: player.givenDrinks + 1 };
    }

    return player;
  });
  const results = state.pyramidRoundResults.map((result) =>
    result.playerId === giver.id
      ? {
          ...result,
          drinkAssignments: {
            ...result.drinkAssignments,
            [target.id]: (result.drinkAssignments[target.id] ?? 0) + 1,
          },
        }
      : result,
  );
  const updatedGiverResult = results.find((result) => result.playerId === giver.id);
  const remainingDrinks = updatedGiverResult ? getRemainingPyramidDrinkCount(updatedGiverResult) : 0;

  if (remainingDrinks > 0) {
    return {
      ...state,
      players,
      pyramidRoundResults: results,
      message: `${giver.name} gives ${remainingDrinks} more drink(s).`,
    };
  }

  const nextGiverIndex = state.pyramidResolvingGiverIndex + 1;

  if (nextGiverIndex >= state.pyramidDrinkGiverIds.length) {
    return advancePyramidRound({
      ...state,
      players,
      pyramidRoundResults: results,
      pyramidResolvingGiverIndex: nextGiverIndex,
    });
  }

  const nextGiverId = state.pyramidDrinkGiverIds[nextGiverIndex];
  const nextGiver = players.find((player) => player.id === nextGiverId);
  const nextGiverResult = results.find((result) => result.playerId === nextGiverId);
  const nextRemainingDrinks = nextGiverResult ? getRemainingPyramidDrinkCount(nextGiverResult) : state.pyramidRoundIndex + 1;

  return {
    ...state,
    players,
    pyramidRoundResults: results,
    pyramidResolvingGiverIndex: nextGiverIndex,
    message: `${nextGiver?.name ?? 'Next player'} gives ${nextRemainingDrinks} drink(s).`,
  };
}
export function continuePyramidRound(state: GameState): GameState {
  if (state.phase !== 'pyramid-resolve' || state.pyramidDrinkGiverIds.length > state.pyramidResolvingGiverIndex) {
    return state;
  }

  return advancePyramidRound(state);
}

function advancePyramidRound(state: GameState): GameState {
  if (state.pyramidRoundIndex >= pyramidRows.length - 1) {
    return {
      ...state,
      phase: 'game-over',
      readyPlayerIds: [],
      pyramidSelections: {},
      pyramidDrinkGiverIds: [],
      pyramidResolvingGiverIndex: 0,
      message: 'Game over. The bus has reached the end of the line.',
    };
  }

  const nextRoundIndex = state.pyramidRoundIndex + 1;

  return {
    ...state,
    phase: 'pyramid-select',
    readyPlayerIds: [],
    pyramidRoundIndex: nextRoundIndex,
    pyramidSelectingPlayerIndex: 0,
    pyramidSelections: {},
    pyramidDrinkGiverIds: [],
    pyramidResolvingGiverIndex: 0,
    message: `Pyramid round ${nextRoundIndex + 1}. ${state.players[0]?.name ?? 'First player'} selects up to ${maxPyramidSelections} cards.`,
  };
}

export function movePlayerHandCard(state: GameState, playerId: string, cardIndex: number, direction: MoveDirection): GameState {
  if (state.phase !== 'arrange' || state.readyPlayerIds.includes(playerId)) {
    return state;
  }

  const player = state.players.find((currentPlayer) => currentPlayer.id === playerId);
  const targetIndex = direction === 'left' ? cardIndex - 1 : cardIndex + 1;

  if (!player || targetIndex < 0 || targetIndex >= player.hand.length) {
    return state;
  }

  const hand = [...player.hand];
  [hand[cardIndex], hand[targetIndex]] = [hand[targetIndex], hand[cardIndex]];

  return {
    ...state,
    players: state.players.map((currentPlayer) => (currentPlayer.id === playerId ? { ...currentPlayer, hand } : currentPlayer)),
  };
}

export function markPlayerArrangementReady(state: GameState, playerId: string): GameState {
  if (state.phase !== 'arrange' || !state.players.some((player) => player.id === playerId)) {
    return state;
  }

  const readyPlayerIds = state.readyPlayerIds.includes(playerId) ? state.readyPlayerIds : [...state.readyPlayerIds, playerId];

  if (readyPlayerIds.length >= state.players.length) {
    return {
      ...state,
      phase: 'pyramid-select',
      readyPlayerIds: [],
      pyramidRoundIndex: 0,
      pyramidSelectingPlayerIndex: 0,
      pyramidSelections: {},
      pyramidDrinkGiverIds: [],
      pyramidResolvingGiverIndex: 0,
      pyramidRoundResults: [],
      message: `Pyramid round 1. Everyone selects up to ${maxPyramidSelections} card(s).`,
    };
  }

  return {
    ...state,
    readyPlayerIds,
    message: `Arrangement ready ${readyPlayerIds.length}/${state.players.length}.`,
  };
}

export function togglePlayerPyramidSelection(state: GameState, playerId: string, cardId: string): GameState {
  if (state.phase !== 'pyramid-select' || state.readyPlayerIds.includes(playerId)) {
    return state;
  }

  const player = state.players.find((currentPlayer) => currentPlayer.id === playerId);

  if (!player || !player.hand.some((card) => card.id === cardId)) {
    return state;
  }

  const currentSelection = getPlayerSelection(state, player.id);
  const isSelected = currentSelection.includes(cardId);
  const nextSelection = isSelected
    ? currentSelection.filter((selectedCardId) => selectedCardId !== cardId)
    : currentSelection.length >= maxPyramidSelections
      ? currentSelection
      : [...currentSelection, cardId];

  return {
    ...state,
    pyramidSelections: {
      ...state.pyramidSelections,
      [player.id]: nextSelection,
    },
    message:
      !isSelected && currentSelection.length >= maxPyramidSelections
        ? `You can select up to ${maxPyramidSelections} cards.`
        : `${player.name} selected ${nextSelection.length} card(s).`,
  };
}

export function markPlayerPyramidSelectionReady(state: GameState, playerId: string): GameState {
  if (state.phase !== 'pyramid-select' || !state.players.some((player) => player.id === playerId)) {
    return state;
  }

  const readyPlayerIds = state.readyPlayerIds.includes(playerId) ? state.readyPlayerIds : [...state.readyPlayerIds, playerId];

  if (readyPlayerIds.length >= state.players.length) {
    return revealPyramidSelections({ ...state, readyPlayerIds });
  }

  return {
    ...state,
    readyPlayerIds,
    message: `Pyramid cards ready ${readyPlayerIds.length}/${state.players.length}.`,
  };
}

export function restartWithSamePlayers(state: GameState, deck = shuffleDeck(createDeck())): GameState {
  const players = state.players.map((player) => ({
    ...player,
    hand: [],
    drinks: 0,
    givenDrinks: 0,
    completedRounds: 0,
  }));

  return {
    ...createInitialState(deck),
    players,
    message: players.length > 0 ? players[0].name + ' is ready for four hidden cards.' : 'Fresh deck. Add players to begin.',
  };
}
export function resetGame(): GameState {
  return { ...createInitialState(), message: 'Fresh deck. Add players to begin.' };
}

export function shuffleNewDeck(state: GameState): GameState {
  if (state.phase !== 'ride') {
    return state;
  }

  return {
    ...state,
    deck: shuffleDeck(createDeck()),
    activeCards: [],
    revealedCount: 0,
    result: 'idle',
    pendingGiveAway: false,
    message: 'The dealer shuffled a fresh deck.',
  };
}



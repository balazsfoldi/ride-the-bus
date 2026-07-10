import { describe, expect, it, vi } from 'vitest';
import { Card, createDeck } from '../../src/model/cards';
import {
  addPlayer,
  assignDrink,
  assignPyramidDrink,
  confirmRideComplete,
  continuePyramidRound,
  createInitialState,
  foldWrongGuess,
  isCorrectGuess,
  makeGuess,
  markPlayerArrangementReady,
  markPlayerPyramidSelectionReady,
  movePlayerHandCard,
  restartWithSamePlayers,
  startPyramidPhase,
  startTurn,
  togglePlayerPyramidSelection,
} from '../../src/model/gameModel';

function card(id: string, rank: Card['rank'], value: number, suit: Card['suit']): Card {
  return { id, rank, value, suit };
}

const rideCards = [
  card('h5', '5', 5, 'hearts'),
  card('c5', '5', 5, 'clubs'),
  card('d7', '7', 7, 'diamonds'),
  card('hk', 'K', 13, 'hearts'),
];

const firstRide = [
  card('h2', '2', 2, 'hearts'),
  card('c8', '8', 8, 'clubs'),
  card('d5', '5', 5, 'diamonds'),
  card('sk', 'K', 13, 'spades'),
];

const secondRide = [
  card('d3', '3', 3, 'diamonds'),
  card('c9', '9', 9, 'clubs'),
  card('h6', '6', 6, 'hearts'),
  card('sq', 'Q', 12, 'spades'),
];

function finishCurrentRide(state: ReturnType<typeof createInitialState>) {
  state = startTurn(state);
  state = makeGuess(state, 'red');
  state = makeGuess(state, 'higher');
  state = makeGuess(state, 'inside');
  return makeGuess(state, 'new');
}

function pyramidDeck() {
  return [
    card('p-a', 'A', 14, 'diamonds'),
    card('p-4s', '4', 4, 'spades'),
    card('p-jh', 'J', 11, 'hearts'),
    card('p-7c', '7', 7, 'clubs'),
    card('p-8d', '8', 8, 'diamonds'),
    card('p-qs', 'Q', 12, 'spades'),
    card('p-ah', 'A', 14, 'hearts'),
    card('p-2s', '2', 2, 'spades'),
    card('p-3c', '3', 3, 'clubs'),
    card('p-4d', '4', 4, 'diamonds'),
  ];
}

describe('Ride the Bus model', () => {
  it('creates a two-deck shoe and treats aces as high', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(104);
    expect(new Set(deck.map((deckCard) => deckCard.id)).size).toBe(104);
    expect(deck.find((deckCard) => deckCard.rank === 'A')?.value).toBe(14);
    expect(deck.find((deckCard) => deckCard.rank === 'K')?.value).toBe(13);
  });

  it('checks the four ride guess types', () => {
    const cards = [card('h4', '4', 4, 'hearts'), card('s8', '8', 8, 'spades'), card('d6', '6', 6, 'diamonds'), card('qs', 'Q', 12, 'spades')];
    expect(isCorrectGuess(cards, 0, 'red')).toBe(true);
    expect(isCorrectGuess(cards, 1, 'higher')).toBe(true);
    expect(isCorrectGuess(cards, 2, 'inside')).toBe(true);
    expect(isCorrectGuess(cards, 3, 'seen')).toBe(true);
  });

  it('keeps the same four cards visible after a wrong guess until the rider folds them back', () => {
    let state = createInitialState(rideCards);
    state = addPlayer(state, 'Anna');
    state = startTurn(state);
    state = makeGuess(state, 'black');

    expect(state.activeCards).toEqual(rideCards);
    expect(state.revealedCount).toBe(1);
    expect(state.result).toBe('wrong');
    expect(state.players[0].drinks).toBe(1);

    state = foldWrongGuess(state);

    expect(state.activeCards).toEqual(rideCards);
    expect(state.revealedCount).toBe(0);
    expect(state.result).toBe('idle');
  });

  it('requires Ready after a completed ride before advancing to the next rider', () => {
    let state = createInitialState([...firstRide, ...secondRide, ...pyramidDeck()]);
    state = addPlayer(state, 'Anna');
    state = addPlayer(state, 'Bence');
    state = finishCurrentRide(state);

    expect(state.result).toBe('round-complete');
    expect(state.activePlayerIndex).toBe(0);
    expect(state.activeCards).toEqual(firstRide);
    expect(state.players[0].hand).toEqual(firstRide);

    state = confirmRideComplete(state);

    expect(state.activePlayerIndex).toBe(1);
    expect(state.activeCards).toEqual([]);
  });

  it('does not let matching or boundary bonuses target the rider', () => {
    vi.spyOn(crypto, 'randomUUID')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000001')
      .mockReturnValueOnce('00000000-0000-4000-8000-000000000002');
    let state = createInitialState(rideCards);
    state = addPlayer(state, 'Anna');
    state = addPlayer(state, 'Bence');
    state = startTurn(state);
    state = makeGuess(state, 'red');
    state = makeGuess(state, 'higher');

    const selfAssignedState = assignDrink(state, 0);
    expect(selfAssignedState).toBe(state);

    state = assignDrink(state, 1);
    expect(state.players[0].givenDrinks).toBe(1);
    expect(state.players[1].drinks).toBe(1);
  });

  it('supports online parallel arrangement and pyramid selection by player id', () => {
    let state = createInitialState([...firstRide, ...secondRide, ...pyramidDeck()]);
    state = addPlayer(state, 'Anna');
    state = addPlayer(state, 'Bence');
    state = finishCurrentRide(state);
    state = confirmRideComplete(state);
    state = finishCurrentRide(state);
    state = startPyramidPhase(state);

    const anna = state.players[0];
    const bence = state.players[1];
    state = movePlayerHandCard(state, bence.id, 0, 'right');
    expect(state.players[1].hand[0]).toEqual(secondRide[1]);

    state = markPlayerArrangementReady(state, anna.id);
    expect(state.phase).toBe('arrange');
    state = markPlayerArrangementReady(state, bence.id);
    expect(state.phase).toBe('pyramid-select');

    state = togglePlayerPyramidSelection(state, anna.id, firstRide[0].id);
    state = markPlayerPyramidSelectionReady(state, anna.id);
    state = markPlayerPyramidSelectionReady(state, bence.id);
    expect(state.phase).toBe('pyramid-resolve');
    expect(state.pyramidRoundResults[0].drinkAmount).toBe(1);
    expect(state.players[0].hand).toEqual(firstRide.slice(1));
  });

  it('scores multiple selected pyramid cards separately and removes them from hand', () => {
    const pyramid = pyramidDeck();
    let state = createInitialState([...firstRide, ...secondRide, ...pyramid]);
    state = addPlayer(state, 'Anna');
    state = addPlayer(state, 'Bence');
    state = finishCurrentRide(state);
    state = confirmRideComplete(state);
    state = finishCurrentRide(state);
    state = startPyramidPhase(state);
    state = markPlayerArrangementReady(state, state.players[0].id);
    state = markPlayerArrangementReady(state, state.players[1].id);

    for (let roundIndex = 0; roundIndex < 2; roundIndex += 1) {
      state = markPlayerPyramidSelectionReady(state, state.players[0].id);
      state = markPlayerPyramidSelectionReady(state, state.players[1].id);
      state = continuePyramidRound(state);
    }

    const q1 = card('q1', 'Q', 12, 'hearts');
    const q2 = card('q2', 'Q', 12, 'clubs');
    const ten = card('ten', '10', 10, 'spades');
    const spare = card('spare', 'A', 14, 'diamonds');
    state = { ...state, players: state.players.map((player, index) => (index === 0 ? { ...player, hand: [q1, q2, ten, spare] } : player)) };

    state = togglePlayerPyramidSelection(state, state.players[0].id, q1.id);
    state = togglePlayerPyramidSelection(state, state.players[0].id, q2.id);
    state = togglePlayerPyramidSelection(state, state.players[0].id, ten.id);
    state = markPlayerPyramidSelectionReady(state, state.players[0].id);
    state = markPlayerPyramidSelectionReady(state, state.players[1].id);

    expect(state.pyramidRoundResults[0].giveDrinkAmount).toBe(6);
    expect(state.pyramidRoundResults[0].drinkAmount).toBe(3);
    expect(state.players[0].drinks).toBe(3);
    expect(state.players[0].hand).toEqual([spare]);

    state = assignPyramidDrink(state, 1);
    state = assignPyramidDrink(state, 1);
    expect(state.pyramidRoundResults[0].drinkAssignments[state.players[1].id]).toBe(2);
  });

  it('can restart with the same players from the scoreboard', () => {
    let state = createInitialState();
    state = addPlayer(state, 'Anna');
    state = addPlayer(state, 'Bence');
    state = { ...state, phase: 'game-over', players: state.players.map((player) => ({ ...player, drinks: 3, givenDrinks: 2, hand: rideCards, completedRounds: 1 })) };

    state = restartWithSamePlayers(state);

    expect(state.phase).toBe('ride');
    expect(state.players.map((player) => player.name)).toEqual(['Anna', 'Bence']);
    expect(state.players.every((player) => player.drinks === 0 && player.hand.length === 0)).toBe(true);
  });
});

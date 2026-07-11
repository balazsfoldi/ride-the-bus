import { describe, expect, it } from 'vitest';
import { Card } from '../../src/model/cards';
import {
  addPlayer,
  confirmRideComplete,
  continuePyramidRound,
  createInitialState,
  makeGuess,
  markArrangementReady,
  markPyramidSelectionReady,
  startPyramidPhase,
  startTurn,
} from '../../src/model/gameModel';

function card(id: string, rank: Card['rank'], value: number, suit: Card['suit']): Card {
  return { id, rank, value, suit };
}

function ride(prefix: string, first: Card['suit']) {
  return [
    card(prefix + '-2', '2', 2, first),
    card(prefix + '-8', '8', 8, 'clubs'),
    card(prefix + '-5', '5', 5, 'diamonds'),
    card(prefix + '-k', 'K', 13, 'spades'),
  ];
}

function pyramid() {
  return [
    card('p1', 'A', 14, 'diamonds'),
    card('p2', '4', 4, 'spades'),
    card('p3', 'J', 11, 'hearts'),
    card('p4', '7', 7, 'clubs'),
    card('p5', '8', 8, 'diamonds'),
    card('p6', 'Q', 12, 'spades'),
    card('p7', 'A', 14, 'hearts'),
    card('p8', '2', 2, 'spades'),
    card('p9', '3', 3, 'clubs'),
    card('p10', '4', 4, 'diamonds'),
  ];
}

function clearRide(state: ReturnType<typeof createInitialState>) {
  state = startTurn(state);
  state = makeGuess(state, 'red');
  state = makeGuess(state, 'higher');
  state = makeGuess(state, 'inside');
  return makeGuess(state, 'new');
}

describe('offline ride and pyramid flow', () => {
  it('rejects the last player\'s incorrect final suit guess', () => {
    const lastRide = [
      card('last-2h', '2', 2, 'hearts'),
      card('last-8c', '8', 8, 'clubs'),
      card('last-5d', '5', 5, 'diamonds'),
      card('last-kc', 'K', 13, 'clubs'),
    ];
    let state = createInitialState([...ride('first', 'hearts'), ...lastRide]);
    state = addPlayer(state, 'Anna');
    state = addPlayer(state, 'Bence');

    state = clearRide(state);
    state = confirmRideComplete(state);
    state = startTurn(state);
    state = makeGuess(state, 'red');
    state = makeGuess(state, 'higher');
    state = makeGuess(state, 'inside');
    state = makeGuess(state, 'new');

    expect(state.activePlayerIndex).toBe(1);
    expect(state.phase).toBe('ride');
    expect(state.result).toBe('wrong');
    expect(state.revealedCount).toBe(4);
    expect(state.players[1].drinks).toBe(1);
    expect(state.players[1].completedRounds).toBe(0);
  });

  it('keeps exactly four cards when a ride completion is processed again', () => {
    let state = createInitialState([...ride('first', 'hearts'), ...ride('second', 'diamonds')]);
    state = addPlayer(state, 'Anna');
    state = addPlayer(state, 'Bence');

    state = clearRide(state);
    state = confirmRideComplete(state);
    state = clearRide(state);

    expect(state.players[1].hand).toHaveLength(4);
    expect(state.players[1].completedRounds).toBe(1);

    state = { ...state, phase: 'ride', result: 'correct', revealedCount: 3 };
    state = makeGuess(state, 'new');

    expect(state.players[1].hand).toHaveLength(4);
    expect(state.players[1].hand).toEqual(ride('second', 'diamonds'));
    expect(state.players[1].completedRounds).toBe(1);
  });
  it('plays from ride through pyramid scoreboard', () => {
    let state = createInitialState([...ride('a', 'hearts'), ...ride('b', 'diamonds'), ...pyramid()]);
    state = addPlayer(state, 'Anna');
    state = addPlayer(state, 'Bence');

    state = clearRide(state);
    expect(state.result).toBe('round-complete');
    state = confirmRideComplete(state);
    state = clearRide(state);
    expect(state.phase).toBe('ride-complete');

    state = startPyramidPhase(state);
    expect(state.pyramidCards).toHaveLength(10);
    state = markArrangementReady(state);
    state = markArrangementReady(state);

    for (let roundIndex = 0; roundIndex < 4; roundIndex += 1) {
      state = markPyramidSelectionReady(state);
      state = markPyramidSelectionReady(state);
      state = continuePyramidRound(state);
    }

    expect(state.phase).toBe('game-over');
  });
});

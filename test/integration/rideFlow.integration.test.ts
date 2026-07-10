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

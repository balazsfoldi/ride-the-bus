import { useEffect, useMemo, useRef, useState } from 'react';
import type { Guess } from '../model/cards';
import { Card } from '../model/cards';
import { createInitialState, getActivePlayer, getGuessOptions, getNextPrompt } from '../model/gameModel';
import type { GameState } from '../model/gameModel';
import type { OnlineCommand, OnlineSnapshot } from '../model/onlineTypes';
import type { AnimationPhase } from './useRideTheBusController';

const dealDurationMs = 880;
const revealDurationMs = 560;
const foldDurationMs = 560;

type SendCommand = (command: OnlineCommand) => void | Promise<void>;

export function useOnlineRideTheBusController(snapshot: OnlineSnapshot | undefined, sendCommand: SendCommand) {
  const state = snapshot?.state ?? createInitialState();
  const snapshotVersion = snapshot?.version ?? 0;
  const [visibleCards, setVisibleCards] = useState<Card[]>([]);
  const [visibleRevealedCount, setVisibleRevealedCount] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const [dealSequence, setDealSequence] = useState(0);
  const previousState = useRef<GameState | undefined>(undefined);
  const previousSnapshotVersion = useRef<number | undefined>(undefined);
  const timeoutIds = useRef<number[]>([]);

  const activePlayer = getActivePlayer(state);
  const modelPrompt = useMemo(() => getNextPrompt(state), [state]);
  const nextPrompt = animationPhase === 'awaiting-fold' ? 'Click the revealed card to turn the ride back over.' : modelPrompt;
  const guessOptions = useMemo(() => getGuessOptions(state.revealedCount), [state.revealedCount]);
  const isAnimating = animationPhase !== 'idle';

  function clearPendingAnimations() {
    timeoutIds.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    timeoutIds.current = [];
  }

  function queueAnimation(callback: () => void, delay: number) {
    const timeoutId = window.setTimeout(() => {
      timeoutIds.current = timeoutIds.current.filter((currentId) => currentId !== timeoutId);
      callback();
    }, delay);

    timeoutIds.current = [...timeoutIds.current, timeoutId];
  }

  useEffect(() => {
    if (previousSnapshotVersion.current === snapshotVersion) {
      return;
    }

    previousSnapshotVersion.current = snapshotVersion;
    const previous = previousState.current;
    previousState.current = state;

    if (!previous) {
      return;
    }

    clearPendingAnimations();

    if (state.activeCards.length > 0 && previous.activeCards.length === 0) {
      setVisibleCards(state.activeCards);
      setVisibleRevealedCount(0);
      setDealSequence((sequence) => sequence + 1);
      setAnimationPhase('dealing');
      queueAnimation(() => setAnimationPhase('idle'), dealDurationMs);
      return;
    }

    if (state.phase === 'ride' && state.result === 'wrong' && previous.activeCards.length > 0) {
      setVisibleCards(state.activeCards);
      setVisibleRevealedCount(Math.min(previous.revealedCount + 1, state.activeCards.length));
      setAnimationPhase('awaiting-fold');
      return;
    }

    if (previous.phase === 'ride' && previous.result === 'wrong' && state.phase === 'ride' && state.result !== 'wrong' && state.activeCards.length > 0) {
      setVisibleCards(previous.activeCards);
      setVisibleRevealedCount(0);
      setAnimationPhase('folding');
      queueAnimation(() => setAnimationPhase('idle'), foldDurationMs);
      return;
    }

    if (state.activeCards.length > 0 && state.revealedCount > previous.revealedCount) {
      setVisibleCards(state.activeCards);
      setVisibleRevealedCount(state.revealedCount);
      setAnimationPhase('revealing');
      queueAnimation(() => setAnimationPhase('idle'), revealDurationMs);
      return;
    }

    if (state.activeCards.length === 0) {
      setVisibleCards([]);
      setVisibleRevealedCount(0);
      setAnimationPhase('idle');
    }
  }, [state, snapshotVersion]);

  useEffect(() => clearPendingAnimations, []);

  function foldRevealedCards() {
    if (animationPhase !== 'awaiting-fold') {
      return;
    }

    void sendCommand({ type: 'foldWrongGuess' });
  }

  function command(commandToSend: OnlineCommand) {
    void sendCommand(commandToSend);
  }

  return {
    state,
    visibleCards,
    visibleRevealedCount,
    animationPhase,
    dealSequence,
    isAnimating,
    activePlayer,
    nextPrompt,
    guessOptions,
    canStart: state.phase === 'ride' && state.players.length > 0 && state.activeCards.length === 0 && !isAnimating,
    setPlayerName: () => undefined,
    addPlayer: () => undefined,
    startTurn: () => command({ type: 'startTurn' }),
    makeGuess: (guess: Guess) => command({ type: 'makeGuess', guess }),
    foldRevealedCards,
    confirmRideComplete: () => command({ type: 'confirmRideComplete' }),
    moveHandCard: (cardIndex: number, direction: 'left' | 'right') => command({ type: 'moveHandCard', cardIndex, direction }),
    markArrangementReady: () => command({ type: 'markArrangementReady' }),
    togglePyramidSelection: (cardId: string) => command({ type: 'togglePyramidSelection', cardId }),
    markPyramidSelectionReady: () => command({ type: 'markPyramidSelectionReady' }),
    assignPyramidDrink: (targetIndex: number) => command({ type: 'assignPyramidDrink', targetIndex }),
    continuePyramidRound: () => command({ type: 'continuePyramidRound' }),
    startPyramidPhase: () => command({ type: 'startPyramidPhase' }),
    assignDrink: (targetIndex: number) => command({ type: 'assignDrink', targetIndex }),
    skipGiveAway: () => command({ type: 'skipGiveAway' }),
    resetGame: () => command({ type: 'resetRoom' }),
    restartSamePlayers: () => command({ type: 'restartSamePlayers' }),
    shuffleNewDeck: () => undefined,
  };
}
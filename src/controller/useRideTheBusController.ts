import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, Guess } from '../model/cards';
import {
  addPlayer,
  assignDrink,
  assignPyramidDrink,
  confirmRideComplete,
  continuePyramidRound,
  createInitialState,
  foldWrongGuess,
  getActivePlayer,
  getGuessOptions,
  getNextPrompt,
  makeGuess,
  markArrangementReady,
  markPyramidSelectionReady,
  moveHandCard,
  resetGame,
  restartWithSamePlayers,
  setPlayerName,
  shuffleNewDeck,
  skipGiveAway,
  startPyramidPhase,
  startTurn,
  togglePyramidSelection,
} from '../model/gameModel';

const dealDurationMs = 880;
const revealDurationMs = 560;
const foldDurationMs = 560;

export type AnimationPhase = 'idle' | 'dealing' | 'revealing' | 'awaiting-fold' | 'folding';

export function useRideTheBusController() {
  const [state, setState] = useState(() => createInitialState());
  const [visibleCards, setVisibleCards] = useState<Card[]>([]);
  const [visibleRevealedCount, setVisibleRevealedCount] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const [dealSequence, setDealSequence] = useState(0);
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

  function startAnimatedTurn() {
    if (isAnimating) {
      return;
    }

    clearPendingAnimations();
    const next = startTurn(state);
    setState(next);

    if (next.activeCards.length > 0 && state.activeCards.length === 0) {
      setVisibleCards(next.activeCards);
      setVisibleRevealedCount(0);
      setDealSequence((sequence) => sequence + 1);
      setAnimationPhase('dealing');
      queueAnimation(() => setAnimationPhase('idle'), dealDurationMs);
    }
  }

  function makeAnimatedGuess(guess: Guess) {
    if (isAnimating || state.activeCards.length === 0 || state.pendingGiveAway) {
      return;
    }

    clearPendingAnimations();
    const previousCards = state.activeCards;
    const next = makeGuess(state, guess);

    setVisibleCards(previousCards);
    setVisibleRevealedCount(next.revealedCount);
    setAnimationPhase(next.result === 'wrong' ? 'awaiting-fold' : 'revealing');
    setState(next);

    if (next.result === 'wrong') {
      return;
    }

    queueAnimation(() => setAnimationPhase('idle'), revealDurationMs);
  }

  function confirmCompletedRide() {
    if (isAnimating) {
      return;
    }

    clearPendingAnimations();
    setVisibleCards([]);
    setVisibleRevealedCount(0);
    setAnimationPhase('idle');
    setState((current) => confirmRideComplete(current));
  }

  function foldRevealedCards() {
    if (animationPhase !== 'awaiting-fold') {
      return;
    }

    clearPendingAnimations();
    setAnimationPhase('folding');
    setVisibleRevealedCount(0);
    setState((current) => foldWrongGuess(current));
    queueAnimation(() => setAnimationPhase('idle'), foldDurationMs);
  }

  function clearRideAnimation() {
    clearPendingAnimations();
    setVisibleCards([]);
    setVisibleRevealedCount(0);
    setAnimationPhase('idle');
  }

  useEffect(() => clearPendingAnimations, []);

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
    setPlayerName: (name: string) => setState((current) => setPlayerName(current, name)),
    addPlayer: (name: string) => setState((current) => addPlayer(current, name)),
    startTurn: startAnimatedTurn,
    makeGuess: makeAnimatedGuess,
    foldRevealedCards,
    confirmRideComplete: confirmCompletedRide,
    moveHandCard: (cardIndex: number, direction: 'left' | 'right') =>
      setState((current) => moveHandCard(current, cardIndex, direction)),
    markArrangementReady: () => setState((current) => markArrangementReady(current)),
    togglePyramidSelection: (cardId: string) => setState((current) => togglePyramidSelection(current, cardId)),
    markPyramidSelectionReady: () => setState((current) => markPyramidSelectionReady(current)),
    assignPyramidDrink: (targetIndex: number) => setState((current) => assignPyramidDrink(current, targetIndex)),
    continuePyramidRound: () => setState((current) => continuePyramidRound(current)),
    startPyramidPhase: () => {
      clearRideAnimation();
      setState((current) => startPyramidPhase(current));
    },
    assignDrink: (targetIndex: number) => setState((current) => assignDrink(current, targetIndex)),
    skipGiveAway: () => setState((current) => skipGiveAway(current)),
    resetGame: () => {
      clearRideAnimation();
      setState(resetGame());
    },
    restartSamePlayers: () => {
      clearRideAnimation();
      setState((current) => restartWithSamePlayers(current));
    },
    shuffleNewDeck: () => {
      clearRideAnimation();
      setState((current) => shuffleNewDeck(current));
    },
  };
}

export type RideTheBusController = ReturnType<typeof useRideTheBusController>;
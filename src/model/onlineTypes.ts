import type { Guess } from './cards';
import type { GameState } from './gameModel';

export type OnlineRoomPhase = 'lobby' | 'playing';
export type OnlineConnectionState = 'idle' | 'joining' | 'connected' | 'reconnecting' | 'error';

export type OnlineLobbyPlayer = {
  id: string;
  name: string;
  isAdmin: boolean;
  connected: boolean;
};

export type OnlineSnapshot = {
  version: number;
  roomPhase: OnlineRoomPhase;
  selfId: string;
  adminId?: string;
  players: OnlineLobbyPlayer[];
  state?: GameState;
  message: string;
};

export type OnlineCommand =
  | { type: 'startGame' }
  | { type: 'startTurn' }
  | { type: 'makeGuess'; guess: Guess }
  | { type: 'foldWrongGuess' }
  | { type: 'confirmRideComplete' }
  | { type: 'assignDrink'; targetIndex: number }
  | { type: 'skipGiveAway' }
  | { type: 'startPyramidPhase' }
  | { type: 'moveHandCard'; cardIndex: number; direction: 'left' | 'right' }
  | { type: 'markArrangementReady' }
  | { type: 'togglePyramidSelection'; cardId: string }
  | { type: 'markPyramidSelectionReady' }
  | { type: 'assignPyramidDrink'; targetIndex: number }
  | { type: 'continuePyramidRound' }
  | { type: 'leaveRoom' }
  | { type: 'resetRoom' }
  | { type: 'restartSamePlayers' };

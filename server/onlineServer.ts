import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import type { Card } from '../src/model/cards';
import type { GameState, Player } from '../src/model/gameModel';
import type { OnlineCommand, OnlineLobbyPlayer, OnlineSnapshot } from '../src/model/onlineTypes';
import {
  assignDrink,
  assignPyramidDrink,
  confirmRideComplete,
  continuePyramidRound,
  createInitialState,
  foldWrongGuess,
  getActivePlayer,
  getCurrentDrinkGiver,
  getPyramidRowStart,
  makeGuess,
  markPlayerArrangementReady,
  markPlayerPyramidSelectionReady,
  movePlayerHandCard,
  pyramidRows,
  resetGame,
  restartWithSamePlayers,
  skipGiveAway,
  startPyramidPhase,
  startTurn,
  togglePlayerPyramidSelection,
} from '../src/model/gameModel';

const port = Number(process.env.PORT ?? 80);
const distDir = resolve(process.cwd(), 'dist');
const clients = new Map<string, Set<ServerResponse>>();
const roomAccessCode = String(process.env.ROOM_ACCESS_CODE ?? '').trim();
const maxPlayers = Math.max(1, Number(process.env.MAX_PLAYERS ?? 12));
const maxNameLength = 24;
const appVersion = getAppVersion();

const securityHeaders = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'cross-origin-opener-policy': 'same-origin',
};


function getAppVersion() {
  if (process.env.APP_VERSION) {
    return process.env.APP_VERSION;
  }

  try {
    const packageJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as { version?: string };
    return packageJson.version ?? '0.0.0';
  } catch {
    return '0.0.0';
  }
}

let version = 0;
let roomPhase: 'lobby' | 'playing' = 'lobby';
let adminId: string | undefined;
let lobbyPlayers: OnlineLobbyPlayer[] = [];
let state: GameState = createInitialState();
let roomMessage = 'Join the room to play Ride the Bus online.';

function nextVersion() {
  version += 1;
}

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    ...securityHeaders,
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req: IncomingMessage) {
  return new Promise<Record<string, unknown>>((resolveBody, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 128_000) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolveBody({});
        return;
      }

      try {
        resolveBody(JSON.parse(data) as Record<string, unknown>);
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
    req.on('error', reject);
  });
}

function getLobbyPlayer(sessionId: string) {
  return lobbyPlayers.find((player) => player.id === sessionId);
}

function isAdmin(sessionId: string) {
  return sessionId === adminId;
}

function normalizePlayerName(name: string) {
  return name.trim().replace(/\s+/g, ' ').slice(0, maxNameLength);
}

function upsertLobbyPlayer(sessionId: string, name: string) {
  const existing = getLobbyPlayer(sessionId);

  if (existing) {
    existing.name = name;
    existing.connected = true;
    return existing;
  }

  if (lobbyPlayers.length >= maxPlayers) {
    throw new Error(`The room is full (${maxPlayers} players).`);
  }

  if (!adminId) {
    adminId = sessionId;
  }

  const player: OnlineLobbyPlayer = {
    id: sessionId,
    name,
    isAdmin: sessionId === adminId,
    connected: true,
  };
  lobbyPlayers = [...lobbyPlayers, player];
  return player;
}

function normalizeLobbyPlayers() {
  if (!adminId && lobbyPlayers.length > 0) {
    adminId = lobbyPlayers[0].id;
  }

  lobbyPlayers = lobbyPlayers.map((player) => ({ ...player, isAdmin: player.id === adminId }));
}

function hiddenCard(id: string): Card {
  return { id, rank: 'A', suit: 'spades', value: 14 };
}

function hiddenCards(ownerId: string, count: number) {
  return Array.from({ length: count }, (_, index) => hiddenCard(`hidden-${ownerId}-${index}`));
}

function getRevealedPyramidRow(maskedState: GameState) {
  if (maskedState.phase === 'arrange' || maskedState.phase === 'ride' || maskedState.phase === 'ride-complete') {
    return -1;
  }

  if (maskedState.phase === 'game-over') {
    return pyramidRows.length - 1;
  }

  return maskedState.pyramidRoundIndex;
}

function maskPyramidCards(maskedState: GameState) {
  const revealedRow = getRevealedPyramidRow(maskedState);

  if (revealedRow < 0) {
    return maskedState.pyramidCards.map((_, index) => hiddenCard(`hidden-pyramid-${index}`));
  }

  const revealedCount = getPyramidRowStart(revealedRow) + pyramidRows[revealedRow];
  return maskedState.pyramidCards.map((card, index) => (index < revealedCount ? card : hiddenCard(`hidden-pyramid-${index}`)));
}

function maskStateFor(sessionId: string): GameState | undefined {
  if (roomPhase !== 'playing') {
    return undefined;
  }

  const maskedPlayers = state.players.map((player) =>
    player.id === sessionId ? player : { ...player, hand: hiddenCards(player.id, player.hand.length) },
  );
  const activeCards = state.activeCards.map((card, index) =>
    index < state.revealedCount ? card : hiddenCard(`hidden-active-${index}`),
  );
  const pyramidSelections =
    state.phase === 'pyramid-resolve' || state.phase === 'game-over'
      ? state.pyramidSelections
      : Object.fromEntries(Object.entries(state.pyramidSelections).filter(([playerId]) => playerId === sessionId));

  return {
    ...state,
    players: maskedPlayers,
    activeCards,
    pyramidCards: maskPyramidCards(state),
    pyramidSelections,
  };
}

function snapshotFor(sessionId: string): OnlineSnapshot {
  normalizeLobbyPlayers();

  return {
    version,
    roomPhase,
    selfId: sessionId,
    adminId,
    players: lobbyPlayers,
    state: maskStateFor(sessionId),
    message: roomMessage,
  };
}

function sendEvent(sessionId: string, res: ServerResponse) {
  res.write('event: snapshot\n');
  res.write(`data: ${JSON.stringify(snapshotFor(sessionId))}\n\n`);
}

function broadcast() {
  for (const [sessionId, responses] of clients.entries()) {
    for (const res of responses) {
      sendEvent(sessionId, res);
    }
  }
}

function getTargetPlayerId(index: number) {
  return state.players[index]?.id;
}

function activePlayerIs(sessionId: string) {
  return getActivePlayer(state)?.id === sessionId;
}

function startOnlineGame() {
  const players: Player[] = lobbyPlayers.map((player) => ({
    id: player.id,
    name: player.name,
    hand: [],
    drinks: 0,
    givenDrinks: 0,
    completedRounds: 0,
  }));
  state = {
    ...createInitialState(),
    players,
    message: `${players[0]?.name ?? 'First player'} is ready for four hidden cards.`,
  };
  roomPhase = 'playing';
  roomMessage = 'The online game has started.';
}

function resetOnlineRoom() {
  roomPhase = 'lobby';
  state = resetGame();
  roomMessage = 'Room reset. Admin can start a new game.';
}

function closeOnlineRoom(message = 'The admin closed the room.') {
  roomPhase = 'lobby';
  adminId = undefined;
  lobbyPlayers = [];
  state = resetGame();
  roomMessage = message;
}

function removePlayerFromGame(sessionId: string) {
  const nextPlayerCount = Math.max(0, state.players.length - 1);

  state = {
    ...state,
    players: state.players.filter((player) => player.id !== sessionId),
    activePlayerIndex: Math.max(0, Math.min(state.activePlayerIndex, nextPlayerCount - 1)),
    arrangingPlayerIndex: Math.max(0, Math.min(state.arrangingPlayerIndex, nextPlayerCount - 1)),
    pyramidSelectingPlayerIndex: Math.max(0, Math.min(state.pyramidSelectingPlayerIndex, nextPlayerCount - 1)),
    readyPlayerIds: state.readyPlayerIds.filter((playerId) => playerId !== sessionId),
    pyramidDrinkGiverIds: state.pyramidDrinkGiverIds.filter((playerId) => playerId !== sessionId),
    pyramidSelections: Object.fromEntries(Object.entries(state.pyramidSelections).filter(([playerId]) => playerId !== sessionId)),
  };
}

function leaveOnlineRoom(sessionId: string) {
  const player = getLobbyPlayer(sessionId);

  if (!player) {
    return;
  }

  if (isAdmin(sessionId)) {
    closeOnlineRoom('The admin left. The room was closed.');
    return;
  }

  lobbyPlayers = lobbyPlayers.filter((currentPlayer) => currentPlayer.id !== sessionId);
  removePlayerFromGame(sessionId);

  if (lobbyPlayers.length === 0) {
    closeOnlineRoom('The room is empty.');
    return;
  }

  roomMessage = `${player.name} left the room.`;
}

function applyCommand(sessionId: string, command: OnlineCommand) {
  if (command.type === 'leaveRoom') {
    leaveOnlineRoom(sessionId);
    return;
  }

  if (!getLobbyPlayer(sessionId)) {
    throw new Error('Join the room first.');
  }

  if (command.type === 'resetRoom') {
    if (!isAdmin(sessionId)) {
      throw new Error('Only the admin can reset the room.');
    }
    resetOnlineRoom();
    return;
  }

  if (command.type === 'restartSamePlayers') {
    if (!isAdmin(sessionId)) {
      throw new Error('Only the admin can start a rematch.');
    }
    state = restartWithSamePlayers(state);
    roomPhase = 'playing';
    roomMessage = 'Rematch started with the same players.';
    return;
  }

  if (command.type === 'startGame') {
    if (!isAdmin(sessionId)) {
      throw new Error('Only the admin can start the game.');
    }
    if (roomPhase !== 'lobby') {
      throw new Error('The game has already started.');
    }
    if (lobbyPlayers.length === 0) {
      throw new Error('Add at least one player.');
    }
    startOnlineGame();
    return;
  }

  if (roomPhase !== 'playing') {
    throw new Error('The game has not started yet.');
  }

  switch (command.type) {
    case 'startTurn': {
      if (!activePlayerIs(sessionId)) throw new Error('Only the active player can deal.');
      state = startTurn(state);
      return;
    }
    case 'makeGuess': {
      if (!activePlayerIs(sessionId)) throw new Error('Only the active player can guess.');
      state = makeGuess(state, command.guess);
      return;
    }
    case 'foldWrongGuess': {
      if (!activePlayerIs(sessionId)) throw new Error('Only the active player can turn the ride back over.');
      state = foldWrongGuess(state);
      return;
    }
    case 'confirmRideComplete': {
      if (!activePlayerIs(sessionId)) throw new Error('Only the active player can confirm these cards.');
      state = confirmRideComplete(state);
      return;
    }
    case 'assignDrink': {
      if (!activePlayerIs(sessionId)) throw new Error('Only the active player can assign this drink.');
      if (getTargetPlayerId(command.targetIndex) === sessionId) throw new Error('You cannot assign this drink to yourself.');
      state = assignDrink(state, command.targetIndex);
      return;
    }
    case 'skipGiveAway': {
      if (!activePlayerIs(sessionId)) throw new Error('Only the active player can skip this give-away.');
      state = skipGiveAway(state);
      return;
    }
    case 'startPyramidPhase': {
      if (!isAdmin(sessionId)) throw new Error('Only the admin can start the next phase.');
      state = startPyramidPhase(state);
      return;
    }
    case 'moveHandCard': {
      state = movePlayerHandCard(state, sessionId, command.cardIndex, command.direction);
      return;
    }
    case 'markArrangementReady': {
      state = markPlayerArrangementReady(state, sessionId);
      return;
    }
    case 'togglePyramidSelection': {
      state = togglePlayerPyramidSelection(state, sessionId, command.cardId);
      return;
    }
    case 'markPyramidSelectionReady': {
      state = markPlayerPyramidSelectionReady(state, sessionId);
      return;
    }
    case 'assignPyramidDrink': {
      const currentGiver = getCurrentDrinkGiver(state);
      if (currentGiver?.id !== sessionId) throw new Error('Only the current giver can assign pyramid drinks.');
      if (getTargetPlayerId(command.targetIndex) === sessionId) throw new Error('You cannot assign drinks to yourself.');
      state = assignPyramidDrink(state, command.targetIndex);
      return;
    }
    case 'continuePyramidRound': {
      if (!isAdmin(sessionId) && getCurrentDrinkGiver(state)) {
        throw new Error('Only the admin can continue this round.');
      }
      state = continuePyramidRound(state);
      return;
    }
    default: {
      const exhaustive: never = command;
      throw new Error(`Unsupported command: ${JSON.stringify(exhaustive)}`);
    }
  }
}

async function handleJoin(req: IncomingMessage, res: ServerResponse) {
  const body = await readBody(req);
  const name = normalizePlayerName(String(body.name ?? ''));
  const requestedSessionId = typeof body.sessionId === 'string' ? body.sessionId : undefined;
  const knownSession = requestedSessionId ? getLobbyPlayer(requestedSessionId) : undefined;
  const accessCode = String(body.accessCode ?? '');

  if (!name) {
    json(res, 400, { error: 'Name is required.' });
    return;
  }

  if (roomAccessCode && !knownSession && accessCode !== roomAccessCode) {
    json(res, 403, { error: 'Room access code is required.' });
    return;
  }

  if (roomPhase === 'playing' && !knownSession) {
    json(res, 409, { error: 'The game has already started.' });
    return;
  }

  try {
    const sessionId = requestedSessionId || randomUUID();
    upsertLobbyPlayer(sessionId, name);
    roomMessage = knownSession ? `${name} changed their name.` : `${name} joined the online room.`;
    nextVersion();
    json(res, 200, { sessionId, snapshot: snapshotFor(sessionId) });
    broadcast();
  } catch (error) {
    json(res, 400, { error: error instanceof Error ? error.message : 'Could not join the room.' });
  }
}

async function handleCommand(req: IncomingMessage, res: ServerResponse) {
  const body = await readBody(req);
  const sessionId = String(body.sessionId ?? '');
  const command = body.command as OnlineCommand | undefined;

  if (!sessionId || !command?.type) {
    json(res, 400, { error: 'Session and command are required.' });
    return;
  }

  try {
    applyCommand(sessionId, command);
    nextVersion();
    json(res, 200, { snapshot: snapshotFor(sessionId) });
    broadcast();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Command failed.';
    json(res, 400, { error: message, snapshot: snapshotFor(sessionId) });
  }
}

function handleEvents(url: URL, res: ServerResponse) {
  const sessionId = url.searchParams.get('sessionId') ?? '';

  if (!getLobbyPlayer(sessionId)) {
    json(res, 401, { error: 'Join the room first.' });
    return;
  }

  res.writeHead(200, {
    ...securityHeaders,
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
    'x-accel-buffering': 'no',
  });

  let responses = clients.get(sessionId);
  if (!responses) {
    responses = new Set();
    clients.set(sessionId, responses);
  }
  responses.add(res);
  sendEvent(sessionId, res);

  const interval = setInterval(() => {
    res.write(': keep-alive\n\n');
  }, 25_000);

  res.on('close', () => {
    clearInterval(interval);
    responses?.delete(res);
    if (responses?.size === 0) {
      clients.delete(sessionId);
    }
  });
}

const mimeTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

function serveStatic(pathname: string, res: ServerResponse) {
  const safePath = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  let filePath = resolve(distDir, safePath || 'index.html');

  if (!filePath.startsWith(distDir)) {
    json(res, 403, { error: 'Forbidden.' });
    return;
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(distDir, 'index.html');
  }

  const extension = extname(filePath);
  res.writeHead(200, { ...securityHeaders, 'content-type': mimeTypes[extension] ?? 'application/octet-stream' });
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      json(res, 200, { ok: true, version: appVersion, roomPhase, players: lobbyPlayers.length, maxPlayers, accessCodeRequired: Boolean(roomAccessCode) });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/online/events') {
      handleEvents(url, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/online/join') {
      await handleJoin(req, res);
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/online/command') {
      await handleCommand(req, res);
      return;
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(url.pathname, res);
      return;
    }

    json(res, 405, { error: 'Method not allowed.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error.';
    json(res, 500, { error: message });
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Ride the Bus online server listening on ${port}`);
});

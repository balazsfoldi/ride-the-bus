import type { CSSProperties, FormEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, CirclePlus, Home, RotateCcw, Shuffle, Trophy, Wine } from 'lucide-react';
import { useRideTheBusController } from '../controller/useRideTheBusController';
import type { RideTheBusController } from '../controller/useRideTheBusController';
import { Card, suitSymbols } from '../model/cards';
import { getPlayerSelection, getRemainingPyramidDrinkCount, maxPyramidSelections, pyramidRows } from '../model/gameModel';
import { PlayingCard } from './PlayingCard';

type AppViewProps = {
  controller?: RideTheBusController;
  onlineMode?: boolean;
  viewerPlayerId?: string;
  viewerPlayerName?: string;
  isAdmin?: boolean;
  onlineConnectionState?: string;
  onlineError?: string;
  onBackToMenu?: () => void;
};

export function AppView({
  controller: providedController,
  onlineMode = false,
  viewerPlayerId,
  viewerPlayerName,
  isAdmin = false,
  onlineConnectionState,
  onlineError,
  onBackToMenu,
}: AppViewProps = {}) {
  const offlineController = useRideTheBusController();
  const controller = providedController ?? offlineController;
  const { state, activePlayer, nextPrompt, guessOptions, canStart } = controller;
  const displayCards = controller.visibleCards.length > 0 ? controller.visibleCards : state.activeCards;
  const activeCardIndex = controller.animationPhase === 'idle' ? state.revealedCount : controller.visibleRevealedCount - 1;
  const viewerPlayer = state.players.find((player) => player.id === viewerPlayerId);
  const arrangingPlayer = state.players[state.arrangingPlayerIndex];
  const selectingPlayer = state.players[state.pyramidSelectingPlayerIndex];
  const arrangePlayerForView = onlineMode ? viewerPlayer : arrangingPlayer;
  const selectPlayerForView = onlineMode ? viewerPlayer : selectingPlayer;
  const currentGiverId = state.pyramidDrinkGiverIds[state.pyramidResolvingGiverIndex];
  const currentGiver = state.players.find((player) => player.id === currentGiverId);
  const drinkTargets = state.players.map((player, index) => ({ player, index })).filter(({ index }) => index !== state.activePlayerIndex);
  const pyramidDrinkTargets = state.players.map((player, index) => ({ player, index })).filter(({ player }) => player.id !== currentGiver?.id);
  const canAddPlayer = !onlineMode && state.phase === 'ride' && state.activeCards.length === 0 && state.players.every((player) => player.completedRounds === 0);
  const isRideTablePhase = state.phase === 'ride' || state.phase === 'ride-complete';
  const canActAs = (playerId?: string) => !onlineMode || Boolean(playerId && playerId === viewerPlayerId);
  const canControlRide = canActAs(activePlayer?.id) && !controller.isAnimating;
  const canFoldRide = canActAs(activePlayer?.id) && controller.animationPhase === 'awaiting-fold';
  const canStartCurrentTurn = canStart && canActAs(activePlayer?.id);
  const canConfirmRide = state.result === 'round-complete' && state.activeCards.length > 0 && canActAs(activePlayer?.id) && !controller.isAnimating;
  const canStartPyramid = !onlineMode || isAdmin;
  const canArrangeCards = onlineMode ? Boolean(viewerPlayer && !state.readyPlayerIds.includes(viewerPlayer.id)) : canActAs(arrangingPlayer?.id);
  const canSelectPyramidCards = onlineMode ? Boolean(viewerPlayer && !state.readyPlayerIds.includes(viewerPlayer.id)) : canActAs(selectingPlayer?.id);
  const canAssignPyramidDrinks = canActAs(currentGiver?.id);
  const canContinuePyramid = !onlineMode || isAdmin;
  const revealedPyramidRow = getRevealedPyramidRow(state.phase, state.pyramidRoundIndex);
  const sidebarActiveIndex = getSidebarActiveIndex(state.phase, state.activePlayerIndex, state.arrangingPlayerIndex, state.pyramidSelectingPlayerIndex, state.players, currentGiverId);
  const readyLabel = `Ready ${state.readyPlayerIds.length}/${state.players.length}`;

  function handleAddPlayer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    controller.addPlayer(state.playerName);
  }

  return (
    <main className="app-shell">
      <section className="game-surface" aria-label="Ride the Bus game">
        <header className="table-header">
          <div>
            <p className="eyebrow">Party card game</p>
            <h1>Ride the Bus</h1>
          </div>
          <div className="header-tools">
            {onlineMode ? (
              <div className="connection-stack">
                <span className={`connection-pill connection-${onlineConnectionState ?? 'idle'}`}>{onlineConnectionState ?? 'online'}</span>
                {viewerPlayerName ? <span className="viewer-name">You: {viewerPlayerName}</span> : null}
              </div>
            ) : null}
            {onBackToMenu ? (
              <button className="icon-action" type="button" onClick={onBackToMenu} aria-label="Back to menu">
                <Home size={18} aria-hidden="true" />
              </button>
            ) : null}
            <div className="dealer-stack" aria-label={`${state.deck.length} cards left in deck`}>
              <span className="mini-card" />
              <span>{state.deck.length}</span>
            </div>
          </div>
        </header>

        {isRideTablePhase ? (
          <section className="play-area">
            <div className="turn-panel">
              <div>
                <p className="eyebrow">Current rider</p>
                <h2>{activePlayer?.name ?? 'No players yet'}</h2>
              </div>
              <p className={`status ${onlineError ? 'status-wrong' : `status-${state.result}`}`}>{onlineError || state.message}</p>
            </div>

            <div className={`cards cards-${controller.animationPhase}`} aria-label="Active cards">
              {Array.from({ length: 4 }).map((_, index) => {
                const card = displayCards[index];
                const isVisible = Boolean(card) && index < controller.visibleRevealedCount;

                return (
                  <PlayingCard
                    key={`${controller.dealSequence}-${index}`}
                    card={card}
                    revealed={isVisible}
                    active={index === activeCardIndex && state.activeCards.length > 0}
                    index={index}
                    animationPhase={controller.animationPhase}
                    onClick={controller.foldRevealedCards}
                    canFoldCards={canFoldRide}
                  />
                );
              })}
            </div>

            <div className="guess-panel">
              <p>{nextPrompt}</p>
              {state.phase === 'ride-complete' ? (
                <button className="primary-action" type="button" onClick={controller.startPyramidPhase} disabled={controller.isAnimating || !canStartPyramid}>
                  <Shuffle size={18} aria-hidden="true" />
                  Next phase
                </button>
              ) : canConfirmRide ? (
                <button className="primary-action" type="button" onClick={controller.confirmRideComplete}>
                  <Check size={18} aria-hidden="true" />
                  Ready
                </button>
              ) : state.pendingGiveAway ? (
                <div className="guess-actions assign-actions">
                  {drinkTargets.length === 0 ? <span className="assign-empty">No other players</span> : null}
                  {drinkTargets.map(({ player, index }) => (
                    <button key={player.id} type="button" onClick={() => controller.assignDrink(index)} disabled={!canControlRide}>
                      {player.name}
                    </button>
                  ))}
                  <button type="button" onClick={controller.skipGiveAway} disabled={!canControlRide}>
                    Skip
                  </button>
                </div>
              ) : state.activeCards.length > 0 ? (
                <div className="guess-actions">
                  {guessOptions.map((option) => (
                    <button key={option.guess} type="button" onClick={() => controller.makeGuess(option.guess)} disabled={!canControlRide}>
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : (
                <button className="primary-action" type="button" onClick={controller.startTurn} disabled={!canStartCurrentTurn}>
                  <Shuffle size={18} aria-hidden="true" />
                  Deal four cards
                </button>
              )}
            </div>
          </section>
        ) : (
          <section className="play-area arrange-area">
            <div className="turn-panel">
              <div>
                <p className="eyebrow">{getPhaseEyebrow(state.phase, state.pyramidRoundIndex)}</p>
                <h2>{getPhaseTitle(state.phase, onlineMode, arrangingPlayer?.name, selectingPlayer?.name, currentGiver?.name)}</h2>
              </div>
              <p className={`status ${onlineError ? 'status-wrong' : `status-${state.result}`}`}>{onlineError || state.message}</p>
            </div>

            <Pyramid cards={state.pyramidCards} revealedThroughRow={revealedPyramidRow} />

            {state.phase === 'arrange' && arrangePlayerForView ? (
              canArrangeCards ? (
                <ArrangePanel player={arrangePlayerForView} readyLabel={onlineMode ? readyLabel : undefined} onMove={controller.moveHandCard} onReady={controller.markArrangementReady} />
              ) : (
                <WaitingPanel title={onlineMode ? readyLabel : arrangingPlayer?.name ?? 'Waiting'} message={onlineMode ? 'Waiting for everyone to arrange their cards.' : 'Arranging their cards.'} />
              )
            ) : state.phase === 'pyramid-select' && selectPlayerForView ? (
              canSelectPyramidCards ? (
                <PyramidSelectPanel
                  player={selectPlayerForView}
                  readyLabel={onlineMode ? readyLabel : undefined}
                  selectedCardIds={getPlayerSelection(state, selectPlayerForView.id)}
                  onToggle={controller.togglePyramidSelection}
                  onReady={controller.markPyramidSelectionReady}
                />
              ) : (
                <WaitingPanel title={onlineMode ? readyLabel : selectingPlayer?.name ?? 'Waiting'} message={onlineMode ? 'Waiting for everyone to choose cards.' : 'Selecting pyramid cards.'} />
              )
            ) : state.phase === 'pyramid-resolve' ? (
              <PyramidResolvePanel
                players={state.players}
                results={state.pyramidRoundResults}
                drinkAmount={state.pyramidRoundIndex + 1}
                currentGiver={currentGiver}
                drinkTargets={pyramidDrinkTargets}
                onAssignDrink={controller.assignPyramidDrink}
                onContinue={controller.continuePyramidRound}
                canAssignDrink={canAssignPyramidDrinks}
                canContinue={canContinuePyramid}
              />
            ) : (
              <GameOverPanel
                players={state.players}
                canRestart={!onlineMode || isAdmin}
                onRestart={controller.restartSamePlayers}
                onMenu={onBackToMenu}
              />
            )}
          </section>
        )}

        <aside className="side-panel">
          <form className="player-form" onSubmit={handleAddPlayer}>
            <label htmlFor="player-name">Player name</label>
            <div className="field-row">
              <input
                id="player-name"
                type="text"
                value={state.playerName}
                onChange={(event) => controller.setPlayerName(event.target.value)}
                placeholder="e.g. Anna"
                disabled={!canAddPlayer}
              />
              <button type="submit" aria-label="Add player" disabled={!canAddPlayer}>
                <CirclePlus size={20} aria-hidden="true" />
              </button>
            </div>
          </form>

          <div className="players-list">
            {state.players.length === 0 ? (
              <p className="empty-state">Add at least one player to start.</p>
            ) : (
              state.players.map((player, index) => {
                const isCurrent = index === sidebarActiveIndex;
                const isReady = state.readyPlayerIds.includes(player.id);

                return (
                  <article className={isCurrent ? 'player-row active' : 'player-row'} key={player.id}>
                    <div>
                      <strong>{player.name}</strong>
                      <span>{isReady ? 'Ready' : `${player.hand.length} cards held`}</span>
                    </div>
                    <div className="score">
                      <span title="Drinks">
                        <Wine size={16} aria-hidden="true" />
                        {player.drinks}
                      </span>
                      <span title="Drinks given">+{player.givenDrinks}</span>
                      <span title="Completed rides">
                        <Trophy size={16} aria-hidden="true" />
                        {player.completedRounds}
                      </span>
                    </div>
                  </article>
                );
              })
            )}
          </div>

          <div className="table-actions">
            <button type="button" onClick={controller.shuffleNewDeck} disabled={controller.isAnimating || state.phase !== 'ride' || onlineMode}>
              <Shuffle size={18} aria-hidden="true" />
              New deck
            </button>
            <button type="button" onClick={controller.resetGame} disabled={onlineMode && !isAdmin}>
              <RotateCcw size={18} aria-hidden="true" />
              Reset
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

type PlayerView = {
  id: string;
  name: string;
  hand: Card[];
  drinks: number;
  givenDrinks: number;
};

type PyramidProps = {
  cards: Card[];
  revealedThroughRow: number;
};

function Pyramid({ cards, revealedThroughRow }: PyramidProps) {
  let offset = 0;

  return (
    <div className="pyramid" aria-label="Pyramid">
      {pyramidRows.map((rowSize, rowIndex) => {
        const rowCards = cards.slice(offset, offset + rowSize);
        const rowStart = offset;
        offset += rowSize;

        return (
          <div className="pyramid-row" key={rowSize}>
            {rowCards.map((card, index) => {
              const revealed = rowIndex <= revealedThroughRow;
              const colorClass = card.suit === 'hearts' || card.suit === 'diamonds' ? 'red' : 'black';

              return (
                <div
                  className={revealed ? `pyramid-card revealed ${colorClass}` : 'pyramid-card'}
                  key={card.id}
                  style={{ '--pyramid-order': rowStart + index } as CSSProperties}
                  aria-label={revealed ? `${card.rank} of ${card.suit}` : 'Face-down pyramid card'}
                >
                  {revealed ? (
                    <>
                      <span className="pyramid-rank">{card.rank}</span>
                      <span className="pyramid-symbol">{suitSymbols[card.suit]}</span>
                    </>
                  ) : (
                    <span>RTB</span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

type ArrangePanelProps = {
  player: PlayerView;
  readyLabel?: string;
  onMove: (cardIndex: number, direction: 'left' | 'right') => void;
  onReady: () => void;
};

function ArrangePanel({ player, readyLabel, onMove, onReady }: ArrangePanelProps) {
  return (
    <div className="arrange-panel">
      <div className="arrange-header">
        <div>
          <p className="eyebrow">{player.name}'s hand</p>
          {readyLabel ? <p className="selection-count">{readyLabel}</p> : null}
        </div>
        <button className="primary-action" type="button" onClick={onReady}>
          <Check size={18} aria-hidden="true" />
          Ready
        </button>
      </div>
      <div className="arrange-hand">
        {player.hand.map((card, index) => (
          <div className="arrange-card" key={card.id}>
            <PlayingCard card={card} revealed active={false} index={index} animationPhase="idle" onClick={() => undefined} />
            <div className="reorder-actions">
              <button type="button" onClick={() => onMove(index, 'left')} disabled={index === 0} aria-label="Move card left">
                <ChevronLeft size={18} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => onMove(index, 'right')} disabled={index === player.hand.length - 1} aria-label="Move card right">
                <ChevronRight size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

type PyramidSelectPanelProps = {
  player: PlayerView;
  readyLabel?: string;
  selectedCardIds: string[];
  onToggle: (cardId: string) => void;
  onReady: () => void;
};

function PyramidSelectPanel({ player, readyLabel, selectedCardIds, onToggle, onReady }: PyramidSelectPanelProps) {
  return (
    <div className="arrange-panel">
      <div className="arrange-header">
        <div>
          <p className="eyebrow">{player.name}'s cards</p>
          <p className="selection-count">{selectedCardIds.length}/{maxPyramidSelections} selected{readyLabel ? ` - ${readyLabel}` : ''}</p>
        </div>
        <button className="primary-action" type="button" onClick={onReady}>
          <Check size={18} aria-hidden="true" />
          Ready
        </button>
      </div>
      <div className="arrange-hand selectable-hand">
        {player.hand.map((card, index) => (
          <PlayingCard
            key={card.id}
            card={card}
            revealed={false}
            active={false}
            index={index}
            animationPhase="idle"
            selectable
            selected={selectedCardIds.includes(card.id)}
            onClick={() => onToggle(card.id)}
          />
        ))}
      </div>
    </div>
  );
}

function WaitingPanel({ title, message }: { title: string; message: string }) {
  return (
    <div className="arrange-panel ready-panel waiting-panel">
      <article className="resolve-row">
        <div>
          <strong>{title}</strong>
          <span>{message}</span>
        </div>
      </article>
    </div>
  );
}

type PyramidResolvePanelProps = {
  players: PlayerView[];
  results: Array<{
    playerId: string;
    selectedCardIds: string[];
    selectedCards: Card[];
    matchingCardIds: string[];
    missedCardIds: string[];
    giveDrinkAmount: number;
    drinkAmount: number;
    drinkAssignments: Record<string, number>;
    outcome: 'give' | 'drink' | 'give-and-drink' | 'pass';
  }>;
  drinkAmount: number;
  currentGiver?: PlayerView;
  drinkTargets: Array<{ player: PlayerView; index: number }>;
  onAssignDrink: (targetIndex: number) => void;
  onContinue: () => void;
  canAssignDrink: boolean;
  canContinue: boolean;
};

function PyramidResolvePanel({ players, results, drinkAmount, currentGiver, drinkTargets, onAssignDrink, onContinue, canAssignDrink, canContinue }: PyramidResolvePanelProps) {
  const currentGiverResult = currentGiver ? results.find((result) => result.playerId === currentGiver.id) : undefined;
  const currentGiveAmount = currentGiverResult ? getRemainingPyramidDrinkCount(currentGiverResult) : drinkAmount;

  return (
    <div className="arrange-panel resolve-panel">
      <div className="arrange-header">
        <p className="eyebrow">Round result: {drinkAmount} drink(s)</p>
        {currentGiver || !canContinue ? null : (
          <button className="primary-action" type="button" onClick={onContinue}>
            <Check size={18} aria-hidden="true" />
            Continue
          </button>
        )}
      </div>

      <div className="resolve-grid">
        {players.map((player) => {
          const result = results.find((roundResult) => roundResult.playerId === player.id);
          const selectedCards = result?.selectedCards ?? [];

          return (
            <article className={`resolve-row outcome-${result?.outcome ?? 'pass'}`} key={player.id}>
              <div>
                <strong>{player.name}</strong>
                <span>{getOutcomeLabel(result)}</span>
              </div>
              <div className="resolve-cards">
                {selectedCards.length === 0 ? (
                  <span className="assign-empty">Passed</span>
                ) : (
                  selectedCards.map((card, index) => (
                    <PlayingCard key={card.id} card={card} revealed active={false} index={index} animationPhase="idle" onClick={() => undefined} />
                  ))
                )}
              </div>
            </article>
          );
        })}
      </div>

      {currentGiver ? (
        <div className="guess-panel resolve-actions">
          <p>{currentGiver.name} gives {currentGiveAmount} more drink(s)</p>
          <div className="guess-actions">
            {drinkTargets.map(({ player, index }) => {
              const assignedDrinks = currentGiverResult?.drinkAssignments[player.id] ?? 0;

              return (
                <button key={player.id} type="button" onClick={() => onAssignDrink(index)} disabled={!canAssignDrink}>
                  +1 {player.name}{assignedDrinks > 0 ? ` (${assignedDrinks})` : ''}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GameOverPanel({ players, canRestart, onRestart, onMenu }: { players: PlayerView[]; canRestart: boolean; onRestart: () => void; onMenu?: () => void }) {
  const rankedPlayers = [...players].sort((a, b) => a.drinks - b.drinks || b.givenDrinks - a.givenDrinks || a.name.localeCompare(b.name));

  return (
    <div className="arrange-panel scoreboard-panel">
      <div className="arrange-header">
        <div>
          <p className="eyebrow">Scoreboard</p>
          <h2>{rankedPlayers[0]?.name ?? 'Nobody'} wins</h2>
        </div>
        <div className="scoreboard-actions">
          {onMenu ? (
            <button className="secondary-action" type="button" onClick={onMenu}>
              <Home size={18} aria-hidden="true" />
              Menu
            </button>
          ) : null}
          <button className="primary-action" type="button" onClick={onRestart} disabled={!canRestart}>
            <RotateCcw size={18} aria-hidden="true" />
            New game
          </button>
        </div>
      </div>
      <div className="scoreboard-list">
        {rankedPlayers.map((player, index) => (
          <article className="scoreboard-row" key={player.id}>
            <span className="scoreboard-rank">#{index + 1}</span>
            <div>
              <strong>{player.name}</strong>
              <span>{player.drinks} drunk, {player.givenDrinks} given</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function getRevealedPyramidRow(phase: string, roundIndex: number): number {
  if (phase === 'arrange' || phase === 'ride' || phase === 'ride-complete') {
    return -1;
  }

  if (phase === 'game-over') {
    return pyramidRows.length - 1;
  }

  return roundIndex;
}

function getPhaseEyebrow(phase: string, roundIndex: number): string {
  if (phase === 'arrange') {
    return 'Pyramid setup';
  }

  if (phase === 'pyramid-select' || phase === 'pyramid-resolve') {
    return `Pyramid round ${roundIndex + 1}`;
  }

  return 'Game over';
}

function getPhaseTitle(phase: string, onlineMode: boolean, arrangingName?: string, selectingName?: string, giverName?: string): string {
  if (phase === 'arrange') {
    return onlineMode ? 'Arrange your hand' : arrangingName ?? 'No player';
  }

  if (phase === 'pyramid-select') {
    return onlineMode ? 'Choose your cards' : selectingName ?? 'Select cards';
  }

  if (phase === 'pyramid-resolve') {
    return giverName ?? 'Resolve row';
  }

  return 'Finished';
}

function getSidebarActiveIndex(
  phase: string,
  activePlayerIndex: number,
  arrangingPlayerIndex: number,
  selectingPlayerIndex: number,
  players: PlayerView[],
  giverId?: string,
): number {
  if (phase === 'ride' || phase === 'ride-complete') {
    return activePlayerIndex;
  }

  if (phase === 'arrange') {
    return arrangingPlayerIndex;
  }

  if (phase === 'pyramid-select') {
    return selectingPlayerIndex;
  }

  if (phase === 'pyramid-resolve') {
    return players.findIndex((player) => player.id === giverId);
  }

  return -1;
}

function getOutcomeLabel(
  result?: {
    giveDrinkAmount: number;
    drinkAmount: number;
    outcome: 'give' | 'drink' | 'give-and-drink' | 'pass';
  },
): string {
  if (!result || result.outcome === 'pass') {
    return 'Passed';
  }

  const parts = [];

  if (result.giveDrinkAmount > 0) {
    parts.push(`Gives ${result.giveDrinkAmount}`);
  }

  if (result.drinkAmount > 0) {
    parts.push(`Drinks ${result.drinkAmount}`);
  }

  return parts.join(', ');
}

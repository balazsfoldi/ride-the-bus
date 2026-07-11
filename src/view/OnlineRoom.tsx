import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Check, LogOut, RotateCcw, Users } from 'lucide-react';
import { useOnlineRideTheBusController } from '../controller/useOnlineRideTheBusController';
import { useOnlineRoomController } from '../controller/useOnlineRoomController';
import { AppView } from './AppView';

type OnlineRoomProps = {
  onBackToMenu: () => void;
};

export function OnlineRoom({ onBackToMenu }: OnlineRoomProps) {
  const room = useOnlineRoomController();
  const gameController = useOnlineRideTheBusController(room.snapshot, room.sendCommand);
  const [name, setName] = useState(room.self?.name ?? '');
  const [accessCode, setAccessCode] = useState('');
  const canJoin = name.trim().length > 0 && room.connectionState !== 'joining';
  const sortedPlayers = useMemo(() => room.snapshot?.players ?? [], [room.snapshot]);

  useEffect(() => {
    if (room.self?.name) {
      setName(room.self.name);
    }
  }, [room.self?.name]);

  useEffect(() => {
    if (room.wasRemoved) {
      onBackToMenu();
    }
  }, [onBackToMenu, room.wasRemoved]);

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canJoin) {
      void room.join(name, accessCode);
    }
  }

  async function handleBackToMenu() {
    await room.leaveRoom();
    onBackToMenu();
  }

  if (room.snapshot?.roomPhase === 'playing' && room.snapshot.state) {
    return (
      <AppView
        controller={gameController}
        onlineMode
        viewerPlayerId={room.snapshot.selfId}
        viewerPlayerName={room.self?.name}
        isAdmin={room.isAdmin}
        onlineConnectionState={room.connectionState}
        onlineError={room.error}
        onBackToMenu={() => void handleBackToMenu()}
      />
    );
  }

  return (
    <main className="app-shell">
      <section className="menu-shell online-lobby" aria-label="Online lobby">
        <div className="menu-header">
          <p className="eyebrow">Online room</p>
          <h1>Ride the Bus</h1>
          <p className="menu-copy">One shared room. The first player to join becomes admin and starts the game.</p>
        </div>

        <form className="join-panel" onSubmit={handleJoin}>
          <label htmlFor="online-player-name">Your name</label>
          <div className="field-row">
            <input
              id="online-player-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Anna"
              autoFocus={!room.self}
            />
            <button type="submit" disabled={!canJoin}>
              <Check size={18} aria-hidden="true" />
              {room.self ? 'Change name' : 'Join'}
            </button>
          </div>
          <label htmlFor="room-access-code">Access Code</label>
          <div className="field-row">
            <input
              id="room-access-code"
              type="password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="Enter access code if required"
            />
          </div>
        </form>

        {room.sessionId && room.self ? (
          <section className="lobby-panel">
            <div className="lobby-status">
              <div>
                <p className="eyebrow">Connected as</p>
                <h2>{room.self.name}</h2>
              </div>
              <span className={`connection-pill connection-${room.connectionState}`}>{room.connectionState}</span>
            </div>

            <div className="lobby-list" aria-label="Players in room">
              {sortedPlayers.map((player) => (
                <article className="player-row" key={player.id}>
                  <div>
                    <strong>{player.name}</strong>
                    <span>{player.isAdmin ? 'Admin' : 'Player'}</span>
                  </div>
                  <span className={player.connected ? 'connection-dot online' : 'connection-dot'} />
                </article>
              ))}
            </div>

            <div className="table-actions lobby-actions">
              {room.isAdmin ? (
                <button type="button" onClick={() => void room.sendCommand({ type: 'startGame' })} disabled={sortedPlayers.length === 0}>
                  <Users size={18} aria-hidden="true" />
                  Start game
                </button>
              ) : (
                <span className="assign-empty">Waiting for admin to start.</span>
              )}
              <button type="button" onClick={() => void room.leaveRoom()}>
                <LogOut size={18} aria-hidden="true" />
                Leave room
              </button>
              <button type="button" onClick={() => void handleBackToMenu()}>
                <RotateCcw size={18} aria-hidden="true" />
                Menu
              </button>
            </div>
          </section>
        ) : null}

        {room.error ? <p className="status status-wrong">{room.error}</p> : null}
        {room.snapshot?.message ? <p className="status">{room.snapshot.message}</p> : null}
      </section>
    </main>
  );
}

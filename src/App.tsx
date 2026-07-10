import { useState } from 'react';
import { Monitor, Wifi } from 'lucide-react';
import { AppView } from './view/AppView';
import { OnlineRoom } from './view/OnlineRoom';

type AppMode = 'menu' | 'offline' | 'online';

export function App() {
  const [mode, setMode] = useState<AppMode>('menu');

  if (mode === 'offline') {
    return <AppView onBackToMenu={() => setMode('menu')} />;
  }

  if (mode === 'online') {
    return <OnlineRoom onBackToMenu={() => setMode('menu')} />;
  }

  return (
    <main className="app-shell">
      <section className="menu-shell" aria-label="Main menu">
        <div className="menu-header">
          <p className="eyebrow">Party card game</p>
          <h1>Ride the Bus</h1>
          <p className="menu-copy">Choose local table mode or one-room online multiplayer.</p>
        </div>

        <div className="mode-grid">
          <button type="button" className="mode-button" onClick={() => setMode('offline')}>
            <Monitor size={26} aria-hidden="true" />
            <span>Offline</span>
            <small>Current local pass-and-play flow.</small>
          </button>
          <button type="button" className="mode-button" onClick={() => setMode('online')}>
            <Wifi size={26} aria-hidden="true" />
            <span>Online</span>
            <small>One shared room, admin starts.</small>
          </button>
        </div>
      </section>
    </main>
  );
}

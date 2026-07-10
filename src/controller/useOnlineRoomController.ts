import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OnlineCommand, OnlineConnectionState, OnlineSnapshot } from '../model/onlineTypes';

const sessionStorageKey = 'ride-the-bus-online-session-id';

type JoinResponse = {
  sessionId: string;
  snapshot: OnlineSnapshot;
  error?: string;
};

type CommandResponse = {
  snapshot?: OnlineSnapshot;
  error?: string;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as T & { error?: string };

  if (!response.ok) {
    throw new Error(payload.error ?? 'Request failed.');
  }

  return payload;
}

export function useOnlineRoomController() {
  const [sessionId, setSessionId] = useState(() => window.sessionStorage.getItem(sessionStorageKey) ?? '');
  const [snapshot, setSnapshot] = useState<OnlineSnapshot | undefined>();
  const [connectionState, setConnectionState] = useState<OnlineConnectionState>('idle');
  const [error, setError] = useState('');
  const [wasRemoved, setWasRemoved] = useState(false);

  const self = useMemo(
    () => (snapshot ? snapshot.players.find((player) => player.id === snapshot.selfId) : undefined),
    [snapshot],
  );
  const isAdmin = Boolean(snapshot?.selfId && snapshot.selfId === snapshot.adminId);

  const clearSession = useCallback(() => {
    window.sessionStorage.removeItem(sessionStorageKey);
    setSessionId('');
    setSnapshot(undefined);
    setConnectionState('idle');
  }, []);

  const join = useCallback(
    async (name: string, accessCode = '') => {
      setConnectionState('joining');
      setError('');
      setWasRemoved(false);

      try {
        const result = await postJson<JoinResponse>('/api/online/join', {
          name,
          accessCode,
          sessionId: sessionId || undefined,
        });
        window.sessionStorage.setItem(sessionStorageKey, result.sessionId);
        setSessionId(result.sessionId);
        setSnapshot(result.snapshot);
        setConnectionState('connected');
      } catch (joinError) {
        setConnectionState('error');
        setError(joinError instanceof Error ? joinError.message : 'Could not join the room.');
      }
    },
    [sessionId],
  );

  const sendCommand = useCallback(
    async (command: OnlineCommand) => {
      if (!sessionId) {
        setError('Join the room first.');
        return;
      }

      setError('');

      try {
        const result = await postJson<CommandResponse>('/api/online/command', { sessionId, command });
        if (result.snapshot) {
          setSnapshot(result.snapshot);
        }
      } catch (commandError) {
        setError(commandError instanceof Error ? commandError.message : 'Command failed.');
      }
    },
    [sessionId],
  );

  const forgetSession = useCallback(() => {
    clearSession();
    setError('');
    setWasRemoved(false);
  }, [clearSession]);

  const leaveRoom = useCallback(async () => {
    if (!sessionId) {
      forgetSession();
      return;
    }

    try {
      await postJson<CommandResponse>('/api/online/command', { sessionId, command: { type: 'leaveRoom' } });
    } catch {
      // Leaving is best-effort; the local client should still return to the menu.
    }

    forgetSession();
  }, [forgetSession, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return undefined;
    }

    const events = new EventSource(`/api/online/events?sessionId=${encodeURIComponent(sessionId)}`);
    setConnectionState((current) => (current === 'idle' ? 'reconnecting' : current));

    events.addEventListener('snapshot', (event) => {
      const nextSnapshot = JSON.parse((event as MessageEvent).data) as OnlineSnapshot;
      const nextSelf = nextSnapshot.players.find((player) => player.id === nextSnapshot.selfId);
      setSnapshot(nextSnapshot);
      setConnectionState('connected');
      setError('');

      if (!nextSelf) {
        setWasRemoved(true);
        clearSession();
        events.close();
      }
    });

    events.onerror = () => {
      setConnectionState('reconnecting');
    };

    return () => events.close();
  }, [clearSession, sessionId]);

  return {
    sessionId,
    snapshot,
    self,
    isAdmin,
    connectionState,
    error,
    wasRemoved,
    join,
    sendCommand,
    forgetSession,
    leaveRoom,
  };
}

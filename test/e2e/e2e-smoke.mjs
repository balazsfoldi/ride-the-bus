import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

const port = 4183;
const server = spawn(process.execPath, ['server-dist/onlineServer.mjs'], {
  env: { ...process.env, PORT: String(port), ROOM_ACCESS_CODE: 'test-code' },
  stdio: ['ignore', 'pipe', 'pipe'],
});

async function waitForHealth() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/health`);
      if (response.ok) return response.json();
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error('Server did not become healthy.');
}

async function post(path, body) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  return { response, payload };
}

try {
  const health = await waitForHealth();
  assert.equal(health.ok, true);
  assert.equal(health.accessCodeRequired, true);

  const denied = await post('/api/online/join', { name: 'Anna' });
  assert.equal(denied.response.status, 403);

  const joined = await post('/api/online/join', { name: 'Anna', accessCode: 'test-code' });
  assert.equal(joined.response.status, 200);
  assert.equal(joined.payload.snapshot.players[0].isAdmin, true);

  const started = await post('/api/online/command', { sessionId: joined.payload.sessionId, command: { type: 'startGame' } });
  assert.equal(started.response.status, 200);
  assert.equal(started.payload.snapshot.roomPhase, 'playing');
} finally {
  server.kill('SIGTERM');
}

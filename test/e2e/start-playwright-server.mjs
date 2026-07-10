import { spawn } from 'node:child_process';

const child = spawn(process.execPath, ['server-dist/onlineServer.mjs'], {
  env: { ...process.env, PORT: '4173' },
  stdio: 'inherit',
});

process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
child.on('exit', (code) => process.exit(code ?? 0));

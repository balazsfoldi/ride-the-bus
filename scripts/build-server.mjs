import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['server/onlineServer.ts'],
  outfile: 'server-dist/onlineServer.mjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  packages: 'external',
  sourcemap: false,
  logLevel: 'info',
});

# Ride the Bus

A local or online web version of the Ride the Bus party card game. The app supports offline hot-seat play and a single online room where the first connected player is the admin.

## Features

- Two-deck French-card shoe with aces high.
- Ride phase with four hidden cards: red/black, higher/lower, inside/outside, seen/new suit.
- Wrong guesses reveal the missed card, then the active rider clicks it to fold the same four cards back down.
- Equal higher/lower values and inside/outside boundary hits let the rider give one drink to another player.
- Pyramid phase with arranged hands, row-based drink values, split drink assignments, and selected cards removed from hands.
- Offline sequential flow and online parallel arrange/select flow with ready counters.
- Final scoreboard sorted by least drinks, with menu and same-player rematch actions.
- Docker/Caddy setup for Raspberry Pi publishing through DuckDNS.

## Tech Stack

- React + TypeScript + Vite
- Node HTTP server for the online room and static hosting
- Server-Sent Events for live room updates
- Vitest for unit/integration tests
- Playwright for browser e2e tests
- Docker Compose + Caddy for deployment

## Local Development

```bash
npm install
npm run dev
```

The Vite dev server is for offline UI development. For the production-like online server:

```bash
npm run build
PORT=4173 npm start
```

On Windows PowerShell:

```powershell
npm run build
$env:PORT=4173; npm start
```

## Scripts

- `npm run dev` starts Vite.
- `npm run build` typechecks, builds the frontend, and bundles the online server.
- `npm start` serves the built app with the online room API.
- `npm run typecheck` runs TypeScript checks.
- `npm run lint` runs ESLint.
- `npm run test:unit` runs model unit tests.
- `npm run test:integration` runs flow integration tests.
- `npm run test:e2e:api` builds and smoke-tests the online API.
- `npm run test:e2e:browser` runs Playwright browser tests.
- `npm test` runs unit, integration, and API e2e tests.
- `npm run audit` runs `npm audit --audit-level=moderate`.

## Online Room

There is intentionally one room. The first player who joins becomes admin. The admin can start the game, reset the room, start the pyramid phase, and start a same-player rematch from the scoreboard.

If the admin leaves through Menu or Leave room, the room closes immediately and every connected client is returned to the menu. A non-admin player leaves only their own session.

## Environment Variables

Copy `.env.example` to `.env` for Docker deployment or set variables in your hosting environment.

- `RIDE_THE_BUS_DOMAIN`: DuckDNS or public domain used by Caddy.
- `ROOM_ACCESS_CODE`: optional shared code required for new joins.
- `MAX_PLAYERS`: online room size cap, default `12`.
- `PORT`: app server port, default `80` inside Docker.
- `WATCHTOWER_POLL_INTERVAL`: auto-update polling interval in seconds, default `300`.
- `DOCKER_API_VERSION`: Docker Engine API version used by Watchtower, default `1.44`.

Do not commit `.env` or any private DuckDNS token. DuckDNS token updates should live in your router, cron job, or another private host-level script outside this repository.

## Docker And DuckDNS

The default Compose file pulls the published image from GitHub Container Registry and runs Watchtower for automatic updates.

1. Point your DuckDNS hostname to the Raspberry Pi public IP.
2. Forward ports `80` and `443` from the router to the Raspberry Pi.
3. Create a private `.env` file from `.env.example`.
4. Run:

```bash
docker compose up -d
```

Caddy will request and renew HTTPS certificates automatically for `RIDE_THE_BUS_DOMAIN`. Watchtower polls for a newer `ghcr.io/balazsfoldi/ride-the-bus:latest` image and restarts only labeled containers after an update.

For local Docker builds, use the dev override:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

## CI, Releases And Auto Updates

The app version comes from `package.json`, is shown in the UI, and is returned from `/api/health`. Release versions must match `package.json` exactly.

### Run Tests

The **Run Tests** workflow runs on every branch push and can also be started manually from GitHub:

```text
Actions -> Run Tests -> Run workflow
```

It runs typecheck, lint, unit/integration/API e2e tests, production build, and audit. The Release workflow calls this same Run Tests workflow before it publishes anything.

### Manual Release From GitHub

Releases are intentionally manual only. Pushing a git tag does not publish a release.

1. Bump `package.json` before running the release. For example:

```bash
npm version patch --no-git-tag-version
git add package.json package-lock.json
git commit -m "chore(release): bump version to 0.1.1"
git push origin main
```

2. In GitHub, open **Actions** -> **Release** -> **Run workflow**.
3. Select the branch you want to release from.
4. Enter the version, for example `0.1.1` or `v0.1.1`.
5. Keep **publish_latest** enabled for Raspberry Pi auto-updates.

The workflow first runs Run Tests. Only after those checks pass, it creates a GitHub Release/tag when needed, builds multi-arch Docker images, and publishes:

```text
ghcr.io/balazsfoldi/ride-the-bus:vX.Y.Z
ghcr.io/balazsfoldi/ride-the-bus:latest
```

Any Raspberry Pi running the Compose stack pulls the new `latest` image automatically through Watchtower.

For this to work, GitHub Actions must have package write permissions enabled for the repository. Public GHCR packages can be pulled without logging in on the Raspberry Pi.

## Public Repo Security Notes

- Secrets are ignored by `.gitignore`; keep real `.env` files out of git.
- The server sends basic hardening headers and Caddy repeats them at the edge.
- New joins can be protected with `ROOM_ACCESS_CODE`.
- Names are trimmed and capped server-side.
- Request bodies are size-limited.
- Static file serving is path-normalized and constrained to `dist/`.
- Run `npm run audit` before publishing changes.

This app is a party-game room, not an account system. Do not expose it as a high-trust service or store private information in player names.

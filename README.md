# Music Curator

A personal music discovery dashboard built on the Spotify Web API. It shows your top artists and tracks, imports your
full listening history from Spotify's data export, keeps it current automatically, and turns it into trends and charts.

**Stack:** Next.js 16 (App Router, Cache Components) · React 19 · TypeScript · Tailwind CSS v4 · SQLite + Drizzle ORM ·
Vitest

## Features

- **Dashboard:** top artists and tracks across three time windows, recently played, playlists and liked songs.
- **Full listening history:** drop in your Spotify data export (zip). It's parsed in the browser, so IP addresses and
  device info are never uploaded.
- **Automatic capture:** each visit saves your latest plays and a daily snapshot of your top items, so history keeps
  growing after the export.
- **Analytics:** listening clock, monthly and yearly trends, new discoveries, forgotten favorites and taste drift,
  with charts.
- **Your data:** see what's stored, and delete it or disconnect at any time.

## Engineering highlights

- **Secure auth:** Spotify OAuth (Authorization Code flow) with tokens sealed in an AES-256-GCM encrypted, httpOnly
  cookie. Tokens are used only on the server, refreshed before they expire, and never returned by any API route.
- **Resilient API client:** retries, honors `429 Retry-After`, handles pagination, and maps failures to typed errors
  so expected API problems render as messages instead of crashing pages.
- **Reconciling overlapping sources:** the extended export, account export and live capture overlap. Queries trust
  them in priority order (extended > account > capture) and ignore lower-priority plays inside a higher-priority
  source's date range. A play counts at 30 seconds or more.
- **Clean layering:** a data access layer separates raw Spotify shapes from app domain models. The analysis code is
  pure functions, covered by unit tests.
- **Database:** SQLite through Drizzle with versioned migrations, created and migrated automatically on first run.
  Artwork for imported items is looked up on demand and cached.

## Architecture

```
src/
  proxy.ts                     Guards /dashboard; refreshes Spotify tokens before they expire
  lib/
    env.ts                     Server-only env access
    auth/crypto.ts             AES-256-GCM sealing for the session cookie
    auth/session.ts            Session shape, cookie options, getSession()
    spotify/oauth.ts           Authorization Code flow: authorize URL, code exchange, refresh
    spotify/client.ts          HTTP client: retries, 429 Retry-After, pagination, typed errors
    spotify/api.ts             Data Access Layer: getCurrentUser, getTopArtists, getTopTracks, ...
    spotify/types.ts           Raw Spotify shapes vs. app domain models
    spotify/safe.ts            load(): turns expected API failures into renderable errors
    insights.ts                Calculated stats (pure functions over retrieved data)
    db/schema.ts, db/index.ts  Drizzle schema and lazily-opened SQLite connection (+ migrations in /drizzle)
    history/normalize.ts       Export parsing (shared by browser and server) + server validation
    history/store.ts           Database writes; history/queries.ts: analytics reads
    history/capture.ts         Recent-plays capture and daily top-item snapshots
    history/analysis.ts        Pure analysis (clock, trends, discoveries, drift); history/time.ts: time zones
  app/
    api/auth/{login,callback/spotify,logout}   OAuth route handlers
    api/history/{import,sync}  History upload and capture endpoints
    page.tsx                   Landing page
    dashboard/                 Overview, artists, tracks, history, playlists, liked songs, your data
  components/                  UI building blocks
```

## Run it locally

1. Copy `.env.example` to `.env.local`, then fill in your Spotify app credentials and a random `SESSION_SECRET`.
2. In the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), register the redirect URI
   `http://127.0.0.1:3000/api/auth/callback/spotify` and add each user under **Settings → User Management**.
   Development Mode allows up to 5 allowlisted users, and the app owner needs Premium.
3. Run `npm install && npm run dev`, then open **http://127.0.0.1:3000**. Use that address rather than `localhost`,
   because cookies are per-host.

To import history, request your data at spotify.com/account/privacy (it can take up to 30 days to arrive), then drop
the zip on the **Your data** page.

| Script | What it does |
| --- | --- |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run db:generate` | Create a migration after editing `src/lib/db/schema.ts` |
| `npm run db:studio` | Browse the database |

## Spotify API limitations (checked against the docs, Oct 2026)

- Since the February 2026 Development Mode changes, `popularity` and `followers` are removed and artist `genres` is
  deprecated (often empty). The UI hides genre analysis when no genres come back.
- Top items cover three windows (about 4 weeks, 6 months and 1 year), up to 50 each, and reflect affinity rather than
  play counts.
- Recently played returns only the last 50 plays. There's no full-history endpoint, which is why the app imports the
  data export.
- Playlist contents are only available for playlists the user owns or collaborates on.
- Spotify has no token-revocation endpoint. "Disconnect" clears the session; full revocation is at
  https://www.spotify.com/account/apps/.

---

Not affiliated with or endorsed by Spotify.

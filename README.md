# My Music Curator

A personal Spotify music discovery dashboard. Next.js 16 (App Router, Cache Components), TypeScript, Tailwind CSS v4.

## Setup

1. Copy `.env.example` to `.env.local` and fill in your Spotify app credentials and a random `SESSION_SECRET`.
2. In the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard), register the redirect URI
   `http://127.0.0.1:3000/api/auth/callback/spotify` and add every user under **Settings → User Management**
   (Development Mode allows up to 5 allowlisted users; the app owner needs Premium).
3. `npm install && npm run dev`, then open **http://127.0.0.1:3000** (not `localhost` — cookies are per-host).

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
  app/
    api/auth/{login,callback/spotify,logout}   OAuth route handlers
    page.tsx                   Landing page
    dashboard/                 Overview, artists, tracks, playlists, liked songs
  components/                  UI building blocks
```

Tokens live only in an encrypted, httpOnly cookie and are used only on the server. No API route returns them.

## Spotify API limitations (verified against the docs, Oct 2026)

- Since the February 2026 Development Mode changes, `popularity` and `followers` are removed and artist `genres`
  is deprecated (often empty). The UI hides genre analysis when no genres are returned.
- Top items cover 3 windows (~4 weeks, ~6 months, ~1 year), max 50 each, and reflect affinity, not play counts.
- Recently played returns only the last 50 plays. There is no full listening-history endpoint;
  Spotify's downloadable "Extended streaming history" is the planned Phase 2 import path.
- Playlist contents are only available for playlists the user owns or collaborates on.
- Spotify has no token-revocation endpoint. "Disconnect" clears the session; full revocation is at
  https://www.spotify.com/account/apps/.

# Binder

Binder is a progressive web application for creating, publishing, and reading long-form books on Nostr. It combines a local-first writing workspace, social features (comments, reactions, boosts/zaps), and Relay-synced publishing without requiring custom protocol extensions.

## Key Features

- **Local-first drafting** – Write chapters in Markdown with snapshots, real-time autosave, and offline access.
- **Nostr publishing pipeline** – Upload covers/media to configured media servers, publish chapters (30023) and books (30003) with signer interaction, and track reading progress for logged-in readers.
- **Social and moderation tooling** – Comments show threaded replies + author metadata, WoT-driven trust scoring, and client-side mute/report actions that emit moderation events.
- **Library, discovery, and shelf sync** – Saved books flow through the library store, surface likes/comments/boosts/zaps via throttled queries, and auto-update “Reading”/“Finished” shelves based on progress.
- **Dark + light theming** – System-prefers dark mode uses charcoal/charcoal accents while preserving violet branding.
- **Admin controls** – Configure default relays/media servers and upload cover/icon assets that immediately affect the UI header via a shared page config store.

## Getting Started

### Prerequisites

- Node.js 20+ / npm
- A modern browser that supports IndexedDB and `createImageBitmap`
- Relays, media servers, and signer extensions for full functionality (e.g., nostr-browser extension, Blossom media, etc.)

### Local development

```bash
npm install
npm run dev
```

Open `http://localhost:5173` and authenticate with a Nostr signer (NIP-07/NIP-46). Development assets hot-reload, and the app uses IndexedDB to persist drafts/outbox data.

### Build & Test

- `npm run build` – bundle the SvelteKit app for production.
- `npm run check` – run SvelteKit sync + `svelte-check` (currently reports a few upstream type issues you may need to resolve).

## Project Structure

- `src/lib/` – application code: services (reaction, reply, moderation), state stores, components (UI shell, discovery, social spacing).
- `src/routes/` – SvelteKit pages (discover, writer, library, admin, reader, settings).
- `src/app.css` – global Tailwind layer plus CSS variables and dark/light token overrides.
- `static/` – static assets (icons, fonts, etc.).
- `docs/` – supplementary reference material (if present).

### Notable patterns

- **Stores** – Each feature exposes a store (e.g., `libraryStore`, `readingProgressStore`, `pageConfigStore`) to keep UI & persistence in sync.
- **Services** – Encapsulate Nostr operations (signing, publishing, replying) and media workflows; most return `{ok, value}` for predictable chaining.
- **Social counts queue** – Requests for likes/comments/etc. are throttled so relays are not flooded when rendering many cards.
- **Page config & theming** – Admin uploads update `pageConfigStore`, making the header icon and cover respond immediately without reloading.

## Workflows

- **Publishing**: Writers create local drafts → `publisherService` uploads images, signs chapters, publishes via SimplePool → `discoverService` surfaces the books.
- **Reading progress**: `readingProgressStore` tracks the last chapter/percent, `libraryService` mirrors that to “Reading”/“Finished” shelves, and the reader UI shows badges.
- **Comments**: `CommentSection` threads replies, loads author metadata, and lets logged-in users mute/report; actions emit moderation events and tick the WoT store cache.
- **Media uploads**: `mediaService` compresses images to a max 1600px JPEG before uploading to Blossom/standard servers, with CORS fallbacks for inline data URLs.

## Deployment Considerations

- Ensure relays and media servers listed in settings are reachable and CORS compliant.
- Set up signer tooling (NIP-07 extension or NIP-46 wallet) for publishing and moderation.
- Bundled builds expect environment variables defined via `vite.config.ts` if you have custom behavior (check that file for hints).

## Deploying to a VPS

Binder ships as a standard SvelteKit application, so you can host it on any VPS that can run Node.js 20+. The repository contains a helper (`scripts/setup-vps.sh`) plus sample service/reverse-proxy configs you can copy into production.

### 1. Prep & build

```bash
# run from the repo root on the VPS
./scripts/setup-vps.sh
```

This script installs Node.js 20+ (via NodeSource on Debian/Ubuntu), installs npm dependencies, and builds the project. It prints the next steps for wiring the systemd service and reverse proxy.

### 2. Systemd unit

Copy `deploy/binder.service` into `/etc/systemd/system/binder.service`, adjust `User`/`WorkingDirectory` to your environment, and create `/etc/default/binder` with overrides:

```
NODE_ENV=production
BINDER_PORT=4173
BINDER_HOST=0.0.0.0
# optional relays/media presets
RELAY_LIST=wss://relay.damus.io,wss://nos.lol
MEDIA_SERVER=https://your.media.server/upload
```

Then enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now binder.service
sudo journalctl -u binder -f
```

### 3. Reverse proxy & TLS

Binder’s built-in preview server listens on port 4173. Terminate TLS and expose the app through Caddy (recommended) or another reverse proxy:

**Caddy example (`deploy/Caddyfile`)**

```
binder.example.com {
  encode gzip
  reverse_proxy localhost:4173
  log {
    output file /var/log/caddy/binder_access.log
    format single_field common_log
  }
  tls admin@binder.example.com
}
```

Caddy automatically obtains Let's Encrypt certificates, so just install Caddy, drop this file into `/etc/caddy/Caddyfile`, and run `sudo systemctl restart caddy`. If you prefer nginx or HAProxy, point it at `localhost:4173` and layer on Certbot/ACME.

### 4. Firewall & maintenance

Allow 80/443 (and the preview port only if you need direct access). Keep the service running via systemd, rebuild after `git pull` (`npm run build`), and restart the service. Logs live in `journalctl -u binder` and your reverse proxy’s log directory (e.g., `/var/log/caddy/`). For unattended updates, wrap `git pull && npm install && npm run build && sudo systemctl restart binder.service` in a cron/shell script.

## Contributing

- Follow the existing code style (Svelte + Tailwind). Add tests (or describe manual steps) when touching complex services.
- Keep `npm run check` clean of your changes before proposing a merge; document any new dependencies in `package.json`.

## Troubleshooting

- **`npm run check` fails** – there are known type-level issues in `src/lib/infra/nostr/ndk.ts` (`nip05Fetch`) and the `discover` page's `Icon` usage; fixing those eliminates the current errors.
- **Media uploads blocked** – configure a Blossom/compliant media server or rely on inline data URLs; monitor console for CORS errors.
- **Relay rejections (“too many concurrent REQs”)** – rely on `socialCountService`’s throttling or choose relays with higher concurrency.

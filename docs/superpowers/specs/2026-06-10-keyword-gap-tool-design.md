# Keyword Gap Analysis Tool — Design

Date: 2026-06-10
Status: Built autonomously per Jon's brief (build, test, hand back with .env ready for keys).

## Purpose

A standalone web application that replicates the DataForSEO + n8n "Find competitor
keyword gaps and log opportunities to Notion" template, without n8n. Enter your
domain and up to three competitors; the tool finds keywords competitors rank for
that you don't, enriches them (volume, difficulty, intent, CPC, competitor
position/URL), and lets you export to CSV or log selected opportunities to Notion.

## Architecture

- **Node.js 18+ / Express** single server. No build step, no framework.
- **Backend** (`server/`) holds all credentials from `.env` and proxies:
  - DataForSEO Labs `dataforseo_labs/google/domain_intersection/live`
    (Basic auth, one call per competitor, `intersections: false`,
    target1 = competitor, target2 = your domain → keywords only the competitor ranks for).
  - Notion API (`pages` create + `databases` retrieve/patch) for logging opportunities.
- **Frontend** (`public/`) static, polished UI. Talks only to our own `/api/*` routes,
  so keys never reach the browser.
- **Demo mode**: when DataForSEO credentials are missing, `/api/analyze` serves a
  bundled fixture (captured from a real API response) so the UI is fully usable
  before keys are added. The UI shows a clear "demo data" banner.

## API routes

- `GET /api/config` → which integrations are configured (booleans only, never keys).
- `POST /api/analyze` → `{ yourDomain, competitors[], locationName, languageCode, limit, minVolume, maxDifficulty }`.
  Calls domain_intersection per competitor, merges by keyword, computes an
  opportunity score `volume × (1 − difficulty/100)`, returns sorted rows.
- `POST /api/notion/log` → `{ rows[] }`. Ensures the Notion database has the needed
  properties (PATCH), then creates one page per row.

## Keyword gap definition

A keyword where the competitor has an organic result and your domain does not
(DataForSEO `intersections: false` semantics). Multi-competitor results are merged:
one row per keyword listing every competitor that ranks for it and the best
(competitor) position.

## .env

```
DATAFORSEO_LOGIN=        # required for live analysis
DATAFORSEO_PASSWORD=     # required for live analysis
NOTION_API_KEY=          # optional, enables "Log to Notion"
NOTION_DATABASE_ID=      # optional, target database
PORT=4000
```

## Error handling

- Missing DataForSEO creds → demo mode (flagged in response).
- DataForSEO non-20000 status → surfaced to UI with the status message.
- Notion misconfigured → button disabled in UI with tooltip; route returns 400 with reason.

## Testing

- Demo-mode end-to-end via headless browser/preview.
- Payload shape validated against a live DataForSEO MCP call (2026-06-10).
- Notion path tested for graceful failure without keys (live test once Jon adds keys).

## Imagery

Hero/illustration assets generated via Codex CLI (OpenAI image generation),
stored in `public/assets/`.

# Gapfinder

Standalone competitor keyword gap analysis tool. Finds the keywords your
competitors rank for that you don't, scores the opportunities, and lets you
export them to CSV or log them straight into a Notion database.

Based on the DataForSEO "Find competitor keyword gaps and log opportunities to
Notion" n8n template, rebuilt as a self-contained web app with no n8n required.

## How it works

1. Enter your domain and competitors (use "+ Add competitor" for up to ten),
   pick a market and filters. Defaults are prefilled for indexify.co.uk against
   its two closest SERP competitors.
2. The server makes one DataForSEO Labs `domain_intersection` call per
   competitor (`intersections: false`, target1 = competitor, target2 = you),
   returning keywords only the competitor ranks for.
3. Results are merged into one row per keyword with search volume, keyword
   difficulty, CPC, search intent, the best-ranking competitor and its URL.
4. Opportunity score = `search volume x (1 - difficulty / 100)`.
5. Select rows to export as CSV or log to Notion (the app adds any missing
   properties to your database automatically).

## Setup

```bash
npm install
cp .env.example .env   # then add your keys
npm start              # http://localhost:4000
```

### .env keys

| Key | Required | Notes |
| --- | --- | --- |
| `DATAFORSEO_LOGIN` | For live data | From https://app.dataforseo.com/api-access |
| `DATAFORSEO_PASSWORD` | For live data | API password, not your account password |
| `NOTION_API_KEY` | Optional | Internal integration token from https://www.notion.so/my-integrations |
| `NOTION_DATABASE_ID` | Optional | Share the database with your integration first |
| `PORT` | Optional | Defaults to 4000 |

Credentials already present in your shell environment (for example exported in
`~/.bash_profile`) are also picked up; `.env` values take effect when the shell
does not provide them.

Without DataForSEO keys the app runs in **demo mode** with sample data so the
full interface can be explored at no cost.

### Key precedence (hosted mode)

The server resolves credentials in this order:

1. **Server environment variables** (`.env` locally, or site environment
   variables on Netlify). When present, visitors never see key fields.
2. **Keys supplied on the page.** When the server holds no keys, a "Your API
   keys" panel appears and visitors bring their own. Page keys are sent only
   with each request and are never stored server-side. Visitors can optionally
   remember keys in their own browser (localStorage) and clear them with one
   click.

This makes the same build work as a personal tool (env keys), a free
bring-your-own-keys deployment, or a future paid tier (your keys in the
hosting environment).

## Deploying to Netlify

The repo ships with `netlify.toml` and a serverless wrapper
(`netlify/functions/api.js`), so deployment is connect-and-go:

1. Push the repo to GitHub and create a new Netlify site from it. The build
   settings are read from `netlify.toml` (publish `public/`, functions in
   `netlify/functions/`). No build command is needed.
2. Optionally add `DATAFORSEO_LOGIN`, `DATAFORSEO_PASSWORD`, `NOTION_API_KEY`
   and `NOTION_DATABASE_ID` as site environment variables to run it with your
   own keys; leave them unset to run it in bring-your-own-keys mode.

## Notion database

A "Keyword Gap Opportunities" database already exists in the workspace
(`NOTION_DATABASE_ID` is set in `.env`) with the full schema: Keyword (title),
Search Volume, Difficulty, CPC, Opportunity Score, Intent, Competitors, Best
Position, Competitor URL, Status.

To enable logging from the app:

1. Create an internal integration at https://www.notion.so/my-integrations and
   paste its secret into `NOTION_API_KEY` in `.env`.
2. Open the database in Notion, then via the ... menu choose Connections and
   add your integration. Without this step the API returns "not found".
3. Restart the app.

The app can also point at any other database; it adds missing properties
automatically on first log.

## Costs

Each analysis run makes one `domain_intersection` live call per competitor.
The exact cost of every live run is shown in the app footer (a two-competitor
run at 200 keywords each costs roughly $0.06).

## Stack

Node.js 18+, Express, vanilla JS frontend. No build step. API keys never leave
the server. Imagery generated with OpenAI image generation via Codex CLI.

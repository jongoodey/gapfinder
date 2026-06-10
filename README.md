# Gapfinder

Standalone competitor keyword gap analysis tool. Finds the keywords your
competitors rank for that you don't, scores the opportunities, and lets you
export them to CSV or log them straight into a Notion database.

Based on the DataForSEO "Find competitor keyword gaps and log opportunities to
Notion" n8n template, rebuilt as a self-contained web app with no n8n required.

## How it works

1. Enter your domain and up to three competitors, pick a market and filters.
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

## Notion database

Point `NOTION_DATABASE_ID` at any database shared with your integration. On
first log, the app adds these properties if missing: Search Volume, Difficulty,
CPC, Opportunity Score, Intent, Competitors, Best Position, Competitor URL,
Status. The keyword goes into the database's existing title property.

## Costs

Each analysis run makes one `domain_intersection` live call per competitor.
The exact cost of every live run is shown in the app footer (a two-competitor
run at 200 keywords each costs roughly $0.06).

## Stack

Node.js 18+, Express, vanilla JS frontend. No build step. API keys never leave
the server. Imagery generated with OpenAI image generation via Codex CLI.

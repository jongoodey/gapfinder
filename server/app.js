import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasDataForSeoCredentials, fetchGapKeywords } from './dataforseo.js';
import { hasNotionCredentials, logRowsToNotion } from './notion.js';
import { mergeCompetitorItems } from './merge.js';
import { demoPerCompetitor } from './demo.js';

function cleanDomain(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

// Server env vars win; otherwise fall back to credentials supplied by the page.
function resolveDataForSeo(req) {
  if (hasDataForSeoCredentials()) {
    return { login: process.env.DATAFORSEO_LOGIN, password: process.env.DATAFORSEO_PASSWORD };
  }
  const c = req.body?.credentials || {};
  if (c.dataForSeoLogin && c.dataForSeoPassword) {
    return { login: c.dataForSeoLogin, password: c.dataForSeoPassword };
  }
  return null;
}

function resolveNotion(req) {
  if (hasNotionCredentials()) {
    return { apiKey: process.env.NOTION_API_KEY, databaseId: process.env.NOTION_DATABASE_ID };
  }
  const c = req.body?.credentials || {};
  if (c.notionApiKey && c.notionDatabaseId) {
    return { apiKey: c.notionApiKey, databaseId: c.notionDatabaseId };
  }
  return null;
}

// serveStatic is off in the Netlify function, where the CDN serves public/
// and import.meta.url is unavailable after CJS bundling.
export function createApp({ serveStatic = true } = {}) {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  if (serveStatic) {
    const dir = path.dirname(fileURLToPath(import.meta.url));
    app.use(express.static(path.join(dir, '..', 'public')));
  }

  app.get('/api/config', (_req, res) => {
    // Booleans only: tells the page whether the server holds keys, never the keys.
    res.json({
      dataForSeo: hasDataForSeoCredentials(),
      notion: hasNotionCredentials(),
    });
  });

  app.post('/api/analyze', async (req, res) => {
    try {
      const yourDomain = cleanDomain(req.body.yourDomain);
      const competitors = [...new Set((req.body.competitors || []).map(cleanDomain).filter(Boolean))]
        .filter((c) => c !== yourDomain)
        .slice(0, 10);
      const locationName = req.body.locationName || 'United Kingdom';
      const languageCode = req.body.languageCode || 'en';
      const limit = Math.min(Math.max(parseInt(req.body.limit, 10) || 100, 10), 1000);
      const minVolume = Math.max(parseInt(req.body.minVolume, 10) || 0, 0);
      const maxDifficulty = Math.min(Math.max(parseInt(req.body.maxDifficulty, 10) || 100, 1), 100);

      if (!yourDomain) return res.status(400).json({ error: 'Your domain is required.' });
      if (competitors.length === 0)
        return res.status(400).json({ error: 'At least one competitor domain is required.' });

      const auth = resolveDataForSeo(req);
      if (!auth) {
        const rows = mergeCompetitorItems(demoPerCompetitor(competitors));
        return res.json({ demo: true, yourDomain, competitors, rows, cost: 0 });
      }

      let totalCost = 0;
      const perCompetitor = await Promise.all(
        competitors.map(async (competitor) => {
          const { items, cost } = await fetchGapKeywords({
            auth,
            competitor,
            yourDomain,
            locationName,
            languageCode,
            limit,
            minVolume,
            maxDifficulty,
          });
          totalCost += cost;
          return { domain: competitor, items };
        })
      );

      const rows = mergeCompetitorItems(perCompetitor);
      res.json({ demo: false, yourDomain, competitors, rows, cost: totalCost });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  app.post('/api/notion/log', async (req, res) => {
    try {
      const notionAuth = resolveNotion(req);
      if (!notionAuth) {
        return res.status(400).json({
          error:
            'Notion is not configured. Add your Notion API key and database ID in the connection settings.',
        });
      }
      const rows = req.body.rows || [];
      if (rows.length === 0) return res.status(400).json({ error: 'No rows selected.' });
      if (rows.length > 100) return res.status(400).json({ error: 'Maximum 100 rows per log.' });
      const results = await logRowsToNotion(rows, notionAuth);
      res.json({ logged: results.length, results });
    } catch (err) {
      res.status(502).json({ error: err.message });
    }
  });

  return app;
}

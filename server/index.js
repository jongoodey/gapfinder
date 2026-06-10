import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasDataForSeoCredentials, fetchGapKeywords } from './dataforseo.js';
import { hasNotionCredentials, logRowsToNotion } from './notion.js';
import { mergeCompetitorItems } from './merge.js';
import { demoPerCompetitor } from './demo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/config', (_req, res) => {
  res.json({
    dataForSeo: hasDataForSeoCredentials(),
    notion: hasNotionCredentials(),
  });
});

function cleanDomain(input) {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '');
}

app.post('/api/analyze', async (req, res) => {
  try {
    const yourDomain = cleanDomain(req.body.yourDomain);
    const competitors = [...new Set((req.body.competitors || []).map(cleanDomain).filter(Boolean))]
      .filter((c) => c !== yourDomain)
      .slice(0, 3);
    const locationName = req.body.locationName || 'United Kingdom';
    const languageCode = req.body.languageCode || 'en';
    const limit = Math.min(Math.max(parseInt(req.body.limit, 10) || 100, 10), 1000);
    const minVolume = Math.max(parseInt(req.body.minVolume, 10) || 0, 0);
    const maxDifficulty = Math.min(Math.max(parseInt(req.body.maxDifficulty, 10) || 100, 1), 100);

    if (!yourDomain) return res.status(400).json({ error: 'Your domain is required.' });
    if (competitors.length === 0)
      return res.status(400).json({ error: 'At least one competitor domain is required.' });

    if (!hasDataForSeoCredentials()) {
      const rows = mergeCompetitorItems(demoPerCompetitor(competitors));
      return res.json({ demo: true, yourDomain, competitors, rows, cost: 0 });
    }

    let totalCost = 0;
    const perCompetitor = await Promise.all(
      competitors.map(async (competitor) => {
        const { items, cost } = await fetchGapKeywords({
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
    if (!hasNotionCredentials()) {
      return res
        .status(400)
        .json({ error: 'Notion is not configured. Add NOTION_API_KEY and NOTION_DATABASE_ID to .env.' });
    }
    const rows = req.body.rows || [];
    if (rows.length === 0) return res.status(400).json({ error: 'No rows selected.' });
    if (rows.length > 100) return res.status(400).json({ error: 'Maximum 100 rows per log.' });
    const results = await logRowsToNotion(rows);
    res.json({ logged: results.length, results });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Keyword Gap Analysis running on http://localhost:${port}`);
  console.log(`DataForSEO configured: ${hasDataForSeoCredentials() ? 'yes' : 'no (demo mode)'}`);
  console.log(`Notion configured: ${hasNotionCredentials() ? 'yes' : 'no'}`);
});

// End-to-end test of the bring-your-own-keys visitor flow against a server
// started WITHOUT env credentials (PORT=4400, cwd outside the project).
// Reads real keys from the local .env to act as the visitor's keys.
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = 'http://localhost:4400';
const envText = readFileSync(fileURLToPath(new URL('../.env', import.meta.url)), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
);

const results = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
};

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 940 });
await page.goto(BASE, { waitUntil: 'networkidle0' });

// 1. Credentials card visible, both sections shown, chips off
check('creds card visible', await page.$eval('#credsCard', (el) => !el.hidden));
check('DFS fields shown', await page.$eval('#dfsCreds', (el) => !el.hidden));
check('Notion fields shown', await page.$eval('#notionCreds', (el) => !el.hidden));
check('demo hint shown', await page.$eval('#demoHint', (el) => !el.hidden));

// 2. Run without keys -> demo data
await page.click('#runBtn');
await page.waitForSelector('#tableWrap:not([hidden])', { timeout: 30000 });
check('demo banner shown without keys', await page.$eval('#demoBanner', (el) => !el.hidden));

// 3. Enter DataForSEO keys -> chip flips, demo hint hides
await page.type('#dfsLogin', env.DATAFORSEO_LOGIN);
await page.type('#dfsPassword', env.DATAFORSEO_PASSWORD);
check(
  'DFS chip flips to configured on input',
  await page.$eval('#chipDfs', (el) => el.textContent.includes('configured') && el.classList.contains('on'))
);
check('demo hint hidden once keys entered', await page.$eval('#demoHint', (el) => el.hidden));

// 4. Live run with page-supplied keys (small: 1 competitor, 10 keywords)
await page.evaluate(() => {
  document.querySelectorAll('#competitorList .comp-field')[1].querySelector('.comp-remove').click();
  document.getElementById('limit').value = 10;
});
await page.click('#runBtn');
await page.waitForFunction(
  () => !document.getElementById('demoBanner').hidden === false && !document.getElementById('tableWrap').hidden && document.querySelectorAll('#resultsBody tr').length > 0,
  { timeout: 60000 }
);
const live = await page.evaluate(() => ({
  demoBannerHidden: document.getElementById('demoBanner').hidden,
  rows: document.querySelectorAll('#resultsBody tr').length,
  cost: document.getElementById('costNote').textContent,
}));
check('live analysis with page keys', live.demoBannerHidden && live.rows > 0, `${live.rows} rows, ${live.cost}`);

// 5. Remember keys -> localStorage persists across reload
await page.type('#notionKey', env.NOTION_API_KEY);
await page.type('#notionDb', env.NOTION_DATABASE_ID);
await page.click('#rememberKeys');
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gapfinder.keys') || '{}'));
check('keys saved to localStorage', Boolean(stored.dataForSeoLogin && stored.notionApiKey));
await page.reload({ waitUntil: 'networkidle0' });
const restored = await page.evaluate(() => ({
  login: document.getElementById('dfsLogin').value,
  notionDb: document.getElementById('notionDb').value,
  remembered: document.getElementById('rememberKeys').checked,
  dfsChipOn: document.getElementById('chipDfs').classList.contains('on'),
}));
check('keys restored after reload', restored.login.length > 0 && restored.notionDb.length > 0 && restored.remembered && restored.dfsChipOn);

// 6. Notion log with page-supplied keys (1 row, via API from page context)
const notionResult = await page.evaluate(async () => {
  const res = await fetch('/api/notion/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      rows: [{
        keyword: 'visitor keys flow test (safe to delete)',
        searchVolume: 10, difficulty: 1, cpc: 0, opportunityScore: 10,
        intent: 'informational', competitors: [{ domain: 'example.com', position: 1 }],
        bestPosition: 1, bestUrl: 'https://example.com/',
      }],
      credentials: {
        dataForSeoLogin: document.getElementById('dfsLogin').value,
        dataForSeoPassword: document.getElementById('dfsPassword').value,
        notionApiKey: document.getElementById('notionKey').value,
        notionDatabaseId: document.getElementById('notionDb').value,
      },
    }),
  });
  return { status: res.status, body: await res.json() };
});
check('Notion log with page keys', notionResult.status === 200 && notionResult.body.logged === 1, JSON.stringify(notionResult.body).slice(0, 120));

// 7. Clear saved keys
await page.click('#clearKeysBtn');
const afterClear = await page.evaluate(() => ({
  storage: localStorage.getItem('gapfinder.keys'),
  login: document.getElementById('dfsLogin').value,
  dfsChipOn: document.getElementById('chipDfs').classList.contains('on'),
  toast: document.getElementById('toast').textContent,
}));
check('clear removes storage and fields', afterClear.storage === null && afterClear.login === '' && !afterClear.dfsChipOn, afterClear.toast);

// 8. Bad credentials surface a clean error
const badResult = await page.evaluate(async () => {
  const res = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      yourDomain: 'indexify.co.uk', competitors: ['edge45.co.uk'], limit: 10,
      credentials: { dataForSeoLogin: 'wrong@example.com', dataForSeoPassword: 'nope' },
    }),
  });
  return { status: res.status, body: await res.json() };
});
check('bad keys return clean 401 message', badResult.status === 502 && /credentials|401/i.test(badResult.body.error), badResult.body.error);

await browser.close();
console.log(results.join('\n'));
process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);

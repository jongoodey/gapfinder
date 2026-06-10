const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export function hasNotionCredentials() {
  return Boolean(process.env.NOTION_API_KEY && process.env.NOTION_DATABASE_ID);
}

function headers() {
  return {
    Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  };
}

async function notionFetch(path, options = {}) {
  const res = await fetch(`${NOTION_API}${path}`, { ...options, headers: headers() });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Notion API ${res.status}: ${data.message || JSON.stringify(data)}`);
  }
  return data;
}

const REQUIRED_PROPERTIES = {
  'Search Volume': { number: {} },
  'Difficulty': { number: {} },
  'CPC': { number: {} },
  'Opportunity Score': { number: {} },
  'Intent': { select: {} },
  'Competitors': { rich_text: {} },
  'Best Position': { number: {} },
  'Competitor URL': { url: {} },
  'Status': { select: { options: [{ name: 'New' }, { name: 'In progress' }, { name: 'Published' }] } },
};

// Adds any missing properties to the database and returns the title property name.
async function ensureSchema(databaseId) {
  const db = await notionFetch(`/databases/${databaseId}`);
  const existing = db.properties || {};
  const titleProp = Object.entries(existing).find(([, v]) => v.type === 'title');
  if (!titleProp) throw new Error('Notion database has no title property');

  const missing = {};
  for (const [name, def] of Object.entries(REQUIRED_PROPERTIES)) {
    if (!existing[name]) missing[name] = def;
  }
  if (Object.keys(missing).length > 0) {
    await notionFetch(`/databases/${databaseId}`, {
      method: 'PATCH',
      body: JSON.stringify({ properties: missing }),
    });
  }
  return titleProp[0];
}

export async function logRowsToNotion(rows) {
  const databaseId = process.env.NOTION_DATABASE_ID;
  const titleName = await ensureSchema(databaseId);

  const results = [];
  for (const row of rows) {
    const properties = {
      [titleName]: { title: [{ text: { content: row.keyword } }] },
      'Search Volume': { number: row.searchVolume ?? null },
      'Difficulty': { number: row.difficulty ?? null },
      'CPC': { number: row.cpc ?? null },
      'Opportunity Score': { number: row.opportunityScore ?? null },
      'Competitors': {
        rich_text: [
          {
            text: {
              content: (row.competitors || [])
                .map((c) => `${c.domain}${c.position ? ` (#${c.position})` : ''}`)
                .join(', ')
                .slice(0, 2000),
            },
          },
        ],
      },
      'Best Position': { number: row.bestPosition ?? null },
      'Status': { select: { name: 'New' } },
    };
    if (row.intent) properties['Intent'] = { select: { name: row.intent } };
    if (row.bestUrl) properties['Competitor URL'] = { url: row.bestUrl };

    const page = await notionFetch('/pages', {
      method: 'POST',
      body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
    });
    results.push({ keyword: row.keyword, pageId: page.id });
  }
  return results;
}

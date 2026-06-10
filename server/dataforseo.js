const API_BASE = 'https://api.dataforseo.com/v3';

export function hasDataForSeoCredentials() {
  return Boolean(process.env.DATAFORSEO_LOGIN && process.env.DATAFORSEO_PASSWORD);
}

function authHeader({ login, password }) {
  const token = Buffer.from(`${login}:${password}`).toString('base64');
  return `Basic ${token}`;
}

function buildFilters({ minVolume, maxDifficulty }) {
  const conditions = [];
  if (minVolume > 0) {
    conditions.push(['keyword_data.keyword_info.search_volume', '>=', minVolume]);
  }
  if (maxDifficulty > 0 && maxDifficulty < 100) {
    conditions.push(['keyword_data.keyword_properties.keyword_difficulty', '<=', maxDifficulty]);
  }
  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions;
  return [conditions[0], 'and', conditions[1]];
}

// Keywords the competitor (target1) ranks for that yourDomain (target2) does not.
export async function fetchGapKeywords({
  auth,
  competitor,
  yourDomain,
  locationName,
  languageCode,
  limit,
  minVolume,
  maxDifficulty,
}) {
  const task = {
    target1: competitor,
    target2: yourDomain,
    intersections: false,
    item_types: ['organic'],
    location_name: locationName,
    language_code: languageCode,
    limit,
    order_by: ['keyword_data.keyword_info.search_volume,desc'],
    ignore_synonyms: true,
  };
  const filters = buildFilters({ minVolume, maxDifficulty });
  if (filters) task.filters = filters;

  const res = await fetch(`${API_BASE}/dataforseo_labs/google/domain_intersection/live`, {
    method: 'POST',
    headers: {
      Authorization: authHeader(auth),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([task]),
  });

  if (res.status === 401) {
    throw new Error('DataForSEO rejected the credentials (401). Check the API login and password.');
  }
  if (!res.ok) {
    throw new Error(`DataForSEO HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  if (data.status_code !== 20000) {
    throw new Error(`DataForSEO error ${data.status_code}: ${data.status_message}`);
  }
  const taskResult = data.tasks?.[0];
  if (!taskResult || taskResult.status_code !== 20000) {
    throw new Error(
      `DataForSEO task error ${taskResult?.status_code}: ${taskResult?.status_message || 'unknown'}`
    );
  }
  return { items: taskResult.result?.[0]?.items || [], cost: data.cost || 0 };
}

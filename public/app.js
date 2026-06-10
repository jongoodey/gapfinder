const $ = (id) => document.getElementById(id);

const state = {
  rows: [],
  filtered: [],
  selected: new Set(),
  sortKey: 'opportunityScore',
  sortDir: 'desc',
  demo: false,
  cfg: { dataForSeo: false, notion: false },
  competitorDomains: [],
};

const KEYS_STORAGE = 'gapfinder.keys';

function loadSavedKeys() {
  try {
    return JSON.parse(localStorage.getItem(KEYS_STORAGE)) || {};
  } catch {
    return {};
  }
}

function enteredKeys() {
  return {
    dataForSeoLogin: $('dfsLogin')?.value.trim() || '',
    dataForSeoPassword: $('dfsPassword')?.value.trim() || '',
    notionApiKey: $('notionKey')?.value.trim() || '',
    notionDatabaseId: $('notionDb')?.value.trim() || '',
  };
}

function dfsAvailable() {
  if (state.cfg.dataForSeo) return true;
  const k = enteredKeys();
  return Boolean(k.dataForSeoLogin && k.dataForSeoPassword);
}

function notionAvailable() {
  if (state.cfg.notion) return true;
  const k = enteredKeys();
  return Boolean(k.notionApiKey && k.notionDatabaseId);
}

// Only attach page-supplied credentials when the server has none of its own.
function credentialsPayload() {
  if (state.cfg.dataForSeo && state.cfg.notion) return undefined;
  return enteredKeys();
}

function persistKeysIfWanted() {
  if (!$('rememberKeys') || $('credsCard').hidden) return;
  if ($('rememberKeys').checked) {
    localStorage.setItem(KEYS_STORAGE, JSON.stringify(enteredKeys()));
  } else {
    localStorage.removeItem(KEYS_STORAGE);
  }
}

function updateCredentialState() {
  setChip('chipDfs', 'DataForSEO', dfsAvailable());
  setChip('chipNotion', 'Notion', notionAvailable());
  $('demoHint').hidden = dfsAvailable();
  updateActions();
}

function setupCredentials() {
  const needDfs = !state.cfg.dataForSeo;
  const needNotion = !state.cfg.notion;
  if (!needDfs && !needNotion) {
    updateCredentialState();
    return;
  }
  $('credsCard').hidden = false;
  $('dfsCreds').hidden = !needDfs;
  $('notionCreds').hidden = !needNotion;

  const saved = loadSavedKeys();
  if (saved.dataForSeoLogin) $('dfsLogin').value = saved.dataForSeoLogin;
  if (saved.dataForSeoPassword) $('dfsPassword').value = saved.dataForSeoPassword;
  if (saved.notionApiKey) $('notionKey').value = saved.notionApiKey;
  if (saved.notionDatabaseId) $('notionDb').value = saved.notionDatabaseId;
  $('rememberKeys').checked = Object.values(saved).some(Boolean);

  ['dfsLogin', 'dfsPassword', 'notionKey', 'notionDb'].forEach((id) => {
    $(id).addEventListener('input', updateCredentialState);
  });
  $('rememberKeys').addEventListener('change', persistKeysIfWanted);
  $('clearKeysBtn').addEventListener('click', () => {
    localStorage.removeItem(KEYS_STORAGE);
    ['dfsLogin', 'dfsPassword', 'notionKey', 'notionDb'].forEach((id) => ($(id).value = ''));
    $('rememberKeys').checked = false;
    updateCredentialState();
    toast('Saved keys cleared from this browser');
  });
  updateCredentialState();
}

const MAX_COMPETITORS = 10;
const DEFAULT_COMPETITORS = ['edge45.co.uk', 'clickslice.co.uk'];

init();

function competitorInputs() {
  return [...document.querySelectorAll('#competitorList .comp-input')];
}

function renumberCompetitors() {
  const rows = [...document.querySelectorAll('#competitorList .comp-field')];
  rows.forEach((row, i) => {
    row.querySelector('span').innerHTML = `Competitor ${i + 1}${i === 0 ? '' : ' <small>optional</small>'}`;
    row.querySelector('.comp-remove').hidden = rows.length === 1;
  });
  $('addCompBtn').hidden = rows.length >= MAX_COMPETITORS;
}

function addCompetitorRow(value = '', focus = false) {
  if (competitorInputs().length >= MAX_COMPETITORS) return;
  const row = document.createElement('label');
  row.className = 'field comp-field';
  row.innerHTML = `
    <span></span>
    <span class="comp-row">
      <input type="text" class="comp-input" placeholder="competitor.com" autocomplete="off" />
      <button type="button" class="comp-remove" title="Remove competitor" aria-label="Remove competitor">&times;</button>
    </span>`;
  const input = row.querySelector('input');
  input.value = value;
  if (competitorInputs().length === 0) input.required = true;
  row.querySelector('.comp-remove').addEventListener('click', () => {
    row.remove();
    renumberCompetitors();
  });
  $('competitorList').appendChild(row);
  renumberCompetitors();
  if (focus) input.focus();
}

async function init() {
  DEFAULT_COMPETITORS.forEach((domain) => addCompetitorRow(domain));
  $('addCompBtn').addEventListener('click', () => addCompetitorRow('', true));

  try {
    state.cfg = await (await fetch('/api/config')).json();
  } catch {
    state.cfg = { dataForSeo: false, notion: false };
  }
  setupCredentials();

  $('analyzeForm').addEventListener('submit', onAnalyze);
  $('searchBox').addEventListener('input', render);
  $('intentFilter').addEventListener('change', render);
  $('exportBtn').addEventListener('click', exportCsv);
  $('notionBtn').addEventListener('click', logToNotion);
  $('selectAll').addEventListener('change', (e) => {
    state.filtered.forEach((r) => (e.target.checked ? state.selected.add(r.keyword) : state.selected.delete(r.keyword)));
    render();
  });
  document.querySelectorAll('th.sortable').forEach((th) => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
      else { state.sortKey = key; state.sortDir = key === 'keyword' ? 'asc' : 'desc'; }
      render();
    });
  });
}

function setChip(id, label, on) {
  const el = $(id);
  el.textContent = `${label}: ${on ? 'configured' : 'not configured'}`;
  el.classList.toggle('on', on);
  el.classList.toggle('off', !on);
}

async function onAnalyze(e) {
  e.preventDefault();
  const payload = {
    yourDomain: $('yourDomain').value,
    competitors: competitorInputs().map((i) => i.value).filter(Boolean),
    locationName: $('locationName').value,
    languageCode: $('languageCode').value,
    limit: $('limit').value,
    minVolume: $('minVolume').value,
    maxDifficulty: $('maxDifficulty').value,
    credentials: credentialsPayload(),
  };
  persistKeysIfWanted();

  $('emptyState').hidden = true;
  $('resultsHead').hidden = true;
  $('tableWrap').hidden = true;
  $('demoBanner').hidden = true;
  $('loadingState').hidden = false;
  $('runBtn').disabled = true;

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Analysis failed');

    state.rows = data.rows;
    state.demo = data.demo;
    state.selected = new Set();
    state.competitorDomains = data.competitors;
    renderCompetitorHeaders();
    $('resultsTitle').textContent = `${data.rows.length} opportunities`;
    $('resultsSub').textContent =
      `${data.yourDomain} vs ${data.competitors.join(', ')}: keywords they rank for that you don't`;
    $('costNote').textContent = data.demo ? 'Demo run, no API cost' : `API cost this run: $${(data.cost || 0).toFixed(4)}`;
    $('demoBanner').hidden = !data.demo;
    $('resultsHead').hidden = false;
    $('tableWrap').hidden = false;
    render();
  } catch (err) {
    toast(err.message, true);
    $('emptyState').hidden = false;
  } finally {
    $('loadingState').hidden = true;
    $('runBtn').disabled = false;
  }
}

function applyFilters() {
  const q = $('searchBox').value.trim().toLowerCase();
  const intent = $('intentFilter').value;
  state.filtered = state.rows.filter(
    (r) => (!q || r.keyword.includes(q)) && (!intent || r.intent === intent)
  );
  const dir = state.sortDir === 'asc' ? 1 : -1;
  const key = state.sortKey;
  state.filtered.sort((a, b) => {
    const av = a[key] ?? -Infinity;
    const bv = b[key] ?? -Infinity;
    if (typeof av === 'string') return av.localeCompare(bv) * dir;
    return (av - bv) * dir;
  });
}

// One column per competitor in the current analysis, linking to their ranking URL.
function renderCompetitorHeaders() {
  document.querySelectorAll('th.comp-col').forEach((th) => th.remove());
  const headRow = document.querySelector('#resultsTable thead tr');
  for (const domain of state.competitorDomains) {
    const th = document.createElement('th');
    th.className = 'comp-col';
    th.textContent = domain;
    headRow.appendChild(th);
  }
}

function competitorCell(row, domain) {
  const c = (row.competitors || []).find((x) => x.domain === domain);
  if (!c || !c.url) return '<td class="comp-cell empty-cell">—</td>';
  let path;
  try {
    path = new URL(c.url).pathname || '/';
  } catch {
    path = c.url;
  }
  if (path.length > 30) path = path.slice(0, 29) + '…';
  return `<td class="comp-cell">${c.position != null ? `<span class="comp-pos">#${c.position}</span> ` : ''}<a href="${escapeAttr(c.url)}" target="_blank" rel="noopener" title="${escapeAttr(c.url)}">${escapeHtml(path)}</a></td>`;
}

function render() {
  applyFilters();

  document.querySelectorAll('th.sortable').forEach((th) => {
    th.classList.toggle('sorted-asc', th.dataset.sort === state.sortKey && state.sortDir === 'asc');
    th.classList.toggle('sorted-desc', th.dataset.sort === state.sortKey && state.sortDir === 'desc');
  });

  const maxOpp = Math.max(1, ...state.filtered.map((r) => r.opportunityScore || 0));
  const body = $('resultsBody');
  body.innerHTML = '';

  for (const row of state.filtered) {
    const tr = document.createElement('tr');
    const checked = state.selected.has(row.keyword);
    tr.className = checked ? 'selected' : '';
    tr.innerHTML = `
      <td class="col-check"><input type="checkbox" ${checked ? 'checked' : ''} data-kw="${escapeAttr(row.keyword)}"></td>
      <td><span class="kw">${escapeHtml(row.keyword)}</span>${row.intent ? `<span class="chip ${row.intent}">${row.intent.slice(0, 5)}</span>` : ''}</td>
      <td class="num">${fmt(row.searchVolume)}</td>
      <td class="num">${kdPill(row.difficulty)}</td>
      <td class="num">${row.cpc != null ? '$' + row.cpc.toFixed(2) : '—'}</td>
      <td class="num"><span class="opp"><span class="opp-bar"><i style="width:${Math.round(((row.opportunityScore || 0) / maxOpp) * 100)}%"></i></span>${fmt(row.opportunityScore)}</span></td>
      ${state.competitorDomains.map((domain) => competitorCell(row, domain)).join('')}`;
    tr.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
      e.target.checked ? state.selected.add(row.keyword) : state.selected.delete(row.keyword);
      tr.classList.toggle('selected', e.target.checked);
      updateActions();
    });
    body.appendChild(tr);
  }

  $('selectAll').checked = state.filtered.length > 0 && state.filtered.every((r) => state.selected.has(r.keyword));
  updateActions();
}

function updateActions() {
  const n = state.selected.size;
  const notionOn = notionAvailable();
  $('notionBtn').disabled = !notionOn || n === 0;
  $('notionBtn').textContent = n > 0 ? `Log ${n} to Notion` : 'Log to Notion';
  $('notionBtn').title = notionOn
    ? ''
    : 'Add your Notion API key and database ID in the connection settings to enable';
}

function selectedRows() {
  return state.rows.filter((r) => state.selected.has(r.keyword));
}

function exportCsv() {
  const rows = state.selected.size > 0 ? selectedRows() : state.filtered;
  if (rows.length === 0) return toast('Nothing to export', true);
  const header = [
    'Keyword', 'Search Volume', 'Difficulty', 'CPC', 'Intent', 'Opportunity Score',
    'Best Competitor', 'Best Position',
    ...state.competitorDomains.flatMap((d) => [`${d} Position`, `${d} URL`]),
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    const perCompetitor = state.competitorDomains.flatMap((domain) => {
      const c = (r.competitors || []).find((x) => x.domain === domain);
      return [c?.position ?? '', csv(c?.url || '')];
    });
    lines.push([
      csv(r.keyword), r.searchVolume ?? '', r.difficulty ?? '', r.cpc ?? '', csv(r.intent || ''),
      r.opportunityScore ?? '', csv(r.bestCompetitor || ''), r.bestPosition ?? '',
      ...perCompetitor,
    ].join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `keyword-gaps-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast(`Exported ${rows.length} keywords to CSV`);
}

async function logToNotion() {
  const rows = selectedRows();
  if (rows.length === 0) return;
  $('notionBtn').disabled = true;
  $('notionBtn').textContent = 'Logging…';
  try {
    const res = await fetch('/api/notion/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, credentials: credentialsPayload() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Notion logging failed');
    toast(`Logged ${data.logged} opportunities to Notion`);
    state.selected = new Set();
    render();
  } catch (err) {
    toast(err.message, true);
  } finally {
    updateActions();
  }
}

let toastTimer;
function toast(msg, isError = false) {
  const el = $('toast');
  el.textContent = msg;
  el.className = `toast${isError ? ' error' : ''}`;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 3500);
}

function fmt(n) {
  if (n == null) return '—';
  return n.toLocaleString('en-GB');
}

function kdPill(kd) {
  if (kd == null) return '—';
  const cls = kd <= 20 ? 'easy' : kd <= 50 ? 'mid' : 'hard';
  return `<span class="kd ${cls}">${kd}</span>`;
}

function csv(s) {
  s = String(s);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(s) {
  return escapeHtml(s);
}

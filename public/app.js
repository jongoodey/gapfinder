const $ = (id) => document.getElementById(id);

const state = {
  rows: [],
  filtered: [],
  selected: new Set(),
  sortKey: 'opportunityScore',
  sortDir: 'desc',
  demo: false,
  notionEnabled: false,
};

init();

async function init() {
  try {
    const cfg = await (await fetch('/api/config')).json();
    setChip('chipDfs', 'DataForSEO', cfg.dataForSeo);
    setChip('chipNotion', 'Notion', cfg.notion);
    state.notionEnabled = cfg.notion;
    $('demoHint').hidden = cfg.dataForSeo;
  } catch {
    setChip('chipDfs', 'DataForSEO', false);
    setChip('chipNotion', 'Notion', false);
  }

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
  el.classList.add(on ? 'on' : 'off');
}

async function onAnalyze(e) {
  e.preventDefault();
  const payload = {
    yourDomain: $('yourDomain').value,
    competitors: [$('comp1').value, $('comp2').value, $('comp3').value].filter(Boolean),
    locationName: $('locationName').value,
    languageCode: $('languageCode').value,
    limit: $('limit').value,
    minVolume: $('minVolume').value,
    maxDifficulty: $('maxDifficulty').value,
  };

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
    const others = row.competitors.length - 1;
    tr.innerHTML = `
      <td class="col-check"><input type="checkbox" ${checked ? 'checked' : ''} data-kw="${escapeAttr(row.keyword)}"></td>
      <td><span class="kw">${escapeHtml(row.keyword)}</span>${row.intent ? `<span class="chip ${row.intent}">${row.intent.slice(0, 5)}</span>` : ''}</td>
      <td class="num">${fmt(row.searchVolume)}</td>
      <td class="num">${kdPill(row.difficulty)}</td>
      <td class="num">${row.cpc != null ? '$' + row.cpc.toFixed(2) : '—'}</td>
      <td class="num"><span class="opp"><span class="opp-bar"><i style="width:${Math.round(((row.opportunityScore || 0) / maxOpp) * 100)}%"></i></span>${fmt(row.opportunityScore)}</span></td>
      <td class="comp-cell">
        ${row.bestUrl ? `<a href="${escapeAttr(row.bestUrl)}" target="_blank" rel="noopener">${escapeHtml(row.bestCompetitor || '')}</a>` : escapeHtml(row.bestCompetitor || '—')}
        ${row.bestPosition ? `<span class="comp-pos">#${row.bestPosition}</span>` : ''}
        ${others > 0 ? `<span class="comp-more">+${others} more</span>` : ''}
      </td>`;
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
  $('notionBtn').disabled = !state.notionEnabled || n === 0;
  $('notionBtn').textContent = n > 0 ? `Log ${n} to Notion` : 'Log to Notion';
  $('notionBtn').title = state.notionEnabled
    ? ''
    : 'Add NOTION_API_KEY and NOTION_DATABASE_ID to .env to enable';
}

function selectedRows() {
  return state.rows.filter((r) => state.selected.has(r.keyword));
}

function exportCsv() {
  const rows = state.selected.size > 0 ? selectedRows() : state.filtered;
  if (rows.length === 0) return toast('Nothing to export', true);
  const header = ['Keyword', 'Search Volume', 'Difficulty', 'CPC', 'Intent', 'Opportunity Score', 'Best Competitor', 'Best Position', 'Competitor URL', 'All Competitors'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      csv(r.keyword), r.searchVolume ?? '', r.difficulty ?? '', r.cpc ?? '', csv(r.intent || ''),
      r.opportunityScore ?? '', csv(r.bestCompetitor || ''), r.bestPosition ?? '', csv(r.bestUrl || ''),
      csv(r.competitors.map((c) => `${c.domain}${c.position ? ` (#${c.position})` : ''}`).join('; ')),
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
      body: JSON.stringify({ rows }),
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

// Merge per-competitor domain_intersection items into one row per keyword.
// Each item follows the DataForSEO Labs shape: keyword_data + first_domain_serp_element
// (the competitor's SERP element, since target1 is the competitor).

export function mergeCompetitorItems(perCompetitor) {
  const byKeyword = new Map();

  for (const { domain, items } of perCompetitor) {
    for (const item of items) {
      const kd = item.keyword_data || {};
      const info = kd.keyword_info || {};
      const props = kd.keyword_properties || {};
      const serp = item.first_domain_serp_element || {};
      const keyword = kd.keyword;
      if (!keyword) continue;

      let row = byKeyword.get(keyword);
      if (!row) {
        row = {
          keyword,
          searchVolume: info.search_volume ?? 0,
          difficulty: props.keyword_difficulty ?? null,
          intent: kd.search_intent_info?.main_intent ?? null,
          cpc: info.cpc ?? null,
          competitionLevel: info.competition_level ?? null,
          trendYearly: info.search_volume_trend?.yearly ?? null,
          monthlySearches: info.monthly_searches ?? null,
          competitors: [],
        };
        byKeyword.set(keyword, row);
      }

      row.competitors.push({
        domain,
        position: serp.rank_absolute ?? null,
        url: serp.url ?? null,
        title: serp.title ?? null,
        etv: serp.etv ?? null,
      });
    }
  }

  const rows = [...byKeyword.values()].map((row) => {
    const ranked = row.competitors.filter((c) => c.position != null);
    const best = ranked.sort((a, b) => a.position - b.position)[0] || row.competitors[0] || {};
    const difficulty = row.difficulty ?? 50;
    return {
      ...row,
      bestPosition: best.position ?? null,
      bestCompetitor: best.domain ?? null,
      bestUrl: best.url ?? null,
      // Higher volume and lower difficulty = bigger opportunity.
      opportunityScore: Math.round(row.searchVolume * (1 - difficulty / 100)),
    };
  });

  rows.sort((a, b) => b.opportunityScore - a.opportunityScore);
  return rows;
}

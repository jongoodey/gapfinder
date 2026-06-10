// Demo dataset served when DataForSEO credentials are missing.
// Items mirror the raw domain_intersection shape so demo mode runs
// through the same merge pipeline as live mode.

const KEYWORDS = [
  ['best running shoes for marathon', 74000, 38, 'commercial', 1.12, 27, 4],
  ['cushioned running shoes', 49500, 31, 'commercial', 0.98, 12, 3],
  ['stability running shoes', 33100, 29, 'commercial', 0.87, 5, 8],
  ['running shoes for flat feet', 27100, 35, 'commercial', 1.05, 9, 6],
  ['trail running shoes uk', 22200, 24, 'commercial', 0.76, 3, 11],
  ['carbon plate running shoes', 18100, 42, 'commercial', 1.34, 14, 2],
  ['best shoes for zone 2 training', 14800, 18, 'informational', 0.45, 7, 19],
  ['wide fit running shoes', 12100, 22, 'commercial', 0.92, 4, 16],
  ['running shoes for beginners', 9900, 26, 'commercial', 0.81, 11, 5],
  ['ultramarathon shoes', 8100, 21, 'commercial', 0.68, 2, 13],
  ['heel drop running shoes explained', 6600, 12, 'informational', 0.21, 6, 22],
  ['best recovery shoes for runners', 5400, 15, 'commercial', 0.74, 8, 9],
  ['supination running shoes', 4400, 19, 'commercial', 0.83, 10, 7],
  ['waterproof running shoes', 3600, 23, 'commercial', 0.79, 15, 12],
  ['running shoes sale uk', 2900, 33, 'transactional', 1.21, 18, 10],
  ['how often to replace running shoes', 2400, 9, 'informational', 0.18, 13, 25],
  ['race day shoes vs trainers', 1900, 14, 'informational', 0.32, 21, 17],
  ['100k ultra gear checklist', 1600, 8, 'informational', 0.26, 16, 28],
  ['maf training shoes', 1300, 6, 'informational', 0.15, 19, 31],
  ['running shoes for heavy runners', 1000, 17, 'commercial', 0.88, 22, 14],
];

function makeItem([keyword, volume, kd, intent, cpc, pos], domain, posOffset) {
  const position = pos + posOffset;
  return {
    keyword_data: {
      keyword,
      keyword_info: {
        search_volume: volume,
        cpc,
        competition_level: volume > 20000 ? 'HIGH' : 'MEDIUM',
        search_volume_trend: { yearly: ((volume * 7) % 60) - 20 },
      },
      keyword_properties: { keyword_difficulty: kd },
      search_intent_info: { main_intent: intent },
    },
    first_domain_serp_element: {
      type: 'organic',
      rank_absolute: position,
      url: `https://www.${domain}/guides/${keyword.replace(/\s+/g, '-')}/`,
      title: `${keyword.replace(/\b\w/g, (c) => c.toUpperCase())} | ${domain}`,
      etv: Math.round(volume * Math.max(0.02, 0.35 - position * 0.02)),
    },
  };
}

export function demoPerCompetitor(competitors) {
  const domains = competitors.length > 0 ? competitors : ['competitor-a.com', 'competitor-b.com'];
  return domains.map((domain, i) => ({
    domain,
    items: KEYWORDS.filter((_, k) => (k + i) % domains.length !== 1 || domains.length === 1).map(
      (kw) => makeItem(kw, domain, i * 2)
    ),
  }));
}

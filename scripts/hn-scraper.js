'use strict';

const { getDb, startRun, endRun } = require('./db');
const settings = require('../config/settings.json');

const HN_API = 'https://hn.algolia.com/api/v1/search';

function isModuleEnabled() {
  if (!settings.modules.hn_scraper) {
    console.log('[hn-scraper] Module disabled in settings.json. Skipping.');
    return false;
  }
  return true;
}

async function fetchHN(query) {
  const { default: fetch } = await import('node-fetch');
  const cutoff = Math.floor(Date.now() / 1000) - settings.hn.max_age_days * 86400;
  const url = `${HN_API}?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=${settings.hn.results_per_query}&numericFilters=created_at_i>${cutoff}`;
  console.log(`[hn-scraper] GET ${url}`);

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; autoBusiness/1.0)' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}. Response: ${body.slice(0, 200)}`);
    }
    const data = await res.json();
    const hits = (data.hits || []).filter(h => (h.points || 0) >= settings.hn.min_points);
    console.log(`[hn-scraper] "${query}" → ${data.hits?.length || 0} hits from API, ${hits.length} passed min_points filter`);
    return hits;
  } catch (err) {
    console.warn(`[hn-scraper] HN API failed for "${query}": ${err.message}`);
    return [];
  }
}

async function run() {
  if (!isModuleEnabled()) return;

  const runId = startRun('hn-scraper');
  const db = getDb();

  // Allow env var override for niche (same pattern as other scrapers)
  const nicheTarget = (process.env.RESEARCH_NICHE || '').trim() || (settings.niche && settings.niche.target) || '';
  if (nicheTarget) {
    console.log(`[hn-scraper] Niche target: "${nicheTarget}" — will add niche-specific queries`);
  } else {
    console.log('[hn-scraper] No niche target set. Searching with base queries only.');
  }

  // Build final list of queries: base queries + niche-enriched variants
  const baseQueries = settings.hn.queries;
  const queries = nicheTarget
    ? [...baseQueries, ...baseQueries.map(q => `${q} ${nicheTarget}`)]
    : [...baseQueries];

  console.log(`[hn-scraper] Queries (${queries.length}): ${queries.join(' | ')}`);

  const insertPost = db.prepare(`
    INSERT OR IGNORE INTO hn_posts
      (id, title, url, points, num_comments, created_at_ts, author, niche)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let totalInserted = 0;
  const errors = [];

  for (const query of queries) {
    console.log(`[hn-scraper] Querying HN: "${query}"`);
    try {
      const hits = await fetchHN(query);
      const insertMany = db.transaction(hits => {
        let count = 0;
        for (const h of hits) {
          const result = insertPost.run(
            String(h.objectID),
            h.title || '',
            h.url || '',
            h.points || 0,
            h.num_comments || 0,
            h.created_at_i || 0,
            h.author || '',
            nicheTarget || null
          );
          if (result.changes > 0) count++;
        }
        return count;
      });
      const count = insertMany(hits);
      console.log(`[hn-scraper] "${query}" → ${hits.length} posts, ${count} new`);
      totalInserted += count;
    } catch (err) {
      const msg = `"${query}": ${err.message}`;
      console.error(`[hn-scraper] Error: ${msg}`);
      errors.push(msg);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  const summary = `Scraped ${queries.length} HN queries. Inserted ${totalInserted} new posts.`;
  console.log(`[hn-scraper] Done. ${summary}`);
  endRun(runId, errors.length > 0 ? 'partial' : 'success', totalInserted, summary, errors.join('\n') || null);
}

run().catch(err => {
  console.error('[hn-scraper] Fatal error:', err);
  process.exit(1);
});

'use strict';

const { getDb, startRun, endRun } = require('./db');
const settings = require('../config/settings.json');

const REDDIT_BASE = 'https://www.reddit.com';
const USER_AGENT = 'Mozilla/5.0 (compatible; autoBusiness/1.0; research-bot)';

function isModuleEnabled() {
  if (!settings.modules.reddit_scraper) {
    console.log('[reddit-scraper] Module disabled in settings.json. Skipping.');
    return false;
  }
  return true;
}

async function fetchJson(url) {
  const { default: fetch } = await import('node-fetch');
  console.log(`[reddit-scraper] GET ${url}`);
  let res;
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
    });
  } catch (err) {
    throw new Error(`Network error fetching ${url}: ${err.message}`);
  }

  if (res.status === 429) {
    console.warn('[reddit-scraper] Rate limited (429). Waiting 30s before retry...');
    await new Promise(r => setTimeout(r, 30000));
    try {
      res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    } catch (err) {
      throw new Error(`Network error on retry for ${url}: ${err.message}`);
    }
  }

  if (res.status === 403) {
    const body = await res.text().catch(() => '');
    throw new Error(
      `HTTP 403 Forbidden — Reddit is blocking this request.\n` +
      `  URL: ${url}\n` +
      `  Hint: Reddit may require OAuth for search endpoints. Response: ${body.slice(0, 300)}`
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} for ${url}. Response: ${body.slice(0, 300)}`);
  }

  return res.json();
}

function postIsRecent(createdUtc, maxAgeDays) {
  const cutoff = Math.floor(Date.now() / 1000) - maxAgeDays * 86400;
  return createdUtc >= cutoff;
}

async function scrapeSubreddit(subreddit, query, config) {
  const url = `${REDDIT_BASE}/r/${encodeURIComponent(subreddit)}/search.json?q=${encodeURIComponent(query)}&sort=new&limit=${config.posts_per_query}&restrict_sr=1`;
  let data;
  try {
    data = await fetchJson(url);
  } catch (err) {
    console.error(`[reddit-scraper] Failed to fetch r/${subreddit} query="${query}":\n  ${err.message}`);
    return [];
  }

  const rawPosts = (data?.data?.children || []).map(c => c.data);
  console.log(`[reddit-scraper] r/${subreddit} "${query}" → ${rawPosts.length} raw posts returned by API`);

  const filtered = { lowScore: 0, tooOld: 0 };
  const posts = rawPosts.filter(p => {
    const scoreOk = p.score >= config.min_score;
    const recentOk = postIsRecent(p.created_utc, config.max_age_days);
    if (!scoreOk) filtered.lowScore++;
    if (!recentOk) filtered.tooOld++;
    return scoreOk && recentOk;
  });

  if (filtered.lowScore > 0 || filtered.tooOld > 0) {
    console.log(`[reddit-scraper] r/${subreddit} "${query}" → filtered out ${filtered.lowScore} low-score, ${filtered.tooOld} too-old`);
  }
  console.log(`[reddit-scraper] r/${subreddit} "${query}" → ${posts.length} posts passed filters (min_score=${config.min_score}, max_age_days=${config.max_age_days})`);
  return posts;
}

async function run() {
  if (!isModuleEnabled()) return;

  const runId = startRun('reddit-scraper');
  const db = getDb();
  const cfg = settings.reddit;
  let totalInserted = 0;
  const errors = [];

  // Allow env var override for niche (same as keyword-research.js)
  const nicheTarget = (process.env.RESEARCH_NICHE || '').trim() || (settings.niche && settings.niche.target) || '';
  if (nicheTarget) {
    console.log(`[reddit-scraper] Niche target: "${nicheTarget}" — will append to search queries`);
  } else {
    console.log('[reddit-scraper] No niche target set. Searching with base queries only.');
  }

  // Build final list of queries: base queries + niche-enriched variants
  const baseQueries = cfg.queries;
  const queries = nicheTarget
    ? [...baseQueries, ...baseQueries.map(q => `${q} ${nicheTarget}`)]
    : [...baseQueries];

  console.log(`[reddit-scraper] Subreddits: ${cfg.subreddits.join(', ')}`);
  console.log(`[reddit-scraper] Queries (${queries.length}): ${queries.join(' | ')}`);

  const insertPost = db.prepare(`
    INSERT OR IGNORE INTO reddit_posts
      (id, subreddit, title, selftext, score, num_comments, created_utc, permalink, niche)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const subreddit of cfg.subreddits) {
    for (const query of queries) {
      console.log(`[reddit-scraper] Scraping r/${subreddit} query="${query}"`);
      try {
        const posts = await scrapeSubreddit(subreddit, query, cfg);
        const insertMany = db.transaction(posts => {
          let count = 0;
          for (const p of posts) {
            const result = insertPost.run(
              p.id,
              p.subreddit,
              p.title || '',
              p.selftext || '',
              p.score,
              p.num_comments,
              p.created_utc,
              p.permalink || '',
              nicheTarget || null
            );
            if (result.changes > 0) count++;
          }
          return count;
        });
        const count = insertMany(posts);
        console.log(`[reddit-scraper] r/${subreddit} "${query}" → ${posts.length} posts, ${count} new`);
        totalInserted += count;
      } catch (err) {
        const msg = `r/${subreddit} "${query}": ${err.message}`;
        console.error(`[reddit-scraper] Error: ${msg}`);
        errors.push(msg);
      }

      await new Promise(r => setTimeout(r, cfg.delay_between_requests_ms || 1500));
    }
  }

  const summary = `Scraped ${cfg.subreddits.length} subreddits × ${queries.length} queries. Inserted ${totalInserted} new posts.`;
  console.log(`[reddit-scraper] Done. ${summary}`);
  endRun(runId, errors.length > 0 ? 'partial' : 'success', totalInserted, summary, errors.join('\n') || null);
}

run().catch(err => {
  console.error('[reddit-scraper] Fatal error:', err);
  process.exit(1);
});

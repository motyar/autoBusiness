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
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (res.status === 429) {
    console.warn('[reddit-scraper] Rate limited. Waiting 30s...');
    await new Promise(r => setTimeout(r, 30000));
    const retry = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (retry.status === 403) {
      throw new Error(`HTTP 403 Forbidden — Reddit may be blocking automated requests for this endpoint`);
    }
    if (!retry.ok) throw new Error(`HTTP ${retry.status} after retry`);
    return retry.json();
  }
  if (res.status === 403) {
    throw new Error(`HTTP 403 Forbidden — Reddit may be blocking automated requests for this endpoint`);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
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
    console.error(`[reddit-scraper] Failed to fetch r/${subreddit} query="${query}": ${err.message}`);
    return [];
  }

  const posts = (data?.data?.children || []).map(c => c.data);
  return posts.filter(p =>
    p.score >= config.min_score &&
    postIsRecent(p.created_utc, config.max_age_days)
  );
}

async function run() {
  if (!isModuleEnabled()) return;

  const runId = startRun('reddit-scraper');
  const db = getDb();
  const cfg = settings.reddit;
  let totalInserted = 0;
  const errors = [];

  const insertPost = db.prepare(`
    INSERT OR IGNORE INTO reddit_posts
      (id, subreddit, title, selftext, score, num_comments, created_utc, permalink)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const subreddit of cfg.subreddits) {
    for (const query of cfg.queries) {
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
              p.permalink || ''
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

  const summary = `Scraped ${cfg.subreddits.length} subreddits × ${cfg.queries.length} queries. Inserted ${totalInserted} new posts.`;
  console.log(`[reddit-scraper] Done. ${summary}`);
  endRun(runId, errors.length > 0 ? 'partial' : 'success', totalInserted, summary, errors.join('\n') || null);
}

run().catch(err => {
  console.error('[reddit-scraper] Fatal error:', err);
  process.exit(1);
});

'use strict';

const { getDb } = require('./db');
const fs = require('fs');
const path = require('path');

function toCSV(rows, columns) {
  const header = columns.join(',');
  const lines = rows.map(row =>
    columns.map(col => {
      const val = row[col] == null ? '' : String(row[col]);
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val;
    }).join(',')
  );
  return [header, ...lines].join('\n');
}

function run() {
  const db = getDb();

  const now = new Date();
  // e.g. 2024-03-15_06-00
  const ts = now.toISOString().replace('T', '_').replace(/:/g, '-').slice(0, 16);
  const outputDir = path.join(__dirname, '..', 'output', ts);
  fs.mkdirSync(outputDir, { recursive: true });

  const scoreThreshold = 3;

  // Keywords found today (date_found = today's date)
  const todayKeywords = db.prepare(`
    SELECT keyword, volume_range, competition_level, source, opportunity_score, date_found, niche
    FROM keywords
    WHERE date_found = date('now')
    ORDER BY opportunity_score DESC, keyword ASC
  `).all();

  // All stored keywords with score >= threshold (full research database)
  const allKeywords = db.prepare(`
    SELECT keyword, volume_range, competition_level, source, opportunity_score, date_found, niche
    FROM keywords
    WHERE opportunity_score >= ?
    ORDER BY opportunity_score DESC, keyword ASC
  `).all(scoreThreshold);

  // HN posts collected in the last 24 hours
  const hnPosts = db.prepare(`
    SELECT title, url, points, num_comments, author,
           datetime(created_at_ts, 'unixepoch') as published_at
    FROM hn_posts
    WHERE created_at >= strftime('%s', 'now') - 86400
    ORDER BY points DESC
  `).all();

  // Reddit posts collected in the last 24 hours
  const redditPosts = db.prepare(`
    SELECT subreddit, title, score, num_comments,
           datetime(created_utc, 'unixepoch') as published_at,
           permalink
    FROM reddit_posts
    WHERE created_at >= strftime('%s', 'now') - 86400
    ORDER BY score DESC
  `).all();

  // Runs from the last 24 hours
  const runStats = db.prepare(`
    SELECT script, status, items_processed, summary, errors,
           datetime(started_at, 'unixepoch') as started,
           datetime(finished_at, 'unixepoch') as finished
    FROM runs
    WHERE started_at >= strftime('%s', 'now') - 86400
    ORDER BY started_at DESC
  `).all();

  // --- Write files ---

  // today's keywords JSON
  fs.writeFileSync(
    path.join(outputDir, 'keywords.json'),
    JSON.stringify(todayKeywords, null, 2)
  );

  // today's keywords CSV
  if (todayKeywords.length > 0) {
    const csv = toCSV(todayKeywords, [
      'keyword', 'volume_range', 'competition_level', 'opportunity_score', 'niche', 'date_found',
    ]);
    fs.writeFileSync(path.join(outputDir, 'keywords.csv'), csv);
  }

  // full research DB keywords (score >= threshold)
  fs.writeFileSync(
    path.join(outputDir, 'keywords-all.json'),
    JSON.stringify(allKeywords, null, 2)
  );

  if (hnPosts.length > 0) {
    fs.writeFileSync(
      path.join(outputDir, 'hn-posts.json'),
      JSON.stringify(hnPosts, null, 2)
    );
  }

  if (redditPosts.length > 0) {
    fs.writeFileSync(
      path.join(outputDir, 'reddit-posts.json'),
      JSON.stringify(redditPosts, null, 2)
    );
  }

  // --- Summary markdown ---
  const highScoreKeywords = todayKeywords.filter(k => k.opportunity_score >= scoreThreshold);

  let md = `# Research Run — ${now.toISOString().replace('T', ' ').slice(0, 16)} UTC\n\n`;
  md += `## Summary\n\n`;
  md += `| Metric | Count |\n`;
  md += `|--------|-------|\n`;
  md += `| Keywords generated this run | ${todayKeywords.length} |\n`;
  md += `| Keywords stored (score ≥ ${scoreThreshold}) | ${highScoreKeywords.length} |\n`;
  md += `| Total keywords in database | ${allKeywords.length} |\n`;
  md += `| HN posts collected | ${hnPosts.length} |\n`;
  md += `| Reddit posts collected | ${redditPosts.length} |\n\n`;

  if (highScoreKeywords.length > 0) {
    md += `## Top Keywords (score ≥ ${scoreThreshold})\n\n`;
    md += `| Keyword | Score | Volume | Competition | Niche |\n`;
    md += `|---------|-------|--------|-------------|-------|\n`;
    for (const kw of highScoreKeywords.slice(0, 30)) {
      md += `| ${kw.keyword} | ${kw.opportunity_score} | ${kw.volume_range} | ${kw.competition_level} | ${kw.niche || ''} |\n`;
    }
    md += `\n`;
  }

  if (hnPosts.length > 0) {
    md += `## Top HN Posts\n\n`;
    md += `| Title | Points | Comments |\n`;
    md += `|-------|--------|----------|\n`;
    for (const p of hnPosts.slice(0, 10)) {
      const safeTitle = (p.title || '').replace(/\|/g, '-');
      const linked = p.url ? `[${safeTitle}](${p.url})` : safeTitle;
      md += `| ${linked} | ${p.points} | ${p.num_comments} |\n`;
    }
    md += `\n`;
  }

  if (redditPosts.length > 0) {
    md += `## Reddit Posts\n\n`;
    md += `| Subreddit | Title | Score | Comments |\n`;
    md += `|-----------|-------|-------|----------|\n`;
    for (const p of redditPosts.slice(0, 10)) {
      const safeTitle = (p.title || '').replace(/\|/g, '-');
      md += `| r/${p.subreddit} | ${safeTitle} | ${p.score} | ${p.num_comments} |\n`;
    }
    md += `\n`;
  }

  md += `## Run Log\n\n`;
  if (runStats.length > 0) {
    md += `| Script | Status | Items | Summary |\n`;
    md += `|--------|--------|-------|---------|\n`;
    for (const r of runStats) {
      const statusEmoji = r.status === 'success' ? '✅' : r.status === 'partial' ? '⚠️' : '❌';
      const summary = (r.summary || '').replace(/\|/g, '-');
      md += `| ${r.script} | ${statusEmoji} ${r.status} | ${r.items_processed} | ${summary} |\n`;
    }
    md += `\n`;
  } else {
    md += `_No runs logged yet._\n\n`;
  }

  const errorRuns = runStats.filter(r => r.errors);
  if (errorRuns.length > 0) {
    md += `## Errors\n\n`;
    for (const r of errorRuns) {
      md += `**${r.script}:** ${r.errors}\n\n`;
    }
  }

  md += `---\n_Generated by autoBusiness research pipeline_\n`;

  fs.writeFileSync(path.join(outputDir, 'summary.md'), md);

  console.log(`[export-research] Results written to output/${ts}/`);
  console.log(`[export-research] Keywords this run: ${todayKeywords.length} (${highScoreKeywords.length} with score >= ${scoreThreshold})`);
  console.log(`[export-research] Total high-score keywords in DB: ${allKeywords.length}`);
  console.log(`[export-research] HN posts: ${hnPosts.length}`);
  console.log(`[export-research] Reddit posts: ${redditPosts.length}`);

  return outputDir;
}

try {
  run();
} catch (err) {
  console.error('[export-research] Fatal error:', err);
  process.exit(1);
}

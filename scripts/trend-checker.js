'use strict';

const { getDb, startRun, endRun } = require('./db');
const settings = require('../config/settings.json');

function isModuleEnabled() {
  if (!settings.modules.trend_checker) {
    console.log('[trend-checker] Module disabled in settings.json. Skipping.');
    return false;
  }
  return true;
}

async function fetchTrendData(keyword) {
  const { default: fetch } = await import('node-fetch');
  const encoded = encodeURIComponent(keyword);
  const url = `https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=-330&req={"time":"today+12-m","resolution":"WEEK","locale":"en","comparisonItem":[{"geo":{},"complexKeywordsRestriction":{"keyword":[{"type":"BROAD","value":"${encoded}"}]}}],"requestOptions":{"property":"","backend":"IZG","category":0}}`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; autoBusiness/1.0)',
        'Accept': 'text/plain',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const jsonStart = text.indexOf('{');
    if (jsonStart === -1) throw new Error('No JSON in response');
    const data = JSON.parse(text.slice(jsonStart));
    const timelineData = data?.default?.timelineData || [];
    return timelineData.map(d => d.value?.[0] || 0);
  } catch (err) {
    console.warn(`[trend-checker] Could not fetch trend for "${keyword}": ${err.message}`);
    return null;
  }
}

function calculateDirection(values) {
  if (!values || values.length < 4) return 'unknown';

  const n = values.length;
  const avgX = (n - 1) / 2;
  const avgY = values.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - avgX) * (values[i] - avgY);
    denominator += (i - avgX) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;

  if (slope > 0.3) return 'rising';
  if (slope < -0.3) return 'declining';
  return 'flat';
}

async function run() {
  if (!isModuleEnabled()) return;

  const runId = startRun('trend-checker');
  const db = getDb();

  const keywords = db.prepare(`
    SELECT DISTINCT keyword, niche FROM keywords
    WHERE opportunity_score >= 3
    ORDER BY opportunity_score DESC
    LIMIT 50
  `).all();

  const alreadyChecked = db.prepare(`
    SELECT DISTINCT keyword FROM trends
    WHERE date_checked >= date('now', '-7 days')
  `).all().map(r => r.keyword);

  const alreadySet = new Set(alreadyChecked);

  const insertTrend = db.prepare(`
    INSERT INTO trends (keyword, source, value, direction, date_checked, niche)
    VALUES (?, 'google_trends', ?, ?, date('now'), ?)
  `);

  let processed = 0;
  const errors = [];

  for (const row of keywords) {
    if (alreadySet.has(row.keyword)) {
      console.log(`[trend-checker] Skip (cached): "${row.keyword}"`);
      continue;
    }

    console.log(`[trend-checker] Fetching trend: "${row.keyword}"`);
    const values = await fetchTrendData(row.keyword);

    if (values && values.length > 0) {
      const direction = calculateDirection(values);
      const avgValue = values.reduce((a, b) => a + b, 0) / values.length;

      try {
        insertTrend.run(row.keyword, avgValue, direction, row.niche || null);
        console.log(`[trend-checker] "${row.keyword}" → direction: ${direction}, avg: ${avgValue.toFixed(1)}`);
        processed++;
      } catch (err) {
        console.warn(`[trend-checker] DB insert failed for "${row.keyword}": ${err.message}`);
        errors.push(err.message);
      }
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  const summary = `Checked trends for ${processed} keywords.`;
  console.log(`[trend-checker] Done. ${summary}`);
  endRun(runId, errors.length > 0 ? 'partial' : 'success', processed, summary, errors.join('\n') || null);
}

run().catch(err => {
  console.error('[trend-checker] Fatal error:', err);
  process.exit(1);
});

'use strict';

const { getDb, startRun, endRun } = require('./db');
const settings = require('../config/settings.json');
const fs = require('fs');
const path = require('path');

function isModuleEnabled() {
  if (!settings.modules.convergence_scorer) {
    console.log('[convergence-scorer] Module disabled in settings.json. Skipping.');
    return false;
  }
  return true;
}

function run() {
  if (!isModuleEnabled()) return;

  const runId = startRun('convergence-scorer');
  const db = getDb();

  const redditSignals = db.prepare(`
    SELECT niche, 'reddit' as source, AVG(confidence) as avg_confidence
    FROM reddit_posts
    WHERE niche IS NOT NULL AND confidence >= 0.6
    GROUP BY niche
  `).all();

  const hnSignals = db.prepare(`
    SELECT niche, 'hn' as source, AVG(confidence) as avg_confidence
    FROM hn_posts
    WHERE niche IS NOT NULL AND confidence >= 0.6
    GROUP BY niche
  `).all();

  const keywordSignals = db.prepare(`
    SELECT niche, 'keywords' as source, AVG(opportunity_score) / 5.0 as avg_confidence
    FROM keywords
    WHERE niche IS NOT NULL AND opportunity_score >= 3
    GROUP BY niche
  `).all();

  const trendSignals = db.prepare(`
    SELECT niche, 'trends' as source, 0.8 as avg_confidence
    FROM trends
    WHERE niche IS NOT NULL AND direction = 'rising'
    GROUP BY niche
  `).all();

  const allSignals = [...redditSignals, ...hnSignals, ...keywordSignals, ...trendSignals];

  const nicheMap = new Map();
  for (const sig of allSignals) {
    if (!sig.niche) continue;
    if (!nicheMap.has(sig.niche)) {
      nicheMap.set(sig.niche, { sources: [], confidences: [] });
    }
    const entry = nicheMap.get(sig.niche);
    if (!entry.sources.includes(sig.source)) {
      entry.sources.push(sig.source);
      entry.confidences.push(sig.avg_confidence || 0.5);
    }
  }

  const shortlist = [];
  const minSources = 2;

  for (const [niche, data] of nicheMap.entries()) {
    if (data.sources.length < minSources) continue;

    const sourceCount = data.sources.length;
    const avgConf = data.confidences.reduce((a, b) => a + b, 0) / data.confidences.length;

    const baseScore = sourceCount * 20;
    const confBoost = avgConf * 20;
    const trendBoost = data.sources.includes('trends') ? 10 : 0;
    const finalScore = Math.min(100, baseScore + confBoost + trendBoost);

    shortlist.push({
      niche,
      source_count: sourceCount,
      sources: data.sources,
      confidence: Math.round(finalScore),
      status: finalScore >= 60 && sourceCount >= 3 ? 'validated' : 'new',
      updated_at: new Date().toISOString(),
    });
  }

  shortlist.sort((a, b) => b.confidence - a.confidence || b.source_count - a.source_count);

  const upsertIdea = db.prepare(`
    INSERT INTO ideas (niche, source_count, sources, confidence, status)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(niche) DO UPDATE SET
      source_count = excluded.source_count,
      sources = excluded.sources,
      confidence = excluded.confidence,
      status = CASE
        WHEN ideas.status IN ('building','launched') THEN ideas.status
        ELSE excluded.status
      END,
      updated_at = strftime('%s','now')
  `);

  const updateAll = db.transaction(list => {
    for (const item of list) {
      upsertIdea.run(
        item.niche,
        item.source_count,
        JSON.stringify(item.sources),
        item.confidence / 100,
        item.status
      );
    }
  });

  try {
    updateAll(shortlist);
  } catch (err) {
    console.error('[convergence-scorer] DB update failed:', err.message);
  }

  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(
    path.join(dataDir, 'shortlist.json'),
    JSON.stringify(shortlist.slice(0, 20), null, 2)
  );

  const validated = shortlist.filter(i => i.status === 'validated');
  const summary = `${shortlist.length} niches scored. ${validated.length} validated (3+ sources, score ≥ 60). Top: ${shortlist[0]?.niche || 'none'}`;
  console.log(`[convergence-scorer] Done. ${summary}`);
  endRun(runId, 'success', shortlist.length, summary, null);
}

try {
  run();
} catch (err) {
  console.error('[convergence-scorer] Fatal error:', err);
  process.exit(1);
}

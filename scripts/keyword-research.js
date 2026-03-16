'use strict';

const { getDb, startRun, endRun } = require('./db');
const settings = require('../config/settings.json');

const AUTOCOMPLETE_URL = 'https://suggestqueries.google.com/complete/search?client=firefox&q=';
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

function isModuleEnabled() {
  if (!settings.modules.keyword_research) {
    console.log('[keyword-research] Module disabled in settings.json. Skipping.');
    return false;
  }
  return true;
}

async function fetchSuggestions(query) {
  const { default: fetch } = await import('node-fetch');
  const url = `${AUTOCOMPLETE_URL}${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; autoBusiness/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data[1]) ? data[1] : [];
  } catch (err) {
    console.warn(`[keyword-research] Autocomplete failed for "${query}": ${err.message}`);
    return [];
  }
}

function scoreOpportunity(volumeRange, competitionLevel) {
  let score = 0;
  if (volumeRange === '100-1000') score += 1;
  else if (volumeRange === '1000-5000') score += 2;

  if (competitionLevel === 'low') score += 2;
  else if (competitionLevel === 'medium') score += 1;

  return score;
}

async function run() {
  if (!isModuleEnabled()) return;

  const runId = startRun('keyword-research');
  const db = getDb();
  const cfg = settings.keywords;
  const nicheCfg = settings.niche;

  const insertKeyword = db.prepare(`
    INSERT OR IGNORE INTO keywords (keyword, volume_range, competition_level, source, opportunity_score, date_found, niche)
    VALUES (?, ?, ?, ?, ?, date('now'), ?)
  `);

  const seeds = [...cfg.seeds];
  if (nicheCfg.target) {
    seeds.push(...cfg.seeds.map(s => `${s} ${nicheCfg.target}`));
  }

  let totalInserted = 0;
  const errors = [];
  const allKeywords = new Set();

  for (const seed of seeds) {
    console.log(`[keyword-research] Expanding seed: "${seed}"`);

    const suggestions = await fetchSuggestions(seed);
    for (const kw of suggestions) allKeywords.add(kw);

    if (cfg.alphabet_soup) {
      for (const letter of ALPHABET) {
        const query = `${seed} ${letter}`;
        const letterSuggestions = await fetchSuggestions(query);
        for (const kw of letterSuggestions) allKeywords.add(kw);
        await new Promise(r => setTimeout(r, 300));
      }
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`[keyword-research] Found ${allKeywords.size} unique keywords. Scoring...`);

  const insertMany = db.transaction(keywords => {
    let count = 0;
    for (const kw of keywords) {
      const volumeRange = estimateVolumeRange(kw);
      const competitionLevel = estimateCompetition(kw);
      const score = scoreOpportunity(volumeRange, competitionLevel);

      if (score < (cfg.opportunity_score_threshold || 1)) continue;

      const niche = nicheCfg.target || extractNiche(kw);
      const result = insertKeyword.run(kw, volumeRange, competitionLevel, 'autocomplete', score, niche);
      if (result.changes > 0) count++;
    }
    return count;
  });

  try {
    totalInserted = insertMany([...allKeywords]);
  } catch (err) {
    errors.push(err.message);
  }

  const summary = `Expanded ${seeds.length} seeds → ${allKeywords.size} keywords → ${totalInserted} stored (score >= ${cfg.opportunity_score_threshold || 1}).`;
  console.log(`[keyword-research] Done. ${summary}`);
  endRun(runId, errors.length > 0 ? 'partial' : 'success', totalInserted, summary, errors.join('\n') || null);
}

function estimateVolumeRange(keyword) {
  const wordCount = keyword.split(' ').length;
  if (wordCount <= 2) return '1000-5000';
  if (wordCount <= 4) return '100-1000';
  return '100-1000';
}

function estimateCompetition(keyword) {
  const highCompetitionWords = ['best', 'top', 'review', 'free', 'cheap'];
  const lower = keyword.toLowerCase();
  if (highCompetitionWords.some(w => lower.startsWith(w))) return 'medium';
  if (lower.includes('alternative') || lower.includes('vs ')) return 'low';
  return 'medium';
}

function extractNiche(keyword) {
  const words = keyword.toLowerCase().split(' ');
  const stopWords = new Set(['best', 'top', 'free', 'cheap', 'tool', 'app', 'software', 'for', 'to', 'the', 'a', 'an', 'how', 'way', 'alternative']);
  return words.filter(w => !stopWords.has(w)).slice(0, 3).join(' ') || keyword.split(' ').slice(-2).join(' ');
}

run().catch(err => {
  console.error('[keyword-research] Fatal error:', err);
  process.exit(1);
});

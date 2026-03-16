'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getDb, startRun, endRun } = require('./db');
const settings = require('../config/settings.json');
const fs = require('fs');
const path = require('path');

function isModuleEnabled() {
  if (!settings.modules.idea_scorer) {
    console.log('[idea-scorer] Module disabled in settings.json. Skipping.');
    return false;
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[idea-scorer] GEMINI_API_KEY not set. Skipping.');
    return false;
  }
  return true;
}

function loadPrompt() {
  const promptPath = path.join(__dirname, '..', 'prompts', 'idea-analyzer.md');
  return fs.readFileSync(promptPath, 'utf8');
}

async function analyzeBatch(genAI, posts, promptTemplate) {
  const model = genAI.getGenerativeModel({ model: settings.ai.default_model });

  const batchData = posts.map(p => ({
    id: p.id,
    title: p.title,
    body: (p.selftext || p.title || '').slice(0, 1000),
    source: p.source || 'reddit',
    subreddit: p.subreddit || '',
  }));

  const prompt = `${promptTemplate}\n\n## Current Batch\n\`\`\`json\n${JSON.stringify(batchData, null, 2)}\n\`\`\`\n\nReturn only a valid JSON array, no markdown fences.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON array in response');
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (err) {
    console.error('[idea-scorer] AI analysis failed:', err.message);
    return [];
  }
}

async function run() {
  if (!isModuleEnabled()) return;

  const runId = startRun('idea-scorer');
  const db = getDb();
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const promptTemplate = loadPrompt();

  const unanalyzedReddit = db.prepare(`
    SELECT id, title, selftext, subreddit, 'reddit' as source
    FROM reddit_posts
    WHERE analyzed_at IS NULL
    LIMIT 200
  `).all();

  const unanalyzedHN = db.prepare(`
    SELECT id, title, '' as selftext, '' as subreddit, 'hn' as source
    FROM hn_posts
    WHERE analyzed_at IS NULL
    LIMIT 200
  `).all();

  const allPosts = [...unanalyzedReddit, ...unanalyzedHN];
  console.log(`[idea-scorer] ${allPosts.length} posts to analyze.`);

  if (allPosts.length === 0) {
    endRun(runId, 'success', 0, 'No unanalyzed posts.', null);
    return;
  }

  const batchSize = settings.ai.batch_size || 20;
  const updateReddit = db.prepare(`
    UPDATE reddit_posts
    SET pain_point = ?, solvable = ?, payable = ?, confidence = ?, niche = ?, analyzed_at = strftime('%s','now')
    WHERE id = ?
  `);
  const updateHN = db.prepare(`
    UPDATE hn_posts
    SET pain_point = ?, solvable = ?, payable = ?, confidence = ?, niche = ?, analyzed_at = strftime('%s','now')
    WHERE id = ?
  `);
  const upsertIdea = db.prepare(`
    INSERT INTO ideas (title, description, target_user, solution, niche, confidence, source_count, sources, status)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, 'new')
    ON CONFLICT(niche) DO UPDATE SET
      confidence = MAX(confidence, excluded.confidence),
      updated_at = strftime('%s','now')
  `);

  let totalProcessed = 0;
  const errors = [];

  for (let i = 0; i < allPosts.length; i += batchSize) {
    const batch = allPosts.slice(i, i + batchSize);
    console.log(`[idea-scorer] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allPosts.length / batchSize)}`);

    const results = await analyzeBatch(genAI, batch, promptTemplate);

    const applyResults = db.transaction(results => {
      for (const r of results) {
        const update = batch.find(p => p.id === r.id);
        if (!update) continue;

        if (update.source === 'reddit') {
          updateReddit.run(r.pain_point ? 1 : 0, r.solvable ? 1 : 0, r.payable ? 1 : 0, r.confidence / 100, r.niche || null, r.id);
        } else {
          updateHN.run(r.pain_point ? 1 : 0, r.solvable ? 1 : 0, r.payable ? 1 : 0, r.confidence / 100, r.niche || null, r.id);
        }

        if (r.pain_point && r.solvable && r.payable && r.confidence >= (settings.ai.confidence_threshold || 60)) {
          upsertIdea.run(
            r.niche || 'Unknown',
            r.problem_summary || '',
            r.target_user || '',
            r.solution_hint || '',
            r.niche || 'unknown',
            r.confidence / 100,
            JSON.stringify([update.source])
          );
        }
      }
    });

    try {
      applyResults(results);
      totalProcessed += batch.length;
    } catch (err) {
      errors.push(err.message);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  const summary = `Analyzed ${totalProcessed} posts from ${allPosts.length} total.`;
  console.log(`[idea-scorer] Done. ${summary}`);
  endRun(runId, errors.length > 0 ? 'partial' : 'success', totalProcessed, summary, errors.join('\n') || null);
}

run().catch(err => {
  console.error('[idea-scorer] Fatal error:', err);
  process.exit(1);
});

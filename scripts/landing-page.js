'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getDb, startRun, endRun } = require('./db');
const settings = require('../config/settings.json');
const fs = require('fs');
const path = require('path');

function isModuleEnabled() {
  if (!settings.modules.landing_page_builder) {
    console.log('[landing-page] Module disabled in settings.json. Skipping.');
    return false;
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[landing-page] GEMINI_API_KEY not set. Skipping.');
    return false;
  }
  return true;
}

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 50);
}

function loadPrompt() {
  return fs.readFileSync(path.join(__dirname, '..', 'prompts', 'landing-page-writer.md'), 'utf8');
}

async function generateCopy(genAI, idea, promptTemplate) {
  const model = genAI.getGenerativeModel({ model: settings.ai.complex_model });

  const db = getDb();
  const topPosts = db.prepare(`
    SELECT title FROM reddit_posts
    WHERE niche = ? AND pain_point = 1
    ORDER BY confidence DESC LIMIT 3
  `).all(idea.niche);

  const input = {
    idea: {
      niche: idea.niche,
      problem_summary: idea.description || `People struggle with ${idea.niche}`,
      target_user: idea.target_user || 'small business owners',
      solution_hint: idea.solution || `Automated ${idea.niche} solution`,
      top_pain_points: topPosts.map(p => p.title).slice(0, 3),
    },
    pricing: {
      price: '$29/month',
      trial_days: settings.landing_page.trial_days || 7,
      competitor_context: '',
    },
  };

  const prompt = `${promptTemplate}\n\n## Idea to Write For\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\`\n\nReturn only a valid JSON object, no markdown fences.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON in response');
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (err) {
    console.error('[landing-page] Copy generation failed:', err.message);
    return null;
  }
}

function buildHtml(copy, slug, formspreeId) {
  const formAction = formspreeId
    ? `https://formspree.io/f/${formspreeId}`
    : '#';

  const bulletsHtml = (copy.bullets || [])
    .map(b => `<li>✓ ${b}</li>`)
    .join('\n          ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${copy.page_title || copy.headline}</title>
  <meta name="description" content="${copy.meta_description || ''}" />
  <link rel="stylesheet" href="style.css" />
</head>
<body>
  <main>
    <section class="hero">
      <h1>${copy.headline}</h1>
      <p class="subheadline">${copy.subheadline || ''}</p>

      <ul class="benefits">
          ${bulletsHtml}
      </ul>

      <form class="signup-form" action="${formAction}" method="POST">
        <input type="email" name="email" placeholder="your@email.com" required autocomplete="email" />
        <button type="submit">${copy.cta_primary || 'Get early access'}</button>
      </form>

      <p class="price">${copy.price_line || ''}</p>
      ${copy.social_proof ? `<p class="social-proof">${copy.social_proof}</p>` : ''}
    </section>
  </main>
</body>
</html>`;
}

function buildCss() {
  return `*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #fff;
  color: #111;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem 1rem;
}

main {
  max-width: 600px;
  width: 100%;
}

.hero {
  text-align: center;
}

h1 {
  font-size: clamp(1.8rem, 5vw, 2.8rem);
  font-weight: 800;
  line-height: 1.15;
  margin-bottom: 1rem;
}

.subheadline {
  font-size: 1.15rem;
  color: #444;
  margin-bottom: 2rem;
  line-height: 1.6;
}

.benefits {
  list-style: none;
  text-align: left;
  display: inline-block;
  margin-bottom: 2.5rem;
}

.benefits li {
  font-size: 1rem;
  padding: 0.35rem 0;
  color: #222;
}

.signup-form {
  display: flex;
  gap: 0.5rem;
  max-width: 480px;
  margin: 0 auto 1.5rem;
  flex-wrap: wrap;
}

.signup-form input[type="email"] {
  flex: 1;
  min-width: 200px;
  padding: 0.85rem 1rem;
  font-size: 1rem;
  border: 2px solid #ddd;
  border-radius: 6px;
  outline: none;
}

.signup-form input[type="email"]:focus {
  border-color: #000;
}

.signup-form button {
  padding: 0.85rem 1.5rem;
  font-size: 1rem;
  font-weight: 700;
  background: #000;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  white-space: nowrap;
}

.signup-form button:hover {
  background: #333;
}

.price {
  font-size: 0.9rem;
  color: #666;
  margin-bottom: 0.75rem;
}

.social-proof {
  font-size: 0.85rem;
  color: #888;
}

@media (max-width: 480px) {
  .signup-form {
    flex-direction: column;
  }
  .signup-form button {
    width: 100%;
  }
}`;
}

async function run() {
  if (!isModuleEnabled()) return;

  const runId = startRun('landing-page');
  const db = getDb();
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const promptTemplate = loadPrompt();

  const targetNiche = process.env.LANDING_PAGE_NICHE;

  let idea;
  if (targetNiche) {
    idea = db.prepare('SELECT * FROM ideas WHERE niche = ?').get(targetNiche);
  } else {
    idea = db.prepare(`
      SELECT * FROM ideas
      WHERE status = 'validated'
      AND niche NOT IN (
        SELECT niche FROM ideas WHERE status = 'building' OR status = 'launched'
      )
      ORDER BY confidence DESC LIMIT 1
    `).get();
  }

  if (!idea) {
    console.log('[landing-page] No validated ideas found. Run convergence-scorer first.');
    endRun(runId, 'success', 0, 'No validated ideas.', null);
    return;
  }

  console.log(`[landing-page] Generating landing page for: ${idea.niche}`);

  const copy = await generateCopy(genAI, idea, promptTemplate);
  if (!copy) {
    endRun(runId, 'failed', 0, 'Copy generation failed.', 'AI returned no content');
    return;
  }

  const slug = slugify(idea.niche);
  const outputDir = path.join(__dirname, '..', 'landing-pages', slug);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const formspreeId = process.env.FORMSPREE_FORM_ID || '';
  const html = buildHtml(copy, slug, formspreeId);
  const css = buildCss();

  fs.writeFileSync(path.join(outputDir, 'index.html'), html);
  fs.writeFileSync(path.join(outputDir, 'style.css'), css);

  db.prepare(`
    UPDATE ideas SET status = 'building', updated_at = strftime('%s','now') WHERE niche = ?
  `).run(idea.niche);

  const summary = `Landing page generated: landing-pages/${slug}/index.html`;
  console.log(`[landing-page] Done. ${summary}`);
  endRun(runId, 'success', 1, summary, null);
}

run().catch(err => {
  console.error('[landing-page] Fatal error:', err);
  process.exit(1);
});

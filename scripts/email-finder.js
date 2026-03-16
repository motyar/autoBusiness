'use strict';

const { getDb, startRun, endRun } = require('./db');
const settings = require('../config/settings.json');

function isModuleEnabled() {
  if (!settings.modules.email_finder) {
    console.log('[email-finder] Module disabled in settings.json. Skipping.');
    return false;
  }
  const hasHunter = !!process.env.HUNTER_API_KEY;
  const hasApollo = !!process.env.APOLLO_API_KEY;
  if (!hasHunter && !hasApollo) {
    console.warn('[email-finder] No API keys set (HUNTER_API_KEY or APOLLO_API_KEY). Skipping.');
    return false;
  }
  return true;
}

async function hunterDomainSearch(domain) {
  const { default: fetch } = await import('node-fetch');
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&api_key=${process.env.HUNTER_API_KEY}&limit=10`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return (data.data?.emails || []).filter(e => e.value && e.type === 'personal');
  } catch (err) {
    console.warn(`[email-finder] Hunter domain search failed for ${domain}: ${err.message}`);
    return [];
  }
}

async function apolloPersonSearch(firstName, lastName, domain) {
  const { default: fetch } = await import('node-fetch');
  try {
    const res = await fetch('https://api.apollo.io/v1/people/match', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
        'X-Api-Key': process.env.APOLLO_API_KEY,
      },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, domain }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.person?.email || null;
  } catch (err) {
    console.warn(`[email-finder] Apollo search failed: ${err.message}`);
    return null;
  }
}

function isRoleEmail(email) {
  const rolePatterns = ['admin@', 'info@', 'support@', 'noreply@', 'hello@', 'contact@', 'team@', 'sales@', 'marketing@'];
  return rolePatterns.some(p => email.toLowerCase().startsWith(p));
}

function hasMxRecord(domain) {
  const dns = require('dns');
  return new Promise(resolve => {
    dns.resolveMx(domain, (err, addresses) => {
      resolve(!err && addresses && addresses.length > 0);
    });
  });
}

async function run() {
  if (!isModuleEnabled()) return;

  const runId = startRun('email-finder');
  const db = getDb();
  const cfg = settings.email_finder;

  const validatedIdeas = db.prepare(`
    SELECT niche FROM ideas
    WHERE status = 'validated'
    ORDER BY confidence DESC
    LIMIT 3
  `).all();

  if (validatedIdeas.length === 0) {
    console.log('[email-finder] No validated ideas to find leads for.');
    endRun(runId, 'success', 0, 'No validated ideas.', null);
    return;
  }

  const insertLead = db.prepare(`
    INSERT OR IGNORE INTO leads (name, email, company, source, niche, status)
    VALUES (?, ?, ?, ?, ?, 'new')
  `);

  let totalInserted = 0;
  const errors = [];

  for (const idea of validatedIdeas) {
    const niche = idea.niche;
    console.log(`[email-finder] Finding leads for niche: ${niche}`);

    const redditLeads = db.prepare(`
      SELECT DISTINCT subreddit FROM reddit_posts
      WHERE niche = ? AND confidence >= 0.7
      LIMIT 5
    `).all(niche);

    if (process.env.HUNTER_API_KEY && redditLeads.length > 0) {
      const sampleDomains = [`${niche.replace(/\s+/g, '')}.com`];

      for (const domain of sampleDomains) {
        const hasMx = await hasMxRecord(domain);
        if (!hasMx) continue;

        const emails = await hunterDomainSearch(domain);
        const insertMany = db.transaction(emails => {
          let count = 0;
          for (const e of emails) {
            if (isRoleEmail(e.value)) continue;
            const result = insertLead.run(
              `${e.first_name || ''} ${e.last_name || ''}`.trim() || 'Unknown',
              e.value,
              domain,
              'hunter',
              niche
            );
            if (result.changes > 0) count++;
          }
          return count;
        });
        const count = insertMany(emails);
        totalInserted += count;
        console.log(`[email-finder] Hunter: ${domain} → ${count} new leads`);

        if (totalInserted >= cfg.max_leads_per_run) break;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (totalInserted >= cfg.max_leads_per_run) break;
  }

  const summary = `Found ${totalInserted} new leads across ${validatedIdeas.length} niches.`;
  console.log(`[email-finder] Done. ${summary}`);
  endRun(runId, errors.length > 0 ? 'partial' : 'success', totalInserted, summary, errors.join('\n') || null);
}

run().catch(err => {
  console.error('[email-finder] Fatal error:', err);
  process.exit(1);
});

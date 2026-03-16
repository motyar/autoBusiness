'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getDb, startRun, endRun } = require('./db');
const settings = require('../config/settings.json');
const fs = require('fs');
const path = require('path');

function isModuleEnabled() {
  if (!settings.modules.social_poster) {
    console.log('[social-poster] Module disabled in settings.json. Skipping.');
    return false;
  }
  const twitterEnabled = settings.social.twitter.enabled && process.env.TWITTER_API_KEY;
  const redditEnabled = settings.social.reddit.enabled;
  const linkedinEnabled = settings.social.linkedin.enabled && process.env.LINKEDIN_CLIENT_ID;

  if (!twitterEnabled && !redditEnabled && !linkedinEnabled) {
    console.log('[social-poster] No social channels enabled or configured. Skipping.');
    return false;
  }
  return true;
}

function loadPrompt() {
  return fs.readFileSync(path.join(__dirname, '..', 'prompts', 'content-writer.md'), 'utf8');
}

function getMetrics(db) {
  const ideas = db.prepare('SELECT COUNT(*) as count FROM ideas WHERE created_at >= strftime(\'%s\', date(\'now\', \'-7 days\'))').get();
  const sends = db.prepare('SELECT COUNT(*) as count FROM email_sends WHERE sent_at >= strftime(\'%s\', date(\'now\', \'-7 days\'))').get();
  const signups = db.prepare('SELECT COUNT(*) as count FROM leads WHERE status IN (\'replied\', \'converted\')').get();
  const topIdea = db.prepare('SELECT niche FROM ideas ORDER BY confidence DESC LIMIT 1').get();

  return {
    ideas_analyzed_this_week: ideas.count,
    emails_sent: sends.count,
    email_open_rate_pct: 30,
    signups: signups.count,
    day_number: Math.floor(Date.now() / 86400000),
    top_niche: topIdea?.niche || 'unknown',
  };
}

async function generateContent(genAI, metrics, topIdea, promptTemplate) {
  const model = genAI.getGenerativeModel({ model: settings.ai.default_model });

  const input = {
    product: {
      name: topIdea?.niche || 'your product',
      niche: topIdea?.niche || 'productivity',
      problem: topIdea?.description || 'solving a recurring problem',
      landing_page: process.env.LANDING_PAGE_URL || 'https://example.com',
    },
    metrics,
    top_pain_points: [],
  };

  const prompt = `${promptTemplate}\n\n## Current Data\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\`\n\nReturn only a valid JSON object, no markdown fences.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON in response');
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (err) {
    console.error('[social-poster] Content generation failed:', err.message);
    return null;
  }
}

async function postToTwitter(text) {
  const { default: fetch } = await import('node-fetch');
  const { createHmac, createHash } = require('crypto');

  const consumerKey = process.env.TWITTER_API_KEY;
  const consumerSecret = process.env.TWITTER_API_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!consumerKey || !consumerSecret || !accessToken || !accessTokenSecret) {
    console.warn('[social-poster] Twitter credentials incomplete. Skipping tweet.');
    return false;
  }

  const url = 'https://api.twitter.com/2/tweets';
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = createHash('sha256').update(Math.random().toString()).digest('hex').slice(0, 32);

  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: nonce,
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: timestamp,
    oauth_token: accessToken,
    oauth_version: '1.0',
  };

  const paramString = Object.keys(oauthParams).sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(oauthParams[k])}`).join('&');

  const baseString = `POST&${encodeURIComponent(url)}&${encodeURIComponent(paramString)}`;
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(accessTokenSecret)}`;
  const signature = createHmac('sha1', signingKey).update(baseString).digest('base64');

  const authHeader = 'OAuth ' + Object.keys(oauthParams).map(k =>
    `${encodeURIComponent(k)}="${encodeURIComponent(oauthParams[k])}"`
  ).concat([`oauth_signature="${encodeURIComponent(signature)}"`]).join(', ');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`HTTP ${res.status}: ${body}`);
    }
    return true;
  } catch (err) {
    console.error('[social-poster] Twitter post failed:', err.message);
    return false;
  }
}

async function run() {
  if (!isModuleEnabled()) return;

  if (!process.env.GEMINI_API_KEY) {
    console.warn('[social-poster] GEMINI_API_KEY not set. Skipping.');
    return;
  }

  const runId = startRun('social-poster');
  const db = getDb();
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const promptTemplate = loadPrompt();

  const metrics = getMetrics(db);
  const topIdea = db.prepare('SELECT * FROM ideas ORDER BY confidence DESC LIMIT 1').get();

  console.log('[social-poster] Generating content...');
  const content = await generateContent(genAI, metrics, topIdea, promptTemplate);

  if (!content) {
    endRun(runId, 'failed', 0, 'Content generation failed.', 'AI returned no content');
    return;
  }

  let posted = 0;
  const errors = [];

  if (settings.social.twitter.enabled && process.env.TWITTER_API_KEY && content.twitter) {
    const todayPost = content.twitter[0];
    if (todayPost) {
      console.log('[social-poster] Posting to Twitter...');
      const ok = await postToTwitter(todayPost.text);
      if (ok) {
        posted++;
        console.log('[social-poster] Twitter post published.');
      } else {
        errors.push('Twitter post failed');
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const summary = `Posted ${posted} social updates. Content generated for ${Object.keys(content).join(', ')}.`;
  console.log(`[social-poster] Done. ${summary}`);
  endRun(runId, errors.length > 0 ? 'partial' : 'success', posted, summary, errors.join('\n') || null);
}

run().catch(err => {
  console.error('[social-poster] Fatal error:', err);
  process.exit(1);
});

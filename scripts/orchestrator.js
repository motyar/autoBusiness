'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const settings = require('../config/settings.json');
const tasks = require('../config/tasks.json');

const SCRIPTS_DIR = path.join(__dirname);

function log(msg) {
  console.log(`[orchestrator] ${msg}`);
}

function run(scriptName) {
  const scriptPath = path.join(SCRIPTS_DIR, `${scriptName}.js`);
  if (!fs.existsSync(scriptPath)) {
    log(`Script not found: ${scriptName}.js`);
    return false;
  }
  log(`Running: ${scriptName}`);
  try {
    execSync(`node "${scriptPath}"`, {
      stdio: 'inherit',
      env: process.env,
      timeout: 10 * 60 * 1000,
    });
    log(`Completed: ${scriptName}`);
    return true;
  } catch (err) {
    log(`Failed: ${scriptName} — ${err.message}`);
    return false;
  }
}

function getArg(flag) {
  const idx = process.argv.indexOf(flag);
  return idx !== -1 ? process.argv[idx + 1] : null;
}

async function main() {
  const module = getArg('--module');

  if (module) {
    log(`Running single module: ${module}`);
    run(module);
    return;
  }

  const mode = process.env.ORCHESTRATOR_MODE || 'daily';
  log(`Running in mode: ${mode}`);

  if (mode === 'daily' || mode === 'scrape') {
    if (settings.modules.reddit_scraper) run('reddit-scraper');
    if (settings.modules.hn_scraper) run('hn-scraper');
    if (settings.modules.idea_scorer) run('idea-scorer');
    if (settings.modules.convergence_scorer) run('convergence-scorer');
    if (settings.modules.social_poster) run('social-poster');
    run('summary');
  }

  if (mode === 'weekly' || mode === 'keywords') {
    if (settings.modules.keyword_research) run('keyword-research');
    if (settings.modules.trend_checker) run('trend-checker');
    if (settings.modules.convergence_scorer) run('convergence-scorer');
    run('summary');
  }

  if (mode === 'email') {
    if (settings.modules.email_finder) run('email-finder');
    if (settings.modules.email_sender) run('emailer');
    run('summary');
  }

  if (mode === 'landing-page') {
    if (settings.modules.landing_page_builder) run('landing-page');
    run('summary');
  }

  if (mode === 'summary') {
    run('summary');
  }

  log('All done.');
}

main().catch(err => {
  console.error('[orchestrator] Fatal error:', err);
  process.exit(1);
});

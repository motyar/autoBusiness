# autoBusiness — Full System Plan

## Overview

autoBusiness is a fully automated market research, idea validation, landing page generation, and distribution system that runs entirely on GitHub Actions. No server, no VPS, no dashboard — GitHub is the control panel. Markdown files are the configuration language. Gemini Flash is the brain.

**Goal:** Automate the complete path from "raw market signals" → "validated idea" → "landing page" → "distributed to leads" → "email outreach tracked."

---

## System Architecture

```
GitHub Actions (Scheduler)
        │
        ▼
orchestrator.js  ←── agent.md (identity + rules)
        │            └── skills/*.md (how-to instructions)
        │
        ├── reddit-scraper.js    → SQLite: reddit_posts
        ├── keyword-research.js  → SQLite: keywords
        ├── trend-checker.js     → SQLite: trends
        ├── hn-scraper.js        → SQLite: hn_posts
        ├── idea-scorer.js       → SQLite: ideas (Gemini API)
        ├── convergence-scorer.js→ SQLite: ideas (multi-source join)
        ├── email-finder.js      → SQLite: leads (Hunter.io / Apollo.io)
        ├── emailer.js           → SQLite: email_sends (Resend)
        ├── social-poster.js     → Twitter/LinkedIn (optional)
        ├── landing-page.js      → /landing-pages/*.html (Gemini API)
        └── summary.js           → data/summary.md
```

**All API keys stored as GitHub Secrets. All modules independently enable/disable-able via `config/settings.json`.**

---

## Folder Structure

```
/
├── agent.md                    # Agent identity, tone, decision rules
├── plan.md                     # This file
├── chat.md                     # Source conversation
├── README.md                   # Usage and setup guide
├── package.json                # Node.js dependencies
├── .gitignore
│
├── config/
│   ├── settings.json           # Module on/off + parameters
│   └── tasks.json              # Task queue (what to run next)
│
├── skills/                     # Skill definitions (inputs, outputs, logic)
│   ├── reddit-scraper.md
│   ├── autocomplete.md
│   ├── trend-checker.md
│   ├── hn-scraper.md
│   ├── convergence-scorer.md
│   ├── email-finder.md
│   ├── cold-email.md
│   ├── social-poster.md
│   └── landing-page-builder.md
│
├── prompts/                    # Gemini prompt templates
│   ├── idea-analyzer.md
│   ├── email-writer.md
│   ├── content-writer.md
│   └── landing-page-writer.md
│
├── scripts/                    # Executable Node.js scripts
│   ├── db.js                   # Database init + utilities
│   ├── orchestrator.js         # Main brain
│   ├── reddit-scraper.js
│   ├── keyword-research.js
│   ├── trend-checker.js
│   ├── hn-scraper.js
│   ├── idea-scorer.js
│   ├── convergence-scorer.js
│   ├── email-finder.js
│   ├── emailer.js
│   ├── social-poster.js
│   ├── landing-page.js
│   └── summary.js
│
├── data/                       # Runtime data (SQLite, generated files)
│   └── .gitkeep
│
├── landing-pages/              # Generated landing pages
│   └── .gitkeep
│
└── .github/
    └── workflows/
        ├── daily-scrape.yml        # Daily: Reddit + HN scraping + scoring
        ├── weekly-keywords.yml     # Weekly: keyword research + trends
        ├── email-sender.yml        # Tue–Thu: cold email
        ├── daily-summary.yml       # Daily: digest → data/summary.md
        └── manual-trigger.yml      # Manual: run any module on demand
```

---

## Module Details

### 1. Reddit Scraper

**Purpose:** Find real pain points from communities discussing problems.

**Sources:**
- `reddit.com/r/SUBREDDIT/search.json?q=QUERY&sort=new&limit=25`
- No authentication required

**Target subreddits:** `entrepreneur`, `SaaS`, `startups`, `indiehackers`, `smallbusiness`, `Entrepreneur`, `webdev`, `digitalnomad`

**Signal queries:**
- `"wish there was"`
- `"alternative to"`
- `"paying for"`
- `"anyone know a tool"`
- `"is there a way to"`
- `"why is there no"`
- `"I hate that"`

**Filters:** score ≥ 5, age ≤ 180 days

**Data stored:** `id`, `subreddit`, `title`, `selftext`, `score`, `num_comments`, `created_utc`, `permalink`, `niche`

**AI analysis (Gemini Flash):**
- Is this a real, specific pain point? (yes/no)
- Could a solo dev solve it in a weekend? (yes/no)
- Would someone pay monthly for it? (yes/no)
- Confidence score 0–1
- Normalized niche tag (e.g., "invoicing", "scheduling")

---

### 2. Keyword Research

**Purpose:** Validate that people are actively searching for solutions.

**Sources:**
- Google Autocomplete: `https://suggestqueries.google.com/complete/search?client=firefox&q=QUERY` — no auth
- Alphabet soup: append a–z to seed phrases to get hundreds of long-tails
- Google Keyword Planner (manual export, store in DB)

**Seed phrases:** `"best tool for"`, `"alternative to"`, `"free app for"`, `"how to automate"`, `"cheapest way to"` + niche words

**Scoring logic:**
- Volume 100–1,000 → +1 pt
- Volume 1,001–5,000 → +2 pts
- Competition low → +2 pts, medium → +1 pt, high → +0 pts
- If top Google results are Reddit/Quora/thin blogs (manual check) → +3 pts
- Sweet spot: 200–2,000 volume, garbage results currently ranking

**Data stored:** `keyword`, `volume_range`, `competition_level`, `source`, `opportunity_score`, `date_found`, `niche`

---

### 3. Trend Checker

**Purpose:** Confirm demand is rising, not flat or declining.

**Sources:**
- Google Trends (unofficial): `pytrends` Python library or scrape `trends.google.com`
- Google Alerts RSS feeds
- GitHub Trending API (unofficial): `github.com/trending` scraping

**Logic:**
- Rising trajectory (12-month view) → signal
- Flat → neutral
- Declining → skip

**Data stored:** `keyword`, `source`, `value`, `direction`, `date_checked`, `niche`

---

### 4. HackerNews Scraper

**Purpose:** Find developer/founder discussions about problems and tools.

**Source:** `https://hn.algolia.com/api/v1/search?query=QUERY&tags=story`

**Queries:** `"Show HN"`, `"Ask HN: is there a tool"`, `"Ask HN: why is there no"` + niche terms

**Filters:** `points ≥ 5`, check comment sentiment for validation/rejection signals

**Data stored:** same signal structure as reddit_posts, tagged by source

---

### 5. Idea Scorer (AI)

**Purpose:** AI quality gate — only ideas that pass get promoted.

**Input:** Aggregated pain points from Reddit, HN, and keyword signals

**Prompt:** See `prompts/idea-analyzer.md`

**Output per idea:**
- Title (short)
- Problem description (1 sentence)
- Target user (1 sentence)
- Suggested solution (1 sentence)
- Confidence score 0–100
- Niche tag

**Model:** Gemini 1.5 Flash (cheap, fast)
**Batching:** Send 20 items per prompt to minimize API calls

---

### 6. Convergence Scorer

**Purpose:** Identify ideas validated by 3+ independent data sources.

**Logic:**
```sql
SELECT niche, COUNT(DISTINCT source) as source_count
FROM all_signals
GROUP BY niche
HAVING source_count >= 3
ORDER BY source_count DESC, avg_confidence DESC
```

**Output:** Shortlist of ideas with multi-source validation, written to `data/shortlist.json`

**When all four align:**
- Reddit says people complain about X
- Autocomplete confirms people search for X
- Google Trends shows X is rising
- Competitors for X are weak

→ That's the build target.

---

### 7. Landing Page Builder

**Purpose:** Validate demand before building — cheapest experiment possible.

**Input:** Top idea from shortlist

**Template:**
- Headline: states the problem
- 3 bullet points: what it solves
- Email capture form
- Price anchor (40–60% of cheapest competitor)
- No logo, no about page

**Generation:** Gemini Pro writes the copy, Node script wraps in HTML template

**Hosting:** Push to `landing-pages/` folder, deploy via GitHub Pages or Vercel free tier

**Success metric:** 10%+ email signup rate from cold traffic = idea validated

---

### 8. Email Finder

**Purpose:** Find emails of warm leads (people already feeling the pain).

**Sources:**
- Hunter.io API (25 free lookups/month) — `HUNTER_API_KEY` secret
- Apollo.io API (50 free emails/month) — `APOLLO_API_KEY` secret
- Pattern guessing: `firstname@company.com` from verified samples
- Email verification: check MX records before sending

**Target profile:**
- Solo founders / small team leads (fast decision makers)
- One-star reviewers of competitor products
- People who asked related questions on Reddit/HN
- Twitter bios mentioning the pain point niche

**Data stored:** `name`, `email`, `source`, `niche`, `status`

---

### 9. Cold Email Sender

**Purpose:** Convert warm leads into signups/customers.

**Service:** Resend free tier (100 emails/day, no CC) — `RESEND_API_KEY` secret

**Send schedule:** Tuesday–Thursday, 9–10am recipient's timezone

**Email formula:**
1. Sentence 1: Show you know them and what they do
2. Sentence 2: State the outcome in their language (not yours)
3. Sentence 3: Ask if they want to see it

**Subject line:** ≤ 5 words, lowercase, personal ("saw your post about X")

**Daily limit:** 30 emails max (domain safety)

**Tracking:** Store `sent_at`, `opened_at` (via Resend webhook), `replied_at`

**Domain warm-up:** Required — 2 weeks minimum before using new domain

---

### 10. Social Poster

**Purpose:** Drive traffic to landing pages and build audience.

**Channels (all optional, enable via settings.json):**
- **Twitter/X:** 3–5 posts/day, build-in-public format, real metrics from DB
- **Reddit:** 10 relevant threads/day, genuine helpful replies mentioning product
- **LinkedIn:** Daily post about problem being solved, B2B angle

**Twitter post types:**
- "Day N building [product]: X users, Y signups, what I learned"
- Thread explaining the problem with solution
- Engaging with niche conversations

**API keys needed:**
- `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`
- `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` (optional)

---

### 11. Summary Generator

**Purpose:** Monitoring without a dashboard.

**Output:** `data/summary.md` — updated after every run

**Contents:**
- Date/time of last run
- Modules that ran
- Items scraped, analyzed, scored
- Top 5 ideas by convergence score
- Emails sent today / this week
- Errors or warnings
- Next scheduled run

---

## Database Schema (SQLite)

```sql
CREATE TABLE reddit_posts (
  id TEXT PRIMARY KEY,
  subreddit TEXT,
  title TEXT,
  selftext TEXT,
  score INTEGER,
  num_comments INTEGER,
  created_utc INTEGER,
  permalink TEXT,
  signal_score REAL DEFAULT 0,
  pain_point INTEGER DEFAULT 0,
  solvable INTEGER DEFAULT 0,
  payable INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0,
  niche TEXT,
  analyzed_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE hn_posts (
  id TEXT PRIMARY KEY,
  title TEXT,
  url TEXT,
  points INTEGER,
  num_comments INTEGER,
  created_at_ts INTEGER,
  author TEXT,
  niche TEXT,
  pain_point INTEGER DEFAULT 0,
  solvable INTEGER DEFAULT 0,
  payable INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0,
  analyzed_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE keywords (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT UNIQUE,
  volume_range TEXT,
  competition_level TEXT,
  source TEXT,
  opportunity_score REAL DEFAULT 0,
  date_found TEXT,
  niche TEXT
);

CREATE TABLE trends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  keyword TEXT,
  source TEXT,
  value REAL,
  direction TEXT,
  date_checked TEXT,
  niche TEXT
);

CREATE TABLE ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  description TEXT,
  target_user TEXT,
  solution TEXT,
  niche TEXT,
  source_count INTEGER DEFAULT 0,
  sources TEXT,
  confidence REAL DEFAULT 0,
  status TEXT DEFAULT 'new',
  created_at INTEGER DEFAULT (strftime('%s','now')),
  updated_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  company TEXT,
  source TEXT,
  niche TEXT,
  status TEXT DEFAULT 'new',
  sent_at INTEGER,
  opened_at INTEGER,
  replied_at INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE email_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER,
  subject TEXT,
  body TEXT,
  message_id TEXT,
  status TEXT DEFAULT 'pending',
  sent_at INTEGER,
  opened_at INTEGER,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE TABLE runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  script TEXT,
  status TEXT,
  items_processed INTEGER DEFAULT 0,
  errors TEXT,
  summary TEXT,
  started_at INTEGER,
  finished_at INTEGER
);
```

---

## Technology Stack

| Layer | Technology | Cost |
|-------|-----------|------|
| Scheduler | GitHub Actions | Free (2,000 min/mo) |
| Runtime | Node.js 20 | Free |
| Database | SQLite (better-sqlite3) | Free |
| AI | Gemini 1.5 Flash | ~$0.075/1M input tokens |
| Email sending | Resend free tier | Free (100/day) |
| Email finding | Hunter.io free tier | Free (25/mo) |
| Email finding | Apollo.io free tier | Free (50/mo) |
| Reddit data | Reddit JSON API | Free (no auth) |
| HN data | Algolia HN API | Free |
| Keywords | Google Autocomplete | Free (no auth) |
| Trends | Google Trends (pytrends) | Free |
| Landing pages | GitHub Pages / Vercel | Free |
| Social posting | Twitter API Basic | Free (limited) |

**Estimated monthly cost: $0–$5** (only Gemini API calls)

---

## GitHub Secrets Required

| Secret Name | Module | Required? |
|-------------|--------|-----------|
| `GEMINI_API_KEY` | Idea scoring, email writing, landing pages | Required |
| `RESEND_API_KEY` | Email sending | Optional |
| `HUNTER_API_KEY` | Email finding (Hunter.io) | Optional |
| `APOLLO_API_KEY` | Email finding (Apollo.io) | Optional |
| `TWITTER_API_KEY` | Social posting | Optional |
| `TWITTER_API_SECRET` | Social posting | Optional |
| `TWITTER_ACCESS_TOKEN` | Social posting | Optional |
| `TWITTER_ACCESS_TOKEN_SECRET` | Social posting | Optional |
| `LINKEDIN_CLIENT_ID` | LinkedIn posting | Optional |
| `LINKEDIN_CLIENT_SECRET` | LinkedIn posting | Optional |

**Only `GEMINI_API_KEY` is truly required. Everything else is optional and gracefully skipped if not present.**

---

## GitHub Actions Workflows

### `daily-scrape.yml`
- **Trigger:** Daily at 06:00 UTC + `workflow_dispatch`
- **Steps:** Reddit scraping → HN scraping → Idea scoring → Convergence scoring → Summary

### `weekly-keywords.yml`
- **Trigger:** Every Monday at 07:00 UTC + `workflow_dispatch`
- **Steps:** Keyword research → Trend checking → Convergence update → Summary

### `email-sender.yml`
- **Trigger:** Tuesday–Thursday at 14:00 UTC (9am ET) + `workflow_dispatch`
- **Steps:** Fetch unsent leads → Generate personalized emails → Send via Resend → Update DB

### `daily-summary.yml`
- **Trigger:** Daily at 23:00 UTC + `workflow_dispatch`
- **Steps:** Aggregate all data → Write `data/summary.md` → Commit to repo

### `manual-trigger.yml`
- **Trigger:** `workflow_dispatch` with module selector input
- **Steps:** Run selected module only

---

## Control Flow (How to Use)

1. **Configure:** Edit `config/settings.json` — set your subreddits, niche keywords, enable/disable modules
2. **Add secrets:** Go to GitHub Settings → Secrets → add `GEMINI_API_KEY` (required) and optional keys
3. **Enable workflows:** Go to GitHub Actions tab, enable each workflow
4. **Monitor:** Check `data/summary.md` after each run for results
5. **Review ideas:** Check `data/shortlist.json` for validated ideas
6. **Iterate:** Edit `agent.md` to change targeting, edit `config/settings.json` to adjust parameters

---

## Cost Optimization Rules

1. Use Gemini Flash for all classification tasks (scoring, tagging)
2. Use Gemini Pro only for generation tasks (email copy, landing page copy)
3. Batch API calls — send 20 items per prompt, never one at a time
4. Cache all results in SQLite — never re-analyze data you already processed
5. Hard daily spend cap: `max_daily_cost_usd` in settings.json
6. Rate limit all scrapers to avoid bans (1–2 sec delay between requests)

---

## Module Enable/Disable Design

Every script checks `config/settings.json` before running. If a module is disabled, the script exits cleanly with a log message. GitHub Actions steps use `continue-on-error: true` so one disabled module doesn't break the whole workflow.

Example check in every script:
```javascript
const settings = require('../config/settings.json');
if (!settings.modules.reddit_scraper) {
  console.log('[reddit-scraper] Module disabled in settings.json. Skipping.');
  process.exit(0);
}
```

---

## Week-One Realistic Expectations

| Channel | Metric | Week 1 Estimate |
|---------|--------|-----------------|
| Reddit posting | Views | 5,000–10,000 (if one post hits) |
| Twitter | Impressions | 2,000–5,000 (consistent posting) |
| Cold email | Recipients | ~150–200 (30/day × 5 days) |
| Cold email | Open rate | 30% → ~50 opens |
| Site visitors (all channels) | Unique visits | 200–400 |
| Email signups | Conversions | 5–15 |
| Paying customers | Revenue | 1–2 (if landing page is tight) |

**Week 4 compounds significantly.** Most people quit in week 1–2.

---

## Convergence Algorithm (The Core Signal)

An idea is promoted to the build shortlist only when **3 or more** independent sources confirm it:

```
Source 1 (Reddit)      → people complain about X
Source 2 (Keywords)    → people search for solutions to X
Source 3 (Trends)      → demand for X is rising (not flat/declining)
Source 4 (Competitors) → existing solutions to X are weak
```

This prevents acting on noise from a single subreddit thread.

---

## Landing Page Validation Protocol

1. Pick top idea from shortlist (highest convergence + confidence)
2. Generate landing page with `landing-page.js`
3. Deploy to GitHub Pages (auto via Actions)
4. Point Reddit + Twitter traffic at it
5. Wait for 50 unique visitors
6. If signup rate ≥ 10% → build the product
7. If signup rate < 10% → move to next idea, repeat

---

## Extending the System

- **New data source:** Add a new `skills/SOURCE.md` + `scripts/SOURCE.js` + workflow step
- **New AI capability:** Add a new `prompts/PROMPT.md` and call from relevant script
- **New distribution channel:** Add to `skills/social-poster.md`, add credentials to secrets, enable in `config/settings.json`
- **Change agent behavior:** Edit `agent.md` (identity/rules) without touching scripts
- **Change niche targeting:** Edit `config/settings.json` → `reddit.subreddits` and `keywords.seeds`

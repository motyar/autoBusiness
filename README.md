# autoBusiness

Automated market research, idea validation, landing page generation, and email outreach — running entirely on GitHub Actions. No server, no VPS, no dashboard.

> See [plan.md](plan.md) for the complete system design.

## What It Does

1. **Scrapes** Reddit and HackerNews for pain points and unmet needs
2. **Researches** long-tail keywords with Google Autocomplete
3. **Tracks** demand trends with Google Trends
4. **Scores** ideas with Gemini AI — filters out noise
5. **Converges** signals across 3+ sources to find validated opportunities
6. **Generates** minimal landing pages (HTML/CSS) to test demand
7. **Finds** warm leads (people who already feel the pain)
8. **Sends** personalized cold emails via Resend
9. **Posts** build-in-public content to Twitter/LinkedIn (optional)
10. **Reports** everything in `data/summary.md` after each run

## Quick Start

### 1. Add GitHub Secrets

Go to **Settings → Secrets → Actions** and add:

| Secret | Required | Description |
|--------|----------|-------------|
| `GEMINI_API_KEY` | **Required** | Google Gemini API key — get free at [aistudio.google.com](https://aistudio.google.com) |
| `RESEND_API_KEY` | Optional | For sending cold emails — free at [resend.com](https://resend.com) |
| `HUNTER_API_KEY` | Optional | For finding emails — free at [hunter.io](https://hunter.io) |
| `APOLLO_API_KEY` | Optional | For finding emails — free at [apollo.io](https://apollo.io) |
| `TWITTER_API_KEY` | Optional | Twitter API credentials |
| `TWITTER_API_SECRET` | Optional | Twitter API credentials |
| `TWITTER_ACCESS_TOKEN` | Optional | Twitter access token |
| `TWITTER_ACCESS_TOKEN_SECRET` | Optional | Twitter access token secret |
| `FORMSPREE_FORM_ID` | Optional | For landing page email forms — free at [formspree.io](https://formspree.io) |

### 2. Configure Your Niche

Edit [`config/settings.json`](config/settings.json):
- Set `reddit.subreddits` to communities in your target market
- Set `reddit.queries` to pain-point search phrases
- Set `niche.target` to your niche keyword (e.g., `"freelance invoicing"`)
- Enable/disable modules in `modules` block

### 3. Enable Workflows

Go to **Actions** tab → enable workflows:
- **Daily Scrape & Score** — runs every day at 6am UTC
- **Weekly Keyword Research** — runs every Monday at 7am UTC
- **Email Sender** — runs Tue/Wed/Thu at 2pm UTC (disabled by default)
- **Daily Summary** — runs every day at 11pm UTC

Or trigger any workflow manually via **Actions → Run workflow**.

### 4. Monitor

Check [`data/summary.md`](data/summary.md) after runs for:
- Ideas found and scored
- Top validated opportunities
- Email stats
- Errors and run history

## Control Without a Dashboard

Everything is controlled through files and git:

| Task | How |
|------|-----|
| Change targeting | Edit `config/settings.json`, push |
| Enable/disable a module | Edit `modules` block in `config/settings.json`, push |
| Add a new data source | Add `skills/source.md` + `scripts/source.js` |
| Change AI behavior | Edit `agent.md` |
| Change email copy rules | Edit `prompts/email-writer.md` |
| Trigger a run manually | GitHub Actions → Manual Trigger → select module |
| Generate a landing page | Manual Trigger → select `landing-page` → enter niche |

## Folder Structure

```
├── agent.md                    # Who the agent is and how it decides
├── plan.md                     # Complete system design
├── config/
│   ├── settings.json           # All settings — enable/disable modules here
│   └── tasks.json              # Task schedule config
├── skills/                     # Markdown instructions per capability
├── prompts/                    # AI prompt templates
├── scripts/                    # Node.js scripts (one per module)
├── data/                       # SQLite DB + generated outputs (gitignored)
├── landing-pages/              # Generated landing pages (committed)
└── .github/workflows/          # GitHub Actions
```

## Cost

| Item | Cost |
|------|------|
| GitHub Actions | Free (2,000 min/month) |
| Gemini 1.5 Flash | ~$0.01–0.50/day depending on volume |
| Resend email | Free (100/day) |
| Hunter.io | Free (25 lookups/month) |
| All scrapers | Free (no auth required) |
| **Total** | **~$0–15/month** |

## Module Dependency

```
reddit-scraper ──┐
hn-scraper       ├──► idea-scorer ──► convergence-scorer ──► landing-page
keyword-research ─┤
trend-checker   ──┘

convergence-scorer ──► email-finder ──► emailer

any module ──► summary
```

## Disabling a Module

In `config/settings.json`:
```json
{
  "modules": {
    "email_sender": false,
    "social_poster": false
  }
}
```

The module will exit cleanly with a log message. It won't affect other modules.

## License

MIT

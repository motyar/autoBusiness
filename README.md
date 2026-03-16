# autoBusiness — Research Pipeline

Automated market research running entirely on **GitHub Actions**. No server, no VPS, no dashboard.

Every day it scrapes HackerNews and Reddit for pain points, discovers long-tail keywords via Google Autocomplete, and stores everything in timestamped output files committed back to this repository.

---

## What It Does

1. **Scrapes** HackerNews for trending topics and pain points
2. **Scrapes** Reddit communities for unmet needs and frustrations
3. **Researches** long-tail keywords with Google Autocomplete (alphabet-soup expansion)
4. **Exports** all results to `output/YYYY-MM-DD_HH-MM/` — JSON, CSV, and a Markdown summary

> Only one API key is required: **GEMINI_API_KEY** (already configured in repository secrets).

---

## Prerequisites

- **Node.js ≥ 20** — [nodejs.org](https://nodejs.org)
- **GEMINI_API_KEY** — free at [aistudio.google.com](https://aistudio.google.com)

---

## Running Locally

### 1. Clone and install

```bash
git clone https://github.com/your-username/autoBusiness.git
cd autoBusiness
npm install
```

### 2. Set your API key

```bash
export GEMINI_API_KEY="your-key-here"
```

### 3. Run the research pipeline

```bash
# Full research pipeline (scrape + keywords + export)
npm run research

# Individual steps
npm run hn        # HackerNews scraper only
npm run scrape    # Reddit scraper only
npm run keywords  # Keyword research only
npm run export    # Export results to output/ folder

# Override niche and seeds via env vars
RESEARCH_NICHE="freelance invoicing" \
RESEARCH_SEEDS="best tool for,alternative to" \
npm run research
```

### 4. View results

```bash
# Results are written to output/YYYY-MM-DD_HH-MM/
ls output/
cat output/$(ls output/ | tail -1)/summary.md
```

---

## Running on GitHub Actions

### 1. Fork or use this repository

Go to **Settings → Actions → General** and ensure workflows are allowed to run.

### 2. Add GitHub Secrets

Go to **Settings → Secrets and variables → Actions** and add:

| Secret | Required | Description |
|--------|----------|-------------|
| `GEMINI_API_KEY` | **Required** | Google Gemini API key — free at [aistudio.google.com](https://aistudio.google.com) |

### 3. Configure your niche (optional)

Edit [`config/settings.json`](config/settings.json):

```json
{
  "niche": {
    "target": "freelance invoicing"
  },
  "keywords": {
    "seeds": ["best tool for", "alternative to", "free app for"]
  },
  "reddit": {
    "subreddits": ["entrepreneur", "SaaS", "freelance"]
  }
}
```

### 4. The Research Pipeline workflow

There is a single workflow: **Research Pipeline** (`.github/workflows/research.yml`).

| Trigger | Schedule |
|---------|---------|
| Automatic | Daily at 6 am UTC |
| Manual | **Actions → Research Pipeline → Run workflow** |

**Manual trigger inputs:**

| Input | Description | Default |
|-------|-------------|---------|
| `niche` | Target niche keyword (e.g. `"freelance invoicing"`) | _(uses settings.json)_ |
| `seeds` | Comma-separated keyword seeds | _(uses settings.json)_ |
| `run_hn` | Run HackerNews scraper | `true` |
| `run_reddit` | Run Reddit scraper | `true` |
| `run_keywords` | Run keyword research | `true` |

### 5. Monitor results

After each run the workflow commits results to the `output/` folder:

```
output/
└── 2024-03-15_06-00/
    ├── summary.md          # Human-readable run summary
    ├── keywords.json       # Keywords found in this run
    ├── keywords.csv        # Same data in CSV format
    ├── keywords-all.json   # All high-score keywords in the database
    ├── hn-posts.json       # HackerNews posts collected
    └── reddit-posts.json   # Reddit posts collected
```

Browse results directly on GitHub: **[output/](output/)**

---

## Keyword Scoring

Keywords are scored 0–4 based on estimated search volume and competition:

| Score | Volume estimate | Competition |
|-------|----------------|-------------|
| 4 | 1000–5000/mo | Low |
| 3 | 100–5000/mo | Low–Medium |
| 1–2 | Any | High |

Only keywords with `opportunity_score >= 3` are stored (configurable via `keywords.opportunity_score_threshold` in `settings.json`).

---

## Error Handling

- **Reddit 403 errors** — Reddit sometimes blocks automated requests. The scraper logs the error and continues; the overall run is marked `partial` rather than failed.
- **All scrapers use `continue-on-error`** — a single failed scraper never blocks keyword research or the export step.
- **Export always runs** — even if scrapers produce zero results, the export script writes a summary of what was found.

---

## Folder Structure

```
├── config/
│   └── settings.json           # All settings — subreddits, seeds, score thresholds
├── scripts/
│   ├── hn-scraper.js           # HackerNews scraper (Algolia API)
│   ├── reddit-scraper.js       # Reddit scraper (public JSON API)
│   ├── keyword-research.js     # Google Autocomplete keyword expansion
│   ├── export-research.js      # Exports DB results to output/ folder
│   └── db.js                   # SQLite database helpers
├── output/                     # Committed research results (timestamped subfolders)
├── data/                       # SQLite database (cached between CI runs, not committed)
└── .github/workflows/
    └── research.yml            # The single research pipeline workflow
```

---

## Cost

| Item | Cost |
|------|------|
| GitHub Actions | Free (2,000 min/month) |
| GEMINI_API_KEY | Free tier at [aistudio.google.com](https://aistudio.google.com) |
| All scrapers | Free (no auth required) |
| **Total** | **$0/month** |

---

## Troubleshooting

**No keywords in output**
→ The keyword research runs against Google Autocomplete which requires no API key. Check the Actions log for any `[keyword-research]` errors.

**Reddit posts = 0**
→ Reddit may be returning 403 for automated requests. This is expected — HN scraping and keyword research still run normally.

**`GEMINI_API_KEY not set` warning**
→ Add `GEMINI_API_KEY` to your GitHub Secrets (Settings → Secrets and variables → Actions).

**Module exits without doing anything**
→ Check that the module is enabled in `config/settings.json` (`modules` block).

---

## License

MIT


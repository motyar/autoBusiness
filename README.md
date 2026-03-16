# autoBusiness

Automated market research, idea validation, landing page generation, and email outreach — running entirely on GitHub Actions. No server, no VPS, no dashboard.

Agents are orchestrated by the **Gemini CLI** (`@google/gemini-cli`) using the `gemini-3.1-flash-lite-preview` model.

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

---

## Prerequisites

- **Node.js ≥ 20** — [nodejs.org](https://nodejs.org)
- **Google Gemini API key** — free at [aistudio.google.com](https://aistudio.google.com)
- **Gemini CLI** — installed via npm (see below)

---

## Running Locally

### 1. Clone and install

```bash
git clone https://github.com/your-username/autoBusiness.git
cd autoBusiness
npm install
```

### 2. Install the Gemini CLI

```bash
npm install -g @google/gemini-cli
```

Verify the install:

```bash
gemini --version
```

### 3. Set your API key

```bash
export GEMINI_API_KEY="your-key-here"
```

To persist it, add the line to your `~/.bashrc` or `~/.zshrc`.

### 4. Run agents via the Gemini CLI

The Gemini CLI reads `agent.md` as the agent's system instructions and executes the pipeline scripts on your behalf using the `gemini-3.1-flash-lite-preview` model.

**Daily scrape & score:**

```bash
AGENT=$(cat agent.md)
GEMINI_MODEL=gemini-3.1-flash-lite-preview \
  gemini --yolo -p "${AGENT}

## Current Task
Run the daily scrape and score pipeline in sequence (continue even if one fails):
1. node scripts/reddit-scraper.js
2. node scripts/hn-scraper.js
3. node scripts/idea-scorer.js
4. node scripts/convergence-scorer.js
5. node scripts/summary.js"
```

**Weekly keyword research:**

```bash
AGENT=$(cat agent.md)
GEMINI_MODEL=gemini-3.1-flash-lite-preview \
  gemini --yolo -p "${AGENT}

## Current Task
Run the weekly keyword research pipeline by executing these commands in sequence:
1. node scripts/keyword-research.js
2. node scripts/trend-checker.js
3. node scripts/convergence-scorer.js
4. node scripts/summary.js"
```

**Email outreach pipeline:**

```bash
AGENT=$(cat agent.md)
GEMINI_MODEL=gemini-3.1-flash-lite-preview \
  gemini --yolo -p "${AGENT}

## Current Task
Run the email outreach pipeline by executing these commands in sequence:
1. node scripts/email-finder.js
2. node scripts/emailer.js
3. node scripts/summary.js"
```

**Landing page generation:**

```bash
AGENT=$(cat agent.md)
LANDING_PAGE_NICHE="freelance invoicing" \
GEMINI_MODEL=gemini-3.1-flash-lite-preview \
  gemini --yolo -p "${AGENT}

## Current Task
Generate a landing page: LANDING_PAGE_NICHE='freelance invoicing' node scripts/landing-page.js, then node scripts/summary.js"
```

**Run a single module directly (without the CLI agent):**

```bash
GEMINI_API_KEY="your-key" node scripts/reddit-scraper.js
GEMINI_API_KEY="your-key" node scripts/idea-scorer.js
node scripts/summary.js
```

### 5. View results

```bash
cat data/summary.md
```

---

## Running on GitHub Actions

### 1. Fork or use this repository

Go to **Settings → Actions → General** and ensure workflows are allowed to run.

### 2. Add GitHub Secrets

Go to **Settings → Secrets → Actions** and add:

| Secret | Required | Description |
|--------|----------|-------------|
| `GEMINI_API_KEY` | **Required** | Google Gemini API key — free at [aistudio.google.com](https://aistudio.google.com) |
| `RESEND_API_KEY` | Optional | For sending cold emails — free at [resend.com](https://resend.com) |
| `HUNTER_API_KEY` | Optional | For finding emails — free at [hunter.io](https://hunter.io) |
| `APOLLO_API_KEY` | Optional | For finding emails — free at [apollo.io](https://apollo.io) |
| `TWITTER_API_KEY` | Optional | Twitter API credentials |
| `TWITTER_API_SECRET` | Optional | Twitter API credentials |
| `TWITTER_ACCESS_TOKEN` | Optional | Twitter access token |
| `TWITTER_ACCESS_TOKEN_SECRET` | Optional | Twitter access token secret |
| `FORMSPREE_FORM_ID` | Optional | For landing page email forms — free at [formspree.io](https://formspree.io) |

### 3. Configure your niche

Edit [`config/settings.json`](config/settings.json):
- Set `reddit.subreddits` to communities in your target market
- Set `reddit.queries` to pain-point search phrases
- Set `niche.target` to your niche keyword (e.g., `"freelance invoicing"`)
- Enable/disable modules in the `modules` block

### 4. Available workflows

| Workflow | Trigger | Description |
|----------|---------|-------------|
| **AI Agent (Gemini CLI)** | Manual only | Primary agent workflow — Gemini CLI orchestrates all scripts |
| **Daily Scrape & Score** | Daily 6am UTC + manual | Scrape Reddit/HN → score ideas → converge |
| **Weekly Keyword Research** | Monday 7am UTC + manual | Keyword research → trend check → converge |
| **Email Sender** | Tue–Thu 2pm UTC + manual | Find leads → send cold emails |
| **Daily Summary** | Daily 11pm UTC + manual | Generate `data/summary.md` digest |
| **Manual Trigger** | Manual only | Run any single module on demand |

> **Tip:** The **AI Agent** workflow and the individual scheduled workflows serve different purposes. Use the AI Agent for interactive, on-demand runs with custom instructions. The individual workflows handle automatic scheduled runs.

Enable workflows from the **Actions** tab, then trigger them manually or let the schedule handle them.

### 5. Using the AI Agent workflow

The **AI Agent (Gemini CLI)** workflow is the recommended way to run the system. It installs the Gemini CLI, reads `agent.md` as the system prompt, and lets the AI orchestrate the pipeline scripts.

**Trigger manually:**
1. Go to **Actions → AI Agent (Gemini CLI) → Run workflow**
2. Select a task:
   - `daily-scrape` — scrape Reddit/HN and score ideas
   - `weekly-keywords` — keyword research and trend analysis
   - `send-emails` — find leads and send cold emails
   - `landing-page` — generate landing pages (enter niche in the niche field)
   - `full-pipeline` — run everything end-to-end
3. Optionally enter a target niche and any extra instructions for the agent
4. Click **Run workflow**

### 6. Monitor results

After each run:
- Check **Actions → [workflow name]** for logs
- Check [`data/summary.md`](data/summary.md) for the structured digest
- Check `data/shortlist.json` for validated ideas
- Check `landing-pages/` for generated HTML pages

---

## Control Without a Dashboard

Everything is controlled through files and git:

| Task | How |
|------|-----|
| Change targeting | Edit `config/settings.json`, push |
| Enable/disable a module | Edit `modules` block in `config/settings.json`, push |
| Add a new data source | Add `skills/source.md` + `scripts/source.js` |
| Change AI behavior | Edit `agent.md` |
| Change email copy rules | Edit `prompts/email-writer.md` |
| Change AI model | Edit `ai.default_model` in `config/settings.json` |
| Trigger a run manually | GitHub Actions → AI Agent → Run workflow |
| Generate a landing page | AI Agent workflow → select `landing-page` → enter niche |

---

## Folder Structure

```
├── agent.md                    # Agent identity, decision rules, and system prompt
├── plan.md                     # Complete system design
├── config/
│   ├── settings.json           # All settings — modules, AI model, email config
│   └── tasks.json              # Task schedule config
├── skills/                     # Markdown how-to guides per capability
├── prompts/                    # AI prompt templates (idea scorer, email writer, etc.)
├── scripts/                    # Node.js scripts — one per module
│   ├── orchestrator.js         # Runs modules in sequence
│   ├── reddit-scraper.js
│   ├── hn-scraper.js
│   ├── keyword-research.js
│   ├── trend-checker.js
│   ├── idea-scorer.js
│   ├── convergence-scorer.js
│   ├── email-finder.js
│   ├── emailer.js
│   ├── social-poster.js
│   ├── landing-page.js
│   ├── summary.js
│   └── db.js
├── data/                       # SQLite DB + generated outputs
├── landing-pages/              # Generated HTML landing pages (committed)
└── .github/workflows/          # GitHub Actions workflows
    ├── ai-agent.yml            # Primary: Gemini CLI agent orchestrator
    ├── daily-scrape.yml
    ├── weekly-keywords.yml
    ├── email-sender.yml
    ├── daily-summary.yml
    └── manual-trigger.yml
```

---

## AI Model

All AI tasks use `gemini-3.1-flash-lite-preview` via the Gemini CLI and the `@google/generative-ai` Node.js SDK.

To change the model, edit `config/settings.json`:

```json
{
  "ai": {
    "default_model": "gemini-3.1-flash-lite-preview",
    "complex_model": "gemini-3.1-flash-lite-preview"
  }
}
```

You can also override per-run with the `GEMINI_MODEL` environment variable:

```bash
GEMINI_MODEL=gemini-3.1-flash-lite-preview node scripts/idea-scorer.js
```

---

## Cost

| Item | Cost |
|------|------|
| GitHub Actions | Free (2,000 min/month) |
| Gemini CLI (`gemini-3.1-flash-lite-preview`) | ~$0.01–0.10/day depending on volume |
| Resend email | Free (100/day) |
| Hunter.io | Free (25 lookups/month) |
| All scrapers | Free (no auth required) |
| **Total** | **~$0–5/month** |

---

## Module Dependency

```
reddit-scraper ──┐
hn-scraper       ├──► idea-scorer ──► convergence-scorer ──► landing-page
keyword-research ─┤
trend-checker   ──┘

convergence-scorer ──► email-finder ──► emailer

any module ──► summary
```

---

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

---

## Troubleshooting

**`GEMINI_API_KEY not set` warning**
→ Add `GEMINI_API_KEY` to your GitHub Secrets or export it locally.

**`gemini: command not found`**
→ Run `npm install -g @google/gemini-cli` and ensure your npm global bin is on `$PATH`.

**Module exits without doing anything**
→ Check that the module is enabled in `config/settings.json` and that required API keys are set.

**Rate limit hit**
→ The agent waits and retries once. If it happens consistently, reduce `reddit.posts_per_query` or `ai.batch_size` in `config/settings.json`.

**Landing pages not generating**
→ Ensure `landing_page_builder` is `true` in `modules` and that at least one idea has `status = 'validated'` in the database (run idea-scorer and convergence-scorer first).

---

## License

MIT

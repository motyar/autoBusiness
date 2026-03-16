# Skill: Social Poster

## Purpose
Drive traffic to landing pages and build an audience around the problem being solved. Focus on genuine value first, product second.

## Channels

### Twitter/X
- **Posts per day:** 3–5
- **Format:** Build-in-public with real metrics
- **API:** Twitter API Basic (free tier, limited)
- **Secrets:** `TWITTER_API_KEY`, `TWITTER_API_SECRET`, `TWITTER_ACCESS_TOKEN`, `TWITTER_ACCESS_TOKEN_SECRET`

### Reddit (Engagement, Not Spam)
- **Comments per day:** 5–10 (genuine helpful replies)
- **Never post pure promotion** — lead with value, mention product only if directly relevant
- **No API key needed** — use Reddit JSON API with user agent
- Target threads where people express the exact pain your product solves

### LinkedIn
- **Posts per day:** 1
- **Format:** Professional problem-focused content
- **API:** LinkedIn API (requires OAuth setup)
- **Secrets:** `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`

## Twitter Post Templates

### Build-in-public format (pull real data from SQLite):
```
Day {N} building {product}:
- {X} signups
- {Y} emails sent
- {Z}% open rate

What I learned: {insight_from_data}

Building for: {target_user}
```

### Insight/thread format:
```
{Number} signs you need a {product_niche} tool:

1. {pain_point_from_reddit}
2. {pain_point_from_reddit}
3. {pain_point_from_reddit}

Building the fix at {landing_page_url}
```

### Engagement format:
```
If you're a {target_user}, what's your biggest frustration with {niche}?

Building something for this — want to make sure I'm solving the right problem.
```

## Reddit Comment Strategy
1. Find threads where people ask about the pain point (use same queries as scraper)
2. Write a genuinely helpful reply that solves their problem
3. At the end, mention: "I'm actually building a tool for exactly this if you're interested"
4. Never post the same comment twice
5. Build comment history first — 1 week of helpful comments before any product mention

## Content Calendar (AI-Generated Weekly)
Every Monday, generate 7 days of posts for each channel using `prompts/content-writer.md`:
- 3 Twitter posts per day (engagement, build-in-public, insight)
- 1 LinkedIn post per day (problem-focused)
- 5 Reddit comment drafts targeting high-signal threads

## Metrics to Track (From DB)
Pull real numbers for authenticity:
- Ideas found this week
- Emails sent and open rates
- Signups from landing page
- Top pain point discovered

## Rules
- Never automate Reddit comments in a way that looks spammy
- Always check if module is enabled in `config/settings.json`
- Always check that required API keys exist before running
- Rate limit: 1 post per 30 minutes on Twitter, 1 comment per hour on Reddit

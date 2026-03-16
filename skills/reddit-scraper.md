# Skill: Reddit Scraper

## Purpose
Find real pain points from Reddit communities where people discuss problems, frustrations, and unmet needs.

## Inputs
- `subreddits`: list of subreddits to search (from `config/settings.json`)
- `queries`: search phrases that signal pain points
- `min_score`: minimum post score filter
- `max_age_days`: maximum post age in days

## Outputs
- Rows inserted into `reddit_posts` table in SQLite database
- Fields: `id`, `subreddit`, `title`, `selftext`, `score`, `num_comments`, `created_utc`, `permalink`, `niche`, `analyzed_at`

## API Endpoint
```
GET https://www.reddit.com/r/{SUBREDDIT}/search.json?q={QUERY}&sort=new&limit=25&restrict_sr=1
```
No authentication required. Use the `firefox` user agent to avoid 429s.

## Logic
1. For each subreddit × query combination:
   a. Make GET request to Reddit search endpoint
   b. Parse `data.children` array
   c. Filter: `score >= min_score` AND `created_utc >= (now - max_age_days * 86400)`
   d. For each passing post, extract: `id`, `subreddit`, `title`, `selftext`, `score`, `num_comments`, `created_utc`, `permalink`
   e. Check if `id` already exists in DB — skip if yes (deduplication)
   f. Insert new row with `niche = null`, `analyzed_at = null`
   g. Wait `delay_between_requests_ms` before next request (avoid rate limit)
2. After all scraping, trigger `idea-scorer.js` for unanalyzed rows

## Signal Phrases to Look For in Title/Body
- "wish there was a tool"
- "is there an app that"
- "why doesn't X do Y"
- "I've been paying for"
- "anyone know an alternative to"
- "I'm looking for something that"
- "this is so frustrating"
- "manual process"
- "wasting time on"

## Rate Limiting
- 1.5 second delay between requests
- On 429 response: wait 30 seconds, retry once
- On failure: log and skip, do not crash

## Notes
- `old.reddit.com/r/SUBREDDIT/search.json` also works as fallback
- No login required
- Public subreddits only

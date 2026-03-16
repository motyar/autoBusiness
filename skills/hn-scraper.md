# Skill: HackerNews Scraper

## Purpose
Find developer and founder pain points from HackerNews "Show HN" and "Ask HN" posts where technical people discuss tools they wish existed.

## Inputs
- `queries`: search terms (from `config/settings.json`)
- `min_points`: minimum upvote threshold
- `max_age_days`: max post age
- `results_per_query`: how many results per query

## Outputs
- Rows inserted into `hn_posts` table in SQLite
- Fields: `id`, `title`, `url`, `points`, `num_comments`, `created_at_ts`, `author`, `niche`, `analyzed_at`

## API Endpoint
HackerNews Algolia API — fully free, no auth:
```
GET https://hn.algolia.com/api/v1/search?query={QUERY}&tags=story&hitsPerPage={N}
```

For date filtering:
```
GET https://hn.algolia.com/api/v1/search?query={QUERY}&tags=story&numericFilters=created_at_i>{TIMESTAMP}&hitsPerPage={N}
```

Response fields to extract:
- `objectID` → id
- `title`
- `url`
- `points`
- `num_comments`
- `created_at_i` (Unix timestamp)
- `author`

## Target Query Patterns
- `"Show HN: I built"` — what developers are making (signals tool niches)
- `"Ask HN: Is there a tool"` — explicit tool requests
- `"Ask HN: Why is there no"` — frustrated unmet needs
- `"Ask HN: Alternatives to"` — dissatisfied with current solutions
- Niche-specific: `"Show HN: {niche keyword}"`

## Logic
1. For each query:
   a. Fetch from Algolia HN API
   b. Filter: `points >= min_points` AND `created_at_i >= (now - max_age_days * 86400)`
   c. Deduplicate by `objectID`
   d. Insert new rows into `hn_posts`
2. For "Ask HN" posts: fetch top comments to get community sentiment
   - If comments include "yes please", "+1", "I'd pay for this" → boost signal
   - If comments include "this already exists" → extract competitor name
3. Wait 500ms between requests

## Community Sentiment Signals (from comments)
Positive: "yes", "please", "+1", "I need this", "when can I sign up", "I'd pay", "take my money"
Negative: "this exists", "just use X", "too niche", "won't work because"

## Notes
- Algolia HN search is fast and reliable
- `tags=story` filters to top-level posts only (not comments)
- `tags=ask_hn` filters to Ask HN specifically
- Combine with keyword research: "Ask HN" posts that match high-opportunity keywords are double-validated

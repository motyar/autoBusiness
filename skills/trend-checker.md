# Skill: Google Trends Checker

## Purpose
Confirm demand direction — only target niches with rising (not flat or declining) interest. Direction matters more than absolute volume.

## Inputs
- Keywords from `keywords` table (or from `config.niche.keywords`)
- `timeframe`: default `today 12-m` (12 months)
- `geo`: empty string = worldwide, or e.g. `US`

## Outputs
- Rows inserted into `trends` table in SQLite
- Fields: `keyword`, `source`, `value`, `direction`, `date_checked`, `niche`
- Updates `ideas` table: promotes ideas with `direction = 'rising'`

## Data Source
Google Trends via `pytrends` Python library (free, unofficial):
```python
pip install pytrends
from pytrends.request import TrendReq
pytrends = TrendReq(hl='en-US', tz=360)
pytrends.build_payload([keyword], cat=0, timeframe='today 12-m', geo='')
df = pytrends.interest_over_time()
```

### Alternative: Direct HTTP (no Python dependency)
```
GET https://trends.google.com/trends/api/explore?hl=en-US&tz=-330&req={"comparisonItem":[{"keyword":"{KEYWORD}","geo":"","time":"today 12-m"}]}
```

## Direction Classification
After fetching 12-month trend data (weekly values 0–100):
1. Calculate linear regression slope across all data points
2. If slope > 0.3 → `direction = 'rising'`
3. If slope between -0.3 and 0.3 → `direction = 'flat'`
4. If slope < -0.3 → `direction = 'declining'`

## Logic
1. Fetch top keywords from `keywords` table ordered by `opportunity_score DESC LIMIT 50`
2. For each keyword:
   a. Check if already checked within 7 days (skip if yes — cache)
   b. Fetch trend data
   c. Calculate direction
   d. Store in `trends` table
   e. Wait 1–2 seconds between requests
3. Update `ideas` table: boost `confidence` for ideas where keyword trend is rising

## Integration With Convergence Scorer
When an idea has:
- Reddit signal
- Keyword signal
- Rising trend signal
→ That's 3 sources — promote to shortlist automatically

## Notes
- pytrends has rate limits; respect them with delays
- If rate limited, wait 60 seconds and retry once
- Use batches of 5 keywords per pytrends call to reduce requests

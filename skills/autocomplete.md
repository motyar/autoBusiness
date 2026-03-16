# Skill: Google Autocomplete Keyword Research

## Purpose
Find long-tail keywords that real people search for, indicating active demand for solutions.

## Inputs
- `seeds`: seed phrases to expand (from `config/settings.json`)
- `alphabet_soup`: if true, append a–z to each seed for deeper coverage
- `niche`: optional niche keyword to append to seeds

## Outputs
- Rows inserted into `keywords` table in SQLite
- Fields: `keyword`, `volume_range`, `competition_level`, `source`, `opportunity_score`, `date_found`, `niche`

## API Endpoints

### Google Autocomplete (no auth required)
```
GET https://suggestqueries.google.com/complete/search?client=firefox&q={QUERY}
```
Returns JSON array: `[query, [suggestion1, suggestion2, ...]]`

### Google Trends (unofficial, via pytrends or direct)
```python
from pytrends.request import TrendReq
pytrends = TrendReq()
pytrends.build_payload([keyword], timeframe='today 12-m')
data = pytrends.interest_over_time()
```

## Logic

### Phase 1: Autocomplete Expansion
1. For each seed phrase:
   a. Fetch autocomplete suggestions
   b. If `alphabet_soup = true`, also fetch `{seed} a`, `{seed} b`, ... `{seed} z`
   c. Deduplicate all suggestions
   d. Store each new keyword with `source = 'autocomplete'`, `date_found = today`

### Phase 2: Opportunity Scoring
For each keyword:
1. Assign volume score:
   - 100–1,000 searches/mo → `volume_range = '100-1000'`, +1 pt
   - 1,001–5,000 → `volume_range = '1000-5000'`, +2 pts
   - >5,000 or <100 → 0 pts (skip)
2. Assign competition score:
   - Low competition → +2 pts
   - Medium → +1 pt
   - High → 0 pts
3. SERP quality bonus (manual or automated):
   - If top Google results are Reddit/Quora/thin blogs → +3 pts
4. Store `opportunity_score`, skip anything with score < `opportunity_score_threshold`

## Targeting Decision Logic
**Target keywords where ALL of these are true:**
- Volume between 200–2,000 monthly searches
- Competition is low or medium
- Current top results are weak (forums, thin content, not established SaaS)

**Ignore:**
- Under 100 monthly searches (not worth it)
- Over 10,000 monthly searches (too competitive for new sites)
- Any keyword dominated by major SaaS brands on page 1

## Storage
```sql
INSERT OR IGNORE INTO keywords (keyword, volume_range, competition_level, source, opportunity_score, date_found, niche)
VALUES (?, ?, ?, 'autocomplete', ?, date('now'), ?)
```

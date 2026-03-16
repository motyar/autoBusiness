# Skill: Convergence Scorer

## Purpose
Identify ideas validated by 3 or more independent data sources. Single-source signals are noise. Multi-source convergence is the real signal.

## Inputs
- All data in SQLite: `reddit_posts`, `hn_posts`, `keywords`, `trends`
- Minimum source count threshold (default: 3)

## Outputs
- Updates `ideas` table with `source_count`, `sources` (JSON), `confidence`
- Writes `data/shortlist.json` — top ideas sorted by convergence + confidence
- Promotes ideas to status = 'validated' when all criteria met

## The Four Witnesses (Sources)

| Source | Signal | Table |
|--------|--------|-------|
| Reddit | People complain about X | reddit_posts |
| HackerNews | Developers discuss X | hn_posts |
| Keywords | People search for X | keywords |
| Trends | Demand for X is rising | trends |

## SQL Query Logic

```sql
-- Step 1: Normalize all signals to (niche, source) pairs
SELECT niche, 'reddit' as source FROM reddit_posts
  WHERE niche IS NOT NULL AND confidence >= 0.6
UNION
SELECT niche, 'hn' as source FROM hn_posts
  WHERE niche IS NOT NULL AND confidence >= 0.6
UNION
SELECT niche, 'keywords' as source FROM keywords
  WHERE niche IS NOT NULL AND opportunity_score >= 3
UNION
SELECT keyword as niche, 'trends' as source FROM trends
  WHERE direction = 'rising';

-- Step 2: Count distinct sources per niche
SELECT niche, COUNT(DISTINCT source) as source_count, GROUP_CONCAT(DISTINCT source) as sources
FROM signals
GROUP BY niche
HAVING source_count >= 3
ORDER BY source_count DESC;
```

## Scoring Each Shortlisted Idea
For each idea that passes the 3-source threshold:
1. `base_score` = source_count × 20 (max 80)
2. `reddit_boost` = avg confidence of Reddit posts for this niche × 20
3. `trend_boost` = +10 if trend direction = 'rising', +0 if flat, -10 if declining
4. `final_score` = base_score + reddit_boost + trend_boost (max 100)

## Promotion Logic
An idea gets status = 'validated' when:
- `source_count >= 3`
- `final_score >= 60`
- At least one Reddit or HN post explains the problem clearly
- Idea does NOT already exist in `ideas` table with status = 'validated' or 'building' or 'launched'

## Output File: data/shortlist.json
```json
[
  {
    "niche": "invoice automation for freelancers",
    "source_count": 4,
    "sources": ["reddit", "hn", "keywords", "trends"],
    "confidence": 82,
    "status": "validated",
    "top_pain_point": "I spend 2 hours every month chasing invoices manually",
    "suggested_solution": "automated invoice follow-up tool for freelancers",
    "target_user": "freelancers billing 5+ clients per month",
    "updated_at": "2024-01-15T06:00:00Z"
  }
]
```

## Manual Validation Checklist (Do This Weekly)
For each shortlisted idea, spend 5 minutes:
- [ ] Google the niche keyword — are top results weak (Reddit/Quora/thin blogs)?
- [ ] Can you explain the problem to a stranger in one sentence?
- [ ] Could a solo dev build a working version in a weekend?
- [ ] Would you personally pay monthly for this?

If all 4 = yes → approve for landing page generation.

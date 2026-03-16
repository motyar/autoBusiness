# Skill: Email Finder

## Purpose
Discover verified email addresses of warm leads — people already experiencing the pain your product solves.

## Inputs
- Niche from validated idea shortlist
- Target profile: solo founders, small team leads, one-star reviewers of competitors

## Outputs
- Rows inserted into `leads` table: `name`, `email`, `company`, `source`, `niche`, `status = 'new'`

## Services (All with Free Tiers)

### Hunter.io
- Free tier: 25 email lookups/month
- API: `GET https://api.hunter.io/v2/email-finder?domain={DOMAIN}&first_name={FIRST}&last_name={LAST}&api_key={KEY}`
- Also: `GET https://api.hunter.io/v2/domain-search?domain={DOMAIN}&api_key={KEY}` — finds all emails at a company
- GitHub Secret: `HUNTER_API_KEY`

### Apollo.io
- Free tier: 50 email lookups/month
- API: `POST https://api.apollo.io/v1/people/match` with body `{ first_name, last_name, domain }`
- GitHub Secret: `APOLLO_API_KEY`

### Email Pattern Guessing (No API)
1. Find one verified email at a company (from Hunter)
2. Extract the pattern: `firstname.lastname@company.com`, `first@company.com`, etc.
3. Apply same pattern to other contacts at the company
4. Verify with MX check before adding to leads

## Lead Source Priority (Warmest First)
1. **Reddit commenters** who posted in relevant threads — they already expressed the pain
2. **HN commenters** who +1'd a relevant "Ask HN" post
3. **Twitter users** whose bios mention the niche (search `bio:"invoicing" OR bio:"freelance payments"`)
4. **Company websites** in the niche (scrape with Jina Reader API — free)
5. **LinkedIn** profiles (manual search, tool-assisted)

## Jina Reader API (Free)
Extract clean text from any URL:
```
GET https://r.jina.ai/{URL}
```
No API key needed. Use to extract contact info from company "About" pages or team pages.

## Email Verification
Before adding to leads, verify:
1. Check MX record exists: `dns.resolve(domain, 'MX')`
2. Format validation: regex check
3. Skip role emails: `admin@`, `info@`, `support@`, `noreply@`, `hello@`
4. Skip free email providers if targeting businesses: `gmail.com`, `yahoo.com`, `hotmail.com`

## Daily Limits
- Max `config.email_finder.max_leads_per_run` new leads per run
- Track Hunter API calls to not exceed free tier
- Track Apollo API calls to not exceed free tier

## Notes
- Always get explicit permission model right — target people who publicly expressed the problem
- Never buy email lists
- Prioritize quality over quantity: 10 verified warm leads > 100 cold guesses

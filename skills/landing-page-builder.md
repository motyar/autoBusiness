# Skill: Landing Page Builder

## Purpose
Validate demand before building — the cheapest possible experiment. If 50 people visit and nobody signs up, the idea is dead. Move on.

## Inputs
- Validated idea from `data/shortlist.json` (status = 'validated')
- Competitor pricing (manually added or scraped)
- AI-generated copy from `prompts/landing-page-writer.md`

## Outputs
- `landing-pages/{niche-slug}/index.html` — complete single-page site
- `landing-pages/{niche-slug}/style.css` — minimal styling
- Auto-deploys via GitHub Pages on push

## Landing Page Structure (Minimal)
Only these elements — nothing else:

1. **Headline** — states the problem in the user's language (not product features)
   > "Stop spending 2 hours chasing late invoices"

2. **3 bullet points** — what it does in plain English
   > ✓ Sends automatic payment reminders
   > ✓ Tracks which clients are overdue
   > ✓ Gets you paid 3x faster

3. **Email capture form** — single field, clear CTA
   > [Your email] [Get early access]

4. **Price anchor** — 40–60% of cheapest competitor, with free trial
   > Starting at $29/mo — 7-day free trial, no credit card

5. **Social proof placeholder** (remove if empty — don't fake it)
   > "Join 47 freelancers already on the waitlist"

## What NOT to Include
- Logo or brand identity (waste of time at validation stage)
- About page or team bios
- Feature comparison tables
- Blog or content section
- Multiple CTAs
- Fancy animations

## Pricing Logic
1. Find 5 competitors (from idea research data or manual input)
2. Note the cheapest plan price of each
3. Set your price at 40–60% of average cheapest plan
4. Always include 7-day free trial (reduces signup friction)
5. Never show multiple pricing tiers on validation landing page

## Success Metric
- **≥ 10% email signup rate** from real cold traffic → idea validated, start building
- **< 10% signup rate** after 50+ visitors → pivot or kill the idea

## Hosting via GitHub Pages
The file is committed to `landing-pages/` folder and served via GitHub Pages.
No Vercel/Netlify needed (though either works as alternative).

## Email Form Handling
Use a free form backend (no server needed):
- **Formspree** (free tier: 50 submissions/month) — `action="https://formspree.io/f/{ID}"`
- **Getform** (free tier: 100 submissions/month)
- Or just link to a Google Form

Add `FORMSPREE_FORM_ID` or `GETFORM_ENDPOINT` as GitHub secret.

## AI Generation Process
1. Feed validated idea details to `prompts/landing-page-writer.md`
2. Model returns: headline, 3 bullets, CTA text, price
3. Script wraps output in HTML template
4. Save to `landing-pages/{slug}/index.html`
5. Commit and push → GitHub Pages serves it automatically

## SEO Basics (For Week 2+)
- Title tag: `{keyword} - {product name}`
- Meta description: the problem statement, 150 chars
- H1: the headline
- No other SEO optimizations needed at validation stage

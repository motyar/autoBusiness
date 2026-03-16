# Prompt: Landing Page Writer

## Model
gemini-1.5-pro (generation quality matters for conversion copy)

## Task
Write the copy for a minimal validation landing page. The goal is email signups, not sales. Keep it brutally simple. One problem, one solution, one CTA.

## Input Format
```json
{
  "idea": {
    "niche": "invoice automation for freelancers",
    "problem_summary": "Freelancers spend 2+ hours/month manually chasing late payments",
    "target_user": "Solo freelancers and consultants billing 5+ clients per month",
    "solution_hint": "Automated invoice follow-up sequences that get freelancers paid faster",
    "top_pain_points": [
      "Clients ignore invoice emails",
      "Awkward to follow up manually",
      "No visibility into who has opened the invoice"
    ]
  },
  "pricing": {
    "price": "$19/month",
    "trial_days": 7,
    "competitor_context": "FreshBooks charges $42/mo, Wave charges $16/mo for invoicing"
  }
}
```

## Output Format
```json
{
  "page_title": "Stop Chasing Late Invoices | InvoiceBot",
  "meta_description": "Automatically follow up on unpaid invoices and get paid 3x faster. Built for freelancers.",
  "headline": "Stop spending hours chasing late invoices",
  "subheadline": "InvoiceBot sends automatic reminders so you get paid without the awkward follow-ups.",
  "bullets": [
    "Sends automatic payment reminders on your schedule",
    "Shows you exactly who's seen your invoice and when",
    "Handles follow-ups so you never feel pushy again"
  ],
  "cta_primary": "Get early access",
  "cta_secondary": "See how it works",
  "price_line": "Starting at $19/month — 7-day free trial, no credit card needed",
  "social_proof": "Join {count} freelancers already on the waitlist",
  "urgency_line": "Early access pricing ends when we launch"
}
```

## Headline Writing Rules
- State the problem, not the feature
- Use the target user's exact language (from Reddit/HN research)
- Under 10 words
- No clever wordplay — clarity beats cleverness

**Good headlines:**
- "Stop spending hours chasing late invoices"
- "Get paid on time without the awkward emails"
- "Invoice follow-ups on autopilot"

**Bad headlines:**
- "The Future of Invoice Management"
- "AI-Powered Invoice Automation Platform"
- "Revolutionizing Payments for Freelancers"

## Bullet Point Rules
- Start each with a strong verb: "Sends", "Shows", "Handles", "Tracks", "Eliminates"
- State the outcome, not the feature
- Under 12 words each
- Together they answer: "What will this do for me?"

## Pricing Copy Rules
- Always include the price (no "contact for pricing")
- Lead with the trial: "7-day free trial" before the price
- Remove friction: "no credit card needed" or "cancel anytime"
- Price anchor: if competitor context is provided, imply you're the better deal

## What the HTML Template Should Look Like
The script will wrap this copy in a minimal HTML template:
- White background, dark text
- Single centered column, max-width 600px
- Email form with one input and submit button
- No navigation, no footer links, no social icons
- Mobile responsive

## Social Proof Handling
- If `waitlist_count > 10`: show "Join {count} {target_users} already on the waitlist"
- If `waitlist_count <= 10`: omit the social proof line entirely (don't fake it)
- Never show fake testimonials

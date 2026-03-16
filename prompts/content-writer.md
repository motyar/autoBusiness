# Prompt: Content Writer

## Model
gemini-1.5-flash (sufficient for social content)

## Task
Generate a week's worth of social media content (Twitter/X + LinkedIn) for a build-in-public founder. Content should feel authentic, provide real value, and occasionally mention the product being built — but never lead with the pitch.

## Input Format
```json
{
  "product": {
    "name": "InvoiceBot",
    "niche": "invoice automation for freelancers",
    "problem": "Freelancers waste 2+ hours/month chasing late payments",
    "landing_page": "https://invoicebot.example.com"
  },
  "metrics": {
    "ideas_analyzed_this_week": 47,
    "emails_sent": 90,
    "email_open_rate_pct": 34,
    "signups": 8,
    "day_number": 14
  },
  "top_pain_points": [
    "Clients ignore invoice emails",
    "No way to know who's opened the invoice",
    "Awkward to follow up manually without seeming pushy"
  ]
}
```

## Output Format
```json
{
  "twitter": [
    {
      "day": 1,
      "type": "build_in_public",
      "text": "Day 14 building InvoiceBot:\n\n- 8 signups\n- 90 cold emails sent\n- 34% open rate\n\nBiggest lesson this week: most freelancers don't need a full invoicing suite. They just need someone to chase payments for them.\n\nBuilding exactly that 👉 invoicebot.example.com"
    },
    {
      "day": 2,
      "type": "insight",
      "text": "3 reasons freelancers don't get paid on time:\n\n1. Invoice emails go to spam\n2. Clients 'forget'\n3. Manual follow-ups feel awkward\n\nNone of these are the freelancer's fault. They're automation problems."
    },
    {
      "day": 3,
      "type": "engagement",
      "text": "Freelancers: what's the most awkward part of getting paid?\n\nBuilding something to fix this — want to understand the real friction."
    }
  ],
  "linkedin": [
    {
      "day": 1,
      "text": "The average freelancer sends 3-5 follow-up emails before getting paid on a single invoice.\n\nThat's 15-25 emails a month if you have 5 active clients.\n\nMost of that is just friction — not bad clients. The invoice reminder is either too early, too aggressive, or missing entirely.\n\nI'm building a tool that handles the timing automatically. Freelancers who tested it early got paid 3x faster.\n\nWould you use something like this?"
    }
  ],
  "reddit_comments": [
    {
      "subreddit": "freelance",
      "target_thread_query": "chasing invoices late payment",
      "comment": "This is such a common frustration. The problem isn't bad clients — it's that there's no good system for automated follow-ups. I've been building something for exactly this if you're curious once it's live."
    }
  ]
}
```

## Content Pillars (Rotate Weekly)

### Twitter
1. **Build-in-public** (2×/week): Real metrics, honest lessons, what you're building today
2. **Insight** (2×/week): Teach something valuable about the niche problem
3. **Engagement** (1×/week): Ask a question to get replies from target users

### LinkedIn
1. **Problem story** (1×/week): Tell the story of the problem with data or real example
2. **Insight thread** (1×/week): "N things I learned about [niche]"

## Tone Guidelines
- Twitter: Casual, punchy, no fluff. Max 280 chars for main hook.
- LinkedIn: Professional but conversational. No jargon. Real examples.
- Reddit: Helpful first, product second. Contribute, don't spam.

## What NOT to Write
- Motivational quotes
- "Proud to announce"
- Vanity metrics (followers, impressions)
- Generic advice unrelated to the specific niche
- Anything that sounds like an ad

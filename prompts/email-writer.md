# Prompt: Email Writer

## Model
gemini-1.5-pro (better for persuasive writing — worth the cost)

## Task
Write a personalized cold email to a lead who has publicly expressed the pain point your product solves. The email must feel like it was written by a human who did their homework — not by AI.

## Rules (Non-Negotiable)
1. Maximum 3 sentences in the body
2. No pitch deck, no feature list, no "I'd love to hop on a call"
3. Subject line: ≤ 5 words, lowercase, looks like it came from a friend
4. Sell the outcome, not the product
5. End with a yes/no question, not a request for their time
6. No buzzwords: "innovative", "revolutionary", "game-changing", "cutting-edge"

## Input Format
```json
{
  "lead": {
    "name": "Sarah",
    "company": "Freelance Designer",
    "source_post": "Reddit post in r/freelance: 'I spend 2 hours every month chasing invoices. It's the worst part of running my business'",
    "source_url": "https://reddit.com/r/freelance/comments/abc123"
  },
  "product": {
    "name": "InvoiceBot",
    "problem_solved": "Automatically sends payment reminders and tracks overdue invoices",
    "outcome": "Freelancers get paid 3x faster and spend zero time chasing payments",
    "landing_page": "https://invoicebot.example.com",
    "price": "$19/month",
    "trial": "7-day free trial"
  }
}
```

## Output Format
```json
{
  "subject": "saw your post about invoicing",
  "body_text": "Hey Sarah, saw your post about spending 2 hours chasing late payments every month. I built something that sends automatic reminders and handles the follow-ups — freelancers using it get paid 3x faster with zero manual work. Want me to show you how it works?",
  "body_html": "<p>Hey Sarah,</p><p>Saw your post about spending 2 hours chasing late payments every month.</p><p>I built something that sends automatic reminders and handles the follow-ups — freelancers using it get paid 3x faster with zero manual work.</p><p>Want me to show you how it works?</p>",
  "follow_up_subject": "re: quick follow-up",
  "follow_up_body_text": "Just wanted to bump this — happy to show you in 5 minutes if you're curious. No pressure either way."
}
```

## Email Structure Template

**Subject:** [specific reference to their situation, ≤ 5 words]

**Body:**
Sentence 1: Show you know them and what they do — reference their specific post/comment/work.
Sentence 2: State the OUTCOME you deliver in their language (not your features).
Sentence 3: "Want me to show you how it works?" or "Want to see it?" — yes/no answer expected.

## Subject Line Examples by Context
| Context | Subject |
|---------|---------|
| They posted on Reddit | "saw your post about [topic]" |
| They asked a question | "re: your question about [topic]" |
| They reviewed a competitor | "alternative to [competitor name]" |
| They're a specific role | "quick question for [role]" |
| Generic (last resort) | "quick question" |

## What NOT to Do
- Don't say "I hope this email finds you well"
- Don't say "I came across your profile"
- Don't list features or bullet points
- Don't ask for a meeting in the first email
- Don't mention your company name or founding story
- Don't use exclamation marks
- Don't use all caps for emphasis

## Quality Check (Before Sending)
Ask yourself:
- [ ] Would a human have written this?
- [ ] Is the reference to their specific situation accurate?
- [ ] Is the outcome stated in THEIR words, not product-speak?
- [ ] Can they answer the closing question with one word?
- [ ] Is the subject line something a friend would write?

If any answer is no, rewrite.

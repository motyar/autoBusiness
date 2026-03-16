# Skill: Cold Email

## Purpose
Convert warm leads (people already experiencing the pain) into signups or customers. The email has ONE job: get a reply, not a sale.

## Inputs
- `leads` table rows with `status = 'new'` and verified email
- Validated idea from `ideas` table
- Landing page URL

## Outputs
- Rows inserted into `email_sends` table
- Update `leads.status` to 'sent', `leads.sent_at` to now
- Email delivered via Resend API

## Email Formula (3 Sentences Max)

**Sentence 1:** Show you know them and what they do.
> "Saw your post on r/freelance about chasing late invoices."

**Sentence 2:** State the outcome you deliver in their language (not yours).
> "I built something that sends automatic payment reminders and cuts late invoices by 80%."

**Sentence 3:** Ask if they want to see it (not a pitch).
> "Want me to show you how it works?"

**Never include:** pitch decks, feature lists, "I'd love to hop on a call", company background, pricing in the first email.

## Subject Line Rules
- ≤ 5 words
- Lowercase (looks like a friend wrote it)
- Specific to them
- Good examples: `"saw your post about invoicing"`, `"quick question"`, `"found your site"`
- Bad examples: `"Exciting New Tool for Freelancers!"`, `"Partnership Opportunity"`

## Send Schedule
- **Days:** Tuesday, Wednesday, Thursday only
- **Time:** 8–10am recipient's timezone (use UTC 14:00 as approximation)
- **Volume:** Max 30 per day (domain safety)
- **Domain requirement:** Must be warmed ≥ 14 days before first send

## Personalization Variables
AI generates per-lead customization using:
- Their Reddit/HN username and post content
- Their company name and role (if known)
- The specific problem they described publicly

## Resend API
```javascript
const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: `${config.email.from_name} <${config.email.from_address}>`,
  to: lead.email,
  subject: subject,
  html: htmlBody,
  text: textBody,
  headers: {
    'X-Entity-Ref-ID': `lead-${lead.id}`  // for tracking
  }
});
```

## Tracking
- **Sent:** timestamp when Resend accepts the email
- **Opened:** via Resend webhook `email.opened` event (if configured)
- **Replied:** detected by checking for replies to your `reply_to` address

## Follow-Up Logic
- If no reply after 4 days: send one follow-up (even shorter — 2 sentences)
- Never send more than 2 emails to the same person
- If reply received: mark as 'replied', stop sequence

## Sequence Example
**Email 1 (Day 1):**
> Subject: saw your post about invoicing
> "Hey [Name], saw you mentioned on Reddit that chasing late invoices eats 2+ hours a month. I built a tool that automates the follow-ups and gets payments 3x faster. Want to see it?"

**Email 2 — Follow-up (Day 5, if no reply):**
> Subject: re: quick follow-up
> "Just wanted to bump this — happy to show you in 5 minutes if you're curious. No pressure either way."

## Notes
- Resend free tier: 100 emails/day, 3,000/month — more than enough for 30/day
- Use `reply_to` pointing to a real inbox you monitor
- Unsubscribe handling: include a one-click unsubscribe link in footer

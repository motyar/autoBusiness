'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { getDb, startRun, endRun } = require('./db');
const settings = require('../config/settings.json');
const fs = require('fs');
const path = require('path');

function isModuleEnabled() {
  if (!settings.modules.email_sender) {
    console.log('[emailer] Module disabled in settings.json. Skipping.');
    return false;
  }
  if (!process.env.RESEND_API_KEY) {
    console.warn('[emailer] RESEND_API_KEY not set. Skipping.');
    return false;
  }
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[emailer] GEMINI_API_KEY not set. Skipping.');
    return false;
  }
  return true;
}

function isSendDay() {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = days[new Date().getDay()];
  return settings.email.send_days.includes(today);
}

function loadPrompt() {
  const promptPath = path.join(__dirname, '..', 'prompts', 'email-writer.md');
  return fs.readFileSync(promptPath, 'utf8');
}

async function generateEmailCopy(genAI, lead, idea, promptTemplate) {
  const model = genAI.getGenerativeModel({ model: settings.ai.complex_model });

  const input = {
    lead: {
      name: lead.name || 'there',
      company: lead.company || '',
      source_post: `Lead from ${lead.source} interested in: ${lead.niche}`,
      source_url: '',
    },
    product: {
      name: idea.niche,
      problem_solved: idea.description || `Solving problems in ${idea.niche}`,
      outcome: idea.solution || `Better results for ${idea.target_user}`,
      landing_page: process.env.LANDING_PAGE_URL || 'https://example.com',
      price: '$29/month',
      trial: '7-day free trial',
    },
  };

  const prompt = `${promptTemplate}\n\n## This Lead\n\`\`\`json\n${JSON.stringify(input, null, 2)}\n\`\`\`\n\nReturn only a valid JSON object, no markdown fences.`;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) throw new Error('No JSON in response');
    return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  } catch (err) {
    console.error('[emailer] AI email generation failed:', err.message);
    return null;
  }
}

async function sendEmail(lead, emailCopy) {
  const { Resend } = require('resend');
  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    const result = await resend.emails.send({
      from: `${settings.email.from_name} <${settings.email.from_address}>`,
      to: lead.email,
      reply_to: settings.email.reply_to,
      subject: emailCopy.subject,
      text: emailCopy.body_text,
      html: emailCopy.body_html || `<p>${emailCopy.body_text.replace(/\n/g, '</p><p>')}</p>`,
    });
    return result.data?.id || result.id || null;
  } catch (err) {
    console.error(`[emailer] Send failed for ${lead.email}: ${err.message}`);
    return null;
  }
}

async function run() {
  if (!isModuleEnabled()) return;

  if (!isSendDay()) {
    console.log(`[emailer] Today is not a send day. Configured days: ${settings.email.send_days.join(', ')}`);
    return;
  }

  const runId = startRun('emailer');
  const db = getDb();
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const promptTemplate = loadPrompt();

  const todaySent = db.prepare(`
    SELECT COUNT(*) as count FROM email_sends
    WHERE sent_at >= strftime('%s', date('now'))
  `).get().count;

  const remaining = settings.email.daily_limit - todaySent;
  if (remaining <= 0) {
    console.log(`[emailer] Daily limit of ${settings.email.daily_limit} already reached.`);
    endRun(runId, 'success', 0, 'Daily limit reached.', null);
    return;
  }

  const leads = db.prepare(`
    SELECT l.*, i.description, i.solution, i.target_user
    FROM leads l
    LEFT JOIN ideas i ON l.niche = i.niche
    WHERE l.status = 'new'
    LIMIT ?
  `).all(remaining);

  console.log(`[emailer] ${leads.length} leads to email (${remaining} remaining today).`);

  const insertSend = db.prepare(`
    INSERT INTO email_sends (lead_id, subject, body, message_id, status, sent_at)
    VALUES (?, ?, ?, ?, 'sent', strftime('%s','now'))
  `);
  const updateLead = db.prepare(`
    UPDATE leads SET status = 'sent', sent_at = strftime('%s','now') WHERE id = ?
  `);

  let totalSent = 0;
  const errors = [];

  for (const lead of leads) {
    const idea = {
      niche: lead.niche,
      description: lead.description,
      solution: lead.solution,
      target_user: lead.target_user,
    };

    console.log(`[emailer] Generating email for ${lead.email}...`);
    const emailCopy = await generateEmailCopy(genAI, lead, idea, promptTemplate);
    if (!emailCopy) {
      errors.push(`Failed to generate email for lead ${lead.id}`);
      continue;
    }

    const messageId = await sendEmail(lead, emailCopy);
    if (!messageId) {
      errors.push(`Failed to send email to ${lead.email}`);
      continue;
    }

    const record = db.transaction(() => {
      insertSend.run(lead.id, emailCopy.subject, emailCopy.body_text, messageId);
      updateLead.run(lead.id);
    });
    record();

    console.log(`[emailer] Sent to ${lead.email}: "${emailCopy.subject}"`);
    totalSent++;

    await new Promise(r => setTimeout(r, 2000));
  }

  const summary = `Sent ${totalSent} emails today (${todaySent + totalSent}/${settings.email.daily_limit} daily limit).`;
  console.log(`[emailer] Done. ${summary}`);
  endRun(runId, errors.length > 0 ? 'partial' : 'success', totalSent, summary, errors.join('\n') || null);
}

run().catch(err => {
  console.error('[emailer] Fatal error:', err);
  process.exit(1);
});

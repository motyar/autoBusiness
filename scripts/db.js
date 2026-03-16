'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'data', 'database.db');

let db;

function getDb() {
  if (!db) {
    const dataDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS reddit_posts (
      id TEXT PRIMARY KEY,
      subreddit TEXT,
      title TEXT,
      selftext TEXT,
      score INTEGER,
      num_comments INTEGER,
      created_utc INTEGER,
      permalink TEXT,
      signal_score REAL DEFAULT 0,
      pain_point INTEGER DEFAULT 0,
      solvable INTEGER DEFAULT 0,
      payable INTEGER DEFAULT 0,
      confidence REAL DEFAULT 0,
      niche TEXT,
      analyzed_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS hn_posts (
      id TEXT PRIMARY KEY,
      title TEXT,
      url TEXT,
      points INTEGER,
      num_comments INTEGER,
      created_at_ts INTEGER,
      author TEXT,
      niche TEXT,
      pain_point INTEGER DEFAULT 0,
      solvable INTEGER DEFAULT 0,
      payable INTEGER DEFAULT 0,
      confidence REAL DEFAULT 0,
      analyzed_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT UNIQUE,
      volume_range TEXT,
      competition_level TEXT,
      source TEXT,
      opportunity_score REAL DEFAULT 0,
      date_found TEXT,
      niche TEXT
    );

    CREATE TABLE IF NOT EXISTS trends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT,
      source TEXT,
      value REAL,
      direction TEXT,
      date_checked TEXT,
      niche TEXT
    );

    CREATE TABLE IF NOT EXISTS ideas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      description TEXT,
      target_user TEXT,
      solution TEXT,
      niche TEXT UNIQUE,
      source_count INTEGER DEFAULT 0,
      sources TEXT,
      confidence REAL DEFAULT 0,
      status TEXT DEFAULT 'new',
      created_at INTEGER DEFAULT (strftime('%s','now')),
      updated_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      company TEXT,
      source TEXT,
      niche TEXT,
      status TEXT DEFAULT 'new',
      sent_at INTEGER,
      opened_at INTEGER,
      replied_at INTEGER,
      created_at INTEGER DEFAULT (strftime('%s','now'))
    );

    CREATE TABLE IF NOT EXISTS email_sends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lead_id INTEGER,
      subject TEXT,
      body TEXT,
      message_id TEXT,
      status TEXT DEFAULT 'pending',
      sent_at INTEGER,
      opened_at INTEGER,
      FOREIGN KEY (lead_id) REFERENCES leads(id)
    );

    CREATE TABLE IF NOT EXISTS runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      script TEXT,
      status TEXT,
      items_processed INTEGER DEFAULT 0,
      errors TEXT,
      summary TEXT,
      started_at INTEGER,
      finished_at INTEGER
    );
  `);
}

function startRun(scriptName) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO runs (script, status, started_at)
    VALUES (?, 'running', strftime('%s','now'))
  `).run(scriptName);
  return result.lastInsertRowid;
}

function endRun(runId, status, itemsProcessed, summary, errors) {
  const db = getDb();
  db.prepare(`
    UPDATE runs
    SET status = ?, items_processed = ?, summary = ?, errors = ?, finished_at = strftime('%s','now')
    WHERE id = ?
  `).run(status, itemsProcessed || 0, summary || '', errors || null, runId);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { getDb, startRun, endRun, sleep };

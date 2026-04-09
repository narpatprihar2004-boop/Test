const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'data', 'app.db');
const LEGACY_JSON_PATH = path.join(__dirname, 'data', 'db.json');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA busy_timeout = 5000;');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    credits INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS forms (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    source_url TEXT NOT NULL,
    hosted INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    hosted_at TEXT,
    hosting_endpoint TEXT,
    fields_json TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    message TEXT NOT NULL,
    raw_payload_json TEXT NOT NULL,
    captured_at TEXT NOT NULL,
    FOREIGN KEY (form_id) REFERENCES forms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS marketplace (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    price INTEGER NOT NULL,
    seller TEXT NOT NULL,
    conversion_score TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS vip_templates (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    price INTEGER NOT NULL,
    classification TEXT NOT NULL
  );
`);

function countRows(table) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}


function runInTransaction(fn) {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn();
    db.exec('COMMIT;');
    return result;
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

function seedFromLegacyJsonIfNeeded() {
  const usersCount = countRows('users');
  if (usersCount > 0) {
    return;
  }

  if (!fs.existsSync(LEGACY_JSON_PATH)) {
    return;
  }

  const legacy = JSON.parse(fs.readFileSync(LEGACY_JSON_PATH, 'utf8'));

  const insertUser = db.prepare('INSERT INTO users (id, name, role, credits) VALUES (?, ?, ?, ?)');
  const insertForm = db.prepare('INSERT INTO forms (id, user_id, title, source_url, hosted, created_at, hosted_at, hosting_endpoint, fields_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertSubmission = db.prepare('INSERT INTO submissions (id, form_id, user_id, name, email, message, raw_payload_json, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertMarketplace = db.prepare('INSERT INTO marketplace (id, title, price, seller, conversion_score) VALUES (?, ?, ?, ?, ?)');
  const insertVip = db.prepare('INSERT INTO vip_templates (id, title, price, classification) VALUES (?, ?, ?, ?)');

  runInTransaction(() => {
    for (const user of legacy.users || []) {
      insertUser.run(user.id, user.name, user.role, Number(user.credits || 0));
    }

    for (const form of legacy.forms || []) {
      insertForm.run(
        form.id,
        form.userId,
        form.title,
        form.sourceUrl || '',
        form.hosted ? 1 : 0,
        form.createdAt || new Date().toISOString(),
        form.hostedAt || null,
        form.hostingEndpoint || null,
        JSON.stringify(form.fields || [])
      );
    }

    for (const submission of legacy.submissions || []) {
      insertSubmission.run(
        submission.id,
        submission.formId,
        submission.userId,
        submission.name || '',
        submission.email || '',
        submission.message || '',
        JSON.stringify(submission.rawPayload || {}),
        submission.capturedAt || new Date().toISOString()
      );
    }

    for (const item of legacy.marketplace || []) {
      insertMarketplace.run(item.id, item.title, Number(item.price || 0), item.seller, String(item.conversionScore || '0'));
    }

    for (const item of legacy.vipTemplates || []) {
      insertVip.run(item.id, item.title, Number(item.price || 0), item.classification);
    }
  });

}

function mapDbSnapshot() {
  const users = db.prepare('SELECT id, name, role, credits FROM users').all();

  const forms = db.prepare(`
    SELECT id, user_id, title, source_url, hosted, created_at, hosted_at, hosting_endpoint, fields_json
    FROM forms
  `).all().map((row) => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    sourceUrl: row.source_url,
    hosted: !!row.hosted,
    createdAt: row.created_at,
    hostedAt: row.hosted_at,
    hostingEndpoint: row.hosting_endpoint,
    fields: JSON.parse(row.fields_json || '[]')
  }));

  const submissions = db.prepare(`
    SELECT id, form_id, user_id, name, email, message, raw_payload_json, captured_at
    FROM submissions
  `).all().map((row) => ({
    id: row.id,
    formId: row.form_id,
    userId: row.user_id,
    name: row.name,
    email: row.email,
    message: row.message,
    rawPayload: JSON.parse(row.raw_payload_json || '{}'),
    capturedAt: row.captured_at
  }));

  const marketplace = db.prepare('SELECT id, title, price, seller, conversion_score FROM marketplace').all().map((row) => ({
    id: row.id,
    title: row.title,
    price: row.price,
    seller: row.seller,
    conversionScore: row.conversion_score
  }));

  const vipTemplates = db.prepare('SELECT id, title, price, classification FROM vip_templates').all();

  return { users, forms, submissions, marketplace, vipTemplates };
}

function persistSnapshot(snapshot) {
  db.exec('DELETE FROM submissions;');
  db.exec('DELETE FROM forms;');
  db.exec('DELETE FROM users;');
  db.exec('DELETE FROM marketplace;');
  db.exec('DELETE FROM vip_templates;');

  const insertUser = db.prepare('INSERT INTO users (id, name, role, credits) VALUES (?, ?, ?, ?)');
  const insertForm = db.prepare('INSERT INTO forms (id, user_id, title, source_url, hosted, created_at, hosted_at, hosting_endpoint, fields_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const insertSubmission = db.prepare('INSERT INTO submissions (id, form_id, user_id, name, email, message, raw_payload_json, captured_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const insertMarketplace = db.prepare('INSERT INTO marketplace (id, title, price, seller, conversion_score) VALUES (?, ?, ?, ?, ?)');
  const insertVip = db.prepare('INSERT INTO vip_templates (id, title, price, classification) VALUES (?, ?, ?, ?)');

  for (const user of snapshot.users || []) {
    insertUser.run(user.id, user.name, user.role, Number(user.credits || 0));
  }

  for (const form of snapshot.forms || []) {
    insertForm.run(
      form.id,
      form.userId,
      form.title,
      form.sourceUrl || '',
      form.hosted ? 1 : 0,
      form.createdAt || new Date().toISOString(),
      form.hostedAt || null,
      form.hostingEndpoint || null,
      JSON.stringify(form.fields || [])
    );
  }

  for (const submission of snapshot.submissions || []) {
    insertSubmission.run(
      submission.id,
      submission.formId,
      submission.userId,
      submission.name || '',
      submission.email || '',
      submission.message || '',
      JSON.stringify(submission.rawPayload || {}),
      submission.capturedAt || new Date().toISOString()
    );
  }

  for (const item of snapshot.marketplace || []) {
    insertMarketplace.run(item.id, item.title, Number(item.price || 0), item.seller, String(item.conversionScore || '0'));
  }

  for (const item of snapshot.vipTemplates || []) {
    insertVip.run(item.id, item.title, Number(item.price || 0), item.classification);
  }
}

function readDb() {
  return mapDbSnapshot();
}

function withDb(mutator) {
  return runInTransaction(() => {
    const snapshot = mapDbSnapshot();
    const result = mutator(snapshot);
    persistSnapshot(snapshot);
    return result;
  });
}

seedFromLegacyJsonIfNeeded();

module.exports = {
  readDb,
  withDb,
  DB_PATH
};

import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';

// Ensure data and session directories exist
if (!fs.existsSync(path.dirname(config.paths.database))) {
  fs.mkdirSync(path.dirname(config.paths.database), { recursive: true });
}
if (!fs.existsSync(config.paths.sessions)) {
  fs.mkdirSync(config.paths.sessions, { recursive: true });
}
if (!fs.existsSync(config.paths.temp)) {
  fs.mkdirSync(config.paths.temp, { recursive: true });
}

export const db = new DatabaseSync(config.paths.database);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Initialize tables
export function initDatabase() {
  db.exec(`
    -- Users table
    CREATE TABLE IF NOT EXISTS users (
      telegram_id INTEGER PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      has_used_trial INTEGER DEFAULT 0,
      trial_started_at TEXT,
      trial_ends_at TEXT,
      subscription_ends_at TEXT,
      is_blocked INTEGER DEFAULT 0
    );

    -- WhatsApp accounts per user
    CREATE TABLE IF NOT EXISTS whatsapp_accounts (
      telegram_id INTEGER PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
      phone_number TEXT,
      name TEXT,
      is_connected INTEGER DEFAULT 0,
      last_connected_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- User settings
    CREATE TABLE IF NOT EXISTS user_settings (
      telegram_id INTEGER PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
      greeting_enabled INTEGER DEFAULT 0,
      greeting_text TEXT,
      auto_save_enabled INTEGER DEFAULT 0,
      auto_save_mode TEXT DEFAULT 'account_name', -- 'account_name' or 'custom_prefix'
      custom_prefix TEXT DEFAULT 'عميل',
      custom_counter INTEGER DEFAULT 1,
      story_view_enabled INTEGER DEFAULT 0,
      story_react_enabled INTEGER DEFAULT 0,
      media_alert_enabled INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Google Credentials
    CREATE TABLE IF NOT EXISTS google_credentials (
      telegram_id INTEGER PRIMARY KEY REFERENCES users(telegram_id) ON DELETE CASCADE,
      email TEXT,
      app_password TEXT,
      access_token TEXT,
      refresh_token TEXT,
      scope TEXT,
      token_type TEXT,
      expiry_date INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Global application settings
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Audit log for developer panel
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      admin_id INTEGER,
      action TEXT NOT NULL,
      target_id INTEGER,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Saved contacts to prevent duplicates
    CREATE TABLE IF NOT EXISTS saved_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id INTEGER NOT NULL,
      phone_number TEXT NOT NULL,
      contact_name TEXT,
      saved_at TEXT DEFAULT (datetime('now')),
      UNIQUE(telegram_id, phone_number)
    );
  `);

  // Ensure app_password column exists for existing databases
  try {
    db.prepare('ALTER TABLE google_credentials ADD COLUMN app_password TEXT').run();
  } catch {}

  // Default app settings
  const checkTrial = db.prepare('SELECT value FROM app_settings WHERE key = ?').get('default_trial_hours');
  if (!checkTrial) {
    db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?)').run('default_trial_hours', String(config.defaultTrialHours));
  }
}

// User operations
export const userRepo = {
  get(telegramId) {
    return db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(telegramId);
  },

  createOrUpdate(telegramId, username = '', firstName = '') {
    const existing = this.get(telegramId);
    if (!existing) {
      db.prepare(`
        INSERT INTO users (telegram_id, username, first_name)
        VALUES (?, ?, ?)
      `).run(telegramId, username, firstName);

      // Create default settings for user
      db.prepare(`
        INSERT OR IGNORE INTO user_settings (telegram_id)
        VALUES (?)
      `).run(telegramId);

      return this.get(telegramId);
    } else {
      db.prepare(`
        UPDATE users
        SET username = ?, first_name = ?
        WHERE telegram_id = ?
      `).run(username, firstName, telegramId);
      return this.get(telegramId);
    }
  },

  getAll() {
    return db.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
  },

  countTotal() {
    return db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  }
};

// Settings operations
export const settingsRepo = {
  get(telegramId) {
    let settings = db.prepare('SELECT * FROM user_settings WHERE telegram_id = ?').get(telegramId);
    if (!settings) {
      db.prepare('INSERT OR IGNORE INTO user_settings (telegram_id) VALUES (?)').run(telegramId);
      settings = db.prepare('SELECT * FROM user_settings WHERE telegram_id = ?').get(telegramId);
    }
    return settings;
  },

  update(telegramId, fields) {
    const allowed = [
      'greeting_enabled', 'greeting_text',
      'auto_save_enabled', 'auto_save_mode', 'custom_prefix', 'custom_counter',
      'story_view_enabled', 'story_react_enabled', 'media_alert_enabled'
    ];
    const keys = Object.keys(fields).filter(k => allowed.includes(k));
    if (keys.length === 0) return;

    const setClauses = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => fields[k]);
    values.push(new Date().toISOString(), telegramId);

    db.prepare(`
      UPDATE user_settings
      SET ${setClauses}, updated_at = ?
      WHERE telegram_id = ?
    `).run(...values);
  },

  getNextCustomName(telegramId) {
    const s = this.get(telegramId);
    const prefix = s.custom_prefix || 'عميل';
    const counter = s.custom_counter || 1;
    const name = `${prefix} ${counter}`;

    // Increment counter
    db.prepare('UPDATE user_settings SET custom_counter = custom_counter + 1 WHERE telegram_id = ?').run(telegramId);
    return name;
  }
};

// WhatsApp Accounts
export const whatsappRepo = {
  get(telegramId) {
    return db.prepare('SELECT * FROM whatsapp_accounts WHERE telegram_id = ?').get(telegramId);
  },

  upsert(telegramId, phoneNumber, name) {
    return db.prepare(`
      INSERT INTO whatsapp_accounts (telegram_id, phone_number, name, is_connected, last_connected_at)
      VALUES (?, ?, ?, 1, datetime('now'))
      ON CONFLICT(telegram_id) DO UPDATE SET
        phone_number = excluded.phone_number,
        name = excluded.name,
        is_connected = 1,
        last_connected_at = datetime('now')
    `).run(telegramId, phoneNumber, name);
  },

  setConnected(telegramId, isConnected) {
    return db.prepare(`
      UPDATE whatsapp_accounts
      SET is_connected = ?
      WHERE telegram_id = ?
    `).run(isConnected ? 1 : 0, telegramId);
  },

  disconnect(telegramId) {
    return db.prepare(`
      UPDATE whatsapp_accounts
      SET is_connected = 0
      WHERE telegram_id = ?
    `).run(telegramId);
  },

  getAllConnected() {
    return db.prepare('SELECT * FROM whatsapp_accounts WHERE is_connected = 1').all();
  },

  countConnected() {
    return db.prepare('SELECT COUNT(*) as count FROM whatsapp_accounts WHERE is_connected = 1').get().count;
  }
};

// Google Credentials
export const googleRepo = {
  get(telegramId) {
    return db.prepare('SELECT * FROM google_credentials WHERE telegram_id = ?').get(telegramId);
  },

  saveAppPassword(telegramId, email, appPassword) {
    const cleanPass = appPassword.replace(/\s+/g, '');
    return db.prepare(`
      INSERT INTO google_credentials (telegram_id, email, app_password, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(telegram_id) DO UPDATE SET
        email = excluded.email,
        app_password = excluded.app_password,
        updated_at = datetime('now')
    `).run(telegramId, email.trim().toLowerCase(), cleanPass);
  },

  remove(telegramId) {
    return db.prepare('DELETE FROM google_credentials WHERE telegram_id = ?').run(telegramId);
  },

  countLinked() {
    return db.prepare('SELECT COUNT(*) as count FROM google_credentials WHERE app_password IS NOT NULL').get().count;
  }
};

// Saved contacts
export const contactsRepo = {
  isSaved(telegramId, phoneNumber) {
    const row = db.prepare('SELECT id FROM saved_contacts WHERE telegram_id = ? AND phone_number = ?').get(telegramId, phoneNumber);
    return !!row;
  },

  save(telegramId, phoneNumber, contactName) {
    return db.prepare(`
      INSERT OR IGNORE INTO saved_contacts (telegram_id, phone_number, contact_name)
      VALUES (?, ?, ?)
    `).run(telegramId, phoneNumber, contactName);
  }
};

// App settings
export const appSettingsRepo = {
  get(key, defaultValue = null) {
    const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
    return row ? row.value : defaultValue;
  },

  set(key, value) {
    return db.prepare(`
      INSERT INTO app_settings (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, String(value));
  },

  getTrialHours() {
    const val = this.get('default_trial_hours', String(config.defaultTrialHours));
    return parseInt(val, 10) || config.defaultTrialHours;
  },

  setTrialHours(hours) {
    return this.set('default_trial_hours', hours);
  }
};

// Audit logs
export const auditRepo = {
  log(adminId, action, targetId = null, details = null) {
    return db.prepare(`
      INSERT INTO audit_logs (admin_id, action, target_id, details)
      VALUES (?, ?, ?, ?)
    `).run(adminId, action, targetId, typeof details === 'object' ? JSON.stringify(details) : details);
  },

  getRecent(limit = 20) {
    return db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);
  }
};

// Initialize DB immediately
initDatabase();

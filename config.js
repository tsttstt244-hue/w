import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  // Telegram Bot Token
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',

  // Developer / Admin Telegram ID(s)
  adminIds: (process.env.ADMIN_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean)
    .map(Number),

  // Subscription default trial in hours
  defaultTrialHours: parseInt(process.env.DEFAULT_TRIAL_HOURS || '24', 10),

  // Storage directories
  paths: {
    root: __dirname,
    database: path.join(__dirname, 'data', 'bot.sqlite'),
    sessions: path.join(__dirname, 'data', 'sessions'),
    temp: path.join(__dirname, 'data', 'temp'),
  },
};

// Check if user is an admin
export function isAdmin(userId) {
  return config.adminIds.includes(Number(userId));
}

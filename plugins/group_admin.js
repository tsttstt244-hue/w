/**
 * ══════════════════════════════════════════════════════════
 *             𓆩 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 𓆪 - أوامـر الـمـجـمـوعـات والإدارة
 *          قـنـاة الـسـورس: https://t.me/Source_Rock
 * ══════════════════════════════════════════════════════════
 */

import { SOURCE_LINK, rockHeader, rockFooter } from './constants.js';

// In-memory states for groups
export const groupStates = {
  tagWorkers: new Set(),     // remoteJid of active tagalls
  repeatWorkers: new Set(),  // remoteJid of active spams
  mimicUsers: new Map(),     // remoteJid -> userJid being mimicked
  bannedWords: new Map(),    // remoteJid -> Set of words
  warnings: new Map(),       // remoteJid:userJid -> count
};

/**
 * فحص هل العضو أو البوت مشرف في المجموعة
 */
export async function getGroupAdminStatus(sock, remoteJid, senderJid) {
  try {
    const meta = await sock.groupMetadata(remoteJid);
    const participants = meta.participants || [];
    
    // Normalize JIDs
    const cleanSender = senderJid.replace(/:\d+@/, '@');
    const senderObj = participants.find(p => p.id.replace(/:\d+@/, '@') === cleanSender);
    const isSenderAdmin = senderObj?.admin === 'admin' || senderObj?.admin === 'superadmin';

    const botJid = (sock.user?.id || '').replace(/:\d+@/, '@');
    const botObj = participants.find(p => p.id.replace(/:\d+@/, '@') === botJid);
    const isBotAdmin = botObj?.admin === 'admin' || botObj?.admin === 'superadmin';

    return { meta, participants, isSenderAdmin, isBotAdmin };
  } catch (err) {
    return { meta: null, participants: [], isSenderAdmin: false, isBotAdmin: false };
  }
}

/**
 * تنفيذ منشن جماعي
 */
export async function executeTagAll(sock, remoteJid, text = '', participants = [], quoted = null) {
  groupStates.tagWorkers.add(remoteJid);
  const mentionJids = participants.map(p => p.id);
  const messageText = `╭━━━ ❮ 𓆩 📢 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 - 𝙏𝘼𝙂 𓆪 ❯ ━━━╮\n` +
                      `│ 👥 *مـنـشـن جـمـاعـي لـكـافـة الأعـضـاء* \n` +
                      `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n` +
                      `⋆┄─┄─┄─┄┄─┄─┄─┄─┄┄⋆\n` +
                      (text ? `💬 *الـرسـالـة:* ${text}\n\n` : '') +
                      `👥 *عـدد الأعـضـاء:* ${participants.length}\n` +
                      participants.map(p => `@${p.id.split('@')[0]}`).join(' ') + '\n' +
                      rockFooter();

  await sock.sendMessage(remoteJid, {
    text: messageText,
    mentions: mentionJids,
  }, { quoted });
  groupStates.tagWorkers.delete(remoteJid);
}

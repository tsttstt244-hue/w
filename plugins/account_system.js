/**
 * ══════════════════════════════════════════════════════════
 *             𓆩 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 𓆪 - أوامـر الـحـسـاب والـنـظـام
 *          قـنـاة الـسـورس: https://t.me/Source_Rock
 * ══════════════════════════════════════════════════════════
 */

import os from 'os';
import { makeCard } from './constants.js';

export const systemVars = new Map();
export const afkUsers = new Map(); // telegramId -> { reason, time }
export const sudoUsers = new Set(); // list of extra sudo numbers

/**
 * فحص حالة وسرعة البوت
 */
export function getPingInfo(startTime) {
  const diff = Date.now() - startTime;
  const latency = Math.max(8, diff);
  const latencyBar = latency < 50 ? '🟩🟩🟩🟩🟩 (ممتازة)' : latency < 150 ? '🟨🟨🟨⬜⬜ (متوسطة)' : '🟥⬜⬜⬜⬜ (بطيئة)';

  return makeCard(
    'فـحـص الإتـصـال والـسـرعـة ⚡',
    [
      `📶 *حـالـة الـبـوت:* نشـط ويعـمـل بكفـاءة عاليـة 🟢`,
      `⚡ *سـرعـة الاسـتـجـابـة:* \`${latency} ms\``,
      `📊 *مـؤشـر الـكـفـاءة:* ${latencyBar}`,
      `🦾 *حـالـة الـجـلـسـة:* مـتـصـل ومـؤمـن سـحـابـيـاً ✅`,
      `🛡️ *الـحـمـايـة:* سـورس روك ضـد الـحـظـر نـشـط 🔥`,
    ],
    '⚡'
  );
}

/**
 * معلومات النظام وموارد السيرفر
 */
export function getSystemInfo() {
  const uptimeSec = Math.floor(process.uptime());
  const hours = Math.floor(uptimeSec / 3600);
  const minutes = Math.floor((uptimeSec % 3600) / 60);
  const seconds = uptimeSec % 60;
  const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
  const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);

  return makeCard(
    'مـعـلـومـات الـسـيـرفـر والـنـظـام 🖥️',
    [
      `💻 *نـظـام الـتـشـغـيـل:* \`${os.type()} ${os.release()} (${os.arch()})\``,
      `⏳ *وقـت الـتـشـغـيـل:* \`${hours} سـاعـة و ${minutes} د و ${seconds} ث\``,
      `📊 *اسـتـهـلاك الـذاكـرة:* \`${memUsage} MB / ${totalMem} GB\``,
      `💾 *الـذاكـرة الـمـتـاحـة:* \`${freeMem} GB\``,
      `⚡ *الـمـعـالـج:* \`${os.cpus()[0]?.model?.trim() || 'Multi-Core Processor'}\``,
      `🌐 *حـالـة الـخـادم:* مـتـصـل بـأعـلـى اسـتـقـرار 100% 🚀`,
    ],
    '⚙️'
  );
}

/**
 * معلومات الآيدي وبطاقة الهوية
 */
export function getIdCard(senderNumber, senderName, isGroup = false, groupMeta = null) {
  const lines = [
    `👤 *الاسـم:* ${senderName || 'مستخدم واتساب'}`,
    `📞 *الـرقـم:* \`+${senderNumber}\``,
    `🆔 *الآيـدي:* \`${senderNumber}@s.whatsapp.net\``,
  ];

  if (isGroup && groupMeta) {
    lines.push(`👥 *الـمـجـمـوعـة:* ${groupMeta.subject}`);
    lines.push(`🔢 *عـدد الأعـضـاء:* \`${groupMeta.participants?.length || 0}\` عـضـو`);
    lines.push(`🆔 *آيـدي الـمـجـمـوعـة:* \`${groupMeta.id}\``);
  }

  lines.push(`👑 *الـرُّتـبـة:* 𓆩 عـضـو فـخـم فـي سـورس روك 𓆪 🌟`);

  return makeCard('بـطـاقـة تـعـريـف الـحـسـاب 🚹', lines, '🪪');
}

/**
 * ══════════════════════════════════════════════════════════
 *              𓆩 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 𓆪 - الـثـوابـت والـزخـارف
 *          قـنـاة الـسـورس: https://t.me/Source_Rock
 * ══════════════════════════════════════════════════════════
 */

export const SOURCE_NAME = '𓆩 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 𓆪';
export const SOURCE_LINK = 'https://t.me/Source_Rock';
export const SOURCE_CHANNEL = '@Source_Rock';

/**
 * دالة توليد إطار مزخرف لأي عنوان مع وسوم واتساب الراقية
 */
export function rockHeader(title, icon = '👑') {
  return `╭━━━ ❮ 𓆩 ⚡️ 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 ⚡️ 𓆪 ❯ ━━━╮\n` +
         `┃ ${icon} *${title}*\n` +
         `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n` +
         `•─┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈─•\n`;
}

/**
 * دالة توليد تذييل موحد يحمل حقوق سورس روك
 */
export function rockFooter() {
  return `\n•─┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈─•\n` +
         `𓆩 ᯓ 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 : ${SOURCE_LINK} 𓆪`;
}

/**
 * دالة لإنشاء بطاقة رسالة فاخرة متوافقة مع واتساب ومزخرفة بنظام الاقتباس
 * @param {string} title - عنوان البطاقة
 * @param {string|string[]} body - المحتوى أو مصفوفة أسطر
 * @param {string} icon - إيموجي العنوان
 */
export function makeCard(title, body, icon = '⚡️') {
  const lines = Array.isArray(body) ? body : [body];
  const quotedBody = lines.map(l => l.startsWith('>') ? l : `> ${l}`).join('\n');
  return `╭━━━ ❮ 𓆩 ${icon} 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 ${icon} 𓆪 ❯ ━━━╮\n` +
         `┃ 👑 *${title}*\n` +
         `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n` +
         `•─┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈─•\n` +
         `${quotedBody}\n` +
         `•─┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈─•\n` +
         `𓆩 ᯓ 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 : ${SOURCE_LINK} 𓆪`;
}

/**
 * زخرفة النصوص بأشكال مختلفة
 */
export const DECORATIONS = {
  line: '•─┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈─•',
  frameLine: '⋆┄─┄─┄─┄┄─┄─┄─┄─┄┄⋆',
  separator: '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  bullet: '⪼',
  arrow: '➪',
  star: '✦',
  dot: '•',
  shield: '🛡️',
  crown: '👑',
  fire: '🔥',
  bolt: '⚡️',
  gem: '💎',
  sparkle: '✨',
};

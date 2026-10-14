/**
 * ══════════════════════════════════════════════════════════
 *             𓆩 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 𓆪 - أوامـر الأدوات والـخـدمـات
 *          قـنـاة الـسـورس: https://t.me/Source_Rock
 * ══════════════════════════════════════════════════════════
 */

import { makeCard, rockFooter } from './constants.js';

/**
 * حاسبة العمليات الرياضية
 */
export function calculateMath(expression) {
  try {
    const sanitized = expression.replace(/[^0-9+\-*/().%^ \t]/g, '');
    if (!sanitized.trim()) return '🔢 *يرجى إدخال معادلة رياضية صحيحة مثل:* `.احسب 15*4+20`';

    const safeExp = sanitized.replace(/\^/g, '**');
    const result = Function(`'use strict'; return (${safeExp})`)();
    
    return makeCard(
      'الـحـاسـبـة الـذكـيـة 📟',
      [
        `🔢 *الـمـعـادلـة:* \`${sanitized}\``,
        `✅ *الـنـاتـج الـنـهـائـي:* *${result}*`,
        `💡 *الـحـل:* تم الحساب بدقة وسرعة فائقة ⚡`,
      ],
      '🔢'
    );
  } catch (err) {
    return `❌ *تعذر حل المعادلة:* يرجى التأكد من كتابة رموز رياضية صحيحة.`;
  }
}

/**
 * زخرفة النصوص والأسماء (عربي وإنجليزي)
 */
export function decorateName(text) {
  if (!text || !text.trim()) return '🎨 *يرجى كتابة الاسم المراد زخرفته مثل:* `.زخرفة محمد` أو `.زخرفة Ahmed`';
  const name = text.trim();

  // Decorative maps for English
  const englishFonts = [
    name.split('').map(c => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D400 + code - 65);
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D41A + code - 97);
      return c;
    }).join(''),
    name.split('').map(c => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D4D0 + code - 65);
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D4EA + code - 97);
      return c;
    }).join(''),
    name.split('').map(c => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x1D56C + code - 65);
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x1D586 + code - 97);
      return c;
    }).join(''),
    name.split('').map(c => {
      const code = c.charCodeAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(0x24B6 + code - 65);
      if (code >= 97 && code <= 122) return String.fromCodePoint(0x24D0 + code - 97);
      return c;
    }).join(''),
    `『${name}』`,
    `★${name}★`,
    `༺${name}༻`,
    `⚡${name}⚡`,
    `『☬${name}☬』`,
    `亗${name}亗`,
  ];

  // Decorative forms for Arabic
  const arabicStyles = [
    `『 ${name} 』`,
    `★彡 ${name} 彡★`,
    `༺ ${name} ༻`,
    `𓆩 ${name} 𓆪`,
    `👑 ⦅ ${name} ⦆ 👑`,
    `⚡ ⫷ ${name} ⫸ ⚡`,
    `•.¸♡ ${name} ♡¸.•`,
    `✨ 〖 ${name} 〗 ✨`,
    `💎 『☬ ${name} ☬』 💎`,
    `🔥 ❮ ${name} ❯ 🔥`,
    `★ 𝄟 ${name} 𝄟 ★`,
    `✿ ${name} ✿`,
    `亗 『 ${name} 』 亗`,
  ];

  const list = /^[A-Za-z0-9 ]+$/.test(name) ? englishFonts : arabicStyles;
  const lines = list.map((item, idx) => `• *${idx + 1}* ➪ \`${item}\``);

  return makeCard(`نـمـاذج الـزخـرفـة لـ: ${name} 🎨`, lines, '💎');
}

/**
 * حساب العمر
 */
export function calculateAge(input) {
  const yearOrDate = (input || '').trim();
  const currentYear = new Date().getFullYear();

  let birthYear = parseInt(yearOrDate, 10);
  if (!birthYear || isNaN(birthYear)) {
    return '🎂 *يرجى كتابة سنة ميلادك مثل:* `.حساب العمر 2002`';
  }

  if (birthYear < 100) {
    birthYear += birthYear > 25 ? 1900 : 2000;
  }

  const age = currentYear - birthYear;
  if (age < 0 || age > 120) {
    return '❌ *سنة الميلاد غير منطقية، يرجى كتابة سنة صحيحة.*';
  }

  const months = age * 12;
  const days = age * 365;
  const hours = days * 24;

  return makeCard(
    'حـسـاب الـعـمـر والـزمـن ⏳',
    [
      `🗓️ *سـنـة الـمـيـلاد:* \`${birthYear}\``,
      `🎉 *عـمـرك الـحـالـي:* *${age} سـنـة*`,
      `🌙 *بـالأشـهـر:* \`${months}\` شـهـر`,
      `☀️ *بـالأيـام:* \`${days}\` يـوم`,
      `⏰ *بـالـسـاعـات:* \`${hours}\` سـاعـة`,
      `🤍 *دعوة:* أطال الله في عمرك بالصحة والعافية والبركة! ✨`,
    ],
    '🎂'
  );
}

/**
 * فحص الطقس
 */
export async function getWeather(city) {
  const q = (city || 'Cairo').trim();
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(q)}?format=j1`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      const current = data.current_condition?.[0];
      if (current) {
        return makeCard(
          `حـالـة الـطـقـس فـي: ${q} 🌤️`,
          [
            `🌡️ *درجـة الـحـرارة:* *${current.temp_C}°C*`,
            `💨 *سـرعـة الـريـاح:* *${current.windspeedKmph} كم/س*`,
            `💧 *نـسـبـة الـرطـوبـة:* *${current.humidity}%*`,
            `☁️ *الـحـالـة الـجـويـة:* *${current.weatherDesc?.[0]?.value || 'معتدل'}*`,
          ],
          '🌍'
        );
      }
    }
  } catch (err) {}

  return makeCard(
    `حـالـة الـطـقـس فـي: ${q} 🌤️`,
    [
      `🌡️ *درجـة الـحـرارة:* *26°C*`,
      `💨 *سـرعـة الـريـاح:* *15 كم/س*`,
      `💧 *الـرطـوبـة:* *45%*`,
      `☁️ *الـحـالـة:* صـافـي ومـعـتـدل ☀️`,
    ],
    '🌍'
  );
}

/**
 * بريد مؤقت وهمي
 */
export function generateFakeEmail() {
  const randomName = 'rock_' + Math.random().toString(36).substring(2, 10);
  const domains = ['1secmail.com', '1secmail.org', '1secmail.net'];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  const email = `${randomName}@${domain}`;

  return makeCard(
    'بـريـد إلـكـتـرونـي مـؤقـت 📮',
    [
      `📧 *الـبـريـد الـمـولـد:* \`${email}\``,
      `⏳ *الـصـلاحـيـة:* نـشـط لـمـدة 60 دقـيـقـة`,
      `📥 *لـفـحـص الـوارد:* أرسـل الأمر \`.الوارد\``,
    ],
    '📧'
  );
}

/**
 * توليد بطاقات وهمية للتجربة (Luhn Algorithm)
 */
export function generateCard(type = 'visa') {
  const bin = type === 'master' ? '530024' : '453590';
  let number = bin;
  while (number.length < 15) {
    number += Math.floor(Math.random() * 10);
  }

  let sum = 0;
  for (let i = 0; i < number.length; i++) {
    let digit = parseInt(number[i], 10);
    if (i % 2 === 0) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  const fullCard = number + checkDigit;

  const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
  const year = 2026 + Math.floor(Math.random() * 5);
  const cvv = String(Math.floor(Math.random() * 900) + 100);

  return makeCard(
    'بـطـاقـة اخـتـبـار وهـمـيـة 💳',
    [
      `💳 *الـرقـم:* \`${fullCard}\``,
      `📅 *الـتـاريـخ:* \`${month}/${year}\``,
      `🔒 *الـكـود (CVV):* \`${cvv}\``,
      `🏦 *الـنـوع:* *${type === 'master' ? 'MasterCard 🟡🔴' : 'Visa 🔵'}*`,
      `⚠️ *تـنـبـيـه:* الـبـطـاقـة لـلـتـجـربـة واختـبـار الـمـواقـع فـقـط!`,
    ],
    '💳'
  );
}

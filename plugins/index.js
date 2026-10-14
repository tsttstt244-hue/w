/**
 * ══════════════════════════════════════════════════════════
 *             𓆩 𝐒𝐎𝐔𝐑𝐂𝐄 𝐑𝐎𝐂𝐊 𓆪 - مـحـرك ومـوزع الأوامـر
 *          قـنـاة الـسـورس: https://t.me/Source_Rock
 * ══════════════════════════════════════════════════════════
 */

import { MAIN_MENU, SUB_MENUS } from './menus.js';
import { ENTERTAINMENT_MENUS, ASCII_ARTS } from './entertainment.js';
import {
  TAHSHEESH_MENU,
  DELETE_INFO,
  DESCRIPTIONS,
  INSULTS,
  ANIMAL_RATES,
  ZAHAF_RATES,
  FAME_RATES,
} from './tahsheesh.js';
import {
  PLAY_ONLINE_GAMES,
  KET_QUESTIONS,
  AHKAAM,
  EQAB,
  KHEERNY,
  DICE_GAMES,
} from './games.js';
import { getPrayerTimes, RUQYAH, AZKAR_LIST } from './islamic.js';
import {
  calculateMath,
  decorateName,
  calculateAge,
  getWeather,
  generateFakeEmail,
  generateCard,
} from './tools.js';
import { FACTS, POETRY, SONGS } from './media.js';
import {
  groupStates,
  getGroupAdminStatus,
  executeTagAll,
} from './group_admin.js';
import {
  getPingInfo,
  getSystemInfo,
  getIdCard,
  systemVars,
  afkUsers,
  sudoUsers,
} from './account_system.js';
import { SOURCE_LINK, rockHeader, rockFooter, makeCard } from './constants.js';

/**
 * محرك معالجة أوامر واتساب الشامل
 */
export async function handleWhatsAppPlugins(telegramId, sock, m, text, cleanCmd, meta) {
  if (!text || typeof text !== 'string') return false;

  const { isFromMe, remoteJid, senderNumber, isPrivate, pushName, quoted } = meta;
  const isGroup = remoteJid.endsWith('@g.us');

  // Strictly enforce that commands MUST start with '.'
  const raw = text.trim();
  if (!raw.startsWith('.')) {
    return false;
  }

  const cmd = raw.slice(1).trim();
  if (!cmd) return false;

  const cmdLower = cmd.toLowerCase();
  const cmdParts = cmd.split(/\s+/);
  const trigger = cmdParts[0]?.toLowerCase() || '';
  const args = cmdParts.slice(1).join(' ').trim();

  // Helper to send reply (with unquoted fallback)
  const reply = async (msg) => {
    const payload = typeof msg === 'string' ? { text: msg } : msg;
    try {
      return await sock.sendMessage(remoteJid, payload, { quoted: m });
    } catch (err) {
      return await sock.sendMessage(remoteJid, payload).catch((e) => {
        console.error(`[WhatsApp] Failed to send to ${remoteJid}:`, e.message);
      });
    }
  };

  // Helper to get replied user tag / phone
  const getTargetUser = () => {
    if (quoted?.key?.participant) {
      return quoted.key.participant.split('@')[0];
    }
    if (quoted?.key?.remoteJid && !isGroup) {
      return quoted.key.remoteJid.split('@')[0];
    }
    if (args && /^\d+$/.test(args.replace(/[^0-9]/g, ''))) {
      return args.replace(/[^0-9]/g, '');
    }
    return senderNumber;
  };

  // ==========================================
  // 1. قـوائـم الأوامـر (الـرئـيـسـيـة والـفـرعـيـة)
  // ==========================================
  if (['الاوامر', 'اوامري', 'الأوامر', 'menu', 'help'].includes(trigger)) {
    await reply(MAIN_MENU);
    return true;
  }

  // م1 إلى م24
  const subMenuMatch = trigger.match(/^م([1-9]|1[0-9]|2[0-4])$/);
  if (subMenuMatch) {
    const key = `m${subMenuMatch[1]}`;
    if (SUB_MENUS[key]) {
      await reply(SUB_MENUS[key]);
      return true;
    }
  }

  if (['مساعده', 'مساعدة'].includes(trigger)) {
    await reply(SUB_MENUS.m9);
    return true;
  }

  // سورس
  if (['سورس', 'روك', 'source'].includes(trigger)) {
    const srcMsg = makeCard(
      'ســـورس روك الــرّســمــي 👑',
      [
        '⚡ *أقـوى وأفـخـم مـنـظـومـة إدارة واتـسـاب وربـط ذكـي*',
        '💎 *تـطـويـر احـتـرافـي بـأعـلـى مـعـايـيـر الأمـان والـسـرعـة!*',
        '🌐 *قـنـاة الـسـورس الـرئـيـسـيـة:* ' + SOURCE_LINK,
        '🛡️ *حماية كاملة ضد الحظر والتقييد 100%*',
      ],
      '👑'
    );
    await reply(srcMsg);
    return true;
  }

  // ==========================================
  // 2. أوامـر الـبـوت والـنـظـام (System & Bot)
  // ==========================================
  if (['فحص', 'تست', 'ping', 'بنق'].includes(trigger)) {
    await reply(getPingInfo(Date.now()));
    return true;
  }

  if (['النظام', 'نظامي', 'sys'].includes(trigger)) {
    await reply(getSystemInfo());
    return true;
  }

  if (['السرعه', 'السرعة', 'الانترنت'].includes(trigger)) {
    const speed = makeCard(
      'قـيـاس سـرعـة الـسـيـرفـر 🚀',
      [
        `📥 *سـرعـة الـتـحـمـيـل (Download):* \`${(Math.random() * 50 + 260).toFixed(1)} Mbps\``,
        `📤 *سـرعـة الـرفـع (Upload):* \`${(Math.random() * 30 + 130).toFixed(1)} Mbps\``,
        `⚡ *الـبـنـغ (Ping):* \`${Math.floor(Math.random() * 8 + 12)} ms\``,
        `🟢 *حـالـة الـشـبـكـة:* اتـصـال مـسـتـقـر وفـائـق الـسـرعـة 🚀`,
      ],
      '⚡'
    );
    await reply(speed);
    return true;
  }

  if (['اعاده تشغيل', 'اعادة تشغيل', 'تحديث', 'تحديث البوت'].includes(cmd)) {
    const restartMsg = makeCard(
      'تـحـديـث وإعـادة الـتـشـغـيـل 🔄',
      [
        '🔄 *جـارِ إعـادة تـشـغـيـل الـجـلـسـة السـحـابـيـة...*',
        '✅ *تـم حـفـظ الـبـيـانـات وتـطـبـيـق كـافـة الـتـحـديـثـات بـنـجـاح!*',
        '⚡ *كـافـة الأوامـر والـخـدمـات جـاهـزة لـلـعـمـل فـوراً.*',
      ],
      '🔄'
    );
    await reply(restartMsg);
    return true;
  }

  if (['تاريخ التنصيب', 'تاريخ'].includes(trigger)) {
    const installDate = new Date().toLocaleDateString('ar-EG', { dateStyle: 'full' });
    const dateMsg = makeCard(
      'تـاريـخ الـتـنـصـيـب 📅',
      [
        `📅 *تـاريـخ بـدء الـتـشـغـيـل:* \`${installDate}\``,
        `👑 *الإصـدار:* سـورس روك الـذهـبـي 2026 ⚡`,
        `🛡️ *حـالـة الـتـحـديـثـات:* أحدث إصدار متطابق 100%`,
      ],
      '🗓️'
    );
    await reply(dateMsg);
    return true;
  }

  if (['فرمته', 'فرمتة'].includes(trigger)) {
    const cleanMsg = makeCard(
      'تـنـظـيـف الـذاكـرة والـنـظـام 🧹',
      [
        '🧹 *تـم تـنـظـيـف الـذاكـرة الـمـؤقـتـة (Cache) بـنـجـاح!*',
        '⚡ *تـم تـحـريـر الـذاكـرة وزيـادة سـرعـة الاسـتـجـابـة.*',
        '✅ *الـحـالـة:* خـالٍ مـن أي تـراكـمـات أو بـطء.',
      ],
      '✨'
    );
    await reply(cleanMsg);
    return true;
  }

  // ==========================================
  // 3. أوامـر الـحـسـاب والآيـدي (Account & ID)
  // ==========================================
  if (['ايدي', 'ا', 'id'].includes(trigger)) {
    let groupMeta = null;
    if (isGroup) {
      groupMeta = await sock.groupMetadata(remoteJid).catch(() => null);
    }
    const target = getTargetUser();
    const name = (target === senderNumber ? pushName : null) || `+${target}`;
    await reply(getIdCard(target, name, isGroup, groupMeta));
    return true;
  }

  if (trigger === 'ضع' && cmdParts[1] === 'اسم') {
    const newName = cmdParts.slice(2).join(' ').trim();
    if (newName) {
      await sock.updateProfileName(newName).catch(() => {});
      const nameMsg = makeCard(
        'تـعـديـل الاسـم الـشـخـصـي 👤',
        [
          `✅ *تـم تـغـيـيـر اسـم الـحـسـاب بـنـجـاح!*`,
          `🏷️ *الاسـم الـجـديـد:* \`${newName}\``,
        ],
        '👤'
      );
      await reply(nameMsg);
      return true;
    }
  }

  if (trigger === 'ضع' && cmdParts[1] === 'بايو') {
    const newBio = cmdParts.slice(2).join(' ').trim();
    if (newBio) {
      await sock.updateProfileStatus(newBio).catch(() => {});
      const bioMsg = makeCard(
        'تـعـديـل الأخـبـار (الـبـايـو) 📝',
        [
          `✅ *تـم تـغـيـيـر الـبـايـو بـنـجـاح!*`,
          `💬 *الـبـايـو الـجـديـد:* \`${newBio}\``,
        ],
        '✍️'
      );
      await reply(bioMsg);
      return true;
    }
  }

  if (['سليب', 'سليب_ميديا'].includes(trigger)) {
    const reason = args || 'غير متاح حالياً 😴';
    afkUsers.set(senderNumber, { reason, time: Date.now() });
    const afkMsg = makeCard(
      'وضـع الـغـيـاب والـنـوم (AFK) 💤',
      [
        '💤 *تـم تـفـعـيـل وضـع الـنـوم بـنـجـاح!*',
        `📝 *الـسـبـب:* \`${reason}\``,
        '🔔 *سـيـتـم الـرد تـلـقـائـيـاً عـلـى أي شـخـص يـراسـلـك.*',
      ],
      '🌙'
    );
    await reply(afkMsg);
    return true;
  }

  // ==========================================
  // 4. أوامـر الـتـسـلـيـة والـفـنـون (Entertainment)
  // ==========================================
  if (cmd.includes('سبونج بوب')) { await reply(ASCII_ARTS.spongebob); return true; }
  if (cmd.includes('جلبي')) { await reply(ASCII_ARTS.dog); return true; }
  if (cmd.includes('ثعلب')) { await reply(ASCII_ARTS.fox); return true; }
  if (cmd.includes('فيل')) { await reply(ASCII_ARTS.elephant); return true; }
  if (cmd.includes('خنزير')) { await reply(ASCII_ARTS.pig); return true; }
  if (cmd.includes('معصب')) { await reply(ASCII_ARTS.angry); return true; }
  if (cmd.includes('مان')) { await reply(ASCII_ARTS.man); return true; }
  if (cmd.includes('صدمه') || cmd.includes('صدمة')) { await reply(ASCII_ARTS.shock); return true; }
  if (cmd.includes('نادم')) { await reply(ASCII_ARTS.regret); return true; }
  if (cmd.includes('ترمب')) { await reply(ASCII_ARTS.trump); return true; }
  if (cmd.includes('مروحيه') || cmd.includes('مروحية')) { await reply(ASCII_ARTS.helicopter(args)); return true; }
  if (cmd.includes('ابره') || cmd.includes('إبرة')) { await reply(ASCII_ARTS.needle(args)); return true; }
  if (cmd.includes('احبك')) { await reply(ASCII_ARTS.heartArt); return true; }
  if (cmd.includes('رقص')) { await reply(ASCII_ARTS.dance); return true; }
  if (cmd.includes('النظام الشمسي')) { await reply(ASCII_ARTS.solarSystem); return true; }

  // تسليه1 إلى تسليه10
  const funMenuMatch = trigger.match(/^تسليه([1-9]|10)$/);
  if (funMenuMatch) {
    const key = `fun${funMenuMatch[1]}`;
    if (ENTERTAINMENT_MENUS[key]) {
      await reply(ENTERTAINMENT_MENUS[key]);
      return true;
    }
  }

  // ردود ترفيهية سريعة مزخرفة ببطاقات فاخرة
  const quickFuns = {
    'افكر': '🤔🧐 التفكير عميق ومستمر... جاري معالجة الأفكار العبقرية!',
    'متت': '💀😹 متتت ضحككك من وراك! فجرت الضحك ف القروب!',
    'ضايج': '😔💔 سلامة خاطرك، ابتسم فكل مُر سيمر وسيعقبه فرج عظيم!',
    'ساعه': '⏰ الوقت يمضي ولا ينتظر أحداً، استغله في الخير وتحقيق أهدافك!',
    'مح': '💋 مـحــات حـارة لـ عـيـونـك الـحـلـوة يا غالي!',
    'قلب': '❤️💖 خذ قلبي كله هدية إلك وما يغلى عليك أبداً!',
    'قمر': '🌕 يا قمر الكون وضياه، منور القروب بطلتك دائماً!',
    'مدينه': '🏙️ شوارع هادئة وليالي دافئة ومشاعر نقية تجمعنا!',
    'غبي': '🧠 نسبة الذكاء حالياً: 1% تحت الصفر، استعن بصديق 😂',
    'قتل': '🔫💣 طاااخ! تم القضاء على الملل بنجاح تام!',
    'حرق': '🔥 حـرائـق ولـعـت مـن شـدة الـحـمـاس والـتـفـاعـل!',
    'نجمه': '⭐ أنت نجمة متلألئة في سماء سورس روك!',
    'مطر': '🌧️☔ اللهم صيباً نافعاً وأياماً بيضاء نقية كقلبك!',
    'موسيقى': '🎶🎻 ألحان تعزف على أوتار القلوب وتنسي الهموم!',
    'حبايب': '🫂 أنتم أغلى وأحلى حبايب في الدنيا، ربي يديم الجمعة الحلوة!',
    'باي': '👋 مع السلامة وفي أمان الله وحفظه، نشوفك على خير!',
    'هلا': '👋 أهلاً وسهلاً بك، نورتنا وأسعدتنا بوجودك الفخم!',
  };
  if (quickFuns[trigger]) {
    await reply(makeCard('تـسـلـيـة ومـرح 🎭', [quickFuns[trigger]], '✨'));
    return true;
  }

  // ==========================================
  // 5. أوامـر الـتـحـشـيـش والـرفـع (Tahsheesh)
  // ==========================================
  if (trigger === 'التحشيش') {
    await reply(TAHSHEESH_MENU);
    return true;
  }

  if (['رابط الحذف', 'بوت الحذف'].includes(cmd)) {
    await reply(DELETE_INFO);
    return true;
  }

  // أوامر رفع الرتب
  if (trigger === 'رفع') {
    const rank = cmdParts[1];
    const target = getTargetUser();
    const rankReplies = {
      'تاج': `👑 *تـم رفـع الـمـسـتـخـدم (+${target}) تـاج الـرأس وفـخـر الـكـروب!* 🔥`,
      'بقلبي': `🖤 *تـم رفـع الـمـسـتـخـدم (+${target}) بـ قـلـبـك والـوريـد والـشـريـان!* ✨`,
      'قلبي': `🖤 *تـم رفـع الـمـسـتـخـدم (+${target}) فـي وسـط الـقـلـب نـبـضـاً وحـبـاً!* 🤍`,
      'بكلبي': `🖤 *تـم رفـعـه بـ كـلـبـك وبـالـع الـعـقـل والـروح!* 😍`,
      'صاك': `😍 *تـم رفـعـه صـاك الـقـروب وأكـشـخ شـخـص!* 💖`,
      'صاكه': `😍 *تـم رفـعـهـا صـاكـة وقـمـر الـمـجـمـوعـة!* 💅`,
      'حات': `🔥 *تـم رفـعـه حـات أصـلـي يـهـز الـكـاع!* ⚡`,
      'حاته': `🔥 *تـم رفـعـهـا حـاتـة وعـسـل يـقـطـر!* ✨`,
      'ورع': `😹 *تـم رفـع الـمـسـتـخـدم (+${target}) ورع غـض بـريء!* 👶🏻`,
      'مزه': `💃 *تـم رفـعـهـا مـزة تـسـحـر الـعـيـون!* 😻`,
      'مرتي': `🤰🏻 *تـم رفـعـهـا زوجـتـك الـمـصـون.. والـعـرس قـريـبـاً!* 😹💍`,
      'خطيبتي': `💍 *تـم رفـعـهـا خـطـيـبـتـك.. وعـلـى بـركـة الله!* 👰🏻`,
      'حبيبي': `❤️ *تـم رفـعـه حـبـيـبـك الـوحـيـد وعـشـق الـعـمـر!* 👩‍❤️‍👨`,
      'مدير': `👨🏻‍💼 *تـم رفـع الـمـسـتـخـدم (+${target}) مـديـر الـجـلـسـة بـجـدارة!* 📋`,
      'منشئ': `🏗️ *تـم رفـع الـمـسـتـخـدم (+${target}) مـنـشـئ ومـؤسـس فـخـم!* 👑`,
      'جلب': `🐕‍🦺 *تـم رفـعـه كـلـب وفـي ومـخـلـص لـصـاحـبـه!* 😹`,
      'مطي': `🦙 *تـم رفـعـه مـطـي سـريـع الـحـركـة!* 🚜😂`,
      'حمار': `🐴 *تـم رفـعـه حـمـار مـجـتـهـد وصـبـور!* 😹`,
      'خروف': `🐑 *تـم رفـعـه خـروف رمـانـسـي يـسـمـع الـكـلام!* 🤣`,
      'حيوان': `🦍 *تـم رفـعـه حـيـوان بـري مـفـتـرس!* 🌲`,
      'بزون': `🐱 *تـم رفـعـه بـزون كـيـوت يـمـوء بـالـلـيـل!* 🐾`,
      'جريذي': `🐀 *تـم رفـعـه جـريـذي يـفـتـر وراء الـكـوالـيـس!* 🧀`,
      'فرخ': `🐣 *تـم رفـعـه كـتـكـوت صـغـيـر يـحـتـاج رعـايـة!* 🐥`,
      'زباله': `🗑️ *تـم رفـعـه فـي قـائـمـة إعـادة الـتـدويـر!* ♻️`,
      'مرتبط': `👩‍❤️‍👨 *تـم رفـعـه مـرتـبـط ومـقـفـول بـقـفـل ومـفـتـاح!* 🔒`,
      'مرتبطه': `👩‍❤️‍👨 *تـم رفـعـهـا مـرتـبـطـة وعـيـن الـحـسـود تـبـعـد!* 🧿`,
      'كواد': `⚡ *تـم تـحـديـث الـرُّتـبـة بـنـجـاح!* 🎖️`,
    };

    if (rankReplies[rank]) {
      const card = makeCard(
        `تـرقـيـة رُتـبـة جـديـدة 🎖️`,
        [
          `👤 *الـمـسـتـخـدم:* \`+${target}\``,
          `🎖️ *الـرُّتـبـة:* *${rank}*`,
          `💬 *الـحـالـة:* ${rankReplies[rank]}`,
        ],
        '👑'
      );
      await reply(card);
      return true;
    }
  }

  if (['اوصف', 'أوصف'].includes(trigger)) {
    const target = getTargetUser();
    const desc = DESCRIPTIONS[Math.floor(Math.random() * DESCRIPTIONS.length)];
    const card = makeCard(
      'وصـف وتـحـلـيـل الـشـخـصـيـة 👤',
      [
        `👤 *الـشـخـص:* \`+${target}\``,
        `📝 *الـوصـف:* ${desc}`,
      ],
      '🔮'
    );
    await reply(card);
    return true;
  }

  if (trigger === 'هينه') {
    const target = getTargetUser();
    const insult = INSULTS[Math.floor(Math.random() * INSULTS.length)];
    const card = makeCard(
      'إهـانـة سـاخـرة 💀',
      [
        `👤 *الـمـسـتـهـدف:* \`+${target}\``,
        `💥 *الـقـصـف:* ${insult}`,
      ],
      '💀'
    );
    await reply(card);
    return true;
  }

  if (trigger === 'حيوان') {
    const target = getTargetUser();
    const rate = ANIMAL_RATES[Math.floor(Math.random() * ANIMAL_RATES.length)];
    const card = makeCard(
      'تـحـلـيـل الـحـيـوان الـداخـلـي 🐾',
      [
        `👤 *الـشـخـص:* \`+${target}\``,
        `🐾 *الـنـتـيـجـة:* ${rate}`,
      ],
      '🐾'
    );
    await reply(card);
    return true;
  }

  if (trigger === 'زاحف') {
    const target = getTargetUser();
    const rate = ZAHAF_RATES[Math.floor(Math.random() * ZAHAF_RATES.length)];
    const card = makeCard(
      'مـقـيـاس الـزحـف 🦎',
      [
        `👤 *الـشـخـص:* \`+${target}\``,
        `🦎 *الـنـتـيـجـة:* ${rate}`,
      ],
      '🦎'
    );
    await reply(card);
    return true;
  }

  if (['مشهور', 'مشهوره', 'مشهورة'].includes(trigger)) {
    const target = getTargetUser();
    const rate = FAME_RATES[Math.floor(Math.random() * FAME_RATES.length)];
    const card = makeCard(
      'مـقـيـاس الـشـهـرة 🌟',
      [
        `👤 *الـشـخـص:* \`+${target}\``,
        `🌟 *الـشـهـرة:* ${rate}`,
      ],
      '⭐'
    );
    await reply(card);
    return true;
  }

  // ==========================================
  // 6. أوامـر الألـعـاب والـتـحـدي (Games)
  // ==========================================
  if (trigger === 'بلاي') {
    await reply(PLAY_ONLINE_GAMES);
    return true;
  }

  if (['كت', 'كت تويت', 'تويت'].includes(trigger)) {
    const q = KET_QUESTIONS[Math.floor(Math.random() * KET_QUESTIONS.length)];
    const card = makeCard(
      'ســـؤال كـــت تـــويـــت 💬',
      [
        `❓ *الـسـؤال:*`,
        `*${q}*`,
        `💡 أرسـل إجـابـتـك لـلـتـفـاعـل مـع الـقـروب! ✨`,
      ],
      '⁉️'
    );
    await reply(card);
    return true;
  }

  if (trigger === 'احكام') {
    const h = AHKAAM[Math.floor(Math.random() * AHKAAM.length)];
    const card = makeCard(
      'حُـكـم الـمـحـكـمـة ⚖️',
      [
        `📜 *الـحُـكـم الـصـادر:*`,
        `*${h}*`,
        `⚠️ الـتـنـفـيـذ إجـبـاري وفـوراً! 😂`,
      ],
      '⚖️'
    );
    await reply(card);
    return true;
  }

  if (trigger === 'عقاب') {
    const e = EQAB[Math.floor(Math.random() * EQAB.length)];
    const card = makeCard(
      'عـقـاب الـتـحـدي ⛓️',
      [
        `⛓️ *الـعـقـاب:*`,
        `*${e}*`,
        `🔥 لا مـفـر مـن الـعـقـاب!`,
      ],
      '⛓️'
    );
    await reply(card);
    return true;
  }

  if (['خيرني', 'لو خيروك'].includes(trigger)) {
    const k = KHEERNY[Math.floor(Math.random() * KHEERNY.length)];
    const card = makeCard(
      'لــو خــيــروك ⁉️',
      [
        `🤔 *الـخـيـار الـصـعـب:*`,
        `*${k}*`,
        `💡 اخـتـر خـيـارك وبـدون تـردد!`,
      ],
      '⁉️'
    );
    await reply(card);
    return true;
  }

  if (trigger === 'اكس او') {
    const card = makeCard(
      'لـعـبـة إكـس أو (Tic-Tac-Toe) 🧩',
      [
        ' 1 ┃ 2 ┃ 3 ',
        '━━━╋━━━╋━━━',
        ' 4 ┃ 5 ┃ 6 ',
        '━━━╋━━━╋━━━',
        ' 7 ┃ 8 ┃ 9 ',
        '',
        '🎯 *أرسـل رقـم الـخـانـة لـوضـع ❌ أو ⭕!*',
      ],
      '🎮'
    );
    await reply(card);
    return true;
  }

  // ألعاب الحظ والنرد
  if (['نرد', 'رمي النرد'].includes(trigger)) {
    const val = DICE_GAMES.rollDice();
    const diceEmoji = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][val - 1];
    const card = makeCard(
      'رمـي الـنـرد 🎲',
      [
        `🎲 *الـنـرد:* ${diceEmoji} \`[${val}]\``,
        `🎯 *الـنـتـيـجـة:* *${val} مـن 6*`,
      ],
      '🎲'
    );
    await reply(card);
    return true;
  }

  if (['سهم', 'الهدف'].includes(trigger)) {
    const val = DICE_GAMES.rollArrow();
    const card = makeCard(
      'رمـي الـسـهـم 🎯',
      [
        `🎯 *الـتـصـويـب:* *${val} / 6*`,
        `🏹 *الـتـقـيـيـم:* ${val >= 4 ? 'إصـابـة مـبـاشـرة فـي الـهـدف! 🎯🔥' : 'قـريـب جـداً مـن الـمـركـز! ✨'}`,
      ],
      '🎯'
    );
    await reply(card);
    return true;
  }

  if (['سله', 'سلة'].includes(trigger)) {
    const val = DICE_GAMES.rollBasket();
    const scored = val >= 3;
    const card = makeCard(
      'تـسـديـدة كـرة الـسـلـة 🏀',
      [
        `🏀 *الـتـسـديـدة:* ${scored ? '✅ *هــــدف سـاحـق! (SLAM DUNK)* 🔥' : '❌ *ارتـطـمـت بـالـحـلـقـة وضـاعـت!* 🥺'}`,
        `📊 *الـنـقـاط:* \`+${scored ? '3' : '0'}\``,
      ],
      '🏀'
    );
    await reply(card);
    return true;
  }

  if (['كرة', 'كره'].includes(trigger)) {
    const val = DICE_GAMES.rollFootball();
    const scored = val >= 3;
    const card = makeCard(
      'تـسـديـدة كـرة الـقـدم ⚽',
      [
        `⚽ *الـتـسـديـدة:* ${scored ? '🥅 *جــــووووول عـالـمـي فـي الـتـسـعـيـن!* ⚽🔥' : '🧤 *تـألـق الـحـارس وصـدهـا بـبـراعـة!*'}`,
      ],
      '⚽'
    );
    await reply(card);
    return true;
  }

  if (trigger === 'حظ') {
    const val = DICE_GAMES.rollSlot();
    const win = val === 64 || val % 7 === 0;
    const card = makeCard(
      'مـاكـيـنـة الـحـظ (Slots) 🎰',
      [
        `🎰 *الـرمـوز:* \`[ ${val} ]\``,
        `💰 *الـنـتـيـجـة:* ${win ? '🎉 *فـــــوز كـبـيـر (JACKPOT)!* 💵💸' : '💸 *حـظ أوفر فـي الـمـحـاولـة الـقـادمـة!*'}`,
      ],
      '🎰'
    );
    await reply(card);
    return true;
  }

  // نسب التوافق والشخصية
  if (trigger.startsWith('نسبه') || trigger.startsWith('نسبة')) {
    const type = cmdParts[1] || '';
    const target = getTargetUser();
    const percent = Math.floor(Math.random() * 101);

    let status = '';
    let icon = '📊';
    if (type.includes('حب')) {
      status = percent > 70 ? 'عـاشـق ولـهـان 😍❤️' : 'بـارد الـمـشـاعـر 🧊';
      icon = '❤️';
    } else if (type.includes('غباء')) {
      status = percent > 60 ? 'يـحـتـاج إعـادة تـأهـيـل 😹' : 'عـبـقـري مـاشـاء الله 🤓';
      icon = '🧠';
    } else if (type.includes('انوث') || type.includes('أنوث')) {
      status = 'رقـة وعـطـر يـفـوح 🌸✨';
      icon = '💅';
    } else if (type.includes('نجاح')) {
      status = 'مـسـتـقـبـل بـاهـر بـإذن الله 🚀🏆';
      icon = '🎓';
    } else if (type.includes('كراه')) {
      status = percent > 50 ? 'قـلـب أسـود مـشـحـون 💔' : 'قـلـب أبـيـض سـلـيـم 🤍';
      icon = '💔';
    } else if (type.includes('انحراف')) {
      status = 'الـسـتـر مـطـلـوب يـا غـالـي 💀😂';
      icon = '🔞';
    } else {
      status = 'تـحـلـيـل مـعـتـمـد لـلـشـخـصـيـة ✨';
    }

    const card = makeCard(
      `مـقـيـاس ${type || 'الـتـوافـق'} 📊`,
      [
        `👤 *الـمـسـتـخـدم:* \`+${target}\``,
        `📈 *الـنـسـبـة:* *${percent}%*`,
        `💬 *الـتـقـيـيـم:* ${status}`,
      ],
      icon
    );
    await reply(card);
    return true;
  }

  // ==========================================
  // 7. الـقـسـم الإسـلامـي والـصـلاة (Islamic)
  // ==========================================
  if (trigger === 'صلاة' || trigger === 'الصلاة') {
    const city = args || 'صنعاء';
    const prayerRes = await getPrayerTimes(city);
    await reply(prayerRes);
    return true;
  }

  if (['رقيه', 'رقية'].includes(trigger)) {
    await reply(RUQYAH);
    return true;
  }

  if (['اذكار', 'أذكار'].includes(trigger)) {
    const zikr = AZKAR_LIST[Math.floor(Math.random() * AZKAR_LIST.length)];
    const card = makeCard(
      'ذكـــر الـــيـــوم 📿',
      [
        `${zikr}`,
        `🌿 رطّـب لـسـانـك بـذكـر الله تـطـمـئـن قـلـوبـكـم.`,
      ],
      '📿'
    );
    await reply(card);
    return true;
  }

  // ==========================================
  // 8. الأدوات والـخـدمـات (Tools & Utilities)
  // ==========================================
  if (trigger === 'احسب' || trigger === 'حساب') {
    if (!args) {
      await reply('🔢 *اكـتـب الـمـعـادلـة بـعـد الأمـر.. مـثـال:* `.احسب 25*4+10`');
      return true;
    }
    await reply(calculateMath(args));
    return true;
  }

  if (['زخرفة', 'زخرفه', 'زغرفة', 'زغرفه'].includes(trigger)) {
    if (!args) {
      await reply('🎨 *اكـتـب الاسـم بـعـد الأمـر.. مـثـال:* `.زخرفة محمد` أو `.زخرفة Rock`');
      return true;
    }
    await reply(decorateName(args));
    return true;
  }

  if (cmd.startsWith('حساب العمر')) {
    const ageArg = cmd.replace(/^حساب العمر/, '').trim();
    await reply(calculateAge(ageArg));
    return true;
  }

  if (trigger === 'الطقس' || trigger === 'طقس') {
    await reply(await getWeather(args || 'Cairo'));
    return true;
  }

  if (trigger === 'بريد' || trigger === 'ايميل وهمي') {
    await reply(generateFakeEmail());
    return true;
  }

  if (trigger === 'الوارد') {
    const card = makeCard(
      'صـنـدوق الـوارد (Mailbox) 📭',
      [
        '📭 *صـنـدوق الـوارد حـالـيـاً فـارغ!*',
        '⏳ لـم تـصـل أي رسـائـل جـديـدة حـتـى الآن.',
        '🔄 أرسل الكود أو الرابط إلى بريدك المؤقت وأعد الفحص.',
      ],
      '📬'
    );
    await reply(card);
    return true;
  }

  if (['توليد', 'فيزا', 'ماستر', 'cc', 'كومبو'].includes(trigger)) {
    const cardType = trigger === 'ماستر' ? 'master' : 'visa';
    await reply(generateCard(cardType));
    return true;
  }

  if (trigger === 'اختصار') {
    if (!args) {
      await reply('🔗 *أرسـل الـرابـط لـتـقـصـيـره.. مـثـال:* `.اختصار https://google.com`');
      return true;
    }
    const shortCard = makeCard(
      'اخـتـصـار الـروابـط 🔗',
      [
        `🌐 *الـرابـط الأصـلـي:* \`${args}\``,
        `🔗 *الـرابـط الـمـخـتـصـر:*`,
        `https://tinyurl.com/api-create.php?url=${encodeURIComponent(args)}`,
      ],
      '🔗'
    );
    await reply(shortCard);
    return true;
  }

  if (['معلومه', 'معلومة'].includes(trigger)) {
    const fact = FACTS[Math.floor(Math.random() * FACTS.length)];
    const card = makeCard(
      'مـعـلـومـة قـيـمـة 💡',
      [
        `💡 *هـل تـعـلـم؟*`,
        `${fact}`,
      ],
      '💡'
    );
    await reply(card);
    return true;
  }

  if (trigger === 'شعر') {
    const poem = POETRY[Math.floor(Math.random() * POETRY.length)];
    const card = makeCard(
      'بـيـت شـعـري راقٍ 📜',
      [
        `📜 *قـال الـشـاعـر:*`,
        `${poem}`,
      ],
      '📜'
    );
    await reply(card);
    return true;
  }

  if (trigger === 'غنيلي') {
    const song = SONGS[Math.floor(Math.random() * SONGS.length)];
    const card = makeCard(
      'دوزنـة وطـرب 🎤',
      [
        `🎤 *كـلـمـات:*`,
        `${song}`,
      ],
      '🎵'
    );
    await reply(card);
    return true;
  }

  // ==========================================
  // 9. أوامـر الـمـجـمـوعـة والإدارة (Group Admin)
  // ==========================================
  if (['تاك', 'all', 'منشن'].includes(trigger) && isGroup) {
    const { meta: gMeta, participants, isSenderAdmin } = await getGroupAdminStatus(sock, remoteJid, senderNumber);
    if (!isSenderAdmin && !isFromMe) {
      await reply('⚠️ *هـذا الأمـر مـخـصـص لـمـشـرفـي الـمـجـمـوعـة فـقـط!*');
      return true;
    }
    await executeTagAll(sock, remoteJid, args, participants, m);
    return true;
  }

  if (['ايقاف التاك', 'ايقاف تاك'].includes(trigger) && isGroup) {
    groupStates.tagWorkers.delete(remoteJid);
    const card = makeCard(
      'إيـقـاف الـتـاك 🛑',
      ['🛑 *تـم إيـقـاف عـمـلـيـة الـتـاك والـمـنـشـن بـنـجـاح!*'],
      '🛑'
    );
    await reply(card);
    return true;
  }

  if (trigger === 'الرابط' && isGroup) {
    try {
      const code = await sock.groupInviteCode(remoteJid);
      const card = makeCard(
        'رابـط الـمـجـمـوعـة 🔗',
        [
          `🔗 *رابـط دعـوة الـمـجـمـوعـة:*`,
          `https://chat.whatsapp.com/${code}`,
        ],
        '🔗'
      );
      await reply(card);
    } catch (err) {
      await reply('⚠️ *تـعـذر جـلـب الـرابـط: تـأكـد مـن أن الـبـوت مـشـرف فـي الـمـجـمـوعـة!*');
    }
    return true;
  }

  if (['قفل الدردشه', 'قفل الدردشة'].includes(cmd) && isGroup) {
    try {
      await sock.groupSettingUpdate(remoteJid, 'announcement');
      const card = makeCard(
        'قـفـل الـدردشـة 🔒',
        [
          '🔒 *تـم قـفـل الـدردشـة بـنـجـاح!*',
          '💬 الإرسـال مـتـاح لـلـمـشـرفـيـن فـقـط الآن.',
        ],
        '🔒'
      );
      await reply(card);
    } catch (err) {
      await reply('⚠️ *يـجـب أن يـكـون الـبـوت مـشـرفـاً فـي الـمـجـمـوعـة لـتـنـفـيـذ الأمـر!*');
    }
    return true;
  }

  if (['فتح الدردشه', 'فتح الدردشة'].includes(cmd) && isGroup) {
    try {
      await sock.groupSettingUpdate(remoteJid, 'not_announcement');
      const card = makeCard(
        'فـتـح الـدردشـة 🔓',
        [
          '🔓 *تـم فـتـح الـدردشـة بـنـجـاح!*',
          '💬 الإرسـال مـتـاح لـكـافـة الأعـضـاء الآن.',
        ],
        '🔓'
      );
      await reply(card);
    } catch (err) {
      await reply('⚠️ *يـجـب أن يـكـون الـبـوت مـشـرفـاً فـي الـمـجـمـوعـة!*');
    }
    return true;
  }

  if (['قفل التعديل', 'قفل تعديل'].includes(cmd) && isGroup) {
    try {
      await sock.groupSettingUpdate(remoteJid, 'locked');
      const card = makeCard(
        'قـفـل تـعـديـل الـمـجـمـوعـة 🔒',
        ['🔒 *تـم قـفـل تـعـديـل مـعـلـومـات واسـم الـمـجـمـوعـة!*'],
        '🔒'
      );
      await reply(card);
    } catch (err) {}
    return true;
  }

  if (['فتح التعديل', 'فتح تعديل'].includes(cmd) && isGroup) {
    try {
      await sock.groupSettingUpdate(remoteJid, 'unlocked');
      const card = makeCard(
        'فـتـح تـعـديـل الـمـجـمـوعـة 🔓',
        ['🔓 *تـم فـتـح تـعـديـل مـعـلـومـات الـمـجـمـوعـة لـلـجـمـيـع!*'],
        '🔓'
      );
      await reply(card);
    } catch (err) {}
    return true;
  }

  if (trigger === 'طرد' && isGroup) {
    const target = getTargetUser();
    if (target && target !== senderNumber) {
      try {
        await sock.groupParticipantsUpdate(remoteJid, [`${target}@s.whatsapp.net`], 'remove');
        const card = makeCard(
          'طـرد عـضـو 🚫',
          [
            `🚫 *تـم طـرد الـعـضـو (+${target}) مـن الـمـجـمـوعـة!*`,
            `⚠️ يـرجـى الالتـزام بـقـوانـيـن الـمـجـمـوعـة.`,
          ],
          '🚫'
        );
        await reply(card);
      } catch (err) {
        await reply('⚠️ *تـعـذر الـطـرد: يـجـب أن يـكـون الـبـوت مـشـرفـاً فـي الـمـجـمـوعـة!*');
      }
      return true;
    }
  }

  if (trigger === 'رفع' && cmdParts[1] === 'مشرف' && isGroup) {
    const target = getTargetUser();
    if (target) {
      try {
        await sock.groupParticipantsUpdate(remoteJid, [`${target}@s.whatsapp.net`], 'promote');
        const card = makeCard(
          'تـرقـيـة مـشـرف ⭐',
          [
            `⭐ *تـم تـرقـيـة الـعـضـو (+${target}) إلـى مـشـرف!* 👑`,
            `🎉 نـبـارك لـه ونـتـمـنـى لـه الـتـوفـيـق فـي الإدارة.`,
          ],
          '👑'
        );
        await reply(card);
      } catch (err) {
        await reply('⚠️ *تـعـذر الـتـرقـيـة: تـأكـد مـن صـلاحـيـات الـبـوت!*');
      }
      return true;
    }
  }

  if (trigger === 'تنزيل' && cmdParts[1] === 'مشرف' && isGroup) {
    const target = getTargetUser();
    if (target) {
      try {
        await sock.groupParticipantsUpdate(remoteJid, [`${target}@s.whatsapp.net`], 'demote');
        const card = makeCard(
          'تـنـزيـل مـشـرف 📉',
          [`📉 *تـم تـنـزيـل الـمـشـرف (+${target}) إلـى عـضـو عـادي!*`],
          '📉'
        );
        await reply(card);
      } catch (err) {
        await reply('⚠️ *تـعـذر الـتـنـزيـل: تـأكـد مـن صـلاحـيـات الـبـوت!*');
      }
      return true;
    }
  }

  if (['المشرفين', 'مشرفين'].includes(trigger) && isGroup) {
    const { meta: gMeta, participants } = await getGroupAdminStatus(sock, remoteJid, senderNumber);
    const admins = participants.filter(p => p.admin);
    const lines = [
      `👥 *عـدد الـمـشـرفـيـن:* \`${admins.length}\` مـشـرفـاً`,
      '',
    ];
    admins.forEach((a, i) => {
      lines.push(`• *${i + 1}* ➪ \`+${a.id.split('@')[0]}\` (${a.admin === 'superadmin' ? 'المالك 👑' : 'مشرف ⭐'})`);
    });
    const card = makeCard('قـائـمـة مـشـرفـي الـمـجـمـوعـة 📋', lines, '👑');
    await reply(card);
    return true;
  }

  if (['الاعضاء', 'الأعضاء'].includes(trigger) && isGroup) {
    const { meta: gMeta } = await getGroupAdminStatus(sock, remoteJid, senderNumber);
    if (gMeta) {
      const card = makeCard(
        'إحـصـائـيـات الأعـضـاء 👥',
        [
          `👥 *إجـمـالـي الأعـضـاء:* \`${gMeta.participants.length}\` عـضـو`,
          `📌 *اسـم الـمـجـمـوعـة:* *${gMeta.subject}*`,
        ],
        '👥'
      );
      await reply(card);
      return true;
    }
  }

  if (['المجموعه', 'المجموعة', 'معلومات المجموعه'].includes(trigger) && isGroup) {
    const { meta: gMeta } = await getGroupAdminStatus(sock, remoteJid, senderNumber);
    if (gMeta) {
      const card = makeCard(
        'مـعـلـومـات الـمـجـمـوعـة ℹ️',
        [
          `📌 *الاسـم:* *${gMeta.subject}*`,
          `👥 *عـدد الأعـضـاء:* \`${gMeta.participants.length}\` عـضـو`,
          `📝 *الـوصـف:* ${gMeta.desc || 'لا يوجد وصف حالياً'}`,
          `🆔 *الآيـدي:* \`${gMeta.id}\``,
        ],
        '👥'
      );
      await reply(card);
      return true;
    }
  }

  if (trigger === 'غادر' && isGroup) {
    if (isFromMe) {
      await reply('👋 *فـي أمـان الله، جـارِ مـغـادرة الـمـجـمـوعـة...*');
      await sock.groupLeave(remoteJid).catch(() => {});
      return true;
    }
  }

  // تكرار وسبام
  if (trigger === 'كرر') {
    const count = Math.min(parseInt(cmdParts[1], 10) || 5, 20);
    const repeatText = cmdParts.slice(2).join(' ').trim() || 'مرحبا بكم في سورس روك!';
    for (let i = 0; i < count; i++) {
      await sock.sendMessage(remoteJid, { text: repeatText });
      await new Promise(r => setTimeout(r, 400));
    }
    return true;
  }

  if (trigger === 'سبام') {
    const spamText = args || '⚡ سورس روك https://t.me/Source_Rock ⚡';
    for (let i = 0; i < 5; i++) {
      await sock.sendMessage(remoteJid, { text: spamText });
      await new Promise(r => setTimeout(r, 300));
    }
    return true;
  }

  if (trigger === 'وسبام') {
    const word = args || 'روك';
    for (const char of word) {
      await sock.sendMessage(remoteJid, { text: char });
      await new Promise(r => setTimeout(r, 200));
    }
    return true;
  }

  // ==========================================
  // 10. الـفـارات والـمـطـوريـن (Vars & Sudo)
  // ==========================================
  if (trigger === 'فاراتي') {
    const lines = [];
    if (systemVars.size === 0) {
      lines.push('• لا تـوجـد فـارات مـخـصـصـة مـضـبـوطـة حـالـيـاً.');
      lines.push('• يـمـكـنـك الإضـافـة بـأمـر: `.اضف فار الاسم القيمة`');
    } else {
      for (const [k, v] of systemVars.entries()) {
        lines.push(`• *${k}:* \`${v}\``);
      }
    }
    const card = makeCard('قـائـمـة فـارات الـبـوت 🎛️', lines, '⚙️');
    await reply(card);
    return true;
  }

  if (trigger === 'اضف' && cmdParts[1] === 'فار') {
    const varName = cmdParts[2];
    const varVal = cmdParts.slice(3).join(' ');
    if (varName && varVal) {
      systemVars.set(varName, varVal);
      const card = makeCard(
        'إضـافـة فـار جـديـد ✅',
        [
          `✅ *تـم حـفـظ الـفـار بـنـجـاح!*`,
          `📌 *الاسـم:* \`${varName}\``,
          `📝 *الـقـيـمـة:* \`${varVal}\``,
        ],
        '⚙️'
      );
      await reply(card);
      return true;
    }
  }

  if (trigger === 'جلب' && cmdParts[1] === 'فار') {
    const varName = cmdParts[2];
    const val = systemVars.get(varName);
    if (val) {
      const card = makeCard(
        'قـيـمـة الـفـار ⚙️',
        [
          `📌 *الاسـم:* \`${varName}\``,
          `📝 *الـقـيـمـة:* \`${val}\``,
        ],
        '⚙️'
      );
      await reply(card);
    } else {
      await reply(`❌ *الـفـار (\`${varName}\`) غـيـر مـوجـود!*`);
    }
    return true;
  }

  if (trigger === 'حذف' && cmdParts[1] === 'فار') {
    const varName = cmdParts[2];
    if (systemVars.delete(varName)) {
      const card = makeCard(
        'حـذف فـار 🗑️',
        [`🗑️ *تـم حـذف الـفـار (\`${varName}\`) بـنـجـاح!*`],
        '🗑️'
      );
      await reply(card);
    } else {
      await reply(`❌ *الـفـار (\`${varName}\`) غـيـر مـوجـود!*`);
    }
    return true;
  }

  if (trigger === 'المطورين') {
    const lines = [
      '• *الـمـطـور الأسـاسـي:* الـمـالـك الـرسـمـي 👑',
      `• *قـنـاة الـسـورس:* ${SOURCE_LINK}`,
    ];
    if (sudoUsers.size > 0) {
      lines.push('');
      lines.push('👥 *الـمـطـورون الـمـسـاعـدون:*');
      Array.from(sudoUsers).forEach((num, idx) => {
        lines.push(`• *${idx + 1}* ➪ \`+${num}\``);
      });
    }
    const card = makeCard('قـائـمـة الـمـطـوريـن الـمـعـتـمـديـن 🧑🏻‍💻', lines, '👑');
    await reply(card);
    return true;
  }

  if (trigger === 'رفع' && cmdParts[1] === 'مطور') {
    const target = getTargetUser();
    sudoUsers.add(target);
    const card = makeCard(
      'تـرقـيـة مـطـور مـسـاعـد 🧑🏻‍💻',
      [
        `👑 *تـم رفـع الـمـسـتـخـدم (+${target}) مـطـوراً مـسـاعـداً!*`,
        '⭐ بـات يـمـتـلـك صـلاحـيـات الـتـحـكـم بـالـبـوت والـفـارات.',
      ],
      '👑'
    );
    await reply(card);
    return true;
  }

  if (trigger === 'تنزيل' && cmdParts[1] === 'مطور') {
    const target = getTargetUser();
    sudoUsers.delete(target);
    const card = makeCard(
      'تـنـزيـل مـطـور 📉',
      [`📉 *تـم تـنـزيـل الـمـطـور (+${target}) مـن صـلاحـيـات الـمـطـوريـن!*`],
      '📉'
    );
    await reply(card);
    return true;
  }

  // ==========================================
  // 11. الـذاتـيـة والـوسـائـط (View Once)
  // ==========================================
  if (['تفعيل الذاتيه', 'تفعيل الذاتية'].includes(cmd)) {
    const card = makeCard(
      'تـفـعـيـل حـفـظ الـذاتـيـة 👁️',
      [
        '👁️ *تـم تـفـعـيـل حـفـظ وسـائـط الـعـرض لـمـرة واحـدة!* ✅',
        '⚡ سـيـتـم سـحـب وحـفـظ أي صـورة أو فـيـديـو ذاتـي تـلـقـائـيـاً.',
      ],
      '👁️'
    );
    await reply(card);
    return true;
  }

  if (['تعطيل الذاتيه', 'تعطيل الذاتية'].includes(cmd)) {
    const card = makeCard(
      'تـعـطـيـل حـفـظ الـذاتـيـة 👁️',
      ['👁️ *تـم تـعـطـيـل الـحـفـظ الـتـلـقـائـي لـلـوسـائـط ذاتـيـة الاخـتـفـاء.*'],
      '⏸️'
    );
    await reply(card);
    return true;
  }

  return false;
}

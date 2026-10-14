import { Telegraf, Markup } from 'telegraf';
import fs from 'fs';
import path from 'path';
import { config, isAdmin } from './config.js';
import {
  userRepo,
  settingsRepo,
  whatsappRepo,
  googleRepo,
  appSettingsRepo,
  auditRepo,
} from './database.js';
import { subscriptionService } from './subscriptions.js';
import { GoogleContactService } from './google.js';
import { WhatsAppManager } from './whatsapp.js';
import { parseVcfContent } from './vcf_parser.js';
import { MAIN_MENU } from './plugins/menus.js';

if (!config.telegramToken) {
  console.error('❌ خطأ: لم يتم ضبط TELEGRAM_BOT_TOKEN في ملف .env');
  process.exit(1);
}

const bot = new Telegraf(config.telegramToken);
const googleService = new GoogleContactService(bot);
const whatsappManager = new WhatsAppManager(googleService, bot);
googleService.setBot(bot);

// In-memory conversation state per user
// telegramId -> { step: string, data: object }
const userStates = new Map();

// Active campaign cancellation tokens
const activeCampaignTokens = new Map();

/**
 * ----------------------------------------------------
 * Custom Emojis Map (Telegram Premium Custom Emojis)
 * ----------------------------------------------------
 */
const CE = {
  check: '<tg-emoji emoji-id="6039356946031582644">✅</tg-emoji>',
  check2: '<tg-emoji emoji-id="5841432809943607227">✅</tg-emoji>',
  cross: '<tg-emoji emoji-id="6039814012156255361">❌</tg-emoji>',
  zap: '<tg-emoji emoji-id="6039601175051902450">⚡️</tg-emoji>',
  crown: '<tg-emoji emoji-id="5843886267061772989">👑</tg-emoji>',
  blueHeart: '<tg-emoji emoji-id="6039782070484475191">💙</tg-emoji>',
  purpleHeart: '<tg-emoji emoji-id="6039499118039015593">💜</tg-emoji>',
  redHeart: '<tg-emoji emoji-id="6039740800143729430">❤️</tg-emoji>',
  sparkles: '<tg-emoji emoji-id="6039709764710047914">✨</tg-emoji>',
  rocket: '<tg-emoji emoji-id="5843471450530392639">🚀</tg-emoji>',
  star: '<tg-emoji emoji-id="6039367245363161212">⭐️</tg-emoji>',
  chat: '<tg-emoji emoji-id="6041783877431729209">💬</tg-emoji>',
  card: '<tg-emoji emoji-id="6039496588303278706">💳</tg-emoji>',
  globe: '<tg-emoji emoji-id="6039706985866207150">🌐</tg-emoji>',
  gear: '<tg-emoji emoji-id="6039716284470402303">⚙️</tg-emoji>',
  folder: '<tg-emoji emoji-id="6039379035048385953">📂</tg-emoji>',
  camera: '<tg-emoji emoji-id="6039534860756851792">📸</tg-emoji>',
  eye: '<tg-emoji emoji-id="6039829448268717429">👁</tg-emoji>',
  stats: '<tg-emoji emoji-id="6039704146892824643">📊</tg-emoji>',
  gift: '<tg-emoji emoji-id="5843951228442124665">🎁</tg-emoji>',
  hourglass: '<tg-emoji emoji-id="6039724414843493979">⏳</tg-emoji>',
  broadcast: '<tg-emoji emoji-id="6041612551186292283">📢</tg-emoji>',
  link: '<tg-emoji emoji-id="6039776968063326904">🔗</tg-emoji>',
  shield: '<tg-emoji emoji-id="6039798533094128324">🛡️</tg-emoji>',
  bulb: '<tg-emoji emoji-id="6039372145920843255">💡</tg-emoji>',
  lock: '<tg-emoji emoji-id="6039774717500465122">🔒</tg-emoji>',
  fire: '<tg-emoji emoji-id="6039663022580964808">🔥</tg-emoji>',
  phone: '<tg-emoji emoji-id="6039741826640911366">📞</tg-emoji>',
  user: '<tg-emoji emoji-id="6039640735995666163">👤</tg-emoji>',
  bot: '<tg-emoji emoji-id="6039590961619673046">🤖</tg-emoji>',
  gem: '<tg-emoji emoji-id="6042038955539439522">💎</tg-emoji>',
  note: '<tg-emoji emoji-id="6042118081721932894">📝</tg-emoji>',
  bell: '<tg-emoji emoji-id="6039810103736017240">🔔</tg-emoji>',
  bellOff: '<tg-emoji emoji-id="6039842165666881689">🔕</tg-emoji>',
  door: '<tg-emoji emoji-id="6039423200197091098">🚪</tg-emoji>',
};

/**
 * ----------------------------------------------------
 * Custom Emoji IDs for Buttons
 * ----------------------------------------------------
 */
const CUSTOM_ICONS = {
  check: '6039356946031582644',      // ✅
  cross: '6039798533094128324',      // 🚫
  zap: '6039601175051902450',        // ⚡️
  star: '6039367245363161212',       // ⭐️
  phone: '6039741826640911366',      // 📞
  crown: '6039499118039015593',      // 💜
  chat: '6041783877431729209',       // 💬
  sparkles: '6039709764710047914',   // ✨
  fire: '6039663022580964808',       // 🔥
  gear: '6039716284470402303',       // ⚙️
  user: '6039640735995666163',       // 👤
  stats: '6039873609122454883',      // 📶
  stop: '6039507896952168996',       // ⏹
  eye: '6039829448268717429',        // 👁
  media: '6039693035812430628',      // 🎥
  folder: '6039797240308965054',     // 💼
  timer: '6039724414843493979',      // ⏰
  broadcast: '6039413523635789928',  // 🗣️
  lightbulb: '6039372145920843255',  // 💡
  batteryLow: '6039824740984561221', // 🪫
  top: '6039412209375779934',        // 🔝
  heart: '6039740800143729430',      // ❤️
  camera: '6039534860756851792',     // 📸
};

/**
 * Creates an InlineKeyboardButton with style and icon_custom_emoji_id
 * @param {string} text - Button label
 * @param {string} callback_data - Action callback data
 * @param {'primary'|'success'|'danger'|null} style - Button color style
 * @param {string|null} icon_custom_emoji_id - Custom emoji ID
 */
function btn(text, callback_data, style = null, icon_custom_emoji_id = null) {
  const b = { text, callback_data };
  if (style) b.style = style;
  if (icon_custom_emoji_id) b.icon_custom_emoji_id = String(icon_custom_emoji_id);
  return b;
}

/**
 * Creates an InlineKeyboardButton with URL, style, and icon_custom_emoji_id
 */
function urlBtn(text, url, style = null, icon_custom_emoji_id = null) {
  const b = { text, url };
  if (style) b.style = style;
  if (icon_custom_emoji_id) b.icon_custom_emoji_id = String(icon_custom_emoji_id);
  return b;
}

/**
 * ----------------------------------------------------
 * UI Keyboards (Styled with primary/success/danger + icon_custom_emoji_id)
 * ----------------------------------------------------
 */

// Main menu before linking WhatsApp
function getUnlinkedKeyboard(userId) {
  const buttons = [
    [btn('ربط حساب واتساب', 'act_link_whatsapp', 'success', CUSTOM_ICONS.zap)],
    [btn('أوامر واتساب المزخرفة 📜', 'act_wa_commands', 'primary', CUSTOM_ICONS.sparkles)],
    [
      btn('حالة الاشتراك', 'act_sub_status', 'primary', CUSTOM_ICONS.star),
      btn('الدعم الفني', 'act_support', 'primary', CUSTOM_ICONS.phone),
    ],
  ];

  if (isAdmin(userId)) {
    buttons.push([btn('لوحة تحكم المطوّر', 'act_dev_panel', 'primary', CUSTOM_ICONS.crown)]);
  }

  return Markup.inlineKeyboard(buttons);
}

// Services panel after WhatsApp is linked
function getServicesKeyboard(userId, settings = null) {
  if (!settings) settings = settingsRepo.get(userId);

  const greetingBtn = settings.greeting_enabled
    ? btn('حذف رسالة ترحيب', 'act_delete_greeting', 'danger', CUSTOM_ICONS.cross)
    : btn('إضافة رسالة ترحيب', 'act_add_greeting', 'primary', CUSTOM_ICONS.chat);

  const googleLinked = !!googleRepo.get(userId);
  const googleBtn = googleLinked
    ? btn('حذف جيميل حفظ', 'act_unlink_google', 'danger', CUSTOM_ICONS.cross)
    : btn('إضافة جيميل حفظ', 'act_link_google', 'primary', CUSTOM_ICONS.sparkles);

  const autoSaveBtn = settings.auto_save_enabled
    ? btn('تعطيل الحفظ التلقائي', 'act_disable_autosave', 'danger', CUSTOM_ICONS.cross)
    : btn('تفعيل الحفظ التلقائي', 'act_enable_autosave', 'success', CUSTOM_ICONS.check);

  const storyBtn = settings.story_view_enabled
    ? btn('تعطيل مشاهدة الاستوريات', 'act_disable_stories', 'danger', CUSTOM_ICONS.cross)
    : btn('تفعيل مشاهدة الاستوريات', 'act_enable_stories', 'success', CUSTOM_ICONS.eye);

  const mediaBtn = settings.media_alert_enabled
    ? btn('تعطيل حفظ الذاتية', 'act_disable_media', 'danger', CUSTOM_ICONS.cross)
    : btn('تفعيل حفظ الذاتية', 'act_enable_media', 'success', CUSTOM_ICONS.media);

  const buttons = [
    [greetingBtn, googleBtn],
    [btn('مراجعة ملف أرقام VCF', 'act_review_vcf', 'primary', CUSTOM_ICONS.folder)],
    [autoSaveBtn, storyBtn],
    [mediaBtn],
    [btn('أوامر واتساب المزخرفة 📜', 'act_wa_commands', 'primary', CUSTOM_ICONS.sparkles)],
    [btn('معلومات الحساب والإعدادات', 'act_account_info', 'primary', CUSTOM_ICONS.gear)],
    [
      btn('حالة الاشتراك', 'act_sub_status', 'primary', CUSTOM_ICONS.star),
      btn('الدعم الفني', 'act_support', 'primary', CUSTOM_ICONS.phone),
    ],
  ];

  if (isAdmin(userId)) {
    buttons.push([btn('لوحة تحكم المطوّر', 'act_dev_panel', 'primary', CUSTOM_ICONS.crown)]);
  }

  return Markup.inlineKeyboard(buttons);
}

// Developer Panel Keyboard
function getDevKeyboard() {
  return Markup.inlineKeyboard([
    [
      btn('إضافة اشتراك', 'dev_add_sub', 'success', CUSTOM_ICONS.check),
      btn('حذف اشتراك', 'dev_remove_sub', 'danger', CUSTOM_ICONS.cross),
    ],
    [
      btn('قائمة المشتركين', 'dev_list_subscribers', 'primary', CUSTOM_ICONS.user),
      btn('إهداء وقت للكل', 'dev_gift_all', 'success', CUSTOM_ICONS.sparkles),
    ],
    [
      btn('وقت التجربة', 'dev_change_trial', 'primary', CUSTOM_ICONS.timer),
      btn('إذاعة للمستخدمين', 'dev_broadcast', 'primary', CUSTOM_ICONS.broadcast),
    ],
    [
      btn('إحصائيات البوت', 'dev_stats', 'primary', CUSTOM_ICONS.stats),
      btn('سجل العمليات', 'dev_audit_logs', 'primary', CUSTOM_ICONS.lightbulb),
    ],
    [btn('رجوع للقائمة الرئيسية', 'act_main_menu', 'danger', CUSTOM_ICONS.top)],
  ]);
}

/**
 * ----------------------------------------------------
 * Middleware: Subscription & User Tracking
 * ----------------------------------------------------
 */
bot.use(async (ctx, next) => {
  if (!ctx.from) return next();

  // Register user and activate 24h trial if first interaction
  subscriptionService.ensureTrialStarted(
    ctx.from.id,
    ctx.from.username || '',
    ctx.from.first_name || ''
  );

  return next();
});

/**
 * ----------------------------------------------------
 * Start & Navigation Commands
 * ----------------------------------------------------
 */
bot.start(async (ctx) => {
  userStates.delete(ctx.from.id);
  const isLinked = whatsappManager.isConnected(ctx.from.id);
  const waAccount = whatsappRepo.get(ctx.from.id);

  if (isLinked || (waAccount && waAccount.is_connected)) {
    const phone = waAccount?.phone_number || 'غير معروف';
    const text = `╭━━━ ❮ ${CE.gem} <b>لوحة تحكّم إدارَة واتــس</b> ❯ ━━━╮\n` +
      `<blockquote>${CE.phone} <b>الحساب المرتبط حالياً:</b> <code>+${phone}</code>\n` +
      `<tg-spoiler>حالة الجلسة: نشطة ومؤمنة بالكامل ${CE.check}</tg-spoiler></blockquote>\n\n` +
      `<i>اختر الخدمة التي ترغب بإدارتها وضبطها من الأزرار أدناه:</i>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;

    await ctx.reply(text, { parse_mode: 'HTML', ...getServicesKeyboard(ctx.from.id) });
  } else {
    const welcomeText = `╭━━━ ❮ ${CE.gem} <b>إدارَة واتــس المُميَّزة</b> ❯ ━━━╮\n` +
      `<blockquote><i>${CE.sparkles} مرحباً بك في المنظومة السحابية الأقوى لإدارة وتأمين حسابات واتساب باحترافية وسرعة فائقة! ${CE.zap}</i></blockquote>\n\n` +
      `<b>${CE.fire} الخَدمَات والميزات المتاحة لحسابك:</b>\n` +
      `• <b>الردود والترحيب التلقائي الذكي</b> ${CE.chat}\n` +
      `• <b>الحفظ التلقائي المباشر في Google Contacts</b> ${CE.globe}\n` +
      `• <b>مشاهدة الاستوريهات والتفاعل بـ ${CE.redHeart}</b> ${CE.eye}\n` +
      `• <b>حفظ وسائط العرض لمرة واحدة والفيديوهات</b> ${CE.camera}\n` +
      `• <b>حملات إرسال جماعية آمنة عبر ملفات VCF</b> ${CE.folder}\n\n` +
      `<blockquote>${CE.lock} <i>عزل كامل وحماية فائقة لبياناتك وخصوصيتك.</i>\n` +
      `<tg-spoiler>اضغط على زر ربط حساب واتساب أدناه لبدء الاستخدام فوراً! ${CE.zap}</tg-spoiler></blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;

    await ctx.reply(welcomeText, { parse_mode: 'HTML', ...getUnlinkedKeyboard(ctx.from.id) });
  }
});

bot.action('act_main_menu', async (ctx) => {
  await ctx.answerCbQuery();
  userStates.delete(ctx.from.id);
  const isLinked = whatsappManager.isConnected(ctx.from.id);
  const waAccount = whatsappRepo.get(ctx.from.id);

  if (isLinked || (waAccount && waAccount.is_connected)) {
    const phone = waAccount?.phone_number || 'غير معروف';
    const text = `╭━━━ ❮ ${CE.gem} <b>لوحة تحكّم إدارَة واتــس</b> ❯ ━━━╮\n` +
      `<blockquote>${CE.phone} <b>الحساب المرتبط:</b> <code>+${phone}</code>\n` +
      `<tg-spoiler>حالة الجلسة: نشطة ومؤمنة بالكامل ${CE.check}</tg-spoiler></blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;

    await ctx.editMessageText(text, { parse_mode: 'HTML', ...getServicesKeyboard(ctx.from.id) })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', ...getServicesKeyboard(ctx.from.id) }));
  } else {
    const text = `╭━━━ ❮ ${CE.gem} <b>القائمة الرئيسية لبوت «إدارة واتس»</b> ❯ ━━━╮\n` +
      `<blockquote><i>${CE.sparkles} اختر من القائمة أدناه للبدء في استخدام الميزات:</i></blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;

    await ctx.editMessageText(text, { parse_mode: 'HTML', ...getUnlinkedKeyboard(ctx.from.id) })
      .catch(() => ctx.reply(text, { parse_mode: 'HTML', ...getUnlinkedKeyboard(ctx.from.id) }));
  }
});

/**
 * ----------------------------------------------------
 * Subscription Status & Support
 * ----------------------------------------------------
 */
bot.action('act_sub_status', async (ctx) => {
  await ctx.answerCbQuery();
  const sub = subscriptionService.getStatus(ctx.from.id);

  let icon = sub.isActive ? CE.check : CE.cross;
  let typeArabic = sub.type === 'paid' ? 'اشتراك مدفوع مميز' : sub.type === 'trial' ? 'فترة تجريبية مجانية' : 'منتهي الصلاحية';
  let expiryDate = sub.endsAt ? sub.endsAt.toLocaleString('ar-EG') : 'غير محدد';

  const text = `╭━━━ ❮ ${CE.card} <b>حَالة واشتراك الحِسَاب</b> ❯ ━━━╮\n` +
    `<blockquote>\n` +
    `• <b>الحالة:</b> ${sub.isActive ? `مفعل بنجاح ${CE.check}` : `منتهي الصلاحية ${CE.cross}`}\n` +
    `• <b>نوع الاشتراك:</b> <i>${typeArabic}</i>\n` +
    `• <b>الوقت المتبقي:</b> <b>${sub.remainingText}</b>\n` +
    `• <b>تاريخ الانتهاء:</b> <code>${expiryDate}</code>\n` +
    `</blockquote>\n\n` +
    `<blockquote>${sub.isActive ? `${CE.sparkles} <tg-spoiler>جميع خدمات واتساب تعمل لديك بأعلى كفاءة وسرعة.</tg-spoiler>` : `⚠️ <i>يرجى التواصل مع الدعم الفني لتجديد الاشتراك والاستمرار بالخدمة.</i>`}</blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[btn('رجوع للقائمة الرئيسية', 'act_main_menu', 'primary', CUSTOM_ICONS.top)]])
  });
});

// Cached support info resolved automatically from ADMIN_ID
let cachedSupportContact = null;

async function getSupportContact() {
  if (cachedSupportContact) return cachedSupportContact;

  const primaryAdminId = config.adminIds[0];
  if (primaryAdminId) {
    try {
      const adminChat = await bot.telegram.getChat(primaryAdminId);
      const name = adminChat.first_name || 'المطور';
      if (adminChat.username) {
        cachedSupportContact = {
          text: `@${adminChat.username}`,
          url: `https://t.me/${adminChat.username}`,
          name,
        };
        return cachedSupportContact;
      } else {
        cachedSupportContact = {
          text: `<a href="tg://user?id=${primaryAdminId}">${name}</a>`,
          url: `tg://user?id=${primaryAdminId}`,
          name,
        };
        return cachedSupportContact;
      }
    } catch {
      cachedSupportContact = {
        text: `<a href="tg://user?id=${primaryAdminId}">الدعم الفني</a>`,
        url: `tg://user?id=${primaryAdminId}`,
        name: 'الدعم الفني',
      };
      return cachedSupportContact;
    }
  }

  return {
    text: 'الدعم الفني غير متوفر حاليًا',
    url: null,
    name: 'الدعم الفني',
  };
}

bot.action('act_support', async (ctx) => {
  await ctx.answerCbQuery();
  const support = await getSupportContact();

  const keyboardButtons = [];
  if (support.url) {
    keyboardButtons.push([urlBtn('مراسلة الدعم الفني مباشرة', support.url, 'success', CUSTOM_ICONS.chat)]);
  }
  keyboardButtons.push([btn('رجوع للقائمة الرئيسية', 'act_main_menu', 'primary', CUSTOM_ICONS.top)]);

  const text = `╭━━━ ❮ 🛠️ <b>الدعم الفني والمساعدة</b> ❯ ━━━╮\n` +
    `<blockquote><i>${CE.sparkles} لأي استفسارات أو لتفعيل وتمديد الاشتراكات، يمكنك مراسلة الإدارة مباشرة:</i></blockquote>\n\n` +
    `${CE.user} <b>حساب الدعم:</b> ${support.text}\n` +
    `<blockquote><tg-spoiler>الدعم متاح 24/7 للرد على جميع استفساراتكم وحل المشكلات الفنية.</tg-spoiler></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(keyboardButtons),
  });
});

bot.action('act_wa_commands', async (ctx) => {
  await ctx.answerCbQuery();
  const backKb = Markup.inlineKeyboard([
    [btn('رجوع للقائمة الرئيسية', 'act_main_menu', 'primary', CUSTOM_ICONS.top)],
  ]);
  await ctx.reply(MAIN_MENU, {
    disable_web_page_preview: true,
    ...backKb,
  }).catch(async () => {
    await ctx.reply(MAIN_MENU);
  });
});

/**
 * ----------------------------------------------------
 /**
 * ----------------------------------------------------
 * WhatsApp Linking Options (ربط الحساب - اختيار الطريقة)
 * ----------------------------------------------------
 */
bot.action('act_link_whatsapp', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;

  const sub = subscriptionService.getStatus(userId);
  if (!sub.isActive) {
    const expiredText = `╭━━━ ❮ ⚠️ <b>تنبيه انتهاء الاشتراك</b> ❯ ━━━╮\n` +
      `<blockquote><i>عذراً، اشتراكك منتهي الصلاحية حالياً. يرجى تجديد الاشتراك أولاً لتتمكن من ربط الحساب.</i></blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;
    return ctx.reply(expiredText, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[btn('فحص حالة الاشتراك', 'act_sub_status', 'primary', CUSTOM_ICONS.star)]])
    });
  }

  const text = `╭━━━ ❮ ${CE.link} <b>اختر طريقة ربط حساب واتساب</b> ❯ ━━━╮\n` +
    `<blockquote><i>يدعم البوت طريقتين للربط السحابي الآمن:</i></blockquote>\n\n` +
    `• <b>1️⃣ الربط عبر كود الهاتف (Pairing Code):</b>\n` +
    `<blockquote><i>الأسهل والأسرع! تدخل رقم هاتفك ويظهر لك كود تدخله في تطبيق واتساب مباشرة بدون كاميرا.</i></blockquote>\n\n` +
    `• <b>2️⃣ الربط عبر باركود (QR Code):</b>\n` +
    `<blockquote><i>يظهر لك رمز QR تمسحه بكاميرا هاتفك من خيار الأجهزة المرتبطة.</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  const buttons = [
    [btn('الربط عبر كود الهاتف (Pairing Code)', 'act_link_by_pairing', 'success', CUSTOM_ICONS.phone)],
    [btn('الربط عبر رمز باركود (QR Code)', 'act_link_by_qr', 'primary', CUSTOM_ICONS.camera)],
    [btn('رجوع للقائمة الرئيسية', 'act_main_menu', 'danger', CUSTOM_ICONS.top)],
  ];

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard(buttons),
  });
});

// Method 1: QR Code
bot.action('act_link_by_qr', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;

  const sub = subscriptionService.getStatus(userId);
  if (!sub.isActive) {
    return ctx.reply('⚠️ اشتراكك غير مفعل أو منتهي.');
  }

  const waitMsg = await ctx.reply(
    `╭━━━ ❮ ${CE.hourglass} <b>جاري تحضير جلسة الاتصال</b> ❯ ━━━╮\n` +
    `<blockquote><i>جاري توليد رمز QR السحابي، يرجى الانتظار ثوانٍ معدودة...</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`,
    { parse_mode: 'HTML' }
  );

  let qrMessageId = null;

  try {
    await whatsappManager.startSession(
      userId,
      // onQr callback
      async (qrBuffer) => {
        const caption = `╭━━━ ❮ ${CE.camera} <b>امسح رمز QR لربط واتساب</b> ❯ ━━━╮\n` +
          `<blockquote>\n` +
          `1️⃣ افتح تطبيق واتساب على هاتفك.\n` +
          `2️⃣ الإعدادات ❯ الأجهزة المرتبطة ❯ <b>ربط جهاز</b>.\n` +
          `3️⃣ وجّه الكاميرا نحو هذا الرمز.\n` +
          `</blockquote>\n` +
          `<blockquote>⏳ <i>الرمز يتجدد تلقائياً كل 20 ثانية لضمان الأمان.</i></blockquote>\n` +
          `╰━━━━━━━━━━━━━━━━╯`;

        if (qrMessageId) {
          try {
            await ctx.telegram.deleteMessage(userId, qrMessageId).catch(() => {});
          } catch {}
        }
        const sent = await ctx.telegram.sendPhoto(userId, { source: qrBuffer }, {
          caption,
          parse_mode: 'HTML',
        });
        qrMessageId = sent.message_id;
      },
      // onConnected callback
      async (phoneNumber, pushName) => {
        if (qrMessageId) {
          await ctx.telegram.deleteMessage(userId, qrMessageId).catch(() => {});
        }
        const successMsg = `╭━━━ ❮ ${CE.check} <b>تم ربط حساب واتساب بنجاح!</b> ❯ ━━━╮\n` +
          `<blockquote>\n` +
          `${CE.phone} <b>الرقم المرتبط:</b> <code>+${phoneNumber}</code>\n` +
          `${CE.user} <b>الاسم:</b> <i>${pushName || 'مستخدم واتساب'}</i>\n` +
          `<tg-spoiler>تم تأمين وحفظ الجلسة السحابية بنجاح 🟢</tg-spoiler>\n` +
          `</blockquote>\n\n` +
          `<i>يمكنك الآن التحكم بكافة الميزات والخدمات من اللوحة أدناه:</i>\n` +
          `╰━━━━━━━━━━━━━━━━╯`;

        await ctx.telegram.sendMessage(
          userId,
          successMsg,
          { parse_mode: 'HTML', ...getServicesKeyboard(userId) }
        );
      },
      { method: 'qr' }
    );
  } catch (err) {
    await ctx.reply(`❌ فشل بدء جلسة الربط: ${err.message}`);
  }
});

// Method 2: Pairing Code
bot.action('act_link_by_pairing', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;

  const sub = subscriptionService.getStatus(userId);
  if (!sub.isActive) {
    return ctx.reply('⚠️ اشتراكك غير مفعل أو منتهي.');
  }

  userStates.set(userId, { step: 'AWAITING_WA_PHONE_FOR_PAIRING' });

  const text = `╭━━━ ❮ ${CE.phone} <b>الربط عبر كود الهاتف (Pairing Code)</b> ❯ ━━━╮\n` +
    `<blockquote><i>أرسل الآن رقم هاتف واتساب الخاص بك مع مفتاح الدولة:\n(مثال: <code>201012345678</code> أو <code>966512345678</code>)</i></blockquote>\n\n` +
    `<blockquote>⚠️ <b>ملاحظة:</b> <i>اكتب الرقم بالأرقام الإنجليزية بدون علامة (+) أو مسافات في البداية.</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_main_menu', 'danger', CUSTOM_ICONS.cross)]])
  });
});

/**
 * ----------------------------------------------------
 * Account Info & Disconnect
 * ----------------------------------------------------
 */
bot.action('act_account_info', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const isLinked = whatsappManager.isConnected(userId);
  const wa = whatsappRepo.get(userId);
  const settings = settingsRepo.get(userId);
  const google = googleRepo.get(userId);

  const text = `╭━━━ ❮ ${CE.gear} <b>معلومات الحساب والإعدادات</b> ❯ ━━━╮\n` +
    `<blockquote>\n` +
    `• <b>اتصال واتساب:</b> ${isLinked ? `✅ متصل ونشط ${CE.check}` : `❌ غير متصل ${CE.cross}`}\n` +
    `• <b>رقم واتساب:</b> <code>+${wa?.phone_number || 'غير معروف'}</code>\n` +
    `• <b>حساب Google:</b> ${google ? `✅ مرتبط (<code>${google.email || 'نشط'}</code>)` : '❌ غير مرتبط'}\n` +
    `• <b>رسالة الترحيب:</b> ${settings.greeting_enabled ? `✅ مفعلة ${CE.check}` : '⏸️ معطلة'}\n` +
    `• <b>الحفظ التلقائي:</b> ${settings.auto_save_enabled ? `✅ مفعل (${settings.auto_save_mode === 'custom_prefix' ? 'تسلسلي' : 'اسم الحساب'})` : '⏸️ معطل'}\n` +
    `• <b>مشاهدة الاستوريهات:</b> ${settings.story_view_enabled ? `✅ مفعل (${settings.story_react_enabled ? 'مع ❤️' : 'مشاهدة فقط'})` : '⏸️ معطل'}\n` +
    `• <b>حفظ الذاتية:</b> ${settings.media_alert_enabled ? `✅ مفعل ${CE.check}` : '⏸️ معطل'}\n` +
    `</blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  const buttons = [
    [btn('فصل حساب واتساب', 'act_confirm_disconnect', 'danger', CUSTOM_ICONS.batteryLow)],
    [btn('رجوع للوحة الخدمات', 'act_main_menu', 'primary', CUSTOM_ICONS.top)],
  ];

  await ctx.reply(text, { parse_mode: 'HTML', ...Markup.inlineKeyboard(buttons) });
});

bot.action('act_confirm_disconnect', async (ctx) => {
  await ctx.answerCbQuery();
  const text = `╭━━━ ❮ ⚠️ <b>تأكيد فصل الحساب</b> ❯ ━━━╮\n` +
    `<blockquote><i>هل أنت متأكد من رغبتك في تسجيل الخروج وفصل حساب واتساب؟ سيتم إيقاف الميزات التلقائية حتى تعيد ربطه.</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(
    text,
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [btn('نعم، افصل الحساب', 'act_do_disconnect', 'danger', CUSTOM_ICONS.cross)],
        [btn('تراجع وإلغاء', 'act_account_info', 'primary', CUSTOM_ICONS.top)],
      ])
    }
  );
});

bot.action('act_do_disconnect', async (ctx) => {
  await ctx.answerCbQuery();
  await whatsappManager.disconnectSession(ctx.from.id);
  await ctx.reply(`✅ <b>تم فصل حساب واتساب بنجاح.</b>`, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[btn('القائمة الرئيسية', 'act_main_menu', 'primary', CUSTOM_ICONS.top)]])
  });
});

/**
 * ----------------------------------------------------
 * Greeting Messages (رسائل الترحيب)
 * ----------------------------------------------------
 */
bot.action('act_add_greeting', async (ctx) => {
  await ctx.answerCbQuery();
  userStates.set(ctx.from.id, { step: 'AWAITING_GREETING_TEXT' });
  const text = `╭━━━ ❮ ${CE.chat} <b>إضافة رسالة ترحيب</b> ❯ ━━━╮\n` +
    `<blockquote><i>أرسل الآن نص رسالة الترحيب التي ترغب بإرسالها تلقائياً لأي محادثة واردة جديدة:</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_main_menu', 'danger', CUSTOM_ICONS.cross)]])
  });
});

bot.action('act_confirm_save_greeting', async (ctx) => {
  await ctx.answerCbQuery();
  const state = userStates.get(ctx.from.id);
  if (state && state.step === 'CONFIRM_GREETING' && state.text) {
    settingsRepo.update(ctx.from.id, {
      greeting_enabled: 1,
      greeting_text: state.text,
    });
    userStates.delete(ctx.from.id);
    await ctx.reply(`✅ <b>تم حفظ رسالة الترحيب وتفعيلها بنجاح!</b> ${CE.check}`, {
      parse_mode: 'HTML',
      ...getServicesKeyboard(ctx.from.id)
    });
  } else {
    await ctx.reply('❌ انتهت صلاحية الجلسة، يرجى المحاولة من جديد.', getServicesKeyboard(ctx.from.id));
  }
});

bot.action('act_delete_greeting', async (ctx) => {
  await ctx.answerCbQuery();
  const settings = settingsRepo.get(ctx.from.id);
  if (!settings.greeting_text) {
    return ctx.reply('ℹ️ لا توجد رسالة ترحيب مسجلة حاليًا.', getServicesKeyboard(ctx.from.id));
  }

  const text = `╭━━━ ❮ ⚠️ <b>تأكيد حذف رسالة الترحيب</b> ❯ ━━━╮\n` +
    `<blockquote><b>النص الحالي:</b>\n<code>${settings.greeting_text}</code></blockquote>\n` +
    `<blockquote><i>هل تريد بالتأكيد حذف الرسالة وتعطيل الترحيب؟</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [btn('نعم، تأكيد الحذف', 'act_do_delete_greeting', 'danger', CUSTOM_ICONS.cross)],
      [btn('تراجع وإلغاء', 'act_main_menu', 'primary', CUSTOM_ICONS.top)],
    ])
  });
});

bot.action('act_do_delete_greeting', async (ctx) => {
  await ctx.answerCbQuery();
  settingsRepo.update(ctx.from.id, {
    greeting_enabled: 0,
    greeting_text: null,
  });
  await ctx.reply(`✅ <b>تم حذف رسالة الترحيب بنجاح.</b>`, {
    parse_mode: 'HTML',
    ...getServicesKeyboard(ctx.from.id)
  });
});

/**
 * ----------------------------------------------------
 * Google Contacts Integration (إضافة وحذف جيميل حفظ)
 * ----------------------------------------------------
 */
bot.action('act_link_google', async (ctx) => {
  await ctx.answerCbQuery();
  userStates.set(ctx.from.id, { step: 'AWAITING_GMAIL_EMAIL' });
  const text = `╭━━━ ❮ ${CE.globe} <b>ربط حساب Google Contacts</b> ❯ ━━━╮\n` +
    `<blockquote><i>أرسل عنوان بريدك الإلكتروني (Gmail) الآن:</i>\n(مثال: <code>yourname@gmail.com</code>)</blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_main_menu', 'danger', CUSTOM_ICONS.cross)]])
  });
});

bot.action('act_unlink_google', async (ctx) => {
  await ctx.answerCbQuery();
  const text = `╭━━━ ❮ ⚠️ <b>تأكيد إلغاء ربط Google</b> ❯ ━━━╮\n` +
    `<blockquote><i>هل أنت متأكد من حذف وإلغاء ربط حساب Google؟ (لن يتم حذف جهات الاتصال المحفوظة سابقاً في حسابك).</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [btn('نعم، تأكيد الحذف', 'act_do_unlink_google', 'danger', CUSTOM_ICONS.cross)],
      [btn('تراجع وإلغاء', 'act_main_menu', 'primary', CUSTOM_ICONS.top)],
    ])
  });
});

bot.action('act_do_unlink_google', async (ctx) => {
  await ctx.answerCbQuery();
  await googleService.unlinkGoogle(ctx.from.id);
  await ctx.reply(`✅ <b>تم إلغاء ربط حساب Google بنجاح.</b>`, {
    parse_mode: 'HTML',
    ...getServicesKeyboard(ctx.from.id)
  });
});

/**
 * ----------------------------------------------------
 * Auto-saving Contacts (الحفظ التلقائي للأرقام)
 * ----------------------------------------------------
 */
bot.action('act_enable_autosave', async (ctx) => {
  await ctx.answerCbQuery();
  const googleLinked = !!googleRepo.get(ctx.from.id);
  if (!googleLinked) {
    const text = `╭━━━ ❮ ⚠️ <b>تنبيه ربط Google مطلوب</b> ❯ ━━━╮\n` +
      `<blockquote><i>لتتمكن من حفظ الأرقام الجديدة، يرجى ربط حساب Google Contacts أولاً عبر الزر أدناه.</i></blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;

    return ctx.reply(text, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [btn('ربط Google الآن', 'act_link_google', 'success', CUSTOM_ICONS.sparkles)],
        [btn('رجوع', 'act_main_menu', 'danger', CUSTOM_ICONS.top)],
      ])
    });
  }

  const text = `╭━━━ ❮ ⚙️ <b>طريقة الحفظ التلقائي للأرقام</b> ❯ ━━━╮\n` +
    `<blockquote>\n` +
    `1️⃣ <b>الحفظ باسم الحساب:</b> حفظ جهة الاتصال باسم الملف الشخصي على واتساب.\n` +
    `2️⃣ <b>الحفظ باسم متسلسل:</b> حفظ الأرقام ببادئة وتسلسل مثل (عميل 1، عميل 2...).\n` +
    `</blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [btn('الحفظ باسم الحساب', 'act_set_autosave_account_name', 'primary', CUSTOM_ICONS.user)],
      [btn('الحفظ باسم متسلسل', 'act_set_autosave_custom', 'primary', CUSTOM_ICONS.sparkles)],
      [btn('رجوع', 'act_main_menu', 'danger', CUSTOM_ICONS.top)],
    ])
  });
});

bot.action('act_set_autosave_account_name', async (ctx) => {
  await ctx.answerCbQuery();
  settingsRepo.update(ctx.from.id, {
    auto_save_enabled: 1,
    auto_save_mode: 'account_name',
  });
  await ctx.reply(`✅ <b>تم تفعيل الحفظ التلقائي بنجاح!</b> <i>(باستخدام اسم الحساب)</i> ${CE.check}`, {
    parse_mode: 'HTML',
    ...getServicesKeyboard(ctx.from.id)
  });
});

bot.action('act_set_autosave_custom', async (ctx) => {
  await ctx.answerCbQuery();
  userStates.set(ctx.from.id, { step: 'AWAITING_AUTOSAVE_PREFIX' });
  const text = `╭━━━ ❮ 📝 <b>ضبط الاسم المتسلسل</b> ❯ ━━━╮\n` +
    `<blockquote><i>أدخل الآن الاسم الأساسي للتسلسل (مثال: <code>عميل</code> أو <code>تست</code>):</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_main_menu', 'danger', CUSTOM_ICONS.cross)]])
  });
});

bot.action('act_disable_autosave', async (ctx) => {
  await ctx.answerCbQuery();
  settingsRepo.update(ctx.from.id, { auto_save_enabled: 0 });
  await ctx.reply(`⏸️ <b>تم تعطيل الحفظ التلقائي للأرقام.</b>`, {
    parse_mode: 'HTML',
    ...getServicesKeyboard(ctx.from.id)
  });
});

/**
 * ----------------------------------------------------
 * Story Viewing & Reaction (مشاهدة وتفاعل الاستوريهات)
 * ----------------------------------------------------
 */
bot.action('act_enable_stories', async (ctx) => {
  await ctx.answerCbQuery();
  const text = `╭━━━ ❮ 👁️ <b>مشاهدة وتفاعل الاستوريهات</b> ❯ ━━━╮\n` +
    `<blockquote><i>هل ترغب في تفعيل التفاعل التلقائي برمز القلب (${CE.redHeart}) مع مشاهدة الاستوري؟</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [btn('مشاهدة فقط', 'act_story_view_only', 'primary', CUSTOM_ICONS.eye)],
      [btn('مشاهدة مع التفاعل', 'act_story_view_and_react', 'success', CUSTOM_ICONS.heart)],
      [btn('إلغاء', 'act_main_menu', 'danger', CUSTOM_ICONS.cross)],
    ])
  });
});

bot.action('act_story_view_only', async (ctx) => {
  await ctx.answerCbQuery();
  settingsRepo.update(ctx.from.id, {
    story_view_enabled: 1,
    story_react_enabled: 0,
  });
  await ctx.reply(`✅ <b>تم تفعيل مشاهدة الاستوريهات بنجاح (مشاهدة فقط).</b> ${CE.check}`, {
    parse_mode: 'HTML',
    ...getServicesKeyboard(ctx.from.id)
  });
});

bot.action('act_story_view_and_react', async (ctx) => {
  await ctx.answerCbQuery();
  settingsRepo.update(ctx.from.id, {
    story_view_enabled: 1,
    story_react_enabled: 1,
  });
  await ctx.reply(`✅ <b>تم تفعيل مشاهدة وتفاعل الاستوريهات بنجاح (مع إرسال ❤️).</b> ${CE.check}`, {
    parse_mode: 'HTML',
    ...getServicesKeyboard(ctx.from.id)
  });
});

bot.action('act_disable_stories', async (ctx) => {
  await ctx.answerCbQuery();
  settingsRepo.update(ctx.from.id, {
    story_view_enabled: 0,
    story_react_enabled: 0,
  });
  await ctx.reply(`⏸️ <b>تم تعطيل مشاهدة وتفاعل الاستوريهات.</b>`, {
    parse_mode: 'HTML',
    ...getServicesKeyboard(ctx.from.id)
  });
});

/**
 * ----------------------------------------------------
 * Media Alert (حفظ الذاتية وإشعارات الوسائط)
 * ----------------------------------------------------
 */
bot.action('act_enable_media', async (ctx) => {
  await ctx.answerCbQuery();
  settingsRepo.update(ctx.from.id, { media_alert_enabled: 1 });
  const text = `╭━━━ ❮ 📸 <b>حفظ الذاتية وإشعارات الوسائط</b> ❯ ━━━╮\n` +
    `<blockquote>${CE.check} <b>تم تفعيل حفظ الذاتية بنجاح!</b>\n` +
    `<i>أي صور، مقاطع فيديو، أو رسائل عرض لمرة واحدة (View Once) واردة سيتم إعادة إرسالها إلى محادثتك هنا فوراً مع بيانات المرسل.</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...getServicesKeyboard(ctx.from.id)
  });
});

bot.action('act_disable_media', async (ctx) => {
  await ctx.answerCbQuery();
  settingsRepo.update(ctx.from.id, { media_alert_enabled: 0 });
  await ctx.reply(`🔕 <b>تم تعطيل إشعارات الوسائط وحفظ الذاتية.</b>`, {
    parse_mode: 'HTML',
    ...getServicesKeyboard(ctx.from.id)
  });
});

/**
 * ----------------------------------------------------
 * VCF File Review & Campaign (مراجعة ملف أرقام)
 * ----------------------------------------------------
 */
bot.action('act_review_vcf', async (ctx) => {
  await ctx.answerCbQuery();
  userStates.set(ctx.from.id, { step: 'AWAITING_VCF_FILE' });
  const text = `╭━━━ ❮ 📂 <b>مراجعة ملف الأرقام (VCF)</b> ❯ ━━━╮\n` +
    `<blockquote><i>يرجى إرسال ملف جهات الاتصال بصيغة <b>.vcf</b> الآن كمستند/ملف:</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_main_menu', 'danger', CUSTOM_ICONS.cross)]])
  });
});

bot.action('act_cancel_vcf', async (ctx) => {
  await ctx.answerCbQuery('جاري إيقاف الحملة...');
  const token = activeCampaignTokens.get(ctx.from.id);
  if (token) {
    token.isCancelled = true;
  }
});

bot.action('act_start_vcf_broadcast', async (ctx) => {
  await ctx.answerCbQuery();
  const userId = ctx.from.id;
  const state = userStates.get(userId);
  if (!state || state.step !== 'CONFIRM_VCF_SEND' || !state.contacts || !state.text) {
    return ctx.reply('❌ انتهت صلاحية الجلسة، يرجى إعادة إرسال الملف.', getServicesKeyboard(userId));
  }

  const { contacts, text } = state;
  userStates.delete(userId);

  const cancelToken = { isCancelled: false };
  activeCampaignTokens.set(userId, cancelToken);

  const statusText = `╭━━━ ❮ 🚀 <b>بدء إرسال الحملة الإعلانية</b> ❯ ━━━╮\n` +
    `<blockquote><b>المستلمون:</b> <code>${contacts.length}</code> جهة اتصال\n` +
    `🛡️ <i>نظام الحماية ضد الحظر والتقييد نشط بالكامل.</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  const statusMsg = await ctx.reply(statusText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[btn('إيقاف الحملة فوراً', 'act_cancel_vcf', 'danger', CUSTOM_ICONS.stop)]])
  });

  try {
    const result = await whatsappManager.sendBulkMessages(
      userId,
      contacts,
      text,
      async (prog) => {
        const coolingNotice = prog.isCooling ? `\n❄️ <tg-spoiler>استراحة تهدئة لحماية الحساب (25 ثانية)...</tg-spoiler>` : '';
        const progText = `╭━━━ ❮ ⏳ <b>جاري الإرسال (${prog.current}/${prog.total})</b> ❯ ━━━╮\n` +
          `<blockquote>\n` +
          `• ناجح: <b>${prog.success}</b> ✅\n` +
          `• غير مسجل / فشل: <b>${prog.failed}</b> ❌` +
          coolingNotice + `\n` +
          `</blockquote>\n` +
          `╰━━━━━━━━━━━━━━━━╯`;

        await ctx.telegram.editMessageText(
          userId,
          statusMsg.message_id,
          null,
          progText,
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[btn('إيقاف الحملة فوراً', 'act_cancel_vcf', 'danger', CUSTOM_ICONS.stop)]])
          }
        ).catch(() => {});
      },
      cancelToken
    );

    activeCampaignTokens.delete(userId);
    const statusBadge = result.wasCancelled ? '⚠️ <b>تم إيقاف الحملة يدوياً</b>' : '✅ <b>اكتملت الحملة بنجاح</b>';

    const finalReport = `╭━━━ ❮ 📊 <b>تقرير إرسال الحملة</b> ❯ ━━━╮\n` +
      `<blockquote>\n` +
      `• <b>الحالة:</b> ${statusBadge}\n` +
      `• <b>إجمالي المستلمين:</b> <code>${result.total}</code>\n` +
      `• <b>تم الإرسال بنجاح:</b> <b>${result.success}</b> ✅\n` +
      `• <b>غير مسجل أو فشل:</b> <b>${result.failed}</b> ❌\n` +
      `</blockquote>\n` +
      `<blockquote>🛡️ <i>تم الإرسال بنجاح تحت حماية مكافحة الحظر.</i></blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;

    await ctx.reply(finalReport, {
      parse_mode: 'HTML',
      ...getServicesKeyboard(userId)
    });
  } catch (err) {
    activeCampaignTokens.delete(userId);
    await ctx.reply(`❌ فشلت عملية الإرسال: ${err.message}`, getServicesKeyboard(userId));
  }
});

/**
 * ----------------------------------------------------
 * Developer Panel (لوحة المطور)
 * ----------------------------------------------------
 */
bot.action('act_dev_panel', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) {
    return ctx.reply('⛔ عذراً، لا تمتلك صلاحيات الوصول إلى لوحة المطور.');
  }

  const text = `╭━━━ ❮ ${CE.crown} <b>لوحة تحكّم المطوّر الشاملة</b> ❯ ━━━╮\n` +
    `<blockquote><i>${CE.zap} مرحباً بك في لوحة الإدارة، اختر الإجراء المطلوب تنفيذه:</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, { parse_mode: 'HTML', ...getDevKeyboard() });
});

bot.action('dev_stats', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;

  const totalUsers = userRepo.countTotal();
  const connectedWa = whatsappRepo.countConnected();
  const linkedGoogle = googleRepo.countLinked();
  const allSubs = subscriptionService.getAllSubscribers();
  const activeSubs = allSubs.filter(s => s.isActive).length;

  const text = `╭━━━ ❮ ${CE.stats} <b>إحصائيات النظام الحية</b> ❯ ━━━╮\n` +
    `<blockquote>\n` +
    `• <b>إجمالي المستخدمين المسجلين:</b> <code>${totalUsers}</code> مستخدم\n` +
    `• <b>الاشتراكات النشطة حالياً:</b> <code>${activeSubs}</code> مشترك\n` +
    `• <b>حسابات واتساب المرتبطة:</b> <code>${connectedWa}</code> حساب\n` +
    `• <b>حسابات Google المرتبطة:</b> <code>${linkedGoogle}</code> حساب\n` +
    `• <b>مدة التجربة الافتراضية:</b> <code>${appSettingsRepo.getTrialHours()}</code> ساعة\n` +
    `</blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, { parse_mode: 'HTML', ...getDevKeyboard() });
});

bot.action('dev_list_subscribers', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;

  const subs = subscriptionService.getAllSubscribers();
  if (subs.length === 0) {
    return ctx.reply('ℹ️ لا يوجد مستخدمين مسجلين حاليًا.', getDevKeyboard());
  }

  let text = `╭━━━ ❮ 👥 <b>قائمة المشتركين (${subs.length})</b> ❯ ━━━╮\n<blockquote>\n`;
  subs.slice(0, 15).forEach((s, idx) => {
    const statusIcon = s.isActive ? '✅' : '❌';
    text += `${idx + 1}. <code>${s.telegram_id}</code> (${s.first_name || s.username || 'بدون اسم'})\n   ${statusIcon} ${s.remainingText}\n`;
  });
  text += `</blockquote>\n`;

  if (subs.length > 15) {
    text += `<blockquote><i>... ويوجد ${subs.length - 15} مستخدم آخر مسجل.</i></blockquote>\n`;
  }
  text += `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, { parse_mode: 'HTML', ...getDevKeyboard() });
});

bot.action('dev_add_sub', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;

  userStates.set(ctx.from.id, { step: 'DEV_AWAIT_ADD_SUB_USERID' });
  const text = `╭━━━ ❮ ➕ <b>إضافة اشتراك لمستخدم</b> ❯ ━━━╮\n` +
    `<blockquote><i>أرسل معرف تيليجرام (Telegram ID) الخاص بالمستخدم المراد تفعيل الاشتراك له:</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_dev_panel', 'danger', CUSTOM_ICONS.cross)]])
  });
});

bot.action('dev_remove_sub', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;

  userStates.set(ctx.from.id, { step: 'DEV_AWAIT_REMOVE_SUB_USERID' });
  const text = `╭━━━ ❮ ❌ <b>حذف اشتراك لمستخدم</b> ❯ ━━━╮\n` +
    `<blockquote><i>أرسل معرف تيليجرام (Telegram ID) الخاص بالمستخدم المراد إنهاء اشتراكه:</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_dev_panel', 'danger', CUSTOM_ICONS.cross)]])
  });
});

bot.action('dev_confirm_remove_sub', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;

  const state = userStates.get(ctx.from.id);
  if (state && state.targetId) {
    subscriptionService.revokeSubscription(ctx.from.id, state.targetId);
    userStates.delete(ctx.from.id);
    await ctx.reply(`✅ <b>تم إنهاء اشتراك المستخدم</b> <code>${state.targetId}</code> <b>بنجاح.</b>`, {
      parse_mode: 'HTML',
      ...getDevKeyboard()
    });
  }
});

bot.action('dev_gift_all', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;

  userStates.set(ctx.from.id, { step: 'DEV_AWAIT_GIFT_HOURS' });
  const text = `╭━━━ ❮ 🎁 <b>إهداء وقت مجاني للكل</b> ❯ ━━━╮\n` +
    `<blockquote><i>أدخل عدد الساعات المراد إضافتها لجميع المستخدمين (مثال: <code>24</code> أو <code>48</code>):</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_dev_panel', 'danger', CUSTOM_ICONS.cross)]])
  });
});

bot.action('dev_change_trial', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;

  const currentHours = appSettingsRepo.getTrialHours();
  userStates.set(ctx.from.id, { step: 'DEV_AWAIT_TRIAL_HOURS' });
  const text = `╭━━━ ❮ ⏳ <b>تغيير وقت التجربة المجانية</b> ❯ ━━━╮\n` +
    `<blockquote><b>الوقت الحالي:</b> <code>${currentHours}</code> ساعة.\n` +
    `<i>أدخل المدة الجديدة بالساعات للمستخدمين الجدد:</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_dev_panel', 'danger', CUSTOM_ICONS.cross)]])
  });
});

bot.action('dev_broadcast', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;

  userStates.set(ctx.from.id, { step: 'DEV_AWAIT_BROADCAST_MSG' });
  const text = `╭━━━ ❮ 📢 <b>إذاعة رسالة للمستخدمين</b> ❯ ━━━╮\n` +
    `<blockquote><i>أرسل الآن الرسالة التي ترغب بإذاعتها للجميع (نص، صورة، فيديو، أو مستند):</i></blockquote>\n` +
    `╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_dev_panel', 'danger', CUSTOM_ICONS.cross)]])
  });
});

bot.action('dev_audit_logs', async (ctx) => {
  await ctx.answerCbQuery();
  if (!isAdmin(ctx.from.id)) return;

  const logs = auditRepo.getRecent(10);
  if (logs.length === 0) {
    return ctx.reply('📜 لا توجد عمليات مسجلة في السجل حتى الآن.', getDevKeyboard());
  }

  let text = `╭━━━ ❮ 📜 <b>سجل العمليات الإدارية</b> ❯ ━━━╮\n<blockquote>\n`;
  logs.forEach(l => {
    text += `• [<code>${l.created_at}</code>] <b>${l.action}</b> ❯ <code>${l.target_id || '-'}</code>\n  تفاصيل: <i>${l.details || '-'}</i>\n`;
  });
  text += `</blockquote>\n╰━━━━━━━━━━━━━━━━╯`;

  await ctx.reply(text, { parse_mode: 'HTML', ...getDevKeyboard() });
});

/**
 * ----------------------------------------------------
 * Text & Document Input Handler (State Machine)
 * ----------------------------------------------------
 */
bot.on('message', async (ctx) => {
  const userId = ctx.from.id;
  const state = userStates.get(userId);
  if (!state) return;

  // 0. Awaiting WhatsApp Phone for Pairing Code
  if (state.step === 'AWAITING_WA_PHONE_FOR_PAIRING' && ctx.message.text) {
    const rawInput = ctx.message.text.trim();
    const cleanPhone = rawInput.replace(/[^0-9]/g, '');

    if (cleanPhone.length < 8 || cleanPhone.length > 16) {
      return ctx.reply(
        `⚠️ <b>رقم الهاتف غير صالح!</b>\n` +
        `يرجى كتابة رقم الهاتف مع كود الدولة بصورة صحيحة (بين 8 إلى 16 رقماً بدون + أو مسافات).\n` +
        `مثال: <code>201012345678</code>`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_main_menu', 'danger', CUSTOM_ICONS.cross)]])
        }
      );
    }

    userStates.delete(userId);

    const waitMsg = await ctx.reply(
      `╭━━━ ❮ ${CE.hourglass} <b>جاري طلب كود الربط من واتساب</b> ❯ ━━━╮\n` +
      `<blockquote><i>جاري الاتصال وتوليد كود الربط للرقم:</i> <code>+${cleanPhone}</code>\n` +
      `يرجى الانتظار بضع ثوانٍ...</blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`,
      { parse_mode: 'HTML' }
    );

    let pairingMsgId = null;

    try {
      await whatsappManager.startSession(
        userId,
        null,
        // onConnected callback
        async (phoneNumber, pushName) => {
          if (pairingMsgId) {
            await ctx.telegram.deleteMessage(userId, pairingMsgId).catch(() => {});
          }
          const successMsg = `╭━━━ ❮ ${CE.check} <b>تم ربط حساب واتساب بنجاح!</b> ❯ ━━━╮\n` +
            `<blockquote>\n` +
            `${CE.phone} <b>الرقم المرتبط:</b> <code>+${phoneNumber}</code>\n` +
            `${CE.user} <b>الاسم:</b> <i>${pushName || 'مستخدم واتساب'}</i>\n` +
            `<tg-spoiler>تم تأمين وحفظ الجلسة السحابية بنجاح 🟢</tg-spoiler>\n` +
            `</blockquote>\n\n` +
            `<i>يمكنك الآن التحكم بكافة الميزات والخدمات من اللوحة أدناه:</i>\n` +
            `╰━━━━━━━━━━━━━━━━╯`;

          await ctx.telegram.sendMessage(
            userId,
            successMsg,
            { parse_mode: 'HTML', ...getServicesKeyboard(userId) }
          );
        },
        {
          method: 'pairing_code',
          phoneNumber: cleanPhone,
          onPairingCode: async (code) => {
            await ctx.telegram.deleteMessage(userId, waitMsg.message_id).catch(() => {});

            const formattedCode = code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

            const codeMsg = `╭━━━ ❮ 🔢 <b>كود ربط واتساب (Pairing Code)</b> ❯ ━━━╮\n` +
              `<blockquote><b>اضغط على الكود بالأسفل لنسخه فوراً:</b>\n\n` +
              `<code>${formattedCode}</code></blockquote>\n\n` +
              `<blockquote>\n` +
              `📌 <b>خطوات الربط على هاتفك الآن:</b>\n` +
              `1️⃣ افتح تطبيق <b>واتساب</b> على هاتفك ❯ <b>الإعدادات</b>.\n` +
              `2️⃣ اختر <b>الأجهزة المرتبطة (Linked Devices)</b>.\n` +
              `3️⃣ اضغط على <b>ربط جهاز (Link a Device)</b>.\n` +
              `4️⃣ اضغط في الأسفل على <b>«الربط برقم الهاتف بدلاً من ذلك» (Link with phone number instead)</b>.\n` +
              `5️⃣ أدخل الكود أعلاه <code>${formattedCode}</code> وسيتصل البوت مباشرة!\n` +
              `</blockquote>\n` +
              `<blockquote>⏳ <i>الكود صالح لفترة محدودة، في حال انتهاء الوقت يمكنك طلب كود جديد.</i></blockquote>\n` +
              `╰━━━━━━━━━━━━━━━━╯`;

            const sent = await ctx.reply(codeMsg, {
              parse_mode: 'HTML',
              ...Markup.inlineKeyboard([
                [btn('طلب كود جديد', 'act_link_by_pairing', 'primary', CUSTOM_ICONS.phone)],
                [btn('القائمة الرئيسية', 'act_main_menu', 'danger', CUSTOM_ICONS.top)],
              ])
            });
            pairingMsgId = sent.message_id;
          },
          onError: async (err) => {
            await ctx.telegram.deleteMessage(userId, waitMsg.message_id).catch(() => {});
            await ctx.reply(
              `❌ <b>فشل توليد كود الربط:</b> ${err.message || 'خطأ غير معروف'}\n\n` +
              `يرجى التأكد من أن الرقم مسجل بالفعل في واتساب وإعادة المحاولة.`,
              {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([
                  [btn('إعادة المحاولة برقم آخر', 'act_link_by_pairing', 'primary', CUSTOM_ICONS.phone)],
                  [btn('الربط عبر باركود QR', 'act_link_by_qr', 'primary', CUSTOM_ICONS.camera)],
                  [btn('القائمة الرئيسية', 'act_main_menu', 'danger', CUSTOM_ICONS.top)],
                ])
              }
            );
          }
        }
      );
    } catch (err) {
      await ctx.telegram.deleteMessage(userId, waitMsg.message_id).catch(() => {});
      return ctx.reply(`❌ فشل بدء جلسة الربط: ${err.message}`);
    }
    return;
  }

  // 1. Awaiting greeting text
  if (state.step === 'AWAITING_GREETING_TEXT' && ctx.message.text) {
    const text = ctx.message.text.trim();
    userStates.set(userId, { step: 'CONFIRM_GREETING', text });
    const previewText = `╭━━━ ❮ 👁 <b>معاينة رسالة الترحيب</b> ❯ ━━━╮\n` +
      `<blockquote><code>${text}</code></blockquote>\n` +
      `<blockquote><i>هل ترغب في حفظ هذه الرسالة وتفعيلها للردود التلقائية؟</i></blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;

    return ctx.reply(previewText, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [btn('حفظ وتفعيل', 'act_confirm_save_greeting', 'success', CUSTOM_ICONS.check)],
        [btn('إلغاء وتراجع', 'act_main_menu', 'danger', CUSTOM_ICONS.cross)],
      ])
    });
  }

  // 2. Awaiting Gmail Email
  if (state.step === 'AWAITING_GMAIL_EMAIL' && ctx.message.text) {
    const email = ctx.message.text.trim().toLowerCase();
    if (!email.includes('@') || !email.includes('.')) {
      return ctx.reply('⚠️ يرجى إدخال عنوان بريد إلكتروني صالح (Gmail).');
    }

    userStates.set(userId, { step: 'AWAITING_GMAIL_APP_PASSWORD', email });
    const appPassPrompt = `╭━━━ ❮ 🔑 <b>كلمة مرور التطبيقات (App Password)</b> ❯ ━━━╮\n` +
      `<blockquote>أرسل الآن كلمة مرور التطبيقات المكونة من 16 حرفًا:\n(مثال: <code>idii rntp ujxe jdfd</code>)</blockquote>\n\n` +
      `<blockquote>\n` +
      `📌 <b>طريقة استخراجها في 3 خطوات بسيطة:</b>\n` +
      `1️⃣ ادخل حساب Google: <i>myaccount.google.com</i>\n` +
      `2️⃣ اختر <b>الأمان (Security)</b> وتأكد من تفعيل <b>التحقق بخطوتين</b>.\n` +
      `3️⃣ انزل إلى <b>كلمات مرور التطبيقات (App passwords)</b> وأنشئ اسماً وانسخ الـ 16 حرفاً وأرسلها هنا.\n` +
      `</blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;

    return ctx.reply(appPassPrompt, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_main_menu', 'danger', CUSTOM_ICONS.cross)]])
    });
  }

  // Awaiting Gmail App Password
  if (state.step === 'AWAITING_GMAIL_APP_PASSWORD' && ctx.message.text) {
    const appPassword = ctx.message.text.trim();
    const email = state.email;

    const waitMsg = await ctx.reply(
      `╭━━━ ❮ ⏳ <b>جاري الاتصال والتحقق السحابي</b> ❯ ━━━╮\n` +
      `<blockquote><i>جاري التحقق من صحة الحساب مع خوادم Google...</i></blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`,
      { parse_mode: 'HTML' }
    );

    try {
      await googleService.saveCredentials(userId, email, appPassword);
      userStates.delete(userId);

      await ctx.telegram.deleteMessage(userId, waitMsg.message_id).catch(() => {});
      const successText = `╭━━━ ❮ ${CE.check} <b>تم ربط Google Contacts بنجاح!</b> ❯ ━━━╮\n` +
        `<blockquote>📧 <b>الحساب:</b> <code>${email}</code>\n` +
        `<tg-spoiler>سيتم حفظ الأرقام الجديدة تلقائياً في جهات الاتصال الرئيسية ${CE.sparkles}</tg-spoiler></blockquote>\n` +
        `╰━━━━━━━━━━━━━━━━╯`;

      return ctx.reply(successText, {
        parse_mode: 'HTML',
        ...getServicesKeyboard(userId)
      });
    } catch (err) {
      await ctx.telegram.deleteMessage(userId, waitMsg.message_id).catch(() => {});
      return ctx.reply(
        `❌ <b>فشل الربط:</b> ${err.message}\n\nيرجى التأكد من كتابة كلمة مرور التطبيقات المكونة من 16 حرفاً بصورة صحيحة والمحاولة مجدداً:`,
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_main_menu', 'danger', CUSTOM_ICONS.cross)]])
        }
      );
    }
  }

  // 3. Awaiting Auto-Save Prefix
  if (state.step === 'AWAITING_AUTOSAVE_PREFIX' && ctx.message.text) {
    const prefix = ctx.message.text.trim();
    userStates.set(userId, { step: 'AWAITING_AUTOSAVE_COUNTER', prefix });
    const text = `╭━━━ ❮ 🔢 <b>رقم بداية التسلسل</b> ❯ ━━━╮\n` +
      `<blockquote><b>الاسم المعتمد:</b> <code>${prefix}</code>\n` +
      `<i>أدخل الآن رقم البداية للترقيم (مثال: 1):</i></blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;

    return ctx.reply(text, { parse_mode: 'HTML' });
  }

  // 4. Awaiting Auto-Save Starting Counter
  if (state.step === 'AWAITING_AUTOSAVE_COUNTER' && ctx.message.text) {
    const counter = parseInt(ctx.message.text.trim(), 10) || 1;
    settingsRepo.update(userId, {
      auto_save_enabled: 1,
      auto_save_mode: 'custom_prefix',
      custom_prefix: state.prefix,
      custom_counter: counter,
    });
    userStates.delete(userId);
    const successText = `╭━━━ ❮ ${CE.check} <b>تم تفعيل الحفظ التسلسلي</b> ❯ ━━━╮\n` +
      `<blockquote>الأرقام القادمة ستحفظ في Google بالتسلسل التالي:\n` +
      `• <code>${state.prefix} ${counter}</code>\n` +
      `• <code>${state.prefix} ${counter + 1}</code>...\n` +
      `<tg-spoiler>العداد محفوظ بأمان في قاعدة البيانات لن يتكرر أبداً.</tg-spoiler></blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;

    return ctx.reply(successText, {
      parse_mode: 'HTML',
      ...getServicesKeyboard(userId)
    });
  }

  // 5. Awaiting VCF Document
  if (state.step === 'AWAITING_VCF_FILE' && ctx.message.document) {
    const doc = ctx.message.document;
    if (!doc.file_name.toLowerCase().endsWith('.vcf')) {
      return ctx.reply('⚠️ يرجى إرسال ملف ينتهي بصيغة <b>.vcf</b> حصراً.', { parse_mode: 'HTML' });
    }

    try {
      const fileLink = await ctx.telegram.getFileLink(doc.file_id);
      const res = await fetch(fileLink.href);
      const vcfContent = await res.text();

      const parsed = parseVcfContent(vcfContent);
      if (parsed.contacts.length === 0) {
        return ctx.reply('⚠️ لم يتم العثور على أرقام هواتف صالحة داخل الملف. يرجى التأكد من الملف وإعادة المحاولة.');
      }

      userStates.set(userId, { step: 'AWAITING_VCF_BROADCAST_TEXT', contacts: parsed.contacts });
      const summaryText = `╭━━━ ❮ 📊 <b>ملخص فحص ملف الأرقام</b> ❯ ━━━╮\n` +
        `<blockquote>• إجمالي الأرقام الصالحة: <b>${parsed.contacts.length}</b> رقم (تمت تصفية واستبعاد المكرر).</blockquote>\n\n` +
        `<blockquote><i>أرسل الآن نص الرسالة التي تريد إرسالها لجهات الاتصال هذه:</i></blockquote>\n` +
        `╰━━━━━━━━━━━━━━━━╯`;

      return ctx.reply(summaryText, {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[btn('إلغاء وتراجع', 'act_main_menu', 'danger', CUSTOM_ICONS.cross)]])
      });
    } catch (err) {
      return ctx.reply(`❌ حدث خطأ أثناء قراءة الملف: ${err.message}`);
    }
  }

  // 6. Awaiting VCF Broadcast Text
  if (state.step === 'AWAITING_VCF_BROADCAST_TEXT' && ctx.message.text) {
    const text = ctx.message.text.trim();
    userStates.set(userId, { step: 'CONFIRM_VCF_SEND', contacts: state.contacts, text });
    const previewText = `╭━━━ ❮ 👁 <b>معاينة الحملة الإعلانية</b> ❯ ━━━╮\n` +
      `<blockquote>\n` +
      `👥 <b>المستلمون:</b> <code>${state.contacts.length}</code> جهة اتصال\n` +
      `📝 <b>نص الرسالة:</b>\n<code>${text}</code>\n` +
      `</blockquote>\n\n` +
      `<blockquote>🛡️ <i>سيتم الإرسال بنظام مكافحة الحظر بفواصل زمنية عشوائية ومحاكاة الكتابة.</i></blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;

    return ctx.reply(previewText, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [btn('بدء الإرسال الآن', 'act_start_vcf_broadcast', 'success', CUSTOM_ICONS.fire)],
        [btn('إلغاء وتراجع', 'act_main_menu', 'danger', CUSTOM_ICONS.cross)],
      ])
    });
  }

  // ---------------- Developer States ----------------
  if (!isAdmin(userId)) return;

  // Dev: Add Sub User ID
  if (state.step === 'DEV_AWAIT_ADD_SUB_USERID' && ctx.message.text) {
    const targetId = parseInt(ctx.message.text.trim(), 10);
    if (!targetId) return ctx.reply('⚠️ يرجى إدخال معرف أرقام صحيح.');

    userStates.set(userId, { step: 'DEV_AWAIT_ADD_SUB_DAYS', targetId });
    return ctx.reply(`⏳ أدخل عدد الأيام للاشتراك للمستخدم <code>${targetId}</code> (مثال: 30):`, { parse_mode: 'HTML' });
  }

  // Dev: Add Sub Days
  if (state.step === 'DEV_AWAIT_ADD_SUB_DAYS' && ctx.message.text) {
    const days = parseInt(ctx.message.text.trim(), 10);
    if (!days || days <= 0) return ctx.reply('⚠️ يرجى إدخال عدد أيام صحيح أكبر من صفر.');

    try {
      const newEnd = subscriptionService.addSubscription(userId, state.targetId, days);
      userStates.delete(userId);

      // Notify target user if bot can reach them
      bot.telegram.sendMessage(
        state.targetId,
        `╭━━━ ❮ 🎉 <b>تهانينا! تفعيل اشتراك</b> ❯ ━━━╮\n` +
        `<blockquote>تم تفعيل اشتراكك بنجاح لمدة <b>${days} يوم</b>.\nتاريخ الانتهاء: <code>${newEnd.toLocaleString('ar-EG')}</code></blockquote>\n` +
        `╰━━━━━━━━━━━━━━━━╯`,
        { parse_mode: 'HTML' }
      ).catch(() => {});

      return ctx.reply(
        `✅ <b>تم إضافة اشتراك للمستخدم</b> <code>${state.targetId}</code> <b>بنجاح.</b>\nتاريخ الانتهاء الجديد: <code>${newEnd.toLocaleString('ar-EG')}</code>`,
        { parse_mode: 'HTML', ...getDevKeyboard() }
      );
    } catch (err) {
      return ctx.reply(`❌ خطأ: ${err.message}`, getDevKeyboard());
    }
  }

  // Dev: Remove Sub User ID
  if (state.step === 'DEV_AWAIT_REMOVE_SUB_USERID' && ctx.message.text) {
    const targetId = parseInt(ctx.message.text.trim(), 10);
    const user = userRepo.get(targetId);
    if (!user) return ctx.reply('⚠️ هذا المستخدم غير موجود في قاعدة البيانات.', getDevKeyboard());

    const sub = subscriptionService.getStatus(targetId);
    userStates.set(userId, { step: 'DEV_CONFIRM_REMOVE_SUB', targetId });

    const confirmText = `╭━━━ ❮ ⚠️ <b>تأكيد إنهاء الاشتراك</b> ❯ ━━━╮\n` +
      `<blockquote>\n` +
      `• <b>المعرف:</b> <code>${targetId}</code>\n` +
      `• <b>الاسم:</b> <i>${user.first_name || user.username || '-'}</i>\n` +
      `• <b>الحالة:</b> <b>${sub.remainingText}</b>\n` +
      `</blockquote>\n` +
      `<i>هل ترغب بالتأكيد في إنهاء اشتراكه فوراً؟</i>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;

    return ctx.reply(confirmText, {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [btn('نعم، إنهاء الاشتراك', 'dev_confirm_remove_sub', 'danger', CUSTOM_ICONS.cross)],
        [btn('تراجع', 'act_dev_panel', 'primary', CUSTOM_ICONS.top)],
      ])
    });
  }

  // Dev: Gift Free Hours
  if (state.step === 'DEV_AWAIT_GIFT_HOURS' && ctx.message.text) {
    const hours = parseInt(ctx.message.text.trim(), 10);
    if (!hours || hours <= 0) return ctx.reply('⚠️ يرجى إدخال عدد ساعات صحيح أكبر من صفر.');

    const res = subscriptionService.giftTimeToAll(userId, hours);
    userStates.delete(userId);

    const allUsers = userRepo.getAll();
    for (const u of allUsers) {
      bot.telegram.sendMessage(
        u.telegram_id,
        `╭━━━ ❮ 🎁 <b>هدية من الإدارة!</b> ❯ ━━━╮\n` +
        `<blockquote>تمت إضافة <b>${hours} ساعة مجانية</b> إلى مدة اشتراكك. استمتع بخدماتنا! ✨</blockquote>\n` +
        `╰━━━━━━━━━━━━━━━━╯`,
        { parse_mode: 'HTML' }
      ).catch(() => {});
    }

    return ctx.reply(`✅ <b>تم إهداء ${hours} ساعة بنجاح لجميع المستخدمين (${res.updatedCount} مستخدم).</b>`, {
      parse_mode: 'HTML',
      ...getDevKeyboard()
    });
  }

  // Dev: Change Default Trial Hours
  if (state.step === 'DEV_AWAIT_TRIAL_HOURS' && ctx.message.text) {
    const hours = parseInt(ctx.message.text.trim(), 10);
    if (!hours || hours <= 0) return ctx.reply('⚠️ يرجى إدخال عدد ساعات صحيح.');

    appSettingsRepo.setTrialHours(hours);
    auditRepo.log(userId, 'CHANGE_TRIAL_HOURS', null, { newHours: hours });
    userStates.delete(userId);

    return ctx.reply(`✅ <b>تم تعديل وقت التجربة الافتراضية للجدد إلى</b> <code>${hours}</code> <b>ساعة.</b>`, {
      parse_mode: 'HTML',
      ...getDevKeyboard()
    });
  }

  // Dev: Broadcast Message
  if (state.step === 'DEV_AWAIT_BROADCAST_MSG') {
    userStates.delete(userId);
    const users = userRepo.getAll();
    let sent = 0;
    let failed = 0;

    const progressMsg = await ctx.reply(`📢 <b>جاري الإرسال إلى ${users.length} مستخدم...</b>`, { parse_mode: 'HTML' });

    for (const u of users) {
      try {
        await ctx.telegram.copyMessage(u.telegram_id, ctx.chat.id, ctx.message.message_id);
        sent++;
      } catch {
        failed++;
      }
      await new Promise(r => setTimeout(r, 60)); // Safe broadcast throttle
    }

    const reportText = `╭━━━ ❮ 📢 <b>تقرير الإذاعة العامة</b> ❯ ━━━╮\n` +
      `<blockquote>\n` +
      `• تم الإرسال بنجاح: <b>${sent}</b> ✅\n` +
      `• فشل (حظر أو خطأ): <b>${failed}</b> ❌\n` +
      `</blockquote>\n` +
      `╰━━━━━━━━━━━━━━━━╯`;

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      progressMsg.message_id,
      null,
      reportText,
      { parse_mode: 'HTML' }
    );
  }
});

/**
 * ----------------------------------------------------
 * Bootstrap & Graceful Shutdown
 * ----------------------------------------------------
 */
async function bootstrap() {
  console.log('🤖 Starting Telegram Bot «إدارة واتس»...');

  // Resume active sessions
  whatsappManager.resumeAllActiveSessions().catch(err => {
    console.error('Error resuming sessions:', err);
  });

  // Resolve and cache support contact from ADMIN_ID
  getSupportContact().then(sup => {
    console.log(`📞 Support contact resolved automatically from ADMIN_ID: ${sup.text}`);
  }).catch(() => {});

  bot.launch({
    dropPendingUpdates: true,
  }).then(() => {
    console.log(' Telegram Bot launched successfully!');
  }).catch((err) => {
    console.error('❌ Failed to launch Telegram Bot:', err);
  });
}

bootstrap();

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

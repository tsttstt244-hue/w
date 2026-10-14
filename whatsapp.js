import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  downloadContentFromMessage,
  normalizeMessageContent,
  fetchLatestBaileysVersion,
  Browsers,
  getUrlFromDirectPath,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { config } from './config.js';
import { whatsappRepo, settingsRepo, contactsRepo, googleRepo } from './database.js';
import { subscriptionService } from './subscriptions.js';
import { handleWhatsAppPlugins } from './plugins/index.js';

// Helper to escape HTML for Telegram messages
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Helper to thoroughly unwrap nested messages down to the concrete payload
function unwrapMessage(msg) {
  if (!msg) return null;
  let curr = msg;
  for (let i = 0; i < 10; i++) {
    if (!curr) break;
    if (curr.ephemeralMessage?.message) { curr = curr.ephemeralMessage.message; continue; }
    if (curr.viewOnceMessage?.message) { curr = curr.viewOnceMessage.message; continue; }
    if (curr.viewOnceMessageV2?.message) { curr = curr.viewOnceMessageV2.message; continue; }
    if (curr.viewOnceMessageV2Extension?.message) { curr = curr.viewOnceMessageV2Extension.message; continue; }
    if (curr.documentWithCaptionMessage?.message) { curr = curr.documentWithCaptionMessage.message; continue; }
    if (curr.editedMessage?.message) { curr = curr.editedMessage.message; continue; }
    if (curr.message) { curr = curr.message; continue; }
    break;
  }
  return curr;
}

// Helper to detect if message is View Once (عرض لمرة واحدة / ذاتية الاختفاء)
function checkIsViewOnce(m) {
  if (!m) return false;
  if (m.key?.isViewOnce) return true;

  try {
    const rawJson = JSON.stringify(m.message || m || {});
    if (
      rawJson.includes('viewOnce') ||
      rawJson.includes('"viewOnce":true') ||
      rawJson.includes('viewOnceMessage') ||
      rawJson.includes('viewOnceMessageV2') ||
      rawJson.includes('viewOnceMessageV2Extension')
    ) {
      return true;
    }
  } catch (e) {}

  return false;
}

// Disk logger for real-time diagnostics
function debugLog(...args) {
  try {
    const line = `[${new Date().toISOString()}] ` + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') + '\n';
    fs.appendFileSync(path.join(config.paths.root, 'data', 'debug.log'), line);
  } catch (e) {}
}

// Helper to recursively find media payload at any depth of nested objects
function findMediaInObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 10) return null;

  if (obj.imageMessage && (obj.imageMessage.directPath || obj.imageMessage.url || obj.imageMessage.mediaKey)) {
    return { type: 'image', media: obj.imageMessage };
  }
  if (obj.videoMessage && (obj.videoMessage.directPath || obj.videoMessage.url || obj.videoMessage.mediaKey)) {
    return { type: 'video', media: obj.videoMessage };
  }
  if (obj.audioMessage && (obj.audioMessage.directPath || obj.audioMessage.url || obj.audioMessage.mediaKey)) {
    return { type: 'audio', media: obj.audioMessage };
  }
  if (obj.ptvMessage && (obj.ptvMessage.directPath || obj.ptvMessage.url || obj.ptvMessage.mediaKey)) {
    return { type: 'video', media: obj.ptvMessage };
  }
  if (obj.documentMessage && (obj.documentMessage.directPath || obj.documentMessage.url || obj.documentMessage.mediaKey)) {
    const isImage = obj.documentMessage.mimetype?.startsWith('image/');
    const isVideo = obj.documentMessage.mimetype?.startsWith('video/');
    if (isImage) return { type: 'image', media: obj.documentMessage };
    if (isVideo) return { type: 'video', media: obj.documentMessage };
    return { type: 'document', media: obj.documentMessage };
  }

  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const found = findMediaInObject(obj[key], depth + 1);
      if (found) return found;
    }
  }

  return null;
}

// Robust multi-strategy downloader for both view-once and regular media
async function downloadMediaBuffer(m, sock) {
  const payload = findMediaInObject(m.message || m);
  if (!payload) {
    throw new Error('No media payload found in message');
  }

  const { type: mediaType, media } = payload;
  debugLog(`Starting media download for ${mediaType}, directPath=${media.directPath}`);

  // Method 1: Using downloadContentFromMessage with direct media object
  try {
    const stream = await downloadContentFromMessage(media, mediaType);
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    if (buf && buf.length > 0) {
      debugLog(`Method 1 (direct downloadContentFromMessage) succeeded, size: ${buf.length}`);
      return { buffer: buf, mediaType };
    }
  } catch (err) {
    debugLog(`Method 1 failed: ${err.message}`);
  }

  // Method 2: Dynamic hosts from sock.refreshMediaConn
  try {
    let hosts = ['mmg.whatsapp.net', 'mms.whatsapp.net'];
    try {
      const mediaConn = await sock?.refreshMediaConn?.(false).catch(() => null);
      if (mediaConn?.hosts && Array.isArray(mediaConn.hosts)) {
        const dynamicHosts = mediaConn.hosts.map(h => h.hostname).filter(Boolean);
        hosts = [...new Set([...dynamicHosts, ...hosts])];
      }
    } catch (e) {}

    for (const host of hosts) {
      try {
        const stream = await downloadContentFromMessage(media, mediaType, { host });
        const chunks = [];
        for await (const chunk of stream) chunks.push(chunk);
        const buf = Buffer.concat(chunks);
        if (buf && buf.length > 0) {
          debugLog(`Method 2 (dynamic host ${host}) succeeded, size: ${buf.length}`);
          return { buffer: buf, mediaType };
        }
      } catch (e) {}
    }
  } catch (err) {
    debugLog(`Method 2 failed: ${err.message}`);
  }

  // Method 3: downloadMediaMessage with synthesized url
  try {
    const patchedMedia = { ...media };
    if (!patchedMedia.url && patchedMedia.directPath) {
      patchedMedia.url = `https://mmg.whatsapp.net${patchedMedia.directPath}`;
    }

    const testMsg = {
      key: m.key,
      message: {
        [`${mediaType}Message`]: patchedMedia
      }
    };

    const buf = await downloadMediaMessage(
      testMsg,
      'buffer',
      {},
      { reuploadRequest: sock?.updateMediaMessage }
    );
    if (buf && buf.length > 0) {
      debugLog(`Method 3 (patched downloadMediaMessage) succeeded, size: ${buf.length}`);
      return { buffer: buf, mediaType };
    }
  } catch (err) {
    debugLog(`Method 3 failed: ${err.message}`);
  }

  // Method 4: downloadMediaMessage on original wrapper
  try {
    const buf = await downloadMediaMessage(
      m,
      'buffer',
      {},
      { reuploadRequest: sock?.updateMediaMessage }
    );
    if (buf && buf.length > 0) {
      debugLog(`Method 4 (raw downloadMediaMessage) succeeded, size: ${buf.length}`);
      return { buffer: buf, mediaType };
    }
  } catch (err) {
    debugLog(`Method 4 failed: ${err.message}`);
  }

  throw new Error('All download strategies failed');
}

// Helper to extract clean text from message
function extractMessageText(msg) {
  if (!msg) return '';
  const inner = unwrapMessage(msg) || msg;
  return (
    inner.conversation ||
    msg.conversation ||
    inner.extendedTextMessage?.text ||
    msg.extendedTextMessage?.text ||
    inner.imageMessage?.caption ||
    msg.imageMessage?.caption ||
    inner.videoMessage?.caption ||
    msg.videoMessage?.caption ||
    inner.buttonsResponseMessage?.selectedButtonId ||
    inner.templateButtonReplyMessage?.selectedId ||
    inner.listResponseMessage?.singleSelectReply?.selectedRowId ||
    inner.interactiveResponseMessage?.body?.text ||
    ''
  ).trim();
}

// Helper to resolve real phone number from JID (including @lid mappings)
function resolveRealPhoneNumber(telegramId, jid, m = null) {
  if (!jid) return null;
  const rawId = jid.split('@')[0];
  if (jid.endsWith('@s.whatsapp.net')) {
    return rawId;
  }
  if (jid.endsWith('@lid')) {
    const sessionDir = path.join(config.paths.sessions, `user_${telegramId}`);
    const mappingFile = path.join(sessionDir, `lid-mapping-${rawId}_reverse.json`);
    if (fs.existsSync(mappingFile)) {
      try {
        const val = JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
        if (val) return String(val).replace(/[^0-9]/g, '');
      } catch (e) {}
    }
  }
  return rawId;
}

export class WhatsAppManager {
  constructor(googleService = null, botInstance = null) {
    this.googleService = googleService;
    this.bot = botInstance;
    // Map of active sockets: telegramId -> { sock, qrString, isConnecting, greetedJids: Map<string, number> }
    this.sessions = new Map();
  }

  setBot(botInstance) {
    this.bot = botInstance;
  }

  setGoogleService(googleService) {
    this.googleService = googleService;
  }

  getSessionPath(telegramId) {
    return path.join(config.paths.sessions, `user_${telegramId}`);
  }

  /**
   * Check if a user currently has an active, connected WhatsApp session
   */
  isConnected(telegramId) {
    const session = this.sessions.get(Number(telegramId));
    return !!(session && session.sock && session.isConnected);
  }

  /**
   * Get session object
   */
  getSession(telegramId) {
    return this.sessions.get(Number(telegramId));
  }

  /**
   * Start or create a connection session for a user (Supports QR and Pairing Code)
   */
  async startSession(telegramId, onQrCallback = null, onConnectedCallback = null, options = {}) {
    telegramId = Number(telegramId);
    const { method = 'qr', phoneNumber = null, onPairingCode = null, onError = null } = options;

    // Verify subscription status before starting session
    const sub = subscriptionService.getStatus(telegramId);
    if (!sub.isActive) {
      throw new Error('اشتراكك غير مفعل أو منتهي. يرجى تجديد الاشتراك أولاً.');
    }

    // If session is already open and connected, return existing socket
    if (this.isConnected(telegramId)) {
      return this.sessions.get(telegramId).sock;
    }

    // Close any previous pending/unconnected socket for this user
    const existing = this.sessions.get(telegramId);
    if (existing && existing.sock && !existing.isConnected) {
      try {
        existing.sock.end();
      } catch (e) {}
      this.sessions.delete(telegramId);
    }

    const sessionDir = this.getSessionPath(telegramId);

    // Only clean session directory if it's a fresh user-initiated connection attempt (NOT a reconnect)
    if (!options.isReconnect) {
      const waAccount = whatsappRepo.get(telegramId);
      if (!waAccount || !waAccount.is_connected) {
        this.cleanSessionFiles(telegramId);
      }
    }

    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1043857760] }));

    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
      version,
      auth: state,
      logger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      generateHighQualityLinkPreview: false,
    });

    const sessionData = {
      sock,
      isConnected: false,
      isConnecting: true,
      qrString: null,
      greetedJids: new Map(), // jid -> lastGreetingTimestamp
      onQr: onQrCallback,
      onConnected: onConnectedCallback,
      onPairingCode,
      onError,
      options,
      method,
      phoneNumber,
    };
    this.sessions.set(telegramId, sessionData);

    // Save auth credentials whenever updated
    sock.ev.on('creds.update', saveCreds);

    // If method is pairing code and not a reconnect, request it after socket is initialized
    if (method === 'pairing_code' && phoneNumber && !options.isReconnect) {
      if (!sock.authState.creds.registered) {
        setTimeout(async () => {
          try {
            const cleanPhone = String(phoneNumber).replace(/[^0-9]/g, '');
            console.log(`[WhatsApp] 🔢 طلب كود الربط للمستخدم ${telegramId} بالرقم (+${cleanPhone})...`);
            const code = await sock.requestPairingCode(cleanPhone);
            console.log(`[WhatsApp] ✅ تم استخراج كود الربط بنجاح: ${code}`);
            if (onPairingCode) {
              onPairingCode(code);
            }
          } catch (err) {
            console.error(`[WhatsApp] فشل استخراج كود الربط للمستخدم ${telegramId}:`, err.message);
            if (onError) {
              onError(err);
            }
          }
        }, 2000);
      }
    }

    // Connection updates: QR code, opened, closed
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && method === 'qr') {
        sessionData.qrString = qr;
        try {
          const qrBuffer = await QRCode.toBuffer(qr, { width: 350, margin: 2 });
          if (sessionData.onQr) {
            sessionData.onQr(qrBuffer);
          }
        } catch (err) {
          console.error(`[WhatsApp] Failed to generate QR buffer for user ${telegramId}:`, err);
        }
      }

      if (connection === 'open') {
        sessionData.isConnected = true;
        sessionData.isConnecting = false;
        sessionData.qrString = null;

        const rawJid = sock.user?.id || '';
        const userPhone = rawJid.split(':')[0].split('@')[0];
        const pushName = sock.user?.name || '';

        console.log(`[WhatsApp] ✅ اتصال ناجح للمستخدم ${telegramId} بالرقم (+${userPhone}) [${pushName}]`);
        whatsappRepo.upsert(telegramId, userPhone, pushName);

        if (sessionData.onConnected) {
          sessionData.onConnected(userPhone, pushName);
        }
      }

      if (connection === 'close') {
        sessionData.isConnected = false;
        sessionData.isConnecting = false;

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;

        console.log(`[WhatsApp] Connection closed for user ${telegramId}. Status: ${statusCode}, Reason: ${lastDisconnect?.error?.message}`);

        if (isLoggedOut) {
          const wasConnected = !!whatsappRepo.get(telegramId)?.is_connected;
          whatsappRepo.disconnect(telegramId);
          this.cleanSessionFiles(telegramId);
          this.sessions.delete(telegramId);

          if (this.bot && wasConnected) {
            this.bot.telegram.sendMessage(
              telegramId,
              '⚠️ **تم تسجيل الخروج من حساب واتساب.**\nيمكنك إعادة الربط في أي وقت من لوحة التحكم.',
              { parse_mode: 'Markdown' }
            ).catch(() => {});
          }
        } else {
          // Auto-reconnect for status 515 (restart required), network hiccups, etc.
          const currentSub = subscriptionService.getStatus(telegramId);
          if (currentSub.isActive) {
            console.log(`[WhatsApp] Reconnecting session for user ${telegramId} (preserving state)...`);
            setTimeout(() => {
              this.startSession(
                telegramId,
                sessionData.onQr,
                sessionData.onConnected,
                {
                  ...sessionData.options,
                  isReconnect: true,
                  method: sessionData.method,
                  phoneNumber: sessionData.phoneNumber,
                  onPairingCode: sessionData.onPairingCode,
                  onError: sessionData.onError,
                }
              ).catch((e) => {
                console.error(`[WhatsApp] Auto-reconnect failed for ${telegramId}:`, e);
              });
            }, 2500);
          }
        }
      }
    });

    // Message handler for commands, greeting, auto-save, story viewing, and media alerts
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (!messages || !Array.isArray(messages)) return;
      debugLog(`[User ${telegramId}] messages.upsert event: ${messages.length} messages, type=${type}`);

      for (const m of messages) {
        if (!m || !m.message) continue;

        // Verify user subscription is still active
        const subCheck = subscriptionService.getStatus(telegramId);
        if (!subCheck.isActive) continue;

        try {
          await this.handleIncomingMessage(telegramId, sock, m, sessionData);
        } catch (err) {
          console.error(`[WhatsApp] Error handling message for user ${telegramId}:`, err);
        }
      }
    });

    return sock;
  }

  /**
   * Handle incoming WhatsApp messages:
   * 1. Stories / Status view & react
   * 2. WhatsApp Interactive Commands (.اوامر, .ping, .info, .ترحيب)
   * 3. Greeting messages
   * 4. Auto-saving contacts to Google
   * 5. Media alerts (حفظ الذاتية والوسائط)
   */
  async handleIncomingMessage(telegramId, sock, m, sessionData) {
    const remoteJid = m.key.remoteJid;
    if (!remoteJid) return;

    const isFromMe = !!m.key.fromMe;
    const settings = settingsRepo.get(telegramId);

    // 1. Feature: Story Viewing & Reaction (استوريهات)
    if (remoteJid === 'status@broadcast') {
      if (settings.story_view_enabled && !isFromMe) {
        // Mark story as read
        await sock.readMessages([m.key]).catch(() => {});

        // React with heart if enabled
        if (settings.story_react_enabled && m.key.participant) {
          await sock.sendMessage('status@broadcast', {
            react: {
              text: '❤️',
              key: m.key,
            },
          }, { statusJidList: [m.key.participant] }).catch(() => {});
        }
      }
      return;
    }

    const unwrapped = unwrapMessage(m.message);
    const text = extractMessageText(m.message);
    const cleanCmd = text.toLowerCase().trim();

    // Determine chat type and sender number
    const isLid = remoteJid.endsWith('@lid');
    const isStandardUser = remoteJid.endsWith('@s.whatsapp.net');
    const isPrivate = isStandardUser || isLid;
    const senderNumber = resolveRealPhoneNumber(telegramId, remoteJid, m);

    // ==========================================
    // 2. Feature: WhatsApp Commands & Plugins Engine (أوامر سورس روك المزخرفة)
    // ==========================================
    if (text) {
      console.log(`[WhatsApp] 📨 نص الرسالة: "${text}" [من: ${remoteJid}, fromMe: ${isFromMe}]`);
    }
    try {
      const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedParticipant = m.message?.extendedTextMessage?.contextInfo?.participant;
      const quotedKey = m.message?.extendedTextMessage?.contextInfo?.stanzaId ? {
        remoteJid,
        id: m.message.extendedTextMessage.contextInfo.stanzaId,
        participant: quotedParticipant
      } : null;

      const isHandled = await handleWhatsAppPlugins(
        telegramId,
        sock,
        m,
        text,
        cleanCmd,
        {
          isFromMe,
          remoteJid,
          senderNumber,
          isPrivate,
          pushName: m.pushName || '',
          quoted: quotedKey ? { key: quotedKey, message: quotedMsg } : null,
        }
      );

      if (isHandled) {
        console.log(`[WhatsApp] ⚡ تم تنفيذ أمر سورس روك (${cleanCmd}) بنجاح في: ${remoteJid}`);
        return;
      }
    } catch (pluginErr) {
      console.error('[WhatsApp Plugins Error]:', pluginErr);
    }

    // Fallback commands: .معلومات / .ترحيب
    const isInfoCmd = ['.معلومات', '.info'].includes(cleanCmd);
    const isGreetingCmd = ['.ترحيب'].includes(cleanCmd);

    if (isInfoCmd) {
      const sub = subscriptionService.getStatus(telegramId);
      const infoText = `📊 *معلومات الحساب والاشتراك:*\n\n` +
        `• حالة الاشتراك: *${sub.isActive ? 'مفعل ✅' : 'منتهي ❌'}*\n` +
        `• المدة المتبقية: *${sub.remainingText}*\n` +
        `• رسالة الترحيب: *${settings.greeting_enabled ? 'مفعلة 🟢' : 'معطلة ⚪'}*\n` +
        `• الحفظ التلقائي: *${settings.auto_save_enabled ? 'مفعل 🟢' : 'معطل ⚪'}*\n` +
        `• مشاهدة الاستوريهات: *${settings.story_view_enabled ? 'مفعلة 🟢' : 'معطلة ⚪'}*\n` +
        `• حفظ الذاتية: *${settings.media_alert_enabled ? 'مفعل 🟢' : 'معطل ⚪'}*\n\n` +
        `💡 سورس روك: https://t.me/Source_Rock`;
      await sock.sendMessage(remoteJid, { text: infoText }, { quoted: m }).catch(() => {});
      return;
    }

    if (isGreetingCmd) {
      const greetingMsg = settings.greeting_text
        ? `💬 *نص رسالة الترحيب الحالية:*\n\n"${settings.greeting_text}"\n\nالحالة: *${settings.greeting_enabled ? 'مفعلة 🟢' : 'معطلة ⚪'}*`
        : `ℹ️ لا توجد رسالة ترحيب محفوظة حاليًا. يمكنك تعيينها عبر بوت تيليجرام.`;
      await sock.sendMessage(remoteJid, { text: greetingMsg }, { quoted: m }).catch(() => {});
      return;
    }

    const isViewOnce = checkIsViewOnce(m);

    // If message is sent from me, only process if it is a view-once message (allows testing and capturing outgoing view-once)
    if (isFromMe && !isViewOnce) return;

    // Incoming messages only for auto-save and greetings
    if (!isFromMe) {
      // ==========================================
      // 3. Feature: Auto-saving Contacts (Google) - Private only
      // ==========================================
      if (isPrivate && settings.auto_save_enabled && this.googleService) {
        const alreadySaved = contactsRepo.isSaved(telegramId, senderNumber);
        const googleLinked = googleRepo.get(telegramId);

        if (!alreadySaved && googleLinked) {
          try {
            let contactName = '';
            if (settings.auto_save_mode === 'custom_prefix') {
              contactName = settingsRepo.getNextCustomName(telegramId);
            } else {
              contactName = m.pushName || `${settings.custom_prefix || 'عميل'} ${senderNumber}`;
            }

            await this.googleService.createContact(telegramId, contactName, `+${senderNumber}`);
            contactsRepo.save(telegramId, senderNumber, contactName);

            if (this.bot) {
              const safeContactName = escapeHtml(contactName);
              const safeSenderNumber = escapeHtml(senderNumber);
              this.bot.telegram.sendMessage(
                telegramId,
                `📥 <b>تم حفظ جهة اتصال جديدة تلقائيًا!</b>\n👤 الاسم: <code>${safeContactName}</code>\n📞 الرقم: <code>+${safeSenderNumber}</code>\n📁 الحساب: Google Contacts`,
                { parse_mode: 'HTML' }
              ).catch(() => {});
            }
          } catch (err) {
            console.error(`[WhatsApp] Auto-save error for user ${telegramId}:`, err.message);
          }
        }
      }

      // ==========================================
      // 4. Feature: Greeting Message (رسالة الترحيب) - Private only
      // ==========================================
      if (isPrivate && settings.greeting_enabled && settings.greeting_text) {
        const lastGreeted = sessionData.greetedJids.get(remoteJid);
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        // Only send if never greeted or last greeted more than 24 hours ago
        if (!lastGreeted || (now - lastGreeted) > ONE_DAY) {
          sessionData.greetedJids.set(remoteJid, now);
          console.log(`[WhatsApp] 💬 إرسال رسالة ترحيب إلى: ${remoteJid}`);
          await sock.sendMessage(remoteJid, { text: settings.greeting_text }).catch((err) => {
            console.error(`[WhatsApp] Failed to send greeting to ${remoteJid}:`, err);
          });
        }
      }
    }

    // ==========================================
    // 5. Feature: Media Alert & View-Once Saver (حفظ الذاتية والوسائط)
    // ==========================================
    const payload = findMediaInObject(m.message || m);
    debugLog(`[User ${telegramId}] Message check: remoteJid=${remoteJid}, isFromMe=${isFromMe}, isViewOnce=${isViewOnce}, hasPayload=${!!payload}, mediaType=${payload?.type}`);

    if (isViewOnce || (settings.media_alert_enabled && !isFromMe && payload)) {
      if (payload && (payload.type === 'image' || payload.type === 'video' || payload.type === 'audio')) {
        try {
          console.log(`[WhatsApp] 📥 جاري سحب وسائط (${payload.type}${isViewOnce ? ' - ذاتية الاختفاء' : ''}) للمستخدم ${telegramId}...`);
          debugLog(`[User ${telegramId}] Attempting downloadMediaBuffer for ${payload.type}...`);
          const { buffer, mediaType } = await downloadMediaBuffer(m, sock);

          if (buffer && buffer.length > 0 && this.bot) {
            const safeName = escapeHtml(m.pushName || 'غير معروف');
            const safePhone = escapeHtml(senderNumber);

            const caption = isViewOnce
              ? `╭━━━ ❮ 𓆩 🧧 <b>حفـظ الذاتيـه تلقائيـاً</b> 𓆪 ❯ ━━━╮\n` +
                `<blockquote>\n` +
                `<b>⌔╎مࢪحبـاً عـزيـزي المـالك 🫂</b>\n` +
                `<b>⌔╎تـم حفـظ الذاتيـة تلقائيـاً .. بنجـاح ☑️</b>\n` +
                `━━━━━━━━━━━━━━━━\n` +
                `👤 <b>المـرسـل:</b> <i>${safeName}</i>\n` +
                `📞 <b>الـرقـم:</b> <code>+${safePhone}</code>\n` +
                `📁 <b>النـوع:</b> <i>${mediaType === 'image' ? 'صـورة ذاتيـة 📸' : mediaType === 'video' ? 'فيـديـو ذاتـي 🎥' : 'تسجيـل ذاتـي 🎙️'}</i>\n` +
                `</blockquote>\n\n` +
                `<blockquote><tg-spoiler>⚡ تم استخراج وحفظ المحتوى بنجاح وبأعلى دقة قبل اختفائه!</tg-spoiler></blockquote>\n` +
                `╰━━━━━━━━━━━━━━━━╯`
              : `╭━━━ ❮ 📁 <b>تنبيه وسائط واردة</b> ❯ ━━━╮\n` +
                `<blockquote>\n` +
                `👤 <b>المرسل:</b> <i>${safeName}</i>\n` +
                `📞 <b>الرقم:</b> <code>+${safePhone}</code>\n` +
                `📁 <b>النوع:</b> <i>${mediaType === 'image' ? 'صورة 📸' : mediaType === 'video' ? 'فيديو 🎥' : 'صوت 🎙️'}</i>\n` +
                `</blockquote>\n` +
                `╰━━━━━━━━━━━━━━━━╯`;

            if (mediaType === 'image') {
              await this.bot.telegram.sendPhoto(
                telegramId,
                { source: buffer },
                { caption, parse_mode: 'HTML' }
              ).catch(async (e) => {
                debugLog(`sendPhoto fallback to document: ${e.message}`);
                await this.bot.telegram.sendDocument(
                  telegramId,
                  { source: buffer, filename: 'view_once_photo.jpg' },
                  { caption, parse_mode: 'HTML' }
                );
              });
            } else if (mediaType === 'video') {
              await this.bot.telegram.sendVideo(
                telegramId,
                { source: buffer },
                { caption, parse_mode: 'HTML' }
              ).catch(async (e) => {
                debugLog(`sendVideo fallback to document: ${e.message}`);
                await this.bot.telegram.sendDocument(
                  telegramId,
                  { source: buffer, filename: 'view_once_video.mp4' },
                  { caption, parse_mode: 'HTML' }
                );
              });
            } else if (mediaType === 'audio') {
              await this.bot.telegram.sendVoice(
                telegramId,
                { source: buffer },
                { caption, parse_mode: 'HTML' }
              ).catch(async (e) => {
                debugLog(`sendVoice fallback to document: ${e.message}`);
                await this.bot.telegram.sendDocument(
                  telegramId,
                  { source: buffer, filename: 'view_once_audio.ogg' },
                  { caption, parse_mode: 'HTML' }
                );
              });
            }

            console.log(`[WhatsApp] ✅ تم إرسال وسائط (${mediaType}${isViewOnce ? ' - ذاتية' : ''}) بنجاح إلى تيليجرام للمستخدم ${telegramId}`);
            debugLog(`[User ${telegramId}] Media sent successfully to Telegram`);
          }
        } catch (err) {
          console.error(`[WhatsApp] ❌ فشل سحب أو إرسال الوسائط للمستخدم ${telegramId}:`, err.message);
          debugLog(`[User ${telegramId}] Download/send error: ${err.message} - ${err.stack}`);
        }
      }
    }
  }

  /**
   * Disconnect and terminate a user session
   */
  async disconnectSession(telegramId) {
    telegramId = Number(telegramId);
    const sessionData = this.sessions.get(telegramId);

    if (sessionData && sessionData.sock) {
      try {
        await sessionData.sock.logout().catch(() => {});
        sessionData.sock.end();
      } catch (err) {
        console.error(`[WhatsApp] Logout error for ${telegramId}:`, err);
      }
    }

    whatsappRepo.disconnect(telegramId);
    this.cleanSessionFiles(telegramId);
    this.sessions.delete(telegramId);
    return true;
  }

  /**
   * Clean session files on disk
   */
  cleanSessionFiles(telegramId) {
    const sessionDir = this.getSessionPath(telegramId);
    if (fs.existsSync(sessionDir)) {
      try {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      } catch (err) {
        console.error(`[WhatsApp] Failed to remove session dir for ${telegramId}:`, err);
      }
    }
  }

  /**
   * Reconnect all previously connected accounts on application start
   */
  async resumeAllActiveSessions() {
    const accounts = whatsappRepo.getAllConnected();
    console.log(`[WhatsApp] Resuming ${accounts.length} previously connected sessions...`);

    for (const acc of accounts) {
      const sub = subscriptionService.getStatus(acc.telegram_id);
      if (sub.isActive) {
        try {
          await this.startSession(acc.telegram_id);
          console.log(`[WhatsApp] Resumed session for user ${acc.telegram_id} (${acc.phone_number})`);
        } catch (err) {
          console.error(`[WhatsApp] Failed to resume session for ${acc.telegram_id}:`, err.message);
        }
      } else {
        console.log(`[WhatsApp] Skipping user ${acc.telegram_id} due to expired subscription.`);
      }
    }
  }

  /**
   * Send a broadcast text message with comprehensive Anti-Ban & Anti-Restriction protections:
   * 1. onWhatsApp verification (prevents messaging unregistered numbers)
   * 2. Human typing presence simulation ('composing')
   * 3. Randomized human-like delay (4s to 8s)
   * 4. Batch cooling breaks every 15 messages (25s)
   * 5. Interactive live cancellation support
   */
  async sendBulkMessages(telegramId, recipients, text, onProgress = null, cancelToken = { isCancelled: false }) {
    const session = this.sessions.get(Number(telegramId));
    if (!session || !session.isConnected) {
      throw new Error('حساب واتساب غير متصل حاليًا.');
    }

    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      if (cancelToken.isCancelled) {
        console.log(`[WhatsApp Bulk] Campaign cancelled by user ${telegramId}`);
        break;
      }

      const r = recipients[i];

      try {
        // 1. Anti-Ban: Verify number exists on WhatsApp
        const check = await session.sock.onWhatsApp(r.cleanNumber).catch(() => []);
        const exists = check && check.length > 0 && check[0]?.exists;

        if (!exists) {
          skippedCount++;
          failCount++;
          console.log(`[WhatsApp Bulk] Skipped non-WhatsApp number: ${r.cleanNumber}`);
        } else {
          const targetJid = check[0].jid || r.jid;

          // 2. Anti-Ban: Simulate human presence & typing
          await session.sock.sendPresenceUpdate('composing', targetJid).catch(() => {});
          const typingDelay = Math.floor(Math.random() * 1500) + 1200; // 1.2s to 2.7s
          await new Promise(res => setTimeout(res, typingDelay));
          await session.sock.sendPresenceUpdate('paused', targetJid).catch(() => {});

          // Send message
          await session.sock.sendMessage(targetJid, { text });
          successCount++;
        }
      } catch (err) {
        failCount++;
        console.error(`[WhatsApp Bulk] Failed to send to ${r.cleanNumber}:`, err.message);
      }

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: recipients.length,
          success: successCount,
          failed: failCount,
          skipped: skippedCount,
          isCooling: false,
        });
      }

      // 3. Delay & Cooling Breaks between messages
      if (i < recipients.length - 1 && !cancelToken.isCancelled) {
        // Cooling break every 15 messages (25s)
        if ((i + 1) % 15 === 0) {
          console.log(`[WhatsApp Bulk] Batch cooling break for user ${telegramId} (25s)...`);
          if (onProgress) {
            onProgress({
              current: i + 1,
              total: recipients.length,
              success: successCount,
              failed: failCount,
              skipped: skippedCount,
              isCooling: true,
            });
          }
          await new Promise(res => setTimeout(res, 25000));
        } else {
          // Randomized delay between 4000ms and 8000ms
          const randomDelay = Math.floor(Math.random() * 4000) + 4000;
          await new Promise(res => setTimeout(res, randomDelay));
        }
      }
    }

    return {
      total: recipients.length,
      success: successCount,
      failed: failCount,
      skipped: skippedCount,
      wasCancelled: cancelToken.isCancelled,
    };
  }
}

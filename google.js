import crypto from 'crypto';
import { googleRepo } from './database.js';

export class GoogleContactService {
  constructor(botInstance = null) {
    this.bot = botInstance;
  }

  setBot(botInstance) {
    this.bot = botInstance;
  }

  /**
   * Validate Gmail address and App Password directly against Google CardDAV server
   */
  async validateCredentials(email, appPassword) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = appPassword.replace(/\s+/g, '');

    const authHeader = 'Basic ' + Buffer.from(`${cleanEmail}:${cleanPass}`).toString('base64');
    const url = `https://apidata.googleusercontent.com/carddav/v1/principals/${encodeURIComponent(cleanEmail)}/lists/default/`;

    try {
      const response = await fetch(url, {
        method: 'PROPFIND',
        headers: {
          'Authorization': authHeader,
          'Depth': '0',
          'Content-Type': 'application/xml',
        },
      });

      if (response.status === 200 || response.status === 207) {
        return true;
      }

      if (response.status === 401) {
        throw new Error('بيانات الدخول غير صحيحة. يرجى التأكد من كتابة البريد وكلمة مرور التطبيقات (16 حرفاً) بدقة.');
      }

      // Fallback check with GET
      const getRes = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': authHeader },
      });

      if (getRes.status === 200 || getRes.status === 207) {
        return true;
      }

      if (getRes.status === 401) {
        throw new Error('بيانات الدخول غير صحيحة. يرجى التأكد من كتابة البريد وكلمة مرور التطبيقات (16 حرفاً) بدقة.');
      }

      return true;
    } catch (err) {
      if (err.message.includes('بيانات الدخول غير صحيحة')) throw err;
      throw new Error(`تعذر الاتصال بخوادم Google: ${err.message}`);
    }
  }

  /**
   * Save user credentials after validating
   */
  async saveCredentials(telegramId, email, appPassword) {
    await this.validateCredentials(email, appPassword);
    googleRepo.saveAppPassword(telegramId, email, appPassword);
    return true;
  }

  /**
   * Create a new contact in Google Contacts using CardDAV protocol
   */
  async createContact(telegramId, name, phoneNumber) {
    const creds = googleRepo.get(telegramId);
    if (!creds || !creds.email || !creds.app_password) {
      throw new Error('حساب Google غير مرتبط لهذا المستخدم.');
    }

    const email = creds.email;
    const pass = creds.app_password;
    const authHeader = 'Basic ' + Buffer.from(`${email}:${pass}`).toString('base64');

    const uid = crypto.randomUUID();
    const contactUrl = `https://apidata.googleusercontent.com/carddav/v1/principals/${encodeURIComponent(email)}/lists/default/${uid}.vcf`;

    const cleanPhone = String(phoneNumber).replace(/[\s\-\(\)]/g, '');
    const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : `+${cleanPhone}`;

    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      `UID:${uid}`,
      `FN:${name}`,
      `N:${name};;;;`,
      `TEL;TYPE=CELL;TYPE=PREF:${formattedPhone}`,
      'CATEGORIES:myContacts',
      'END:VCARD'
    ].join('\r\n');

    const response = await fetch(contactUrl, {
      method: 'PUT',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'text/vcard; charset=utf-8',
        'If-None-Match': '*',
      },
      body: vcard,
    });

    if (response.status === 201 || response.status === 200 || response.status === 204) {
      return { success: true, uid };
    }

    if (response.status === 401) {
      throw new Error('فشل التوثيق مع Google. قد تكون كلمة مرور التطبيق ملغاة أو تم تغييرها.');
    }

    const errText = await response.text().catch(() => '');
    throw new Error(`فشل إنشاء جهة الاتصال في Google (كود ${response.status}): ${errText}`);
  }

  /**
   * Unlink Google credentials for user
   */
  async unlinkGoogle(telegramId) {
    return googleRepo.remove(telegramId);
  }
}

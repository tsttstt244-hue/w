import { db, userRepo, appSettingsRepo, auditRepo } from './database.js';

export const subscriptionService = {
  /**
   * Check or start trial for a user upon first access
   */
  ensureTrialStarted(telegramId, username = '', firstName = '') {
    const user = userRepo.createOrUpdate(telegramId, username, firstName);

    // If user hasn't used trial yet, start it
    if (!user.has_used_trial) {
      const trialHours = appSettingsRepo.getTrialHours();
      const now = new Date();
      const trialEnds = new Date(now.getTime() + trialHours * 60 * 60 * 1000);

      db.prepare(`
        UPDATE users
        SET has_used_trial = 1,
            trial_started_at = ?,
            trial_ends_at = ?
        WHERE telegram_id = ?
      `).run(now.toISOString(), trialEnds.toISOString(), telegramId);

      return {
        isNewTrial: true,
        trialHours,
        trialEnds,
      };
    }

    return {
      isNewTrial: false,
    };
  },

  /**
   * Get subscription status for a user
   */
  getStatus(telegramId) {
    const user = userRepo.get(telegramId);
    if (!user) {
      return {
        isActive: false,
        type: 'none',
        endsAt: null,
        remainingText: 'لا يوجد اشتراك',
        isExpired: true,
      };
    }

    const now = new Date();
    const paidEnd = user.subscription_ends_at ? new Date(user.subscription_ends_at) : null;
    const trialEnd = user.trial_ends_at ? new Date(user.trial_ends_at) : null;

    // Check paid subscription first
    if (paidEnd && paidEnd > now) {
      const diffMs = paidEnd.getTime() - now.getTime();
      return {
        isActive: true,
        type: 'paid',
        endsAt: paidEnd,
        remainingText: this.formatRemaining(diffMs),
        isExpired: false,
      };
    }

    // Check free trial
    if (trialEnd && trialEnd > now) {
      const diffMs = trialEnd.getTime() - now.getTime();
      return {
        isActive: true,
        type: 'trial',
        endsAt: trialEnd,
        remainingText: `تجربة مجانية متبقي: ${this.formatRemaining(diffMs)}`,
        isExpired: false,
      };
    }

    // Otherwise expired
    const lastEnd = paidEnd || trialEnd;
    return {
      isActive: false,
      type: 'expired',
      endsAt: lastEnd,
      remainingText: 'منتهي الصلاحية',
      isExpired: true,
    };
  },

  /**
   * Format milliseconds into Arabic readable time string
   */
  formatRemaining(ms) {
    if (ms <= 0) return 'منتهي';
    const totalMinutes = Math.floor(ms / (1000 * 60));
    const days = Math.floor(totalMinutes / (60 * 24));
    const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
    const minutes = totalMinutes % 60;

    const parts = [];
    if (days > 0) parts.push(`${days} يوم`);
    if (hours > 0) parts.push(`${hours} ساعة`);
    if (minutes > 0 && days === 0) parts.push(`${minutes} دقيقة`);

    return parts.length > 0 ? parts.join(' و ') : 'أقل من دقيقة';
  },

  /**
   * Add or extend subscription for a specific user (in days or hours)
   */
  addSubscription(adminId, telegramId, durationDays) {
    const user = userRepo.get(telegramId);
    if (!user) {
      throw new Error(`المستخدم ذو المعرف ${telegramId} غير موجود في قاعدة البيانات.`);
    }

    const now = new Date();
    let currentEnd = user.subscription_ends_at ? new Date(user.subscription_ends_at) : null;
    
    // If current subscription is active, extend from currentEnd; otherwise start from now
    const baseTime = (currentEnd && currentEnd > now) ? currentEnd.getTime() : now.getTime();
    const newEnd = new Date(baseTime + durationDays * 24 * 60 * 60 * 1000);

    db.prepare(`
      UPDATE users
      SET subscription_ends_at = ?
      WHERE telegram_id = ?
    `).run(newEnd.toISOString(), telegramId);

    auditRepo.log(adminId, 'ADD_SUBSCRIPTION', telegramId, {
      durationDays,
      newEndsAt: newEnd.toISOString()
    });

    return newEnd;
  },

  /**
   * Revoke subscription for a user
   */
  revokeSubscription(adminId, telegramId) {
    const user = userRepo.get(telegramId);
    if (!user) {
      throw new Error(`المستخدم ${telegramId} غير موجود.`);
    }

    const past = new Date(0).toISOString();
    db.prepare(`
      UPDATE users
      SET subscription_ends_at = ?,
          trial_ends_at = ?
      WHERE telegram_id = ?
    `).run(past, past, telegramId);

    auditRepo.log(adminId, 'REVOKE_SUBSCRIPTION', telegramId);
    return true;
  },

  /**
   * Gift free time to ALL users
   */
  giftTimeToAll(adminId, durationHours) {
    const users = userRepo.getAll();
    const now = new Date();
    const addMs = durationHours * 60 * 60 * 1000;
    let updatedCount = 0;

    const stmt = db.prepare(`
      UPDATE users
      SET subscription_ends_at = ?
      WHERE telegram_id = ?
    `);

    const updateMany = db.transaction((userList) => {
      for (const u of userList) {
        let baseTime = now.getTime();
        if (u.subscription_ends_at) {
          const current = new Date(u.subscription_ends_at).getTime();
          if (current > baseTime) baseTime = current;
        } else if (u.trial_ends_at) {
          const current = new Date(u.trial_ends_at).getTime();
          if (current > baseTime) baseTime = current;
        }

        const newEnd = new Date(baseTime + addMs).toISOString();
        stmt.run(newEnd, u.telegram_id);
        updatedCount++;
      }
    });

    updateMany(users);

    auditRepo.log(adminId, 'GIFT_TIME_ALL', null, {
      durationHours,
      affectedUsers: updatedCount
    });

    return { updatedCount };
  },

  /**
   * Get all subscribers with their remaining time
   */
  getAllSubscribers() {
    const users = userRepo.getAll();
    return users.map(u => ({
      telegram_id: u.telegram_id,
      username: u.username,
      first_name: u.first_name,
      ...this.getStatus(u.telegram_id)
    }));
  }
};

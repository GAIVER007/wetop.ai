/**
 * Контакты поддержки WETOP для «Помощи» и меню профиля (SUP1, plans/support-whatsnew-2026-10-18.md).
 *
 * Контакты не придумываются: только из окружения сервера, их вписывает владелец (Q-COMP-2). Нет ни одного
 * годного контакта, значит `null`, и блока нет вовсе, как у ИИ-помощника без `ASSISTANT_URL`.
 */
export interface SupportContacts {
  whatsapp?: string;
  telegram?: string;
  email?: string;
  hours?: string;
}

type Env = Record<string, string | undefined>;

export function supportContacts(env: Env, branch?: string | null): SupportContacts | null {
  const c: SupportContacts = {};
  const phone = (env.SUPPORT_WHATSAPP ?? '').replace(/\D/g, '');
  if (phone.length >= 10) {
    const text = `Здравствуйте! Пишу из WETOP${branch ? `, филиал «${branch}»` : ''}. Вопрос: `;
    c.whatsapp = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
  }
  const tg = (env.SUPPORT_TELEGRAM ?? '').trim().replace(/^@/, '');
  if (/^[A-Za-z0-9_]{5,32}$/.test(tg)) c.telegram = `https://t.me/${tg}`;
  const email = (env.SUPPORT_EMAIL ?? '').trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) c.email = email;
  if (!c.whatsapp && !c.telegram && !c.email) return null;
  const hours = (env.SUPPORT_HOURS ?? '').trim();
  if (hours) c.hours = hours;
  return c;
}

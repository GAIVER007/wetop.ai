import { supportContacts } from '../../lib/support-contacts';
import { translator, type Translate } from '../../i18n';

/**
 * «Связаться с поддержкой» внизу «Помощи» у трёх направлений (SUP1). Контакты из окружения сервера: в браузер
 * уходят только готовые ссылки. Нет контактов, нет и блока.
 */
export function SupportBlock({ branch, t = translator('ru') }: { branch?: string | null; t?: Translate }) {
  const c = supportContacts(process.env, branch);
  if (!c) return null;
  return (
    <section className="panel" id="support" aria-labelledby="support-title">
      <h2 id="support-title">{t('Связаться с поддержкой')}</h2>
      <p>{t('Отвечает человек из команды WETOP.')}{c.hours ? ` ${c.hours}.` : ''}</p>
      <div className="row">
        {c.whatsapp && (
          <a className="btn btn--primary" href={c.whatsapp} target="_blank" rel="noreferrer">
            {t('Написать в WhatsApp')}
          </a>
        )}
        {c.telegram && (
          <a className="btn btn--secondary" href={c.telegram} target="_blank" rel="noreferrer">
            {t('Написать в Telegram')}
          </a>
        )}
        {c.email && (
          <a className="btn btn--secondary" href={`mailto:${c.email}`}>
            {c.email}
          </a>
        )}
      </div>
    </section>
  );
}

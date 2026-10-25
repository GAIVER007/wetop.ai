import Link from 'next/link';
import { supportContacts } from '../../../../lib/support-contacts';
import { serverT } from '../../../../i18n/server';

/**
 * Конструктор не подключён у филиала без сайта (аудит 21.10.2026 п. 4): вместо формы с неактивными кнопками одна
 * карточка с объяснением и действием «Попросить подключить». Ссылка ведёт в WhatsApp поддержки, если он настроен,
 * иначе в «Помощь → Связаться с поддержкой».
 */
export async function BuilderOffCard({ locationName, expired = false }: { locationName: string; expired?: boolean }) {
  const t = await serverT();
  const contacts = supportContacts(process.env, locationName);
  const href = contacts?.whatsapp ?? '/help#support';
  return (
    <section className="panel site-off" data-testid="ed-license-off" aria-labelledby="site-off-title">
      <h2 id="site-off-title" className="panel__title">
        {expired ? t('Срок лицензии вышел.') : t('Конструктор сайта не активен для этого филиала.')}
      </h2>
      <p>
        {t(
          'Сайт для «{name}» можно будет создать здесь, когда конструктор подключат. Подключает его команда WETOP: напишите нам, и мы всё сделаем.',
          { name: locationName },
        )}
      </p>
      <div>
        {href.startsWith('/') ? (
          <Link className="btn" href={href} data-testid="site-off-ask">
            {t('Попросить подключить')}
          </Link>
        ) : (
          <a className="btn" href={href} target="_blank" rel="noreferrer" data-testid="site-off-ask">
            {t('Попросить подключить')}
          </a>
        )}
      </div>
    </section>
  );
}

import Link from 'next/link';
import { supportContacts } from '../../../../lib/support-contacts';

/**
 * Конструктор не подключён у филиала без сайта (аудит 21.10.2026 п. 4): вместо формы с неактивными кнопками одна
 * карточка с объяснением и действием «Попросить подключить». Ссылка ведёт в WhatsApp поддержки, если он настроен,
 * иначе в «Помощь → Связаться с поддержкой».
 */
export function BuilderOffCard({ locationName, expired = false }: { locationName: string; expired?: boolean }) {
  const contacts = supportContacts(process.env, locationName);
  const href = contacts?.whatsapp ?? '/help#support';
  return (
    <section className="panel site-off" data-testid="ed-license-off" aria-labelledby="site-off-title">
      <h2 id="site-off-title" className="panel__title">
        {expired ? 'Срок лицензии вышел.' : 'Конструктор сайта не активен для этого филиала.'}
      </h2>
      <p>
        Сайт для «{locationName}» можно будет создать здесь, когда конструктор подключат. Подключает его команда WETOP:
        напишите нам, и мы всё сделаем.
      </p>
      <div>
        {href.startsWith('/') ? (
          <Link className="btn" href={href} data-testid="site-off-ask">
            Попросить подключить
          </Link>
        ) : (
          <a className="btn" href={href} target="_blank" rel="noreferrer" data-testid="site-off-ask">
            Попросить подключить
          </a>
        )}
      </div>
    </section>
  );
}

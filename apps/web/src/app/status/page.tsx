import type { Metadata } from 'next';
import { statusApi, type PublicServiceStatus } from '../../lib/api';
import { msg } from '../../i18n';
import { serverT } from '../../i18n/server';
import './status.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await serverT();
  return {
    title: t('Состояние WETOP'),
    description: t('Работает ли WETOP сейчас: рабочее место, хранение данных, каналы продаж и бронирование с сайта.'),
  };
}
export const dynamic = 'force-dynamic';

const STATE: Record<PublicServiceStatus['overall'], { word: string; tone: string }> = {
  ok: { word: msg('Работает'), tone: 'ok' },
  degraded: { word: msg('С перебоями'), tone: 'warn' },
  down: { word: msg('Недоступно'), tone: 'danger' },
};
const OVERALL: Record<PublicServiceStatus['overall'], string> = {
  ok: msg('Все части WETOP работают.'),
  degraded: msg('Часть WETOP работает с перебоями. Мы уже знаем и исправляем.'),
  down: msg('WETOP сейчас недоступен. Мы уже знаем и исправляем.'),
};

/**
 * Страница статуса сервиса (H14 плана развития, ADR-144): без входа, потому что смотрят её, когда войти не выходит.
 * Только общие слова по четырём частям; подробности неисправностей видит владелец в «Неисправностях».
 */
export default async function StatusPage() {
  const t = await serverT();
  const status = await statusApi.public().catch(() => null);
  const overall = status?.overall ?? 'down';
  const checked = status
    ? new Intl.DateTimeFormat('ru-RU', {
        // tz-allow: статус всей установки, а не объекта; объекта у анонимной страницы нет, время подписано «по Алматы»
        timeZone: 'Asia/Almaty',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(status.checkedAt))
    : null;
  return (
    <main className="status-page" id="main-content">
      <h1>{t('Состояние WETOP')}</h1>
      <section
        className={`status-page__overall status-page__overall--${STATE[overall].tone}`}
        data-testid="status-overall"
        data-state={overall}
        role="status"
      >
        <b>{t(STATE[overall].word)}</b>
        <span>
          {status ? t(OVERALL[overall]) : t('Не удалось получить состояние: сервер не отвечает.')}
        </span>
      </section>
      {status && (
        <ul className="status-page__list" aria-label={t('Части сервиса')}>
          {status.components.map((c) => (
            <li key={c.key} data-testid={`status-${c.key}`} data-state={c.state}>
              <span>{t(c.label)}</span>
              <span className={`status-page__state status-page__state--${STATE[c.state].tone}`}>
                {t(STATE[c.state].word)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="status-page__note">
        {checked ? `${t('Проверено {at} по времени Алматы.', { at: checked })} ` : ''}
        {t('Обновите страницу, чтобы проверить снова. Вопросы: поддержка WETOP в чате на wetop.ai.')}
      </p>
    </main>
  );
}

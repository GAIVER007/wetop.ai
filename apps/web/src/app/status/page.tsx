import type { Metadata } from 'next';
import { statusApi, type PublicServiceStatus } from '../../lib/api';
import './status.css';

export const metadata: Metadata = {
  title: 'Состояние WETOP',
  description:
    'Работает ли WETOP сейчас: рабочее место, хранение данных, каналы продаж и бронирование с сайта.',
};
export const dynamic = 'force-dynamic';

const STATE: Record<PublicServiceStatus['overall'], { word: string; tone: string }> = {
  ok: { word: 'Работает', tone: 'ok' },
  degraded: { word: 'С перебоями', tone: 'warn' },
  down: { word: 'Недоступно', tone: 'danger' },
};
const OVERALL: Record<PublicServiceStatus['overall'], string> = {
  ok: 'Все части WETOP работают.',
  degraded: 'Часть WETOP работает с перебоями. Мы уже знаем и исправляем.',
  down: 'WETOP сейчас недоступен. Мы уже знаем и исправляем.',
};

/**
 * Страница статуса сервиса (H14 плана развития, ADR-143): без входа, потому что смотрят её, когда войти не выходит.
 * Только общие слова по четырём частям; подробности неисправностей видит владелец в «Неисправностях».
 */
export default async function StatusPage() {
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
      <h1>Состояние WETOP</h1>
      <section
        className={`status-page__overall status-page__overall--${STATE[overall].tone}`}
        data-testid="status-overall"
        data-state={overall}
        role="status"
      >
        <b>{STATE[overall].word}</b>
        <span>
          {status ? OVERALL[overall] : 'Не удалось получить состояние: сервер не отвечает.'}
        </span>
      </section>
      {status && (
        <ul className="status-page__list" aria-label="Части сервиса">
          {status.components.map((c) => (
            <li key={c.key} data-testid={`status-${c.key}`} data-state={c.state}>
              <span>{c.label}</span>
              <span className={`status-page__state status-page__state--${STATE[c.state].tone}`}>
                {STATE[c.state].word}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="status-page__note">
        {checked ? `Проверено ${checked} по времени Алматы. ` : ''}Обновите страницу, чтобы
        проверить снова. Вопросы: поддержка WETOP в чате на wetop.ai.
      </p>
    </main>
  );
}

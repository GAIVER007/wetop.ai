import { msg } from '../i18n';
import { Labelled, T } from '../i18n/locale-provider';

// Синхронно: заглушка показывается сразу. Язык берут клиентские T и Labelled из LocaleProvider макета,
// без запроса /auth/me (async-заглушка ждала его и ломала потоковую отрисовку «Главной»).
export default function Loading() {
  return (
    <Labelled as="main" id="main-content" className="page" aria-busy="true" label={msg('Загрузка страницы')}>
      <div className="skeleton skeleton-title" />
      <div className="stats">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="panel">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="skeleton skeleton-row" />
        ))}
      </div>
      <span className="sr-only" role="status">
        <T text={msg('Загружаем данные…')} />
      </span>
    </Labelled>
  );
}

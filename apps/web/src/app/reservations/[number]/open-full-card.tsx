'use client';

/**
 * «Открыть бронь» из быстрого просмотра (ADR-106, R3; ТЗ «Брони v2» §21): полная страница вместо панели.
 * Запись истории заменяется: «Назад» с полной страницы ведёт в тот же список, а не в пустую панель.
 * Щелчок с модификатором — новая вкладка, как у обычной ссылки.
 */
export function OpenFullCard({ href }: { href: string }) {
  return (
    <a
      className="btn btn--secondary btn--sm"
      href={href}
      data-testid="open-full-card"
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        window.location.replace(href);
      }}
    >
      Открыть бронь
    </a>
  );
}

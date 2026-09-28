'use client';

/**
 * «Открыть бронь» из быстрого просмотра (ADR-106, R3; ТЗ «Брони v2» §21): полная страница вместо панели.
 *
 * Панель — запись истории внутри документа списка. Сначала шаг назад в том же документе (панель
 * закрывается, остаётся список), потом обычный переход: в истории «список → бронь», и «Назад» ведёт в
 * список. Перезагрузка или замена записи панели так не работают: браузер при возврате поднимал прежний
 * документ вместе с адресом панели и снова открывал бронь (найдено полным UI-набором 28.09).
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
        let gone = false;
        const go = () => {
          if (gone) return;
          gone = true;
          window.location.assign(href);
        };
        window.addEventListener('popstate', go, { once: true });
        // панель открыта не поверх списка (адрес набран вручную) — шага назад нет, переходим сразу
        window.setTimeout(go, 800);
        window.history.back();
      }}
    >
      Открыть бронь
    </a>
  );
}

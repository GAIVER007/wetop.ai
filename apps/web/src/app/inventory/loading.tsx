import { LoadingState, Skeleton } from '../../components/ui';

/**
 * Ожидание фонда — без собственного `<Page>`: у фонда параллельный слот `@drawer` (ADR-108), и fallback
 * с своим `main#main-content` + `h1` сосуществовал с настоящей страницей — на `/inventory` вставали два
 * одинаковых `h1` «Номерной фонд», и строгие локаторы навигации падали (разбор 02.10, логи
 * `…12-22-37Z-e2e-8ffd`, `…12-49-03Z-e2e-6166`). Каркас с заголовком даёт сама страница; о загрузке
 * читалке говорит `LoadingState`.
 */
export default function Loading() {
  return (
    <div className="page" data-testid="inventory-loading">
      <LoadingState label="Загружаем номерной фонд…">
        <Skeleton variant="stat" />
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </LoadingState>
    </div>
  );
}

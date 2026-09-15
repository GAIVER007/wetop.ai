/**
 * Скелетон шахматки (DESIGN.md §8 «загрузка», макет 03-2): повторяет форму экрана — заголовок, панель
 * инструментов, шапка дат и строки категорий с полосами, — чтобы экран не прыгал; без крутилки.
 */
const DAYS = [1, 2, 3, 4, 5, 6, 7];
const ROWS = [3, 6, 2];

export default function Loading() {
  return (
    <main id="main-content" className="page page--full" aria-busy="true" aria-label="Загружаем шахматку">
      <div className="skeleton skeleton-title" />
      <div className="board-skeleton__toolbar">
        {[250, 290, 230, 140, 150].map((w) => (
          <div key={w} className="skeleton board-skeleton__control" style={{ width: w }} />
        ))}
      </div>
      <div className="board-wrap board-skeleton">
        <div className="board-skeleton__head">
          <div className="skeleton board-skeleton__label" />
          {DAYS.map((d) => (
            <div key={d} className="skeleton board-skeleton__day" />
          ))}
        </div>
        {ROWS.map((n, g) => (
          <div key={g}>
            <div className="board-skeleton__group">
              <div className="skeleton board-skeleton__label" />
            </div>
            {Array.from({ length: n }, (_, r) => (
              <div key={r} className="board-skeleton__row">
                <div className="skeleton board-skeleton__unit" />
                {DAYS.map((d, i) => (
                  <div key={d} className="board-skeleton__cell">
                    {(r + i) % 3 === 0 && <div className="skeleton board-skeleton__stay" />}
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only" role="status">
        Загружаем шахматку…
      </span>
    </main>
  );
}

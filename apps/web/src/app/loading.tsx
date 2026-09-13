export default function Loading() {
  return (
    <main id="main-content" className="page" aria-busy="true" aria-label="Загрузка страницы">
      <div className="skeleton skeleton-title" />
      <div className="stats">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="panel">
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="skeleton skeleton-row" />
        ))}
      </div>
      <span className="sr-only" role="status">
        Загружаем данные…
      </span>
    </main>
  );
}

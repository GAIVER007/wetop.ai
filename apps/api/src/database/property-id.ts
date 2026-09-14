/**
 * id объекта — одним запросом на экземпляр репозитория (волна 4, plans/wetop-domain-2026-09-14.md §7.4).
 * Объект создаёт импорт один раз, и id за жизнь процесса не меняется, а поиск по имени на каждый запрос стоил
 * ещё одно обращение к базе в Сингапуре (~0,35 с) к каждой странице. Одновременные вызовы ждут один запрос;
 * сбой не запоминается — следующий вызов ищет заново.
 */
export function memoPropertyId(load: () => Promise<{ id: string }>): () => Promise<string> {
  let cached: Promise<string> | null = null;
  return () => {
    cached ??= load()
      .then((p) => p.id)
      .catch((e: unknown) => {
        cached = null;
        throw e;
      });
    return cached;
  };
}

/**
 * Ошибка API и её `digest` — без серверных зависимостей. Клиентские компоненты (экран ошибки, граница
 * ошибок выезжающей карточки) берут `apiErrorStatus` отсюда, а не из `api.ts`: тот тянет `session.ts`
 * с `next/headers`, и в клиентском бандле сборка падает (слияние PR #10 и PR #11, 16.09.2026).
 */
export class ApiError extends Error {
  /**
   * Код статуса в `digest`: Next отдаёт границе ошибок клиента только digest (текст в production
   * вырезается), а уже имеющийся digest не переписывает — так экран ошибки отличает 400/404 от 503.
   */
  readonly digest: string;
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.digest = apiErrorDigest(status);
  }
}
export const apiErrorDigest = (status: number) => `API_${status}`;
/** Код статуса из digest ошибки на клиенте; не наш digest — undefined */
export function apiErrorStatus(digest: string | undefined): number | undefined {
  const m = /^API_(\d{3})$/.exec(digest ?? '');
  return m ? Number(m[1]) : undefined;
}

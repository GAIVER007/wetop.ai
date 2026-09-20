/**
 * Отказ запроса → пропсы `LoadError`: код статуса от `ApiError`, текст — как есть. Лежит отдельно от
 * клиентского компонента: функцию зовёт серверная страница, а из модуля `'use client'` сервер её звать не может.
 */
export function loadErrorProps(e: unknown): { status: number | undefined; message: string } {
  const status =
    typeof e === 'object' && e !== null && 'status' in e && typeof e.status === 'number'
      ? e.status
      : undefined;
  return { status, message: e instanceof Error ? e.message : String(e) };
}

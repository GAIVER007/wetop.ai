import { VerifyPanel } from './verify-panel';

/**
 * Переход по ссылке из письма (ADR-060). Подтверждение делает кнопка, а не открытие страницы:
 * почтовые службы ходят по ссылкам сами, проверяя их на вредоносность, и «подтверждение по
 * открытию» срабатывало бы до того, как письмо увидел человек.
 */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.token;
  const token = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  return <VerifyPanel token={token} />;
}

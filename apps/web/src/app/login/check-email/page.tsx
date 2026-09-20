import { CheckEmailPanel } from './check-email-panel';

/**
 * «Проверьте почту» — куда попадает человек сразу после регистрации (ADR-060).
 * Адрес в строке нужен кнопке «выслать заново»: другого места, где его взять, здесь нет —
 * сессии ещё не существует.
 */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.email;
  const email = (Array.isArray(raw) ? raw[0] : raw) ?? '';
  // sent=0 — письма не было: отправка писем не настроена, и «проверьте почту» стало бы неправдой
  const sent = (Array.isArray(params.sent) ? params.sent[0] : params.sent) !== '0';
  return <CheckEmailPanel email={email} sent={sent} />;
}

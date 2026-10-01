import { redirect } from 'next/navigation';
import { publicAuthUrl } from '../../lib/auth-entry';
import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';

/** Совместимость старых ссылок. Callback-пути /login/* остаются самостоятельными. */
export default async function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const q = normalizeSearchParams(await searchParams);
  const destination = new URL(publicAuthUrl(q.mode === 'register' ? 'register' : 'login', q.next));
  if (q.email) destination.searchParams.set('email', q.email.slice(0, 254));
  if (q.password === 'set') destination.searchParams.set('password', 'set');
  redirect(destination.toString());
}

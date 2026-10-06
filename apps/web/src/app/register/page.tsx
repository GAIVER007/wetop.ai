import { redirect } from 'next/navigation';
import { parseBusinessVertical } from '@pms/domain';
import { publicAuthUrl } from '../../lib/auth-entry';

export default async function RegisterPage({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<{ vertical?: string }>;
} = {}) {
  const params = await searchParams;
  const url = new URL(publicAuthUrl('register'));
  const vertical = parseBusinessVertical(params.vertical);
  if (vertical) url.searchParams.set('vertical', vertical);
  redirect(url.toString());
}

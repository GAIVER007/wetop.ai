import { redirect } from 'next/navigation';
import { publicAuthUrl } from '../../lib/auth-entry';

export default async function RegisterPage() {
  redirect(publicAuthUrl('register'));
}

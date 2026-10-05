import { redirect } from 'next/navigation';
import { deskShell } from '../lib/desk-shell';
export default async function Home() {
  const shell = await deskShell();
  redirect(shell.vertical === 'BEAUTY' ? '/calendar' : '/today');
}

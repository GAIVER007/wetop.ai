import { landingForVertical } from '../lib/vertical-landing';
import { redirect } from 'next/navigation';
import { deskShell } from '../lib/desk-shell';
export default async function Home() {
  const shell = await deskShell();
  redirect(landingForVertical(shell.vertical));
}

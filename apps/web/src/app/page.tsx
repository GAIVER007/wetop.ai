import { startScreen } from '../lib/vertical-landing';
import { redirect } from 'next/navigation';
import { deskShell } from '../lib/desk-shell';
/** Открытие сайта или приложения: стартовый экран по роли (владелец 27.10.2026, `startScreen`) */
export default async function Home() {
  const shell = await deskShell();
  redirect(startScreen(shell.vertical, shell.access.role));
}

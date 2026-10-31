import { startScreen } from '../lib/vertical-landing';
import { redirect } from 'next/navigation';
import { currentMe, deskShell } from '../lib/desk-shell';
/**
 * Открытие сайта или приложения: стартовый экран по роли (владелец 27.10.2026, `startScreen`); учётка компании с
 * отметкой «Кабинет WETOP по умолчанию» (владелец 30.10.2026, миграция 171) открывает кабинет.
 */
export default async function Home() {
  const [shell, me] = await Promise.all([deskShell(), currentMe().catch(() => null)]);
  if (me?.user?.partner === true) redirect('/partner');
  const cabinetHome = me?.user?.platformAdmin === true && me.user.cabinetHome === true;
  redirect(startScreen(shell.vertical, shell.access.role, { cabinetHome }));
}

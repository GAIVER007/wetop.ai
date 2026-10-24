import { ApiError, staffTelegramApi, type StaffTelegramStatus } from '../../lib/api';
import { deskShellOf } from '../../lib/desk-person';
import { currentMe } from '../../lib/desk-shell';
import { ProfileView } from './profile-view';

/** Кто вошёл и что открыто организации — с сервера; отказ API — как «никто не вошёл», тема работает и так */
export default async function ProfilePage() {
  const me = await currentMe().catch((error: unknown) => {
    if (error instanceof ApiError) return { user: null };
    throw error;
  });
  // STAFF-TG: своё подключение Telegram; сбой API не роняет профиль, вкладка покажет «видно после входа»
  const telegram: StaffTelegramStatus | null = me.user ? await staffTelegramApi.status().catch(() => null) : null;
  return (
    <ProfileView
      person={deskShellOf(me).person}
      seller={me.user ? (me.access?.aiSeller ?? null) : null}
      hospitality={deskShellOf(me).vertical === 'HOSPITALITY'}
      telegram={telegram}
    />
  );
}

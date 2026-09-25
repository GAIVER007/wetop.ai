import { ApiError } from '../../lib/api';
import { deskShellOf } from '../../lib/desk-person';
import { currentMe } from '../../lib/desk-shell';
import { ProfileView } from './profile-view';

/** Кто вошёл и что открыто организации — с сервера; отказ API — как «никто не вошёл», тема работает и так */
export default async function ProfilePage() {
  const me = await currentMe().catch((error: unknown) => {
    if (error instanceof ApiError) return { user: null };
    throw error;
  });
  return (
    <ProfileView
      person={deskShellOf(me).person}
      seller={me.user ? (me.access?.aiSeller ?? null) : null}
    />
  );
}

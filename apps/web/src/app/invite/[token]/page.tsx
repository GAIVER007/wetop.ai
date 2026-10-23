import Link from 'next/link';
import { INVITE_INVALID_MESSAGE } from '@pms/domain';
import { authApi } from '../../../lib/api';
import { clientInfo } from '../../../lib/session';
import { displayDate } from '../../../lib/display-date';
import { decodeInviteToken } from '../../../lib/invite-token';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { AcceptForm } from './accept-form';
import { AuthShell } from '../../../components/auth-shell';
import { unstable_rethrow } from 'next/navigation';

/**
 * Страница по ссылке из письма-приглашения (срез 13, этап 7). Ключ живёт только в адресе и в
 * письме; страница показывает, кто зовёт и кого, и одной кнопкой принимает. Дальше — установка
 * пароля или вход с существующим паролем. Мёртвая ссылка — один текст, без подробностей.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // Битое %-кодирование в адресе — обычная мёртвая ссылка, а не 500
  const rawToken = decodeInviteToken(token);
  const loaded = rawToken
    ? await authApi.inviteByToken(rawToken, await clientInfo()).then(
        (r) => ({ ok: true as const, r }),
        (e: unknown) => {
          unstable_rethrow(e);
          return { ok: false as const, e };
        },
      )
    : { ok: true as const, r: null };
  const preview = loaded.ok ? loaded.r : null;
  return (
    <AuthShell>
      <div data-testid="invite-page">
        {!loaded.ok ? (
          <>
            <h1>Приглашение не прочиталось</h1>
            <LoadError testId="invite-load-error" {...loadErrorProps(loaded.e)} />
          </>
        ) : preview ? (
          <>
            <h1>Вас приглашают</h1>
            <p>
              в организацию <b>{preview.organizationName}</b> в WETOP как <b>{preview.email}</b>.
              <br />
              <span className="muted">
                Ссылка действует до{' '}
                <time dateTime={preview.expiresAt}>
                  {displayDate(preview.expiresAt.slice(0, 10))}
                </time>
                {/* короткая дата уже кончается точкой («28 окт.»): вторая не нужна (аудит 22.10.2026, P2-1) */}
                {displayDate(preview.expiresAt.slice(0, 10)).endsWith('.') ? '' : '.'} После принятия вы
                сможете войти по паролю.
              </span>
            </p>
            <AcceptForm token={rawToken ?? ''} />
          </>
        ) : (
          <>
            <h1>Приглашение не открылось</h1>
            <p role="alert">{INVITE_INVALID_MESSAGE}</p>
            <p className="muted">
              Попросите новую ссылку у того, кто вас приглашал, или{' '}
              <Link href="/login">войдите по паролю</Link>, если уже состоите в организации.
            </p>
          </>
        )}
      </div>
    </AuthShell>
  );
}

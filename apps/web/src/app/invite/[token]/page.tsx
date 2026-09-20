import Link from 'next/link';
import { INVITE_INVALID_MESSAGE } from '@pms/domain';
import { authApi } from '../../../lib/api';
import { clientInfo } from '../../../lib/session';
import { displayDate } from '../../../lib/display-date';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { AcceptForm } from './accept-form';

/**
 * Страница по ссылке из письма-приглашения (срез 13, этап 7). Ключ живёт только в адресе и в
 * письме; страница показывает, кто зовёт и кого, и одной кнопкой принимает. Дальше — обычный
 * вход по коду: он уже выслан на эту почту. Мёртвая ссылка — один текст, без подробностей.
 * D4 (план владельца 19.09): отказ самого API (не 404) — `LoadError` с повтором, а не общий экран: человек
 * пришёл по ссылке из письма и должен понять, что ссылка жива, а сервис сейчас не ответил.
 */
export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rawToken = decodeURIComponent(token);
  const loaded = await authApi.inviteByToken(rawToken, await clientInfo()).then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => ({ ok: false as const, e }),
  );
  const preview = loaded.ok ? loaded.r : null;
  return (
    <main className="login-page login-page--single" id="main-content">
      <section className="login-form-panel">
        <div className="login-form" data-testid="invite-page">
          {!loaded.ok ? (
            <>
              <h2>Приглашение не прочиталось</h2>
              <LoadError testId="invite-load-error" {...loadErrorProps(loaded.e)} />
            </>
          ) : preview ? (
            <>
              <h2>Вас приглашают</h2>
              <p>
                в организацию <b>{preview.organizationName}</b> в WETOP как <b>{preview.email}</b>.
                <br />
                <span className="muted">
                  Ссылка действует до{' '}
                  <time dateTime={preview.expiresAt}>
                    {displayDate(preview.expiresAt.slice(0, 10))}
                  </time>
                  . После принятия на эту почту придёт код для входа.
                </span>
              </p>
              <AcceptForm token={rawToken} />
            </>
          ) : (
            <>
              <h2>Приглашение не открылось</h2>
              <p role="alert">{INVITE_INVALID_MESSAGE}</p>
              <p className="muted">
                Попросите новую ссылку у того, кто вас приглашал, или{' '}
                <Link href="/login">войдите по коду</Link>, если уже состоите в организации.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { AuthShell } from '../../../../components/auth-shell';
import { partnerApi } from '../../../../lib/api';
import { decodeInviteToken } from '../../../../lib/invite-token';
import { serverT } from '../../../../i18n/server';
import { JoinForm } from './join-form';

/**
 * Приглашение партнёра WETOP (DATA_MODEL §63.3): ссылка из «Партнёров WETOP». Партнёр сам вводит имя, почту и пароль,
 * подтверждает почту и дальше входит обычным «Войти». Мёртвая ссылка: один текст, без подробностей.
 */
export default async function PartnerJoinPage({ params }: { params: Promise<{ token: string }> }) {
  const t = await serverT();
  const token = decodeInviteToken((await params).token) ?? '';
  const preview = token
    ? await partnerApi.invite(token).catch((e: unknown) => {
        unstable_rethrow(e);
        return null;
      })
    : null;
  return (
    <AuthShell>
      <div data-testid="partner-join-page">
        {preview ? (
          <>
            <h1>{t('Кабинет партнёра WETOP')}</h1>
            <p>
              {t('Здравствуйте, {name}. Укажите имя, почту и пароль: мы пришлём письмо для подтверждения почты.', { name: preview.partnerName })}
            </p>
            <JoinForm token={token} email={preview.email} />
          </>
        ) : (
          <>
            <h1>{t('Приглашение не открылось')}</h1>
            <p role="alert">{t('Приглашение недействительно или уже использовано. Попросите новое у WETOP.')}</p>
            <p className="muted">
              <Link href="/login">{t('Войти')}</Link>
            </p>
          </>
        )}
      </div>
    </AuthShell>
  );
}

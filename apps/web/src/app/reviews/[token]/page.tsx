import type { Metadata } from 'next';
import { unstable_rethrow } from 'next/navigation';
import { Alert } from '../../../components/ui';
import { decodeInviteToken } from '../../../lib/invite-token';
import { reviewApi } from './review-api';
import { BeautyReviewForm } from './review-form';
import { serverT } from '../../../i18n/server';
import './reviews.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = await serverT();
  return { title: t('Отзыв о визите'), robots: { index: false, follow: false }, referrer: 'no-referrer' };
}

export default async function BeautyReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await serverT();
  const raw = decodeInviteToken(token);
  const loaded = raw
    ? await reviewApi.preview(raw).then(
        (preview) => ({ ok: true as const, preview }),
        (error: unknown) => {
          unstable_rethrow(error);
          return { ok: false as const };
        },
      )
    : { ok: true as const, preview: null };

  return (
    <main className="login-page login-page--single beauty-review-page" id="main-content">
      <section className="login-form-panel">
        <div className="login-form beauty-review-card" data-testid="beauty-review-page">
          <h1>{t('Оцените визит')}</h1>
          {!loaded.ok ? (
            <Alert>{t('Страница временно недоступна. Повторите позже.')}</Alert>
          ) : !loaded.preview ? (
            <Alert>{t('Ссылка на отзыв недействительна или срок её действия истёк.')}</Alert>
          ) : loaded.preview.status === 'SUBMITTED' ? (
            <Alert tone="success">{t('Отзыв по этой ссылке уже отправлен.')}</Alert>
          ) : (
            <BeautyReviewForm token={raw ?? ''} masters={loaded.preview.masters} />
          )}
        </div>
      </section>
    </main>
  );
}

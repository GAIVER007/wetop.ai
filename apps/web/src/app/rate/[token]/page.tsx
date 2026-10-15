import { unstable_rethrow } from 'next/navigation';
import { orderRatingApi } from '../../../lib/api';
import { clientInfo } from '../../../lib/session';
import { decodeInviteToken } from '../../../lib/invite-token';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { RateForm } from './rate-form';
import '../../food/restaurant.css';

export const metadata = { title: 'Оценка обслуживания', robots: { index: false } };

/**
 * Оценка официанта с телефона гостя по QR-коду (DATA_MODEL §40, ADR-170). Без входа: ключ живёт только в адресе.
 * Любая мёртвая ссылка (нет, просрочена, уже оценено) выглядит одинаково.
 */
export default async function RatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const raw = decodeInviteToken(token);
  const loaded = raw
    ? await orderRatingApi.preview(raw, await clientInfo()).then(
        (r) => ({ ok: true as const, r }),
        (e: unknown) => {
          unstable_rethrow(e);
          return { ok: false as const, e };
        },
      )
    : { ok: true as const, r: null };
  return (
    <main className="login-page login-page--single" id="main-content">
      <section className="login-form-panel">
        <div className="login-form" data-testid="rate-page">
          {!loaded.ok ? (
            <>
              <h1>Страница не открылась</h1>
              <LoadError testId="rate-load-error" {...loadErrorProps(loaded.e)} />
            </>
          ) : loaded.r ? (
            <>
              <h1>Как вас обслужили?</h1>
              <p>
                {loaded.r.placeName}, заказ № {loaded.r.orderNumber}
                {loaded.r.waiterName ? (
                  <>
                    <br />
                    Официант: <b>{loaded.r.waiterName}</b>
                  </>
                ) : null}
              </p>
              <RateForm token={raw ?? ''} />
            </>
          ) : (
            <>
              <h1>Ссылка недействительна</h1>
              <p className="muted">
                Оценка по этой ссылке уже поставлена или срок ссылки истёк. Попросите официанта показать новый
                QR-код.
              </p>
            </>
          )}
        </div>
      </section>
    </main>
  );
}

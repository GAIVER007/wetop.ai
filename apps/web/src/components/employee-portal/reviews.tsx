import type { PortalReviews } from '@pms/domain';
import { pluralRu } from '../../lib/plural';
import { intlLocale } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { dateFormat } from '../../i18n/dates';

const score = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

export function EmployeeReviews({ reviews, timezone }: { reviews: PortalReviews; timezone: string }) {
  const t = useT();
  const locale = useLocale();
  const submittedDate = dateFormat(intlLocale(locale), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  });

  return (
    <section className="panel portal-section portal-reviews" data-testid="portal-reviews">
      <header className="portal-reviews-summary">
        <h2>{t('Отзывы')}</h2>
        {reviews.count > 0 && reviews.averageStars !== null && (
          <p>
            <strong>{score.format(reviews.averageStars)}</strong>
            <span> {t('из 5')}</span>
            <span>{pluralRu(reviews.count, [t('отзыв'), t('отзыва'), t('отзывов')])}</span>
          </p>
        )}
      </header>

      {reviews.items.length > 0 ? (
        <ul className="portal-review-list">
          {reviews.items.map((review) => (
            <li key={review.appointmentId}>
              <div className="portal-review-meta">
                <strong aria-label={t('Оценка {n} из 5', { n: review.stars })}>{t('{n} из 5', { n: review.stars })}</strong>
                <time dateTime={review.submittedAt}>{submittedDate.format(new Date(review.submittedAt))}</time>
              </div>
              <p>{review.comment ?? t('Без комментария')}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t('Отзывов пока нет.')}</p>
      )}

      {reviews.hasMore && <p className="portal-review-limit">{t('Показаны последние 50 отзывов.')}</p>}
    </section>
  );
}

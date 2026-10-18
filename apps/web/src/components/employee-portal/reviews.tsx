import type { PortalReviews } from '@pms/domain';
import { pluralRu } from '../../lib/plural';

const score = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 });

export function EmployeeReviews({ reviews, timezone }: { reviews: PortalReviews; timezone: string }) {
  const submittedDate = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  });

  return (
    <section className="panel portal-section portal-reviews" data-testid="portal-reviews">
      <header className="portal-reviews-summary">
        <h2>Отзывы</h2>
        {reviews.count > 0 && reviews.averageStars !== null && (
          <p>
            <strong>{score.format(reviews.averageStars)}</strong>
            <span> из 5</span>
            <span>{pluralRu(reviews.count, ['отзыв', 'отзыва', 'отзывов'])}</span>
          </p>
        )}
      </header>

      {reviews.items.length > 0 ? (
        <ul className="portal-review-list">
          {reviews.items.map((review) => (
            <li key={review.appointmentId}>
              <div className="portal-review-meta">
                <strong aria-label={`Оценка ${review.stars} из 5`}>{review.stars} из 5</strong>
                <time dateTime={review.submittedAt}>{submittedDate.format(new Date(review.submittedAt))}</time>
              </div>
              <p>{review.comment ?? 'Без комментария'}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>Отзывов пока нет.</p>
      )}

      {reviews.hasMore && <p className="portal-review-limit">Показаны последние 50 отзывов.</p>}
    </section>
  );
}

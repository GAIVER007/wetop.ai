import { notFound, unstable_rethrow } from 'next/navigation';
import type { PublicEmployeeDto } from '@pms/domain';
import { publicEmployee } from '../../../lib/employee-portal-api';
import { ApiError } from '../../../lib/api-error';
import { formatMoney } from '../../../lib/money';
import { portalInitials } from '../../../lib/portal-month';
import { countLabel, msg } from '../../../i18n';
import { specialistServiceBookingUrl } from '../../../lib/employee-portal-booking';
import { Field, Select, Button } from '../../../components/ui';
import { serverT } from '../../../i18n/server';
import '../../../components/employee-portal/portal.css';

export default async function SpecialistPage({ params, searchParams }: {
  params: Promise<{ slug: string }>; searchParams: Promise<{ locationId?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const t = await serverT();
  let data: PublicEmployeeDto;
  try {
    data = await publicEmployee(slug, typeof query.locationId === 'string' ? query.locationId : undefined);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 404) notFound();
    return <main className="specialist-page"><section className="panel portal-section" role="status">
      <h1>{t('Страница временно недоступна')}</h1>
      <p>{t('Не удалось загрузить сведения. Повторите попытку позже.')}</p>
    </section></main>;
  }
  return <main className="specialist-page" data-testid="employee-public">
    {/* карточка мастера для клиента (владелец 28.10.2026): фото по центру, имя, строчка о себе, рейтинг и опыт метками */}
    <header className="panel portal-section specialist-hero">
      {data.avatar
        ? <img className="portal-avatar" src={data.avatar.url} width={120} height={120} alt={t('Фото: {name}', { name: data.name })} />
        : <span className="portal-avatar portal-avatar--initials" aria-hidden="true">{portalInitials(data.name)}</span>}
      <p className="portal-eyebrow">{data.businessName}</p><h1>{data.name}</h1>
      {data.headline && <p>{data.headline}</p>}
      <ul className="specialist-hero__chips" aria-label={t('О мастере')}>
        {data.reviews.count > 0 && data.reviews.averageStars !== null && <li data-testid="specialist-rating">{t('★ {stars}, {count}', { stars: new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(Math.round(data.reviews.averageStars * 10) / 10), count: countLabel('ru', t, data.reviews.count, [msg('отзыв'), 'отзыва', msg('отзывов')]) }) /* kk-allow: форма склонения */}</li>}
        {data.practiceSinceYear !== null && <li>{t('В практике с {year} года', { year: String(data.practiceSinceYear) })}</li>}
      </ul>
      {data.bookingUrl && <a className="btn btn--primary specialist-hero__book" href={data.bookingUrl}>{t('Записаться к {name}', { name: data.name })}</a>}
    </header>
    {data.biography && <section className="panel portal-section"><h2>{t('О специалисте')}</h2><p className="portal-biography">{data.biography}</p></section>}
    <section className="panel portal-section"><h2>{t('Услуги и филиал')}</h2>
      {data.locations.length > 0 ? <form method="get" className="portal-filters">
        <Field label={t('Филиал')}><Select name="locationId" defaultValue={data.locationId ?? ''} required>
          <option value="" disabled>{t('Выберите филиал')}</option>
          {data.locations.map(location => <option value={location.id} key={location.id}>{location.name}</option>)}
        </Select></Field><Button type="submit" tone="secondary">{t('Показать услуги')}</Button>
      </form> : <p>{t('Филиалы для записи пока недоступны.')}</p>}
      {!data.locationId ? <p>{t('Выберите филиал, чтобы увидеть действующие цены.')}</p> : data.services.length ? <ul className="portal-list">
        {data.services.map(service => {
          const finalPrice = service.priceMinor !== null && service.priceType !== 'RANGE' && service.priceType !== 'UNFIXED';
          const href = finalPrice ? specialistServiceBookingUrl(data.bookingUrl, service.id) : null;
          let priceLabel = t('Цена уточняется');
          if (service.priceType === 'FREE') priceLabel = t('Бесплатно');
          else if (service.priceType === 'RANGE' && service.priceMinor !== null && service.priceMaxMinor != null)
            priceLabel = `${formatMoney(service.priceMinor, service.currency)} – ${formatMoney(service.priceMaxMinor, service.currency)}`;
          else if (finalPrice && service.priceMinor !== null) priceLabel = formatMoney(service.priceMinor, service.currency);
          return <li key={service.id}><strong>{service.name}</strong><span>{t('{n} мин', { n: service.durationMinutes })}</span><span>{priceLabel}</span>{href && <a className="btn btn--secondary" href={href} aria-label={t('Выбрать время: {name}', { name: service.name })}>{t('Выбрать время')}</a>}</li>;
        })}
      </ul> : <p>{t('В выбранном филиале пока нет доступных услуг.')}</p>}
      {data.bookingUrl ? <a className="btn" href={data.bookingUrl}>{t('Записаться')}</a> : <p>{t('Онлайн-запись пока недоступна.')}</p>}
    </section>
    {data.reviews.items.length > 0 && <section className="panel portal-section" data-testid="specialist-reviews"><h2>{t('Отзывы')}</h2>
      <ul className="specialist-reviews">{data.reviews.items.map((r) => <li key={r.submittedAt}>
        <span className="specialist-reviews__stars" aria-label={t('Оценка {n} из 5', { n: r.stars })}>{'★'.repeat(r.stars)}{'☆'.repeat(5 - r.stars)}</span>
        <time dateTime={r.submittedAt}>{new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(new Date(r.submittedAt))}</time>
        {r.comment && <p>{r.comment}</p>}
      </li>)}</ul>
    </section>}
    <section className="panel portal-section"><h2>{t('Работы')}</h2>
      {data.portfolio.length ? <div className="portal-gallery">{data.portfolio.map(work => <article key={work.id}>
        <img src={work.image.url} width={work.image.width} height={work.image.height} alt={work.title} loading="lazy" />
        <h3>{work.title}</h3>{work.description && <p className="portal-biography">{work.description}</p>}
      </article>)}</div> : <p>{t('Опубликованных работ пока нет.')}</p>}
    </section>
  </main>;
}

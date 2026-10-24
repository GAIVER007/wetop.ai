import Link from 'next/link';
import { formatMoney } from '../../../../lib/money';
import { catalogPrice, hoursLines, type Loaded, type SiteFacts } from '../../../../lib/site-facts';
import { verticalCopy } from '../../../../lib/vertical-copy';
import type { WebVertical } from '../../../../lib/vertical-landing';
import { Alert } from '../../../../components/ui';
import { countLabel, msg } from '../../../../i18n';
import { useLocale, useT } from '../../../../i18n/locale-provider';

/**
 * Карточка «Что WETOP знает о филиале» (SITE-1, план §1 шаг 1): только данные системы, без ИИ. Каталог первыми
 * позициями и «ещё K», пробелы со ссылкой «Дополнить» туда, где данные заводятся. Сайт можно делать и с пробелами.
 */
const CATALOG_SHOWN = 5;
const STAFF_SHOWN = 6;

export function SiteFactsCard({ vertical, facts }: { vertical: WebVertical; facts: Loaded<SiteFacts> }) {
  const t = useT();
  const copy = verticalCopy(vertical);
  return (
    <aside className="site-facts panel" aria-labelledby="site-facts-title" data-testid="create-site-facts">
      <h3 id="site-facts-title" className="site-facts__title">
        {t('Что WETOP знает о филиале')}
      </h3>
      {!facts.ok ? (
        <Alert data-testid="site-facts-error">
          {t('Данные филиала не загрузились: {message}. Сайт можно собрать и так, факты ИИ возьмёт на сервере.', {
            message: facts.message,
          })}
        </Alert>
      ) : (
        <FactsBody facts={facts.data} catalogTitle={t(copy.catalogTitle)} />
      )}
    </aside>
  );
}

function FactsBody({ facts, catalogTitle }: { facts: SiteFacts; catalogTitle: string }) {
  const t = useT();
  const locale = useLocale();
  const { location, catalog, staff, gaps } = facts;
  const items = catalog.items.slice(0, CATALOG_SHOWN);
  const more = catalog.items.length - items.length;
  const people = staff.slice(0, STAFF_SHOWN);
  const hourLines = hoursLines(facts);
  return (
    <>
      <dl className="site-facts__list">
        <Row label={t('Филиал')} value={location.name} />
        <Row label={t('Город')} value={location.city} />
        <Row label={t('Адрес')} value={location.address} />
        <Row label={t('Телефон')} value={location.phone} />
        <Row label="WhatsApp" value={location.whatsapp} />
      </dl>
      <section className="site-facts__block" aria-labelledby="site-facts-catalog" data-testid="site-facts-catalog">
        <h4 id="site-facts-catalog">{catalogTitle}</h4>
        {items.length ? (
          <ul className="site-facts__items">
            {items.map((item, i) => {
              const price = catalogPrice(item, formatMoney);
              return (
                <li key={`${item.code}-${i}`}>
                  <span>
                    {item.name}
                    {item.durationMin ? <span className="muted">{t(', {n} мин', { n: item.durationMin })}</span> : null}
                  </span>
                  {price && <b className="site-facts__price">{price}</b>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="muted">{t('Пока пусто')}</p>
        )}
        {more > 0 && (
          <p className="muted" data-testid="site-facts-more">
            {t('и ещё {count}', {
              count: countLabel(locale, t, more, [msg('позиция'), 'позиции', msg('позиций')]), // kk-allow: форма склонения
            })}
          </p>
        )}
      </section>
      {(facts.vertical === 'BEAUTY' || people.length > 0) && (
        <section className="site-facts__block" aria-labelledby="site-facts-staff" data-testid="site-facts-staff">
          <h4 id="site-facts-staff">{t('Мастера')}</h4>
          {people.length ? (
            <p>
              {people.map((p) => (p.specialization ? `${p.name} (${p.specialization})` : p.name)).join(', ')}
              {staff.length > people.length ? t(' и ещё {n}', { n: staff.length - people.length }) : ''}
            </p>
          ) : (
            <p className="muted">{t('Пока нет')}</p>
          )}
        </section>
      )}
      <dl className="site-facts__list">
        <div className="site-facts__row">
          <dt>{facts.vertical === 'HOSPITALITY' ? t('Заезд и выезд') : t('Часы работы')}</dt>
          <dd>
            {hourLines.length ? (
              hourLines.map((line) => (
                <span key={line} className="site-facts__line">
                  {line}
                </span>
              ))
            ) : (
              <span className="muted">{t('Не указано')}</span>
            )}
          </dd>
        </div>
        <Row label={t('Фото')} value={facts.photosCount ? t('{n} фото', { n: facts.photosCount }) : null} />
        <Row
          label={t('Отзывы')}
          value={
            facts.reviews && facts.reviews.count
              ? t('{avg} из 5, {count}', {
                  avg: facts.reviews.avg.toLocaleString('ru-RU', { maximumFractionDigits: 1 }),
                  count: countLabel(locale, t, facts.reviews.count, [msg('отзыв'), 'отзыва', msg('отзывов')]), // kk-allow: форма склонения
                })
              : null
          }
        />
      </dl>
      {gaps.length > 0 && (
        <section className="site-facts__block site-facts__gaps" aria-labelledby="site-facts-gaps" data-testid="site-facts-gaps">
          <h4 id="site-facts-gaps">{t('Чего не хватает')}</h4>
          <p className="muted">{t('Сайт можно делать и так: ИИ не выдумывает факты, пустые блоки просто не появятся.')}</p>
          <ul>
            {gaps.map((gap) => (
              <li key={gap.key}>
                <span>{t(gap.label)}</span>
                <Link className="btn btn--secondary btn--sm" href={gap.href} aria-label={t('Дополнить: {label}', { label: t(gap.label) })}>
                  {t('Дополнить')}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  const t = useT();
  return (
    <div className="site-facts__row">
      <dt>{label}</dt>
      <dd>{value ?? <span className="muted">{t('Не указано')}</span>}</dd>
    </div>
  );
}

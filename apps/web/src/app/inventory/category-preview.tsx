'use client';
import Link from 'next/link';
import type { InventoryCategory, InventoryUnit } from '../../lib/api';
import { formatMoney } from '../../lib/money';
import { Overlay } from '../../components/overlay';
import { Badge, Button } from '../../components/ui';
import {
  KIND_WORD,
  addWord,
  bookingsLine,
  capacityLong,
  compositionHref,
  unitWord,
} from './category-words';
import { useLocale, useT } from '../../i18n/locale-provider';

/** Больше этого числа мест кодами не перечисляем: 36 коек в панели — это уже экран «Номера и койки» */
const LIST_LIMIT = 12;

/**
 * Панель категории (ТЗ «Категории v2» C2, §9 и §40): что продаём, сколько мест, по какой цене и куда
 * идти дальше. Состав и цены здесь не редактируются — только переход в свои модули (ТЗ §41–§42).
 */
export function CategoryPreview({
  category: c,
  units,
  onClose,
  onEdit,
  onAdd,
  canMutate,
}: {
  category: InventoryCategory;
  units: InventoryUnit[];
  onClose: () => void;
  onEdit: () => void;
  onAdd: () => void;
  canMutate: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const members = units
    .filter((u) => u.accommodationTypeCode === c.code)
    .sort((a, b) => a.code.localeCompare(b.code, 'ru', { numeric: true }));
  const bed = c.kind === 'DORM_BED';
  const code = encodeURIComponent(c.code);
  return (
    <Overlay open onClose={onClose} title={c.name} drawer>
      <div className="fund-preview">
        {!c.active ? (
          <Badge tone="neutral">{t('В архиве')}</Badge>
        ) : members.length && c.priceMinor ? (
          <Badge tone="ok">{t('Активна')}</Badge>
        ) : (
          <Badge tone="warn">{t('Не готова к продаже')}</Badge>
        )}
        <section aria-label={t('Что продаём')}>
          <h3>{t('Что продаём')}</h3>
          <dl className="fund-preview-facts">
            <div>
              <dt>{t('Тип размещения')}</dt>
              <dd>{t(KIND_WORD[c.kind])}</dd>
            </div>
            <div>
              <dt>{t('Вместимость')}</dt>
              <dd>{capacityLong(c, locale, t)}</dd>
            </div>
          </dl>
        </section>
        <section aria-label={t('Номерной фонд')}>
          <h3>{t('Номерной фонд')}</h3>
          {members.length ? (
            <>
              <p>{unitWord(c.kind, members.length, locale, t)}</p>
              {members.length <= LIST_LIMIT && (
                <div className="fund-members">
                  {members.map((u) => (
                    <Link key={u.code} href={`/units/${encodeURIComponent(u.code)}`} prefetch={false}>
                      {bed ? t('Койка {code}', { code: u.code }) : t('Номер {code}', { code: u.code })}
                    </Link>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p>
              {bed
                ? t('Номерной фонд ещё не добавлен. Добавьте комнату с койками: она сразу появится в календаре.')
                : t('Номерной фонд ещё не добавлен. Добавьте номера: они сразу появятся в календаре.')}
            </p>
          )}
          <div className="fund-preview-actions">
            {members.length > 0 && (
              <Link className="btn btn--secondary" href={compositionHref(c)} prefetch={false}>
                {t('Открыть весь состав')}
              </Link>
            )}
            {canMutate && (
              <Button tone="secondary" onClick={onAdd}>
                {t(addWord(c))}
              </Button>
            )}
          </div>
        </section>
        <section aria-label={t('Цена')}>
          <h3>{t('Цена')}</h3>
          {c.priceMinor ? (
            <p>
              {bed
                ? t('{price} за койку в ночь', { price: formatMoney(c.priceMinor, c.currency ?? 'KZT') })
                : t('{price} за номер в ночь', { price: formatMoney(c.priceMinor, c.currency ?? 'KZT') })}
            </p>
          ) : (
            <p>
              <Badge tone="warn">{t('Цена не задана')}</Badge> {t('Без цены категория не продаётся.')}
            </p>
          )}
          <p className="muted">{t('Одна цена на все дни; меняется кнопкой «Редактировать».')}</p>
        </section>
        <section aria-label={t('Брони и каналы')}>
          <h3>{t('Брони и каналы')}</h3>
          <p>{c.reservations ? bookingsLine(c, locale, t) : t('Броней пока нет')}</p>
          <p className="muted">
            {c.channexMapped ? t('Сопоставлена с каналами') : t('С каналами не сопоставлена')}
          </p>
        </section>
        <div className="fund-preview-footer">
          <Link className="btn btn--secondary" href={`/chessboard?category=${code}`} prefetch={false}>
            {t('Открыть в календаре')}
          </Link>
          <Link href={`/rooms/availability?category=${code}`} prefetch={false}>
            {t('Посмотреть доступность')}
          </Link>
          {canMutate && (
            <Button tone="ghost" onClick={onEdit}>
              {t('Редактировать')}
            </Button>
          )}
        </div>
      </div>
    </Overlay>
  );
}

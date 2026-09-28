'use client';
import Link from 'next/link';
import type { InventoryCategory, InventoryUnit } from '../../lib/api';
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

/** Больше этого числа мест кодами не перечисляем: 36 коек в панели — это уже экран «Номера и койки» */
const LIST_LIMIT = 12;

/**
 * Панель категории (ТЗ «Категории v2» C2, §9 и §40): что продаём, сколько мест, какие тарифы и куда
 * идти дальше. Состав и цены здесь не редактируются — только переход в свои модули (ТЗ §41–§42).
 */
export function CategoryPreview({
  category: c,
  units,
  onClose,
  onEdit,
  onAdd,
  onSetRate,
}: {
  category: InventoryCategory;
  units: InventoryUnit[];
  onClose: () => void;
  onEdit: () => void;
  onAdd: () => void;
  onSetRate: () => void;
}) {
  const members = units
    .filter((u) => u.accommodationTypeCode === c.code)
    .sort((a, b) => a.code.localeCompare(b.code, 'ru', { numeric: true }));
  const bed = c.kind === 'DORM_BED';
  const code = encodeURIComponent(c.code);
  return (
    <Overlay open onClose={onClose} title={c.name} drawer>
      <div className="fund-preview">
        {!c.active ? (
          <Badge tone="neutral">В архиве</Badge>
        ) : members.length && c.ratePlans ? (
          <Badge tone="ok">Активна</Badge>
        ) : (
          <Badge tone="warn">Не готова к продаже</Badge>
        )}
        <section aria-label="Что продаём">
          <h3>Что продаём</h3>
          <dl className="fund-preview-facts">
            <div>
              <dt>Тип размещения</dt>
              <dd>{KIND_WORD[c.kind]}</dd>
            </div>
            <div>
              <dt>Вместимость</dt>
              <dd>{capacityLong(c)}</dd>
            </div>
          </dl>
        </section>
        <section aria-label="Номерной фонд">
          <h3>Номерной фонд</h3>
          {members.length ? (
            <>
              <p>{unitWord(c.kind, members.length)}</p>
              {members.length <= LIST_LIMIT && (
                <div className="fund-members">
                  {members.map((u) => (
                    <Link key={u.code} href={`/units/${encodeURIComponent(u.code)}`} prefetch={false}>
                      {bed ? 'Койка' : 'Номер'} {u.code}
                    </Link>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p>
              Номерной фонд ещё не добавлен. Добавьте {bed ? 'комнату с койками' : 'номера'} — они
              сразу появятся на шахматке.
            </p>
          )}
          <div className="fund-preview-actions">
            {members.length > 0 && (
              <Link className="btn btn--secondary" href={compositionHref(c)} prefetch={false}>
                Открыть весь состав
              </Link>
            )}
            <Button tone="secondary" onClick={onAdd}>
              {addWord(c)}
            </Button>
          </div>
        </section>
        <section aria-label="Тарифы">
          <h3>Тарифы</h3>
          {c.ratePlanNames.length ? (
            <ul className="fund-preview-rates">
              {c.ratePlanNames.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          ) : (
            <p>
              <Badge tone="warn">Тариф не настроен</Badge> Без тарифа и цен категория не продаётся.
            </p>
          )}
          {c.ratePlans > 0 && <p className="muted">Цены — по датам в календаре тарифов.</p>}
          <div className="fund-preview-actions">
            {c.ratePlans > 0 ? (
              <Link className="btn btn--secondary" href={`/rates?category=${code}`} prefetch={false}>
                Настроить тарифы
              </Link>
            ) : (
              <Button tone="secondary" onClick={onSetRate}>
                Настроить тариф
              </Button>
            )}
          </div>
        </section>
        <section aria-label="Брони и каналы">
          <h3>Брони и каналы</h3>
          <p>{c.reservations ? bookingsLine(c) : 'Броней пока нет'}</p>
          <p className="muted">
            {c.channexMapped ? 'Сопоставлена с Channex' : 'С Channex не сопоставлена'}
          </p>
        </section>
        <div className="fund-preview-footer">
          <Link className="btn btn--secondary" href={`/chessboard?category=${code}`} prefetch={false}>
            Открыть в шахматке
          </Link>
          <Link href="/rooms/availability" prefetch={false}>
            Посмотреть доступность
          </Link>
          <Button tone="ghost" onClick={onEdit}>
            Редактировать
          </Button>
        </div>
      </div>
    </Overlay>
  );
}

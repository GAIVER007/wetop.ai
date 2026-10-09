'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ActionMenu } from '../../components/action-menu';
import { Icon } from '../../components/icon';
import { StatusBadge, Table, Badge, cx } from '../../components/ui';
import type { GuestRowView } from './row-view';

/**
 * Таблица «Гостей и бронирований» (план guests-bookings-2026-10-09). Клиентской её делает только выбор: щелчок по
 * строке открывает панель гостя (адрес `?guest=`), отметки слева копят выбор для нижней полосы действий.
 * Действия нижней полосы это переходы в карточку брони на нужную вкладку: массовых «Заселить» и «Выселить» нет,
 * пока владелец не решил правила (Q-GB-4), поэтому кнопки живут с одной отмеченной бронью.
 */
const HUES = 4;
const hueOf = (id: string) =>
  [...id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % HUES;

/** Клик по этим элементам строки не открывает панель: у них своё действие */
const OWN_CLICK = 'a, button, input, label, [role="menuitem"], [role="menu"]';

export function GuestsTable({
  rows,
  selectedId,
  total,
  editable,
  children: footerEnd,
}: {
  rows: GuestRowView[];
  /** гость, чья панель открыта (по умолчанию первый в списке); null, когда панель закрыта */
  selectedId: string | null;
  /** всего гостей в выдаче: «Выбрано 1 из 32» */
  total: number;
  /** «только чтение» (ADR-102): действия, которых нельзя, не рисуются */
  editable: boolean;
  /** страницы и размер страницы справа от полосы действий: серверная строка приходит детьми (именованным свойством React ругался на ключи) */
  children?: ReactNode;
}) {
  const router = useRouter();
  const [checked, setChecked] = useState<ReadonlySet<string>>(
    () => new Set(selectedId ? [selectedId] : []),
  );
  // переход к другому гостю или на другую страницу: отмечен выбранный, как на макете
  useEffect(() => {
    setChecked(new Set(selectedId && rows.some((r) => r.id === selectedId) ? [selectedId] : []));
  }, [selectedId, rows]);
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const allChecked = rows.length > 0 && rows.every((r) => checked.has(r.id));
  const one = checked.size === 1 ? rows.find((r) => checked.has(r.id)) : undefined;
  // причина неактивной кнопки: ничего не отмечено, отмечено несколько (групповых действий нет) или не подходит статусу
  const hint =
    checked.size === 0
      ? 'Отметьте одну бронь'
      : checked.size > 1
        ? 'Групповых действий нет: отметьте одну бронь'
        : 'Не подходит этой брони';

  return (
    <>
      <Table aria-label="Гости и бронирования" data-testid="guests-table" className="gb-table" nowrap>
        <thead>
          <tr>
            <th className="gb-check">
              <input
                type="checkbox"
                aria-label="Отметить всех на странице"
                checked={allChecked}
                onChange={() => setChecked(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
              />
            </th>
            <th>Гость</th>
            <th className="gb-wide">Контакты</th>
            <th className="gb-wide">Бронь</th>
            <th>Проживание / статус</th>
            <th>Даты</th>
            <th className="gb-wide">Номер</th>
            <th className="num gb-opt gb-wide">Гостей</th>
            <th>Оплата</th>
            <th className="gb-opt gb-wide">Источник</th>
            <th className="gb-wide">Последний визит</th>
            <th className="gb-more">
              <span className="sr-only">Действия</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const selected = r.id === selectedId;
            return (
              <tr
                key={r.id}
                data-testid="guest-row"
                className={cx(selected && 'is-active')}
                onClick={(event) => {
                  if ((event.target as Element).closest(OWN_CLICK)) return;
                  router.push(r.selectHref, { scroll: false });
                }}
              >
                <td className="gb-check">
                  <input
                    type="checkbox"
                    aria-label={`Отметить: ${r.name}`}
                    checked={checked.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                </td>
                <td>
                  <Link
                    className="gb-guest"
                    href={r.selectHref}
                    scroll={false}
                    prefetch={false}
                    aria-current={selected ? 'true' : undefined}
                  >
                    <span className="gb-avatar" data-hue={hueOf(r.id)} aria-hidden="true">
                      {r.initials}
                    </span>
                    <span className="gb-guest__text">
                      <strong>{r.name}</strong>
                      <small>{r.note}</small>
                    </span>
                  </Link>
                </td>
                <td className="gb-contacts gb-wide">
                  <span>{r.phone ?? '–'}</span>
                  {r.email && <small>{r.email}</small>}
                </td>
                <td className="gb-wide">
                  {r.booking ? (
                    <Link className="gb-booking" href={r.booking.href} prefetch={false}>
                      #{r.booking.number}
                    </Link>
                  ) : (
                    <span className="muted">–</span>
                  )}
                </td>
                <td>
                  {r.status ? (
                    <div className="gb-status">
                      <Badge tone={r.status.tone}>{r.status.word}</Badge>
                      {r.status.note && <small>{r.status.note}</small>}
                    </div>
                  ) : (
                    <span className="muted">–</span>
                  )}
                </td>
                <td>
                  {r.dates ? (
                    <div className="gb-stack">
                      <span>
                        <time dateTime={r.dates.from.iso}>{r.dates.from.text}</time>
                        {' → '}
                        <time dateTime={r.dates.to.iso}>{r.dates.to.text}</time>
                      </span>
                      <small>{r.dates.nights}</small>
                    </div>
                  ) : (
                    <span className="muted">–</span>
                  )}
                </td>
                <td className="gb-wide">
                  {r.unit ? (
                    <div className="gb-stack">
                      {r.unit.code ? (
                        <strong>{r.unit.code}</strong>
                      ) : (
                        <span className="warn-text">не назначена</span>
                      )}
                      <small>{r.unit.category}</small>
                    </div>
                  ) : (
                    <span className="muted">–</span>
                  )}
                </td>
                <td className="num gb-opt gb-wide">{r.guests ?? <span className="muted">–</span>}</td>
                <td>
                  {r.payment ? (
                    <div className="gb-stack">
                      <StatusBadge kind="payment" value={r.payment.state} />
                      <small className="num">{r.payment.amount}</small>
                    </div>
                  ) : (
                    <span className="muted">–</span>
                  )}
                </td>
                <td className="gb-opt gb-wide">{r.source ?? <span className="muted">–</span>}</td>
                <td className="gb-wide">
                  <div className="gb-stack">
                    {r.lastVisit.date ? <span>{r.lastVisit.date}</span> : <span className="muted">–</span>}
                    <small>{r.lastVisit.visits}</small>
                  </div>
                </td>
                <td className="gb-more">
                  <ActionMenu
                    label={`Действия: ${r.name}`}
                    size="sm"
                    items={[
                      ...(r.booking
                        ? [{ label: 'Открыть бронь', onSelect: () => router.push(r.booking!.href) }]
                        : []),
                      { label: 'Открыть гостя', onSelect: () => router.push(r.openHref) },
                      ...(r.newBookingHref
                        ? [{ label: 'Новая бронь', onSelect: () => router.push(r.newBookingHref!) }]
                        : []),
                      ...(r.whatsapp
                        ? [
                            {
                              label: 'Написать в WhatsApp',
                              onSelect: () => window.open(r.whatsapp!, '_blank', 'noopener'),
                            },
                          ]
                        : []),
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <div className="gb-footer">
        <div className="gb-bulk" role="toolbar" aria-label="Действия с отмеченными">
          <span className="gb-bulk__count" data-testid="guests-selected" role="status">
            Выбрано {checked.size} из {total}
          </span>
          {editable && (
            <>
              <BulkAction icon="arrival" label="Заселить" href={one?.actions.checkIn} hint={hint} />
              <BulkAction icon="departure" label="Выселить" href={one?.actions.checkOut} hint={hint} />
              <BulkAction icon="clock" label="Продлить" href={one?.actions.extend} hint={hint} />
              <BulkAction icon="plus" label="Добавить услугу" href={one?.actions.service} hint={hint} />
            </>
          )}
          <ActionMenu
            label="Ещё действия"
            size="sm"
            items={[
              {
                label: 'Снять отметки',
                disabled: checked.size === 0,
                onSelect: () => setChecked(new Set()),
              },
            ]}
          />
        </div>
        {footerEnd}
      </div>
    </>
  );
}

/**
 * Кнопка нижней полосы: ссылка в карточку брони, когда действие подходит отмеченной брони, иначе неактивная кнопка
 * с причиной в подсказке (отметьте одну бронь или действие не подходит статусу проживания).
 */
function BulkAction({
  icon,
  label,
  href,
  hint,
}: {
  icon: 'arrival' | 'departure' | 'clock' | 'plus';
  label: string;
  href: string | null | undefined;
  hint: string;
}) {
  if (href)
    return (
      <Link className="btn btn--secondary btn--sm" href={href} prefetch={false}>
        <Icon name={icon} />
        {label}
      </Link>
    );
  return (
    <button
      type="button"
      className="btn btn--secondary btn--sm"
      aria-disabled="true"
      title={hint}
      onClick={(event) => event.preventDefault()}
    >
      <Icon name={icon} />
      {label}
    </button>
  );
}

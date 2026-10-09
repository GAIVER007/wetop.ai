'use client';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../../components/ui';
import { Icon, type IconName } from '../../components/icon';
import { messengerLinks } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { displayDate } from '../../lib/display-date';
import { nightsBetween, pluralRu } from '../../lib/plural';
import { stayPreviewAction, type StayPreviewData } from './actions';
import { hospitalityStatus } from '../../lib/status/hospitality';
import { statusLabel } from '../../lib/status/types';

/** Что предпросмотр знает из клетки сетки ещё до ответа сервера */
export interface PreviewTarget {
  number: string;
  itemId: string;
  guest: string;
  status: string;
  unitCode: string;
  unitKind: 'ROOM' | 'BED';
  categoryName: string;
  housekeeping?: string | undefined;
  sourceName: string | null;
  /** телефон гостя с плашки: кнопки «Позвонить» и «WhatsApp» правой панели */
  phone?: string | null | undefined;
  arrivalToday: boolean;
  departureToday: boolean;
  anchor: HTMLElement;
}
export type PreviewCommand = 'check-in' | 'check-out' | 'extend' | 'cancel';

const EXPECTED = new Set(['TENTATIVE', 'CONFIRMED']);
const GAP = 6;
const EDGE = 8;

/**
 * Быстрый предпросмотр брони (ТЗ «Шахматка v2» §23–25, §63): одинарный клик по плашке. Порядок —
 * гость → даты → размещение → источник → суммы → действия по статусу; технических номеров, данных
 * канала и лишних ПД нет. Действия — те же команды, что у карточки брони: окно ничего не решает само,
 * а зовёт `onCommand` (заселить, выселить, продлить) или ведёт на вкладку карточки (оплата, переселение).
 *
 * Окно — Popover API в верхнем слое: у области сетки есть `backdrop-filter` (стекло), и `position:
 * fixed` внутри неё считался бы от неё, а не от окна (TESTING.md §4, 21.09). Закрывается Escape
 * (фокус возвращается на плашку), щелчком мимо, прокруткой сетки и сменой размера окна.
 */
export function StayPreview(props: {
  target: PreviewTarget;
  readOnly: boolean;
  /** панель справа от сетки вместо окна у плашки (широкий экран) */
  docked?: boolean;
  onClose: (restoreFocus: boolean) => void;
  onCommand: (command: PreviewCommand, target: PreviewTarget) => void;
}) {
  return props.docked ? <StayPanel {...props} /> : <StayWindow {...props} />;
}

/** Данные предпросмотра по выбранной брони: грузятся при выборе, не для каждой плашки */
function useStayData(target: PreviewTarget) {
  const [data, setData] = useState<StayPreviewData | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setData(undefined);
    void stayPreviewAction(target.number, target.itemId).then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, [target.number, target.itemId]);
  return data;
}

const PANEL_STATUS_ICON: Record<string, IconName> = {
  CONFIRMED: 'booking',
  CHECKED_IN: 'guests',
  CHECKED_OUT: 'departure',
  TENTATIVE: 'help',
};

/**
 * Правая панель брони (образец владельца 09.10.2026): статус, гость, номер брони, кнопки связи, факты с
 * значками (заезд, выезд, номер, гости, оплачено, источник, заметки) и действия по статусу. Стоит рядом
 * с сеткой и не закрывается щелчком мимо: её закрывают крестик, Escape или выбор другой брони. Команды
 * те же, что в окне у плашки и в карточке брони; своих правил нет.
 */
function StayPanel({
  target,
  readOnly,
  onClose,
  onCommand,
}: {
  target: PreviewTarget;
  readOnly: boolean;
  onClose: (restoreFocus: boolean) => void;
  onCommand: (command: PreviewCommand, target: PreviewTarget) => void;
}) {
  const ref = useRef<HTMLElement>(null);
  const data = useStayData(target);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const card = `/reservations/${encodeURIComponent(target.number)}`;
  const expected = EXPECTED.has(target.status);
  const live = expected || target.status === 'CHECKED_IN';
  const balance = data?.money ? BigInt(data.money.balanceMinor) : 0n;
  const money = (minor: string) => formatMoney(minor, data?.currency);
  const unready =
    expected && target.housekeeping !== undefined && target.housekeeping !== 'INSPECTED';
  const today = target.arrivalToday
    ? 'заезд сегодня'
    : target.departureToday
      ? 'выезд сегодня'
      : '';
  const places = target.unitKind === 'BED' ? 'Койка' : 'Номер';
  const nights = data ? nightsBetween(data.arrivalDate, data.departureDate) : 0;
  const messenger = messengerLinks(target.phone);
  const guests = data
    ? [
        data.adults > 0 ? pluralRu(data.adults, ['взрослый', 'взрослых', 'взрослых']) : '',
        data.children > 0 ? pluralRu(data.children, ['ребёнок', 'ребёнка', 'детей']) : '',
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  const row = (icon: IconName, label: string, children: React.ReactNode, testId?: string) => (
    <div className="stay-panel__row" data-testid={testId}>
      <span className="stay-panel__icon" aria-hidden="true">
        <Icon name={icon} />
      </span>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
  return (
    <aside
      ref={ref}
      role="dialog"
      aria-label={`Бронь: ${target.guest}`}
      tabIndex={-1}
      className="stay-panel"
      data-testid="stay-preview"
    >
      <div className="stay-panel__top">
        <span className="stay-panel__status" data-status={target.status}>
          <Icon name={PANEL_STATUS_ICON[target.status] ?? 'booking'} width={14} height={14} />
          {statusLabel(hospitalityStatus, target.status)}
          {today && `, ${today}`}
        </span>
        <button
          type="button"
          className="icon-button stay-panel__close"
          aria-label="Закрыть предпросмотр"
          onClick={() => onClose(true)}
        >
          <Icon name="close" />
        </button>
      </div>
      <h2 className="stay-panel__guest" data-testid="preview-guest">
        {target.guest}
      </h2>
      <p className="stay-panel__number">Бронь №{target.number}</p>
      <div className="stay-panel__contacts">
        {target.phone && (
          <a
            className="stay-panel__round"
            href={`tel:${target.phone.replace(/[^\d+]/g, '')}`}
            aria-label="Позвонить гостю"
            title="Позвонить гостю"
          >
            <Icon name="phone" />
          </a>
        )}
        {messenger && (
          <a
            className="stay-panel__round"
            href={messenger.whatsapp}
            target="_blank"
            rel="noreferrer"
            aria-label="Написать гостю в WhatsApp"
            title="Написать гостю в WhatsApp"
          >
            <Icon name="chat" />
          </a>
        )}
        <Link className="stay-panel__round" href={card} aria-label="Открыть бронь" title="Открыть бронь">
          <Icon name="more" />
        </Link>
      </div>
      <dl className="stay-panel__facts">
        <div data-testid="preview-dates" className="stay-panel__group">
          {row(
            'arrival',
            'Заезд',
            data === undefined ? 'Загружаю…' : data ? displayDate(data.arrivalDate, 'full') : 'в карточке брони',
          )}
          {row(
            'departure',
            'Выезд',
            data === undefined ? (
              'Загружаю…'
            ) : data ? (
              <>
                {displayDate(data.departureDate, 'full')}
                <small>{pluralRu(nights, ['ночь', 'ночи', 'ночей'])}</small>
              </>
            ) : (
              'в карточке брони'
            ),
          )}
        </div>
        {row(
          'bed',
          places,
          `${target.unitCode} (${target.categoryName})`,
          'preview-place',
        )}
        {data && guests && row('guests', 'Гости', guests)}
        <div data-testid="preview-sums" aria-live="polite" className="stay-panel__group">
          {data === undefined ? (
            row('money', 'Оплачено', 'Загружаю…')
          ) : data?.money ? (
            row(
              'money',
              'Оплачено',
              <>
                {money(data.money.paidMinor)}
                <span className="stay-panel__pill" data-tone={balance > 0n ? 'due' : 'paid'}>
                  {balance > 0n
                    ? `Долг ${money(balance.toString())}`
                    : balance < 0n
                      ? `К возврату ${money((-balance).toString())}`
                      : 'Оплачен'}
                </span>
                <small>Итого {money(data.money.chargedMinor)}</small>
              </>,
            )
          ) : (
            row('money', 'Суммы', 'не загрузились, откройте бронь')
          )}
        </div>
        {target.sourceName && row('channels', 'Источник', target.sourceName)}
        {data?.notes && row('journal', 'Заметки', data.notes)}
      </dl>
      {unready && (
        <p className="stay-panel__warn" data-testid="preview-unready">
          {places} не проверен после уборки
        </p>
      )}
      <div className="stay-panel__actions">
        {!readOnly && expected && (
          <Button type="button" className="stay-panel__primary" onClick={() => onCommand('check-in', target)}>
            Заселить
          </Button>
        )}
        {!readOnly && target.status === 'CHECKED_IN' && (
          <Button type="button" className="stay-panel__primary" onClick={() => onCommand('check-out', target)}>
            Выселить
          </Button>
        )}
        {!readOnly && live && (
          <div className="stay-panel__pair">
            <Button type="button" tone="secondary" onClick={() => onCommand('extend', target)}>
              <Icon name="clock" /> Продлить
            </Button>
            <Link className="btn btn--secondary" href={`${card}#booking-actions`}>
              <Icon name="refresh" /> Переселить
            </Link>
          </div>
        )}
        {!readOnly && live && (
          <Button type="button" tone="danger" className="stay-panel__cancel" onClick={() => onCommand('cancel', target)}>
            <Icon name="close" /> Отменить бронь
          </Button>
        )}
        <div className="stay-panel__links">
          {!readOnly && live && (
            <Link href={`${card}#booking-finance`}>Принять оплату</Link>
          )}
          {target.status === 'CHECKED_OUT' && <Link href={`${card}#booking-finance`}>Счёт</Link>}
          {!readOnly && live && <Link href={`${card}#booking-actions`}>Изменить даты</Link>}
          {data?.guestHref && <Link href={data.guestHref}>Открыть гостя</Link>}
          <Link href={card}>Открыть бронь</Link>
        </div>
      </div>
    </aside>
  );
}

function StayWindow({
  target,
  readOnly,
  onClose,
  onCommand,
}: {
  target: PreviewTarget;
  readOnly: boolean;
  onClose: (restoreFocus: boolean) => void;
  onCommand: (command: PreviewCommand, target: PreviewTarget) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // где стояла плашка, когда окно встало на место: закрываемся по её сдвигу, а не по факту scroll
  const placed = useRef<{ top: number; left: number } | null>(null);
  const data = useStayData(target);

  // Место окна: под плашкой, а если снизу не хватает — над ней; по ширине не выходит за край окна
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.matches(':popover-open')) {
      el.showPopover();
      el.focus({ preventScroll: true });
    }
    const box = target.anchor.getBoundingClientRect();
    placed.current = { top: box.top, left: box.left };
    const left = Math.min(Math.max(box.left, EDGE), window.innerWidth - el.offsetWidth - EDGE);
    const below = box.bottom + GAP;
    const top =
      below + el.offsetHeight <= window.innerHeight - EDGE
        ? below
        : Math.max(EDGE, box.top - GAP - el.offsetHeight);
    el.style.left = `${Math.max(EDGE, left)}px`;
    el.style.top = `${top}px`;
  }, [target, data]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose(true);
      }
    };
    const onPointer = (event: PointerEvent) => {
      const node = event.target as Node;
      if (ref.current?.contains(node) || target.anchor.contains(node)) return;
      onClose(false);
    };
    // Событие scroll приходит кадром позже: прокрутка к плашке перед щелчком закрыла бы только что
    // открытое окно. Закрываемся, только если плашка правда уехала (TESTING.md §4, поле даты 21.09)
    const onMove = () => {
      const box = target.anchor.getBoundingClientRect();
      const was = placed.current;
      if (!was || Math.abs(box.top - was.top) > 2 || Math.abs(box.left - was.left) > 2)
        onClose(false);
    };
    const wrap = target.anchor.closest('.board-wrap');
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    wrap?.addEventListener('scroll', onMove, { passive: true });
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
      wrap?.removeEventListener('scroll', onMove);
      window.removeEventListener('resize', onMove);
    };
  }, [target, onClose]);

  const card = `/reservations/${encodeURIComponent(target.number)}`;
  const expected = EXPECTED.has(target.status);
  const live = expected || target.status === 'CHECKED_IN';
  const balance = data?.money ? BigInt(data.money.balanceMinor) : 0n;
  // деньги по DESIGN.md §14: без тиынов, если сумма целая — как на плашке и в карточке брони
  const money = (minor: string) => formatMoney(minor, data?.currency);
  const unready =
    expected && target.housekeeping !== undefined && target.housekeeping !== 'INSPECTED';
  const today = target.arrivalToday
    ? 'заезд сегодня'
    : target.departureToday
      ? 'выезд сегодня'
      : '';

  return (
    <div
      ref={ref}
      popover="manual"
      role="dialog"
      aria-label={`Бронь: ${target.guest}`}
      tabIndex={-1}
      className="stay-preview"
      data-testid="stay-preview"
    >
      <div className="stay-preview__head">
        <h2 className="stay-preview__guest" data-testid="preview-guest">
          {target.guest}
        </h2>
        <button
          type="button"
          className="icon-button stay-preview__close"
          aria-label="Закрыть предпросмотр"
          onClick={() => onClose(true)}
        >
          <Icon name="close" />
        </button>
      </div>
      <p className="stay-preview__status">
        {statusLabel(hospitalityStatus, target.status)}
        {today && `, ${today}`}
      </p>
      <dl className="stay-preview__facts">
        <div>
          <dt>Даты</dt>
          <dd data-testid="preview-dates">
            {data === undefined
              ? 'Загружаю…'
              : data
                ? `${displayDate(data.arrivalDate)} → ${displayDate(data.departureDate)}, ${pluralRu(
                    nightsBetween(data.arrivalDate, data.departureDate),
                    ['ночь', 'ночи', 'ночей'],
                  )}`
                : 'в карточке брони'}
          </dd>
        </div>
        <div>
          <dt>Размещение</dt>
          <dd data-testid="preview-place">
            {target.unitKind === 'BED' ? 'Койка' : 'Номер'} {target.unitCode}, {target.categoryName}
          </dd>
        </div>
        {target.sourceName && (
          <div>
            <dt>Источник</dt>
            <dd>{target.sourceName}</dd>
          </div>
        )}
      </dl>
      <dl className="stay-preview__sums" data-testid="preview-sums" aria-live="polite">
        {data === undefined ? (
          <div>
            <dt>Суммы</dt>
            <dd>Загружаю…</dd>
          </div>
        ) : data?.money ? (
          <>
            <div>
              <dt>Итого</dt>
              <dd>{money(data.money.chargedMinor)}</dd>
            </div>
            <div>
              <dt>Оплачено</dt>
              <dd>{money(data.money.paidMinor)}</dd>
            </div>
            {BigInt(data.money.refundedMinor) > 0n && (
              <div>
                <dt>Возвращено</dt>
                <dd>{money(data.money.refundedMinor)}</dd>
              </div>
            )}
            <div className={balance > 0n ? 'is-due' : undefined}>
              <dt>{balance > 0n ? 'Долг' : balance < 0n ? 'К возврату' : 'Остаток'}</dt>
              <dd>
                {balance === 0n
                  ? 'оплачено полностью'
                  : money((balance < 0n ? -balance : balance).toString())}
              </dd>
            </div>
          </>
        ) : (
          <div>
            <dt>Суммы</dt>
            <dd>не загрузились, откройте бронь</dd>
          </div>
        )}
      </dl>
      {unready && (
        <p className="stay-preview__warn" data-testid="preview-unready">
          {target.unitKind === 'BED' ? 'Койка' : 'Номер'} не проверен после уборки
        </p>
      )}
      <div className="stay-preview__actions">
        {!readOnly && expected && (
          <Button type="button" onClick={() => onCommand('check-in', target)}>
            Заселить
          </Button>
        )}
        {!readOnly && target.status === 'CHECKED_IN' && (
          <Button type="button" onClick={() => onCommand('check-out', target)}>
            Выселить
          </Button>
        )}
        {!readOnly && live && (
          <>
            <Link className="btn btn--secondary" href={`${card}#booking-finance`}>
              Принять оплату
            </Link>
            <Button type="button" tone="info" onClick={() => onCommand('extend', target)}>
              Продлить
            </Button>
            <Link className="btn btn--secondary" href={`${card}#booking-actions`}>
              Переселить
            </Link>
          </>
        )}
        {target.status === 'CHECKED_OUT' && (
          <Link className="btn btn--secondary" href={`${card}#booking-finance`}>
            Счёт
          </Link>
        )}
        {!readOnly && live && (
          <Link className="btn btn--secondary" href={`${card}#booking-actions`}>
            Изменить даты
          </Link>
        )}
        {data?.guestHref && (
          <Link className="btn btn--secondary" href={data.guestHref}>
            Открыть гостя
          </Link>
        )}
        <Link className="btn btn--ghost" href={card}>
          Открыть бронь
        </Link>
      </div>
    </div>
  );
}

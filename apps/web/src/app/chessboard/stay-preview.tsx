'use client';
import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Button } from '../../components/ui';
import { PreviewFinance } from './preview-finance';
import { useConfirm } from '../../components/use-confirm';
import { Icon } from '../../components/icon';
import { formatMoney } from '../../lib/money';
import { displayDate } from '../../lib/display-date';
import { nightsBetween, pluralRu } from '../../lib/plural';
import { stayPreviewAction, type StayPreviewData } from './actions';

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
  arrivalToday: boolean;
  departureToday: boolean;
  anchor: HTMLElement;
}
export type PreviewCommand = 'check-in' | 'check-out' | 'extend';

const STATUS_WORD: Record<string, string> = {
  TENTATIVE: 'Не подтверждена',
  CONFIRMED: 'Подтверждена',
  CHECKED_IN: 'Заселён',
  CHECKED_OUT: 'Выселен',
};
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
export function StayPreview({
  target,
  readOnly,
  pending,
  error,
  onClose,
  onCommand,
}: {
  target: PreviewTarget;
  readOnly: boolean;
  pending: boolean;
  error: string | null;
  onClose: (restoreFocus: boolean) => void;
  onCommand: (command: PreviewCommand, target: PreviewTarget) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // где стояла плашка, когда окно встало на место: закрываемся по её сдвигу, а не по факту scroll
  const placed = useRef<{ top: number; left: number } | null>(null);
  const [data, setData] = useState<StayPreviewData | null | undefined>(undefined);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [financeDirty, setFinanceDirty] = useState(false);
  const [financePending, setFinancePending] = useState(false);
  const { ask, dialog } = useConfirm();
  const requestClose = useCallback(
    async (restoreFocus: boolean) => {
      if (pending || financePending) return;
      if (
        financeDirty &&
        !(await ask({
          title: 'Закрыть без проведения?',
          body: 'Введённые данные будут отменены. Оплата или возврат не проведены.',
          confirmLabel: 'Закрыть без проведения',
          cancelLabel: 'Продолжить ввод',
        }))
      )
        return;
      onClose(restoreFocus);
    },
    [pending, financePending, financeDirty, ask, onClose],
  );

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

  // Место окна: под плашкой, а если снизу не хватает — над ней; по ширине не выходит за край окна
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!el.matches(':popover-open')) {
      el.showPopover();
      el.focus({ preventScroll: true });
    }
    const place = () => {
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
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, data]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        void requestClose(true);
      }
    };
    const onPointer = (event: PointerEvent) => {
      if (pending || financePending || (event.target as Element).closest?.('dialog[open]')) return;
      const node = event.target as Node;
      if (ref.current?.contains(node) || target.anchor.contains(node)) return;
      if (financeDirty) {
        event.preventDefault();
        event.stopPropagation();
      }
      void requestClose(false);
    };
    // Событие scroll приходит кадром позже: прокрутка к плашке перед щелчком закрыла бы только что
    // открытое окно. Закрываемся, только если плашка правда уехала (TESTING.md §4, поле даты 21.09)
    const onMove = () => {
      const box = target.anchor.getBoundingClientRect();
      const was = placed.current;
      if (
        !financeDirty &&
        !financePending &&
        (!was || Math.abs(box.top - was.top) > 2 || Math.abs(box.left - was.left) > 2)
      )
        void requestClose(false);
    };
    const onClick = (event: MouseEvent) => {
      if (
        !financeDirty ||
        (event.target as Element).closest?.('dialog[open]') ||
        ref.current?.contains(event.target as Node)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (!document.querySelector('dialog[open]')) void requestClose(false);
    };
    const wrap = target.anchor.closest('.board-wrap');
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer, true);
    document.addEventListener('click', onClick, true);
    wrap?.addEventListener('scroll', onMove, { passive: true });
    window.addEventListener('resize', onMove);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer, true);
      document.removeEventListener('click', onClick, true);
      wrap?.removeEventListener('scroll', onMove);
      window.removeEventListener('resize', onMove);
    };
  }, [target, requestClose, pending, financePending, financeDirty]);

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
          disabled={pending || financePending}
          onClick={() => void requestClose(true)}
        >
          <Icon name="close" />
        </button>
      </div>
      <p
        className="stay-preview__status"
        data-testid="preview-status"
        data-status={target.status}
        role="status"
      >
        {STATUS_WORD[target.status] ?? target.status}
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
      {error && <Alert data-testid="preview-error">{error}</Alert>}
      {dialog}
      {financeOpen ? (
        <>
          <PreviewFinance
            readOnly={readOnly}
            number={target.number}
            itemId={target.itemId}
            onDraftChange={setFinanceDirty}
            onPendingChange={setFinancePending}
            onComplete={() => {
              void stayPreviewAction(target.number, target.itemId).then(setData);
            }}
          />
          <Button
            type="button"
            tone="secondary"
            disabled={financeDirty || financePending}
            onClick={() => setFinanceOpen(false)}
          >
            Назад к брони
          </Button>
        </>
      ) : (
        <div className="stay-preview__actions" aria-busy={pending}>
          {!readOnly && expected && (
            <Button type="button" disabled={pending} onClick={() => onCommand('check-in', target)}>
              {pending ? 'Выполняется…' : 'Заселить'}
            </Button>
          )}
          {!readOnly && target.status === 'CHECKED_IN' && (
            <Button type="button" disabled={pending} onClick={() => onCommand('check-out', target)}>
              {pending ? 'Выполняется…' : 'Выселить'}
            </Button>
          )}
          {!readOnly && live && (
            <>
              <Button
                type="button"
                tone="secondary"
                disabled={pending}
                onClick={() => setFinanceOpen(true)}
              >
                Оплата / возврат
              </Button>
            </>
          )}
          {target.status === 'CHECKED_OUT' && (
            <Button type="button" tone="secondary" onClick={() => setFinanceOpen(true)}>
              Оплата / возврат
            </Button>
          )}
          <Link
            className="btn btn--secondary"
            href={!readOnly && live ? `${card}#booking-actions` : card}
          >
            {!readOnly && live ? 'Редактировать бронь' : 'Открыть бронь'}
          </Link>
        </div>
      )}
    </div>
  );
}

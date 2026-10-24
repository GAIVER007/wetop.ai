'use client';
import design from './calendar-design.module.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Button } from '../../components/ui';
import { PreviewFinance } from './preview-finance';
import { useConfirm } from '../../components/use-confirm';
import { Icon, type IconName } from '../../components/icon';
import { messengerLinks } from '../../lib/format';
import { formatMoney } from '../../lib/money';
import { displayDate } from '../../lib/display-date';
import { nightsBetween } from '../../lib/plural';
import { countLabel, msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { nightsLabel, shortDate, type Lang } from './lang';
import { stayPreviewAction, type StayPreviewData } from './actions';
import { hospitalityStatus } from '../../lib/status/hospitality';
import { statusLabel } from '../../lib/status/types';

/** Что предпросмотр знает из клетки сетки ещё до ответа сервера */
/** Двойной щелчок: первый открывает панель над клеткой, второй попадает уже в неё; открываем полную карточку, как у клетки */
function openCardOnDouble(
  router: ReturnType<typeof useRouter>,
  card: string,
  close: (restoreFocus: boolean) => Promise<boolean>,
) {
  return async (event: React.MouseEvent<HTMLElement>) => {
    if ((event.target as HTMLElement).closest('a, button, input, select, textarea, [role="menu"]'))
      return;
    event.preventDefault();
    if (await close(false)) router.push(card);
  };
}

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
  pending: boolean;
  error: string | null;
  onClose: (restoreFocus: boolean) => void;
  onCommand: (command: PreviewCommand, target: PreviewTarget) => void;
  onEditStateChange?: (dirty: boolean, pending: boolean) => void;
}) {
  return props.docked ? <StayPanel {...props} /> : <StayWindow {...props} />;
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
  pending,
  error,
  onClose,
  onCommand,
  onEditStateChange,
}: {
  target: PreviewTarget;
  readOnly: boolean;
  pending: boolean;
  error: string | null;
  onClose: (restoreFocus: boolean) => void;
  onCommand: (command: PreviewCommand, target: PreviewTarget) => void;
  onEditStateChange?: (dirty: boolean, pending: boolean) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const lang: Lang = { t, locale };
  const ref = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<StayPreviewData | null | undefined>(undefined);
  const [financeOpen, setFinanceOpen] = useState(false);
  const [financeDirty, setFinanceDirty] = useState(false);
  const [financePending, setFinancePending] = useState(false);
  const { ask, dialog } = useConfirm();
  const requestClose = useCallback(
    async (restoreFocus: boolean) => {
      if (pending || financePending) return false;
      if (
        financeDirty &&
        !(await ask({
          title: t('Закрыть без проведения?'),
          body: t('Введённые данные будут отменены. Оплата или возврат не проведены.'),
          confirmLabel: t('Закрыть без проведения'),
          cancelLabel: t('Продолжить ввод'),
        }))
      )
        return false;
      onClose(restoreFocus);
      return true;
    },
    [pending, financePending, financeDirty, ask, onClose, t],
  );

  useEffect(() => {
    onEditStateChange?.(financeDirty, financePending);
    return () => onEditStateChange?.(false, false);
  }, [financeDirty, financePending, onEditStateChange]);
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
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Escape, который уже закрыл меню «…», панель не закрывает
      if (
        event.key === 'Escape' &&
        !event.defaultPrevented &&
        !document.querySelector('dialog[open]')
      ) {
        event.preventDefault();
        void requestClose(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [requestClose]);
  // Щелчок мимо закрывает панель, как закрывало прежнее окно: она показывает одну бронь, а не висит всегда.
  // Плашка переключает панель сама, окна и меню поверх страницы щелчком мимо не считаются.
  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const hit = event.target instanceof Element ? event.target : null;
      if (!hit || hit === document.documentElement || ref.current?.contains(hit)) return;
      if (
        hit.closest(
          'a[href], [data-testid="stay-cell"], dialog, [role="dialog"], [role="alertdialog"], [role="menu"], [popover]',
        )
      )
        return;
      void requestClose(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [requestClose]);

  const card = `/reservations/${encodeURIComponent(target.number)}`;
  const router = useRouter();
  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      const link =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (
        !link ||
        link.closest('[data-testid="stay-cell"], [data-testid="free-cell"]') ||
        link.target === '_blank' ||
        !(financeDirty || financePending || pending)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (document.querySelector('dialog[open]')) return;
      void requestClose(false).then((closed) => {
        if (closed) router.push(link.href);
      });
    };
    document.addEventListener('click', navigate, true);
    return () => document.removeEventListener('click', navigate, true);
  }, [financeDirty, financePending, pending, requestClose, router]);
  const expected = EXPECTED.has(target.status);
  const live = expected || target.status === 'CHECKED_IN';
  const balance = data?.money ? BigInt(data.money.balanceMinor) : 0n;
  const money = (minor: string) => formatMoney(minor, data?.currency);
  const unready =
    expected && target.housekeeping !== undefined && target.housekeeping !== 'INSPECTED';
  const today = target.arrivalToday
    ? t('заезд сегодня')
    : target.departureToday
      ? t('выезд сегодня')
      : '';
  const places = target.unitKind === 'BED' ? t('Койка') : t('Номер');
  // Даты, гости и счёт показываются в предпросмотре выбранной брони.
  const nights = data ? nightsBetween(data.arrivalDate, data.departureDate) : 0;
  const messenger = messengerLinks(target.phone);
  const guests = data
    ? [
        data.adults > 0
          ? countLabel(locale, t, data.adults, [msg('взрослый'), 'взрослых', msg('взрослых')]) // kk-allow: форма склонения
          : '',
        data.children > 0
          ? countLabel(locale, t, data.children, [msg('ребёнок'), 'ребёнка', msg('детей')]) // kk-allow: форма склонения
          : '',
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  const row = (icon: IconName, label: string, children: React.ReactNode, testId?: string) => (
    <dl className="stay-panel__row" data-testid={testId}>
      <dt>
        <span className="stay-panel__icon" aria-hidden="true">
          <Icon name={icon} />
        </span>
        {label}
      </dt>
      <dd>{children}</dd>
    </dl>
  );
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label={t('Бронь: {guest}', { guest: target.guest })}
      tabIndex={-1}
      className={`stay-panel ${design.preview}`}
      data-testid="stay-preview"
      onDoubleClick={openCardOnDouble(router, card, requestClose)}
    >
      <div className="stay-panel__top">
        <span
          className="stay-panel__status"
          data-testid="preview-status"
          role="status"
          data-status={target.status}
        >
          <Icon name={PANEL_STATUS_ICON[target.status] ?? 'booking'} width={14} height={14} />
          {t(statusLabel(hospitalityStatus, target.status))}
          {today && `, ${today}`}
        </span>
        <button
          type="button"
          className="icon-button stay-panel__close"
          aria-label={t('Закрыть предпросмотр')}
          onClick={() => void requestClose(true)}
        >
          <Icon name="close" />
        </button>
      </div>
      <h2 className="stay-panel__guest" data-testid="preview-guest">
        {target.guest}
      </h2>
      <p className="stay-panel__number">{t('Бронь №{number}', { number: target.number })}</p>
      <div className="stay-panel__contacts">
        {target.phone && (
          <a
            className="stay-panel__round"
            href={`tel:${target.phone.replace(/[^\d+]/g, '')}`}
            aria-label={t('Позвонить гостю')}
            title={t('Позвонить гостю')}
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
            aria-label={t('Написать гостю в WhatsApp')}
            title={t('Написать гостю в WhatsApp')}
          >
            <Icon name="chat" />
          </a>
        )}
      </div>
      <div className="stay-panel__facts">
        <div data-testid="preview-dates" className="stay-panel__group">
          {row(
            'arrival',
            t('Заезд'),
            data === undefined
              ? t('Загружаю…')
              : data
                ? displayDate(data.arrivalDate, 'numeric')
                : t('в карточке брони'),
          )}
          {row(
            'departure',
            t('Выезд'),
            data === undefined ? (
              t('Загружаю…')
            ) : data ? (
              <>
                {displayDate(data.departureDate, 'numeric')}
                <small>{nightsLabel(lang, nights)}</small>
              </>
            ) : (
              t('в карточке брони')
            ),
          )}
        </div>
        {row('bed', places, `${target.unitCode} (${target.categoryName})`, 'preview-place')}
        {data && guests && row('guests', t('Гости'), guests)}
        <div data-testid="preview-sums" aria-live="polite" className="stay-panel__group">
          {data === undefined
            ? row('money', t('Оплачено'), t('Загружаю…'))
            : data?.money
              ? row(
                  'money',
                  t('Оплачено'),
                  <>
                    {money(data.money.paidMinor)}
                    <span className="stay-panel__pill" data-tone={balance > 0n ? 'due' : 'paid'}>
                      {balance > 0n
                        ? t('Долг {sum}', { sum: money(balance.toString()) })
                        : balance < 0n
                          ? t('К возврату {sum}', { sum: money((-balance).toString()) })
                          : t('Оплачен')}
                    </span>
                    <small>{t('Итого {sum}', { sum: money(data.money.chargedMinor) })}</small>
                  </>,
                )
              : row('money', t('Суммы'), t('не загрузились, откройте бронь'))}
        </div>
        {target.sourceName && row('channels', t('Источник'), t(target.sourceName))}
        {data?.notes && row('journal', t('Заметки'), data.notes)}
      </div>
      {unready && (
        <p className="stay-panel__warn" data-testid="preview-unready">
          {target.unitKind === 'BED' ? t('Койка не проверен после уборки') : t('Номер не проверен после уборки')}
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
            {t('Назад к брони')}
          </Button>
        </>
      ) : (
        <div className="stay-panel__actions" aria-busy={pending}>
          {!readOnly && expected && (
            <Button type="button" disabled={pending} onClick={() => onCommand('check-in', target)}>
              {pending ? t('Выполняется…') : t('Заселить')}
            </Button>
          )}
          {!readOnly && target.status === 'CHECKED_IN' && (
            <Button type="button" disabled={pending} onClick={() => onCommand('check-out', target)}>
              {pending ? t('Выполняется…') : t('Выселить')}
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
                {t('Оплата / возврат')}
              </Button>
            </>
          )}
          {target.status === 'CHECKED_OUT' && (
            <Button type="button" tone="secondary" onClick={() => setFinanceOpen(true)}>
              {t('Оплата / возврат')}
            </Button>
          )}
          <Link
            className="btn btn--secondary"
            href={!readOnly && live ? `${card}#booking-actions` : card}
          >
            {!readOnly && live ? t('Редактировать бронь') : t('Открыть бронь')}
          </Link>
        </div>
      )}
    </div>
  );
}

function StayWindow({
  target,
  readOnly,
  pending,
  error,
  onClose,
  onCommand,
  onEditStateChange,
}: {
  target: PreviewTarget;
  readOnly: boolean;
  pending: boolean;
  error: string | null;
  onClose: (restoreFocus: boolean) => void;
  onCommand: (command: PreviewCommand, target: PreviewTarget) => void;
  onEditStateChange?: (dirty: boolean, pending: boolean) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const lang: Lang = { t, locale };
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
      if (pending || financePending) return false;
      if (
        financeDirty &&
        !(await ask({
          title: t('Закрыть без проведения?'),
          body: t('Введённые данные будут отменены. Оплата или возврат не проведены.'),
          confirmLabel: t('Закрыть без проведения'),
          cancelLabel: t('Продолжить ввод'),
        }))
      )
        return false;
      onClose(restoreFocus);
      return true;
    },
    [pending, financePending, financeDirty, ask, onClose, t],
  );

  useEffect(() => {
    onEditStateChange?.(financeDirty, financePending);
    return () => onEditStateChange?.(false, false);
  }, [financeDirty, financePending, onEditStateChange]);
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
      if (
        ref.current?.contains(node) ||
        target.anchor.contains(node) ||
        (event.target instanceof Element && event.target.closest('a[href]'))
      )
        return;
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
        ref.current?.contains(event.target as Node) ||
        (event.target instanceof Element && event.target.closest('a[href]'))
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
  const router = useRouter();
  useEffect(() => {
    const navigate = (event: MouseEvent) => {
      const link =
        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (
        !link ||
        link.closest('[data-testid="stay-cell"], [data-testid="free-cell"]') ||
        link.target === '_blank' ||
        !(financeDirty || financePending || pending)
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      if (document.querySelector('dialog[open]')) return;
      void requestClose(false).then((closed) => {
        if (closed) router.push(link.href);
      });
    };
    document.addEventListener('click', navigate, true);
    return () => document.removeEventListener('click', navigate, true);
  }, [financeDirty, financePending, pending, requestClose, router]);
  const expected = EXPECTED.has(target.status);
  const live = expected || target.status === 'CHECKED_IN';
  const balance = data?.money ? BigInt(data.money.balanceMinor) : 0n;
  // деньги по DESIGN.md §14: без тиынов, если сумма целая — как на плашке и в карточке брони
  const money = (minor: string) => formatMoney(minor, data?.currency);
  const unready =
    expected && target.housekeeping !== undefined && target.housekeeping !== 'INSPECTED';
  const today = target.arrivalToday
    ? t('заезд сегодня')
    : target.departureToday
      ? t('выезд сегодня')
      : '';

  return (
    <div
      ref={ref}
      popover="manual"
      role="dialog"
      aria-label={t('Бронь: {guest}', { guest: target.guest })}
      tabIndex={-1}
      className="stay-preview"
      data-testid="stay-preview"
      onDoubleClick={openCardOnDouble(router, card, requestClose)}
    >
      <div className="stay-preview__head">
        <h2 className="stay-preview__guest" data-testid="preview-guest">
          {target.guest}
        </h2>
        <button
          type="button"
          className="icon-button stay-preview__close"
          aria-label={t('Закрыть предпросмотр')}
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
        {t(statusLabel(hospitalityStatus, target.status))}
        {today && `, ${today}`}
      </p>
      <dl className="stay-preview__facts">
        <div>
          <dt>{t('Даты')}</dt>
          <dd data-testid="preview-dates">
            {data === undefined
              ? t('Загружаю…')
              : data
                ? `${shortDate(lang, data.arrivalDate)} → ${shortDate(lang, data.departureDate)}, ${nightsLabel(
                    lang,
                    nightsBetween(data.arrivalDate, data.departureDate),
                  )}`
                : t('в карточке брони')}
          </dd>
        </div>
        <div>
          <dt>{t('Размещение')}</dt>
          <dd data-testid="preview-place">
            {target.unitKind === 'BED' ? t('Койка {code}', { code: target.unitCode }) : t('Номер {code}', { code: target.unitCode })}, {target.categoryName}
          </dd>
        </div>
        {target.sourceName && (
          <div>
            <dt>{t('Источник')}</dt>
            <dd>{t(target.sourceName)}</dd>
          </div>
        )}
      </dl>
      <dl className="stay-preview__sums" data-testid="preview-sums" aria-live="polite">
        {data === undefined ? (
          <div>
            <dt>{t('Суммы')}</dt>
            <dd>{t('Загружаю…')}</dd>
          </div>
        ) : data?.money ? (
          <>
            <div>
              <dt>{t('Итого')}</dt>
              <dd>{money(data.money.chargedMinor)}</dd>
            </div>
            <div>
              <dt>{t('Оплачено')}</dt>
              <dd>{money(data.money.paidMinor)}</dd>
            </div>
            {BigInt(data.money.refundedMinor) > 0n && (
              <div>
                <dt>{t('Возвращено')}</dt>
                <dd>{money(data.money.refundedMinor)}</dd>
              </div>
            )}
            <div className={balance > 0n ? 'is-due' : undefined}>
              <dt>{balance > 0n ? t('Долг') : balance < 0n ? t('К возврату') : t('Остаток')}</dt>
              <dd>
                {balance === 0n
                  ? t('оплачено полностью')
                  : money((balance < 0n ? -balance : balance).toString())}
              </dd>
            </div>
          </>
        ) : (
          <div>
            <dt>{t('Суммы')}</dt>
            <dd>{t('не загрузились, откройте бронь')}</dd>
          </div>
        )}
      </dl>
      {unready && (
        <p className="stay-preview__warn" data-testid="preview-unready">
          {target.unitKind === 'BED' ? t('Койка не проверен после уборки') : t('Номер не проверен после уборки')}
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
            {t('Назад к брони')}
          </Button>
        </>
      ) : (
        <div className="stay-preview__actions" aria-busy={pending}>
          {!readOnly && expected && (
            <Button type="button" disabled={pending} onClick={() => onCommand('check-in', target)}>
              {pending ? t('Выполняется…') : t('Заселить')}
            </Button>
          )}
          {!readOnly && target.status === 'CHECKED_IN' && (
            <Button type="button" disabled={pending} onClick={() => onCommand('check-out', target)}>
              {pending ? t('Выполняется…') : t('Выселить')}
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
                {t('Оплата / возврат')}
              </Button>
            </>
          )}
          {target.status === 'CHECKED_OUT' && (
            <Button type="button" tone="secondary" onClick={() => setFinanceOpen(true)}>
              {t('Оплата / возврат')}
            </Button>
          )}
          <Link
            className="btn btn--secondary"
            href={!readOnly && live ? `${card}#booking-actions` : card}
          >
            {!readOnly && live ? t('Редактировать бронь') : t('Открыть бронь')}
          </Link>
        </div>
      )}
    </div>
  );
}

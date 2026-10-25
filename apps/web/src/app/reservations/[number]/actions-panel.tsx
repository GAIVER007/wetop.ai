'use client';
import { useActionState, useEffect, useRef, useState, type FormEvent, type RefObject } from 'react';
import { useSearchParams } from 'next/navigation';
import { HOUSEKEEPING_RU, plansToChoose } from '@pms/domain';
import { useCommand } from '../../../lib/use-command';
import {
  Alert,
  Button,
  Field,
  Input,
  PanelTitle,
  Row,
  Select,
  Stack,
  Textarea,
} from '../../../components/ui';
import { DateInput } from '../../../components/date-field';
import { ConfirmDialog } from '../../../components/confirm-dialog';
import type {
  CancelPreview,
  ExtendPreview,
  MovePreview,
  PiiStorage,
  RatePlanOption,
} from '../../../lib/api';
import { formatMoney } from '../../../lib/money';
import { penaltyText } from '../../../lib/penalty-text';
import {
  assignUnitAction,
  cancelPreviewAction,
  cancelReservationAction,
  changeDatesAction,
  extendPreviewAction,
  extendStayAction,
  movePreviewAction,
  stayAction,
  updateReservationAction,
  updateStayGuestsAction,
  type ActionResult,
} from '../actions';
import { CHANNELS, SOURCES, fromChannex } from '../sources';
import { useConfirm } from '../../../components/use-confirm';
import { previewLine } from '../../../lib/action-preview';
import { useToast } from '../../../components/toast';
import { useMay } from '../../../components/desk-access';
import { previewAction } from '../actions';
import { displayDate } from '../../../lib/display-date';
import { countLabel, intlLocale, msg, type DeskLocale } from '../../../i18n';
import { useLocale, useT } from '../../../i18n/locale-provider';

const OPEN = new Set(['TENTATIVE', 'CONFIRMED']);

/**
 * Быстрое действие с «Главной» открывает карточку на кнопке этого действия для этого проживания:
 * `?do=check-out&item=<id>#booking-actions` (разбор 23.09.2026, находка 2; DESIGN.md §1 п. 2). Карточка
 * ставит на кнопку фокус и рамку фокуса, но не нажимает её: заселение, выселение и продление
 * по-прежнему подтверждает человек — Enter или щелчок, дальше те же окна, что и без «Главной».
 */
const QUICK_ACTIONS = new Set(['check-in', 'check-out', 'extend', 'move']);
function useQuickTarget(panel: RefObject<HTMLElement | null>) {
  const search = useSearchParams();
  const action = search.get('do');
  const item = search.get('item');
  useEffect(() => {
    if (!action || !item || !QUICK_ACTIONS.has(action)) return;
    const pick = (key: string) => {
      const el = panel.current?.querySelector<HTMLElement>(
        `[data-quick-action="${CSS.escape(key)}"]`,
      );
      return el && !el.matches(':disabled') ? el : null;
    };
    let frame = 0;
    let tries = 0;
    const attempt = () => {
      // Вкладка «Действия» открывается по якорю чуть позже, а панель брони — окном поверх страницы,
      // которое при открытии само ставит фокус: ждём, пока кнопка станет видна (не дольше секунды)
      const root = panel.current;
      if (!root || root.closest('[hidden]') || !root.getClientRects().length) {
        if (++tries < 60) frame = requestAnimationFrame(attempt);
        return;
      }
      // Заселить без ячейки нельзя — сначала выбор ячейки; продлить без тарифа — сначала выбор тарифа
      const el =
        pick(`${action}:${item}`) ??
        (action === 'check-in'
          ? pick(`move:${item}`)
          : action === 'extend'
            ? pick(`extend-plan:${item}`)
            : null);
      if (!el) return;
      el.setAttribute('data-quick-target', '');
      el.addEventListener('blur', () => el.removeAttribute('data-quick-target'), { once: true });
      el.scrollIntoView({ block: 'center' });
      el.focus({ preventScroll: true });
    };
    frame = requestAnimationFrame(attempt);
    return () => cancelAnimationFrame(frame);
  }, [action, item, panel]);
}

/** Дата словами стойки: 20.09.2026 (DESIGN.md §14) */
/** «25 окт.»: как даты в шапке брони и шахматке (аудит 22.10.2026 P2-4, было «25.10.2026») */
const dd = (iso: string, locale: DeskLocale) => displayDate(iso, 'short', intlLocale(locale));
const NIGHTS: [string, string, string] = [msg('ночь'), 'ночи', msg('ночей')]; // kk-allow: форма склонения

export function ReservationActions(props: {
  number: string;
  status: string;
  source: string;
  notes: string | null;
  /** Где лежит база (ADR-072): пока не в РК, у заметки подсказка «без имён и телефонов гостя» (Q-169) */
  piiStorage?: PiiStorage;
  /** ADR-071: канал и номер брони в канале (ручная бронь OTA) или `unique_id` Channex */
  channel?: string | null;
  externalId?: string | null;
  arrivalDate: string;
  departureDate: string;
  /** Валюта брони — для сумм в окнах подтверждения */
  currency: string;
  ratePlans: RatePlanOption[];
  items: Array<{
    id: string;
    status: string;
    accommodationTypeCode: string;
    accommodationTypeName: string;
    arrivalDate: string;
    departureDate: string;
    unitCode: string | null;
    /** Статус уборки ячейки (Q-156): предупреждение перед заселением в непроверенную */
    unitHousekeepingStatus?: 'DIRTY' | 'CLEAN' | 'INSPECTED' | null;
    /** null — тариф неизвестен: пересчёт цены без выбора тарифа невозможен */
    ratePlanCode: string | null;
    ratePlanName: string | null;
    adults: number;
    children: number;
    /** Остаток по счёту проживания — для окна «Выселить с долгом»; null — счёт не загрузился */
    debtMinor: string | null;
    availableGroups: Array<{ code: string; name: string; units: string[] }>;
  }>;
}) {
  const t = useT();
  // Как в API (changeDates): без явного выбора пересчёт идёт по тарифу первого неотменённого проживания (Б1)
  const current = props.items.find((it) => it.status !== 'CANCELLED' && it.ratePlanCode);
  // тариф брони — её цена и штраф: выбирают владелец и управляющий (Q-200), администратор меняет даты в том же тарифе;
  // брони без тарифа он назначает тариф со штрафом (Q-201) — в списке ровно то, что примет API
  const choosePlan = useMay('rates');
  const datePlans = plansToChoose(props.ratePlans, {
    mayChangePlan: choosePlan,
    hasPlan: !!current,
  });
  const {
    state: cancelState,
    run: cancel,
    pending: cancelPending,
  } = useCommand<ActionResult>({ error: null });
  const { toast } = useToast();
  const [datesState, datesAction, datesPending] = useActionState<ActionResult, FormData>(
    changeDatesAction.bind(null, props.number),
    { error: null },
  );
  // Окно отмены (срез 7.3, Д5): штраф считает сервер тем же кодом, что и начисление; «Оставить» ничего не пишет
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelPreview, setCancelPreview] = useState<CancelPreview | null | undefined>(undefined);
  const [cancelReason, setCancelReason] = useState<'cancel' | 'no_show'>('cancel');
  const [cancelItemId, setCancelItemId] = useState('');
  const expectedItems = props.items.filter(
    (it) => it.status === 'CONFIRMED' || it.status === 'TENTATIVE',
  );
  const openCancel = (itemId?: string) => {
    setCancelReason('cancel');
    setCancelItemId(itemId ?? expectedItems[0]?.id ?? '');
    setCancelPreview(undefined);
    setCancelOpen(true);
  };
  useEffect(() => {
    if (!cancelOpen) return;
    let alive = true;
    setCancelPreview(undefined);
    void cancelPreviewAction(
      props.number,
      cancelReason,
      cancelReason === 'no_show' ? cancelItemId : undefined,
    ).then((preview) => {
      if (alive) setCancelPreview(preview);
    });
    return () => {
      alive = false;
    };
  }, [cancelOpen, cancelReason, cancelItemId, props.number]);
  const canEdit = OPEN.has(props.status);
  const panel = useRef<HTMLElement>(null);
  useQuickTarget(panel);
  return (
    <section ref={panel} data-testid="reservation-actions" className="reservation-actions stack stack--mt">
      {props.items
        .filter(
          (it) =>
            it.status !== 'CANCELLED' && it.status !== 'CHECKED_OUT' && it.status !== 'NO_SHOW',
        )
        .map((it) => (
          <Stack key={it.id} gap="sm">
            <StayGuestsForm number={props.number} item={it} />
            <StayButtons
              number={props.number}
              currency={props.currency}
              item={it}
              ratePlans={props.ratePlans}
              onCancel={openCancel}
            />
            <AssignForm
              number={props.number}
              currency={props.currency}
              item={it}
              arrivalDate={props.arrivalDate}
              ratePlans={props.ratePlans}
            />
          </Stack>
        ))}
      {canEdit && (
        // Поля неконтролируемые: defaultValue применяется только при монтировании, поэтому после
        // «Продлить на ночь» или переселения форма показывала бы прежние даты, а сохранение молча
        // укоротило бы проживание. Ключ по текущим датам отрисовывает поля заново.
        <form
          key={`${props.arrivalDate}-${props.departureDate}-${datesState.attempt ?? 0}`}
          action={datesAction}
          className="panel"
        >
          <PanelTitle>{t('Изменить даты')}</PanelTitle>
          <Row>
            <Field label={t('Заезд')}>
              <DateInput
                name="arrivalDate"
                defaultValue={datesState.values?.arrivalDate ?? props.arrivalDate}
              />
            </Field>
            <Field label={t('Выезд')}>
              <DateInput
                name="departureDate"
                rangeFromName="arrivalDate"
                defaultValue={datesState.values?.departureDate ?? props.departureDate}
              />
            </Field>
            {datePlans.length > 0 && (
              <Select
                name="ratePlanCode"
                aria-label={t('Тариф для пересчёта')}
                defaultValue={datesState.values?.ratePlanCode ?? ''}
                required={!current}
              >
                {current ? (
                  <option value="">
                    {t('— оставить текущий тариф: {plan} —', { plan: current.ratePlanName ?? current.ratePlanCode ?? '' })}
                  </option>
                ) : (
                  <option value="" disabled>
                    {t('— выберите тариф —')}
                  </option>
                )}
                {datePlans.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
            {(datePlans.length > 0 || current) && (
              <Button type="submit" disabled={datesPending}>
                {t('Пересчитать и сохранить')}
              </Button>
            )}
          </Row>
          {!current && (
            <p className="hint" data-testid="dates-no-plan">
              {choosePlan
                ? t('У брони нет тарифа — выберите, по какому пересчитать цену.')
                : datePlans.length > 0
                  ? t('У брони нет тарифа — выберите тариф со штрафом за отмену: он запишется в бронь, менять его будут владелец или управляющий.')
                  : t('У брони нет тарифа, а тарифа со штрафом за отмену нет: даты пересчитывают владелец или управляющий.')}
            </p>
          )}
          {datesState.error && <Alert>{datesState.error}</Alert>}
        </form>
      )}
      <EditForm
        number={props.number}
        source={props.source}
        notes={props.notes}
        piiStorage={props.piiStorage ?? 'pseudonymized'}
        channel={props.channel ?? null}
        externalId={props.externalId ?? null}
      />
      {canEdit && (
        // Опасное действие названо до окна: что необратимо и что покажем перед подтверждением (B3)
        <div className="panel panel--danger" data-testid="cancel-panel">
          <PanelTitle>{t('Отмена брони')}</PanelTitle>
          <p className="hint">
            {t('Необратимо: место вернётся в продажу и уйдёт в каналы. Штраф по тарифу, если он положен, покажем до подтверждения.')}
          </p>
          <div>
            <Button
              type="button"
              tone="danger"
              disabled={cancelPending}
              data-testid="cancel-reservation"
              onClick={() => openCancel()}
            >
              {t('Отменить бронь')}
            </Button>
          </div>
          {cancelState.error && <Alert>{cancelState.error}</Alert>}
          <ConfirmDialog
            open={cancelOpen}
            title={t('Отменить бронь {number}?', { number: props.number })}
            confirmLabel={cancelReason === 'cancel' ? t('Подтвердить отмену') : t('Подтвердить незаезд')}
            cancelLabel={t('Оставить')}
            pending={cancelPending}
            confirmDisabled={
              cancelPreview === undefined || (cancelReason === 'no_show' && !cancelItemId)
            }
            onCancel={() => setCancelOpen(false)}
            onConfirm={async () => {
              let succeeded = false;
              await cancel(async () => {
                const r =
                  cancelReason === 'cancel'
                    ? await cancelReservationAction(props.number)
                    : await stayAction(props.number, cancelItemId, 'no-show');
                succeeded = !r.error;
                if (succeeded)
                  toast({
                    text:
                      cancelReason === 'cancel'
                        ? t('Бронь {number} отменена', { number: props.number })
                        : t('Незаезд отмечен, место вернулось в продажу'),
                    tone: 'success',
                  });
                return r;
              });
              if (succeeded) setCancelOpen(false);
            }}
          >
            <label>
              {t('Причина отмены')}
              <Select
                value={cancelReason}
                disabled={cancelPending}
                onChange={(e) => {
                  setCancelPreview(undefined);
                  setCancelReason(e.target.value as 'cancel' | 'no_show');
                }}
              >
                <option value="cancel">{t('Отказ от бронирования')}</option>
                <option value="no_show" disabled={!expectedItems.length}>
                  {t('Незаезд гостя')}
                </option>
              </Select>
            </label>
            {cancelReason === 'no_show' && expectedItems.length > 1 && (
              <label>
                {t('Проживание')}
                <Select
                  value={cancelItemId}
                  disabled={cancelPending}
                  onChange={(e) => {
                    setCancelPreview(undefined);
                    setCancelItemId(e.target.value);
                  }}
                >
                  {expectedItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.unitCode ?? it.accommodationTypeName}
                    </option>
                  ))}
                </Select>
              </label>
            )}
            <p>{t('Место вернётся в продажу и уйдёт в каналы.')}</p>
            {cancelReason === 'cancel' && <p>{t('Начисление за проживание сторнируется.')}</p>}
            <p data-testid={cancelReason === 'cancel' ? 'cancel-penalty' : 'no-show-penalty'}>
              {penaltyText(cancelPreview, cancelReason, props.currency, t)}
            </p>
            {cancelState.error && <Alert>{cancelState.error}</Alert>}
          </ConfirmDialog>
        </div>
      )}
    </section>
  );
}

/**
 * Правка готовой брони: заметки и источник; у брони OTA — канал и номер брони в канале (ADR-071). Бронь, которую
 * прислал Channex, номер не правит: её внешний ID — `unique_id`, по нему идут изменения из канала.
 * Ключ по текущим значениям — после сохранения поля перерисовываются.
 */
function EditForm(props: {
  number: string;
  source: string;
  notes: string | null;
  piiStorage: PiiStorage;
  channel: string | null;
  externalId: string | null;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    updateReservationAction.bind(null, props.number),
    { error: null },
  );
  const t = useT();
  const [source, setSource] = useState(state.values?.source ?? props.source);
  const channexBooking = fromChannex(props.externalId);
  return (
    <form
      key={`${props.source}|${props.notes ?? ''}|${props.externalId ?? ''}|${state.attempt ?? 0}`}
      action={action}
      className="panel"
      data-testid="edit-reservation-form"
    >
      <PanelTitle>{t('Заметки и источник')}</PanelTitle>
      <Row>
        <Field inline label={t('Источник')}>
          <Select
            name="source"
            defaultValue={state.values?.source ?? props.source}
            onChange={(e) => setSource(e.target.value)}
          >
            {SOURCES.map(([v, label]) => (
              <option key={v} value={v}>
                {t(label)}
              </option>
            ))}
          </Select>
        </Field>
        {source === 'OTA' && !channexBooking && (
          <>
            <Field inline label={t('Канал')}>
              <Select
                name="channel"
                defaultValue={state.values?.channel ?? props.channel ?? ''}
                data-testid="edit-channel"
              >
                <option value="">{t('— не указан —')}</option>
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </Field>
            <Field inline label={t('Номер брони в канале')}>
              <Input
                name="externalId"
                defaultValue={state.values?.externalId ?? props.externalId ?? ''}
                placeholder={t('как в экстранете')}
                autoComplete="off"
                data-testid="edit-external-id"
              />
            </Field>
          </>
        )}
        {channexBooking && (
          <span className="hint" data-testid="channex-booking-id">
            {t('из канала: {id}', { id: props.externalId ?? '' })}
          </span>
        )}
        <Textarea
          name="notes"
          rows={2}
          placeholder={
            props.piiStorage === 'real'
              ? t('Заметки')
              : t('Заметки — без имён и телефонов гостя: почта и телефоны маскируются')
          }
          defaultValue={state.values?.notes ?? props.notes ?? ''}
          className="inp--grow"
        />
        <Button type="submit" disabled={pending}>
          {t('Сохранить')}
        </Button>
      </Row>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

/**
 * Заселить, выселить, продлить, незаезд. Суммы до подтверждения (срез 7.3, Д5) приходят с сервера
 * предпросмотром — тем же кодом, что потом пишет начисление; здесь только слова и окна.
 */
function StayButtons(props: {
  number: string;
  currency: string;
  item: {
    id: string;
    status: string;
    accommodationTypeName: string;
    departureDate: string;
    unitCode: string | null;
    unitHousekeepingStatus?: 'DIRTY' | 'CLEAN' | 'INSPECTED' | null;
    ratePlanCode: string | null;
    debtMinor: string | null;
  };
  ratePlans: RatePlanOption[];
  onCancel: (itemId: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const { state, run: command, pending } = useCommand<ActionResult>({ error: null });
  const { ask, dialog } = useConfirm();
  const { toast } = useToast();
  // Б8: у проживания без тарифа цену новой ночи взять не из чего — тариф надо выбрать. Администратор выбирает только
  // тариф со штрафом (Q-201), и выбранный записывается в бронь; нет таких тарифов — продлевают владелец и управляющий
  const [extendPlan, setExtendPlan] = useState('');
  const needsPlan = !props.item.ratePlanCode;
  const mayChangePlan = useMay('rates');
  const extendPlans = plansToChoose(props.ratePlans, { mayChangePlan, hasPlan: !needsPlan });
  const expected = props.item.status === 'CONFIRMED' || props.item.status === 'TENTATIVE';
  const live = expected || props.item.status === 'CHECKED_IN';

  // Продление: сумма и занятость следующей ночи известны до нажатия
  const [preview, setPreview] = useState<ExtendPreview | null | undefined>(undefined);
  const [done, setDone] = useState<string | null>(null);
  useEffect(() => {
    if (!live) return;
    let alive = true;
    setPreview(undefined);
    void extendPreviewAction(
      props.number,
      props.item.id,
      needsPlan ? extendPlan || undefined : undefined,
    ).then((p) => {
      if (alive) setPreview(p);
    });
    return () => {
      alive = false;
    };
  }, [
    props.number,
    props.item.id,
    props.item.departureDate,
    props.item.unitCode,
    needsPlan,
    extendPlan,
    live,
  ]);
  // без тарифа сервер называет и причину, и `ratePlanRequired`: администратору нужно второе — выбрать тариф
  const extendBlocked =
    !!preview && (!preview.nextNightsFree || (!!preview.problem && !preview.ratePlanRequired));
  const extendHint =
    preview === undefined
      ? t('Считаю сумму…')
      : preview === null
        ? t('Сумма не загрузилась — цена появится на счёте после продления')
        : !preview.nextNightsFree
          ? preview.unitCode
            ? t('Номер {unit} занят {date} — сначала переселите', {
                unit: preview.unitCode,
                date: dd(props.item.departureDate, locale),
              })
            : t('Номер занят {date} — сначала переселите', { date: dd(props.item.departureDate, locale) })
          : preview.ratePlanRequired
            ? extendPlans.length > 0
              ? t('выберите тариф для новой ночи')
              : t('У брони нет тарифа, а тарифа со штрафом за отмену нет: продлевают владелец или управляющий.')
            : preview.problem
              ? preview.problem
              : `${t('до {date}', { date: dd(preview.departureDate, locale) })}${
                  preview.addedMinor
                    ? t(', +{sum} на счёт', { sum: formatMoney(preview.addedMinor, props.currency) })
                    : ''
                }`;
  const extend = async () => {
    const summary = await previewAction(props.number, props.item.id, {
      action: 'extend',
      nights: '1',
      ...(extendPlan ? { ratePlanCode: extendPlan } : {}),
    });
    if (
      !(await ask({
        title: t('Продлить на ночь — {category}?', { category: props.item.accommodationTypeName }),
        body: previewLine(summary, t, locale),
        confirmLabel: t('Продлить'),
      }))
    )
      return;
    return command(async () => {
      const p = preview;
      const r = await extendStayAction(
        props.number,
        props.item.id,
        1,
        needsPlan ? extendPlan : undefined,
      );
      if (!r.error && p)
        setDone(
          `${t('Проживание продлено до {date}', { date: dd(p.departureDate, locale) })}${
            p.addedMinor ? t(', +{sum} на счёт', { sum: formatMoney(p.addedMinor, props.currency) }) : ''
          }`,
        );
      return r;
    });
  };

  // Выселение с долгом (T3): первое нажатие показывает сумму, второе — с подтверждением
  const [debt, setDebt] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });
  const checkOut = async () => {
    if (
      !(await ask({
        title: t('Выселить из {unit}?', { unit: props.item.unitCode ?? '' }),
        body: t('После подтверждения проживание завершится. Если есть долг, его покажем отдельно до выселения.'),
        confirmLabel: t('Выселить'),
        tone: 'primary',
      }))
    )
      return;
    return command(async () => {
      const r = await stayAction(props.number, props.item.id, 'check-out');
      if (r.error && r.error.includes('долг')) { // kk-allow: сверка с текстом отказа API, он не переводится
        setDebt({ open: true, message: r.error });
        return { error: null };
      }
      // §8 «сделал — и что?»: карточка перерисовывается молча, уведомление называет итог и ячейку
      if (!r.error)
        toast({
          text: t('Гость выселен, {unit}', { unit: props.item.unitCode ?? '—' }),
          tone: 'success',
        });
      return r;
    });
  };

  return (
    <div className="panel">
      {dialog}
      <PanelTitle>
        {props.item.accommodationTypeName} —{' '}
        {props.item.unitCode ? t('номер {unit}', { unit: props.item.unitCode }) : t('номер не назначен')}
      </PanelTitle>
      <Row>
        {expected && (
          <Button
            type="button"
            data-testid={`check-in-${props.item.id}`}
            data-quick-action={`check-in:${props.item.id}`}
            onClick={async () => {
              // Q-156 (ADR-068): в непроверенную ячейку заселить можно, но стойка предупреждает и ждёт подтверждения
              const hk = props.item.unitHousekeepingStatus;
              if (hk && hk !== 'INSPECTED') {
                const ok = await ask({
                  title: t('Номер {unit} ещё не проверен. Заселить?', { unit: props.item.unitCode ?? '' }),
                  body: t('Сейчас {state}. Гость заезжает в проверенный номер; заселение не запрещено, но нужно ваше подтверждение.', {
                    state: t(HOUSEKEEPING_RU[hk]),
                  }),
                  confirmLabel: t('Заселить всё равно'),
                  // заселение — не отмена и не долг: тон основной, а не тревоги (DESIGN.md §9)
                  tone: 'primary',
                });
                if (!ok) return;
              } else if (
                !(await ask({
                  title: t('Заселить в {unit}?', { unit: props.item.unitCode ?? '' }),
                  body: t('Бронь {number}. После подтверждения статус изменится на «Заселён».', { number: props.number }),
                  confirmLabel: t('Заселить'),
                  tone: 'primary',
                }))
              )
                return;
              void command(async () => {
                const r = await stayAction(props.number, props.item.id, 'check-in');
                if (!r.error)
                  toast({ text: t('Гость заселён, {unit}', { unit: props.item.unitCode ?? '—' }), tone: 'success' });
                return r;
              });
            }}
            disabled={pending || !props.item.unitCode}
            title={props.item.unitCode ? '' : t('Сначала назначьте номер')}
          >
            {t('Заселить')}
          </Button>
        )}
        {props.item.status === 'CHECKED_IN' && (
          <Button
            type="button"
            data-testid={`check-out-${props.item.id}`}
            data-quick-action={`check-out:${props.item.id}`}
            disabled={pending}
            onClick={checkOut}
          >
            {t('Выселить')}
          </Button>
        )}
        {live && needsPlan && extendPlans.length > 0 && (
          <Select
            aria-label={t('Тариф для продления')}
            data-quick-action={`extend-plan:${props.item.id}`}
            value={extendPlan}
            onChange={(e) => setExtendPlan(e.target.value)}
          >
            <option value="" disabled>
              {t('— тариф для новой ночи —')}
            </option>
            {extendPlans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
        {live && (
          <Button
            type="button"
            tone="info"
            data-testid={`extend-${props.item.id}`}
            data-quick-action={`extend:${props.item.id}`}
            disabled={pending || extendBlocked || (needsPlan && !extendPlan)}
            onClick={extend}
            title={
              !needsPlan
                ? t('Выезд на сутки позже, цена по календарю')
                : extendPlans.length > 0
                  ? t('У проживания нет тарифа: выберите тариф для новой ночи')
                  : t('У проживания нет тарифа: продлевают владелец или управляющий')
            }
          >
            {t('Продлить на ночь')}
          </Button>
        )}
        {live && (
          <span className="hint" data-testid={`hint-extend-${props.item.id}`}>
            {extendHint}
          </span>
        )}
        {expected && (
          <Button
            type="button"
            tone="warning"
            data-testid={`cancel-stay-${props.item.id}`}
            disabled={pending}
            onClick={() => props.onCancel(props.item.id)}
          >
            {t('Отменить бронь')}
          </Button>
        )}
      </Row>
      {done && (
        <Alert tone="success" data-testid={`done-extend-${props.item.id}`}>
          {done}
        </Alert>
      )}
      {state.error && <Alert>{state.error}</Alert>}
      <ConfirmDialog
        open={debt.open}
        title={t('Выселить с долгом?')}
        confirmLabel={t('Выселить с долгом')}
        cancelLabel={t('Оставить')}
        pending={pending}
        onCancel={() => setDebt({ open: false, message: '' })}
        onConfirm={async () => {
          await command(() => stayAction(props.number, props.item.id, 'check-out', true));
          setDebt({ open: false, message: '' });
        }}
      >
        <p data-testid="debt-amount">
          {props.item.debtMinor && BigInt(props.item.debtMinor) > 0n
            ? t('Долг {sum} останется на счёте', { sum: formatMoney(props.item.debtMinor, props.currency) })
            : t('Долг останется на счёте')}
        </p>
        <p className="hint">{debt.message}</p>
      </ConfirmDialog>
    </div>
  );
}

/**
 * Назначить или переселить. Ячейка своей категории — сразу; чужой — окно с новой суммой на весь
 * срок (срез 7.3, Д5): сумму считает сервер, форма отправляется только после «Переселить и пересчитать».
 */
function AssignForm(props: {
  number: string;
  currency: string;
  arrivalDate: string;
  ratePlans: RatePlanOption[];
  item: {
    id: string;
    accommodationTypeCode: string;
    accommodationTypeName: string;
    unitCode: string | null;
    ratePlanCode: string | null;
    availableGroups: Array<{ code: string; name: string; units: string[] }>;
  };
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    assignUnitAction.bind(null, props.number, props.item.id),
    { error: null },
  );
  const t = useT();
  const locale = useLocale();
  // другой тариф при смене категории — выбор цены: владелец и управляющий (Q-200); проживанию без тарифа администратор
  // назначает тариф со штрафом (Q-201)
  const mayChangePlan = useMay('rates');
  const movePlans = plansToChoose(props.ratePlans, {
    mayChangePlan,
    hasPlan: !!props.item.ratePlanCode,
  });
  const formRef = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const [move, setMove] = useState<{
    unitCode: string;
    groupName: string;
    preview: MovePreview | null | undefined;
  } | null>(null);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    if (confirmed.current) {
      confirmed.current = false;
      return;
    }
    const fd = new FormData(e.currentTarget);
    const unitCode = String(fd.get('unitCode') ?? '');
    const ratePlanCode = String(fd.get('ratePlanCode') ?? '') || undefined;
    const group = props.item.availableGroups.find((g) => g.units.includes(unitCode));
    // своя категория: цена не меняется, окно не нужно
    if (!unitCode || !group || group.code === props.item.accommodationTypeCode) return;
    e.preventDefault();
    setMove({ unitCode, groupName: group.name, preview: undefined });
    void movePreviewAction(props.number, props.item.id, unitCode, ratePlanCode).then((p) =>
      setMove((m) => (m && m.unitCode === unitCode ? { ...m, preview: p } : m)),
    );
  };
  const confirmMove = () => {
    confirmed.current = true;
    setMove(null);
    formRef.current?.requestSubmit();
  };
  const lower = (s: string) => s.charAt(0).toLocaleLowerCase() + s.slice(1);
  const moveText = !move
    ? ''
    : move.preview === undefined
      ? t('Считаю новую сумму…')
      : move.preview === null
        ? t('Сумма не загрузилась — цена пересчитается при переселении')
        : move.preview.ratePlanRequired
          ? t('Выберите тариф при смене категории: без него цену не посчитать')
          : move.preview.newMinor === null
            ? (move.preview.problem ?? t('Сумма не посчитана — цена пересчитается при переселении'))
            : move.preview.problem
              ? move.preview.problem
              : t('Новая сумма за {nights} {sum} (было {before})', {
                  nights: countLabel(locale, t, move.preview.nights, NIGHTS),
                  sum: formatMoney(move.preview.newMinor, props.currency),
                  before: formatMoney(move.preview.currentMinor, props.currency),
                });
  return (
    <form
      key={`${props.item.unitCode ?? '-'}-${props.arrivalDate}-${state.attempt ?? 0}`}
      ref={formRef}
      action={action}
      onSubmit={onSubmit}
      className="panel"
      data-testid="assign-form"
    >
      <PanelTitle>
        {props.item.unitCode ? t('Переселить из {unit}', { unit: props.item.unitCode }) : t('Назначить номер')} —{' '}
        {props.item.accommodationTypeName}
      </PanelTitle>
      <Row>
        <Select
          name="unitCode"
          aria-label={t('Свободный номер')}
          data-testid={`assign-unit-${props.item.id}`}
          data-quick-action={`move:${props.item.id}`}
          required
          defaultValue={state.values?.unitCode ?? ''}
        >
          <option value="" disabled>
            {t('— свободный номер —')}
          </option>
          {props.item.availableGroups.map((g) => (
            <optgroup
              key={g.code}
              label={
                g.code === props.item.accommodationTypeCode
                  ? g.name
                  : t('{category} — с пересчётом цены', { category: g.name })
              }
            >
              {g.units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </optgroup>
          ))}
        </Select>
        {movePlans.length > 0 && (
          <Field label={t('Тариф при смене категории')}>
            <Select name="ratePlanCode" defaultValue={state.values?.ratePlanCode ?? ''}>
              <option value="">{t('Тариф проживания')}</option>
              {movePlans.map((plan) => (
                <option key={plan.code} value={plan.code}>
                  {plan.name} ({plan.currency})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field inline label={t('с даты')}>
          <DateInput name="fromDate" defaultValue={state.values?.fromDate ?? props.arrivalDate} />
        </Field>
        <Button type="submit" disabled={pending}>
          {props.item.unitCode ? t('Переселить') : t('Назначить')}
        </Button>
      </Row>
      <div className="hint">
        {t('Номер другой категории пересчитает цену по её календарю; такое переселение возможно только на всё проживание целиком — сумму покажем до подтверждения.')}
      </div>
      {state.error && <Alert>{state.error}</Alert>}
      <ConfirmDialog
        open={!!move}
        title={
          move
            ? t('Переселить в {category} {unit}?', {
                category: lower(move.preview?.toCategory?.name ?? move.groupName),
                unit: move.unitCode,
              })
            : ''
        }
        confirmLabel={t('Переселить и пересчитать')}
        tone="info"
        pending={pending}
        onCancel={() => setMove(null)}
        onConfirm={confirmMove}
      >
        <p>{t('Счёт будет пересчитан по тарифу новой категории на весь срок проживания.')}</p>
        <p data-testid="move-amount">{moveText}</p>
      </ConfirmDialog>
    </form>
  );
}

function StayGuestsForm({
  number,
  item,
}: {
  number: string;
  item: { id: string; unitCode: string | null; adults: number; children: number };
}) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionResult, FormData>(
    updateStayGuestsAction.bind(null, number, item.id),
    { error: null },
  );
  return (
    <form
      action={action}
      className="panel stay-guests-form"
      data-testid={`guests-form-${item.id}`}
      key={`${item.adults}/${item.children}/${state.attempt ?? 0}`}
    >
      <PanelTitle>{item.unitCode ? t('Гости номера {unit}', { unit: item.unitCode }) : t('Гости')}</PanelTitle>
      <Row>
        <Field label={t('Взрослых')}>
          <Input
            name="adults"
            type="number"
            min="1"
            step="1"
            required
            defaultValue={state.values?.adults ?? item.adults}
          />
        </Field>
        <Field label={t('Детей')}>
          <Input
            name="children"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={state.values?.children ?? item.children}
          />
        </Field>
        <Button type="submit" disabled={pending}>
          {t('Сохранить')}
        </Button>
      </Row>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

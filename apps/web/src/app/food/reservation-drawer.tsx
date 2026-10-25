'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Button, Field, Select, StatusBadge } from '../../components/ui';
import { useConfirm } from '../../components/use-confirm';
import { countLabel, msg } from '../../i18n';
import { useLocale, useT } from '../../i18n/locale-provider';
import { foodStatusActions } from '../../lib/food-data';
import type { FoodStatus, FoodWorkspace, RestaurantReservation } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { visitRange } from '../../lib/human-period';
import { GuestMarks } from './guest-marks';
import { mutateFoodReservation } from './actions';
import { ReservationForm } from './reservation-form';
import { formatPhone } from '../../lib/phone';
import { foodReservationOrigin } from '../../lib/food-reservation-origin';
export type ReservationDraft =
  { kind: 'create'; walkIn: boolean; tableId?: string; time?: string } | { kind: 'view'; id: string };
export function ReservationDrawer({
  data,
  draft,
  close,
  onCreated,
}: {
  data: FoodWorkspace;
  draft: ReservationDraft;
  close: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [saved, setSaved] = useState<RestaurantReservation | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [tableId, setTableId] = useState('');
  const { ask, dialog } = useConfirm();
  const listed = draft.kind === 'view' ? data.reservations.find((r) => r.id === draft.id) : null;
  const r =
    listed && (!saved || Date.parse(listed.updatedAt) >= Date.parse(saved.updatedAt))
      ? listed
      : saved;
  const write = data.canDesk && !data.readOnly;
  const mutable = r && ['BOOKED', 'CONFIRMED', 'SEATED'].includes(r.status);
  async function command(kind: 'status' | 'assign' | 'unassign', status?: FoodStatus) {
    if (!r) return;
    if (kind === 'status' && (status === 'CANCELLED' || status === 'NO_SHOW')) {
      const who = [r.customer.firstName, r.customer.lastName].filter(Boolean).join(' ');
      const ok = await ask({
        title: status === 'CANCELLED' ? t('Отменить бронь: {name}?', { name: who }) : t('Отметить «Не пришли»: {name}?', { name: who }),
        body: t('Стол освободится для других гостей. Вернуть бронь будет нельзя.'),
        confirmLabel: status === 'CANCELLED' ? t('Отменить бронь') : t('Не пришли'),
        tone: 'danger',
      });
      if (!ok) return;
    }
    const token = { expectedStatus: r.status, expectedUpdatedAt: r.updatedAt };
    setError('');
    start(async () => {
      const result = await mutateFoodReservation(
        data.scopeKey,
        kind === 'status'
          ? { kind, id: r.id, body: { ...token, status: status! } }
          : kind === 'assign'
            ? { kind, id: r.id, body: { ...token, tableId } }
            : { kind, id: r.id, body: token },
      );
      if (result.error) {
        setError(result.error);
        if (result.stale) {
          setSaved(null);
          router.refresh();
        }
      } else if (result.reservation) {
        setSaved(result.reservation);
        setTableId('');
        router.refresh();
      }
    });
  }
  return (
    <>
      <Overlay
        open
        drawer
        trapFocus
        title={
          r
            ? t('Бронирование')
            : draft.kind === 'create' && draft.walkIn
              ? t('Посадить без брони')
              : t('Новая бронь')
        }
        onClose={close}
        size={r ? 'md' : 'xl'}
        className="food-drawer"
      >
        {r ? (
          <div className="food-detail" aria-busy={pending}>
            <div className="food-section-heading">
              <h3>{[r.customer.firstName, r.customer.lastName].filter(Boolean).join(' ')}</h3>
              <GuestMarks
                  customer={r.customer}
                  day={localInput(r.startsAt, data.timezone).slice(0, 10)}
                />
                <StatusBadge kind="food" value={r.status} />
            </div>
            <dl>
              <dt>{t('Телефон')}</dt>
              <dd>{r.customer.phone ? formatPhone(r.customer.phone) : t('Не указан')}</dd>
              <dt>{t('Дата / время')}</dt>
              <dd>
                {visitRange(r.startsAt, r.endsAt, data.timezone, locale)}
              </dd>
              <dt>{t('Период')}</dt>
              <dd>{r.servicePeriod.name}</dd>
              <dt>{t('Гостей')}</dt>
              <dd>{r.partySize}</dd>
              <dt>{t('Стол / зал')}</dt>
              <dd>{r.table ? `${r.table.areaName}, ${r.table.name}` : t('Без стола')}</dd>
              <dt>{t('Источник')}</dt>
              <dd>
                {/* «Принял: имя» собирает общий помощник шаблоном, поэтому эта ветка переводится здесь */}
                {r.source !== 'WALK_IN' && r.employee
                  ? t('Принял: {name}', { name: r.employee.name })
                  : foodReservationOrigin(r, t)}
              </dd>
              <dt>{t('Заметка')}</dt>
              <dd>{r.notes || t('Нет заметки')}</dd>
            </dl>
            {error && <Alert tone="warning">{error}</Alert>}
            {write && mutable && (
              <>
                {editing ? (
                  <>
                    <ReservationForm
                      key={r.updatedAt}
                      data={data}
                      reservation={r}
                      created={(next) => {
                        setSaved(next);
                        setEditing(false);
                      }}
                      onStale={() => {
                        setSaved(null);
                        setEditing(false);
                        setError(t('Бронирование уже изменилось. Данные обновлены.'));
                      }}
                    />
                    <Button tone="ghost" onClick={() => setEditing(false)}>
                      {t('Назад')}
                    </Button>
                  </>
                ) : (
                  <Button disabled={pending} tone="secondary" onClick={() => setEditing(true)}>
                    {t('Изменить бронь')}
                  </Button>
                )}
                <Field label={r.table ? t('Пересадить на другой стол') : t('Назначить стол')}>
                  <Select
                    disabled={editing || pending}
                    value={tableId}
                    onChange={(e) => setTableId(e.target.value)}
                  >
                    <option value="">{t('Выберите стол')}</option>
                    {data.tables
                      .filter(
                        (tb) => tb.active && data.areas.some((a) => a.id === tb.areaId && a.active),
                      )
                      .map((tb) => (
                        <option
                          key={tb.id}
                          value={tb.id}
                          disabled={tb.capacity < r.partySize || tb.id === r.table?.id}
                        >
                          {data.areas.find((a) => a.id === tb.areaId)?.name}, {tb.name},{' '}
                          {countLabel(locale, t, tb.capacity, [msg('место@@стол'), 'места', msg('мест@@стол')])}{/* kk-allow: форма склонения */}
                        </option>
                      ))}
                  </Select>
                </Field>
                <div className="food-actions">
                  <Button
                    disabled={editing || pending || !tableId}
                    tone="secondary"
                    onClick={() => command('assign')}
                  >
                    {r.table ? t('Пересадить') : t('Назначить стол')}
                  </Button>
                  {r.table && r.status !== 'SEATED' && (
                    <Button
                      disabled={editing || pending}
                      tone="ghost"
                      onClick={() => command('unassign')}
                    >
                      {t('Снять стол')}
                    </Button>
                  )}
                </div>
                <div className="food-actions">
                  {r.nextStatuses.map((status) => (
                    <Button
                      key={status}
                      tone={
                        status === 'CANCELLED' || status === 'NO_SHOW' ? 'secondary' : 'primary'
                      }
                      disabled={editing || pending || (status === 'SEATED' && !r.table)}
                      onClick={() => command('status', status)}
                    >
                      {t(foodStatusActions[status])}
                    </Button>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : draft.kind === 'create' ? (
          <ReservationForm
            data={data}
            walkIn={draft.walkIn}
            tableId={draft.tableId ?? ''}
            time={draft.time ?? data.time}
            created={(next) => {
              setSaved(next);
              onCreated(next.id);
            }}
            onStale={() => {}}
          />
        ) : (
          <Alert tone="warning">{t('Бронирование недоступно. Обновите список.')}</Alert>
        )}
      </Overlay>
      {dialog}
    </>
  );
}

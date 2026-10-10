'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
import { Alert, Badge, Button, Field, Select } from '../../components/ui';
import { foodStatusActions } from '../../lib/food-data';
import type { FoodStatus, FoodWorkspace, RestaurantReservation } from '../../lib/food-types';
import { localInput } from '../beauty/time';
import { mutateFoodReservation } from './actions';
import { ReservationForm } from './reservation-form';
import { foodStatus } from '../../lib/status/food';
export type ReservationDraft =
  { kind: 'create'; walkIn: boolean; tableId?: string } | { kind: 'view'; id: string };
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
  const router = useRouter();
  const [saved, setSaved] = useState<RestaurantReservation | null>(null);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [tableId, setTableId] = useState('');
  const listed = draft.kind === 'view' ? data.reservations.find((r) => r.id === draft.id) : null;
  const r =
    listed && (!saved || Date.parse(listed.updatedAt) >= Date.parse(saved.updatedAt))
      ? listed
      : saved;
  const write = data.canDesk && !data.readOnly;
  const mutable = r && ['BOOKED', 'CONFIRMED', 'SEATED'].includes(r.status);
  function command(kind: 'status' | 'assign' | 'unassign', status?: FoodStatus) {
    if (!r) return;
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
    <Overlay
      open
      drawer
      trapFocus
      title={
        r
          ? 'Бронирование'
          : draft.kind === 'create' && draft.walkIn
            ? 'Посадить без брони'
            : 'Новая бронь'
      }
      onClose={close}
      className="food-drawer"
    >
      {r ? (
        <div className="food-detail" aria-busy={pending}>
          <div className="food-section-heading">
            <h3>{[r.customer.firstName, r.customer.lastName].filter(Boolean).join(' ')}</h3>
            <Badge tone={r.status === 'SEATED' ? 'ok' : 'neutral'}>
              {foodStatus[r.status].label}
            </Badge>
          </div>
          <dl>
            <dt>Телефон</dt>
            <dd>{r.customer.phone ?? 'Не указан'}</dd>
            <dt>Дата / время</dt>
            <dd>
              {localInput(r.startsAt, data.timezone).replace('T', ', ')}–
              {localInput(r.endsAt, data.timezone).slice(11)}
            </dd>
            <dt>Период</dt>
            <dd>{r.servicePeriod.name}</dd>
            <dt>Гостей</dt>
            <dd>{r.partySize}</dd>
            <dt>Стол / зал</dt>
            <dd>{r.table ? `${r.table.areaName}, ${r.table.name}` : 'Без стола'}</dd>
            <dt>Источник</dt>
            <dd>{r.source === 'WALK_IN' ? 'Без брони' : 'Сотрудник'}</dd>
            <dt>Заметка</dt>
            <dd>{r.notes || 'Нет заметки'}</dd>
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
                      setError('Бронирование уже изменилось. Данные обновлены.');
                    }}
                  />
                  <Button tone="ghost" onClick={() => setEditing(false)}>
                    Назад
                  </Button>
                </>
              ) : (
                <Button disabled={pending} tone="secondary" onClick={() => setEditing(true)}>
                  Изменить бронь
                </Button>
              )}
              <Field label={r.table ? 'Пересадить на другой стол' : 'Назначить стол'}>
                <Select
                  disabled={editing || pending}
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                >
                  <option value="">Выберите стол</option>
                  {data.tables
                    .filter(
                      (t) => t.active && data.areas.some((a) => a.id === t.areaId && a.active),
                    )
                    .map((t) => (
                      <option
                        key={t.id}
                        value={t.id}
                        disabled={t.capacity < r.partySize || t.id === r.table?.id}
                      >
                        {data.areas.find((a) => a.id === t.areaId)?.name}, {t.name}, {t.capacity}{' '}
                        мест
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
                  {r.table ? 'Пересадить' : 'Назначить стол'}
                </Button>
                {r.table && r.status !== 'SEATED' && (
                  <Button
                    disabled={editing || pending}
                    tone="ghost"
                    onClick={() => command('unassign')}
                  >
                    Снять стол
                  </Button>
                )}
              </div>
              <div className="food-actions">
                {r.nextStatuses.map((status) => (
                  <Button
                    key={status}
                    tone={status === 'CANCELLED' || status === 'NO_SHOW' ? 'secondary' : 'primary'}
                    disabled={editing || pending || (status === 'SEATED' && !r.table)}
                    onClick={() => command('status', status)}
                  >
                    {foodStatusActions[status]}
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
          created={(next) => {
            setSaved(next);
            onCreated(next.id);
          }}
          onStale={() => {}}
        />
      ) : (
        <Alert tone="warning">Бронирование недоступно. Обновите список.</Alert>
      )}
    </Overlay>
  );
}

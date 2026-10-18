'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  EmployeeProfile,
  EmployeeTransitionGuard,
} from '../../../components/employee-workspace/workspace';
import { Overlay } from '../../../components/overlay';
import { Alert, Badge, Button } from '../../../components/ui';
import { pluralRu } from '../../../lib/plural';
import type {
  BeautyEmployeeRow,
  BeautyServiceRow,
  BeautySchedule,
  BeautyDay,
} from '../../../lib/api';
import { clearPendingCreation, pendingCreation } from '../creation-key';
import { beautyMasterDayStatus } from '../../../lib/beauty-master-day-status';

/**
 * Мастера салона (DATA_MODEL §19, срез B3). Мастер это сотрудник сети, не филиала: филиалы ведёт отдельная
 * связь, и новый мастер сразу начинает работать в выбранном филиале, иначе он нигде не работает.
 * Умения приходят одним списком, чтобы снятая галочка снималась, а не копилась.
 */
type Editing = { mode: 'new' } | null;

export const employeeProfileHref = (id: string) =>
  `/employees/${encodeURIComponent(id)}/profile`;

/** Инициалы для кружка карточки: первые буквы первых двух слов имени */
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export function MastersBoard({
  items,
  services,
  canEdit,
  canCreate = canEdit ?? false,
  today,
  locations,
  scopeKey = '',
  initialEmployeeId = '',
  businessName,
  locationName,
  unavailable = false,
  scheduleAvailable = true,
}: {
  items: BeautyEmployeeRow[];
  services: BeautyServiceRow[];
  canEdit?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canManagePrices?: boolean;
  today: BeautyDay;
  locations: BeautySchedule['locations'];
  scopeKey?: string;
  initialEmployeeId?: string;
  businessName?: string;
  locationName?: string;
  unavailable?: boolean;
  scheduleAvailable?: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Editing>(null);
  const [epoch, setEpoch] = useState(0);
  const [notice, setNotice] = useState('');
  const guard = useRef<(action: () => void) => void>((action) => action());
  const registerGuard = useCallback((request: (action: () => void) => void) => {
    guard.current = request;
  }, []);
  const requested = useRef(false);
  const initialRequest = useRef(initialEmployeeId);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  useEffect(() => {
    if (requested.current) return;
    requested.current = true;
    const id = initialRequest.current || pendingCreation(scopeKey, 'employee');
    const row = itemsRef.current.find((item) => item.id === id);
    if (row) {
      // A legacy URL or recovered create can open only an authorized row from this scope.
      clearPendingCreation(scopeKey, 'employee', row.id);
      router.replace(employeeProfileHref(row.id), { scroll: false });
    }
    return () => {
      requested.current = false;
    };
  }, [router, scopeKey]);
  const savedProfile = (row: BeautyEmployeeRow) => {
    setEditing(null);
    setNotice('Мастер создан');
    clearPendingCreation(scopeKey, 'employee', row.id);
    router.replace(employeeProfileHref(row.id), { scroll: false });
  };
  const close = () => {
    setEditing(null);
  };
  const names = new Map(services.map((s) => [s.id, s.name]));
  return (
    <>
      {unavailable && <Alert>Мастер недоступен в текущем контексте.</Alert>}
      {notice && <p role="status">{notice}</p>}
      <div className="beauty-bar">
        <p role="status">
          {items.length === 0
            ? 'Добавьте первого мастера'
            : `Мастеров: ${items.length}, из них в архиве ${items.filter((i) => !i.active).length}`}
        </p>
        {canCreate && (
          <Button
            type="button"
            onClick={() =>
              guard.current(() => {
                setEditing({ mode: 'new' });
                setNotice('');
              })
            }
          >
            Добавить мастера
          </Button>
        )}
      </div>
      <ul className="beauty-master-cards">
        {items.map((row) => {
          const dayStatus = beautyMasterDayStatus(scheduleAvailable ? today : null, row.id);
          const appointments = today.appointments.filter(
            (a) => a.employeeId === row.id && a.status !== 'CANCELLED',
          ).length;
          const categories = [
            ...new Set(
              row.serviceIds
                .map((id) => services.find((s) => s.id === id)?.category)
                .filter((c): c is string => Boolean(c)),
            ),
          ];
          return (
            <li key={row.id} className="beauty-master-card">
              <div className="beauty-master-card__head">
                <span className="beauty-card-avatar" aria-hidden="true">
                  {initials(row.name)}
                </span>
                <div className="beauty-master-card__name">
                  <b>{row.name}</b>
                  <span className="beauty-note">
                    {categories.join(', ') || 'Специализация не указана'}
                  </span>
                </div>
              </div>
              <div className="beauty-master-card__state">
                <Badge tone={row.active ? 'ok' : undefined}>
                  {row.active ? 'Активен' : 'В архиве'}
                </Badge>
                {row.active &&
                  (dayStatus.state === 'UNAVAILABLE' ? (
                    <Badge>График недоступен</Badge>
                  ) : dayStatus.state === 'ON_SHIFT' ? (
                    <Badge tone="ok">На смене</Badge>
                  ) : (
                    <Badge>Выходной</Badge>
                  ))}
                {row.active && (
                  <span className="beauty-note">
                    {pluralRu(appointments, ['запись', 'записи', 'записей'])} сегодня
                  </span>
                )}
              </div>
              {row.active && dayStatus.state !== 'UNAVAILABLE' && (
                <p className="beauty-note">
                  {dayStatus.state === 'ON_SHIFT'
                    ? `Сегодня ${dayStatus.hours}`
                    : 'Сегодня не работает'}
                </p>
              )}
              <p className="beauty-master-card__skills">
                {row.serviceIds.length === 0
                  ? 'Услуги не выбраны'
                  : row.serviceIds
                      .map((id) => names.get(id))
                      .filter(Boolean)
                      .join(', ')}
              </p>
              <p className="beauty-note">
                {locations
                  .filter((l) => row.locationIds.includes(l.id))
                  .map((l) => l.name)
                  .join(', ') || 'Филиалы не назначены'}
              </p>
              <Link className="btn btn--secondary btn--sm" href={employeeProfileHref(row.id)}>
                Открыть
              </Link>
            </li>
          );
        })}
      </ul>
      <Overlay
        open={editing !== null}
        onClose={() => guard.current(close)}
        title="Новый мастер"
        drawer
        size="md"
        trapFocus
      >
        <EmployeeTransitionGuard
          register={registerGuard}
          discard={() => setEpoch((value) => value + 1)}
        >
          <div key={`${scopeKey}:new:${epoch}`}>
            {editing && (
              <>
                <section aria-label="Бизнес и филиал" className="employee-workspace-heading">
                  <p>Бизнес: {businessName ?? 'Название недоступно'}</p>
                  <p>
                    Филиал:{' '}
                    {locationName ??
                      locations.find((item) => item.id === scopeKey)?.name ??
                      'Название недоступно'}
                  </p>
                </section>
                <EmployeeProfile
                  row={null}
                  onCancelCreate={() => guard.current(close)}
                  scopeKey={scopeKey}
                  canEdit={canCreate}
                  onSaved={savedProfile}
                />
              </>
            )}
          </div>
        </EmployeeTransitionGuard>
      </Overlay>
    </>
  );
}

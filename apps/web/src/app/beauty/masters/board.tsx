'use client';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  EmployeeProfile,
  EmployeeTransitionGuard,
} from '../../../components/employee-workspace/workspace';
import { Overlay } from '../../../components/overlay';
import { Tabs } from '../../../components/tabs';
import { Alert, Badge, Button, Select } from '../../../components/ui';
import { PERSONNEL_KINDS, PERSONNEL_KIND_LABELS, personnelTabs } from '@pms/domain';
import { assignBeautyPersonnelKind } from '../actions';
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

export const employeeProfileHref = (id: string) => `/employees/${encodeURIComponent(id)}/profile`;

type Kind = NonNullable<BeautyEmployeeRow['personnelKind']>;

/**
 * Назначение строки (DATA_MODEL.md, решения 18.10 и 20.10.2026): руководитель выбирает «специалист», «другой
 * сотрудник» или «оба», остальные видят только метку. Право считает сервер (`canAssignPersonnelKind`), PATCH
 * проверяет его ещё раз. Конфликт версии: сообщение и свежий список с сервера.
 */
function PersonnelKindPicker({ row, canAssign }: { row: BeautyEmployeeRow; canAssign: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const kind = row.personnelKind ?? null;
  if (!canAssign || !row.profileRevision)
    return <Badge>{kind ? PERSONNEL_KIND_LABELS[kind] : 'Не назначено'}</Badge>;
  return (
    <div className="beauty-master-card__kind">
      <Select
        aria-label={`Назначение: ${row.name}`}
        value={kind ?? ''}
        disabled={pending}
        aria-busy={pending || undefined}
        onChange={(event) => {
          const next = event.target.value as Kind;
          setError('');
          start(async () => {
            const result = await assignBeautyPersonnelKind(row.id, next, row.profileRevision!);
            if (result.error) setError(result.error);
            router.refresh();
          });
        }}
      >
        {kind === null && (
          <option value="" disabled>
            Не назначено
          </option>
        )}
        {PERSONNEL_KINDS.map((value) => (
          <option key={value} value={value}>
            {PERSONNEL_KIND_LABELS[value]}
          </option>
        ))}
      </Select>
      {pending && <span className="beauty-note">Сохраняем…</span>}
      {error && <Alert>{error}</Alert>}
    </div>
  );
}

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
  canAssignPersonnelKind = false,
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
  canAssignPersonnelKind?: boolean;
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
    setNotice('Специалист создан');
    clearPendingCreation(scopeKey, 'employee', row.id);
    router.replace(employeeProfileHref(row.id), { scroll: false });
  };
  const close = () => {
    setEditing(null);
  };
  const names = new Map(services.map((s) => [s.id, s.name]));
  // старые записи без назначения не прячутся и не угадываются: своя вкладка, пока они есть
  const tabs = personnelTabs(
    items.map((row) => ({ ...row, personnelKind: row.personnelKind ?? null })),
  );
  const card = (row: BeautyEmployeeRow) => {
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
        <PersonnelKindPicker row={row} canAssign={canAssignPersonnelKind} />
        <div className="beauty-master-card__state">
          <Badge tone={row.active ? 'ok' : undefined}>{row.active ? 'Активен' : 'В архиве'}</Badge>
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
            {dayStatus.state === 'ON_SHIFT' ? `Сегодня ${dayStatus.hours}` : 'Сегодня не работает'}
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
  };
  return (
    <>
      {unavailable && <Alert>Специалист недоступен в текущем контексте.</Alert>}
      {notice && <p role="status">{notice}</p>}
      <div className="beauty-bar">
        <p role="status">
          {items.length === 0
            ? 'Добавьте первого специалиста'
            : `В персонале: ${items.length}, из них в архиве ${items.filter((i) => !i.active).length}`}
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
            Добавить специалиста
          </Button>
        )}
      </div>
      {items.length > 0 && (
        <Tabs
          key={tabs.map((tab) => tab.key).join(' ')}
          label="Назначение в персонале"
          panels={tabs.map((tab) => ({
            id: tab.key,
            label: tab.label,
            ...(tab.key === 'unassigned' ? {} : { count: tab.count }),
            content: (
              <>
                {tab.key === 'unassigned' && (
                  <p className="beauty-note">
                    Укажите, кто это: специалист, другой сотрудник или оба. Назначение не меняет
                    услуги и права.
                  </p>
                )}
                {tab.items.length === 0 ? (
                  <p className="beauty-note">
                    {tab.key === 'specialists'
                      ? 'Специалистов пока нет. Назначьте их в строке сотрудника.'
                      : 'Других сотрудников пока нет. Назначьте их в строке сотрудника.'}
                  </p>
                ) : (
                  <ul className="beauty-master-cards">{tab.items.map((row) => card(row))}</ul>
                )}
              </>
            ),
          }))}
        />
      )}
      <Overlay
        open={editing !== null}
        onClose={() => guard.current(close)}
        title="Новый специалист"
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

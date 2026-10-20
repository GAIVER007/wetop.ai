'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { IconField } from '../../components/icon-field';
import { Overlay } from '../../components/overlay';
import { useConfirm } from '../../components/use-confirm';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Select,
  Table,
} from '../../components/ui';
import { pluralRu } from '../../lib/plural';
import { wholeTenge } from '../../lib/dashboard-format';
import type { FoodEmployee } from '../../lib/food-types';
import { mutateStaff } from './restaurant-actions';

function EmployeeDrawer({
  scopeKey,
  employee,
  close,
}: {
  scopeKey: string;
  employee: FoodEmployee | null;
  close: () => void;
}) {
  const router = useRouter();
  const { ask, dialog } = useConfirm();
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [name, setName] = useState(employee?.name ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [email, setEmail] = useState(employee?.email ?? '');
  const [status, setStatus] = useState(employee?.status ?? 'ACTIVE');
  const [expectedProfileRevision] = useState(employee?.profileRevision ?? '');
  function submit() {
    setError('');
    if (!name.trim()) {
      setError('Имя обязательно');
      return;
    }
    start(async () => {
      const body = {
        name: name.trim(),
        phone: phone.trim() ? phone.trim() : null,
        email: email.trim() ? email.trim() : null,
      };
      const result = await mutateStaff(
        scopeKey,
        employee
          ? { kind: 'edit', id: employee.id, body: { ...body, status, expectedProfileRevision } }
          : { kind: 'create', body },
      );
      if (result.error) setError(result.error);
      else {
        router.refresh();
        close();
      }
    });
  }
  return (
    <Overlay
      open
      onClose={close}
      title={employee ? 'Изменить сотрудника' : 'Новый сотрудник'}
      drawer
      className="food-drawer"
      trapFocus
    >
      <div className="food-form" data-testid="employee-drawer">
        {error && <Alert>{error}</Alert>}
        {employee && <input type="hidden" name="expectedProfileRevision" value={expectedProfileRevision} />}
        {error && employee && <><p>Ввод сохранён. Сравните актуальный профиль перед повтором.</p><Button tone="secondary" onClick={async () => {
          if (!(await ask({
            title: 'Отменить черновик профиля?',
            body: 'Несохранённые изменения будут потеряны. Вместо них загрузится актуальный профиль сотрудника.',
            confirmLabel: 'Отменить черновик и загрузить профиль',
            cancelLabel: 'Оставить черновик',
          }))) return;
          window.location.reload();
        }}>Отменить черновик и загрузить профиль</Button></>}
        <Field label="Имя и фамилия">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="food-form-row">
          <Field label="Телефон">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Почта">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
        {employee && (
          <Field label="Статус">
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="ACTIVE">Работает</option>
              <option value="ARCHIVED">В архиве</option>
            </Select>
          </Field>
        )}
        <div className="food-actions">
          <Button disabled={pending} onClick={submit}>
            Сохранить
          </Button>
          <Button tone="secondary" disabled={pending} onClick={close}>
            Отмена
          </Button>
        </div>
      </div>
      {dialog}
    </Overlay>
  );
}

/** «Сотрудники» ресторана по макету (ADR-159): смены из графика, продажи из заказов; рейтинга нет (Q-REST-2) */
export function EmployeesBoard({
  scopeKey,
  write,
  employees,
  branchName,
}: {
  scopeKey: string;
  write: boolean;
  employees: FoodEmployee[];
  branchName: string;
}) {
  const [search, setSearch] = useState('');
  const [onlyShift, setOnlyShift] = useState(false);
  const [draft, setDraft] = useState<FoodEmployee | null | 'new'>(null);
  const needle = search.trim().toLocaleLowerCase('ru');
  const list = employees.filter(
    (e) =>
      (!needle || `${e.name} ${e.phone ?? ''}`.toLocaleLowerCase('ru').includes(needle)) &&
      (!onlyShift || e.onShift),
  );
  const initials = (name: string) =>
    name
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase();
  return (
    <div className="food-workspace rest-ws" data-testid="employees-board">
      {write && (
        <div className="food-section-heading rest-actions-end">
          <Button onClick={() => setDraft('new')}>+ Добавить сотрудника</Button>
        </div>
      )}
      <div className="rest-card">
        <div className="rest-card__tools">
          <Field label={<span className="sr-only">Поиск по сотрудникам</span>}>
            <IconField icon="search">
              <Input
                type="search"
                placeholder="Поиск сотрудника"
                data-page-search
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </IconField>
          </Field>
          <Field label={<span className="sr-only">Смена</span>}>
            <Select
              value={onlyShift ? 'shift' : 'all'}
              onChange={(e) => setOnlyShift(e.target.value === 'shift')}
            >
              <option value="all">Все сотрудники</option>
              <option value="shift">На смене сейчас</option>
            </Select>
          </Field>
        </div>
        {list.length === 0 ? (
          <EmptyState
            title={employees.length ? 'Сотрудники не найдены' : 'Сотрудников пока нет'}
            actions={
              write && !employees.length ? (
                <Button onClick={() => setDraft('new')}>Добавить первого сотрудника</Button>
              ) : null
            }
          />
        ) : (
          <Table density="compact" caption="Сотрудники ресторана" captionHidden>
            <thead>
              <tr>
                {['Сотрудник', 'Телефон', 'Филиал', 'Смена сегодня', 'Статус', 'Продажи сегодня', 'Рейтинг'].map(
                  (h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ),
                )}
                <th scope="col">
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id}>
                  <td>
                    <span className="rest-person">
                      <span className="rest-avatar" aria-hidden="true">
                        {initials(e.name)}
                      </span>
                      <strong>{e.name}</strong>
                      {e.status === 'ARCHIVED' && <Badge>В архиве</Badge>}
                    </span>
                  </td>
                  <td>{e.phone ?? '—'}</td>
                  <td>{branchName}</td>
                  <td>{e.shift ?? 'Выходной'}</td>
                  <td>
                    <Badge tone={e.onShift ? 'ok' : 'neutral'}>
                      {e.onShift ? 'На смене' : 'Не на смене'}
                    </Badge>
                  </td>
                  <td>{wholeTenge(e.salesTodayMinor)}</td>
                  <td data-testid="employee-rating">
                    {e.rating?.average != null
                      ? `${String(e.rating.average).replace('.', ',')} ★, ${pluralRu(e.rating.count, ['оценка', 'оценки', 'оценок'])}`
                      : 'Оценок нет'}
                  </td>
                  <td>
                    {write && <a href={`/employees/${encodeURIComponent(e.id)}/profile`}>Карточка сотрудника</a>}
                    {write && (
                      <Button tone="ghost" size="sm" onClick={() => setDraft(e)}>
                        Изменить
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
      {draft && (
        <EmployeeDrawer
          scopeKey={scopeKey}
          employee={draft === 'new' ? null : draft}
          close={() => setDraft(null)}
        />
      )}
    </div>
  );
}

'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Overlay } from '../../components/overlay';
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
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [name, setName] = useState(employee?.name ?? '');
  const [phone, setPhone] = useState(employee?.phone ?? '');
  const [email, setEmail] = useState(employee?.email ?? '');
  const [status, setStatus] = useState(employee?.status ?? 'ACTIVE');
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
          ? { kind: 'edit', id: employee.id, body: { ...body, status } }
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
    </Overlay>
  );
}

/** «Сотрудники» ресторана по макету (ADR-159): смены из графика, продажи из заказов; рейтинга нет (Q-REST-2) */
export function EmployeesBoard({
  scopeKey,
  write,
  employees,
}: {
  scopeKey: string;
  write: boolean;
  employees: FoodEmployee[];
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
  return (
    <div className="food-workspace" data-testid="employees-board">
      <div className="food-section-heading">
        <div className="food-toolbar">
          <Field label="Поиск по сотрудникам">
            <Input
              type="search"
              data-page-search
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Field label="Смена">
            <Select
              value={onlyShift ? 'shift' : 'all'}
              onChange={(e) => setOnlyShift(e.target.value === 'shift')}
            >
              <option value="all">Все</option>
              <option value="shift">На смене сейчас</option>
            </Select>
          </Field>
        </div>
        {write && (
          <div className="food-inline-actions">
            <Button onClick={() => setDraft('new')}>+ Добавить сотрудника</Button>
          </div>
        )}
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
        <Table>
          <thead>
            <tr>
              {['Имя', 'Телефон', 'Смена сегодня', 'Статус', 'Продажи сегодня', 'Рейтинг'].map(
                (h) => (
                  <th key={h}>{h}</th>
                ),
              )}
              <th>
                <span className="sr-only">Действия</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id}>
                <td>
                  {e.name}
                  {e.status === 'ARCHIVED' && <Badge> В архиве</Badge>}
                </td>
                <td>{e.phone ?? '—'}</td>
                <td>{e.shift ?? 'Выходной'}</td>
                <td>
                  <Badge tone={e.onShift ? 'ok' : 'neutral'}>
                    {e.onShift ? 'На смене' : 'Не на смене'}
                  </Badge>
                </td>
                <td>{wholeTenge(e.salesTodayMinor)}</td>
                <td>—</td>
                <td>
                  {write && (
                    <Button tone="ghost" onClick={() => setDraft(e)}>
                      Изменить
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
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

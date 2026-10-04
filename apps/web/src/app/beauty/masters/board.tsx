'use client';
import { useActionState, useState } from 'react';
import { parseEmployeeInput } from '@pms/domain';
import { Overlay } from '../../../components/overlay';
import { Alert, Badge, Button, Field, Input, Table } from '../../../components/ui';
import type { BeautyEmployeeRow, BeautyServiceRow } from '../../../lib/api';
import { saveBeautyEmployee } from '../actions';

/**
 * Мастера салона (DATA_MODEL §19, срез B3). Мастер это сотрудник сети, не филиала: филиалы ведёт отдельная
 * связь, и новый мастер сразу начинает работать в выбранном филиале, иначе он нигде не работает.
 * Умения приходят одним списком, чтобы снятая галочка снималась, а не копилась.
 */
type Editing = { mode: 'new' } | { mode: 'edit'; row: BeautyEmployeeRow } | null;

export function MastersBoard({
  items,
  services,
  canEdit,
}: {
  items: BeautyEmployeeRow[];
  services: BeautyServiceRow[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<Editing>(null);
  const names = new Map(services.map((s) => [s.id, s.name]));
  return (
    <>
      <div className="beauty-bar">
        <p role="status">
          {items.length === 0
            ? 'Мастеров пока нет'
            : `Мастеров: ${items.length}, из них в архиве ${items.filter((i) => !i.active).length}`}
        </p>
        {canEdit && (
          <Button type="button" onClick={() => setEditing({ mode: 'new' })}>
            Добавить мастера
          </Button>
        )}
      </div>
      <Table>
        <thead>
          <tr>
            <th>Мастер</th>
            <th className="beauty-col-wide">Контакты</th>
            <th className="beauty-col-wide">Филиалов</th>
            <th>Что умеет</th>
            {canEdit && <th className="sr-only">Действия</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr key={row.id}>
              <td>
                {row.name}
                {!row.active && <Badge>В архиве</Badge>}
              </td>
              <td className="beauty-col-wide">{[row.phone, row.email].filter(Boolean).join(', ') || 'Не указаны'}</td>
              <td className="beauty-col-wide">{row.locationIds.length}</td>
              <td>
                {row.serviceIds.length === 0
                  ? 'Услуги не выбраны'
                  : row.serviceIds
                      .map((id) => names.get(id))
                      .filter(Boolean)
                      .join(', ')}
              </td>
              {canEdit && (
                <td>
                  <Button
                    type="button"
                    size="sm"
                    tone="secondary"
                    onClick={() => setEditing({ mode: 'edit', row })}
                  >
                    Изменить
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
      <Overlay
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing?.mode === 'edit' ? 'Мастер' : 'Новый мастер'}
        drawer
      >
        {editing && (
          <MasterForm
            key={editing.mode === 'edit' ? editing.row.id : 'new'}
            row={editing.mode === 'edit' ? editing.row : null}
            services={services}
          />
        )}
      </Overlay>
    </>
  );
}

function MasterForm({
  row,
  services,
}: {
  row: BeautyEmployeeRow | null;
  services: BeautyServiceRow[];
}) {
  const [state, action, pending] = useActionState(saveBeautyEmployee, null);
  const [error, setError] = useState<string | null>(null);
  const chosen = new Set(row?.serviceIds ?? []);
  return (
    <form
      action={action}
      className="beauty-form"
      onSubmit={(event) => {
        const data = new FormData(event.currentTarget);
        const parsed = parseEmployeeInput({
          name: String(data.get('name') ?? ''),
          phone: String(data.get('phone') ?? ''),
          email: String(data.get('email') ?? ''),
          active: data.get('active') === 'on',
        });
        if (!parsed.ok) {
          event.preventDefault();
          setError(parsed.reason);
          return;
        }
        setError(null);
      }}
    >
      <input type="hidden" name="id" value={row?.id ?? ''} />
      <Field label="Имя мастера">
        <Input name="name" required maxLength={200} defaultValue={row?.name ?? ''} />
      </Field>
      <Field label={<span>Телефон <small className="beauty-note">необязательно</small></span>}>
        <Input name="phone" maxLength={32} defaultValue={row?.phone ?? ''} />
      </Field>
      <Field label={<span>Почта <small className="beauty-note">необязательно</small></span>}>
        <Input name="email" type="email" maxLength={320} defaultValue={row?.email ?? ''} />
      </Field>
      <label className="beauty-check">
        <input type="checkbox" name="active" defaultChecked={row?.active ?? true} />
        Мастер работает
      </label>
      <fieldset className="beauty-skills">
        <legend>Что умеет</legend>
        {services.length === 0 ? (
          <p className="beauty-note">Сначала добавьте услуги в каталог салона.</p>
        ) : (
          services.map((service) => (
            <label key={service.id} className="beauty-check">
              <input
                type="checkbox"
                name="serviceIds"
                value={service.id}
                defaultChecked={chosen.has(service.id)}
              />
              {service.name}
            </label>
          ))
        )}
      </fieldset>
      {(error ?? state?.error) && <Alert>{error ?? state?.error}</Alert>}
      {!error && state?.message && <p role="status">{state.message}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? 'Сохраняем…' : 'Сохранить мастера'}
      </Button>
    </form>
  );
}

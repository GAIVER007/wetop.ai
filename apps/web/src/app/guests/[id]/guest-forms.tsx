'use client';
import { useActionState, useState } from 'react';
import type { GuestCard } from '../../../lib/api';
import {
  Alert,
  Button,
  Field,
  Grid,
  Input,
  Panel,
  PanelTitle,
  Row,
  Select,
  Stack,
  Textarea,
} from '../../../components/ui';
import {
  addDocumentAction,
  deleteDocumentAction,
  updateGuestAction,
  type GuestActionResult,
} from './actions';

const DOC_TYPES: Array<[string, string]> = [
  ['PASSPORT', 'паспорт'],
  ['ID_CARD', 'удостоверение личности'],
  ['RESIDENCE_PERMIT', 'вид на жительство'],
  ['BIRTH_CERTIFICATE', 'свидетельство о рождении'],
  ['OTHER', 'другое'],
];

export function GuestForms({ guest }: { guest: GuestCard }) {
  const [pState, pAction, pPending] = useActionState<GuestActionResult, FormData>(
    updateGuestAction.bind(null, guest.id),
    { error: null },
  );
  const [dState, dAction, dPending] = useActionState<GuestActionResult, FormData>(
    addDocumentAction.bind(null, guest.id),
    { error: null },
  );
  const [delState, setDel] = useState<GuestActionResult>({ error: null });
  return (
    <Stack>
      <form action={pAction} data-testid="guest-form" className="panel">
        <PanelTitle>Профиль</PanelTitle>
        <Grid gap="sm">
          <Field label="Фамилия *">
            <Input name="lastName" defaultValue={guest.lastName} required />
          </Field>
          <Field label="Имя *">
            <Input name="firstName" defaultValue={guest.firstName} required />
          </Field>
          <Field label="Отчество">
            <Input name="middleName" defaultValue={guest.middleName ?? ''} />
          </Field>
          <Field label="Дата рождения">
            <Input type="date" name="birthDate" defaultValue={guest.birthDate ?? ''} />
          </Field>
          <Field label="Гражданство (ISO alpha-3, напр. KAZ) *для заселения">
            <Input
              name="citizenship"
              defaultValue={guest.citizenship ?? ''}
              maxLength={3}
              placeholder="KAZ"
              className="inp--upper"
            />
          </Field>
          <Field label="Пол">
            <Select name="gender" defaultValue={guest.gender}>
              <option value="UNKNOWN">не указан</option>
              <option value="MALE">мужской</option>
              <option value="FEMALE">женский</option>
            </Select>
          </Field>
          <Field label="Телефон">
            <Input name="phone" defaultValue={guest.phone ?? ''} />
          </Field>
          <Field label="Email">
            <Input name="email" defaultValue={guest.email ?? ''} />
          </Field>
        </Grid>
        <Field label="Заметки о госте">
          <Textarea name="notes" defaultValue={guest.notes ?? ''} rows={2} />
        </Field>
        <Row>
          <Button type="submit" disabled={pPending}>
            Сохранить
          </Button>
          {pState.error && <Alert>{pState.error}</Alert>}
        </Row>
      </form>
      <Panel title="Документы">
        {guest.documents.length === 0 && <span className="sub">нет</span>}
        {guest.documents.map((d) => (
          <Row key={d.id} data-testid="document-row" className="hint--lg">
            <span>
              {DOC_TYPES.find(([k]) => k === d.type)?.[1] ?? d.type}{' '}
              <b className="mono">{d.numberMasked}</b>
              {d.issueCountry ? ` · ${d.issueCountry}` : ''}
              {d.expiresAt ? ` · до ${d.expiresAt}` : ''}
            </span>
            <Button
              type="button"
              tone="secondary"
              size="sm"
              className="is-danger"
              onClick={async () => setDel(await deleteDocumentAction(guest.id, d.id))}
            >
              удалить
            </Button>
          </Row>
        ))}
        <form action={dAction} data-testid="document-form" className="row">
          <Select name="type" defaultValue="PASSPORT">
            {DOC_TYPES.map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </Select>
          <Input name="number" placeholder="номер (хранится зашифрованным)" required />
          <Input
            name="issueCountry"
            placeholder="страна, KAZ"
            maxLength={3}
            className="inp--w90 inp--upper"
          />
          <Input type="date" name="expiresAt" title="действителен до" />
          <Button type="submit" disabled={dPending}>
            Добавить
          </Button>
        </form>
        {(dState.error || delState.error) && <Alert>{dState.error ?? delState.error}</Alert>}
      </Panel>
    </Stack>
  );
}

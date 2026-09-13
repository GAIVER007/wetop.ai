'use client';
import { useActionState } from 'react';
import { useCommand } from '../../../lib/use-command';
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
  const {
    state: delState,
    run: remove,
    pending: deletePending,
  } = useCommand<GuestActionResult>({ error: null });
  return (
    <Stack>
      <form
        key={pState.attempt ?? 0}
        action={pAction}
        id="guest-profile"
        data-testid="guest-form"
        className="panel"
      >
        <PanelTitle>Профиль</PanelTitle>
        <Grid gap="sm">
          <Field label="Фамилия *">
            <Input
              name="lastName"
              defaultValue={pState.values?.lastName ?? guest.lastName}
              required
            />
          </Field>
          <Field label="Имя *">
            <Input
              name="firstName"
              defaultValue={pState.values?.firstName ?? guest.firstName}
              required
            />
          </Field>
          <Field label="Отчество">
            <Input
              name="middleName"
              defaultValue={pState.values?.middleName ?? guest.middleName ?? ''}
            />
          </Field>
          <Field label="Дата рождения">
            <Input
              type="date"
              name="birthDate"
              defaultValue={pState.values?.birthDate ?? guest.birthDate ?? ''}
            />
          </Field>
          <Field label="Гражданство (ISO alpha-3, напр. KAZ) *для заселения">
            <Input
              name="citizenship"
              defaultValue={pState.values?.citizenship ?? guest.citizenship ?? ''}
              maxLength={3}
              placeholder="KAZ"
              className="inp--upper"
            />
          </Field>
          <Field label="Пол">
            <Select name="gender" defaultValue={pState.values?.gender ?? guest.gender}>
              <option value="UNKNOWN">не указан</option>
              <option value="MALE">мужской</option>
              <option value="FEMALE">женский</option>
            </Select>
          </Field>
          <Field label="Телефон">
            <Input name="phone" defaultValue={pState.values?.phone ?? guest.phone ?? ''} />
          </Field>
          <Field label="Email">
            <Input name="email" defaultValue={pState.values?.email ?? guest.email ?? ''} />
          </Field>
        </Grid>
        <Field label="Заметки о госте">
          <Textarea
            name="notes"
            defaultValue={pState.values?.notes ?? guest.notes ?? ''}
            rows={2}
          />
        </Field>
        <Row>
          <Button type="submit" disabled={pPending}>
            Сохранить
          </Button>
          {pState.error && <Alert>{pState.error}</Alert>}
        </Row>
      </form>
      <Panel title="Документы" id="guest-documents">
        {guest.documents.length === 0 && <span className="sub">нет</span>}
        {guest.documents.map((d) => (
          <Row key={d.id} data-testid="document-row" className="hint--lg">
            <span>
              {DOC_TYPES.find(([k]) => k === d.type)?.[1] ?? d.type}{' '}
              <b className="mono">{d.numberMasked}</b>
              {d.issueCountry ? ` · ${d.issueCountry}` : ''}
              {d.issuedAt ? ` · выдан ${d.issuedAt}` : ''}
              {d.expiresAt ? ` · до ${d.expiresAt}` : ''}
            </span>
            <Button
              type="button"
              tone="secondary"
              size="sm"
              className="is-danger"
              disabled={deletePending || dPending}
              onClick={() => remove(() => deleteDocumentAction(guest.id, d.id))}
            >
              удалить
            </Button>
          </Row>
        ))}
        <form
          key={dState.attempt ?? 0}
          action={dAction}
          data-testid="document-form"
          className="row"
        >
          <Select
            name="type"
            aria-label="Тип документа"
            defaultValue={dState.values?.type ?? 'PASSPORT'}
          >
            {DOC_TYPES.map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </Select>
          <Input
            name="number"
            defaultValue={dState.values?.number ?? ''}
            aria-label="Номер документа"
            placeholder="Номер документа"
            required
          />
          <Input
            name="issueCountry"
            defaultValue={dState.values?.issueCountry ?? ''}
            aria-label="Страна выдачи"
            placeholder="страна, KAZ"
            maxLength={3}
            className="inp--w90 inp--upper"
          />
          <Field label="Дата выдачи">
            <Input type="date" name="issuedAt" defaultValue={dState.values?.issuedAt ?? ''} />
          </Field>
          <Field label="Действителен до">
            <Input type="date" name="expiresAt" defaultValue={dState.values?.expiresAt ?? ''} />
          </Field>
          <Button type="submit" disabled={dPending || deletePending}>
            Добавить
          </Button>
        </form>
        {(dState.error || delState.error) && <Alert>{dState.error ?? delState.error}</Alert>}
      </Panel>
    </Stack>
  );
}

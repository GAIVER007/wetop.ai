'use client';
import { useActionState } from 'react';
import { useCommand } from '../../../lib/use-command';
import type { GuestCard } from '../../../lib/api';
import { displayDay } from '../../../lib/display-date';
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Field,
  Grid,
  Input,
  Notice,
  Panel,
  PanelTitle,
  Row,
  Select,
  Stack,
  Textarea,
} from '../../../components/ui';
import { DateInput } from '../../../components/date-field';
import {
  addDocumentAction,
  deleteDocumentAction,
  updateGuestAction,
  type GuestActionResult,
} from './actions';
import { useConfirm } from '../../../components/use-confirm';

const DOC_TYPES: Array<[string, string]> = [
  ['PASSPORT', 'паспорт'],
  ['ID_CARD', 'удостоверение личности'],
  ['RESIDENCE_PERMIT', 'вид на жительство'],
  ['BIRTH_CERTIFICATE', 'свидетельство о рождении'],
  ['OTHER', 'другое'],
];
const docTypeName = (type: string) => DOC_TYPES.find(([k]) => k === type)?.[1] ?? type;

/**
 * Профиль гостя — вкладка «Данные гостя». «Только чтение» (ADR-102, ТЗ §40): поля видны, но не
 * меняются, кнопки «Сохранить» нет — запись всё равно режет API, здесь действие просто не рисуется.
 */
export function GuestProfileForm({
  guest,
  piiStorage,
  readOnly,
  compact = false,
}: {
  guest: GuestCard;
  compact?: boolean;
  /** ADR-072: `pseudonymized` — база не в Казахстане: имя, контакты, заметки и документы не вносятся */
  piiStorage: 'real' | 'pseudonymized';
  readOnly: boolean;
}) {
  const personal = piiStorage === 'real';
  const [pState, pAction, pPending] = useActionState<GuestActionResult, FormData>(
    updateGuestAction.bind(null, guest.id),
    { error: null },
  );
  return (
    <form
      key={pState.attempt ?? 0}
      action={pAction}
      id="guest-profile"
      data-testid="guest-form"
      className="panel"
    >
      {!compact && <PanelTitle>Профиль</PanelTitle>}
      {!personal && !compact && (
        <Notice data-testid="guest-pseudonymized">
          Пока база WETOP не в Казахстане, имя, контакты, заметки и документы гостя в ней не
          хранятся. Менять можно гражданство и пол; личность сверяйте по документу на заселении.
        </Notice>
      )}
      <fieldset className="guest-form-fields" disabled={readOnly}>
        <Grid gap="sm">
          {personal && (
            <>
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
                <DateInput
                  name="birthDate"
                  defaultValue={pState.values?.birthDate ?? guest.birthDate ?? ''}
                />
              </Field>
            </>
          )}
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
          {personal && (
            <>
              <Field label="Телефон">
                <Input name="phone" defaultValue={pState.values?.phone ?? guest.phone ?? ''} />
              </Field>
              <Field label="Email">
                <Input name="email" defaultValue={pState.values?.email ?? guest.email ?? ''} />
              </Field>
            </>
          )}
        </Grid>
        {personal && (
          <Field label="Заметки о госте">
            <Textarea
              name="notes"
              defaultValue={pState.values?.notes ?? guest.notes ?? ''}
              rows={2}
            />
          </Field>
        )}
      </fieldset>
      {!readOnly && (
        <Row>
          <Button type="submit" disabled={pPending}>
            Сохранить
          </Button>
          {pState.error && <Alert>{pState.error}</Alert>}
        </Row>
      )}
    </form>
  );
}

/**
 * Документы гостя — своя вкладка (G5, ТЗ §22): номер только маской, страна и даты, истёкший
 * документ помечен словом — без него гостя не заселить. Каждый показ карточки с документами пишется
 * в журнал на стороне API (SECURITY.md §1). «Только чтение»: ни добавления, ни удаления.
 */
export function GuestDocuments({
  guest,
  piiStorage,
  readOnly,
  today,
}: {
  guest: GuestCard;
  piiStorage: 'real' | 'pseudonymized';
  readOnly: boolean;
  /** YYYY-MM-DD по часам объекта: «просрочен» считается от него, а не от часов браузера */
  today: string;
}) {
  const personal = piiStorage === 'real';
  const [dState, dAction, dPending] = useActionState<GuestActionResult, FormData>(
    addDocumentAction.bind(null, guest.id),
    { error: null },
  );
  const {
    state: delState,
    run: remove,
    pending: deletePending,
  } = useCommand<GuestActionResult>({ error: null });
  const { ask, dialog } = useConfirm();
  return (
    <Stack>
      <Panel title="Документы" id="guest-documents">
        {guest.documents.length === 0 && (
          <EmptyState title="Документов нет">
            {personal && !readOnly
              ? 'Добавьте паспорт или удостоверение формой ниже — без документа гостя не заселить.'
              : 'Без документа гостя не заселить.'}
          </EmptyState>
        )}
        {guest.documents.length > 0 && (
          <ul className="guest-docs">
            {guest.documents.map((d) => {
              const expired = d.expiresAt !== null && d.expiresAt < today;
              const facts = [
                d.issueCountry,
                d.issuedAt ? `выдан ${displayDay(d.issuedAt)}` : null,
                d.expiresAt ? `действителен до ${displayDay(d.expiresAt)}` : null,
              ].filter(Boolean);
              return (
                <li key={d.id} className="guest-doc" data-testid="document-row">
                  <div className="guest-doc__main">
                    <strong>{docTypeName(d.type)}</strong>
                    <b className="mono">{d.numberMasked}</b>
                    {expired && <Badge tone="danger">просрочен</Badge>}
                  </div>
                  {facts.length > 0 && <span className="dir-sub">{facts.join(', ')}</span>}
                  {!readOnly && (
                    <Button
                      type="button"
                      tone="secondary"
                      size="sm"
                      className="is-danger guest-doc__remove"
                      disabled={deletePending || dPending}
                      onClick={async () => {
                        // Документ хранится в шифровании и восстановлению не подлежит — вносить заново руками
                        const ok = await ask({
                          title: 'Удалить документ гостя?',
                          body: `${docTypeName(d.type)} ${d.numberMasked} исчезнет с карточки. Вернуть его можно будет только вводом заново, а без документа гостя не заселить.`,
                          confirmLabel: 'Удалить документ',
                        });
                        if (!ok) return;
                        await remove(() => deleteDocumentAction(guest.id, d.id));
                      }}
                    >
                      удалить
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {!personal && (
          <p className="sub" data-testid="documents-pseudonymized">
            Документы гостей в WETOP не вносятся, пока база не в Казахстане.
          </p>
        )}
        {personal && !readOnly && (
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
              <DateInput name="issuedAt" defaultValue={dState.values?.issuedAt ?? ''} />
            </Field>
            <Field label="Действителен до">
              <DateInput name="expiresAt" defaultValue={dState.values?.expiresAt ?? ''} />
            </Field>
            <Button type="submit" disabled={dPending || deletePending}>
              Добавить
            </Button>
          </form>
        )}
        {(dState.error || delState.error) && <Alert>{dState.error ?? delState.error}</Alert>}
      </Panel>
      {dialog}
    </Stack>
  );
}

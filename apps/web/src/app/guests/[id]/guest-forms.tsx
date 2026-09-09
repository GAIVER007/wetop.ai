'use client';
import { useActionState, useState } from 'react';
import type { GuestCard } from '../../../lib/api';
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
    <div style={{ display: 'grid', gap: 14 }}>
      <form action={pAction} data-testid="guest-form" style={box}>
        <b style={{ fontSize: 14 }}>Профиль</b>
        <div style={grid}>
          <L t="Фамилия *">
            <input name="lastName" defaultValue={guest.lastName} required style={inp} />
          </L>
          <L t="Имя *">
            <input name="firstName" defaultValue={guest.firstName} required style={inp} />
          </L>
          <L t="Отчество">
            <input name="middleName" defaultValue={guest.middleName ?? ''} style={inp} />
          </L>
          <L t="Дата рождения">
            <input type="date" name="birthDate" defaultValue={guest.birthDate ?? ''} style={inp} />
          </L>
          <L t="Гражданство (ISO alpha-3, напр. KAZ) *для заселения">
            <input
              name="citizenship"
              defaultValue={guest.citizenship ?? ''}
              maxLength={3}
              placeholder="KAZ"
              style={{ ...inp, textTransform: 'uppercase' }}
            />
          </L>
          <L t="Пол">
            <select name="gender" defaultValue={guest.gender} style={inp}>
              <option value="UNKNOWN">не указан</option>
              <option value="MALE">мужской</option>
              <option value="FEMALE">женский</option>
            </select>
          </L>
          <L t="Телефон">
            <input name="phone" defaultValue={guest.phone ?? ''} style={inp} />
          </L>
          <L t="Email">
            <input name="email" defaultValue={guest.email ?? ''} style={inp} />
          </L>
        </div>
        <L t="Заметки о госте">
          <textarea name="notes" defaultValue={guest.notes ?? ''} rows={2} style={inp} />
        </L>
        <div style={row}>
          <button type="submit" disabled={pPending} style={btn}>
            Сохранить
          </button>
          {pState.error && (
            <span role="alert" style={err}>
              {pState.error}
            </span>
          )}
        </div>
      </form>
      <section style={box}>
        <b style={{ fontSize: 14 }}>Документы</b>
        {guest.documents.length === 0 && <span style={{ color: '#666', fontSize: 13 }}>нет</span>}
        {guest.documents.map((d) => (
          <div key={d.id} data-testid="document-row" style={{ ...row, fontSize: 13 }}>
            <span>
              {DOC_TYPES.find(([k]) => k === d.type)?.[1] ?? d.type}{' '}
              <b style={{ fontFamily: 'ui-monospace, monospace' }}>{d.numberMasked}</b>
              {d.issueCountry ? ` · ${d.issueCountry}` : ''}
              {d.expiresAt ? ` · до ${d.expiresAt}` : ''}
            </span>
            <button
              type="button"
              onClick={async () => setDel(await deleteDocumentAction(guest.id, d.id))}
              style={{ ...btnSecondary, color: '#b91c1c' }}
            >
              удалить
            </button>
          </div>
        ))}
        <form action={dAction} data-testid="document-form" style={row}>
          <select name="type" defaultValue="PASSPORT" style={inp}>
            {DOC_TYPES.map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
          <input name="number" placeholder="номер (хранится зашифрованным)" required style={inp} />
          <input
            name="issueCountry"
            placeholder="страна, KAZ"
            maxLength={3}
            style={{ ...inp, width: 90, textTransform: 'uppercase' }}
          />
          <input type="date" name="expiresAt" style={inp} title="действителен до" />
          <button type="submit" disabled={dPending} style={btn}>
            Добавить
          </button>
        </form>
        {(dState.error || delState.error) && (
          <div role="alert" style={err}>
            {dState.error ?? delState.error}
          </div>
        )}
      </section>
    </div>
  );
}
function L({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label
      style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#555' }}
    >
      {t}
      {children}
    </label>
  );
}
const box: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e3e5e8',
  borderRadius: 8,
  padding: 12,
  display: 'grid',
  gap: 8,
};
const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 8,
};
const row: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  alignItems: 'center',
};
const inp: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid #cbd0d6',
  borderRadius: 6,
  fontSize: 14,
};
const btn: React.CSSProperties = {
  padding: '7px 12px',
  border: 0,
  borderRadius: 6,
  background: '#1d4ed8',
  color: '#fff',
  fontSize: 14,
  cursor: 'pointer',
};
const btnSecondary: React.CSSProperties = {
  padding: '6px 10px',
  border: '1px solid #cbd0d6',
  borderRadius: 6,
  background: '#fff',
  fontSize: 13,
  cursor: 'pointer',
};
const err: React.CSSProperties = { color: '#b91c1c', fontSize: 13 };

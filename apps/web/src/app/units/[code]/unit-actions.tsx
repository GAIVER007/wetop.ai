'use client';
import { useActionState, useState } from 'react';
import type { UnitCard } from '../../../lib/api';
import {
  blockUnitAction,
  housekeepingAction,
  unblockUnitAction,
  type UnitActionResult,
} from './actions';

const TYPES: Array<[string, string]> = [
  ['MAINTENANCE', 'ремонт'],
  ['OUT_OF_ORDER', 'неисправна'],
  ['MANAGEMENT', 'решение управляющего'],
  ['OTHER', 'другое'],
];
const HK: Array<[UnitCard['housekeepingStatus'], string]> = [
  ['DIRTY', 'грязно'],
  ['CLEAN', 'убрано'],
  ['INSPECTED', 'проверено'],
];

export function UnitActions({ unit, today }: { unit: UnitCard; today: string }) {
  const [blockState, blockAction, blockPending] = useActionState<UnitActionResult, FormData>(
    blockUnitAction.bind(null, unit.code),
    { error: null },
  );
  const [other, setOther] = useState<UnitActionResult>({ error: null });
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <section style={box}>
        <b style={{ fontSize: 14 }}>
          Статус уборки: {HK.find(([k]) => k === unit.housekeepingStatus)?.[1]}
        </b>
        <div style={row}>
          {HK.filter(([k]) => k !== unit.housekeepingStatus).map(([k, t]) => (
            <button
              key={k}
              type="button"
              data-testid={`hk-${k}`}
              onClick={async () => setOther(await housekeepingAction(unit.code, k))}
              style={btnSecondary}
            >
              → {t}
            </button>
          ))}
        </div>
      </section>
      <section style={box}>
        <b style={{ fontSize: 14 }}>Блокировки (ремонт, вывод из продажи)</b>
        {unit.blocks.length === 0 && <span style={{ color: '#666', fontSize: 13 }}>нет</span>}
        {unit.blocks.map((b) => (
          <div key={b.id} data-testid="block-row" style={{ ...row, fontSize: 13 }}>
            <span>
              {b.dateFrom} → {b.dateTo} · {TYPES.find(([k]) => k === b.type)?.[1] ?? b.type}
              {b.reason ? ` · ${b.reason}` : ''}
            </span>
            <button
              type="button"
              onClick={async () => setOther(await unblockUnitAction(unit.code, b.id))}
              style={{ ...btnSecondary, color: '#b91c1c' }}
            >
              снять
            </button>
          </div>
        ))}
        <form action={blockAction} data-testid="block-form" style={row}>
          <input type="date" name="dateFrom" defaultValue={today} required style={inp} />
          <input
            type="date"
            name="dateTo"
            required
            style={inp}
            title="ночь выезда не блокируется"
          />
          <select name="type" defaultValue="MAINTENANCE" style={inp}>
            {TYPES.map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </select>
          <input name="reason" placeholder="причина" style={inp} />
          <button type="submit" disabled={blockPending} style={btn}>
            Заблокировать
          </button>
        </form>
        {(blockState.error || other.error) && (
          <div role="alert" style={{ color: '#b91c1c', fontSize: 13 }}>
            {blockState.error ?? other.error}
          </div>
        )}
      </section>
    </div>
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

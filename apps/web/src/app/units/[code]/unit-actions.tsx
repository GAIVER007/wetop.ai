'use client';
import { useActionState, useState } from 'react';
import type { UnitCard } from '../../../lib/api';
import { Alert, Button, Input, Panel, Row, Select, Stack } from '../../../components/ui';
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
    <Stack>
      <Panel title={`Статус уборки: ${HK.find(([k]) => k === unit.housekeepingStatus)?.[1]}`}>
        <Row>
          {HK.filter(([k]) => k !== unit.housekeepingStatus).map(([k, t]) => (
            <Button
              key={k}
              type="button"
              tone="secondary"
              data-testid={`hk-${k}`}
              onClick={async () => setOther(await housekeepingAction(unit.code, k))}
            >
              → {t}
            </Button>
          ))}
        </Row>
      </Panel>
      <Panel title="Блокировки (ремонт, вывод из продажи)">
        {unit.blocks.length === 0 && <span className="sub">нет</span>}
        {unit.blocks.map((b) => (
          <Row key={b.id} data-testid="block-row" className="hint--lg">
            <span>
              {b.dateFrom} → {b.dateTo} · {TYPES.find(([k]) => k === b.type)?.[1] ?? b.type}
              {b.reason ? ` · ${b.reason}` : ''}
            </span>
            <Button
              type="button"
              tone="secondary"
              size="sm"
              className="is-danger"
              onClick={async () => setOther(await unblockUnitAction(unit.code, b.id))}
            >
              снять
            </Button>
          </Row>
        ))}
        <form action={blockAction} data-testid="block-form" className="row">
          <Input type="date" name="dateFrom" defaultValue={today} required />
          <Input type="date" name="dateTo" required title="ночь выезда не блокируется" />
          <Select name="type" defaultValue="MAINTENANCE">
            {TYPES.map(([k, t]) => (
              <option key={k} value={k}>
                {t}
              </option>
            ))}
          </Select>
          <Input name="reason" placeholder="причина" />
          <Button type="submit" disabled={blockPending}>
            Заблокировать
          </Button>
        </form>
        {(blockState.error || other.error) && <Alert>{blockState.error ?? other.error}</Alert>}
      </Panel>
    </Stack>
  );
}

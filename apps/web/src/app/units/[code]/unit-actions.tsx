'use client';
import { useActionState, useState, useTransition } from 'react';
import type { UnitCard } from '../../../lib/api';
import { Alert, Button, Field, Input, Panel, Row, Select, Stack } from '../../../components/ui';
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
  const [pending, start] = useTransition();
  return (
    <Stack>
      {other.error && <Alert>{other.error}</Alert>}
      <Panel title={`Статус уборки: ${HK.find(([k]) => k === unit.housekeepingStatus)?.[1]}`}>
        <Row>
          {HK.filter(([k]) => k !== unit.housekeepingStatus).map(([k, t]) => (
            <Button
              key={k}
              type="button"
              tone="secondary"
              data-testid={`hk-${k}`}
              disabled={pending || blockPending}
              onClick={() => start(async () => setOther(await housekeepingAction(unit.code, k)))}
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
              disabled={pending || blockPending}
              onClick={() => start(async () => setOther(await unblockUnitAction(unit.code, b.id)))}
            >
              снять
            </Button>
          </Row>
        ))}
        <form
          key={blockState.attempt ?? 0}
          action={blockAction}
          data-testid="block-form"
          className="row unit-block-form"
        >
          <Field label="Блокировка с">
            <Input
              type="date"
              name="dateFrom"
              defaultValue={blockState.values?.dateFrom ?? today}
              required
            />
          </Field>
          <Field label="До (не включая)">
            <Input
              type="date"
              name="dateTo"
              defaultValue={blockState.values?.dateTo ?? ''}
              required
            />
          </Field>
          <Field label="Тип блокировки">
            <Select name="type" defaultValue={blockState.values?.type ?? 'MAINTENANCE'}>
              {TYPES.map(([k, t]) => (
                <option key={k} value={k}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Причина">
            <Input name="reason" defaultValue={blockState.values?.reason ?? ''} />
          </Field>
          <Button type="submit" disabled={blockPending || pending}>
            Заблокировать
          </Button>
        </form>
        {blockState.error && <Alert>{blockState.error}</Alert>}
      </Panel>
    </Stack>
  );
}

'use client';
import { useActionState, useState, useTransition } from 'react';
import type { UnitCard } from '../../../lib/api';
import { Alert, Button, Field, Input, Panel, Row, Select, Stack } from '../../../components/ui';
import { useConfirm } from '../../../components/use-confirm';
import { displayDate } from '../../../lib/display-date';
import {
  blockUnitAction,
  housekeepingAction,
  unblockUnitAction,
  type UnitActionResult,
} from './actions';
import { BLOCK_TYPE_RU } from '../../../lib/block-types';
import { Icon, type IconName } from '../../../components/icon';

const TYPES: Array<[string, string]> = Object.entries(BLOCK_TYPE_RU);
/**
 * Уборка (21.09.2026): статус назван словом — «Сейчас грязно», — а кнопки названы тем, что получится
 * («Убрано», «Проверено»), а не стрелкой «→ убрано». Значок из набора стоит рядом со словом, а не
 * вместо него (DESIGN.md §7, §9). Команда та же, что в строке шахматки.
 */
const HK: Array<[UnitCard['housekeepingStatus'], string, IconName]> = [
  ['DIRTY', 'Грязно', 'dirty'],
  ['CLEAN', 'Убрано', 'clean'],
  ['INSPECTED', 'Проверено', 'inspected'],
];
const HK_NOW: Record<UnitCard['housekeepingStatus'], string> = {
  DIRTY: 'грязно',
  CLEAN: 'убрано',
  INSPECTED: 'проверено',
};

export function UnitActions({ unit, today }: { unit: UnitCard; today: string }) {
  const [blockState, blockAction, blockPending] = useActionState<UnitActionResult, FormData>(
    blockUnitAction.bind(null, unit.code),
    { error: null },
  );
  const [other, setOther] = useState<UnitActionResult>({ error: null });
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  return (
    <Stack>
      {other.error && <Alert>{other.error}</Alert>}
      <Panel title="Уборка" data-testid="housekeeping-panel">
        <p className="sub hk-now">
          <Icon name={HK.find(([k]) => k === unit.housekeepingStatus)?.[2] ?? 'dirty'} />
          Сейчас {HK_NOW[unit.housekeepingStatus]}
        </p>
        <Row>
          {HK.filter(([k]) => k !== unit.housekeepingStatus).map(([k, t, icon]) => (
            <Button
              key={k}
              type="button"
              tone="secondary"
              data-testid={`hk-${k}`}
              disabled={pending || blockPending}
              onClick={() => start(async () => setOther(await housekeepingAction(unit.code, k)))}
            >
              <Icon name={icon} />
              {t}
            </Button>
          ))}
        </Row>
      </Panel>
      <Panel title="Блокировки (ремонт, вывод из продажи)">
        {unit.blocks.length === 0 && (
          <p className="sub">Блокировок нет — ячейка в продаже. Закрыть её можно формой ниже.</p>
        )}
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
              onClick={async () => {
                // Снятая блокировка возвращает ячейку в продажу — её тут же может занять канал
                const ok = await ask({
                  title: `Снять блокировку с ячейки ${unit.code}?`,
                  body: `${displayDate(b.dateFrom)} → ${displayDate(b.dateTo)} · ${
                    TYPES.find(([k]) => k === b.type)?.[1] ?? b.type
                  }${b.reason ? ` · ${b.reason}` : ''}. Ячейка вернётся в продажу, и её сможет занять бронь.`,
                  confirmLabel: 'Снять блокировку',
                });
                if (!ok) return;
                start(async () => setOther(await unblockUnitAction(unit.code, b.id)));
              }}
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
      {dialog}
    </Stack>
  );
}

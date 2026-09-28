'use client';
import { useActionState, useState, useTransition } from 'react';
import {
  HOUSEKEEPING_FLOW,
  HOUSEKEEPING_RU,
  housekeepingTargets,
  nextHousekeepingStatus,
} from '@pms/domain';
import type { UnitCard } from '../../../lib/api';
import { Alert, Button, Field, Input, Panel, Row, Select, Stack } from '../../../components/ui';
import { DateInput } from '../../../components/date-field';
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
 * Уборка (21.09.2026): статус назван словом, кнопки — тем, что получится («Убрано», «Проверено»), а не
 * стрелкой «→ убрано»; значок из набора стоит рядом со словом, а не вместо него (DESIGN.md §7, §9).
 * 22.09.2026 (поручение владельца): цикл «требует уборки → убрано → проверено, доступна» показан шагами,
 * кнопки — только следующий шаг (залита) и возврат в уборку; перепрыгнуть проверку нельзя ни здесь, ни
 * через API (`@pms/domain`). Команда та же, что в строке шахматки.
 */
type HkStatus = UnitCard['housekeepingStatus'];
const HK_ICON: Record<HkStatus, IconName> = {
  DIRTY: 'dirty',
  CLEAN: 'clean',
  INSPECTED: 'inspected',
};
/** Кнопка названа результатом: нажал «Убрано» — ячейка убрана (§14) */
const HK_BUTTON: Record<HkStatus, string> = {
  DIRTY: 'Требует уборки',
  CLEAN: 'Убрано',
  INSPECTED: 'Проверено',
};
/** Что делать дальше — одной фразой под шагами */
const HK_NEXT: Record<HkStatus, string> = {
  DIRTY: 'Когда горничная закончит — «Убрано». Доступной ячейка станет после проверки.',
  CLEAN: 'После осмотра — «Проверено», и ячейка доступна. Если что-то не так — «Требует уборки».',
  INSPECTED: 'Ячейка доступна для заселения. Испачкали — «Требует уборки», и цикл начнётся заново.',
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
          <Icon name={HK_ICON[unit.housekeepingStatus]} />
          Сейчас {HOUSEKEEPING_RU[unit.housekeepingStatus]}
        </p>
        <ol className="hk-flow" aria-label="Порядок уборки">
          {HOUSEKEEPING_FLOW.map((s) => (
            <li key={s} aria-current={s === unit.housekeepingStatus ? 'step' : undefined}>
              {HOUSEKEEPING_RU[s]}
            </li>
          ))}
        </ol>
        <p className="hint">{HK_NEXT[unit.housekeepingStatus]}</p>
        <Row>
          {housekeepingTargets(unit.housekeepingStatus).map((k) => (
            <Button
              key={k}
              type="button"
              {...(k === nextHousekeepingStatus(unit.housekeepingStatus)
                ? {}
                : { tone: 'secondary' as const })}
              data-testid={`hk-${k}`}
              disabled={pending || blockPending}
              onClick={() => start(async () => setOther(await housekeepingAction(unit.code, k)))}
            >
              <Icon name={HK_ICON[k]} />
              {HK_BUTTON[k]}
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
              <time dateTime={b.dateFrom}>{displayDate(b.dateFrom, 'numeric')}</time>
              {' → '}
              <time dateTime={b.dateTo}>{displayDate(b.dateTo, 'numeric')}</time>
              {`, ${TYPES.find(([k]) => k === b.type)?.[1] ?? b.type}`}
              {b.reason ? `, ${b.reason}` : ''}
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
            <DateInput
              name="dateFrom"
              defaultValue={blockState.values?.dateFrom ?? today}
              required
            />
          </Field>
          <Field label="До (не включая)">
            <DateInput
              name="dateTo"
              rangeFromName="dateFrom"
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

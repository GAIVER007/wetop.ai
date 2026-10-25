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
import { Icon } from '../../../components/icon';
import { housekeepingStatus } from '../../../lib/status/housekeeping';
import { HousekeeperPicker } from './housekeeper-picker';
import { intlLocale, msg } from '../../../i18n';
import { useLocale, useT } from '../../../i18n/locale-provider';

const TYPES: Array<[string, string]> = Object.entries(BLOCK_TYPE_RU);
/**
 * Уборка (21.09.2026): статус назван словом, кнопки — тем, что получится («Убрано», «Проверено»), а не
 * стрелкой «→ убрано»; значок из набора стоит рядом со словом, а не вместо него (DESIGN.md §7, §9).
 * 22.09.2026 (поручение владельца): цикл «требует уборки → убрано → проверено, доступна» показан шагами,
 * кнопки — только следующий шаг (залита) и возврат в уборку; перепрыгнуть проверку нельзя ни здесь, ни
 * через API (`@pms/domain`). Команда та же, что в строке шахматки.
 */
type HkStatus = UnitCard['housekeepingStatus'];
/** status-hint: что делать дальше одной фразой под шагами; кнопка названа результатом, словом статуса */
const HK_NEXT: Record<HkStatus, string> = {
  DIRTY: msg('Когда горничная закончит, нажмите «Убрано». Доступным номер станет после проверки.'),
  CLEAN: msg('После осмотра нажмите «Проверено», и номер доступен. Если что-то не так, «Требует уборки».'),
  INSPECTED: msg('Номер доступен для заселения. Испачкали: «Требует уборки», и цикл начнётся заново.'),
};

export function UnitActions({
  unit,
  today,
  blockPeriod,
  housekeepers,
}: {
  unit: UnitCard;
  today: string;
  /** Период из окошка шахматки (ТЗ v2 §31–32): форма блокировки открывается с ним */
  blockPeriod?: { dateFrom: string; dateTo: string } | undefined;
  /** Сотрудники гостиницы для «Кто убирает» (22.10.2026); не переданы: выбора нет */
  housekeepers?: ReadonlyArray<{ id: string; name: string; active: boolean }> | undefined;
}) {
  const t = useT();
  const locale = useLocale();
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
      <Panel title={t('Уборка')} data-testid="housekeeping-panel">
        <p className="sub hk-now">
          <Icon name={housekeepingStatus[unit.housekeepingStatus].icon} />
          {t('Сейчас {status}', { status: t(HOUSEKEEPING_RU[unit.housekeepingStatus]) })}
        </p>
        <ol className="hk-flow" aria-label={t('Порядок уборки')}>
          {HOUSEKEEPING_FLOW.map((s) => (
            <li key={s} aria-current={s === unit.housekeepingStatus ? 'step' : undefined}>
              {t(HOUSEKEEPING_RU[s])}
            </li>
          ))}
        </ol>
        <p className="hint">{t(HK_NEXT[unit.housekeepingStatus])}</p>
        {housekeepers && (
          <HousekeeperPicker code={unit.code} current={unit.housekeepingAssignee ?? null} employees={housekeepers} />
        )}
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
              <Icon name={housekeepingStatus[k].icon} />
              {t(housekeepingStatus[k].label)}
            </Button>
          ))}
        </Row>
      </Panel>
      <Panel title={t('Блокировки (ремонт, вывод из продажи)')}>
        {unit.blocks.length === 0 && (
          <p className="sub">{t('Блокировок нет, номер в продаже. Закрыть её можно формой ниже.')}</p>
        )}
        {unit.blocks.map((b) => (
          <Row key={b.id} data-testid="block-row" className="hint--lg">
            <span>
              <time dateTime={b.dateFrom}>{displayDate(b.dateFrom, 'numeric')}</time>
              {' → '}
              <time dateTime={b.dateTo}>{displayDate(b.dateTo, 'numeric')}</time>
              {`, ${t(TYPES.find(([k]) => k === b.type)?.[1] ?? b.type)}`}
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
                  title: t('Снять блокировку с номера {code}?', { code: unit.code }),
                  body: `${displayDate(b.dateFrom, 'short', intlLocale(locale))} → ${displayDate(b.dateTo, 'short', intlLocale(locale))} · ${t(
                    TYPES.find(([k]) => k === b.type)?.[1] ?? b.type,
                  )}${b.reason ? ` · ${b.reason}` : ''}. ${t('Номер вернётся в продажу, и его сможет занять бронь.')}`,
                  confirmLabel: t('Снять блокировку'),
                });
                if (!ok) return;
                start(async () => setOther(await unblockUnitAction(unit.code, b.id)));
              }}
            >
              {t('снять')}
            </Button>
          </Row>
        ))}
        <form
          key={blockState.attempt ?? 0}
          action={blockAction}
          id="block-form"
          data-testid="block-form"
          className="row unit-block-form"
        >
          <Field label={t('Блокировка с')}>
            <DateInput
              name="dateFrom"
              defaultValue={blockState.values?.dateFrom ?? blockPeriod?.dateFrom ?? today}
              required
            />
          </Field>
          <Field label={t('До (не включая)')}>
            <DateInput
              name="dateTo"
              rangeFromName="dateFrom"
              defaultValue={blockState.values?.dateTo ?? blockPeriod?.dateTo ?? ''}
              required
            />
          </Field>
          <Field label={t('Тип блокировки')}>
            <Select name="type" defaultValue={blockState.values?.type ?? 'MAINTENANCE'}>
              {TYPES.map(([k, label]) => (
                <option key={k} value={k}>
                  {t(label)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('Причина')}>
            <Input name="reason" defaultValue={blockState.values?.reason ?? ''} />
          </Field>
          <Button type="submit" disabled={blockPending || pending}>
            {t('Заблокировать')}
          </Button>
        </form>
        {blockState.error && <Alert>{blockState.error}</Alert>}
      </Panel>
      {dialog}
    </Stack>
  );
}

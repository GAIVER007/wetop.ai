'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { HotelStaffCabinetDto } from '@pms/domain';
import { Alert, Badge, BADGE_TONE, Button, EmptyState } from '../../components/ui';
import { housekeepingStatus } from '../../lib/status/housekeeping';
import { formatMoney } from '../../lib/money';
import { hotelMonthLine, hotelTaskDue, hotelUnitNote } from '../../lib/hotel-cabinet';
import { cleanUnitAction, taskDoneAction } from '../hotel-staff/actions';

const DAYS: Record<number, string> = { 1: 'Пн', 2: 'Вт', 3: 'Ср', 4: 'Чт', 5: 'Пт', 6: 'Сб', 0: 'Вс' };

/**
 * «Моя работа» горничной и ресепшена гостиницы (решение владельца 22.10.2026): телефон первым, сверху то, что
 * делать сейчас: «Мои уборки сегодня» с кнопкой «Убрано», затем «Мои задачи» с «Сделано», потом неделя и зарплата.
 * Итоги месяца одной строкой (без плиток). Права решает API: чужой номер и чужая задача получают отказ словами.
 */
export function HotelCabinet({ data }: { data: HotelStaffCabinetDto }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();
  const act = (key: string, fn: () => Promise<{ error: string | null }>) =>
    start(async () => {
      setBusy(key);
      setError(null);
      const result = await fn();
      if (result.error) setError(result.error);
      else router.refresh();
      setBusy(null);
    });
  const toClean = data.units.filter((u) => u.status === 'DIRTY').length;
  const openTasks = data.tasks.filter((t) => !t.done).length;
  const money = (minor: string) => formatMoney(minor, data.pay.currency);
  return (
    <div className="hk-cab" data-testid="hotel-cabinet">
      <header className="panel hk-cab__head">
        <div>
          <Badge>Мой кабинет</Badge>
          <h2>{data.me.name}</h2>
          <p className="muted">{data.property.name}</p>
        </div>
        <p className="hk-cab__month" data-testid="hotel-month-line">
          {hotelMonthLine(data.month, data.today.slice(0, 4))}
        </p>
      </header>
      {error && <Alert>{error}</Alert>}

      <section className="panel hk-cab__section" aria-labelledby="hk-units-title" data-testid="hotel-my-units">
        <h2 id="hk-units-title">
          Мои уборки сегодня <span className="muted">{toClean ? `осталось ${toClean}` : 'всё убрано'}</span>
        </h2>
        {data.units.length === 0 ? (
          <EmptyState title="Номеров на уборку нет" details="Руководитель назначает, кто убирает номер, в карточке номера." />
        ) : (
          <ul className="hk-cab__list">
            {data.units.map((u) => (
              <li key={u.code} className="hk-cab__row" data-testid="hotel-unit" data-status={u.status}>
                <div className="hk-cab__what">
                  <strong>Номер {u.roomNumber}</strong>
                  <span className="muted">{[u.categoryName, u.place].filter(Boolean).join(', ')}</span>
                  <span className="hk-cab__state">
                    <Badge tone={BADGE_TONE[housekeepingStatus[u.status].tone]}>{housekeepingStatus[u.status].label}</Badge>
                    <span className="muted">{hotelUnitNote(u.status, u.cleanedToday)}</span>
                  </span>
                </div>
                {u.status === 'DIRTY' && (
                  <Button
                    className="hk-cab__action"
                    disabled={busy !== null}
                    onClick={() => act(`unit:${u.code}`, () => cleanUnitAction(u.code))}
                    aria-label={`Убрано: номер ${u.roomNumber}`}
                  >
                    {busy === `unit:${u.code}` ? 'Сохраняю…' : 'Убрано'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel hk-cab__section" aria-labelledby="hk-tasks-title" data-testid="hotel-my-tasks">
        <h2 id="hk-tasks-title">
          Мои задачи <span className="muted">{openTasks ? `открыто ${openTasks}` : 'всё сделано'}</span>
        </h2>
        {data.tasks.length === 0 ? (
          <EmptyState title="Задач на сегодня нет" />
        ) : (
          <ul className="hk-cab__list">
            {data.tasks.map((t) => (
              <li key={t.id} className="hk-cab__row" data-testid="hotel-task" data-done={t.done ? 'true' : 'false'}>
                <div className="hk-cab__what">
                  <strong>{t.title}</strong>
                  {t.note && <span className="muted">{t.note}</span>}
                  <span className={t.overdue ? 'hk-cab__late' : 'muted'}>{hotelTaskDue(t, data.today)}</span>
                </div>
                {!t.done && (
                  <Button
                    className="hk-cab__action"
                    tone="secondary"
                    disabled={busy !== null}
                    onClick={() => act(`task:${t.id}`, () => taskDoneAction(t.id))}
                    aria-label={`Сделано: ${t.title}`}
                  >
                    {busy === `task:${t.id}` ? 'Сохраняю…' : 'Сделано'}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel hk-cab__section" aria-labelledby="hk-week-title" data-testid="hotel-my-week">
        <h2 id="hk-week-title">Мой график</h2>
        {data.week.every((d) => d.intervals.length === 0) ? (
          <p className="muted">График пока не задан: его ставит руководитель в разделе «График работы».</p>
        ) : (
          <ul className="hk-cab__week">
            {data.week.map((d) => (
              <li key={d.weekday}>
                <span>{DAYS[d.weekday]}</span>
                <span className={d.intervals.length ? undefined : 'muted'}>
                  {d.intervals.length ? d.intervals.map((i) => `${i.timeFrom}–${i.timeTo}`).join(', ') : 'выходной'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel hk-cab__section" aria-labelledby="hk-pay-title" data-testid="hotel-my-pay">
        <h2 id="hk-pay-title">Моя зарплата за месяц</h2>
        <dl className="hk-cab__pay">
          <div>
            <dt>Оклад</dt>
            <dd>{money(data.pay.fixedMinor)}</dd>
          </div>
          <div>
            <dt>За уборки</dt>
            <dd>
              {money(data.pay.pieceMinor)}
              {data.pay.cleanings > 0 && BigInt(data.pay.perCleaningMinor) > 0n && (
                <span className="muted"> ({data.pay.cleanings} × {money(data.pay.perCleaningMinor)})</span>
              )}
            </dd>
          </div>
          <div>
            <dt>Премии</dt>
            <dd>{money(data.pay.bonusMinor)}</dd>
          </div>
          <div>
            <dt>Удержания</dt>
            <dd>{money(data.pay.penaltyMinor)}</dd>
          </div>
          <div className="hk-cab__total">
            <dt>Начислено</dt>
            <dd data-testid="hotel-pay-total">{money(data.pay.totalMinor)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

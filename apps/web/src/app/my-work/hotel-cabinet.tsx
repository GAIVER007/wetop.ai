'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { HotelStaffCabinetDto } from '@pms/domain';
import { Alert, Badge, BADGE_TONE, Button, EmptyState } from '../../components/ui';
import { housekeepingStatus } from '../../lib/status/housekeeping';
import { formatMoney } from '../../lib/money';
import { hotelMonthLine, hotelTaskDue, hotelUnitNote } from '../../lib/hotel-cabinet';
import { cleanUnitAction, taskDoneAction } from '../hotel-staff/actions';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';

const DAYS: Record<number, string> = { 1: msg('Пн'), 2: msg('Вт'), 3: msg('Ср'), 4: msg('Чт'), 5: msg('Пт'), 6: msg('Сб'), 0: msg('Вс') };

/**
 * «Моя работа» горничной и ресепшена гостиницы (решение владельца 22.10.2026): телефон первым, сверху то, что
 * делать сейчас: «Мои уборки сегодня» с кнопкой «Убрано», затем «Мои задачи» с «Сделано», потом неделя и зарплата.
 * Итоги месяца одной строкой (без плиток). Права решает API: чужой номер и чужая задача получают отказ словами.
 */
export function HotelCabinet({ data }: { data: HotelStaffCabinetDto }) {
  const router = useRouter();
  const t = useT();
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
          <Badge>{t('Мой кабинет')}</Badge>
          <h2>{data.me.name}</h2>
          <p className="muted">{data.property.name}</p>
        </div>
        <p className="hk-cab__month" data-testid="hotel-month-line">
          {hotelMonthLine(data.month, data.today.slice(0, 4))}
        </p>
      </header>
      {error && <Alert>{t(error)}</Alert>}

      <section className="panel hk-cab__section" aria-labelledby="hk-units-title" data-testid="hotel-my-units">
        <h2 id="hk-units-title">
          {t('Мои уборки сегодня')} <span className="muted">{toClean ? t('осталось {n}', { n: toClean }) : t('всё убрано')}</span>
        </h2>
        {data.units.length === 0 ? (
          <EmptyState title={t('Номеров на уборку нет')} details={t('Руководитель назначает, кто убирает номер, в карточке номера.')} />
        ) : (
          <ul className="hk-cab__list">
            {data.units.map((u) => (
              <li key={u.code} className="hk-cab__row" data-testid="hotel-unit" data-status={u.status}>
                <div className="hk-cab__what">
                  <strong>{t('Номер {n}', { n: u.roomNumber })}</strong>
                  <span className="muted">{[u.categoryName, u.place].filter(Boolean).join(', ')}</span>
                  <span className="hk-cab__state">
                    <Badge tone={BADGE_TONE[housekeepingStatus[u.status].tone]}>{t(housekeepingStatus[u.status].label)}</Badge>
                    <span className="muted">{t(hotelUnitNote(u.status, u.cleanedToday))}</span>
                  </span>
                </div>
                {u.status === 'DIRTY' && (
                  <Button
                    className="hk-cab__action"
                    disabled={busy !== null}
                    onClick={() => act(`unit:${u.code}`, () => cleanUnitAction(u.code))}
                    aria-label={t('Убрано: номер {n}', { n: u.roomNumber })}
                  >
                    {busy === `unit:${u.code}` ? t('Сохраняю…') : t('Убрано')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel hk-cab__section" aria-labelledby="hk-tasks-title" data-testid="hotel-my-tasks">
        <h2 id="hk-tasks-title">
          {t('Мои задачи')} <span className="muted">{openTasks ? t('открыто {n}', { n: openTasks }) : t('всё сделано')}</span>
        </h2>
        {data.tasks.length === 0 ? (
          <EmptyState title={t('Задач на сегодня нет')} />
        ) : (
          <ul className="hk-cab__list">
            {data.tasks.map((task) => (
              <li key={task.id} className="hk-cab__row" data-testid="hotel-task" data-done={task.done ? 'true' : 'false'}>
                <div className="hk-cab__what">
                  <strong>{task.title}</strong>
                  {task.note && <span className="muted">{task.note}</span>}
                  <span className={task.overdue ? 'hk-cab__late' : 'muted'}>{t(hotelTaskDue(task, data.today))}</span>
                </div>
                {!task.done && (
                  <Button
                    className="hk-cab__action"
                    tone="secondary"
                    disabled={busy !== null}
                    onClick={() => act(`task:${task.id}`, () => taskDoneAction(task.id))}
                    aria-label={t('Сделано: {title}', { title: task.title })}
                  >
                    {busy === `task:${task.id}` ? t('Сохраняю…') : t('Сделано')}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel hk-cab__section" aria-labelledby="hk-week-title" data-testid="hotel-my-week">
        <h2 id="hk-week-title">{t('Мой график')}</h2>
        {data.week.every((d) => d.intervals.length === 0) ? (
          <p className="muted">{t('График пока не задан: его ставит руководитель в разделе «График работы».')}</p>
        ) : (
          <ul className="hk-cab__week">
            {data.week.map((d) => (
              <li key={d.weekday}>
                <span>{t(DAYS[d.weekday] ?? '')}</span>
                <span className={d.intervals.length ? undefined : 'muted'}>
                  {d.intervals.length ? d.intervals.map((i) => `${i.timeFrom}–${i.timeTo}`).join(', ') : t('выходной')}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel hk-cab__section" aria-labelledby="hk-pay-title" data-testid="hotel-my-pay">
        <h2 id="hk-pay-title">{t('Моя зарплата за месяц')}</h2>
        <dl className="hk-cab__pay">
          <div>
            <dt>{t('Оклад')}</dt>
            <dd>{money(data.pay.fixedMinor)}</dd>
          </div>
          <div>
            <dt>{t('За уборки')}</dt>
            <dd>
              {money(data.pay.pieceMinor)}
              {data.pay.cleanings > 0 && BigInt(data.pay.perCleaningMinor) > 0n && (
                <span className="muted"> ({data.pay.cleanings} × {money(data.pay.perCleaningMinor)})</span>
              )}
            </dd>
          </div>
          <div>
            <dt>{t('Премии')}</dt>
            <dd>{money(data.pay.bonusMinor)}</dd>
          </div>
          <div>
            <dt>{t('Удержания')}</dt>
            <dd>{money(data.pay.penaltyMinor)}</dd>
          </div>
          <div className="hk-cab__total">
            <dt>{t('Начислено')}</dt>
            <dd data-testid="hotel-pay-total">{money(data.pay.totalMinor)}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}

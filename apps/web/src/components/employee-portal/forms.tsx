'use client';
import { useState, useTransition, type ReactNode } from 'react';
import type { EmployeePortalDto, PortalWeekDay } from '@pms/domain';
import { loadPortalWeek, savePortal } from '../../app/my-work/actions';
import { Alert, Button, Input } from '../ui';
import { useConfirm } from '../use-confirm';
import { employeeFormSignature } from '../employee-workspace/workspace';
export type PortalContext = {
  target: { employeeId: string | null }; scope: string; onSaved: (data: EmployeePortalDto) => void;
};
export function PortalForm({ context, command, children, label = 'Сохранить', revision, profileRevision, testId }: {
  context: PortalContext; command: string; children?: ReactNode; label?: string; revision?: string | null; profileRevision?: string; testId?: string;
}) {
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  // Dirty drafts keep their starting version; untouched forms can follow a sibling save.
  const [expectedRevision, setRevision] = useState(revision ?? '');
  const [expectedProfileRevision, setProfileRevision] = useState(profileRevision ?? '');
  const [dirty, setDirty] = useState(false);
  // Week inputs have their own controlled draft. Never rebase its version onto unseen remote hours.
  const formRevision = dirty || command === 'week' ? expectedRevision : (revision ?? expectedRevision);
  return <><form data-testid={testId ?? `portal-${command}-form`} className="portal-form" data-employee-transition-form
    onReset={event => event.preventDefault()}
    onChange={() => {
      if (!dirty && command !== 'week') setRevision(revision ?? expectedRevision);
      setDirty(true); setSaved(false);
    }}
    onSubmit={event => {
      event.preventDefault();
      const element = event.currentTarget;
      const snapshot = employeeFormSignature(element);
      const form = new FormData(element);
      setSaved(false); setError('');
      start(async () => {
        try {
          const result = await savePortal(context.target, context.scope, command, form);
          if (result.error || !result.data) {
            setError(result.error || 'Не удалось подтвердить сохранение. Повторите попытку.');
            element.dispatchEvent(new CustomEvent('employee-save-result', {
              bubbles: true,
              detail: { success: false },
            }));
            return;
          }
          element.dispatchEvent(new CustomEvent('employee-save-result', {
            bubbles: true,
            detail: { success: true, snapshot },
          }));
          context.onSaved(result.data); setSaved(true); setDirty(false);
          if (command === 'profile') setProfileRevision(result.data.employee.profileRevision);
          const next = command === 'services' ? result.data.servicesRevision : command === 'week' ? result.data.weekRevision : command === 'pay-policy' ? result.data.pay.policyRevision : result.data.profile.revision;
          setRevision(next ?? '');
        } catch {
          setError('Не удалось подтвердить сохранение. Ваш ввод сохранён в форме. Повторите попытку.');
          element.dispatchEvent(new CustomEvent('employee-save-result', {
            bubbles: true,
            detail: { success: false },
          }));
        }
      });
    }}>
    <input type="hidden" name="expectedRevision" value={formRevision} />
    {command === 'profile' && <input type="hidden" name="expectedProfileRevision" value={expectedProfileRevision} />}
    <fieldset key={formRevision} disabled={pending}>
      {children}
      <Button type="submit" disabled={pending}>{pending ? 'Сохраняем…' : label}</Button>
    </fieldset>
    {(pending || saved) && <p role="status">{pending ? 'Ждём подтверждение сервера…' : 'Сохранено на сервере'}</p>}
    {error && <Alert>{error}</Alert>}

    {error && <p>Ввод не сброшен. При конфликте откройте карточку в новой вкладке и сравните изменения.</p>}
    {error && command === 'profile' && <Button type="button" tone="secondary" onClick={async () => {
      if (!(await ask({
        title: 'Отменить черновик профиля?',
        body: 'Несохранённые изменения будут потеряны. Вместо них загрузится актуальный профиль сотрудника.',
        confirmLabel: 'Отменить черновик и загрузить профиль',
        cancelLabel: 'Оставить черновик',
      }))) return;
      window.location.reload();
    }}>Отменить черновик и загрузить профиль</Button>}
  </form>{dialog}</>;
}
const DAYS = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
/** Свой график сотрудник только видит: меняет руководитель (владелец, 17.10.2026) */
export function PortalWeekView({ week }: { week: PortalWeekDay[] }) {
  return <div data-testid="portal-week-view"><p className="portal-week-help">График меняет руководитель. Нет часов: выходной.</p>
    <ul className="portal-list">{[1, 2, 3, 4, 5, 6, 0].map(weekday => <li key={weekday}><strong>{DAYS[weekday]}</strong><span>{week.find(d => d.weekday === weekday)?.intervals.map(i => `${i.timeFrom}–${i.timeTo}`).join(', ') || 'Выходной'}</span></li>)}</ul></div>;
}
export function PortalWeek({ week, revision, context }: { week: PortalWeekDay[]; revision: string | null; context: PortalContext }) {
  const [days, setDays] = useState(() => [1, 2, 3, 4, 5, 6, 0].map(weekday => ({ weekday, intervals: week.find(d => d.weekday === weekday)?.intervals.map(i => ({ ...i })) ?? [] })));
  const [originalRevision, setOriginalRevision] = useState(revision);
  const [comparison, setComparison] = useState<EmployeePortalDto | null>(null);
  const [readError, setReadError] = useState('');
  const [reading, reread] = useTransition();
  const intervals = days.flatMap(day => day.intervals.map(slot => ({ weekday: day.weekday, ...slot })));
  return <><PortalForm key={originalRevision} context={context} command="week" revision={originalRevision} label="Сохранить график">
    <p className="portal-week-help">Рабочие часы по дням. Нет интервалов: выходной.</p>
    <input type="hidden" name="intervals" value={JSON.stringify(intervals)} />
    {days.map(day => <div className="portal-week-row" key={day.weekday} role="group" aria-label={DAYS[day.weekday]}>
      <strong><span className="portal-day-full">{DAYS[day.weekday]}</span><abbr className="portal-day-short" title={DAYS[day.weekday]}>{['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][day.weekday]}</abbr></strong>
      <div className="portal-week-slots">
      {!day.intervals.length && <span>Выходной</span>}
      {day.intervals.map((slot, index) => <div className="portal-time-row" key={index}>
        <label className="portal-time-field"><span>С</span><Input aria-label={`${DAYS[day.weekday]}: начало`} type="time" required value={slot.timeFrom} onChange={e => setDays(prev => prev.map(d => d.weekday === day.weekday ? { ...d, intervals: d.intervals.map((s, i) => i === index ? { ...s, timeFrom: e.target.value } : s) } : d))} /></label>
        <label className="portal-time-field"><span>До</span><Input aria-label={`${DAYS[day.weekday]}: до, интервал ${index + 1}`} type="time" required value={slot.timeTo} onChange={e => setDays(prev => prev.map(d => d.weekday === day.weekday ? { ...d, intervals: d.intervals.map((s, i) => i === index ? { ...s, timeTo: e.target.value } : s) } : d))} /></label>
        <Button type="button" tone="secondary" aria-label={`${DAYS[day.weekday]}: убрать интервал ${index + 1}`} onClick={() => setDays(prev => prev.map(d => d.weekday === day.weekday ? { ...d, intervals: d.intervals.filter((_, i) => i !== index) } : d))}>−</Button>
      </div>)}
      </div>
      <Button type="button" tone="secondary" aria-label={`${DAYS[day.weekday]}: добавить интервал`} onClick={() => setDays(prev => prev.map(d => d.weekday === day.weekday ? { ...d, intervals: [...d.intervals, { timeFrom: '', timeTo: '' }] } : d))}><span aria-hidden="true">+</span><span className="portal-add-label"> Ещё время</span></Button>
    </div>)}
  </PortalForm>
    <Button type="button" tone="secondary" disabled={reading} onClick={() => reread(async () => {
      const result = await loadPortalWeek(context.target, context.scope);
      setReadError(result.error ?? '');
      if (result.data) setComparison(result.data);
    })}>Сравнить с актуальным графиком</Button>
    {readError && <Alert>{readError}</Alert>}
    {comparison && <section aria-label="Сохранено на сервере">
      <h3>Сохранено на сервере</h3>
      <ul>{comparison.week.map(day => <li key={day.weekday}>{DAYS[day.weekday]}: {day.intervals.map(i => `${i.timeFrom} до ${i.timeTo}`).join(', ') || 'Выходной'}</li>)}</ul>
      <p>Ваш ввод остаётся в форме. Принятие сохранённого графика заменит черновик.</p>
      <Button type="button" tone="secondary" onClick={() => {
        setDays([1, 2, 3, 4, 5, 6, 0].map(weekday => ({ weekday, intervals: comparison.week.find(d => d.weekday === weekday)?.intervals.map(i => ({ ...i })) ?? [] })));
        setOriginalRevision(comparison.weekRevision); setComparison(null);
      }}>Принять сохранённый график</Button>
    </section>}
  </>;
}

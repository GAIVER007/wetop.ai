'use client';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import type { EmployeePortalDto, PortalWeekDay } from '@pms/domain';
import { loadPortalWeek, savePortal } from '../../app/my-work/actions';
import { Alert, Button, Input } from '../ui';
import { useConfirm } from '../use-confirm';
import { employeeFormSignature } from '../employee-workspace/workspace';
import { applyWeekPreset, weekProblem, WEEK_PRESETS } from './week-presets';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
export type PortalContext = {
  target: { employeeId: string | null }; scope: string; onSaved: (data: EmployeePortalDto) => void;
};
export function PortalForm({ context, command, children, label = msg('Сохранить'), revision, profileRevision, testId, validate }: {
  context: PortalContext; command: string; children?: ReactNode; label?: string; revision?: string | null; profileRevision?: string; testId?: string;
  /** своя проверка до отправки, словами по-русски; браузерную подсказку тогда выключаем (аудит 21.10.2026, п. 2) */
  validate?: () => string | null;
}) {
  const t = useT();
  const [pending, start] = useTransition();
  const { ask, dialog } = useConfirm();
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState('');
  const [saved, setSaved] = useState(false);
  // Dirty drafts keep their starting version; untouched forms can follow a sibling save.
  const [expectedRevision, setRevision] = useState(revision ?? '');
  const [expectedProfileRevision, setProfileRevision] = useState(profileRevision ?? '');
  const [dirty, setDirty] = useState(false);
  const [rebaseline, setRebaseline] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const form = formRef.current;
    if (!rebaseline || !form) return;
    form.dispatchEvent(new CustomEvent('employee-save-result', {
      bubbles: true,
      detail: { success: true, snapshot: employeeFormSignature(form) },
    }));
  }, [rebaseline]);
  const alive = useRef(true);
  const requestVersion = useRef(0);
  useEffect(() => {
    alive.current = true;
    const invalidate = () => {
      requestVersion.current++;
    };
    window.addEventListener('wetop-scope-switch', invalidate);
    return () => {
      alive.current = false;
      requestVersion.current++;
      window.removeEventListener('wetop-scope-switch', invalidate);
    };
  }, [context.scope]);
  // An untouched form follows the latest version; PortalWeek passes a newer one only when its hours match the server.
  const formRevision = dirty ? expectedRevision : (revision ?? expectedRevision);
  return <><form ref={formRef} data-testid={testId ?? `portal-${command}-form`} className="portal-form" data-employee-transition-form
    noValidate={validate ? true : undefined}
    onReset={event => event.preventDefault()}
    onChange={() => {
      if (!dirty) setRevision(revision ?? expectedRevision);
      setDirty(true); setSaved(false); setInvalid('');
    }}
    onSubmit={event => {
      event.preventDefault();
      const problem = validate?.();
      if (problem) {
        // «Сохранено» не показываем, пока проверка не прошла
        setSaved(false); setError(''); setInvalid(problem);
        return;
      }
      setInvalid('');
      const element = event.currentTarget;
      const snapshot = employeeFormSignature(element);
      const form = new FormData(element);
      const version = ++requestVersion.current;
      setSaved(false); setError('');
      start(async () => {
        try {
          const result = await savePortal(context.target, context.scope, command, form);
          if (!alive.current || version !== requestVersion.current) return;
          if (result.error || !result.data) {
            setError(result.error || msg('Не удалось подтвердить сохранение. Повторите попытку.'));
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
          // Upload forms create a new item: the remounted fieldset comes back empty, so re-baseline after that render.
          if (element.querySelector('input[type="file"]')) setRebaseline(n => n + 1);
          context.onSaved(result.data); setSaved(true); setDirty(false);
          if (command === 'profile') setProfileRevision(result.data.employee.profileRevision);
          const next = command === 'services' ? result.data.servicesRevision : command === 'week' ? result.data.weekRevision : command === 'pay-policy' ? result.data.pay.policyRevision : result.data.profile.revision;
          setRevision(next ?? '');
        } catch {
          if (!alive.current || version !== requestVersion.current) return;
          setError(msg('Не удалось подтвердить сохранение. Ваш ввод сохранён в форме. Повторите попытку.'));
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
      <Button type="submit" disabled={pending}>{pending ? t('Сохраняем…') : t(label)}</Button>
    </fieldset>
    {(pending || saved) && <p role="status">{pending ? t('Ждём подтверждение сервера…') : t('Сохранено на сервере')}</p>}
    {invalid && <Alert>{t(invalid)}</Alert>}
    {error && <Alert>{t(error)}</Alert>}

    {error && <p>{t('Ввод не сброшен. При конфликте откройте карточку в новой вкладке и сравните изменения.')}</p>}
    {error && command === 'profile' && <Button type="button" tone="secondary" onClick={async () => {
      if (!(await ask({
        title: t('Отменить черновик профиля?'),
        body: t('Несохранённые изменения будут потеряны. Вместо них загрузится актуальный профиль сотрудника.'),
        confirmLabel: t('Отменить черновик и загрузить профиль'),
        cancelLabel: t('Оставить черновик'),
      }))) return;
      window.location.reload();
    }}>{t('Отменить черновик и загрузить профиль')}</Button>}
  </form>{dialog}</>;
}
const DAYS = [msg('Воскресенье'), msg('Понедельник'), msg('Вторник'), msg('Среда'), msg('Четверг'), msg('Пятница'), msg('Суббота')];
const SHORT_DAYS = [msg('Вс'), msg('Пн'), msg('Вт'), msg('Ср'), msg('Чт'), msg('Пт'), msg('Сб')];
/** Свой график сотрудник только видит: меняет руководитель (владелец, 17.10.2026) */
export function PortalWeekView({ week }: { week: PortalWeekDay[] }) {
  const t = useT();
  return <div data-testid="portal-week-view"><p className="portal-week-help">{t('График меняет руководитель. Нет часов: выходной.')}</p>
    <ul className="portal-list">{[1, 2, 3, 4, 5, 6, 0].map(weekday => { const hours = week.find(d => d.weekday === weekday)?.intervals.map(i => `${i.timeFrom}–${i.timeTo}`).join(', '); return <li key={weekday} data-testid="portal-week-day" data-off={hours ? undefined : 'true'}><strong>{t(DAYS[weekday] ?? '')}</strong><span>{hours || t('Выходной')}</span></li>; })}</ul></div>;
}
const weekDays = (week: PortalWeekDay[]) => [1, 2, 3, 4, 5, 6, 0].map(weekday => ({ weekday, intervals: week.find(d => d.weekday === weekday)?.intervals.map(i => ({ ...i })) ?? [] }));
export function PortalWeek({ week, revision, context }: { week: PortalWeekDay[]; revision: string | null; context: PortalContext }) {
  const t = useT();
  const [days, setDays] = useState(() => weekDays(week));
  const [originalRevision, setOriginalRevision] = useState(revision);
  // The week version also moves when the profile is saved. When new server data arrives and the hours on screen still
  // equal the server's, the draft takes the new version; edited hours keep theirs and get a conflict, not a lost update.
  const [base, setBase] = useState(revision);
  const hours = useRef(days);
  hours.current = days;
  useEffect(() => {
    if (JSON.stringify(weekDays(week)) === JSON.stringify(hours.current)) setBase(revision);
  }, [revision, week]);
  const [comparison, setComparison] = useState<EmployeePortalDto | null>(null);
  const [readError, setReadError] = useState('');
  const [reading, reread] = useTransition();
  const intervals = days.flatMap(day => day.intervals.map(slot => ({ weekday: day.weekday, ...slot })));
  return <><PortalForm key={originalRevision} context={context} command="week" revision={base} label={t('Сохранить график')} validate={() => weekProblem(hours.current, t)}>
    <p className="portal-week-help">{t('Рабочие часы по дням. Нет интервалов: выходной.')}</p>
    {/* быстрый шаблон недели (онбординг 21.10.2026): заполняет все дни, дальше можно поправить день */}
    <div className="portal-week-presets" role="group" aria-label={t('Быстро заполнить неделю')}>
      <span>{t('Заполнить:')}</span>
      {WEEK_PRESETS.map((preset) => <Button key={preset.label} type="button" size="sm" tone="secondary" onClick={() => setDays(prev => applyWeekPreset(prev, preset))}>{t(preset.label)}</Button>)}
    </div>
    <input type="hidden" name="intervals" value={JSON.stringify(intervals)} />
    {days.map(day => <div className="portal-week-row" key={day.weekday} role="group" aria-label={t(DAYS[day.weekday] ?? '')}>
      <strong><span className="portal-day-full">{t(DAYS[day.weekday] ?? '')}</span><abbr className="portal-day-short" title={t(DAYS[day.weekday] ?? '')}>{t(SHORT_DAYS[day.weekday] ?? '')}</abbr></strong>
      <div className="portal-week-slots">
      {!day.intervals.length && <span>{t('Выходной')}</span>}
      {day.intervals.map((slot, index) => <div className="portal-time-row" key={index}>
        <label className="portal-time-field"><span>{t('С')}</span><Input aria-label={t('{day}: начало', { day: t(DAYS[day.weekday] ?? '') })} type="time" required value={slot.timeFrom} onChange={e => setDays(prev => prev.map(d => d.weekday === day.weekday ? { ...d, intervals: d.intervals.map((s, i) => i === index ? { ...s, timeFrom: e.target.value } : s) } : d))} /></label>
        <label className="portal-time-field"><span>{t('До')}</span><Input aria-label={t('{day}: до, интервал {n}', { day: t(DAYS[day.weekday] ?? ''), n: index + 1 })} type="time" required value={slot.timeTo} onChange={e => setDays(prev => prev.map(d => d.weekday === day.weekday ? { ...d, intervals: d.intervals.map((s, i) => i === index ? { ...s, timeTo: e.target.value } : s) } : d))} /></label>
        <Button type="button" tone="secondary" aria-label={t('{day}: убрать интервал {n}', { day: t(DAYS[day.weekday] ?? ''), n: index + 1 })} onClick={() => setDays(prev => prev.map(d => d.weekday === day.weekday ? { ...d, intervals: d.intervals.filter((_, i) => i !== index) } : d))}>−</Button>
      </div>)}
      </div>
      <Button type="button" tone="secondary" aria-label={t('{day}: добавить интервал', { day: t(DAYS[day.weekday] ?? '') })} onClick={() => setDays(prev => prev.map(d => d.weekday === day.weekday ? { ...d, intervals: [...d.intervals, { timeFrom: '', timeTo: '' }] } : d))}><span aria-hidden="true">+</span><span className="portal-add-label"> {t('Ещё время')}</span></Button>
    </div>)}
  </PortalForm>
    <Button type="button" tone="secondary" disabled={reading} onClick={() => reread(async () => {
      const result = await loadPortalWeek(context.target, context.scope);
      setReadError(result.error ?? '');
      if (result.data) setComparison(result.data);
    })}>{t('Сравнить с актуальным графиком')}</Button>
    {readError && <Alert>{t(readError)}</Alert>}
    {comparison && <section aria-label={t('Сохранено на сервере')}>
      <h3>{t('Сохранено на сервере')}</h3>
      <ul>{comparison.week.map(day => <li key={day.weekday}>{t(DAYS[day.weekday] ?? '')}: {day.intervals.map(i => t('{from} до {to}', { from: i.timeFrom, to: i.timeTo })).join(', ') || t('Выходной')}</li>)}</ul>
      <p>{t('Ваш ввод остаётся в форме. Принятие сохранённого графика заменит черновик.')}</p>
      <Button type="button" tone="secondary" onClick={() => {
        setDays(weekDays(comparison.week));
        setOriginalRevision(comparison.weekRevision); setBase(comparison.weekRevision); setComparison(null);
      }}>{t('Принять сохранённый график')}</Button>
    </section>}
  </>;
}

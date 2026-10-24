 'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import type { OpeningState } from '../../lib/opening-api';
import { openingDraft, openingInput } from './opening-input';
import { saveOpening } from './opening-actions';
import { zoneLabel } from '../../lib/human-period';
import { msg } from '../../i18n';
import { useT } from '../../i18n/locale-provider';
const days = [msg('Воскресенье'),msg('Понедельник'),msg('Вторник'),msg('Среда'),msg('Четверг'),msg('Пятница'),msg('Суббота')];
export function OpeningForm({ initial, scopeKey, timezone, write }: { initial: OpeningState; scopeKey: string; timezone: string; write: boolean }) {
 const [draft,setDraft] = useState(()=>openingDraft(initial.schedule));
 const [confirmed,setConfirmed] = useState(false);
 const [error,setError] = useState(''); const [saved,setSaved] = useState(false);
 const [pending,start] = useTransition(); const router = useRouter(); const t = useT();
 const blocked = !write || pending || !initial.enabled || !!initial.error;
 return <section aria-labelledby="physical-opening-title">
  <h2 id="physical-opening-title">{t('Часы работы зала')}</h2>
  {/* учёт выключен, пока таблицы часов лежат в migrations-hold (ADR-137, аудит 22.10.2026 P1-6): одна фраза владельцу */}
  {!initial.enabled ? <p role="status">{t('Часы работы зала настраиваются командой WETOP. Напишите в поддержку, и их включат для вашего ресторана.')}</p> : <>
   <p className="muted">{t('Физическая работа всего филиала, не периоды приёма броней. Часовой пояс: {zone}. Дни без интервалов закрыты, круглосуточная работа не подставляется.', { zone: zoneLabel(timezone, t) })}</p>
   {initial.error && <Alert>{t(initial.error)}</Alert>}
   {!initial.schedule && !initial.error && <p role="status">{t('Расписание не подтверждено. Нет доступного расписания для расчёта загрузки.')}</p>}
   {initial.schedule && <p className="muted">{t('Подтверждение источника (recorded_at):')} <time dateTime={initial.schedule.recorded_at}>{initial.schedule.recorded_at}</time>. {t('Загрузка учитывается только с момента захвата (observedAt), не раньше подтверждения. История до наблюдения не восстанавливается.')}</p>}
   {initial.schedule?.area_id && <Alert>{t('Сохранена только одна зона. Это не полное покрытие филиала. Подтверждение ниже заменит её расписанием всего филиала.')}</Alert>}
   {initial.schedule && initial.schedule.timezone !== timezone && <Alert>{t('Часовой пояс изменён. Требуется новое подтверждение.')}</Alert>}
   <form className="food-form" onSubmit={e=>{e.preventDefault();setError('');setSaved(false);try{openingInput(draft);if(!confirmed) throw new Error(msg('Подтвердите физические часы работы зала.'));}catch(e){setError(e instanceof Error ? e.message : msg('Проверьте поля.'));return;}start(async()=>{const result=await saveOpening(scopeKey,draft,confirmed);if(result.error){setError(result.error);return;}setSaved(true);setConfirmed(false);router.refresh();});}}>
    <fieldset disabled={blocked}>
     <legend>{t('Период действия и интервалы физической работы')}</legend>
     <Field label={t('Действует с')} required><Input type="date" value={draft.effectiveFrom} onChange={e=>setDraft({...draft,effectiveFrom:e.target.value})} /></Field>
     <Field label={t('Действует по включительно')} required><Input type="date" value={draft.effectiveTo} onChange={e=>setDraft({...draft,effectiveTo:e.target.value})} /></Field>
     {draft.intervals.map((i,n)=><div className="food-form" key={n}>
      <Field label={t('День недели')}><Select value={i.weekday} onChange={e=>setDraft({...draft,intervals:draft.intervals.map((v,k)=>k===n?{...v,weekday:Number(e.target.value)}:v)})}>{days.map((d,w)=><option value={w} key={w}>{t(d)}</option>)}</Select></Field>
      <Field label={t('Открытие')} required><Input type="time" value={i.localStart} onChange={e=>setDraft({...draft,intervals:draft.intervals.map((v,k)=>k===n?{...v,localStart:e.target.value}:v)})}/></Field>
      <Field label={t('Закрытие')} required><Input type="time" value={i.localEnd} onChange={e=>setDraft({...draft,intervals:draft.intervals.map((v,k)=>k===n?{...v,localEnd:e.target.value}:v)})}/></Field>
      <label><input type="checkbox" checked={i.endsNextDay} onChange={e=>setDraft({...draft,intervals:draft.intervals.map((v,k)=>k===n?{...v,endsNextDay:e.target.checked}:v)})}/> {t('Закрытие на следующий день')}</label>
      <Button type="button" tone="secondary" onClick={()=>setDraft({...draft,intervals:draft.intervals.filter((_,k)=>k!==n)})}>{t('Удалить интервал {n}', { n: n+1 })}</Button>
     </div>)}
     <Button type="button" tone="secondary" disabled={draft.intervals.length>=100} onClick={()=>setDraft({...draft,intervals:[...draft.intervals,{weekday:1,localStart:'',localEnd:'',endsNextDay:false}]})}>{t('Добавить интервал')}</Button>
     <h3>{t('Закрытые даты зала')}</h3><p className="muted">{t('Полные местные календарные даты, включая ночную часть предыдущего дня. Это не закрытие приёма броней.')}</p>
     {draft.closures.map((c,n)=><div className="food-form" key={n}>
      <Field label={t('Закрытая дата')} required><Input type="date" value={c.day} onChange={e=>setDraft({...draft,closures:draft.closures.map((v,k)=>k===n?{...v,day:e.target.value}:v)})}/></Field>
      <Field label={t('Причина закрытия')} required><Input maxLength={500} value={c.reason} onChange={e=>setDraft({...draft,closures:draft.closures.map((v,k)=>k===n?{...v,reason:e.target.value}:v)})}/></Field>
      <Button type="button" tone="secondary" onClick={()=>setDraft({...draft,closures:draft.closures.filter((_,k)=>k!==n)})}>{t('Удалить закрытую дату {n}', { n: n+1 })}</Button>
     </div>)}
     <Button type="button" tone="secondary" disabled={draft.closures.length>=367} onClick={()=>setDraft({...draft,closures:[...draft.closures,{day:'',reason:''}]})}>{t('Добавить закрытую дату')}</Button>
     <p className="muted">{t('Сохранение заменяет всё расписание новой наблюдаемой версией. Прошлая история сохраняется. Пустой список интервалов означает отсутствие доступных часов.')}</p>
     <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> {t('Подтверждаю физические часы работы всего филиала, не часы бронирования')}</label>
     {write && <Button type="submit" disabled={!confirmed || pending}>{pending ? t('Сохранение…') : t('Подтвердить и сохранить часы зала')}</Button>}
    </fieldset>
    {error && <Alert>{t(error)}</Alert>}{saved && <p role="status">{t('Часы зала сохранены. Новая версия доступна после обновления страницы.')}</p>}
   </form>
  </>}
 </section>;
}

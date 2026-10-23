 'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Alert, Button, Field, Input, Select } from '../../components/ui';
import type { OpeningState } from '../../lib/opening-api';
import { openingDraft, openingInput } from './opening-input';
import { saveOpening } from './opening-actions';
import { zoneLabel } from '../../lib/human-period';
const days = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
export function OpeningForm({ initial, scopeKey, timezone, write }: { initial: OpeningState; scopeKey: string; timezone: string; write: boolean }) {
 const [draft,setDraft] = useState(()=>openingDraft(initial.schedule));
 const [confirmed,setConfirmed] = useState(false);
 const [error,setError] = useState(''); const [saved,setSaved] = useState(false);
 const [pending,start] = useTransition(); const router = useRouter();
 const blocked = !write || pending || !initial.enabled || !!initial.error;
 return <section aria-labelledby="physical-opening-title">
  <h2 id="physical-opening-title">Часы работы зала</h2>
  {/* учёт выключен, пока таблицы часов лежат в migrations-hold (ADR-137, аудит 22.10.2026 P1-6): одна фраза владельцу */}
  {!initial.enabled ? <p role="status">Часы работы зала настраиваются командой WETOP. Напишите в поддержку, и их включат для вашего ресторана.</p> : <>
   <p className="muted">Физическая работа всего филиала, не периоды приёма броней. Часовой пояс: {zoneLabel(timezone)}. Дни без интервалов закрыты, круглосуточная работа не подставляется.</p>
   {initial.error && <Alert>{initial.error}</Alert>}
   {!initial.schedule && !initial.error && <p role="status">Расписание не подтверждено. Нет доступного расписания для расчёта загрузки.</p>}
   {initial.schedule && <p className="muted">Подтверждение источника (recorded_at): <time dateTime={initial.schedule.recorded_at}>{initial.schedule.recorded_at}</time>. Загрузка учитывается только с момента захвата (observedAt), не раньше подтверждения. История до наблюдения не восстанавливается.</p>}
   {initial.schedule?.area_id && <Alert>Сохранена только одна зона. Это не полное покрытие филиала. Подтверждение ниже заменит её расписанием всего филиала.</Alert>}
   {initial.schedule && initial.schedule.timezone !== timezone && <Alert>Часовой пояс изменён. Требуется новое подтверждение.</Alert>}
   <form className="food-form" onSubmit={e=>{e.preventDefault();setError('');setSaved(false);try{openingInput(draft);if(!confirmed) throw new Error('Подтвердите физические часы работы зала.');}catch(e){setError(e instanceof Error ? e.message : 'Проверьте поля.');return;}start(async()=>{const result=await saveOpening(scopeKey,draft,confirmed);if(result.error){setError(result.error);return;}setSaved(true);setConfirmed(false);router.refresh();});}}>
    <fieldset disabled={blocked}>
     <legend>Период действия и интервалы физической работы</legend>
     <Field label="Действует с" required><Input type="date" value={draft.effectiveFrom} onChange={e=>setDraft({...draft,effectiveFrom:e.target.value})} /></Field>
     <Field label="Действует по включительно" required><Input type="date" value={draft.effectiveTo} onChange={e=>setDraft({...draft,effectiveTo:e.target.value})} /></Field>
     {draft.intervals.map((i,n)=><div className="food-form" key={n}>
      <Field label="День недели"><Select value={i.weekday} onChange={e=>setDraft({...draft,intervals:draft.intervals.map((v,k)=>k===n?{...v,weekday:Number(e.target.value)}:v)})}>{days.map((d,w)=><option value={w} key={w}>{d}</option>)}</Select></Field>
      <Field label="Открытие" required><Input type="time" value={i.localStart} onChange={e=>setDraft({...draft,intervals:draft.intervals.map((v,k)=>k===n?{...v,localStart:e.target.value}:v)})}/></Field>
      <Field label="Закрытие" required><Input type="time" value={i.localEnd} onChange={e=>setDraft({...draft,intervals:draft.intervals.map((v,k)=>k===n?{...v,localEnd:e.target.value}:v)})}/></Field>
      <label><input type="checkbox" checked={i.endsNextDay} onChange={e=>setDraft({...draft,intervals:draft.intervals.map((v,k)=>k===n?{...v,endsNextDay:e.target.checked}:v)})}/> Закрытие на следующий день</label>
      <Button type="button" tone="secondary" onClick={()=>setDraft({...draft,intervals:draft.intervals.filter((_,k)=>k!==n)})}>Удалить интервал {n+1}</Button>
     </div>)}
     <Button type="button" tone="secondary" disabled={draft.intervals.length>=100} onClick={()=>setDraft({...draft,intervals:[...draft.intervals,{weekday:1,localStart:'',localEnd:'',endsNextDay:false}]})}>Добавить интервал</Button>
     <h3>Закрытые даты зала</h3><p className="muted">Полные местные календарные даты, включая ночную часть предыдущего дня. Это не закрытие приёма броней.</p>
     {draft.closures.map((c,n)=><div className="food-form" key={n}>
      <Field label="Закрытая дата" required><Input type="date" value={c.day} onChange={e=>setDraft({...draft,closures:draft.closures.map((v,k)=>k===n?{...v,day:e.target.value}:v)})}/></Field>
      <Field label="Причина закрытия" required><Input maxLength={500} value={c.reason} onChange={e=>setDraft({...draft,closures:draft.closures.map((v,k)=>k===n?{...v,reason:e.target.value}:v)})}/></Field>
      <Button type="button" tone="secondary" onClick={()=>setDraft({...draft,closures:draft.closures.filter((_,k)=>k!==n)})}>Удалить закрытую дату {n+1}</Button>
     </div>)}
     <Button type="button" tone="secondary" disabled={draft.closures.length>=367} onClick={()=>setDraft({...draft,closures:[...draft.closures,{day:'',reason:''}]})}>Добавить закрытую дату</Button>
     <p className="muted">Сохранение заменяет всё расписание новой наблюдаемой версией. Прошлая история сохраняется. Пустой список интервалов означает отсутствие доступных часов.</p>
     <label><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/> Подтверждаю физические часы работы всего филиала, не часы бронирования</label>
     {write && <Button type="submit" disabled={!confirmed || pending}>{pending ? 'Сохранение…' : 'Подтвердить и сохранить часы зала'}</Button>}
    </fieldset>
    {error && <Alert>{error}</Alert>}{saved && <p role="status">Часы зала сохранены. Новая версия доступна после обновления страницы.</p>}
   </form>
  </>}
 </section>;
}

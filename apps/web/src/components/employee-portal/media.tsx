'use client';
import type { EmployeePortalDto, PortalWork } from '@pms/domain';
import { Field, Input, Select } from '../ui';
import { PortalForm, type PortalContext } from './forms';
export function PortalMedia({ data, context }: { data: EmployeePortalDto; context: PortalContext }) {
  return <>
    <section className="panel portal-section" data-testid="portal-avatar"><h2>Фото профиля</h2>
      {data.avatar ? <img className="portal-avatar" src={data.avatar.url} alt={`Фото: ${data.employee.name}`} width={120} height={120} /> : <p>Фото пока нет</p>}
      {data.canUpload ? <>
        <p>JPG, PNG или WebP до 5 МиБ. Старое фото остаётся до подтверждения загрузки сервером.</p>
        <PortalForm context={context} command="avatar" label="Загрузить фото"><Field label="Новое фото"><Input name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></Field></PortalForm>
      </> : null}
      {data.avatar && <PortalForm context={context} command="remove-avatar" label="Удалить фото" />}
    </section>
    <section className="panel portal-section" data-testid="portal-portfolio"><h2>Портфолио</h2>
      <p>Без согласия на публикацию работа не показывается клиентам. Изменения сотрудника требуют повторного одобрения руководителя.</p>
      {!data.portfolio.length && <p>Работ пока нет. Добавьте первую работу как черновик.</p>}
      <div className="portal-gallery">{data.portfolio.map(work => <article key={work.id}>
        <img src={work.image.url} alt={work.title} width={work.image.width} height={work.image.height} />
        <strong>{work.title}</strong>
        <p>{work.published ? 'Опубликовано' : 'Черновик / ожидает одобрения'}</p>
        <details><summary>Редактировать работу</summary>
        <PortalForm context={context} command="work" label="Сохранить работу"><WorkFields data={data} work={work} /></PortalForm>
        <PortalForm context={context} command="remove-work" label="Удалить работу"><input type="hidden" name="workId" value={work.id} /></PortalForm>
        </details>
      </article>)}</div>
      {data.canUpload && <details className="portal-add-work"><summary>Добавить работу</summary>
      <PortalForm context={context} command="add-work" label="Добавить работу">
        <Field label="Фото работы"><Input name="file" type="file" accept="image/jpeg,image/png,image/webp" required /></Field>
        <WorkFields data={data} />
      </PortalForm>
      </details>}
    </section>
  </>;
}
function WorkFields({ data, work }: { data: EmployeePortalDto; work?: PortalWork }) {
  return <>
    {work && <input type="hidden" name="workId" value={work.id} />}
    <Field label="Название работы"><Input name="title" required maxLength={200} defaultValue={work?.title ?? ''} /></Field>
    <Field label="Описание работы"><textarea name="description" rows={3} maxLength={2000} defaultValue={work?.description ?? ''} /></Field>
    {data.business.vertical === 'BEAUTY' && <Field label="Услуга работы"><Select name="serviceId" defaultValue={work?.serviceId ?? ''}><option value="">Без привязки к услуге</option>{data.services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select></Field>}
    <label><input type="checkbox" name="publicationConsent" defaultChecked={work?.publicationConsent ?? false} /> Есть согласие на публичный показ этой работы</label>
    {data.access === 'MANAGER' && <label><input type="checkbox" name="published" defaultChecked={work?.published ?? false} /> Одобрить публикацию работы</label>}
  </>;
}

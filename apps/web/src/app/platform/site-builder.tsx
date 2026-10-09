'use client';
import { useActionState } from 'react';
import { DateInput } from '../../components/date-field';
import { Alert, Badge, Button, Field, Grid, Input, Notice, Row } from '../../components/ui';
import type { PlatformSiteBuilderLocation } from '../../lib/api';
import { changeSiteBuilderAction, type SiteBuilderFormResult } from './actions';

/**
 * MKT9.2: лицензия конструктора сайта одного филиала. Без неё филиал видит сайт только для чтения; опубликованный сайт
 * при этом работает. Четыре действия: пробный доступ (до даты), активировать (пустая дата: бессрочно), продлить
 * (тот же статус, новая дата), выключить. Каждое изменение пишется в журнал на сервере
 */
const ACCESS: Record<PlatformSiteBuilderLocation['license']['access'], { tone: 'ok' | 'warn' | 'neutral'; label: string }> = {
  active: { tone: 'ok', label: 'Действует' },
  expired: { tone: 'warn', label: 'Срок вышел' },
  off: { tone: 'neutral', label: 'Не подключён' },
};
const day = (iso: string | null) => (iso ? new Date(new Date(iso).getTime() - 86_400_000).toLocaleDateString('ru-RU') : null);

export function SiteBuilderLicense({ organizationId, location: l }: { organizationId: string; location: PlatformSiteBuilderLocation }) {
  const [state, action, pending] = useActionState<SiteBuilderFormResult | null, FormData>(
    changeSiteBuilderAction.bind(null, organizationId, l.id, l.license.status),
    null,
  );
  const access = ACCESS[l.license.access];
  const until = day(l.license.activeUntil);
  const canExtend = l.license.status === 'TRIAL' || l.license.status === 'ACTIVE';
  return (
    <form key={state?.attempt ?? 0} action={action} className="stack" aria-label={`Конструктор сайта: ${l.name}`} data-testid="platform-site-builder-form">
      <p>
        <b>{l.name}</b> <Badge tone={access.tone}>{access.label}</Badge>
        <span className="sub">
          {' '}
          {l.license.status === 'TRIAL' ? 'пробный' : l.license.status === 'ACTIVE' ? 'оплачен' : 'нет'}
          {until ? `, по ${until}` : l.license.status === 'ACTIVE' ? ', бессрочно' : ''}
          {l.site ? `, сайт ${l.site.slug}` : ', сайта ещё нет'}
        </span>
      </p>
      <Grid min={220}>
        <Field label="Действует по (включительно)">
          <DateInput name="activeUntil" defaultValue="" />
        </Field>
        <Field label="Заметка, номер счёта">
          <Input name="note" maxLength={300} defaultValue={l.license.note ?? ''} placeholder="Счёт № 21 от 08.10.2026" />
        </Field>
      </Grid>
      {state?.error && <Alert data-testid="platform-site-builder-error">{state.error}</Alert>}
      {state?.message && <Notice data-testid="platform-site-builder-result">{state.message}</Notice>}
      <Row>
        <Button type="submit" name="action" value="trial" tone="secondary" disabled={pending} data-testid="platform-site-builder-trial">
          Пробный
        </Button>
        <Button type="submit" name="action" value="activate" disabled={pending} data-testid="platform-site-builder-activate">
          Активировать
        </Button>
        {canExtend && (
          <Button type="submit" name="action" value="extend" tone="secondary" disabled={pending} data-testid="platform-site-builder-extend">
            Продлить
          </Button>
        )}
        {l.license.status && l.license.status !== 'OFF' && (
          <Button type="submit" name="action" value="off" tone="danger" disabled={pending} data-testid="platform-site-builder-off">
            Выключить
          </Button>
        )}
      </Row>
    </form>
  );
}

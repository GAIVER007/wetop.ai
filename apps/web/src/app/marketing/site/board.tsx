'use client';
import { useState, useTransition } from 'react';
import type { BookingSourceView, MarketingSiteSummary, SitePublicationRow } from '../../../lib/api';
import { Alert, Badge, Button, Field, Notice, Panel, PanelTitle, Select, Stack, Table } from '../../../components/ui';
import { useConfirm } from '../../../components/use-confirm';
import {
  bookingSourceAction,
  lifecycleAction,
  previewAction,
  publishAction,
  rollbackAction,
  type PublicationResult,
} from './actions';

const STATE: Record<MarketingSiteSummary['state'], { label: string; tone: 'neutral' | 'ok' | 'warn' }> = {
  DRAFT: { label: 'Черновик', tone: 'neutral' },
  PUBLISHED: { label: 'Опубликован', tone: 'ok' },
  PAUSED: { label: 'Приостановлен', tone: 'warn' },
  ARCHIVED: { label: 'В архиве', tone: 'neutral' },
};

const ACTION: Record<SitePublicationRow['action'], string> = {
  PUBLISH: 'Публикация',
  ROLLBACK: 'Откат',
  PAUSE: 'Пауза',
  RESUME: 'Возобновление',
  ARCHIVE: 'Архив',
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Панель публикации (MKT7). Только управление: превью, публикация головы черновика, пауза и возобновление, откат на
 * ранее опубликованную версию, источник брони ИИ-продавца и архив. Редактора страниц и секций нет (MKT9). Ссылка
 * превью открывается сразу в новой вкладке: токен не показывается текстом и нигде не хранится.
 */
export function PublicationBoard({
  site,
  publications,
  booking,
  readOnly,
}: {
  site: MarketingSiteSummary;
  publications: SitePublicationRow[];
  booking: BookingSourceView;
  readOnly: boolean;
}) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<PublicationResult | null>(null);
  const [ratePlan, setRatePlan] = useState('');
  const [source, setSource] = useState(booking.canonicalTrackedSiteId ?? '');
  const { ask, dialog } = useConfirm();
  const run = (fn: () => Promise<PublicationResult>) =>
    start(async () => {
      setResult(await fn());
    });
  const state = STATE[site.state];
  const latest = site.latest;
  const dirty = !!latest && latest.id !== site.published?.id;
  const eligible = booking.options.filter((o) => o.status === 'ACTIVE' && o.bookingEnabled && o.bookingRatePlan);
  const rollbackTargets = new Set(
    publications.filter((p) => p.action !== 'PAUSE' && p.action !== 'ARCHIVE' && p.versionId).map((p) => p.versionId!),
  );
  const disabled = pending || readOnly;

  return (
    <Stack>
      {dialog}
      {result?.error && <Alert boxed data-testid="publication-error">{result.error}</Alert>}
      {result?.message && <Notice data-testid="publication-message">{result.message}</Notice>}

      <Panel aria-labelledby="publication-state-title" data-testid="publication-state">
        <PanelTitle>
          <span id="publication-state-title">{site.name}</span>
        </PanelTitle>
        <dl className="publication-facts">
          <div>
            <dt>Состояние</dt>
            <dd>
              <Badge tone={state.tone} data-testid="publication-status">
                {state.label}
              </Badge>
            </dd>
          </div>
          <div>
            <dt>Последняя версия</dt>
            <dd data-testid="publication-latest">{latest ? `ревизия ${latest.revision}` : 'версий нет'}</dd>
          </div>
          <div>
            <dt>Опубликована</dt>
            <dd data-testid="publication-published">
              {site.published ? `ревизия ${site.published.revision}` : 'Не опубликован'}
            </dd>
          </div>
          <div>
            <dt>Адрес сайта</dt>
            <dd data-testid="publication-url">
              {site.url ? (
                <a href={site.url} target="_blank" rel="noreferrer">
                  {site.url.replace(/^https:\/\//, '')}
                </a>
              ) : site.proposedUrl ? (
                <>
                  {site.proposedUrl.replace(/^https:\/\//, '')} <span className="muted">(не опубликован)</span>
                </>
              ) : (
                <span className="muted">Адрес сайтов не настроен</span>
              )}
            </dd>
          </div>
        </dl>
        <div className="publication-actions">
          {latest && (
            <Button
              tone="secondary"
              disabled={pending}
              data-testid="publication-preview"
              onClick={() =>
                start(async () => {
                  const r = await previewAction(latest.id);
                  if (r.url) window.open(r.url, '_blank', 'noopener,noreferrer');
                  setResult(r.url ? null : r);
                })
              }
            >
              Предпросмотр
            </Button>
          )}
          {latest && dirty && (
            <>
              <Field label="Тариф брони" controlId="publication-rate">
                <Select value={ratePlan} onChange={(e) => setRatePlan(e.target.value)} disabled={disabled}>
                  <option value="">Как сейчас у сайта</option>
                  {booking.ratePlans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button
                disabled={disabled}
                data-testid="publication-publish"
                onClick={async () => {
                  // публикация сразу открывает сайт посетителям: спрашиваем, как у отката и архива (MKT10.2a)
                  const where = (site.url ?? site.proposedUrl)?.replace(/^https:\/\//, '');
                  const ok = await ask({
                    title: `Опубликовать ревизию ${latest.revision}?`,
                    body: site.published
                      ? `Посетители сайта увидят её вместо ревизии ${site.published.revision}. Прежнюю можно вернуть откатом.`
                      : `Сайт откроется посетителям${where ? ` по адресу ${where}` : ''}. Остановить его можно паузой.`,
                    confirmLabel: 'Опубликовать',
                  });
                  if (ok) run(() => publishAction(latest.id, ratePlan));
                }}
              >
                Опубликовать ревизию {latest.revision}
              </Button>
            </>
          )}
          {site.state === 'PUBLISHED' && (
            <Button tone="secondary" disabled={disabled} data-testid="publication-pause" onClick={() => run(() => lifecycleAction('pause'))}>
              Приостановить
            </Button>
          )}
          {site.state === 'PAUSED' && (
            <Button disabled={disabled} data-testid="publication-resume" onClick={() => run(() => lifecycleAction('resume'))}>
              Возобновить
            </Button>
          )}
        </div>
      </Panel>

      <Panel aria-labelledby="publication-booking-title" data-testid="publication-booking">
        <PanelTitle>
          <span id="publication-booking-title">Источник бронирования для ИИ-продавца</span>
        </PanelTitle>
        {booking.canonicalTrackedSiteId === null && (
          <Notice tone="muted" data-testid="publication-booking-none">
            Источник бронирования для ИИ-продавца не выбран
          </Notice>
        )}
        {eligible.length > 0 ? (
          <div className="publication-actions">
            <Field label="Сайт брони" controlId="publication-booking-source">
              <Select value={source} onChange={(e) => setSource(e.target.value)} disabled={disabled}>
                <option value="">Не выбран</option>
                {eligible.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.managed ? ' (сайт WETOP)' : ''}, тариф {o.bookingRatePlan!.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              tone="secondary"
              disabled={disabled || source === (booking.canonicalTrackedSiteId ?? '')}
              data-testid="publication-booking-save"
              onClick={() => run(() => bookingSourceAction(source))}
            >
              Сохранить
            </Button>
          </div>
        ) : (
          <p className="muted">Нет сайтов с включённой бронью и тарифом.</p>
        )}
      </Panel>

      <Panel className="publication-history" aria-labelledby="publication-history-title" data-testid="publication-history">
        <PanelTitle>
          <span id="publication-history-title">Журнал публикаций</span>
        </PanelTitle>
        {publications.length === 0 ? (
          <p className="muted">Сайт ещё не публиковался.</p>
        ) : (
          <Table dense aria-label="Журнал публикаций">
            <thead>
              <tr>
                <th scope="col">Когда</th>
                <th scope="col">Действие</th>
                <th scope="col">Ревизия</th>
                <th scope="col">
                  <span className="sr-only">Действия</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {publications.map((p) => {
                const canRollback =
                  p.versionId !== null &&
                  rollbackTargets.has(p.versionId) &&
                  p.versionId !== site.published?.id &&
                  (site.state === 'PUBLISHED' || site.state === 'PAUSED');
                return (
                  <tr key={p.id} data-testid="publication-row">
                    <td>{when(p.createdAt)}</td>
                    <td>{ACTION[p.action]}</td>
                    <td>{p.revision ?? '–'}</td>
                    <td>
                      {canRollback && (
                        <Button
                          tone="secondary"
                          size="sm"
                          disabled={disabled}
                          onClick={async () => {
                            const ok = await ask({
                              title: `Откатить сайт на ревизию ${p.revision}?`,
                              body: 'Посетители увидят эту версию. Последний черновик останется как есть.',
                              confirmLabel: 'Откатить',
                            });
                            if (ok) run(() => rollbackAction(p.versionId!));
                          }}
                        >
                          Откатить
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>

      <div className="publication-actions">
        <Button
          tone="danger"
          disabled={disabled}
          data-testid="publication-archive"
          onClick={async () => {
            const ok = await ask({
              title: `Отправить «${site.name}» в архив?`,
              body: 'Сайт перестанет открываться, адрес освободится. Версии и журнал сохранятся.',
              confirmLabel: 'В архив',
              tone: 'danger',
            });
            if (ok) run(() => lifecycleAction('archive'));
          }}
        >
          В архив
        </Button>
      </div>
    </Stack>
  );
}

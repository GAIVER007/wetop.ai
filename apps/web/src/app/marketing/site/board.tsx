'use client';
import { useState, useTransition } from 'react';
import type { BookingSourceView, MarketingSiteSummary, SitePublicationRow } from '../../../lib/api';
import { Alert, Badge, Button, EmptyState, Field, Notice, Panel, PanelTitle, Select, Stack, Table } from '../../../components/ui';
import { useConfirm } from '../../../components/use-confirm';
import { msg } from '../../../i18n';
import { useT } from '../../../i18n/locale-provider';
import {
  bookingSourceAction,
  lifecycleAction,
  previewAction,
  publishAction,
  rollbackAction,
  type PublicationResult,
} from './actions';

const STATE: Record<MarketingSiteSummary['state'], { label: string; tone: 'neutral' | 'ok' | 'warn' }> = {
  DRAFT: { label: msg('Черновик'), tone: 'neutral' },
  PUBLISHED: { label: msg('Опубликован'), tone: 'ok' },
  PAUSED: { label: msg('Приостановлен'), tone: 'warn' },
  ARCHIVED: { label: msg('В архиве'), tone: 'neutral' },
};

const ACTION: Record<SitePublicationRow['action'], string> = {
  PUBLISH: msg('Публикация'),
  ROLLBACK: msg('Откат'),
  PAUSE: msg('Пауза'),
  RESUME: msg('Возобновление'),
  ARCHIVE: msg('Архив'),
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
  const t = useT();
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
            <dt>{t('Состояние')}</dt>
            <dd>
              <Badge tone={state.tone} data-testid="publication-status">
                {t(state.label)}
              </Badge>
            </dd>
          </div>
          <div>
            <dt>{t('Последняя версия')}</dt>
            <dd data-testid="publication-latest">{latest ? t('ревизия {n}', { n: latest.revision }) : t('версий нет')}</dd>
          </div>
          <div>
            <dt>{t('Опубликована')}</dt>
            <dd data-testid="publication-published">
              {site.published ? t('ревизия {n}', { n: site.published.revision }) : t('Не опубликован')}
            </dd>
          </div>
          <div>
            <dt>{t('Адрес сайта')}</dt>
            <dd data-testid="publication-url">
              {site.url ? (
                <a href={site.url} target="_blank" rel="noreferrer">
                  {site.url.replace(/^https:\/\//, '')}
                </a>
              ) : site.proposedUrl ? (
                <>
                  {site.proposedUrl.replace(/^https:\/\//, '')} <span className="muted">{t('(не опубликован)')}</span>
                </>
              ) : (
                <span className="muted">{t('Адрес сайтов не настроен')}</span>
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
              {t('Предпросмотр')}
            </Button>
          )}
          {latest && dirty && (
            <>
              <Field label={t('Тариф брони')} controlId="publication-rate">
                <Select value={ratePlan} onChange={(e) => setRatePlan(e.target.value)} disabled={disabled}>
                  <option value="">{t('Как сейчас у сайта')}</option>
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
                    title: t('Опубликовать ревизию {n}?', { n: latest.revision }),
                    body: site.published
                      ? t('Посетители сайта увидят её вместо ревизии {n}. Прежнюю можно вернуть откатом.', {
                          n: site.published.revision,
                        })
                      : where
                        ? t('Сайт откроется посетителям по адресу {where}. Остановить его можно паузой.', { where })
                        : t('Сайт откроется посетителям. Остановить его можно паузой.'),
                    confirmLabel: t('Опубликовать'),
                  });
                  if (ok) run(() => publishAction(latest.id, ratePlan));
                }}
              >
                {t('Опубликовать ревизию {n}', { n: latest.revision })}
              </Button>
            </>
          )}
          {site.state === 'PUBLISHED' && (
            <Button tone="secondary" disabled={disabled} data-testid="publication-pause" onClick={() => run(() => lifecycleAction('pause'))}>
              {t('Приостановить')}
            </Button>
          )}
          {site.state === 'PAUSED' && (
            <Button disabled={disabled} data-testid="publication-resume" onClick={() => run(() => lifecycleAction('resume'))}>
              {t('Возобновить')}
            </Button>
          )}
        </div>
      </Panel>

      <Panel aria-labelledby="publication-booking-title" data-testid="publication-booking">
        <PanelTitle>
          <span id="publication-booking-title">{t('Источник бронирования для ИИ-продавца')}</span>
        </PanelTitle>
        {booking.canonicalTrackedSiteId === null && (
          <Notice tone="muted" data-testid="publication-booking-none">
            {t('Источник бронирования для ИИ-продавца не выбран')}
          </Notice>
        )}
        {eligible.length > 0 ? (
          <div className="publication-actions">
            <Field label={t('Сайт брони')} controlId="publication-booking-source">
              <Select value={source} onChange={(e) => setSource(e.target.value)} disabled={disabled}>
                <option value="">{t('Не выбран')}</option>
                {eligible.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                    {o.managed ? t(' (сайт WETOP)') : ''}
                    {t(', тариф {name}', { name: o.bookingRatePlan!.name })}
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
              {t('Сохранить')}
            </Button>
          </div>
        ) : (
          <EmptyState title={t('Нет сайтов с включённой бронью и тарифом')} />
        )}
      </Panel>

      <Panel className="publication-history" aria-labelledby="publication-history-title" data-testid="publication-history">
        <PanelTitle>
          <span id="publication-history-title">{t('Журнал публикаций')}</span>
        </PanelTitle>
        {publications.length === 0 ? (
          <p className="muted">{t('Сайт ещё не публиковался.')}</p>
        ) : (
          <Table dense aria-label={t('Журнал публикаций')}>
            <thead>
              <tr>
                <th scope="col">{t('Когда')}</th>
                <th scope="col">{t('Действие')}</th>
                <th scope="col">{t('Ревизия')}</th>
                <th scope="col">
                  <span className="sr-only">{t('Действия')}</span>
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
                    <td>{t(ACTION[p.action])}</td>
                    <td>{p.revision ?? '–'}</td>
                    <td>
                      {canRollback && (
                        <Button
                          tone="secondary"
                          size="sm"
                          disabled={disabled}
                          onClick={async () => {
                            const ok = await ask({
                              title: t('Откатить сайт на ревизию {n}?', { n: p.revision ?? '' }),
                              body: t('Посетители увидят эту версию. Последний черновик останется как есть.'),
                              confirmLabel: t('Откатить'),
                            });
                            if (ok) run(() => rollbackAction(p.versionId!));
                          }}
                        >
                          {t('Откатить')}
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
              title: t('Отправить «{name}» в архив?', { name: site.name }),
              body: t('Сайт перестанет открываться, адрес освободится. Версии и журнал сохранятся.'),
              confirmLabel: t('В архив'),
              tone: 'danger',
            });
            if (ok) run(() => lifecycleAction('archive'));
          }}
        >
          {t('В архив')}
        </Button>
      </div>
    </Stack>
  );
}

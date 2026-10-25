import Link from 'next/link';
import { Icon } from '../../../components/icon';
import { LoadError } from '../../../components/load-error';
import {
  Badge,
  EmptyState,
  Fact,
  Field,
  Grid,
  Input,
  Notice,
  Panel,
  PanelTitle,
  Row,
  SectionTitle,
  Select,
  Stack,
  Table,
  Button,
} from '../../../components/ui';
import { PLATFORM_TIMEZONE } from '@pms/domain';
import { ApiError, supportApi, type SupportKbEntry } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { propertyClock } from '../../../lib/property-time';
import {
  KB_CATEGORIES,
  KB_STATUSES,
  KB_VISIBILITIES,
  kbCategoryLabel,
  kbFilter,
  kbHref,
  kbStatusLabel,
  kbStatusTone,
  kbVisibilityLabel,
} from '../../../lib/support-kb';
import { KbDraftButton, KbEntryEditor } from './kb-forms';
import { unstable_rethrow } from 'next/navigation';
import { serverT } from '../../../i18n/server';

const clock = propertyClock(PLATFORM_TIMEZONE);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );

/**
 * «Платформа → Техподдержка → База знаний» (S3, plans/ai-agents-s3-knowledge-2026-09-29.md): каталог управляемых
 * знаний. Помощник отвечает только по записям «Отвечает»; публикует главный администратор. Старые документы вкладки
 * «Знания» остаются отдельно.
 */
export async function KbView({ query }: { query: Record<string, string> }) {
  const filter = kbFilter(query);
  const selected = UUID.test(query.id ?? '') ? (query.id as string) : '';
  const isNew = query.new === '1';
  const [loaded, entry] = await Promise.all([
    settle(supportApi.kbList(filter)),
    selected ? settle(supportApi.kbRead(selected)) : Promise.resolve(null),
  ]);
  const total = loaded.ok ? Object.values(loaded.value.counts).reduce((a, b) => a + b, 0) : null;
  const t = await serverT();
  return (
    <Stack>
      <nav className="chips support-chips" aria-label={t('Статусы знаний')}>
        <Link
          href={kbHref({ ...filter, status: '', id: '' })}
          prefetch={false}
          aria-current={filter.status === '' ? 'page' : undefined}
        >
          {t('Все')}
          {total !== null && <span className="chips__count">{total}</span>}
        </Link>
        {KB_STATUSES.map(([status, label]) => (
          <Link
            key={status}
            href={kbHref({ ...filter, status, id: '' })}
            prefetch={false}
            aria-current={filter.status === status ? 'page' : undefined}
          >
            {t(label)}
            {loaded.ok && <span className="chips__count">{loaded.value.counts[status] ?? 0}</span>}
          </Link>
        ))}
      </nav>
      <form method="get" action="/platform/support/base" className="stack" aria-label={t('Поиск по знаниям')}>
        {filter.status && <input type="hidden" name="status" value={filter.status} />}
        <Row>
          <Field label={t('Поиск')}>
            <Input name="q" defaultValue={filter.q} maxLength={200} />
          </Field>
          <Field label={t('Категория')}>
            <Select name="category" defaultValue={filter.category}>
              <option value="">{t('Все')}</option>
              {KB_CATEGORIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('Видимость')}>
            <Select name="visibility" defaultValue={filter.visibility}>
              <option value="">{t('Любая')}</option>
              {KB_VISIBILITIES.map(([value, label]) => (
                <option key={value} value={value}>
                  {t(label)}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" tone="secondary">
            {t('Найти')}
          </Button>
          <Link className="btn" href="/platform/support/base?new=1" prefetch={false}>
            {t('Добавить знание')}
          </Link>
        </Row>
      </form>
      <div className="stack">
        <section aria-label={t('Знания')}>
          {!loaded.ok ? (
            <LoadError testId="kb-error-load" {...loadErrorProps(loaded.error)} />
          ) : loaded.value.items.length === 0 ? (
            <div data-testid="kb-empty">
              <EmptyState icon={<Icon name="journal" width={32} height={32} />} title={t('Знаний пока нет')}>
                {filter.status || filter.category || filter.visibility || filter.q
                  ? t('По этому отбору ничего нет. Сбросьте отбор или добавьте знание.')
                  : t('Добавьте первое знание: помощник отвечает только по опубликованным.')}
              </EmptyState>
            </div>
          ) : (
            <Table aria-label={t('Управляемые знания')} data-testid="kb-catalog">
              <thead>
                <tr>
                  <th>{t('Название')}</th>
                  <th>{t('Категория')}</th>
                  <th>{t('Видимость')}</th>
                  <th>{t('Статус')}</th>
                  <th>{t('Версия')}</th>
                  <th>{t('Обновлено')}</th>
                </tr>
              </thead>
              <tbody>
                {loaded.value.items.map((item) => (
                  <tr key={item.id} aria-selected={item.id === selected ? true : undefined}>
                    <td>
                      <Link href={kbHref({ ...filter, id: item.id ?? '' })} prefetch={false}>
                        {item.title}
                      </Link>
                    </td>
                    <td>{t(kbCategoryLabel(item.category))}</td>
                    <td>{t(kbVisibilityLabel(item.visibility))}</td>
                    <td>
                      <Badge tone={kbStatusTone(item.status)}>{t(kbStatusLabel(item.status))}</Badge>
                    </td>
                    <td>{item.version}</td>
                    <td>{clock.moment(item.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </section>
        <section aria-label={t('Запись базы знаний')}>
          {isNew ? (
            <NewEntry filter={filter} />
          ) : !entry ? (
            <p className="support-desk__hint">{t('Выберите запись в списке или добавьте новую.')}</p>
          ) : entry.ok ? (
            <EntryPanel entry={entry.value} back={kbHref(filter)} saved={query.saved === '1'} />
          ) : (
            <LoadError
              testId="kb-entry-error"
              {...loadErrorProps(entry.error instanceof ApiError ? entry.error : entry.error)}
            />
          )}
        </section>
      </div>
    </Stack>
  );
}

async function NewEntry({ filter }: { filter: ReturnType<typeof kbFilter> }) {
  const t = await serverT();
  return (
    <Panel data-testid="kb-entry">
      <Link href={kbHref(filter)} prefetch={false} className="support-dialog__back">
        {t('К списку')}
      </Link>
      <SectionTitle first>{t('Новое знание')}</SectionTitle>
      <p className="settings-note">
        {t('Запись создаётся черновиком. Помощник начнёт отвечать по ней только после публикации.')}
      </p>
      <KbEntryEditor
        entry={{ id: null, title: '', category: 'HOW_TO', visibility: 'PUBLIC_SUPPORT', content: '', status: null }}
      />
    </Panel>
  );
}

async function EntryPanel({ entry, back, saved }: { entry: SupportKbEntry; back: string; saved: boolean }) {
  const t = await serverT();
  const versions = entry.versions ?? [];
  return (
    <Panel data-testid="kb-entry" key={entry.id}>
      <Link href={back} prefetch={false} className="support-dialog__back">
        {t('К списку')}
      </Link>
      <Row gap="lg" className="row--baseline">
        <SectionTitle first>{entry.title}</SectionTitle>
        <Badge tone={kbStatusTone(entry.status)}>{t(kbStatusLabel(entry.status))}</Badge>
      </Row>
      <Grid min={160}>
        <Fact label={t('Версия')} value={t('Версия {n}', { n: entry.version })} />
        <Fact label={t('Источник')} value={entry.source ?? '—'} />
        <Fact label={t('Обновлено')} value={clock.moment(entry.updatedAt)} />
        <Fact
          label={t('Утверждение')}
          value={
            entry.approvedAt
              ? t('Утвердил главный администратор, {at}', { at: clock.moment(entry.approvedAt) })
              : t('Не утверждено')
          }
        />
      </Grid>
      {entry.status === 'DRAFT' && (
        <Notice tone="muted">{t('Ответов по этой записи пока нет: опубликуйте её.')}</Notice>
      )}
      {entry.status === 'ACTIVE' && entry.visibility === 'PLATFORM_ADMIN_ONLY' && (
        <Notice tone="muted">
          {t('Запись только для администратора платформы: клиенту помощник её не показывает и не пересказывает.')}
        </Notice>
      )}
      <KbEntryEditor
        key={entry.id}
        saved={saved}
        entry={{
          id: entry.id,
          title: entry.title ?? '',
          category: entry.category ?? 'HOW_TO',
          visibility: entry.visibility ?? 'PUBLIC_SUPPORT',
          content: entry.content ?? '',
          status: entry.status,
        }}
      />
      {versions.length > 0 && (
        <section aria-label={t('История версий')}>
          <SectionTitle>{t('История версий')}</SectionTitle>
          <ul className="settings-note">
            {versions.map((v) => (
              <li key={v.version}>
                {t('Версия {n}, {at}', { n: v.version, at: clock.moment(v.savedAt) })}
              </li>
            ))}
          </ul>
        </section>
      )}
    </Panel>
  );
}

/**
 * «На основании» у диалога — только оператору: какие знания легли в ответы помощника. Клиент этого не видит, а
 * идентификаторы записей и версии здесь — чтобы оператор нашёл запись и поправил.
 */
export async function KbSources({ conversationId, closed }: { conversationId: string; closed: boolean }) {
  const loaded = await settle(supportApi.conversationSources(conversationId));
  const t = await serverT();
  return (
    <section aria-label={t('На основании')} data-testid="kb-sources" className="stack stack--sm">
      <PanelTitle>{t('На основании')}</PanelTitle>
      {!loaded.ok ? (
        <p className="settings-note">{t('Не удалось узнать, на каких знаниях строились ответы.')}</p>
      ) : loaded.value.items.length === 0 ? (
        <p className="settings-note">{t('Знания в ответах не использовались.')}</p>
      ) : (
        <ul>
          {loaded.value.items.map((item) => (
            <li key={`${item.knowledgeId}-${item.version}`}>
              <Link href={kbHref({ id: item.knowledgeId ?? '' })} prefetch={false}>
                {item.title}
              </Link>
              {t(', версия {n}, {visibility}', {
                n: item.version,
                visibility: t(kbVisibilityLabel(item.visibility)).toLowerCase(),
              })}
            </li>
          ))}
        </ul>
      )}
      {closed && <KbDraftButton conversationId={conversationId} />}
    </section>
  );
}

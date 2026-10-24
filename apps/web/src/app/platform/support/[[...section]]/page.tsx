import Link from 'next/link';
import { Suspense } from 'react';
import { notFound, unstable_rethrow } from 'next/navigation';
import { MEMBERSHIP_ROLES, PLATFORM_TIMEZONE, parseMembershipRole } from '@pms/domain';
import { Page, BackCrumb } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { RefreshButton } from '../../../../components/refresh-button';
import {
  Alert,
  Badge,
  EmptyState,
  Fact,
  Grid,
  LoadingState,
  Notice,
  Panel,
  Row,
  SectionTitle,
  Stack,
  Table,
  cx,
} from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import {
  conversationChannelLabel,
  conversationModeLabel,
  conversationStageLabel,
  knowledgeSourceLabel,
} from '../../../../lib/ai-seller';
import {
  CATEGORY_CHIPS,
  QUEUE_CHIPS,
  categoryChipCount,
  categoryOf,
  chipCount,
  emptyCategoryText,
  emptyQueueText,
  lastMessageLine,
  priorityBadge,
  queueOf,
  speaker,
  waitingFor,
  type SupportCategoryFilter,
  type SupportQueue,
} from '../../../../lib/support-queue';
import { propertyClock } from '../../../../lib/property-time';
import { deskShell } from '../../../../lib/desk-shell';
import {
  ApiError,
  supportApi,
  type SupportConversationCard,
  type SupportQueueItem,
} from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import {
  DialogReplyForm,
  KnowledgeUploadForm,
  SandboxForm,
  type SandboxWords,
} from '../../../ai-seller/forms';
import { supportReplyAction, supportSandboxAction, supportUploadAction } from '../actions';
import { SupportDialogActions } from '../dialog-actions';
import { SupportModelForm, SupportPromptForm } from '../forms';
import { KbSources, KbView } from '../kb-view';
import { ActionsJournal } from '../actions-view';
// «Проверка» и «Знания» — те же формы, что у «ИИ-продавца» (DESIGN.md §8)
import '../../../ai-seller/ai-seller.css';
import '../support.css';
import { Tabs } from '../../../../components/tabs';
import { msg } from '../../../../i18n';
import { serverT } from '../../../../i18n/server';

/** Раздел оператора платформы: время обращений — по поясу платформы, а не отдельной гостиницы (С-13) */
const platformClock = propertyClock(PLATFORM_TIMEZONE);

/**
 * «Платформа → Техподдержка» (ADR-083, план `plans/platform-roles-extensions-2026-09-25.md` Э3): диалоги ИИ-помощника с
 * теми, кто пишет из стойки и с wetop.ai, его знания и сводка. Только главному администратору. Всё — через API
 * платформы; правил помощника здесь нет: они меняются коммитом в репозитории.
 */

const TABS = [
  { view: '', href: '/platform/support', label: msg('Диалоги') },
  { view: 'base', href: '/platform/support/base', label: msg('База знаний') },
  { view: 'knowledge', href: '/platform/support/knowledge', label: msg('Документы') },
  { view: 'settings', href: '/platform/support/settings', label: msg('Настройки') },
  { view: 'check', href: '/platform/support/check', label: msg('Проверка') },
] as const;

/** Как у API (`SUPPORT_PROMPT_MAX`): длиннее правила помощник не получит */
const PROMPT_MAX = 50_000;

const SUPPORT_SANDBOX_WORDS: SandboxWords = {
  asker: msg('Вы'),
  bot: msg('Помощник'),
  field: msg('Сообщение как от пользователя стойки'),
  placeholder: msg('Не могу сохранить бронь — что делать?'),
  button: msg('Спросить помощника'),
  pending: msg('Жду ответ помощника…'),
  human: msg('Помощник позвал бы человека'),
  label: msg('Проверка помощника'),
};

type SupportView = (typeof TABS)[number]['view'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => {
      unstable_rethrow(error);
      return { ok: false as const, error };
    },
  );

export default async function SupportPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section = [] } = await params;
  if (section.length > 1) notFound();
  const view = (section[0] ?? '') as SupportView;
  const tab = TABS.find((item) => item.view === view);
  if (!tab) notFound();
  const query = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');
  const { access } = await deskShell();
  const t = await serverT();
  return (
    <Page
      title={view ? t(tab.label) : t('Техподдержка')}
      subtitle={t('ИИ-помощник отвечает тем, кто пишет из стойки и с wetop.ai: диалоги, его знания и сводка за сутки.')}
      actions={<RefreshButton />}
      crumbs={view ? <BackCrumb href="/platform/support">{t('Техподдержка')}</BackCrumb> : undefined}
    >
      {access.platform && (
        <Tabs
          label={t('Агент')}
          items={[
            { href: '/ai-seller', label: t('Продавец'), current: false },
            { href: '/platform/support', label: t('Техподдержка'), current: true },
          ]}
        />
      )}
      <Tabs
        label={t('Техподдержка')}
        items={TABS.map((item) => ({ href: item.href, label: t(item.label), current: item.view === view }))}
      />
      <Suspense key={view} fallback={<LoadingState label={t('Спрашиваем помощника…')} />}>
        <SupportScreen
          view={view}
          queue={one(query.queue)}
          category={one(query.category)}
          id={one(query.id)}
          kbQuery={Object.fromEntries(Object.entries(query).map(([k, v]) => [k, one(v)]))}
        />
      </Suspense>
    </Page>
  );
}

async function SupportScreen({
  view,
  queue,
  category,
  id,
  kbQuery,
}: {
  view: SupportView;
  queue: string;
  category: string;
  id: string;
  kbQuery: Record<string, string>;
}) {
  const status = await settle(supportApi.status());
  const t = await serverT();
  if (!status.ok) {
    if (status.error instanceof ApiError && status.error.status === 403)
      return (
        <EmptyState
          icon={<Icon name="shield" width={32} height={32} />}
          title={t('Раздел главного администратора платформы')}
          data-testid="support-forbidden"
        >
          {t('Диалоги техподдержки видит только главный администратор. Отметку ставит команда на сервере.')}
        </EmptyState>
      );
    return <LoadError testId="support-error" {...loadErrorProps(status.error)} />;
  }
  if (status.value.state === 'not-configured')
    return (
      <EmptyState
        icon={<Icon name="chat" width={32} height={32} />}
        title={t('ИИ-помощник не подключён')}
        data-testid="support-not-configured"
      >
        {t(
          'Платформе нужны адрес панели помощника и ключ — ASSISTANT_PANEL_URL и ASSISTANT_SERVICE_KEY в настройках сервера, а в настройках помощника тот же ключ в SELLER_SERVICE_KEY. Их вписывает владелец.',
        )}
      </EmptyState>
    );
  if (view === 'base') return <KbView query={kbQuery} />;
  if (view === 'knowledge') return <KnowledgeView />;
  if (view === 'settings') return <SettingsView />;
  if (view === 'check') return <CheckView />;
  return <DialogsView queue={queue} category={category} id={id} />;
}

/**
 * «Настройки» (ADR-084): правила помощника — текст его системного промпта — и модель из списка разрешённых у бота.
 * Правила действуют со следующего ответа; проверить их — во вкладке «Проверка».
 */
async function SettingsView() {
  const [prompt, settings] = await Promise.all([
    settle(supportApi.prompt()),
    settle(supportApi.settings()),
  ]);
  const t = await serverT();
  return (
    <Stack>
      <Panel data-testid="support-prompt">
        <SectionTitle first>{t('Правила помощника')}</SectionTitle>
        <p className="settings-note">
          {t(
            'Это системный промпт: кто помощник, что он делает и чего не делает, как отвечает и когда зовёт человека. Что он знает о стойке — во вкладке «Знания».',
          )}
        </p>
        {prompt.ok && prompt.value.text.trim() === '' && (
          <Alert tone="warning" data-testid="support-prompt-missing">
            {t(
              'Правил нет — помощник сейчас не отвечает: без системного промпта бот не работает. Впишите правила и сохраните. Устройство — по шаблону {path} в репозитории: роль, запреты, что знает, как говорит; подстановки в фигурных скобках заменить.',
              { path: 'apps/ai-seller/sistemnyy-prompt-pomoshchnik.md' },
            )}
          </Alert>
        )}
        {prompt.ok ? (
          <SupportPromptForm initial={prompt.value.text} max={PROMPT_MAX} />
        ) : (
          <LoadError testId="support-prompt-load-error" {...loadErrorProps(prompt.error)} />
        )}
      </Panel>
      <Panel data-testid="support-model">
        <SectionTitle first>{t('Модель')}</SectionTitle>
        {!settings.ok ? (
          <LoadError testId="support-model-load-error" {...loadErrorProps(settings.error)} />
        ) : settings.value.models.length === 0 ? (
          <p className="settings-note" data-testid="support-model-fixed">
            {t(
              'Сейчас — {model}. Выбор не настроен: список разрешённых моделей задаётся в настройках помощника на сервере (LLM_ALLOWED_MODELS).',
              { model: settings.value.model ?? t('не указана') },
            )}
          </p>
        ) : (
          <SupportModelForm models={settings.value.models} current={settings.value.model} />
        )}
      </Panel>
    </Stack>
  );
}

async function CheckView() {
  const t = await serverT();
  const words = Object.fromEntries(
    Object.entries(SUPPORT_SANDBOX_WORDS).map(([key, value]) => [key, t(value)]),
  ) as unknown as SandboxWords;
  return (
    <Panel data-testid="support-check">
      <SectionTitle first>{t('Поговорить с помощником')}</SectionTitle>
      <p className="settings-note">
        {t(
          'Напишите так, как написал бы пользователь стойки. Разговор идёт в песочнице: в «Диалогах» его нет. Правила меняются во вкладке «Настройки».',
        )}
      </p>
      <SandboxForm ask={supportSandboxAction} words={words} />
    </Panel>
  );
}

/** Помощник не отвечает (адрес и ключ есть, а бот лежит): API пересказывает это 502/503/504 */
const unreachable = (error: unknown) =>
  error instanceof ApiError && [502, 503, 504].includes(error.status);

/** Режим словами кабинета: «бот» здесь — ИИ, «человек» — оператор */
const modeWord = (mode: string) => {
  const m = conversationModeLabel(mode);
  if (mode === 'owner_takeover') return { ...m, label: msg('ведёт оператор') };
  if (mode === 'bot_active') return { ...m, label: msg('ведёт ИИ') };
  return m;
};

/**
 * «Диалоги» (S1, `plans/support-assistant-v2-2026-09-29.md`): очередь слева, переписка справа — список остаётся на
 * месте (DESIGN.md §1 п. 5). На телефоне — одно из двух: список или переписка с «К списку».
 */
async function DialogsView({
  queue: rawQueue,
  category: rawCategory,
  id,
}: {
  queue: string;
  category: string;
  id: string;
}) {
  const queue = queueOf(rawQueue);
  const category = categoryOf(rawCategory);
  const selected = UUID.test(id) ? id : '';
  const [summary, loaded, card] = await Promise.all([
    settle(supportApi.summary()),
    settle(supportApi.queue(queue, category)),
    selected ? settle(supportApi.conversation(selected)) : Promise.resolve(null),
  ]);
  const t = await serverT();
  if (!loaded.ok && unreachable(loaded.error))
    return (
      <Panel data-testid="support-unavailable">
        <EmptyState icon={<Icon name="chat" width={32} height={32} />} title={t('ИИ-помощник не отвечает')}>
          {t(
            'Платформа подключена к помощнику, но он не ответил. Диалоги появятся, когда он снова будет на связи. Проверьте, запущен ли помощник на сервере, и повторите.',
          )}
        </EmptyState>
        <Row className="support-unavailable__retry">
          <RefreshButton label={t('Повторить')} />
        </Row>
      </Panel>
    );
  const href = (next: { queue?: SupportQueue; category?: SupportCategoryFilter; id?: string }) => {
    const params = new URLSearchParams();
    const q = next.queue ?? queue;
    // Статус и категория независимы: смена одного держит другое, как чипы «Броней»
    const c = next.category ?? category;
    if (q !== 'open') params.set('queue', q);
    if (c !== 'all') params.set('category', c);
    if (next.id) params.set('id', next.id);
    const qs = params.toString();
    return `/platform/support${qs ? `?${qs}` : ''}`;
  };
  const now = Date.now();
  return (
    <Stack className={cx('support-view', selected && 'support-view--open')}>
      {summary.ok && (
        <Grid min={150} className="support-summary" data-testid="support-summary">
          <Fact label={t('Диалогов за сутки')} value={String(summary.value.dialogs)} />
          <Fact label={t('Ответов')} value={String(summary.value.replies)} />
          <Fact label={t('Ответ опоздал')} value={String(summary.value.slaBreaches)} />
        </Grid>
      )}
      <nav className="chips support-chips" aria-label={t('Очередь обращений')}>
        {QUEUE_CHIPS.map((chip) => {
          const count = loaded.ok ? chipCount(chip.queue, loaded.value.counts) : null;
          return (
            <Link
              key={chip.queue}
              href={href({ queue: chip.queue })}
              prefetch={false}
              aria-current={chip.queue === queue ? 'page' : undefined}
            >
              {t(chip.label)}
              {count !== null && <span className="chips__count">{count}</span>}
            </Link>
          );
        })}
      </nav>
      {loaded.ok && (
        <nav className="chips support-chips" aria-label={t('Категория обращения')}>
          {CATEGORY_CHIPS.map((chip) => (
            <Link
              key={chip.category}
              href={href({ category: chip.category })}
              prefetch={false}
              aria-current={chip.category === category ? 'page' : undefined}
            >
              {t(chip.label)}
              <span className="chips__count">
                {categoryChipCount(chip.category, loaded.value.categoryCounts)}
              </span>
            </Link>
          ))}
        </nav>
      )}
      <div className={cx('support-desk', selected && 'support-desk--open')}>
        <section className="support-desk__list" aria-label={t('Обращения')}>
          {!loaded.ok ? (
            <LoadError testId="support-dialogs-error" {...loadErrorProps(loaded.error)} />
          ) : loaded.value.items.length === 0 ? (
            <div data-testid="support-queue-empty">
              <EmptyState
                icon={<Icon name="chat" width={32} height={32} />}
                title={
                  emptyCategoryText(category)
                    ? t('В этой категории обращений нет')
                    : t(emptyQueueText(queue).title)
                }
              >
                {t(emptyCategoryText(category) ?? emptyQueueText(queue).text)}
              </EmptyState>
            </div>
          ) : (
            <ul className="support-queue" data-testid="support-queue-list">
              {loaded.value.items.map((item) => (
                <QueueRow
                  key={item.id}
                  item={item}
                  href={href({ id: item.id })}
                  current={item.id === selected}
                  now={now}
                />
              ))}
            </ul>
          )}
        </section>
        <section className="support-desk__dialog" aria-label={t('Переписка')}>
          {!card ? (
            <p className="support-desk__hint">
              {t('Выберите обращение в списке — переписка откроется здесь.')}
            </p>
          ) : card.ok ? (
            <DialogCard card={card.value} back={href({})} />
          ) : (
            <LoadError testId="support-dialog-error" {...loadErrorProps(card.error)} />
          )}
        </section>
      </div>
    </Stack>
  );
}

async function QueueRow({
  item,
  href,
  current,
  now,
}: {
  item: SupportQueueItem;
  href: string;
  current: boolean;
  now: number;
}) {
  const t = await serverT();
  const badge = priorityBadge(item);
  const mode = modeWord(item.mode);
  const waiting = item.closed ? null : waitingFor(item.waitingSince, now, t);
  const who = item.clientName && item.clientName !== '—' ? item.clientName : t('Без подписи');
  const last = item.lastMessage ? `${t(speaker(item.lastMessage.role))}: ${item.lastMessage.text}` : lastMessageLine(null);
  return (
    <li
      className="support-queue__row"
      data-id={item.id}
      data-priority={item.priority}
      aria-current={current ? 'true' : undefined}
    >
      <Link href={href} prefetch={false} className="support-queue__link">
        <span className="support-queue__head">
          <span className="support-queue__who">{who}</span>
          <span className="support-queue__time">
            {item.lastActivityAt ? platformClock.moment(item.lastActivityAt) : '—'}
          </span>
        </span>
        <span className="support-queue__last">{last}</span>
        <span className="support-queue__meta">
          {badge && <Badge tone={badge.tone}>{t(badge.label)}</Badge>}
          {waiting && <span className="support-queue__wait">{waiting}</span>}
          <Badge tone={item.closed ? 'neutral' : mode.tone}>
            {item.closed ? t('закрыто') : t(mode.label)}
          </Badge>
        </span>
      </Link>
    </li>
  );
}

/** Роль вошедшего словом домена; нет роли в подписи — прочерк */
const roleWord = (role: string | null) => {
  const known = role ? parseMembershipRole(role) : null;
  return known ? MEMBERSHIP_ROLES[known] : '—';
};

/** Карточка диалога: кто пишет — почта, организация и роль из подписи стойки; переписка; действия оператора */
async function DialogCard({ card, back }: { card: SupportConversationCard; back: string }) {
  const t = await serverT();
  const m = modeWord(card.mode);
  const who = card.platformUser;
  const closed = card.closed === true;
  return (
    <Panel className="support-dialog" data-testid="support-dialog-card">
      <Link href={back} prefetch={false} className="support-dialog__back">
        {t('К списку')}
      </Link>
      <Row gap="lg" className="row--baseline">
        <SectionTitle first>{who?.email ?? t('Посетитель без входа')}</SectionTitle>
        <Badge tone={closed ? 'neutral' : m.tone} data-testid="support-dialog-mode">
          {closed ? t('закрыто') : t(m.label)}
        </Badge>
      </Row>
      {!closed && <SupportDialogActions id={card.id} mode={card.mode} />}
      <Grid min={160} data-testid="support-dialog-who">
        <Fact
          label={t('Организация')}
          value={
            who?.organizationId ? (
              <Link href={`/platform?org=${who.organizationId}`} prefetch={false}>
                {who.organizationName ?? t('нет в платформе')}
              </Link>
            ) : (
              '—'
            )
          }
        />
        <Fact label={t('Роль')} value={t(roleWord(who?.role ?? null))} />
        <Fact label={t('Канал')} value={t(conversationChannelLabel(card.contact.channel))} />
        <Fact label={t('Этап')} value={t(conversationStageLabel(card.stage))} />
      </Grid>
      {!who && (
        <p className="settings-note">
          {t('Писал без входа — например, с главной wetop.ai: подписи стойки нет, кто это, помощник не знает.')}
        </p>
      )}
      <ol className="support-transcript" aria-label={t('Переписка')}>
        {card.messages.map((msg, i) => (
          <li key={i} className={`support-transcript__msg support-transcript__msg--${msg.role}`}>
            <span className="support-transcript__who">
              {t(speaker(msg.role))}
              {msg.at ? (
                <time dateTime={msg.at} className="support-transcript__at">
                  {platformClock.moment(msg.at)}
                </time>
              ) : null}
            </span>
            <span className="support-transcript__text">{msg.text}</span>
          </li>
        ))}
      </ol>
      <Suspense fallback={null}>
        <KbSources conversationId={card.id} closed={closed} />
      </Suspense>
      <Suspense fallback={null}>
        <ActionsJournal conversationId={card.id} />
      </Suspense>
      {closed ? (
        <Notice tone="muted" data-testid="support-dialog-closed">
          {t('Обращение закрыто. Если человек напишет снова, откроется новое обращение.')}
        </Notice>
      ) : (
        <DialogReplyForm id={card.id} reply={supportReplyAction} label={t('Ответ пользователю')} />
      )}
    </Panel>
  );
}

async function KnowledgeView() {
  const loaded = await settle(supportApi.knowledge());
  const t = await serverT();
  return (
    <Stack>
      <Panel>
        <SectionTitle first>{t('Загрузить документ')}</SectionTitle>
        <p className="settings-note">
          {t(
            'Документация стойки и справочник ошибок — помощник отвечает по ним. Правила самого помощника меняются в репозитории, а не здесь.',
          )}
        </p>
        <KnowledgeUploadForm upload={supportUploadAction} />
      </Panel>
      {!loaded.ok ? (
        <LoadError testId="support-knowledge-error" {...loadErrorProps(loaded.error)} />
      ) : loaded.value.items.length === 0 ? (
        <EmptyState icon={<Icon name="journal" width={32} height={32} />} title={t('Документов нет')}>
          {t('Загрузите первый документ формой выше.')}
        </EmptyState>
      ) : (
        <Panel>
          <SectionTitle first>{t('Загружено')}</SectionTitle>
          <Table aria-label={t('Документы помощника')} data-testid="support-knowledge">
            <thead>
              <tr>
                <th>{t('Документ')}</th>
                <th>{t('Частей')}</th>
                <th>{t('Загружен')}</th>
              </tr>
            </thead>
            <tbody>
              {loaded.value.items.map((d, i) => (
                <tr key={`${d.source}-${i}`}>
                  <td>{t(knowledgeSourceLabel(d.source))}</td>
                  <td>{d.chunks}</td>
                  <td>{platformClock.moment(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </Stack>
  );
}

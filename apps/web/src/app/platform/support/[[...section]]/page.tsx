import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { MEMBERSHIP_ROLES } from '@pms/domain';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { RefreshButton } from '../../../../components/refresh-button';
import {
  Alert,
  Badge,
  EmptyState,
  Fact,
  Grid,
  LoadingState,
  Panel,
  Row,
  SectionTitle,
  Stack,
  Table,
} from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import {
  conversationChannelLabel,
  conversationModeLabel,
  conversationStageLabel,
  knowledgeSourceLabel,
} from '../../../../lib/ai-seller';
import { almatyMoment } from '../../../../lib/almaty';
import { ApiError, supportApi, type SupportConversationCard } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import {
  DialogModeButtons,
  DialogReplyForm,
  KnowledgeUploadForm,
  SandboxForm,
  type SandboxWords,
} from '../../../ai-seller/forms';
import {
  supportModeAction,
  supportReplyAction,
  supportSandboxAction,
  supportUploadAction,
} from '../actions';
import { SupportModelForm, SupportPromptForm } from '../forms';
// переписка — тем же списком строками, что у «ИИ-продавца» (DESIGN.md §8)
import '../../../ai-seller/ai-seller.css';

/**
 * «Платформа → Техподдержка» (ADR-083, план `plans/platform-roles-extensions-2026-09-25.md` Э3): диалоги ИИ-помощника с
 * теми, кто пишет из стойки и с wetop.ai, его знания и сводка. Только главному администратору. Всё — через API
 * платформы; правил помощника здесь нет: они меняются коммитом в репозитории.
 */

const TABS = [
  { view: '', href: '/platform/support', label: 'Диалоги' },
  { view: 'knowledge', href: '/platform/support/knowledge', label: 'Знания' },
  { view: 'settings', href: '/platform/support/settings', label: 'Настройки' },
  { view: 'check', href: '/platform/support/check', label: 'Проверка' },
] as const;

/** Как у API (`SUPPORT_PROMPT_MAX`): длиннее правила помощник не получит */
const PROMPT_MAX = 50_000;

const SUPPORT_SANDBOX_WORDS: SandboxWords = {
  asker: 'Вы',
  bot: 'Помощник',
  field: 'Сообщение как от пользователя стойки',
  placeholder: 'Не могу сохранить бронь — что делать?',
  button: 'Спросить помощника',
  pending: 'Жду ответ помощника…',
  human: 'Помощник позвал бы человека',
  label: 'Проверка помощника',
};

type SupportView = (typeof TABS)[number]['view'];

const MODES = [
  { value: '', label: 'Все' },
  { value: 'needs_human', label: 'Нужен человек' },
  { value: 'owner_takeover', label: 'Ведёт человек' },
  { value: 'bot_active', label: 'Ведёт бот' },
] as const;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROLE: Record<string, string> = {
  user: 'Пользователь',
  assistant: 'Помощник',
  operator: 'Человек',
  system: 'Система',
};

const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
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
  return (
    <Page
      title={view ? tab.label : 'Техподдержка'}
      subtitle="ИИ-помощник отвечает тем, кто пишет из стойки и с wetop.ai: диалоги, его знания и сводка за сутки."
      actions={<RefreshButton />}
      crumbs={view ? <Link href="/platform/support">Техподдержка</Link> : undefined}
    >
      <nav className="settings-tabs" aria-label="Техподдержка">
        {TABS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            aria-current={item.view === view ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <Suspense key={view} fallback={<LoadingState label="Спрашиваем помощника…" />}>
        <SupportScreen view={view} mode={one(query.mode)} id={one(query.id)} />
      </Suspense>
    </Page>
  );
}

async function SupportScreen({ view, mode, id }: { view: SupportView; mode: string; id: string }) {
  const status = await settle(supportApi.status());
  if (!status.ok) {
    if (status.error instanceof ApiError && status.error.status === 403)
      return (
        <EmptyState
          icon={<Icon name="shield" width={32} height={32} />}
          title="Раздел главного администратора платформы"
          data-testid="support-forbidden"
        >
          Диалоги техподдержки видит только главный администратор. Отметку ставит команда на
          сервере.
        </EmptyState>
      );
    return <LoadError testId="support-error" {...loadErrorProps(status.error)} />;
  }
  if (status.value.state === 'not-configured')
    return (
      <EmptyState
        icon={<Icon name="chat" width={32} height={32} />}
        title="ИИ-помощник не подключён"
        data-testid="support-not-configured"
      >
        Платформе нужны адрес панели помощника и ключ — ASSISTANT_PANEL_URL и ASSISTANT_SERVICE_KEY
        в настройках сервера, а в настройках помощника тот же ключ в SELLER_SERVICE_KEY. Их
        вписывает владелец.
      </EmptyState>
    );
  if (view === 'knowledge') return <KnowledgeView />;
  if (view === 'settings') return <SettingsView />;
  if (view === 'check') return <CheckView />;
  return <DialogsView mode={mode} id={id} />;
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
  return (
    <Stack>
      <Panel data-testid="support-prompt">
        <SectionTitle first>Правила помощника</SectionTitle>
        <p className="settings-note">
          Это системный промпт: кто помощник, что он делает и чего не делает, как отвечает и когда
          зовёт человека. Что он знает о стойке — во вкладке «Знания».
        </p>
        {prompt.ok && prompt.value.text.trim() === '' && (
          <Alert tone="warning" data-testid="support-prompt-missing">
            Правил нет — помощник сейчас не отвечает: без системного промпта бот не работает.
            Впишите правила и сохраните. Устройство — по шаблону
            apps/ai-seller/sistemnyy-prompt-pomoshchnik.md в репозитории: роль, запреты, что знает,
            как говорит; подстановки в фигурных скобках заменить.
          </Alert>
        )}
        {prompt.ok ? (
          <SupportPromptForm initial={prompt.value.text} max={PROMPT_MAX} />
        ) : (
          <LoadError testId="support-prompt-load-error" {...loadErrorProps(prompt.error)} />
        )}
      </Panel>
      <Panel data-testid="support-model">
        <SectionTitle first>Модель</SectionTitle>
        {!settings.ok ? (
          <LoadError testId="support-model-load-error" {...loadErrorProps(settings.error)} />
        ) : settings.value.models.length === 0 ? (
          <p className="settings-note" data-testid="support-model-fixed">
            Сейчас — {settings.value.model ?? 'не указана'}. Выбор не настроен: список разрешённых
            моделей задаётся в настройках помощника на сервере (LLM_ALLOWED_MODELS).
          </p>
        ) : (
          <SupportModelForm models={settings.value.models} current={settings.value.model} />
        )}
      </Panel>
    </Stack>
  );
}

function CheckView() {
  return (
    <Panel data-testid="support-check">
      <SectionTitle first>Поговорить с помощником</SectionTitle>
      <p className="settings-note">
        Напишите так, как написал бы пользователь стойки. Разговор идёт в песочнице: в «Диалогах»
        его нет. Правила меняются во вкладке «Настройки».
      </p>
      <SandboxForm ask={supportSandboxAction} words={SUPPORT_SANDBOX_WORDS} />
    </Panel>
  );
}

async function DialogsView({ mode, id }: { mode: string; id: string }) {
  const selected = MODES.some((m) => m.value === mode) ? mode : '';
  const [summary, list, card] = await Promise.all([
    settle(supportApi.summary()),
    settle(supportApi.conversations(selected || undefined)),
    UUID.test(id) ? settle(supportApi.conversation(id)) : Promise.resolve(null),
  ]);
  return (
    <Stack>
      {summary.ok && (
        <Grid min={150} data-testid="support-summary">
          <Fact label="Диалогов за сутки" value={String(summary.value.dialogs)} />
          <Fact label="Ответов" value={String(summary.value.replies)} />
          <Fact label="Ответ опоздал" value={String(summary.value.slaBreaches)} />
        </Grid>
      )}
      <nav className="chips" aria-label="Отбор диалогов">
        {MODES.map((m) => (
          <Link
            key={m.value}
            href={m.value ? `/platform/support?mode=${m.value}` : '/platform/support'}
            aria-current={m.value === selected ? 'page' : undefined}
          >
            {m.label}
          </Link>
        ))}
      </nav>
      {card &&
        (card.ok ? (
          <DialogCard card={card.value} />
        ) : (
          <LoadError testId="support-dialog-error" {...loadErrorProps(card.error)} />
        ))}
      {!list.ok ? (
        <LoadError testId="support-dialogs-error" {...loadErrorProps(list.error)} />
      ) : list.value.items.length === 0 ? (
        <EmptyState icon={<Icon name="chat" width={32} height={32} />} title="Диалогов нет">
          Здесь появятся разговоры помощника с теми, кто пишет из стойки и с wetop.ai.
        </EmptyState>
      ) : (
        <Table aria-label="Диалоги техподдержки" data-testid="support-dialogs">
          <thead>
            <tr>
              <th>Кто пишет</th>
              <th>Режим</th>
              <th>Этап</th>
              <th>Сообщений</th>
              <th>Последнее</th>
            </tr>
          </thead>
          <tbody>
            {list.value.items.map((c) => {
              const m = conversationModeLabel(c.mode);
              return (
                <tr key={c.id}>
                  <td>
                    <Link
                      href={`/platform/support?${new URLSearchParams({ ...(selected ? { mode: selected } : {}), id: c.id })}`}
                    >
                      {c.clientName && c.clientName !== '—' ? c.clientName : 'Без подписи'}
                    </Link>
                  </td>
                  <td>
                    <Badge tone={m.tone}>{m.label}</Badge>
                  </td>
                  <td>{conversationStageLabel(c.stage)}</td>
                  <td>{c.messages}</td>
                  <td>{almatyMoment(c.lastActivityAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Stack>
  );
}

/** Роль вошедшего словом домена; нет роли в подписи — прочерк */
const roleWord = (role: 'owner' | 'staff' | null) =>
  role === 'owner' ? MEMBERSHIP_ROLES.OWNER : role === 'staff' ? MEMBERSHIP_ROLES.STAFF : '—';

/** Карточка диалога: кто пишет — почта, организация и роль из подписи стойки; переписка; перехват и ответ */
function DialogCard({ card }: { card: SupportConversationCard }) {
  const m = conversationModeLabel(card.mode);
  const who = card.platformUser;
  return (
    <Panel data-testid="support-dialog-card">
      <Row gap="lg" className="row--baseline">
        <SectionTitle first>{who?.email ?? 'Посетитель без входа'}</SectionTitle>
        <Badge tone={m.tone} data-testid="support-dialog-mode">
          {m.label}
        </Badge>
      </Row>
      <Grid min={180} data-testid="support-dialog-who">
        <Fact
          label="Организация"
          value={
            who?.organizationId ? (
              <Link href={`/platform?org=${who.organizationId}`} prefetch={false}>
                {who.organizationName ?? 'нет в платформе'}
              </Link>
            ) : (
              '—'
            )
          }
        />
        <Fact label="Роль" value={roleWord(who?.role ?? null)} />
        <Fact label="Канал" value={conversationChannelLabel(card.contact.channel)} />
        <Fact label="Этап" value={conversationStageLabel(card.stage)} />
      </Grid>
      {!who && (
        <p className="settings-note">
          Писал без входа — например, с главной wetop.ai: подписи стойки нет, кто это, помощник не
          знает.
        </p>
      )}
      <ol className="seller-transcript" aria-label="Переписка">
        {card.messages.map((msg, i) => (
          <li key={i}>
            <p
              className={
                msg.role === 'user' ? 'seller-transcript__guest' : 'seller-transcript__bot'
              }
            >
              <b>{ROLE[msg.role] ?? msg.role}</b>
              {msg.at ? <span className="sub"> {almatyMoment(msg.at)}</span> : null}: {msg.text}
            </p>
          </li>
        ))}
      </ol>
      <DialogModeButtons id={card.id} mode={card.mode} switchMode={supportModeAction} />
      <DialogReplyForm id={card.id} reply={supportReplyAction} label="Ответ пользователю" />
    </Panel>
  );
}

async function KnowledgeView() {
  const loaded = await settle(supportApi.knowledge());
  return (
    <Stack>
      <Panel>
        <SectionTitle first>Загрузить документ</SectionTitle>
        <p className="settings-note">
          Документация стойки и справочник ошибок — помощник отвечает по ним. Правила самого
          помощника меняются в репозитории, а не здесь.
        </p>
        <KnowledgeUploadForm upload={supportUploadAction} />
      </Panel>
      {!loaded.ok ? (
        <LoadError testId="support-knowledge-error" {...loadErrorProps(loaded.error)} />
      ) : loaded.value.items.length === 0 ? (
        <EmptyState icon={<Icon name="journal" width={32} height={32} />} title="Документов нет">
          Загрузите первый документ формой выше.
        </EmptyState>
      ) : (
        <Panel>
          <SectionTitle first>Загружено</SectionTitle>
          <Table aria-label="Документы помощника" data-testid="support-knowledge">
            <thead>
              <tr>
                <th>Документ</th>
                <th>Частей</th>
                <th>Загружен</th>
              </tr>
            </thead>
            <tbody>
              {loaded.value.items.map((d, i) => (
                <tr key={`${d.source}-${i}`}>
                  <td>{knowledgeSourceLabel(d.source)}</td>
                  <td>{d.chunks}</td>
                  <td>{almatyMoment(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Panel>
      )}
    </Stack>
  );
}

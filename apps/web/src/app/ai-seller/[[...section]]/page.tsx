import { SetupWizard } from '../setup-wizard';
import { TelegramPanel } from '../../ai-agents/[id]/telegram-panel';
import Link from 'next/link';
import { Suspense } from 'react';
import { notFound, redirect } from 'next/navigation';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
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
} from '../../../components/ui';
import { Icon, type IconName } from '../../../components/icon';
import {
  SELLER_LEGACY_VIEWS,
  SELLER_PROMPT_MAX,
  SELLER_TABS,
  categoryPriceLine,
  conversationChannelLabel,
  conversationModeLabel,
  conversationStageLabel,
  extensionReminder,
  knowledgeSourceLabel,
  leadFacts,
  sellerBanner,
  sellerCanAct,
  sellerChecklist,
  sellerConnected,
  sellerPromptDraft,
  sellerReadOnlyReason,
  type SellerChecklistItem,
  type SellerView,
} from '../../../lib/ai-seller';
import { hotelClock } from '../../../lib/hotel-api';
import { deskShell } from '../../../lib/desk-shell';
import { mayAccess } from '../../../lib/navigation';
import { displayPeriod } from '../../../lib/display-date';
import { sellerApi, type SellerFactsView, type SellerStatus } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { pluralRu } from '../../../lib/plural';
import { CopyButton } from '../../website/forms';
import {
  DialogModeButtons,
  DialogReplyForm,
  KnowledgeUploadForm,
  LlmKeyForm,
  SandboxForm,
  SellerPromptForm,
  WhatsAppForm,
} from '../forms';
import '../ai-seller.css';

/**
 * Раздел «ИИ-продавец» (ТЗ ред. 1 §4.1, П6; ADR-079; макет владельца 26.09.2026 — ADR-097). Четыре экрана:
 * «Настройка» — одно окно инструкции и проверка рядом, «Диалоги», «Знания» с данными объекта, «Подключения» —
 * модель, код для сайта и WhatsApp. Всё — через API платформы: адреса и ключа продавца стойка не знает.
 *
 * Раздел работает у организации с расширением «ИИ-продавец» (ADR-083): без него — объяснение вместо экранов; срок
 * вышел — всё видно, но менять и отвечать гостям нельзя (Q-183); настройки меняют владелец и управляющий (ADR-107).
 */

const settle = <T,>(promise: Promise<T>) =>
  promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );

const MODES = [
  { value: '', label: 'Все' },
  { value: 'needs_human', label: 'Нужен человек' },
  { value: 'owner_takeover', label: 'Ведёт человек' },
  { value: 'bot_active', label: 'Ведёт бот' },
] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLE: Record<string, string> = {
  user: 'Гость',
  assistant: 'Продавец',
  operator: 'Человек',
  system: 'Система',
};

export default async function AiSellerPage({
  params,
  searchParams,
}: {
  params: Promise<{ section?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { section = [] } = await params;
  if (section.length > 1) notFound();
  const legacy = SELLER_LEGACY_VIEWS[section[0] ?? ''];
  if (legacy !== undefined) redirect(legacy ? `/ai-seller/${legacy}` : '/ai-seller');
  const view = (section[0] ?? '') as SellerView;
  if (!SELLER_TABS.some((item) => item.view === view)) notFound();
  // администратору раздел — это диалоги с гостями (ADR-107): настройку, знания и подключения ведут владелец и
  // управляющий; напоминание о продлении платного расширения — только владельцу
  const { access } = await deskShell();
  const configure = mayAccess(access, 'seller');
  if (!configure && view === '') redirect('/ai-seller/dialogs');
  const tabs = SELLER_TABS.filter((item) => configure || item.view === 'dialogs');
  const query = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');
  return (
    <Page
      title="ИИ-продавец"
      subtitle={
        <Suspense fallback={null}>
          <SellerStatePill />
        </Suspense>
      }
      actions={
        configure ? (
          <Link className="btn btn--secondary" href="/ai-agents">
            Все агенты
          </Link>
        ) : undefined
      }
    >
      <nav className="settings-tabs seller-tabs" aria-label="ИИ-продавец">
        {tabs.map((item) => (
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
      <Suspense key={view} fallback={<LoadingState label="Спрашиваем продавца…" />}>
        <SellerScreen
          view={view}
          mode={one(query.mode)}
          id={one(query.id)}
          owner={mayAccess(access, 'owner')}
        />
      </Suspense>
    </Page>
  );
}

/** Метка состояния под заголовком: одно слово и строка — подробности там, где их можно исправить */
async function SellerStatePill() {
  const status = await settle(sellerApi.status());
  if (!status.ok) return null;
  const banner = sellerBanner(status.value);
  return (
    <span className="seller-state" data-testid="seller-state">
      <Badge tone={banner.tone === 'calm' ? 'ok' : banner.tone === 'alarm' ? 'danger' : 'warn'}>
        {banner.value}
      </Badge>
      <span>{banner.title}</span>
    </span>
  );
}

async function SellerScreen({
  view,
  mode,
  id,
  owner,
}: {
  view: SellerView;
  mode: string;
  id: string;
  /** Платные расширения — владельческое (ADR-107): напоминание о продлении только ему */
  owner: boolean;
}) {
  const status = await settle(sellerApi.status());
  if (!status.ok) return <LoadError testId="seller-error" {...loadErrorProps(status.error)} />;
  if (status.value.state === 'extension-off') {
    const { access } = await deskShell();
    return <ExtensionOff status={status.value} platform={access.platform} />;
  }
  // напоминание — тому, кто продлевает: владельцу организации (Q-183, ADR-107)
  const reminder =
    owner && status.value.canConfigure !== false ? extensionReminder(status.value.extension) : null;
  return (
    <Stack>
      {reminder && (
        <Alert tone="warning" data-testid="seller-extension-ending">
          {reminder}
        </Alert>
      )}
      {view === '' && <SetupView status={status.value} />}
      {view === 'dialogs' && <DialogsView status={status.value} mode={mode} id={id} />}
      {view === 'knowledge' && <KnowledgeView status={status.value} />}
      {view === 'connections' && <ConnectionsView status={status.value} />}
    </Stack>
  );
}

/**
 * «Настройка» (макет владельца 26.09.2026): сверху — только то, что осталось до запуска; ниже — одно окно инструкции
 * и рядом разговор с продавцом до публикации. Пустое окно заполнено черновиком из прежних полей — ничего не теряется.
 */
async function SetupView({ status }: { status: SellerStatus }) {
  const readOnly = sellerReadOnlyReason(status);
  const connected = sellerConnected(status);
  const [prompt, profile, key, clock] = await Promise.all([
    settle(sellerApi.prompt()),
    settle(sellerApi.profile()),
    connected && !readOnly ? settle(sellerApi.llmKey()) : Promise.resolve(null),
    hotelClock(),
  ]);
  if (!prompt.ok)
    return <LoadError testId="seller-prompt-error-load" {...loadErrorProps(prompt.error)} />;
  const banner = sellerBanner(status);
  // что осталось до запуска — тому, кто может это сделать: сотруднику и после срока список ни к чему
  const checklist = readOnly
    ? null
    : sellerChecklist(status, key?.ok ? key.value.set : null, prompt.value);
  const initial =
    prompt.value.text ||
    sellerPromptDraft(profile.ok && profile.value.saved ? profile.value.profile : null);
  const note =
    prompt.value.applied && prompt.value.updatedAt
      ? `Применено ${clock.when(prompt.value.updatedAt)}`
      : prompt.value.saved
        ? 'Сохранено, но ещё не у продавца'
        : null;
  return (
    <Stack>
      {banner.tone === 'alarm' && <Alert data-testid="seller-state-reason">{banner.text}</Alert>}
      <SetupWizard>
        <Panel>
          <SectionTitle first>Данные вашего объекта</SectionTitle>
          <p>
            Продавец использует номера, тарифы и правила проживания из WETOP. Не нужно переписывать
            их в инструкцию.
          </p>
          <Row>
            <Badge tone={status.facts.applied ? 'ok' : 'warn'}>
              {status.facts.applied ? 'Данные переданы продавцу' : 'Данные ещё не переданы'}
            </Badge>
          </Row>
          <p>
            <Link href="/hotel-settings">Проверить объект и правила проживания</Link>
          </p>
          <p>
            <Link href="/ai-seller/knowledge">Посмотреть данные и дополнительные знания</Link>
          </p>
        </Panel>
        <Panel data-testid="seller-setup" aria-labelledby="seller-prompt-title">
          <SectionTitle first id="seller-prompt-title">
            Инструкция продавцу
          </SectionTitle>
          <SellerPromptForm
            initial={initial}
            max={SELLER_PROMPT_MAX}
            readOnly={readOnly}
            note={note}
          />
          <p className="settings-note seller-setup__note">
            <Icon name="board" width={16} height={16} aria-hidden="true" />
            Цены, номера, заезд и выезд продавец берёт из WETOP сам — их писать не нужно.
          </p>
          <p className="settings-note seller-setup__note">
            <Icon name="shield" width={16} height={16} aria-hidden="true" />
            Защитные правила продавец добавляет всегда: не считает суммы, не обещает за
            администратора, зовёт человека.
          </p>
        </Panel>
        <ConnectionsView status={status} />
        <Panel data-testid="seller-check" aria-labelledby="seller-check-title">
          <SectionTitle first id="seller-check-title">
            Проверка
          </SectionTitle>
          {!connected ? (
            <p className="settings-note">Проверка заработает, когда продавец будет подключён.</p>
          ) : !sellerCanAct(status) ? (
            <p className="settings-note" data-testid="seller-action-closed">
              Проверка — при действующем расширении.
            </p>
          ) : (
            <SandboxForm />
          )}
        </Panel>
        <Panel>
          <SectionTitle first>Перед первым разговором с гостем</SectionTitle>
          {checklist && <SetupChecklist items={checklist} />}
          <p>
            Применённая инструкция не означает, что канал уже подключён. На шаге «Подключения»
            проверьте его состояние.
          </p>
          <p>
            Откройте подключённого бота или чат сайта, отправьте тестовое сообщение и убедитесь, что
            ответ пришёл. Только после этого начинайте общение с гостями.
          </p>
          <Link href="/ai-seller/dialogs">Открыть диалоги</Link>
        </Panel>
      </SetupWizard>
    </Stack>
  );
}

const CHECKLIST_ICON: Record<SellerChecklistItem['key'], IconName> = {
  connect: 'system',
  model: 'shield',
  prompt: 'journal',
  check: 'chat',
};

/** Что осталось до запуска: сделанное — галочкой, у несделанного — куда идти */
function SetupChecklist({ items }: { items: SellerChecklistItem[] }) {
  const left = items.filter((item) => !item.done && item.key !== 'check').length;
  return (
    <Panel data-testid="seller-checklist" aria-labelledby="seller-checklist-title">
      <SectionTitle first id="seller-checklist-title">
        До запуска — {pluralRu(left, ['шаг', 'шага', 'шагов'])}
      </SectionTitle>
      <ol className="seller-checklist">
        {items.map((item) => (
          <li
            key={item.key}
            data-state={item.done ? 'done' : 'todo'}
            data-testid={`seller-checklist-${item.key}`}
          >
            <Icon
              name={item.done ? 'check' : CHECKLIST_ICON[item.key]}
              width={18}
              height={18}
              aria-hidden="true"
            />
            <div>
              <strong>{item.title}</strong>
              <span className="sub">{item.hint}</span>
            </div>
            {!item.done && item.href && (
              <Link className="btn btn--secondary" href={item.href}>
                {item.key === 'model' ? 'Вставить ключ' : 'Открыть'}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

/** «Подключения»: модель, код для сайта и WhatsApp — всё, что связывает продавца с внешним миром, на одном экране */
async function ConnectionsView({ status }: { status: SellerStatus }) {
  return (
    <div className="seller-connection-steps">
      <details open>
        <summary>
          1. Модель ИИ <span>Проверка и сохранение ключа</span>
        </summary>
        <ModelView status={status} />
      </details>
      <details>
        <summary>
          2. Telegram <span>Закрытый тест с вашим ботом</span>
        </summary>
        <TelegramPanel id="working" readOnly={!!sellerReadOnlyReason(status)} />
      </details>
      <details>
        <summary>
          3. WhatsApp <span>Подключение номера для общения с гостями</span>
        </summary>
        <WhatsAppView status={status} />
      </details>
      <details>
        <summary>
          4. Чат на сайте <span>Код для установки на ваш сайт</span>
        </summary>
        <EmbedView status={status} />
      </details>
    </div>
  );
}

/** «Модель» (С2): ключ модели самого партнёра — вводится и проверяется здесь, хранится только у бота */
async function ModelView({ status }: { status: SellerStatus }) {
  const readOnly = sellerReadOnlyReason(status);
  if (!sellerConnected(status))
    return (
      <Panel data-testid="seller-llm-key-offline">
        <p className="settings-note">
          Продавец не подключён к платформе — ключ модели вводится после подключения (адрес и
          служебный ключ в окружении API).
        </p>
      </Panel>
    );
  const loaded = await settle(sellerApi.llmKey());
  if (!loaded.ok)
    return <LoadError testId="seller-llm-key-error-load" {...loadErrorProps(loaded.error)} />;
  return (
    <Panel data-testid="seller-llm-key" aria-label="Ключ модели партнёра">
      <LlmKeyForm status={loaded.value} readOnly={readOnly} />
    </Panel>
  );
}

/** «WhatsApp» (С3): подключение номера партнёра; токен и секрет живут только у бота */
async function WhatsAppView({ status }: { status: SellerStatus }) {
  const readOnly = sellerReadOnlyReason(status);
  if (!sellerConnected(status))
    return (
      <Panel data-testid="seller-whatsapp-offline">
        <p className="settings-note">
          Продавец не подключён к платформе — WhatsApp подключается после него (адрес и служебный
          ключ в окружении API).
        </p>
      </Panel>
    );
  const loaded = await settle(sellerApi.whatsapp());
  if (!loaded.ok)
    return <LoadError testId="seller-whatsapp-error-load" {...loadErrorProps(loaded.error)} />;
  return (
    <Panel data-testid="seller-whatsapp" aria-label="Подключение WhatsApp">
      <WhatsAppForm status={loaded.value} readOnly={readOnly} />
    </Panel>
  );
}

/** Расширение не подключено: вместо экранов — что это и кто подключает; прочитать сохранённое API тоже не даст */
function ExtensionOff({ status, platform }: { status: SellerStatus; platform: boolean }) {
  const banner = sellerBanner(status);
  return (
    <EmptyState
      icon={<Icon name="chat" width={32} height={32} />}
      title={banner.title}
      data-testid="seller-extension-off"
      actions={
        <Row>
          <Link className="btn" href={platform ? '/platform' : '/platform/support'}>
            {platform ? 'Управлять доступом' : 'Обратиться в поддержку'}
          </Link>
          <Link className="btn btn--secondary" href="/ai-agents">
            Все агенты
          </Link>
        </Row>
      }
    >
      Продавец отвечает гостям в чате на сайте объекта: называет цены по тарифу сайта, рассказывает
      о правилах, берёт контакт и зовёт человека, когда нужно. {banner.text}
    </EmptyState>
  );
}

/**
 * Данные объекта: ровно то, что уходит продавцу (тело `PUT /seller/facts`), и почему у категории цена ушла или нет
 * (ADR-081). Только просмотр — правят в «Настройках объекта», «Тарифах» и «Настройках сайта».
 */
async function DataView() {
  const loaded = await settle(sellerApi.facts());
  if (!loaded.ok)
    return <LoadError testId="seller-facts-error" {...loadErrorProps(loaded.error)} />;
  const { facts, applied } = loaded.value;
  return (
    <Stack>
      <Panel data-testid="seller-facts">
        <Row gap="lg" className="row--baseline">
          <SectionTitle first>{facts.object_name}</SectionTitle>
          <Badge tone={applied ? 'ok' : 'warn'} data-testid="seller-facts-applied">
            {applied ? 'Продавец знает эти данные' : 'Отправим продавцу в течение минуты'}
          </Badge>
        </Row>
        <Grid min={180}>
          <Fact label="Адрес" value={facts.address || 'не указан'} />
          <Fact label="Заезд с" value={facts.check_in} />
          <Fact label="Выезд до" value={facts.check_out} />
          <Fact label="Часовой пояс" value={facts.timezone} />
        </Grid>
        <p className="settings-note">
          Город входит в адрес. Правка — в карточке объекта, продавец получит её сам.
        </p>
      </Panel>
      <Panel>
        <PricesTable view={loaded.value} />
      </Panel>
      <Row>
        <Link className="btn btn--secondary" href="/hotel-settings">
          Изменить карточку объекта
        </Link>
        <Link className="btn btn--secondary" href="/rates">
          Изменить цены в «Тарифах»
        </Link>
        <Link className="btn btn--secondary" href="/website/booking">
          Тариф сайта
        </Link>
      </Row>
    </Stack>
  );
}

/** Категории и цены — ровно то, что продавец скажет гостю, и почему у категории цены нет (ADR-081, Q-179) */
function PricesTable({ view }: { view: SellerFactsView }) {
  const { facts, ratePlan, window, prices } = view;
  return (
    <Stack>
      <SectionTitle first>
        Категории и цены {ratePlan ? `по тарифу «${ratePlan.name}»` : ''}
      </SectionTitle>
      {!ratePlan && (
        <Alert tone="warning" data-testid="seller-no-rate-plan">
          Тариф сайта не выбран: продавец знает категории, но о цене скажет «уточнит администратор».
          Выберите тариф виджета бронирования в «Настройках сайта».
        </Alert>
      )}
      <Table aria-label="Категории и цены продавца" data-testid="seller-prices">
        <thead>
          <tr>
            <th>Категория</th>
            <th>Мест</th>
            <th>Гостей</th>
            <th>Продавец скажет гостю</th>
          </tr>
        </thead>
        <tbody>
          {prices.map((p) => {
            const line = categoryPriceLine(p, facts.currency);
            return (
              <tr key={p.code}>
                <td>{p.name}</td>
                <td>{p.units}</td>
                <td>{p.capacity}</td>
                <td>
                  {line.value}
                  {line.note && <span className="sub"> — {line.note}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <p className="settings-note">
        Продавец называет цену, только если за {displayPeriod(window.from, window.to)} она не
        меняется: названная им цена становится обещанием гостю. Иначе он говорит «уточнит
        администратор». Наличие мест продавец не знает: забронировать гость сможет, когда будет
        подключена котировка (часть 3 ТЗ).
      </p>
    </Stack>
  );
}

/** Загруженные документы продавца */
async function KnowledgeTable({
  items,
}: {
  items: Array<{ source: string; chunks: number; createdAt: string | null }>;
}) {
  const clock = await hotelClock();
  return (
    <Table aria-label="Документы продавца" data-testid="seller-knowledge">
      <thead>
        <tr>
          <th>Документ</th>
          <th>Частей</th>
          <th>Загружен</th>
        </tr>
      </thead>
      <tbody>
        {items.map((d, i) => (
          <tr key={`${d.source}-${i}`}>
            <td>{knowledgeSourceLabel(d.source)}</td>
            <td>{d.chunks}</td>
            <td>{clock.moment(d.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}

function NotReady({ status, title }: { status: SellerStatus; title: string }) {
  if (sellerConnected(status)) return null;
  return (
    <EmptyState
      icon={<Icon name="chat" width={32} height={32} />}
      title={title}
      data-testid="seller-not-ready"
    >
      {sellerBanner(status).text}
    </EmptyState>
  );
}

/** «Знания»: документы продавца и данные объекта, которые он получает из WETOP сам */
async function KnowledgeView({ status }: { status: SellerStatus }) {
  if (!sellerConnected(status))
    return (
      <Stack>
        <NotReady status={status} title="Документы появятся, когда продавец будет подключён" />
        <DataView />
      </Stack>
    );
  const readOnly = sellerReadOnlyReason(status);
  const loaded = await settle(sellerApi.knowledge());
  return (
    <Stack>
      <Panel>
        <SectionTitle first>Загрузить документ</SectionTitle>
        <p className="settings-note">
          Прайс, правила, ответы на вопросы — продавец отвечает по ним. Цены и адрес сюда класть не
          нужно: их продавец берёт из «Данных объекта».
        </p>
        {readOnly ? (
          <Notice tone="muted" data-testid="seller-read-only">
            {readOnly}
          </Notice>
        ) : (
          <KnowledgeUploadForm />
        )}
      </Panel>
      {!loaded.ok ? (
        <LoadError testId="seller-knowledge-error" {...loadErrorProps(loaded.error)} />
      ) : loaded.value.items.length === 0 ? (
        <EmptyState icon={<Icon name="journal" width={32} height={32} />} title="Документов нет">
          Загрузите первый документ формой выше.
        </EmptyState>
      ) : (
        <Panel>
          <SectionTitle first>Загружено</SectionTitle>
          <KnowledgeTable items={loaded.value.items} />
        </Panel>
      )}
      <DataView />
    </Stack>
  );
}

async function DialogsView({
  status,
  mode,
  id,
}: {
  status: SellerStatus;
  mode: string;
  id: string;
}) {
  const clock = await hotelClock();
  if (!sellerConnected(status))
    return <NotReady status={status} title="Диалоги появятся, когда продавец будет подключён" />;
  const selected = MODES.some((m) => m.value === mode) ? mode : '';
  const [summary, list, card] = await Promise.all([
    settle(sellerApi.summary()),
    settle(sellerApi.conversations(selected || undefined)),
    UUID.test(id) ? settle(sellerApi.conversation(id)) : Promise.resolve(null),
  ]);
  return (
    <Stack>
      {summary.ok && (
        <Grid min={150} data-testid="seller-summary">
          <Fact label="Диалогов за сутки" value={String(summary.value.dialogs)} />
          <Fact label="Ответов" value={String(summary.value.replies)} />
          <Fact label="Лидов с контактом" value={String(summary.value.leads)} />
          <Fact label="Ответ опоздал" value={String(summary.value.slaBreaches)} />
        </Grid>
      )}
      <nav className="chips" aria-label="Отбор диалогов">
        {MODES.map((m) => (
          <Link
            key={m.value}
            href={m.value ? `/ai-seller/dialogs?mode=${m.value}` : '/ai-seller/dialogs'}
            aria-current={m.value === selected ? 'page' : undefined}
          >
            {m.label}
          </Link>
        ))}
      </nav>
      {card &&
        (card.ok ? (
          <DialogCard card={card.value} canAct={sellerCanAct(status)} />
        ) : (
          <LoadError testId="seller-dialog-error" {...loadErrorProps(card.error)} />
        ))}
      {!list.ok ? (
        <LoadError testId="seller-dialogs-error" {...loadErrorProps(list.error)} />
      ) : list.value.items.length === 0 ? (
        <EmptyState icon={<Icon name="chat" width={32} height={32} />} title="Диалогов нет">
          Здесь появятся разговоры гостей с продавцом на сайте объекта.
        </EmptyState>
      ) : (
        <Table aria-label="Диалоги продавца" data-testid="seller-dialogs">
          <thead>
            <tr>
              <th>Гость</th>
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
                      href={`/ai-seller/dialogs?${new URLSearchParams({ ...(selected ? { mode: selected } : {}), id: c.id })}`}
                    >
                      {c.clientName || 'Гость без имени'}
                    </Link>
                    {c.hasContact && <span className="sub"> — оставил контакт</span>}
                  </td>
                  <td>
                    <Badge tone={m.tone}>{m.label}</Badge>
                  </td>
                  <td>{conversationStageLabel(c.stage)}</td>
                  <td>{c.messages}</td>
                  <td>{clock.moment(c.lastActivityAt)}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Stack>
  );
}

async function DialogCard({
  card,
  canAct,
}: {
  card: Awaited<ReturnType<typeof sellerApi.conversation>>;
  canAct: boolean;
}) {
  const clock = await hotelClock();
  const m = conversationModeLabel(card.mode);
  const lead = leadFacts(card.leadData);
  return (
    <Panel data-testid="seller-dialog-card">
      <Row gap="lg" className="row--baseline">
        <SectionTitle first>{card.contact.name || 'Гость без имени'}</SectionTitle>
        <Badge tone={m.tone} data-testid="seller-dialog-mode">
          {m.label}
        </Badge>
      </Row>
      <Grid min={180}>
        <Fact label="Телефон" value={card.contact.phone ?? '—'} />
        <Fact label="Почта" value={card.contact.email ?? '—'} />
        <Fact label="Канал" value={conversationChannelLabel(card.contact.channel)} />
        <Fact label="Этап" value={conversationStageLabel(card.stage)} />
      </Grid>
      {lead.length > 0 && (
        <dl className="settings-facts" data-testid="seller-dialog-lead">
          {lead.map((f) => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
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
              {msg.at ? <span className="sub"> {clock.moment(msg.at)}</span> : null}: {msg.text}
            </p>
          </li>
        ))}
      </ol>
      {canAct ? (
        <>
          <DialogModeButtons id={card.id} mode={card.mode} />
          <DialogReplyForm id={card.id} />
        </>
      ) : (
        <Notice tone="muted" data-testid="seller-dialog-read-only">
          Срок расширения вышел: переписку видно, но отвечать гостю и перехватывать диалог нельзя.
          Продлевает администратор WETOP.
        </Notice>
      )}
    </Panel>
  );
}

/** Без действующего расширения кода нет: продавец, срок которого вышел, на сайт не ставится (Q-183) */
function ActionClosed({ title }: { title: string }) {
  return (
    <EmptyState
      icon={<Icon name="chat" width={32} height={32} />}
      title={title}
      data-testid="seller-action-closed"
    >
      Срок расширения «ИИ-продавец» вышел. Продлевает администратор WETOP — после этого всё
      заработает с теми же настройками.
    </EmptyState>
  );
}

async function EmbedView({ status }: { status: SellerStatus }) {
  if (status.state === 'extension-expired')
    return <ActionClosed title="Код для сайта — при действующем расширении" />;
  const loaded = await settle(sellerApi.embed());
  if (!loaded.ok)
    return <LoadError testId="seller-embed-error" {...loadErrorProps(loaded.error)} />;
  const snippet = loaded.value.snippet;
  const hosts = loaded.value.hosts ?? [];
  if (!snippet)
    return (
      <EmptyState
        icon={<Icon name="chat" width={32} height={32} />}
        title="Кода пока нет"
        data-testid="seller-embed-empty"
      >
        Публичный адрес продавца ещё не задан в настройках сервера — его вписывает владелец.
      </EmptyState>
    );
  return (
    <Panel data-testid="seller-embed">
      <SectionTitle first>Чат продавца на сайте объекта</SectionTitle>
      <p className="settings-note">
        Вставьте код перед закрывающим &lt;/body&gt; каждой страницы сайта (в Tilda и WordPress —
        поле «HTML-код»). Гость пишет анонимно. В коде — публичный ключ вашей гостиницы: по нему
        продавец узнаёт её и отвечает только с доменов её сайта.
      </p>
      <pre className="code" data-testid="seller-embed-snippet">
        {snippet}
      </pre>
      <Row className="items-start">
        <CopyButton text={snippet} />
      </Row>
      {hosts.length > 0 ? (
        <p className="settings-note" data-testid="seller-embed-hosts">
          Чат откроется на доменах: {hosts.join(', ')}.
        </p>
      ) : (
        <p className="settings-note" data-testid="seller-embed-no-site">
          У гостиницы нет сайта в «Настройках сайта» — виджету не с чего открываться. Заведите сайт
          с доменом, и продавец начнёт пускать с него.
        </p>
      )}
    </Panel>
  );
}

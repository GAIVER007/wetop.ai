import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { SELLER_ADDRESS_FORMS, SELLER_LANGUAGES, SELLER_REPLY_LENGTHS } from '@pms/domain';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { RefreshButton } from '../../../components/refresh-button';
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
  StateBar,
  StateFact,
  Table,
} from '../../../components/ui';
import { Icon } from '../../../components/icon';
import {
  SELLER_TABS,
  conversationChannelLabel,
  conversationModeLabel,
  conversationStageLabel,
  leadFacts,
  priceRanges,
  sellerBanner,
  type SellerView,
} from '../../../lib/ai-seller';
import { almatyMoment, almatyWhen } from '../../../lib/almaty';
import { displayPeriod } from '../../../lib/display-date';
import { sellerApi, type SellerStatus } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { formatMoney } from '../../../lib/money';
import { CopyButton } from '../../analytics/setup/forms';
import {
  DialogModeButtons,
  DialogReplyForm,
  KnowledgeUploadForm,
  SandboxForm,
  SellerProfileForm,
} from '../forms';
import '../ai-seller.css';

/**
 * Раздел «ИИ-продавец» (ТЗ ред. 1 §4.1, П6; ADR-075). Шесть экранов вкладками — так же, как «Настройки гостиницы».
 * Всё — через API платформы: адреса и ключа продавца стойка не знает. Копия продавца обслуживает одну организацию;
 * у остальных раздел открывается, но говорит, что продавец не подключён.
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
  const view = (section[0] ?? '') as SellerView;
  const tab = SELLER_TABS.find((item) => item.view === view);
  if (!tab) notFound();
  const query = await searchParams;
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');
  return (
    <Page
      title={view ? tab.label : 'ИИ-продавец'}
      subtitle="Бот, который отвечает гостям на сайте объекта: как он говорит, что знает, с кем говорил."
      actions={<RefreshButton />}
      crumbs={view ? <Link href="/ai-seller">ИИ-продавец</Link> : undefined}
    >
      <nav className="settings-tabs" aria-label="ИИ-продавец">
        {SELLER_TABS.map((item) => (
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
        <SellerScreen view={view} mode={one(query.mode)} id={one(query.id)} />
      </Suspense>
    </Page>
  );
}

async function SellerScreen({ view, mode, id }: { view: SellerView; mode: string; id: string }) {
  const status = await settle(sellerApi.status());
  if (!status.ok) return <LoadError testId="seller-error" {...loadErrorProps(status.error)} />;
  return (
    <Stack>
      <SellerBanner status={status.value} />
      {view === '' && <SettingsView />}
      {view === 'data' && <DataView />}
      {view === 'knowledge' && <KnowledgeView status={status.value} />}
      {view === 'dialogs' && <DialogsView status={status.value} mode={mode} id={id} />}
      {view === 'embed' && <EmbedView />}
      {view === 'check' && <CheckView status={status.value} />}
    </Stack>
  );
}

/** Полоса состояния: подключён ли продавец и дошли ли до него правки */
function SellerBanner({ status }: { status: SellerStatus }) {
  const banner = sellerBanner(status);
  return (
    <StateBar
      tone={banner.tone}
      label="ИИ-продавец"
      value={banner.value}
      summary={`${banner.title}. ${banner.text}`}
      data-testid="seller-state"
    >
      <StateFact
        label="Настройки"
        value={
          !status.profile.saved ? 'не сохранены' : status.profile.applied ? 'применены' : 'ждут отправки'
        }
      >
        {status.profile.updatedAt ? `правка ${almatyWhen(status.profile.updatedAt)}` : undefined}
      </StateFact>
      <StateFact
        label="Данные объекта"
        value={status.facts.applied ? 'у продавца' : 'ждут отправки'}
      >
        {status.facts.appliedAt ? `отправлены ${almatyWhen(status.facts.appliedAt)}` : undefined}
      </StateFact>
      {status.lastErrorAt && (
        <StateFact label="Последний отказ" value={almatyWhen(status.lastErrorAt)} />
      )}
    </StateBar>
  );
}

async function SettingsView() {
  const loaded = await settle(sellerApi.profile());
  if (!loaded.ok) return <LoadError testId="seller-profile-error" {...loadErrorProps(loaded.error)} />;
  return (
    <SellerProfileForm
      initial={loaded.value.profile}
      languages={Object.entries(SELLER_LANGUAGES).map(([value, label]) => ({ value, label }))}
      addressForms={Object.entries(SELLER_ADDRESS_FORMS).map(([value, label]) => ({ value, label }))}
      replyLengths={Object.entries(SELLER_REPLY_LENGTHS).map(([value, label]) => ({ value, label }))}
    />
  );
}

/** Данные объекта: ровно то, что уходит продавцу. Только просмотр — правят в «Настройках гостиницы» и «Тарифах» */
async function DataView() {
  const loaded = await settle(sellerApi.facts());
  if (!loaded.ok) return <LoadError testId="seller-facts-error" {...loadErrorProps(loaded.error)} />;
  const { facts, applied } = loaded.value;
  const ranges = priceRanges(facts);
  const currency = facts.property.currency;
  return (
    <Stack>
      <Panel data-testid="seller-facts">
        <Row gap="lg" className="row--baseline">
          <SectionTitle first>{facts.property.name}</SectionTitle>
          <Badge tone={applied ? 'ok' : 'warn'} data-testid="seller-facts-applied">
            {applied ? 'Продавец знает эти данные' : 'Отправим продавцу в течение минуты'}
          </Badge>
        </Row>
        <Grid min={180}>
          <Fact label="Адрес" value={facts.property.address ?? 'не указан'} />
          <Fact label="Заезд с" value={facts.property.check_in_time} />
          <Fact label="Выезд до" value={facts.property.check_out_time} />
          <Fact label="Часовой пояс" value={facts.property.timezone} />
        </Grid>
        <p className="settings-note">
          Город входит в адрес. Правка — в карточке объекта, продавец получит её сам.
        </p>
      </Panel>
      <Panel>
        <SectionTitle first>
          Категории и цены {facts.rate_plan ? `по тарифу «${facts.rate_plan.name}»` : ''}
        </SectionTitle>
        {!facts.rate_plan && (
          <Alert tone="warning" data-testid="seller-no-rate-plan">
            Тариф сайта не выбран: продавец знает категории, но не цены. Выберите тариф виджета
            бронирования в «Настройках сайта».
          </Alert>
        )}
        <Table aria-label="Категории и цены продавца">
          <thead>
            <tr>
              <th>Категория</th>
              <th>Мест</th>
              <th>Гостей</th>
              <th>Цена за ночь</th>
            </tr>
          </thead>
          <tbody>
            {ranges.map((r) => (
              <tr key={r.code}>
                <td>{r.name}</td>
                <td>{r.units}</td>
                <td>{r.capacity}</td>
                <td>
                  {r.min === null || r.max === null
                    ? 'цен нет'
                    : r.min === r.max
                      ? formatMoney(r.min, currency)
                      : `от ${formatMoney(r.min, currency)} до ${formatMoney(r.max, currency)}`}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
        <p className="settings-note">
          Продавец получает цены на каждый день: {displayPeriod(facts.window.from, facts.window.to)}. Наличие мест
          он не знает: забронировать гость сможет, когда будет подключена котировка (часть 3 ТЗ).
        </p>
      </Panel>
      <Row>
        <Link className="btn btn--secondary" href="/hotel-settings">
          Изменить карточку объекта
        </Link>
        <Link className="btn btn--secondary" href="/rates">
          Изменить цены в «Тарифах»
        </Link>
        <Link className="btn btn--secondary" href="/analytics/setup">
          Тариф сайта
        </Link>
      </Row>
    </Stack>
  );
}

function NotReady({ status, title }: { status: SellerStatus; title: string }) {
  if (status.state === 'ready') return null;
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

async function KnowledgeView({ status }: { status: SellerStatus }) {
  if (status.state !== 'ready')
    return <NotReady status={status} title="Знания появятся, когда продавец будет подключён" />;
  const loaded = await settle(sellerApi.knowledge());
  return (
    <Stack>
      <Panel>
        <SectionTitle first>Загрузить документ</SectionTitle>
        <p className="settings-note">
          Прайс, правила, ответы на вопросы — продавец отвечает по ним. Цены и адрес сюда класть не
          нужно: их продавец берёт из «Данных объекта».
        </p>
        <KnowledgeUploadForm />
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
          <Table aria-label="Документы продавца" data-testid="seller-knowledge">
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
                  <td>{d.source}</td>
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

async function DialogsView({ status, mode, id }: { status: SellerStatus; mode: string; id: string }) {
  if (status.state !== 'ready')
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
      {card && (card.ok ? <DialogCard card={card.value} /> : (
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
                    <Link href={`/ai-seller/dialogs?${new URLSearchParams({ ...(selected ? { mode: selected } : {}), id: c.id })}`}>
                      {c.clientName || 'Гость без имени'}
                    </Link>
                    {c.hasContact && <span className="sub"> — оставил контакт</span>}
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

function DialogCard({ card }: { card: Awaited<ReturnType<typeof sellerApi.conversation>> }) {
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
            <p className={msg.role === 'user' ? 'seller-transcript__guest' : 'seller-transcript__bot'}>
              <b>{ROLE[msg.role] ?? msg.role}</b>
              {msg.at ? <span className="sub"> {almatyMoment(msg.at)}</span> : null}: {msg.text}
            </p>
          </li>
        ))}
      </ol>
      <DialogModeButtons id={card.id} mode={card.mode} />
      <DialogReplyForm id={card.id} />
    </Panel>
  );
}

async function EmbedView() {
  const loaded = await settle(sellerApi.embed());
  if (!loaded.ok) return <LoadError testId="seller-embed-error" {...loadErrorProps(loaded.error)} />;
  const snippet = loaded.value.snippet;
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
        Вставьте код перед закрывающим &lt;/body&gt; каждой страницы сайта (в Tilda и WordPress — поле
        «HTML-код»). Гость пишет анонимно; домен сайта должен быть в списке продавца.
      </p>
      <pre className="code" data-testid="seller-embed-snippet">
        {snippet}
      </pre>
      <Row className="items-start">
        <CopyButton text={snippet} />
      </Row>
    </Panel>
  );
}

function CheckView({ status }: { status: SellerStatus }) {
  if (status.state !== 'ready')
    return <NotReady status={status} title="Проверка заработает, когда продавец будет подключён" />;
  return (
    <Panel data-testid="seller-check">
      <SectionTitle first>Поговорить с продавцом до публикации</SectionTitle>
      <p className="settings-note">
        Напишите так, как написал бы гость. Разговор идёт в песочнице: гости и «Диалоги» его не видят.
        Нажмите «Применить» в «Настройках», чтобы проверить новую версию.
      </p>
      <SandboxForm />
    </Panel>
  );
}

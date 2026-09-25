import Link from 'next/link';
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import {
  SELLER_ADDRESS_FORMS,
  SELLER_EMOJI,
  SELLER_LANGUAGES,
  SELLER_REPLY_LENGTHS,
} from '@pms/domain';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { RefreshButton } from '../../../components/refresh-button';
import {
  Alert,
  Badge,
  type BadgeTone,
  EmptyState,
  Fact,
  Grid,
  LoadingState,
  Notice,
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
  SELLER_MANNER_EXAMPLES,
  SELLER_SETUP_STEPS,
  SELLER_TABS,
  categoryPriceLine,
  conversationChannelLabel,
  conversationModeLabel,
  conversationStageLabel,
  defaultSellerStep,
  extensionReminder,
  knowledgeSourceLabel,
  leadFacts,
  sellerBanner,
  sellerBriefing,
  sellerCanAct,
  sellerConnected,
  sellerReadOnlyReason,
  sellerSetupProgress,
  sellerStepNumber,
  userDocuments,
  type SellerProfileStep,
  type SellerStepProgress,
  type SellerStepState,
  type SellerView,
} from '../../../lib/ai-seller';
import { almatyMoment, almatyWhen } from '../../../lib/almaty';
import { displayPeriod } from '../../../lib/display-date';
import {
  sellerApi,
  type SellerFactsView,
  type SellerProfileBody,
  type SellerStatus,
} from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { pluralRu } from '../../../lib/plural';
import { CopyButton } from '../../analytics/setup/forms';
import {
  ApplySellerForm,
  DialogModeButtons,
  DialogReplyForm,
  KnowledgeUploadForm,
  SandboxForm,
  SellerStepForm,
  type MannerChoice,
} from '../forms';
import '../ai-seller.css';

/**
 * Раздел «ИИ-продавец» (ТЗ ред. 1 §4.1, П6; ADR-079). Шесть экранов вкладками — так же, как «Настройки гостиницы».
 * Всё — через API платформы: адреса и ключа продавца стойка не знает. Копия продавца обслуживает одну организацию;
 * у остальных раздел открывается, но говорит, что продавец не подключён.
 *
 * Раздел работает у организации с расширением «ИИ-продавец» (ADR-083): без него — объяснение вместо экранов; срок
 * вышел — всё видно, но менять и отвечать гостям нельзя (Q-183); настройки меняет владелец организации.
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
        <SellerScreen
          view={view}
          mode={one(query.mode)}
          id={one(query.id)}
          step={one(query.step)}
        />
      </Suspense>
    </Page>
  );
}

async function SellerScreen({
  view,
  mode,
  id,
  step,
}: {
  view: SellerView;
  mode: string;
  id: string;
  step: string;
}) {
  const status = await settle(sellerApi.status());
  if (!status.ok) return <LoadError testId="seller-error" {...loadErrorProps(status.error)} />;
  if (status.value.state === 'extension-off') return <ExtensionOff status={status.value} />;
  // напоминание — тому, кто продлевает: владельцу организации (Q-183)
  const reminder =
    status.value.canConfigure === false ? null : extensionReminder(status.value.extension);
  return (
    <Stack>
      <SellerBanner status={status.value} />
      {reminder && (
        <Alert tone="warning" data-testid="seller-extension-ending">
          {reminder}
        </Alert>
      )}
      {view === '' && <SetupView status={status.value} step={step} />}
      {view === 'data' && <DataView />}
      {view === 'knowledge' && <KnowledgeView status={status.value} />}
      {view === 'dialogs' && <DialogsView status={status.value} mode={mode} id={id} />}
      {view === 'embed' && <EmbedView status={status.value} />}
      {view === 'check' && <CheckView status={status.value} />}
    </Stack>
  );
}

/** Расширение не подключено: вместо экранов — что это и кто подключает; прочитать сохранённое API тоже не даст */
function ExtensionOff({ status }: { status: SellerStatus }) {
  const banner = sellerBanner(status);
  return (
    <EmptyState
      icon={<Icon name="chat" width={32} height={32} />}
      title={banner.title}
      data-testid="seller-extension-off"
    >
      Продавец отвечает гостям в чате на сайте объекта: называет цены по тарифу сайта, рассказывает
      о правилах, берёт контакт и зовёт человека, когда нужно. {banner.text}
    </EmptyState>
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
          !status.profile.saved
            ? 'не сохранены'
            : status.profile.applied
              ? 'применены'
              : 'ждут отправки'
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

const pad = (n: number) => String(n).padStart(2, '0');

const STEP_TONE: Record<SellerStepState, BadgeTone> = {
  done: 'ok',
  todo: 'warn',
  optional: 'neutral',
  later: 'neutral',
};

/** Варианты «Манеры» из слов домена и примеров, как это звучит у продавца */
const manner = <T extends string>(
  labels: Readonly<Record<T, string>>,
  examples: Readonly<Record<T, string>>,
): MannerChoice[] =>
  (Object.keys(labels) as T[]).map((value) => ({
    value,
    label: labels[value],
    example: examples[value],
  }));

/**
 * «Настройки» — пошаговая настройка продавца (поручение владельца 25.09.2026,
 * `plans/ai-seller-setup-wizard-2026-09-25.md`): наверху шаги с состоянием словом, ниже — открытый шаг. Без шага в
 * адресе открывается первый незаполненный; всё заполнено — «Запуск».
 */
async function SetupView({ status, step: raw }: { status: SellerStatus; step: string }) {
  const readOnly = sellerReadOnlyReason(status);
  const [loaded, knowledge] = await Promise.all([
    settle(sellerApi.profile()),
    sellerConnected(status) ? settle(sellerApi.knowledge()) : Promise.resolve(null),
  ]);
  if (!loaded.ok)
    return <LoadError testId="seller-profile-error" {...loadErrorProps(loaded.error)} />;
  const items = knowledge?.ok ? knowledge.value.items : null;
  const progress = sellerSetupProgress({
    saved: loaded.value.saved,
    profile: loaded.value.profile,
    // продавец подключён, а список не пришёл — шаг «по желанию», а не «после подключения»
    documents: knowledge === null ? null : items ? userDocuments(items) : 0,
    applied: status.profile.applied && status.facts.applied,
  });
  const step = sellerStepNumber(raw) ?? defaultSellerStep(progress);
  const current = progress[step - 1]!;
  const profile = loaded.value.profile;
  return (
    <Stack>
      <SetupSteps progress={progress} current={step} />
      <Panel data-testid="seller-setup" aria-labelledby="seller-step-title">
        <div className="form-section-title">
          <span>{pad(step)}</span>
          <div>
            <h2 id="seller-step-title">{current.title}</h2>
            <p>{current.hint}</p>
          </div>
        </div>
        {current.key === 'docs' ? (
          <DocsStep ready={sellerConnected(status)} items={items} readOnly={readOnly} />
        ) : current.key === 'launch' ? (
          <LaunchStep profile={profile} progress={progress} readOnly={readOnly} />
        ) : (
          <ProfileStep stepKey={current.key} profile={profile} readOnly={readOnly} />
        )}
      </Panel>
    </Stack>
  );
}

/** Список шагов: номер, название и состояние словом; открытый шаг — `aria-current="step"` */
function SetupSteps({ progress, current }: { progress: SellerStepProgress[]; current: number }) {
  return (
    <nav aria-label="Шаги настройки продавца">
      <ol className="seller-steps">
        {progress.map((p) => (
          <li key={p.key}>
            <Link
              href={`/ai-seller?step=${p.step}`}
              prefetch={false}
              className="seller-steps__link"
              aria-current={p.step === current ? 'step' : undefined}
            >
              <span className="seller-steps__num" aria-hidden="true">
                {pad(p.step)}
              </span>
              <span className="seller-steps__title">{p.title}</span>
              <Badge tone={STEP_TONE[p.state]} className="seller-steps__state">
                {p.word}
              </Badge>
            </Link>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Шаг с полями профиля; у «Цен» над полями — что продавец скажет о цене (только для чтения) */
function ProfileStep({
  stepKey,
  profile,
  readOnly,
}: {
  stepKey: SellerProfileStep;
  profile: SellerProfileBody;
  readOnly: string | null;
}) {
  return (
    <SellerStepForm
      // своя форма на шаг: ответ действия прошлого шага (отказ и введённое) не переезжает на следующий
      key={stepKey}
      stepKey={stepKey}
      initial={profile}
      readOnly={readOnly}
      first={stepKey === SELLER_SETUP_STEPS[0].key}
      languages={Object.entries(SELLER_LANGUAGES).map(([value, label]) => ({ value, label }))}
      addressForms={manner(SELLER_ADDRESS_FORMS, SELLER_MANNER_EXAMPLES.addressForm)}
      emojis={manner(SELLER_EMOJI, SELLER_MANNER_EXAMPLES.emoji)}
      replyLengths={manner(SELLER_REPLY_LENGTHS, SELLER_MANNER_EXAMPLES.replyLength)}
    >
      {stepKey === 'prices' && (
        <Suspense fallback={<LoadingState label="Загружаем цены…" />}>
          <StepPrices />
        </Suspense>
      )}
    </SellerStepForm>
  );
}

/** Цены на шаге «Цены»: их продавец берёт из тарифа сайта, здесь их не вводят — иначе у ночи было бы две цены */
async function StepPrices() {
  const loaded = await settle(sellerApi.facts());
  if (!loaded.ok)
    return <LoadError testId="seller-facts-error" {...loadErrorProps(loaded.error)} />;
  return (
    <Stack>
      <PricesTable view={loaded.value} />
      <Row>
        <Link className="btn btn--secondary" href="/rates">
          Изменить цены в «Тарифах»
        </Link>
        <Link className="btn btn--secondary" href="/hotel-settings">
          Изменить карточку объекта
        </Link>
      </Row>
      <p className="settings-note">
        Ниже — что добавить к цене словами: продавец скажет это гостю вместе с суммой.
      </p>
    </Stack>
  );
}

/** Шаг «Документы»: загрузка в знания продавца; без подключённого продавца — пропустить и вернуться позже */
function DocsStep({
  ready,
  items,
  readOnly,
}: {
  ready: boolean;
  items: Array<{ source: string; chunks: number; createdAt: string | null }> | null;
  readOnly: string | null;
}) {
  return (
    <Stack>
      {ready ? (
        <>
          <p className="settings-note">
            Прайс, правила, описание номеров — продавец отвечает и по ним. Цены и адрес сюда класть
            не нужно: их продавец берёт из «Данных объекта». Шаг можно пропустить.
          </p>
          {readOnly ? (
            <Notice tone="muted" data-testid="seller-read-only">
              {readOnly}
            </Notice>
          ) : (
            <KnowledgeUploadForm />
          )}
          {items && items.length > 0 && <KnowledgeTable items={items} />}
        </>
      ) : (
        <EmptyState
          icon={<Icon name="journal" width={32} height={32} />}
          title="Документы — после подключения продавца"
          data-testid="seller-docs-later"
        >
          Сюда загружают прайс, правила и описание файлом. Шаг можно пропустить и вернуться, когда
          продавец будет подключён.
        </EmptyState>
      )}
      <div className="form-footer">
        <Link className="btn btn--secondary" href="/ai-seller?step=5">
          Назад
        </Link>
        <Link className="btn" href="/ai-seller?step=7" data-testid="seller-step-next">
          Дальше
        </Link>
      </div>
    </Stack>
  );
}

/**
 * «Запуск»: что продавец получит — словами, а не текстом промпта (ТЗ §2 п. 2); чего не хватает; «Применить» — сейчас,
 * а не через минуту; дальше — «Проверка» и «Код для сайта».
 */
async function LaunchStep({
  profile,
  progress,
  readOnly,
}: {
  profile: SellerProfileBody;
  progress: SellerStepProgress[];
  readOnly: string | null;
}) {
  const missing = progress.filter(
    (p) => p.key !== 'docs' && p.key !== 'launch' && p.state === 'todo',
  );
  const facts = await settle(sellerApi.facts());
  const prices = facts.ok ? facts.value.prices : [];
  // та же граница, что в «Данных объекта»: цена уходит продавцу, только если она одна весь срок (ADR-081)
  const known = prices.filter((p) => p.reason === 'same' && p.priceMinor !== null).length;
  return (
    <Stack>
      {missing.length > 0 && (
        <Alert tone="warning" data-testid="seller-setup-missing">
          Не заполнено: {missing.map((m) => `«${m.title}»`).join(', ')}. Продавец будет работать и
          так, но гостю ответит хуже — вернитесь к этим шагам.
        </Alert>
      )}
      <SectionTitle first>Что получит продавец</SectionTitle>
      <Grid min={240} data-testid="seller-briefing">
        {sellerBriefing(profile).map((line) => (
          <Fact key={line.label} label={line.label} value={line.value} />
        ))}
      </Grid>
      {facts.ok && (
        <p className="settings-note" data-testid="seller-briefing-facts">
          О гостинице продавец знает из «Данных объекта»: адрес, заезд с{' '}
          {facts.value.facts.check_in}, выезд до {facts.value.facts.check_out},{' '}
          {pluralRu(prices.length, ['категория', 'категории', 'категорий'])}. Цену за ночь он
          назовёт у {known} из {prices.length}, у остальных скажет «уточнит администратор».
        </p>
      )}
      <p className="settings-note">
        Промпт продавец собирает сам: из этих ответов и своих правил — не считать деньги, не обещать
        того, чего он не делает, звать человека. Свои правила стереть нельзя, поэтому текста промпта
        здесь нет.
      </p>
      {readOnly ? (
        <Notice tone="muted" data-testid="seller-read-only">
          {readOnly}
        </Notice>
      ) : (
        <ApplySellerForm />
      )}
      <Row>
        <Link className="btn btn--secondary" href="/ai-seller/check">
          Поговорить с продавцом
        </Link>
        <Link className="btn btn--secondary" href="/ai-seller/embed">
          Код для сайта
        </Link>
      </Row>
      <div className="form-footer">
        <Link className="btn btn--secondary" href="/ai-seller?step=6">
          Назад
        </Link>
        <span />
      </div>
    </Stack>
  );
}

/**
 * Данные объекта: ровно то, что уходит продавцу (тело `PUT /seller/facts`), и почему у категории цена ушла или нет
 * (ADR-081). Только просмотр — правят в «Настройках гостиницы», «Тарифах» и «Настройках сайта».
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
        <Link className="btn btn--secondary" href="/analytics/setup">
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
function KnowledgeTable({
  items,
}: {
  items: Array<{ source: string; chunks: number; createdAt: string | null }>;
}) {
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
            <td>{almatyMoment(d.createdAt)}</td>
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

async function KnowledgeView({ status }: { status: SellerStatus }) {
  if (!sellerConnected(status))
    return <NotReady status={status} title="Знания появятся, когда продавец будет подключён" />;
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

function DialogCard({
  card,
  canAct,
}: {
  card: Awaited<ReturnType<typeof sellerApi.conversation>>;
  canAct: boolean;
}) {
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
              {msg.at ? <span className="sub"> {almatyMoment(msg.at)}</span> : null}: {msg.text}
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
        поле «HTML-код»). Гость пишет анонимно; домен сайта должен быть в списке продавца.
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
  if (!sellerConnected(status))
    return <NotReady status={status} title="Проверка заработает, когда продавец будет подключён" />;
  if (!sellerCanAct(status)) return <ActionClosed title="Проверка — при действующем расширении" />;
  return (
    <Panel data-testid="seller-check">
      <SectionTitle first>Поговорить с продавцом до публикации</SectionTitle>
      <p className="settings-note">
        Напишите так, как написал бы гость. Разговор идёт в песочнице: гости и «Диалоги» его не
        видят. Нажмите «Применить» в «Настройках», чтобы проверить новую версию.
      </p>
      <SandboxForm />
    </Panel>
  );
}

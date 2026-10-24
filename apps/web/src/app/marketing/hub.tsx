import Link from 'next/link';
import './marketing.css';
import { ActionMenu } from '../../components/action-menu';
import { Icon, type IconName } from '../../components/icon';
import { Page } from '../../components/page';
import { Badge } from '../../components/ui';
import { formatMoney } from '../../lib/money';
import { verticalCopy, type VerticalCopy } from '../../lib/vertical-copy';
import type { WebVertical } from '../../lib/vertical-landing';
import type { SiteBuilderState } from '../../lib/api';
import { intlLocale, msg, translator, type DeskLocale, type Translate } from '../../i18n';
import { dateFormat } from '../../i18n/dates';

/**
 * Хаб «Маркетинг» (MKT2, ADR-149; макет Marketing 2.0 владельца 09.10.2026, plans/mkt10-marketing-2-audit-2026-10-09.md):
 * три модуля одного вида (сайт, реклама, контент) и колонка результатов справа. У каждого модуля главная кнопка
 * «Открыть» ведёт на его экран: сайт в конструктор, реклама и контент на свои экраны, где пока пустые состояния
 * («Скоро», а не «Подключено»). Прочие разделы сайта в меню «⋯». Своих запросов к API у страницы нет (ADR-149): числа
 * результатов хаб не читает, и вместо выдуманных нулей стоит «Нет данных» с причиной. Направление берётся из
 * `/auth/me` через `requireVertical`, право `marketing` проверяет общий `AccessGate`.
 */
interface Module {
  key: 'site' | 'budget' | 'ads' | 'content' | 'competitors' | 'voice';
  testId: string;
  title: string;
  icon: IconName;
  href: string;
  text: string;
  caps: string[];
}

/**
 * Фразы со словами направления целиком (KK3): слова `VerticalCopy` склоняются по-русски и не подставляются в перевод,
 * поэтому у каждого направления своя фраза. Русский текст тот же, что собирался из `verticalCopy`.
 */
const SENTENCES: Record<WebVertical, { site: string; subtitle: string; competitors: string }> = {
  HOSPITALITY: {
    site: msg('Создайте сайт гостиницы с помощью ИИ, подключите онлайн-бронирование и продвигайте его в поиске.'),
    subtitle: msg('Привлекайте гостей, ведите рекламный бюджет и развивайте бренд гостиницы с помощью ИИ.'),
    competitors: msg('Загрузка ближайших гостиниц по дням: когда у соседей всё занято, цену можно поднять.'),
  },
  BEAUTY: {
    site: msg('Создайте сайт салона с помощью ИИ, подключите онлайн-запись и продвигайте его в поиске.'),
    subtitle: msg('Привлекайте клиентов, ведите рекламный бюджет и развивайте бренд салона с помощью ИИ.'),
    competitors: msg('Загрузка ближайших салонов по дням: когда у соседей всё занято, цену можно поднять.'),
  },
  FOOD_SERVICE: {
    site: msg('Создайте сайт ресторана с помощью ИИ, подключите онлайн-бронь столов и продвигайте его в поиске.'),
    subtitle: msg('Привлекайте гостей, ведите рекламный бюджет и развивайте бренд ресторана с помощью ИИ.'),
    competitors: msg('Загрузка ближайших ресторанов по дням: когда у соседей всё занято, цену можно поднять.'),
  },
};

/** Текст карточки голосового агента по направлению: только то, что агент умеет (docs/voice/voice-channel.md) */
function voiceCard(vertical: WebVertical): Pick<Module, 'text' | 'caps'> {
  if (vertical === 'BEAUTY')
    return {
      text: msg('ИИ принимает звонки клиентов: отвечает по услугам и ценам и собирает просьбы перезвонить.'),
      caps: [msg('Ответы по услугам и ценам'), msg('Просьбы перезвонить'), msg('Перевод на администратора')],
    };
  if (vertical === 'FOOD_SERVICE')
    return {
      text: msg('ИИ принимает звонки гостей: рассказывает о часах работы и собирает просьбы перезвонить.'),
      caps: [msg('Ответы о часах работы'), msg('Просьбы перезвонить'), msg('Перевод на администратора')],
    };
  return {
    text: msg('ИИ принимает звонки гостей, собирает просьбы перезвонить и переводит на администратора.'),
    caps: [msg('Приём звонков'), msg('Просьбы перезвонить'), msg('Перевод на администратора')],
  };
}

const modules = (c: VerticalCopy, vertical: WebVertical): Module[] => [
  {
    key: 'site',
    testId: 'marketing-site',
    title: msg('Сайт и SEO'),
    icon: 'analytics',
    href: '/marketing/site/editor',
    text: SENTENCES[vertical].site,
    caps: [msg('ИИ-конструктор сайта'), c.onlineAction, msg('SEO-оптимизация')],
  },
  {
    // МКТ-В1/В2 (ADR-MKT-B1): учёт бюджета и расходов работает с базой
    key: 'budget',
    testId: 'marketing-budget',
    // с 20.10.2026 «Бюджет и аналитика»: сводка расходов, заявок и ROMI по каналам первой вкладкой
    title: msg('Бюджет и аналитика'),
    icon: 'money',
    href: '/marketing/budget',
    text: msg('Сколько потратили, сколько пришло заявок, почём заявка и окупается ли каждый канал.'),
    caps: [msg('Сводка: расход, заявки, окупаемость'), msg('План месяца и прогноз'), msg('Журнал расходов по каналам')],
  },
  {
    key: 'ads',
    testId: 'marketing-ads',
    title: msg('Реклама'),
    icon: 'channels',
    href: '/marketing/ads',
    text: msg('Ведите рекламные кампании в Facebook и Instagram: расход, показы, клики и заявки в одном месте.'),
    caps: [
      msg('Подключение рекламных кабинетов'),
      msg('Автоматическая настройка и оптимизация'),
      msg('Подробная аналитика и отчёты'),
    ],
  },
  {
    // ADR-184: конкуренты в «Продвижении»; у гостиницы загрузка и цены соседей (ADR-142)
    key: 'competitors',
    testId: 'marketing-competitors',
    title: msg('Конкуренты'),
    icon: 'analytics',
    href: '/market',
    text: msg('Загрузка и цены ближайших конкурентов рядом с вашими и подсказки, когда поднять цену.'),
    caps: [msg('Конкуренты рядом'), msg('Загрузка по датам'), msg('Подсказки к цене')],
  },
  {
    // ИИ-колл-центр (решение владельца 22.10.2026): все направления; что агент называет по телефону, зависит от направления
    key: 'voice',
    testId: 'marketing-voice',
    title: msg('Голосовой агент'),
    icon: 'chat',
    href: '/marketing/voice',
    ...voiceCard(vertical),
  },
  {
    key: 'content',
    testId: 'marketing-content',
    title: msg('Контент'),
    icon: 'journal',
    href: '/marketing/content',
    text: msg('Тексты постов с ИИ по данным вашего филиала. Правьте, ставьте на день недели и копируйте в соцсети.'),
    caps: [msg('Пост с ИИ: два варианта'), msg('Проверка цифр по карточке'), msg('План публикаций на неделю')],
  },
];

/** Сводка бюджета филиала за текущий месяц: читает страница хаба, у хаба своих запросов нет */
export interface HubSpend {
  month: string;
  spentMinor: string;
  planMinor: string | null;
  currency: string;
}

type ResultKey = 'visits' | 'requests' | 'spent' | 'income';
const results = (c: VerticalCopy): { key: ResultKey; label: string; icon: IconName }[] => [
  { key: 'visits', label: msg('Переходы на сайт'), icon: 'system' },
  { key: 'requests', label: c.requests, icon: 'guests' },
  { key: 'spent', label: msg('Потрачено на рекламу'), icon: 'money' },
  { key: 'income', label: msg('Доход с рекламы'), icon: 'analytics' },
];

/** Месяц словом на языке человека: «октябрь», «қазан», «October» */
const monthWord = (month: string, locale: DeskLocale) =>
  /^\d{4}-\d{2}$/.test(month)
    ? dateFormat(intlLocale(locale), { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-01T00:00:00Z`))
    : month;

const SITE_MENU = [
  { label: msg('Публикация'), href: '/marketing/site' },
  { label: msg('Изображения'), href: '/marketing/site/assets' },
  { label: msg('Бронирование и аналитика'), href: '/website' },
];

const BUDGET_MENU = [
  { label: msg('План'), href: '/marketing/budget/plan' },
  { label: msg('Расходы'), href: '/marketing/budget/expenses' },
  { label: msg('Аналитика'), href: '/marketing/analytics' },
];

/**
 * Живые модули по направлению. Бюджет ведётся по филиалу любого направления (API `/marketing/budget` от вертикали не
 * зависит). «Сайт и SEO» с SITE-1 открыт всем направлениям: первый экран (филиал, факты, чат, дизайны) работает у
 * всех, а создание сайта салона и ресторана честно говорит словами сервера, пока API их не подключит.
 */
export function liveModules(): Set<Module['key']> {
  return new Set<Module['key']>(
    // «Реклама» живая у всех (кампании МКТ-В3, кабинет Meta), «Контент» с черновиками постов (CONTENT-DRAFTS-20261022)
    // «Конкуренты» живые у всех: у гостиницы загрузка по ночам (ADR-142), у салона и ресторана по дням (§60);
    // «Голосовой агент» у всех направлений (22.10.2026)
    ['site', 'budget', 'ads', 'voice', 'competitors', 'content'],
  );
}

/** Публикация, изображения и бронирование сайта пока гостиничные экраны: меню «⋯» у сайта только у гостиницы */
function ModuleCard({
  module,
  live,
  badge,
  note,
  soonForVertical,
  hospitality,
  t,
}: {
  t: Translate;
  module: Module;
  live: boolean;
  /** свой значок вместо «Доступно» (конструктор сайта выключен) */
  badge?: { text: string; tone: 'warn' | 'info' } | undefined;
  note?: string | undefined;
  soonForVertical: boolean;
  hospitality: boolean;
}) {
  const headingId = `${module.testId}-title`;
  return (
    <section
      className={`panel marketing-module marketing-module--${module.key}`}
      aria-labelledby={headingId}
      data-testid="marketing-module"
    >
      <div data-testid={module.testId} className="marketing-module__body">
        <div className="marketing-module__head">
          <span className="marketing-module__icon" aria-hidden="true">
            <Icon name={module.icon} />
          </span>
          <h2 id={headingId}>{t(module.title)}</h2>
          <Badge tone={badge?.tone ?? (live ? 'ok' : 'info')} data-testid={`${module.testId}-status`}>
            {t(badge?.text ?? (live ? msg('Доступно') : msg('Скоро')))}
          </Badge>
        </div>
        <p className="marketing-module__text">
          {soonForVertical
            ? `${t(module.text)} ${t('Для этого направления модуль готовится к подключению.')}`
            : note
              ? `${t(module.text)} ${t(note)}`
              : t(module.text)}
        </p>
        <ul className="marketing-module__caps">
          {module.caps.map((cap) => (
            <li key={cap}>
              <Icon name="check" width={16} aria-hidden="true" />
              {t(cap)}
            </li>
          ))}
        </ul>
        <div className="marketing-module__foot">
          {soonForVertical ? (
            <button className="btn" disabled>
              {t('Скоро')} <Icon name="arrow" width={16} aria-hidden="true" />
            </button>
          ) : (
            <Link className="btn" href={module.href} aria-label={t('Открыть: {title}', { title: t(module.title) })}>
              {t('Открыть')} <Icon name="arrow" width={16} aria-hidden="true" />
            </Link>
          )}
          {/* меню «⋯» только у гостиницы (её экраны сайта); у салона и ресторана действия карточек одинаковые */}
          {hospitality && live && (module.key === 'site' || module.key === 'budget') && (
            <ActionMenu
              label={t('Ещё действия: {title}', { title: t(module.title) })}
              items={(module.key === 'budget' ? BUDGET_MENU : SITE_MENU).map((i) => ({ ...i, label: t(i.label) }))}
            />
          )}
        </div>
      </div>
    </section>
  );
}

/**
 * Значок «Сайт и SEO» по лицензии конструктора филиала (живой аудит 21.10.2026 P0-4: конструктор выключен у новых
 * бизнесов, а карточка писала «Доступно»). Состояние неизвестно (ошибка чтения): прежний «Доступно».
 */
function siteBadge(builder: SiteBuilderState | null | undefined) {
  if (builder?.access === 'off')
    return {
      badge: { text: msg('Подключает WETOP'), tone: 'warn' as const },
      note: msg('Конструктор сайта подключает команда WETOP: откройте раздел и напишите нам.'),
    };
  if (builder?.access === 'expired')
    return {
      badge: { text: msg('Срок вышел'), tone: 'warn' as const },
      note: msg('Срок конструктора сайта вышел: сайт работает, менять его нельзя до продления.'),
    };
  return { badge: undefined, note: undefined };
}

export function MarketingHub({
  vertical,
  spend = null,
  builder = null,
  locale = 'ru',
}: {
  vertical: WebVertical;
  /** язык человека (KK3); без него русский, как в unit-тестах */
  locale?: DeskLocale;
  /** лицензия конструктора сайта филиала; null: не прочитана */
  builder?: SiteBuilderState | null;
  /** расходы месяца из бюджета филиала; null: бюджет не прочитан (нет филиала или ошибка) */
  spend?: HubSpend | null;
}) {
  const t = translator(locale);
  const hospitality = vertical === 'HOSPITALITY';
  const copy = verticalCopy(vertical);
  const live = liveModules();
  // экранов-превью без живых данных больше нет: «Контент» с 23.10.2026 пишет и хранит черновики постов
  const PREVIEW = new Set<Module['key']>([]);
  // «Конкуренты» у всех направлений (решение владельца 23.10.2026, п. 5): у гостиницы загрузка по ночам (ADR-142),
  // у салона и ресторана загрузка соседей по дням на своём экране (DATA_MODEL §60)
  const shown = modules(copy, vertical).map((m) =>
    m.key === 'competitors' && !hospitality
      ? {
          ...m,
          href: '/market/business',
          text: SENTENCES[vertical].competitors,
          caps: [msg('Конкуренты рядом'), msg('Загрузка по дням'), msg('Подсказки к цене')],
        }
      : m,
  );
  const value = (key: ResultKey) => {
    if (key === 'spent' && spend) return formatMoney(spend.spentMinor, spend.currency);
    return null;
  };
  return (
    <Page title={t('Продвижение')} subtitle={t(SENTENCES[vertical].subtitle)}>
      <div
        className="marketing-hub"
        data-testid={hospitality ? 'marketing-hub' : 'business-marketing'}
      >
        <div className={shown.length === 4 ? 'marketing-hub__modules marketing-hub__modules--four' : 'marketing-hub__modules'}>
          {shown.map((m) => (
            <ModuleCard
              key={m.key}
              module={m}
              live={live.has(m.key)}
              {...(m.key === 'site' ? siteBadge(builder) : {})}
              soonForVertical={!live.has(m.key) && !PREVIEW.has(m.key)}
              hospitality={hospitality}
              t={t}
            />
          ))}
        </div>
        <aside className="marketing-hub__aside">
          <section
            className="panel marketing-results"
            aria-labelledby="marketing-results-title"
            data-testid="marketing-results"
          >
            <h2 id="marketing-results-title">
              {spend ? t('Результаты за {month}', { month: monthWord(spend.month, locale) }) : t('Результаты за месяц')}
            </h2>
            <dl className="marketing-results__list">
              {results(copy).map(({ key, label, icon }) => (
                <div key={key} className="marketing-results__row" data-testid="marketing-result">
                  <span className="marketing-results__mark" aria-hidden="true">
                    <Icon name={icon} width={18} />
                  </span>
                  <dt>{t(label)}</dt>
                  <dd data-testid={`marketing-result-${key}`} className={value(key) === null ? 'muted' : undefined}>
                    {value(key) ?? t('Нет данных')}
                  </dd>
                </div>
              ))}
            </dl>
            {spend?.planMinor && (
              <p className="marketing-results__note" data-testid="marketing-plan">
                {t('План месяца: {sum}.', { sum: formatMoney(spend.planMinor, spend.currency) })}{' '}
                <Link href="/marketing/budget">{t('Открыть бюджет')}</Link>
              </p>
            )}
            <p className="marketing-results__note">
              {hospitality ? (
                <>
                  {t('Посещения и заявки сайта:')} <Link href="/website/analytics">{t('Аналитика сайта')}</Link>.
                </>
              ) : (
                <>
                  {t('Подробно по каналам:')} <Link href="/marketing/analytics">{t('Аналитика маркетинга')}</Link>.
                </>
              )}{' '}
              {t('Переходы и доход с рекламы появятся после подключения рекламных кабинетов.')}
            </p>
          </section>
          {hospitality && (
          <section className="panel marketing-start" aria-labelledby="marketing-start-title">
            <div className="marketing-start__head">
              <span className="marketing-start__icon" aria-hidden="true">
                <Icon name="send" />
              </span>
              <div className="marketing-start__body">
                <h2 id="marketing-start-title">{t('Больше гостей, меньше рутины')}</h2>
                <p>
                  {t('Сайт, реклама и контент в одном рабочем пространстве. Доступность указана в каждом модуле.')}
                </p>
              </div>
            </div>
            <Link
              className="btn btn--secondary marketing-start__cta"
              href="/marketing/site/editor"
            >
              {t('Начать с сайта')}
            </Link>
          </section>
          )}
        </aside>
      </div>
    </Page>
  );
}

import Link from 'next/link';
import './marketing.css';
import { ActionMenu } from '../../components/action-menu';
import { Icon, type IconName } from '../../components/icon';
import { Page } from '../../components/page';
import { Badge } from '../../components/ui';
import { formatMoney } from '../../lib/money';
import { verticalCopy, type VerticalCopy } from '../../lib/vertical-copy';
import type { WebVertical } from '../../lib/vertical-landing';

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

/** Текст карточки голосового агента по направлению: только то, что агент умеет (docs/voice/voice-channel.md) */
function voiceCard(c: VerticalCopy, vertical: WebVertical): Pick<Module, 'text' | 'caps'> {
  if (vertical === 'BEAUTY')
    return {
      text: `ИИ принимает звонки ${c.clientsOf}: отвечает по услугам и ценам и собирает просьбы перезвонить.`,
      caps: ['Ответы по услугам и ценам', 'Просьбы перезвонить', 'Перевод на администратора'],
    };
  if (vertical === 'FOOD_SERVICE')
    return {
      text: `ИИ принимает звонки ${c.clientsOf}: рассказывает о часах работы и собирает просьбы перезвонить.`,
      caps: ['Ответы о часах работы', 'Просьбы перезвонить', 'Перевод на администратора'],
    };
  return {
    text: `ИИ принимает звонки ${c.clientsOf}, собирает просьбы перезвонить и переводит на администратора.`,
    caps: ['Приём звонков', 'Просьбы перезвонить', 'Перевод на администратора'],
  };
}

const modules = (c: VerticalCopy, vertical: WebVertical): Module[] => [
  {
    key: 'site',
    testId: 'marketing-site',
    title: 'Сайт и SEO',
    icon: 'analytics',
    href: '/marketing/site/editor',
    text: `Создайте сайт ${c.businessOf} с помощью ИИ, подключите ${c.onlineAction.toLowerCase()} и продвигайте его в поиске.`,
    caps: ['ИИ-конструктор сайта', c.onlineAction, 'SEO-оптимизация'],
  },
  {
    // МКТ-В1/В2 (ADR-MKT-B1): учёт бюджета и расходов работает с базой
    key: 'budget',
    testId: 'marketing-budget',
    title: 'Бюджет',
    icon: 'money',
    href: '/marketing/budget',
    text: 'Планируйте рекламный бюджет, ведите расходы по каналам и следите за прогнозом месяца.',
    caps: ['План месяца и прогноз', 'Журнал расходов по каналам', 'Аналитика маркетинга'],
  },
  {
    key: 'ads',
    testId: 'marketing-ads',
    title: 'Реклама',
    icon: 'channels',
    href: '/marketing/ads',
    text: 'Ведите рекламные кампании в Facebook и Instagram: расход, показы, клики и заявки в одном месте.',
    caps: [
      'Подключение рекламных кабинетов',
      'Автоматическая настройка и оптимизация',
      'Подробная аналитика и отчёты',
    ],
  },
  {
    // ADR-184: конкуренты в «Продвижении»; у гостиницы загрузка и цены соседей (ADR-142)
    key: 'competitors',
    testId: 'marketing-competitors',
    title: 'Конкуренты',
    icon: 'analytics',
    href: '/market',
    text: `Загрузка и цены ближайших конкурентов рядом с вашими и подсказки, когда поднять цену.`,
    caps: ['Конкуренты рядом', 'Загрузка по датам', 'Подсказки к цене'],
  },
  {
    // ИИ-колл-центр (решение владельца 22.10.2026): все направления; что агент называет по телефону, зависит от направления
    key: 'voice',
    testId: 'marketing-voice',
    title: 'Голосовой агент',
    icon: 'chat',
    href: '/marketing/voice',
    ...voiceCard(c, vertical),
  },
  {
    key: 'content',
    testId: 'marketing-content',
    title: 'Контент',
    icon: 'journal',
    href: '/marketing/content',
    text: 'Создавайте фото, тексты, видео и посты с помощью ИИ. Планируйте публикации во все соцсети.',
    caps: ['Генерация фото и видео', 'Готовые шаблоны постов', 'Планировщик публикаций'],
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
  { key: 'visits', label: 'Переходы на сайт', icon: 'system' },
  { key: 'requests', label: c.requests, icon: 'guests' },
  { key: 'spent', label: 'Потрачено на рекламу', icon: 'money' },
  { key: 'income', label: 'Доход с рекламы', icon: 'analytics' },
];

const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const monthWord = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month;

const SITE_MENU = [
  { label: 'Публикация', href: '/marketing/site' },
  { label: 'Изображения', href: '/marketing/site/assets' },
  { label: 'Бронирование и аналитика', href: '/website' },
];

const BUDGET_MENU = [
  { label: 'Расходы', href: '/marketing/budget/expenses' },
  { label: 'Аналитика маркетинга', href: '/marketing/analytics' },
];

/**
 * Живые модули по направлению. Бюджет ведётся по филиалу любого направления (API `/marketing/budget` от вертикали не
 * зависит). «Сайт и SEO» с SITE-1 открыт всем направлениям: первый экран (филиал, факты, чат, дизайны) работает у
 * всех, а создание сайта салона и ресторана честно говорит словами сервера, пока API их не подключит.
 */
export function liveModules(vertical: WebVertical): Set<Module['key']> {
  return new Set<Module['key']>(
    // «Реклама» живая у всех (кампании МКТ-В3, кабинет Meta): значок «Доступно», а не «Скоро» рядом с «Открыть»
    vertical === 'HOSPITALITY'
      ? ['site', 'budget', 'ads', 'voice', 'competitors']
      : ['site', 'budget', 'ads', 'voice'],
  );
}

/** Публикация, изображения и бронирование сайта пока гостиничные экраны: меню «⋯» у сайта только у гостиницы */
function ModuleCard({
  module,
  live,
  soonForVertical,
  hospitality,
}: {
  module: Module;
  live: boolean;
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
          <h2 id={headingId}>{module.title}</h2>
          <Badge tone={live ? 'ok' : 'info'} data-testid={`${module.testId}-status`}>
            {live ? 'Доступно' : 'Скоро'}
          </Badge>
        </div>
        <p className="marketing-module__text">
          {soonForVertical
            ? `${module.text} Для этого направления модуль готовится к подключению.`
            : module.text}
        </p>
        <ul className="marketing-module__caps">
          {module.caps.map((cap) => (
            <li key={cap}>
              <Icon name="check" width={16} aria-hidden="true" />
              {cap}
            </li>
          ))}
        </ul>
        <div className="marketing-module__foot">
          {soonForVertical ? (
            <button className="btn" disabled>
              Скоро <Icon name="arrow" width={16} aria-hidden="true" />
            </button>
          ) : (
            <Link className="btn" href={module.href} aria-label={`Открыть: ${module.title}`}>
              Открыть <Icon name="arrow" width={16} aria-hidden="true" />
            </Link>
          )}
          {/* меню «⋯» только у гостиницы (её экраны сайта); у салона и ресторана действия карточек одинаковые */}
          {hospitality && live && (module.key === 'site' || module.key === 'budget') && (
            <ActionMenu
              label={`Ещё действия: ${module.title}`}
              items={module.key === 'budget' ? BUDGET_MENU : SITE_MENU}
            />
          )}
        </div>
      </div>
    </section>
  );
}

export function MarketingHub({
  vertical,
  spend = null,
}: {
  vertical: WebVertical;
  /** расходы месяца из бюджета филиала; null: бюджет не прочитан (нет филиала или ошибка) */
  spend?: HubSpend | null;
}) {
  const hospitality = vertical === 'HOSPITALITY';
  const copy = verticalCopy(vertical);
  const live = liveModules(vertical);
  // Реклама и контент пока «Скоро» у всех направлений; ссылка на экран-превью есть, кнопок действий нет
  const PREVIEW = new Set<Module['key']>(['content']);
  // «Конкуренты» это гостиничный мониторинг загрузки (ADR-142): салону и ресторану карточку не показываем
  const shown = modules(copy, vertical).filter((m) => hospitality || m.key !== 'competitors');
  const value = (key: ResultKey) => {
    if (key === 'spent' && spend) return formatMoney(spend.spentMinor, spend.currency);
    return 'Нет данных';
  };
  return (
    <Page
      title="Продвижение"
      subtitle={`Привлекайте ${copy.clientsAcc}, ведите рекламный бюджет и развивайте бренд ${copy.businessOf} с помощью ИИ.`}
    >
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
              soonForVertical={!live.has(m.key) && !PREVIEW.has(m.key)}
              hospitality={hospitality}
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
              {spend ? `Результаты за ${monthWord(spend.month)}` : 'Результаты за месяц'}
            </h2>
            <dl className="marketing-results__list">
              {results(copy).map(({ key, label, icon }) => (
                <div key={key} className="marketing-results__row" data-testid="marketing-result">
                  <span className="marketing-results__mark" aria-hidden="true">
                    <Icon name={icon} width={18} />
                  </span>
                  <dt>{label}</dt>
                  <dd data-testid={`marketing-result-${key}`} className={value(key) === 'Нет данных' ? 'muted' : undefined}>
                    {value(key)}
                  </dd>
                </div>
              ))}
            </dl>
            {spend?.planMinor && (
              <p className="marketing-results__note" data-testid="marketing-plan">
                План месяца: {formatMoney(spend.planMinor, spend.currency)}.{' '}
                <Link href="/marketing/budget">Открыть бюджет</Link>
              </p>
            )}
            <p className="marketing-results__note">
              {hospitality ? (
                <>
                  Посещения и заявки сайта: <Link href="/website/analytics">Аналитика сайта</Link>.
                </>
              ) : (
                <>
                  Подробно по каналам: <Link href="/marketing/analytics">Аналитика маркетинга</Link>.
                </>
              )}{' '}
              Переходы и доход с рекламы появятся после подключения рекламных кабинетов.
            </p>
          </section>
          {hospitality && (
          <section className="panel marketing-start" aria-labelledby="marketing-start-title">
            <div className="marketing-start__head">
              <span className="marketing-start__icon" aria-hidden="true">
                <Icon name="send" />
              </span>
              <div className="marketing-start__body">
                <h2 id="marketing-start-title">Больше {copy.clientsAcc}, меньше рутины</h2>
                <p>
                  Сайт, реклама и контент в одном рабочем пространстве. Доступность указана в каждом модуле.
                </p>
              </div>
            </div>
            <Link
              className="btn btn--secondary marketing-start__cta"
              href="/marketing/site/editor"
            >
              Начать с сайта
            </Link>
          </section>
          )}
        </aside>
      </div>
    </Page>
  );
}

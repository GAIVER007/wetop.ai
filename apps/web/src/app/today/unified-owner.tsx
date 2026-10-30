import { financePeriodHref } from '../../lib/finance-period';
import type { OwnerSummaryDto, Workload } from '../../lib/owner-summary';
import { formatOwnerMoney, ownerMonth, ownerReason, shiftMonth } from '../../lib/owner-summary';
import { DateRangePopover } from '../../components/date-range-popover';
import './unified-owner.css';
import { OwnerDailyChart } from './owner-daily-chart';
import { intlLocale, translator, type DeskLocale, type Translate } from '../../i18n';
import { Icon } from '../../components/icon';
/** «сентябрь 2026 г.» → «Сентябрь 2026»: заглавная и без «г.» */
import { dateFormat } from '../../i18n/dates';

function MoneyValue({ value, t }: { value: OwnerSummaryDto['current']['revenue']; t: Translate }) {
  return (
    <>
      <strong className="owner-value">
        {value.currencies?.length
          ? value.currencies.map((c) => (
              <span key={c.currency}>{formatOwnerMoney(c.amountMinor, c.currency)}</span>
            ))
          : t('Нет данных')}
      </strong>
      {value.state !== 'READY' && <small>{ownerReason(value.reason, t)}</small>}
    </>
  );
}
function MoneyComparison({
  value,
  reason,
  t,
}: {
  value: NonNullable<OwnerSummaryDto['comparisons']>['revenue'] | undefined;
  reason: string | null;
  t: Translate;
}) {
  if (!value?.currencies?.length)
    return (
      <small title={ownerReason(reason ?? value?.reason, t) || undefined}>
        {t('Нет данных для сравнения')}
      </small>
    );
  return (
    <>
      {value.currencies.map((c) => {
        if (c.deltaMinor === null)
          return (
            <small key={c.currency}>
              {value.currencies!.length > 1 ? `${c.currency}: ` : ''}{t('Нет данных для сравнения')}
            </small>
          );
        const amount = BigInt(c.deltaMinor),
          rate = c.rateBasisPoints === null ? null : BigInt(c.rateBasisPoints),
          absolute = rate === null ? null : rate < 0n ? -rate : rate;
        return (
          <small key={c.currency}>
            {t('К предыдущему:')} {amount > 0n ? '+' : ''}
            {formatOwnerMoney(c.deltaMinor, c.currency)}
            {rate !== null && absolute !== null
              ? ` (${rate > 0n ? '+' : rate < 0n ? '-' : ''}${absolute / 100n},${(absolute % 100n).toString().padStart(2, '0')}%)`
              : ` (${t('процент недоступен: предыдущая сумма равна нулю')})`}
          </small>
        );
      })}
    </>
  );
}
function WorkloadValue({ value, t }: { value: Workload; t: Translate }) {
  const valid = value.state === 'COMPLETE' && value.percent != null;
  const fmt = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n);
  // пояснение расчёта во всплывающей подсказке: строка итогов остаётся одной строкой (Главная на одном экране)
  const basis =
    value.basis === 'BOOKED_SCHEDULE'
      ? t('Записанное время мастеров / сохранённое расписание')
      : value.basis === 'ACTUAL_TABLE_OCCUPANCY'
        ? t('Фактическая занятость столов / доступное время')
        : value.basis === 'SELLABLE_NIGHTS'
          ? t('Наблюдаемая загрузка фонда')
          : '';
  const counted =
    !value.funds && value.numerator !== null
      ? `${t('Учтено {done} из {total} {unit}.', {
          done: fmt(Number(value.numerator) / 60000),
          total: fmt(Number(value.denominator) / 60000),
          unit: value.unit === 'TABLE_MILLISECOND' ? t('столо-минут') : t('минут мастеров'),
        })} ${valid ? t('Отношение сумм мощностей за период.') : t('Итоговый процент периода недоступен.')}`
      : '';
  const reason =
    value.state === 'UNAVAILABLE' ? t('Нет данных для расчёта') : ownerReason(value.reason, t);
  return (
    <>
      <span
        className="owner-totals__load"
        title={[valid ? basis : '', counted].filter(Boolean).join(' ') || undefined}
      >
        <strong className="owner-value">{valid ? `${fmt(value.percent!)}%` : t('Нет данных')}</strong>
        {valid && <progress max={100} value={value.percent!} aria-label={t('Доля занятой мощности')} />}
      </span>
      {reason && <small>{reason}</small>}
      {value.funds?.map((f) => (
        <small key={f.unit}>
          {f.unit === 'ROOM_NIGHT' ? t('Номеро-ночи') : t('Койко-ночи')}:{' '}
          {f.numerator === null
            ? t('нет данных')
            : t('{done} из {total} (неполная история)', { done: f.numerator, total: String(f.denominator) })}
        </small>
      ))}
    </>
  );
}

/** Период словами: «21 октября», «1-16 октября», «28 сентября - 4 октября» (живой сайт 21.10.2026: ISO-даты на главной) */
export function humanPeriod(from: string, to: string, locale: DeskLocale = 'ru'): string {
  const d = (iso: string) => new Date(`${iso}T12:00:00Z`);
  const day = (iso: string) =>
    dateFormat(intlLocale(locale), { day: 'numeric', timeZone: 'UTC' }).format(d(iso));
  const dayMonth = (iso: string) =>
    dateFormat(intlLocale(locale), { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      d(iso),
    );
  if (from === to) return dayMonth(from);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${day(from)}-${dayMonth(to)}`;
  return `${dayMonth(from)} - ${dayMonth(to)}`;
}

/** «Запись → визит» салона за период (insights `visits`): прошедшие записи по статусам */
export interface OwnerVisits {
  booked: number;
  came: number;
  noShow: number;
  cancelled: number;
  unmarked: number;
  percent: number | null;
}

export function OwnerSummaryView({
  summary: s,
  locale = 'ru',
  visits,
}: {
  visits?: OwnerVisits | null;
  summary: OwnerSummaryDto;
  locale?: DeskLocale;
}) {
  const t = translator(locale);
  if (!['BEAUTY', 'FOOD_SERVICE', 'HOSPITALITY'].includes(s.scope.vertical))
    return (
      <main id="main-content" className="owner-home" tabIndex={-1}>
        <h1>{t('Главная')}</h1>
        <p role="status">{t('Направление не поддерживается')}</p>
      </main>
    );
  const expenses = s.current.paidExpenses;
  // все четыре показателя пусты: вместо плиток «Нет данных» одно пустое состояние с действием (п. 8)
  const noMoney = (v: { currencies?: readonly unknown[] | null }) => !v.currencies?.length;
  const empty =
    noMoney(s.current.revenue) &&
    noMoney(s.current.receipts) &&
    noMoney(expenses) &&
    !(s.workload.state === 'COMPLETE' && s.workload.percent != null);
  const firstStep =
    s.scope.vertical === 'BEAUTY'
      ? { href: '/calendar', label: t('Добавить первую запись') }
      : s.scope.vertical === 'FOOD_SERVICE'
        ? { href: '/floor-plan', label: t('Открыть зал') }
        : { href: '/chessboard', label: t('Добавить первую бронь') };
  const finance = financePeriodHref(
    s.scope.vertical === 'FOOD_SERVICE' ? '/restaurant-finance' : '/finance',
    { from: s.period.fromDate, to: s.period.toDate },
  );
  const loadLabel =
    s.period.key === 'today'
      ? t('Загрузка сегодня')
      : s.period.key === 'week'
        ? t('Средняя загрузка за 7 дней')
        : t('Средняя загрузка за месяц');
  // «Требуют решения»: дела сегодня от API, не больше 4 строк (экран не листается); ссылка в финансы несёт период
  const attention = (s.attention ?? []).slice(0, 4);
  const withPeriod = (href: string) =>
    href === '/finance' || href === '/restaurant-finance'
      ? financePeriodHref(href, { from: s.period.fromDate, to: s.period.toDate })
      : href;
  // Главная на одном экране компьютера (решение владельца 21.10.2026): шапка строкой, итоги строкой,
  // ниже график слева и справа «Требуют решения»; «Куда уходят деньги» строкой внизу на всю ширину
  // (решение 23.10.2026: «расходы снизу, в один экран»); листать не нужно
  return (
    <main id="main-content" className="owner-home" tabIndex={-1}>
      <header className="owner-bar">
        <h1>{t('Главная')}</h1>
        <span className="owner-bar__updated">
          {t('Обновлено')}{' '}
          {/* «16 окт., 14:00»: без года и «г.» (аудит 22.10.2026 P2-9) */}
          {dateFormat(intlLocale(locale), {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: s.period.timezone,
          }).format(new Date(s.generatedAt))}
        </span>
        {/* владелец 30.10.2026: «выбор периода как в Журнале, единый стиль»: одна рамка [📅 период ˅ ‹ ›], окно
            с готовыми периодами и календарём (DateRangePopover); стрелки листают месяцы */}
        {(() => {
          const month = ownerMonth(s.period.fromDate, s.period.key);
          // текущий месяц филиала: дальше вперёд листать нечего
          const today = new Date(s.generatedAt).toISOString().slice(0, 10);
          const thisMonth = today.slice(0, 7);
          const next = shiftMonth(month, 1);
          return (
            <div className="board-period owner-period" role="group" aria-label={t('Период отчёта')}>
              <DateRangePopover
                from={s.period.fromDate}
                to={s.period.toDate}
                today={today}
                maxDays={366}
                action="/today"
                triggerTestId="owner-custom-period"
                compact
              />
              <a className="icon-button" href={`/today?period=month:${shiftMonth(month, -1)}`} aria-label={t('Предыдущий месяц')}>
                <Icon name="chevron" className="rotate-left" />
              </a>
              {next <= thisMonth ? (
                <a className="icon-button" href={`/today?period=month:${next}`} aria-label={t('Следующий месяц')}>
                  <Icon name="chevron" />
                </a>
              ) : (
                <span className="icon-button is-disabled" aria-hidden="true">
                  <Icon name="chevron" />
                </span>
              )}
            </div>
          );
        })()}
        <div className="owner-bar__actions">
          {/* экраны дня (записи, зал, заезды) уехали с Главной сюда: без ссылки до них было не дойти (Д6) */}
          <a className="btn btn--secondary" href="/today/operations">
            {t('Рабочий день')}
          </a>
          <a className="btn btn--secondary" href={finance}>
            {t('Отчёт за период')}
          </a>
        </div>
      </header>
      {empty ? (
        <section
          className="owner-panel owner-empty"
          data-testid="owner-empty"
          aria-label={t('Показатели руководителя')}
        >
          <div>
            <h2>{t('За этот период пока нет данных')}</h2>
            <p>{t('Выручка, оплаты, расходы и загрузка появятся здесь после первых операций.')}</p>
          </div>
          <a className="btn btn--primary" href={firstStep.href}>
            {firstStep.label}
          </a>
        </section>
      ) : (
        <section className="owner-panel owner-totals" aria-label={t('Показатели руководителя')}>
          <div title={t('Начисления, не полученные оплаты')}>
            <h2>{t('Выручка')}</h2>
            <MoneyValue value={s.current.revenue} t={t} />
            <MoneyComparison value={s.comparisons?.revenue} reason={s.comparisonReason} t={t} />
          </div>
          <div title={t('Полученные оплаты, не выручка')}>
            <h2>{t('Поступления')}</h2>
            <MoneyValue value={s.current.receipts} t={t} />
            <MoneyComparison value={s.comparisons?.receipts} reason={s.comparisonReason} t={t} />
          </div>
          <div title={t('Только завершённые расходные операции')}>
            <h2>{t('Оплаченные расходы')}</h2>
            <MoneyValue
              t={t}
              value={{
                ...expenses,
                currencies:
                  expenses.currencies?.map((c) => ({
                    currency: c.currency,
                    amountMinor: c.paidMinor,
                  })) ?? null,
              }}
            />
            <MoneyComparison value={s.comparisons?.paidExpenses} reason={s.comparisonReason} t={t} />
          </div>
          <div>
            <h2>{loadLabel}</h2>
            <WorkloadValue value={s.workload} t={t} />
          </div>
        </section>
      )}
      <div className="owner-body">
        <section className="owner-panel owner-dynamics">
          <div className="owner-panel-heading">
            <h2>{t('Динамика по дням')}</h2>
            <a href={finance}>{t('Финансовый отчёт')}</a>
          </div>
          <OwnerDailyChart
            metrics={[
              {
                label: t('Выручка'),
                daily: s.current.revenue.daily,
                previous: s.previous?.revenue.daily,
              },
              {
                label: t('Поступления'),
                daily: s.current.receipts.daily,
                previous: s.previous?.receipts.daily,
              },
              {
                label: t('Оплаченные расходы'),
                daily: expenses.daily,
                previous: s.previous?.paidExpenses.daily,
              },
            ]}
          />
          {s.previous && (
            <p className="owner-dynamics__note">
              {t('Сравнение с периодом {period}, до того же времени.', {
                period: humanPeriod(s.previous.period.fromDate, s.previous.period.toDate, locale),
              })}
            </p>
          )}
        </section>
        <aside className="owner-side" aria-label={t('Решения')}>
          <section className="owner-panel owner-attention" aria-labelledby="owner-attention-title">
            <h2 id="owner-attention-title">{t('Требуют решения')}</h2>
            <ul className="owner-todo">
              {attention.length ? (
                attention.map((item) => (
                  <li key={item.id} data-state={item.tone} data-testid={`owner-attention-${item.id}`}>
                    <span title={item.text}>{item.text}</span>
                    <a href={withPeriod(item.href)}>{item.action}</a>
                  </li>
                ))
              ) : (
                <li data-state="ok" data-testid="owner-attention-unavailable">
                  <span>{t('Дела дня не загрузились, откройте рабочий день')}</span>
                  <a href="/today/operations">{t('Открыть день')}</a>
                </li>
              )}
            </ul>
          </section>
          {/* владелец 30.10.2026: «конверсия из записи в визит, а то бронируют и не доходят, чтобы мы понимали» */}
          {visits && (
            <section className="owner-panel owner-visits" data-testid="owner-visits" aria-labelledby="owner-visits-title">
              <div className="owner-panel-heading">
                <h2 id="owner-visits-title">{t('Запись → визит')}</h2>
                {visits.booked > 0 && <strong className="owner-visits__percent">{visits.percent} %</strong>}
              </div>
              {visits.booked > 0 ? (
                <ul className="owner-visits__rows">
                  <li><span>{t('Пришли')}</span><b>{visits.came}</b></li>
                  <li>
                    <span>{t('Не пришли')}</span>
                    {visits.noShow > 0 ? (
                      <a href={`/appointments?from=${s.period.fromDate}&to=${s.period.toDate}&status=NO_SHOW`}>{visits.noShow}</a>
                    ) : (
                      <b>0</b>
                    )}
                  </li>
                  <li><span>{t('Отменили')}</span><b>{visits.cancelled}</b></li>
                  <li title={t('Время записи прошло, а статус не отмечен')}><span>{t('Не отмечены')}</span><b>{visits.unmarked}</b></li>
                </ul>
              ) : (
                <p className="owner-visits__empty">{t('Прошедших записей за период нет')}</p>
              )}
              <p className="owner-visits__note">{t('Из {n} записей, время которых прошло', { n: visits.booked })}</p>
            </section>
          )}
        </aside>
      </div>
      <section className="owner-panel owner-expense-panel" aria-labelledby="owner-expense-title">
        <div className="owner-panel-heading">
          <h2 id="owner-expense-title">{t('Куда уходят деньги')}</h2>
          <a href={finance}>{t('Оплаченные расходы')}</a>
        </div>
        <div className="owner-expenses">
          {expenses.currencies?.flatMap((c) => {
            const complete =
              expenses.state === 'READY' &&
              BigInt(c.paidMinor) > 0n &&
              c.categories.every((category) => BigInt(category.paidMinor) >= 0n) &&
              c.categories.reduce(
                (total, category) => total + BigInt(category.paidMinor),
                0n,
              ) === BigInt(c.paidMinor);
            // одна строка внизу экрана: четыре крупные статьи, остальные в «Финансах» (решение 23.10.2026)
            const top = [...c.categories]
              .sort((a, b) => (BigInt(b.paidMinor) > BigInt(a.paidMinor) ? 1 : BigInt(b.paidMinor) < BigInt(a.paidMinor) ? -1 : 0))
              .slice(0, 4);
            return top.map((category) => {
              const name = category.categoryId === null ? t('Без статьи') : category.categoryName;
              // Presentation-only bounded share of this currency, never a cross-currency total.
              const share = complete
                ? Number((BigInt(category.paidMinor) * 10000n) / BigInt(c.paidMinor)) / 100
                : null;
              return (
                <div
                  key={`${c.currency}:${category.categoryId ?? 'unclassified'}`}
                  className="owner-category"
                >
                  <h3>{name}</h3>
                  <strong>
                    {formatOwnerMoney(category.paidMinor, c.currency)}
                    {share !== null && (
                      <span>
                        {new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(
                          share,
                        )}
                        %
                      </span>
                    )}
                  </strong>
                  {share !== null && (
                    <progress
                      max={100}
                      value={share}
                      aria-label={t('Доля расходов: {name}, {currency}', { name, currency: c.currency })}
                    />
                  )}
                </div>
              );
            });
          })}
        </div>
        {(() => {
          const rest = (expenses.currencies ?? []).reduce((n, c) => n + Math.max(0, c.categories.length - 4), 0);
          return rest > 0 ? (
            <p className="owner-expense-more">
              <a href={finance}>{t('Остальные статьи ({rest}) в «Финансах»', { rest })}</a>
            </p>
          ) : null;
        })()}
        {!expenses.currencies?.length && (
          <p className="owner-expense-empty">
            {ownerReason(expenses.reason, t) ||
              t('Расходов за период пока нет. Добавьте расход в «Финансах», и здесь появятся статьи.')}
          </p>
        )}
      </section>
    </main>
  );
}

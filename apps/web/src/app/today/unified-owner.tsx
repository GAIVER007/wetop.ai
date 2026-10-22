import { financePeriodHref } from '../../lib/finance-period';
import type { OwnerSummaryDto, Workload } from '../../lib/owner-summary';
import { formatOwnerMoney, ownerReason } from '../../lib/owner-summary';
import './unified-owner.css';
import { OwnerDailyChart } from './owner-daily-chart';
const periods = [
  ['today', 'Сегодня'],
  ['week', '7 дней'],
  ['month', 'Месяц'],
] as const;
function MoneyValue({ value }: { value: OwnerSummaryDto['current']['revenue'] }) {
  return (
    <>
      <strong className="owner-value">
        {value.currencies?.length
          ? value.currencies.map((c) => (
              <span key={c.currency}>{formatOwnerMoney(c.amountMinor, c.currency)}</span>
            ))
          : 'Нет данных'}
      </strong>
      {value.state !== 'READY' && <small>{ownerReason(value.reason)}</small>}
    </>
  );
}
function MoneyComparison({
  value,
  reason,
}: {
  value: NonNullable<OwnerSummaryDto['comparisons']>['revenue'] | undefined;
  reason: string | null;
}) {
  if (!value?.currencies?.length)
    return (
      <small title={ownerReason(reason ?? value?.reason) || undefined}>
        Нет данных для сравнения
      </small>
    );
  return (
    <>
      {value.currencies.map((c) => {
        if (c.deltaMinor === null)
          return (
            <small key={c.currency}>
              {value.currencies!.length > 1 ? `${c.currency}: ` : ''}Нет данных для сравнения
            </small>
          );
        const amount = BigInt(c.deltaMinor),
          rate = c.rateBasisPoints === null ? null : BigInt(c.rateBasisPoints),
          absolute = rate === null ? null : rate < 0n ? -rate : rate;
        return (
          <small key={c.currency}>
            К предыдущему: {amount > 0n ? '+' : ''}
            {formatOwnerMoney(c.deltaMinor, c.currency)}
            {rate !== null && absolute !== null
              ? ` (${rate > 0n ? '+' : rate < 0n ? '-' : ''}${absolute / 100n},${(absolute % 100n).toString().padStart(2, '0')}%)`
              : ' (процент недоступен: предыдущая сумма равна нулю)'}
          </small>
        );
      })}
    </>
  );
}
function WorkloadValue({ value }: { value: Workload }) {
  const valid = value.state === 'COMPLETE' && value.percent != null;
  const fmt = (n: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(n);
  // пояснение расчёта во всплывающей подсказке: строка итогов остаётся одной строкой (Главная на одном экране)
  const basis =
    value.basis === 'BOOKED_SCHEDULE'
      ? 'Записанное время мастеров / сохранённое расписание'
      : value.basis === 'ACTUAL_TABLE_OCCUPANCY'
        ? 'Фактическая занятость столов / доступное время'
        : value.basis === 'SELLABLE_NIGHTS'
          ? 'Наблюдаемая загрузка фонда'
          : '';
  const counted =
    !value.funds && value.numerator !== null
      ? `Учтено ${fmt(Number(value.numerator) / 60000)} из ${fmt(Number(value.denominator) / 60000)} ${
          value.unit === 'TABLE_MILLISECOND' ? 'столо-минут' : 'минут мастеров'
        }. ${valid ? 'Отношение сумм мощностей за период.' : 'Итоговый процент периода недоступен.'}`
      : '';
  const reason =
    value.state === 'UNAVAILABLE' ? 'Нет данных для расчёта' : ownerReason(value.reason);
  return (
    <>
      <span
        className="owner-totals__load"
        title={[valid ? basis : '', counted].filter(Boolean).join(' ') || undefined}
      >
        <strong className="owner-value">{valid ? `${fmt(value.percent!)}%` : 'Нет данных'}</strong>
        {valid && <progress max={100} value={value.percent!} aria-label="Доля занятой мощности" />}
      </span>
      {reason && <small>{reason}</small>}
      {value.funds?.map((f) => (
        <small key={f.unit}>
          {f.unit === 'ROOM_NIGHT' ? 'Номеро-ночи' : 'Койко-ночи'}:{' '}
          {f.numerator === null
            ? 'нет данных'
            : `${f.numerator} из ${f.denominator} (неполная история)`}
        </small>
      ))}
    </>
  );
}

/** Период словами: «21 октября», «1-16 октября», «28 сентября - 4 октября» (живой сайт 21.10.2026: ISO-даты на главной) */
export function humanPeriod(from: string, to: string): string {
  const d = (iso: string) => new Date(`${iso}T12:00:00Z`);
  const day = (iso: string) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', timeZone: 'UTC' }).format(d(iso));
  const dayMonth = (iso: string) =>
    new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      d(iso),
    );
  if (from === to) return dayMonth(from);
  if (from.slice(0, 7) === to.slice(0, 7)) return `${day(from)}-${dayMonth(to)}`;
  return `${dayMonth(from)} - ${dayMonth(to)}`;
}

export function OwnerSummaryView({ summary: s }: { summary: OwnerSummaryDto }) {
  if (!['BEAUTY', 'FOOD_SERVICE', 'HOSPITALITY'].includes(s.scope.vertical))
    return (
      <main id="main-content" className="owner-home" tabIndex={-1}>
        <h1>Главная</h1>
        <p role="status">Направление не поддерживается</p>
      </main>
    );
  const expenses = s.current.paidExpenses;
  // путь как в меню: у салона это Журнал (аудит 21.10.2026, п. 10)
  const operational =
    s.scope.vertical === 'BEAUTY'
      ? '/calendar'
      : s.scope.vertical === 'FOOD_SERVICE'
        ? '/floor-plan'
        : '/chessboard';
  // все четыре показателя пусты: вместо плиток «Нет данных» одно пустое состояние с действием (п. 8)
  const noMoney = (v: { currencies?: readonly unknown[] | null }) => !v.currencies?.length;
  const empty =
    noMoney(s.current.revenue) &&
    noMoney(s.current.receipts) &&
    noMoney(expenses) &&
    !(s.workload.state === 'COMPLETE' && s.workload.percent != null);
  const firstStep =
    s.scope.vertical === 'BEAUTY'
      ? { href: '/calendar', label: 'Добавить первую запись' }
      : s.scope.vertical === 'FOOD_SERVICE'
        ? { href: '/floor-plan', label: 'Открыть зал' }
        : { href: '/chessboard', label: 'Добавить первую бронь' };
  const finance = financePeriodHref(
    s.scope.vertical === 'FOOD_SERVICE' ? '/restaurant-finance' : '/finance',
    { from: s.period.fromDate, to: s.period.toDate },
  );
  const loadLabel =
    s.period.key === 'today'
      ? 'Загрузка сегодня'
      : s.period.key === 'week'
        ? 'Средняя загрузка за 7 дней'
        : 'Средняя загрузка за месяц';
  const expenseNote =
    s.classificationReason === 'UNCLASSIFIED_EXPENSE_SOURCES'
      ? 'Есть расходы без статьи.'
      : s.classificationReason === 'EXPENSE_DOCUMENT_LINKS_NOT_CONNECTED'
        ? 'Расходы показаны общей суммой, без статей.'
        : 'Проверьте оплаченные операции за период.';
  // Главная на одном экране компьютера (решение владельца 21.10.2026): шапка строкой, итоги строкой,
  // ниже график слева и справа «Требуют решения» с «Куда уходят деньги»; листать не нужно
  return (
    <main id="main-content" className="owner-home" tabIndex={-1}>
      <header className="owner-bar">
        <h1>Главная</h1>
        <span className="owner-bar__updated">
          Обновлено{' '}
          {/* «16 окт., 14:00»: без года и «г.» (аудит 22.10.2026 P2-9) */}
          {new Intl.DateTimeFormat('ru-RU', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: s.period.timezone,
          }).format(new Date(s.generatedAt))}
        </span>
        <nav className="seg" aria-label="Период отчёта">
          {periods.map(([key, label]) => (
            <a
              key={key}
              className={s.period.key === key ? 'seg__item is-on' : 'seg__item'}
              aria-current={s.period.key === key ? 'page' : undefined}
              href={`/today?period=${key}`}
              title={key === 'month' ? 'С начала календарного месяца' : undefined}
            >
              {label}
            </a>
          ))}
        </nav>
        <time className="owner-bar__period" dateTime={s.period.fromDate}>
          {humanPeriod(s.period.fromDate, s.period.toDate)}
        </time>
        <div className="owner-bar__actions">
          {/* экраны дня (записи, зал, заезды) уехали с Главной сюда: без ссылки до них было не дойти (Д6) */}
          <a className="btn btn--secondary" href="/today/operations">
            Рабочий день
          </a>
          <a className="btn btn--secondary" href={finance}>
            Отчёт за период
          </a>
        </div>
      </header>
      {empty ? (
        <section
          className="owner-panel owner-empty"
          data-testid="owner-empty"
          aria-label="Показатели руководителя"
        >
          <div>
            <h2>За этот период пока нет данных</h2>
            <p>Выручка, оплаты, расходы и загрузка появятся здесь после первых операций.</p>
          </div>
          <a className="btn btn--primary" href={firstStep.href}>
            {firstStep.label}
          </a>
        </section>
      ) : (
        <section className="owner-panel owner-totals" aria-label="Показатели руководителя">
          <div title="Начисления, не полученные оплаты">
            <h2>Выручка</h2>
            <MoneyValue value={s.current.revenue} />
            <MoneyComparison value={s.comparisons?.revenue} reason={s.comparisonReason} />
          </div>
          <div title="Полученные оплаты, не выручка">
            <h2>Поступления</h2>
            <MoneyValue value={s.current.receipts} />
            <MoneyComparison value={s.comparisons?.receipts} reason={s.comparisonReason} />
          </div>
          <div title="Только завершённые расходные операции">
            <h2>Оплаченные расходы</h2>
            <MoneyValue
              value={{
                ...expenses,
                currencies:
                  expenses.currencies?.map((c) => ({
                    currency: c.currency,
                    amountMinor: c.paidMinor,
                  })) ?? null,
              }}
            />
            <MoneyComparison value={s.comparisons?.paidExpenses} reason={s.comparisonReason} />
          </div>
          <div>
            <h2>{loadLabel}</h2>
            <WorkloadValue value={s.workload} />
          </div>
        </section>
      )}
      <div className="owner-body">
        <section className="owner-panel owner-dynamics">
          <div className="owner-panel-heading">
            <h2>Динамика по дням</h2>
            <a href={finance}>Финансовый отчёт</a>
          </div>
          <OwnerDailyChart
            metrics={[
              {
                label: 'Выручка',
                daily: s.current.revenue.daily,
                previous: s.previous?.revenue.daily,
              },
              {
                label: 'Поступления',
                daily: s.current.receipts.daily,
                previous: s.previous?.receipts.daily,
              },
              {
                label: 'Оплаченные расходы',
                daily: expenses.daily,
                previous: s.previous?.paidExpenses.daily,
              },
            ]}
          />
          {s.previous && (
            <p className="owner-dynamics__note">
              Сравнение с периодом{' '}
              {humanPeriod(s.previous.period.fromDate, s.previous.period.toDate)}, до того же
              времени.
            </p>
          )}
        </section>
        <aside className="owner-side" aria-label="Решения и расходы">
          <section className="owner-panel owner-attention" aria-labelledby="owner-attention-title">
            <h2 id="owner-attention-title">Требуют решения</h2>
            <ul className="owner-todo">
              <li data-state={s.workload.state === 'COMPLETE' ? 'ok' : 'warn'}>
                <span>
                  {s.workload.state === 'COMPLETE'
                    ? 'Загрузка рассчитана за выбранный период.'
                    : 'Для расчёта загрузки не хватает данных.'}
                </span>
                <a href={operational}>Проверить загрузку</a>
              </li>
              <li data-state={s.classificationReason ? 'warn' : 'ok'}>
                <span>{expenseNote}</span>
                <a href={finance}>Открыть операции</a>
              </li>
            </ul>
          </section>
          <section className="owner-panel owner-expense-panel">
            <div className="owner-panel-heading">
              <h2>Куда уходят деньги</h2>
              <a href={finance}>Оплаченные расходы</a>
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
                return c.categories.map((category) => {
                  const name = category.categoryId === null ? 'Без статьи' : category.categoryName;
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
                          aria-label={`Доля расходов: ${name}, ${c.currency}`}
                        />
                      )}
                    </div>
                  );
                });
              })}
            </div>
            {!expenses.currencies?.length && (
              <p className="owner-expense-empty">
                {ownerReason(expenses.reason) ||
                  'Расходов за период пока нет. Добавьте расход в «Финансах», и здесь появятся статьи.'}
              </p>
            )}
          </section>
        </aside>
      </div>
    </main>
  );
}

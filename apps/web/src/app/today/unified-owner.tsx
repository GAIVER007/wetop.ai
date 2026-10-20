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
      <div className="owner-value">
        {value.currencies?.length
          ? value.currencies.map((c) => (
              <div key={c.currency}>{formatOwnerMoney(c.amountMinor, c.currency)}</div>
            ))
          : 'Нет данных'}
      </div>
      {value.state !== 'READY' && <p>{ownerReason(value.reason)}</p>}
    </>
  );
}
function MoneyComparison({value,reason}:{value:NonNullable<OwnerSummaryDto['comparisons']>['revenue']|undefined;reason:string|null}) {
  if(!value?.currencies?.length) return <p title={ownerReason(reason??value?.reason) || undefined}>Нет данных для сравнения</p>;
  return <>{value.currencies.map(c=>{
    if(c.deltaMinor===null) return <p key={c.currency}>{value.currencies!.length > 1 ? `${c.currency}: ` : ''}Нет данных для сравнения</p>;
    const amount=BigInt(c.deltaMinor),rate=c.rateBasisPoints===null?null:BigInt(c.rateBasisPoints),absolute=rate===null?null:rate<0n?-rate:rate;
    return <p key={c.currency}>К предыдущему: {amount>0n?'+':''}{formatOwnerMoney(c.deltaMinor,c.currency)}{rate!==null && absolute!==null ? ` (${rate>0n?'+':rate<0n?'-':''}${absolute/100n},${(absolute%100n).toString().padStart(2,'0')}%)` : ' (процент недоступен: предыдущая сумма равна нулю)'}</p>;
  })}</>;
}
function WorkloadValue({ value }: { value: Workload }) {
  const valid = value.state === 'COMPLETE' && value.percent != null;
  return (
    <>
      <div className="owner-value">
        {valid
          ? `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(value.percent!)}%`
          : 'Нет данных'}
      </div>
      {valid && <progress max={100} value={value.percent!} aria-label="Доля занятой мощности" />}
      <p>{value.state === 'UNAVAILABLE' ? 'Нет данных для расчёта' : ownerReason(value.reason)}</p>
      {valid && <p>
        {value.basis === 'BOOKED_SCHEDULE'
          ? 'Записанное время мастеров / сохранённое расписание'
          : value.basis === 'ACTUAL_TABLE_OCCUPANCY'
            ? 'Фактическая занятость столов / доступное время'
            : value.basis === 'SELLABLE_NIGHTS'
              ? 'Наблюдаемая загрузка фонда'
              : ''}
      </p>}
      {value.funds?.map((f) => (
        <p key={f.unit}>
          {f.unit === 'ROOM_NIGHT' ? 'Номеро-ночи' : 'Койко-ночи'}:{' '}
          {f.numerator === null
            ? 'нет данных'
            : `${f.numerator} из ${f.denominator} (неполная история)`}
        </p>
      ))}
      {!value.funds && value.numerator !== null && (
        <p>
          Учтено {new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(Number(value.numerator) / 60000)} из {new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 1 }).format(Number(value.denominator) / 60000)}{' '}
          {value.unit === 'TABLE_MILLISECOND' ? 'столо-минут' : 'минут мастеров'}.{' '}
          {valid ? 'Отношение сумм мощностей за период.' : 'Итоговый процент периода недоступен.'}
        </p>
      )}
    </>
  );
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
  const operational =
    s.scope.vertical === 'BEAUTY'
      ? '/appointments'
      : s.scope.vertical === 'FOOD_SERVICE'
        ? '/floor-plan'
        : '/chessboard';
  const finance = financePeriodHref(
    s.scope.vertical === 'FOOD_SERVICE' ? '/restaurant-finance' : '/finance',
    { from: s.period.fromDate, to: s.period.toDate },
  );
  return (
    <main id="main-content" className="owner-home" tabIndex={-1}>
      <header className="owner-heading">
        <div>
          <p className="owner-eyebrow">Обзор бизнеса</p>
          <h1>Главная</h1>
          <p>
            Обновлено{' '}
            {new Intl.DateTimeFormat('ru-RU', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: s.period.timezone,
            }).format(new Date(s.generatedAt))}, {s.period.timezone}
          </p>
        </div>
        <div className="owner-heading__actions">
          {/* экраны дня (записи, зал, заезды) уехали с Главной сюда: без ссылки до них было не дойти (Д6) */}
          <a className="btn btn--secondary" href="/today/operations">
            Рабочий день
          </a>
          <a className="btn btn--secondary" href={finance}>
            Отчёт за период
          </a>
        </div>
      </header>
      <div className="owner-toolbar">
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
        <p>
          <time dateTime={s.period.fromDate}>{s.period.fromDate}</time> – <time dateTime={s.period.toDate}>{s.period.toDate}</time>
        </p>
      </div>
      <section className="owner-kpis" aria-label="Показатели руководителя">
        <article>
          <h2>Выручка</h2>
          <MoneyValue value={s.current.revenue} />
          <MoneyComparison value={s.comparisons?.revenue} reason={s.comparisonReason} />
          <p>Начисления, не полученные оплаты</p>
        </article>
        <article>
          <h2>
            {s.period.key === 'today'
              ? 'Загрузка сегодня'
              : s.period.key === 'week'
                ? 'Средняя загрузка за 7 дней'
                : 'Средняя загрузка за месяц'}
          </h2>
          <WorkloadValue value={s.workload} />
        </article>
        <article>
          <h2>Поступления</h2>
          <MoneyValue value={s.current.receipts} />
          <MoneyComparison value={s.comparisons?.receipts} reason={s.comparisonReason} />
          <p>Полученные оплаты, не выручка</p>
        </article>
        <article>
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
          <p>Только завершённые расходные операции</p>
        </article>
      </section>
      <div className="owner-body">
        <section className="owner-panel owner-dynamics">
          <div className="owner-panel-heading">
            <div><h2>Динамика по дням</h2><p>{s.period.fromDate} – {s.period.toDate}</p></div>
            <a href={finance}>Финансовый отчёт</a>
          </div>
          <OwnerDailyChart metrics={[
            {label:'Выручка',daily:s.current.revenue.daily,previous:s.previous?.revenue.daily},
            {label:'Поступления',daily:s.current.receipts.daily,previous:s.previous?.receipts.daily},
            {label:'Оплаченные расходы',daily:expenses.daily,previous:s.previous?.paidExpenses.daily},
          ]} />
          <p>{s.previous ? `Сравнение: ${s.previous.period.fromDate} – ${s.previous.period.toDate}, до того же местного времени.` : null}</p>
        </section>
        <aside className="owner-panel owner-attention" aria-labelledby="owner-attention-title">
          <div className="owner-panel-heading"><h2 id="owner-attention-title">Требуют решения</h2></div>
          <div className="owner-decision">
          <h3>Загрузка</h3>
          <p>{s.workload.state === 'COMPLETE' ? 'Загрузка рассчитана за выбранный период.' : 'Для расчёта загрузки не хватает данных.'}</p>
          <a href={operational}>Проверить загрузку</a>
          </div><div className="owner-decision"><h3>Учёт расходов</h3>
          <p>
            {s.classificationReason === 'UNCLASSIFIED_EXPENSE_SOURCES' ? 'Есть расходы без статьи.' : s.classificationReason === 'EXPENSE_DOCUMENT_LINKS_NOT_CONNECTED' ? 'Статьи расходов пока недоступны.' : 'Проверьте оплаченные операции за период.'}
          </p>
          <a href={finance}>Открыть операции</a>
          </div>
        </aside>
      </div>
      <section className="owner-panel owner-expense-panel">
        <div className="owner-panel-heading">
          <div><h2>Куда уходят деньги</h2><p>За выбранный период</p></div>
          <a href={finance}>Оплаченные расходы</a>
        </div>
        <div className="owner-expenses">
          {expenses.currencies?.flatMap((c) => {
            const complete = expenses.state === 'READY' && BigInt(c.paidMinor) > 0n &&
              c.categories.every(category => BigInt(category.paidMinor) >= 0n) &&
              c.categories.reduce((total, category) => total + BigInt(category.paidMinor), 0n) === BigInt(c.paidMinor);
            return c.categories.map((category) => {
              const name = category.categoryId === null ? 'Без статьи' : category.categoryName;
              // Presentation-only bounded share of this currency, never a cross-currency total.
              const share = complete ? Number(BigInt(category.paidMinor) * 10000n / BigInt(c.paidMinor)) / 100 : null;
              return <div key={`${c.currency}:${category.categoryId ?? 'unclassified'}`}>
                <div className="owner-category-heading"><h3>{name}</h3>{share !== null && <span>{new Intl.NumberFormat('ru-RU', {maximumFractionDigits: 2}).format(share)}%</span>}</div>
                <strong>{formatOwnerMoney(category.paidMinor, c.currency)}</strong>
                {share !== null && <progress max={100} value={share} aria-label={`Доля расходов: ${name}, ${c.currency}`} />}
              </div>;
            });
          })}
        </div>
        <p>
          {s.classificationReason === 'EXPENSE_DOCUMENT_LINKS_NOT_CONNECTED' ? 'Связи с документами расходов пока не подключены. ' : 'Статьи из связанных документов расходов. '}Без статьи: назначение не подтверждено, не «Прочее».
        </p>
        {!expenses.currencies?.length && (
          <p className="owner-expense-empty">{ownerReason(expenses.reason) || 'Нет классифицированных сумм. Отсутствие данных не означает нулевые расходы.'}</p>
        )}
      </section>
      <footer>
        <p>Выбран один филиал. Валюты показаны раздельно, без общего итога.</p>
      </footer>
    </main>
  );
}

import { EmptyState, Panel, Table } from '../../../../components/ui';
import { KpiStrip } from '../kpi-strip';
import type { PlatformExpenseCategory, PlatformMoney } from '../../../../lib/api';
import type { Translate } from '../../../../i18n';
import { dayText, usd } from '../shell';
import { VoidButton } from '../money-forms';
import { CATEGORY_LABEL } from '../categories';
import { percentText } from '../growth-parts';
import { formatInt } from '../../../../lib/dashboard-format';

type Ready = Extract<PlatformMoney, { ready: true }>;

/**
 * Вкладка «Расходы» в «Деньгах WETOP» (вариант Б, владелец 01.11.2026: «расходы засунуть в раздел деньги»).
 * Прежний раздел «Расходы» (30.10.2026) целиком: итог месяца и к прошлому, статьи с долей и отбором, все расходы.
 */
export function ExpensesTab({ view, month, category, t }: { view: Ready; month: string; category: string; t: Translate }) {
  const live = view.expenses.filter((e) => !e.voided);
  const total = live.reduce((n, e) => n + BigInt(e.amountCents), 0n);
  // прошлый месяц из таблицы по месяцам: выбранный последним, прошлый перед ним
  const table = view.summary.table;
  const prevIndex = table ? table.months.length - 2 : -1;
  const prev = table && prevIndex >= 0 ? table.categories.reduce((n, c) => n + BigInt(c.cents[prevIndex] ?? '0'), 0n) : null;
  const byCategory = new Map<PlatformExpenseCategory, bigint>();
  for (const e of live) byCategory.set(e.category, (byCategory.get(e.category) ?? 0n) + BigInt(e.amountCents));
  const parts = [...byCategory].sort((a, b) => (a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1));
  const top = parts[0];
  const known = (c: string): c is PlatformExpenseCategory => (view.categories as string[]).includes(c) || c === 'PARTNERS';
  const filter = known(category) ? category : null;
  const rows = filter ? view.expenses.filter((e) => e.category === filter) : view.expenses;
  // доля в десятых процента, без плавающей точки
  const share = (v: bigint) => (total === 0n ? 0 : Number((v * 1000n) / total));
  const href = (c: string | null) => `/platform/cabinet/money?tab=out&month=${month}${c ? `&category=${c}` : ''}`;
  return (
    <>
      <KpiStrip
        testId="expenses-strip"
        items={[
          { id: 'total', label: t('Расходы за месяц'), value: usd(String(total)), hint: t('записей: {n}', { n: formatInt(live.length) }), tone: 'danger' },
          { id: 'prev', label: t('Прошлый месяц'), value: prev === null ? '' : usd(String(prev)), hint: prev === null ? undefined : diffText(total - prev, t) },
          { id: 'top', label: t('Больше всего'), value: top ? t(CATEGORY_LABEL[top[0]]) : t('нет расходов'), hint: top ? `${usd(String(top[1]))}, ${percentText(share(top[1]))}` : undefined },
          { id: 'categories', label: t('Статей'), value: formatInt(parts.length) },
        ]}
      />
      <div className="cabinet-expenses">
        <Panel title={t('По статьям')} data-testid="expenses-by-category">
          {parts.length === 0 ? (
            <EmptyState title={t('Расходов в этом месяце нет')} />
          ) : (
            <ul className="cabinet-expenses__bars">
              {parts.map(([c, v]) => (
                <li key={c} data-active={filter === c || undefined}>
                  <a href={href(filter === c ? null : c)} data-testid="expenses-category">
                    <span className="cabinet-expenses__name">{t(CATEGORY_LABEL[c])}</span>
                    <span className="cabinet-expenses__sum">
                      {usd(String(v))} <span className="muted">{percentText(share(v))}</span>
                    </span>
                    <span className="cabinet-expenses__bar" aria-hidden="true">
                      <span
                        style={{ inlineSize: `${Math.max(2, share(v) / 10)}%` }} /* slop-allow: inline-style ширина полосы = доля статьи */
                      />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title={filter ? t('Расходы: {name}', { name: t(CATEGORY_LABEL[filter]) }) : t('Все расходы за месяц')}
          data-testid="expenses-list"
        >
          {filter && (
            <a className="cabinet__more" href={href(null)} data-testid="expenses-all">
              {t('Показать все статьи')}
            </a>
          )}
          <ExpensesTable rows={rows} t={t} />
        </Panel>
      </div>
    </>
  );
}

/** «на $120 больше» или «на $40 меньше» прошлого месяца */
function diffText(d: bigint, t: Translate): string {
  if (d === 0n) return t('как в прошлом месяце');
  return d > 0n ? t('на {sum} больше', { sum: usd(String(d)) }) : t('на {sum} меньше', { sum: usd(String(-d)) });
}

function ExpensesTable({ rows, t }: { rows: Ready['expenses']; t: Translate }) {
  if (rows.length === 0) return <EmptyState title={t('Расходов нет')} />;
  return (
    <Table aria-label={t('Расходы компании')} className="cabinet-expenses__table">
      <thead>
        <tr>
          <th>{t('Дата')}</th>
          <th>{t('Статья')}</th>
          <th>{t('Заметка')}</th>
          <th className="num">{t('Сумма')}</th>
          <th aria-label={t('Действия')} />
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => (
          <tr key={e.id} className={e.voided ? 'cabinet__voided' : undefined} data-testid="expenses-row">
            <td>{dayText(e.spentOn)}</td>
            <td>{t(CATEGORY_LABEL[e.category])}</td>
            <td className="muted">
              {e.voided
                ? t('отменён')
                : [e.payee, e.project, e.documentRef, e.note, e.recurring ? t('каждый месяц') : null].filter(Boolean).join(', ')}
            </td>
            <td className="num">{usd(e.amountCents)}</td>
            <td>{!e.voided && <VoidButton id={e.id} kind="expense" />}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}


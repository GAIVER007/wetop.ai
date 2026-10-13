import type { SearchParams } from '../../../lib/search-params';
import { requireVertical } from '../../../lib/vertical-guard';
import { formatMoney } from '../../../lib/money';
import { deltaPercent } from '../../../lib/dashboard-format';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { ShareBar } from '../../../components/share-bar';
import { Badge, SectionTitle, Stat, Stats, Table } from '../../../components/ui';
import { BackToModules } from '../parts';
import '../marketing.css';
import '../budget/budget.css';
import { loadBudget } from '../budget/load';
import { byDay, byPlatform, summarize } from '../budget/derive';
import { DailyChart } from '../budget/chart';
import { ChooseLocation, MonthNav, platformLabel } from '../budget/parts';

/**
 * «Маркетинг → Аналитика» (поручение владельца 10.10.2026 по макету «Маркетинг — Аналитика»):
 * одна картина эффективности источников, от расходов до продаж. Сейчас по-настоящему считаются
 * деньги: расходы месяца, динамика, расходы по источникам и по дням (из журнала «Бюджета»).
 * Лиды, квалификация, продажи, выручка и ROMI появятся, когда их начнут отдавать Meta (этап В3)
 * и ИИ-продавец (этапы В5/В6): до тех пор честное «Недостаточно данных», чисел не выдумываем
 * (правило `/market` и хаба). Воронка, мессенджеры и органика — те же этапы.
 */
const LATER = [
  ['Лиды', 'Подтянутся из Meta и от ИИ-продавца (этап В5)'],
  ['Квалифицированные', 'Квалификацию ведёт ИИ-продавец (этап В5)'],
  ['Продажи', 'Сделки и брони из CRM и ИИ-продавца (этап В5)'],
  ['Выручка', 'Из продаж и броней (этап В6)'],
  ['ROMI', 'Выручка минус расходы к расходам (этап В6)'],
] as const;

export default async function MarketingAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireVertical(['HOSPITALITY']);
  const loaded = await loadBudget(await searchParams);
  const subtitle = 'Полная картина эффективности маркетинга: от источников до продаж.';
  if (loaded.chooseLocation || loaded.error)
    return (
      <Page crumbs={<BackToModules />} title="Аналитика маркетинга" subtitle={subtitle}>
        {loaded.error ? <LoadError testId="man-error" {...loaded.error} /> : <ChooseLocation />}
      </Page>
    );
  const view = loaded.view!;
  const rc = view.reportingCurrency;
  const t = summarize(view);
  const prev = BigInt(view.prevSpent);
  const sources = byPlatform(view.expenses);
  return (
    <Page crumbs={<BackToModules />} title="Аналитика маркетинга" subtitle={subtitle}>
      <div className="budget-screen" data-testid="marketing-analytics">
        <div className="budget-head">
          <Badge tone="info">Источник данных: журнал «Бюджета»</Badge>
          <MonthNav base="/marketing/analytics" month={view.month} />
        </div>
        <Stats min={170}>
          <Stat
            label="Расходы на рекламу"
            value={formatMoney(t.spent, rc)}
            delta={prev > 0n ? deltaPercent(t.spent, prev) : undefined}
            hint={prev > 0n ? 'к прошлому месяцу' : 'прошлый месяц без расходов'}
            testId="man-spent"
          />
          {LATER.map(([label, hint]) => (
            <Stat key={label} label={label} value="Недостаточно данных" size="sm" hint={hint} />
          ))}
        </Stats>
        <section aria-labelledby="man-sources-title">
          <SectionTitle id="man-sources-title">Эффективность источников</SectionTitle>
          {sources.length === 0 ? (
            <p className="settings-note" data-testid="man-sources-empty">
              В этом месяце расходов ещё нет. Добавьте их в «Бюджете», и источники появятся здесь.
            </p>
          ) : (
            <div className="tbl-wrap" role="region" aria-label="Эффективность источников" tabIndex={0}>
              <Table density="normal" aria-label="Эффективность источников" data-testid="man-sources">
                <thead>
                  <tr>
                    <th scope="col">Источник</th>
                    <th scope="col" className="budget-td-num">
                      Расход
                    </th>
                    <th scope="col">Доля</th>
                    <th scope="col" className="budget-td-num">
                      Лиды
                    </th>
                    <th scope="col" className="budget-td-num">
                      CPL
                    </th>
                    <th scope="col" className="budget-td-num">
                      Продажи
                    </th>
                    <th scope="col" className="budget-td-num">
                      Выручка
                    </th>
                    <th scope="col" className="budget-td-num">
                      ROMI
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sources.map((s) => (
                    <tr key={s.platform}>
                      <td>{platformLabel(s.platform)}</td>
                      <td className="budget-td-num">{formatMoney(s.base, rc)}</td>
                      <td className="man-share">
                        <ShareBar label={`Доля ${platformLabel(s.platform)}`} value={s.share} showValue />
                      </td>
                      {/* лиды, продажи, выручка и ROMI: до Meta и ИИ-продавца данных нет, прочерк честнее нуля */}
                      <td className="budget-td-num">–</td>
                      <td className="budget-td-num">–</td>
                      <td className="budget-td-num">–</td>
                      <td className="budget-td-num">–</td>
                      <td className="budget-td-num">–</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
          <p className="settings-note" data-testid="man-sources-note">
            Лиды, CPL, продажи, выручка и ROMI по источникам подтянутся с подключением рекламных
            кабинетов (Meta, Google, TikTok, этап В3) и ИИ-продавца, который сам ведёт переписку,
            квалифицирует и бронирует (этапы В5/В6).
          </p>
        </section>
        <section aria-labelledby="man-days-title">
          <SectionTitle id="man-days-title">Расходы по дням</SectionTitle>
          <div className="panel panel--lg">
            <DailyChart days={byDay(view.expenses, view.month)} month={view.month} currency={rc} />
          </div>
        </section>
        <section aria-labelledby="man-soon-title">
          <SectionTitle id="man-soon-title">Дальше на этой странице</SectionTitle>
          <p className="marketing-soon" data-testid="man-soon">
            <Badge tone="info">Скоро</Badge>
            <span>
              Воронка маркетинга (показы, клики, лиды, встречи, продажи), диалоги WhatsApp и
              мессенджеров от ИИ-продавца, органика социальных сетей и сводка «Продажи и финансы»
              (средний чек, CPA, CAC, прибыль). Блоки появятся вместе со своими источниками данных,
              выдуманных цифр здесь не будет.
            </span>
          </p>
        </section>
      </div>
    </Page>
  );
}

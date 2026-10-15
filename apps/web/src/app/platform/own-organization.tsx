import '../branches/branches.css';
import './organizations.css';
import { randomUUID } from 'node:crypto';
import { unstable_rethrow } from 'next/navigation';
import { isIsoDate, todayAt } from '@pms/domain';
import { Badge, Fact, Grid, Panel, Stat, Stats } from '../../components/ui';
import { branchesApi, type BranchItem } from '../../lib/api';
import { summarizeBranches } from '../../lib/branch-summary';
import { formatMoney } from '../../lib/money';
import type { WebVertical } from '../../lib/vertical-landing';
import { selectBranch } from '../branches/actions';
import { BranchForm } from '../branches/form';

type BranchList = Awaited<ReturnType<typeof branchesApi.list>>;
type Query = Record<string, string | string[] | undefined>;

const KIND: Record<WebVertical, string> = {
  HOSPITALITY: 'Гостиница',
  BEAUTY: 'Салон',
  FOOD_SERVICE: 'Ресторан',
};

function fundLine(item: BranchItem): string {
  // у салона и ресторана номеров и коек нет вовсе (DATA_MODEL §19): состав фонда им не показывается
  if (item.vertical === 'FOOD_SERVICE') return 'Залы, столы и бронирования';
  if (item.vertical === 'BEAUTY') return 'Клиенты, услуги и мастера';
  return `${item._count.inventoryUnits} номеров и коек, ${item._count.accommodationTypes} категорий`;
}

function openLabel(item: BranchItem): string {
  if (item.vertical === 'FOOD_SERVICE') return 'Открыть ресторан';
  if (item.vertical === 'BEAUTY') return 'Открыть салон';
  return item._count.inventoryUnits ? 'Открыть филиал' : 'Настроить номера';
}

/**
 * Своя организация одним блоком: название, период, итоги, карточки филиалов с показателями прямо в карточке и
 * кнопка «Добавить филиал». ID организации и филиала на экран не выводятся: человеку они не нужны.
 */
export async function OwnOrganization({
  data,
  query,
  selected,
}: {
  data: BranchList;
  query: Query;
  selected: string;
}) {
  const { organization, items, canCreate } = data;
  const today = todayAt(items[0]?.timezone ?? 'UTC');
  const from = typeof query.from === 'string' && isIsoDate(query.from) ? query.from : today;
  const to = typeof query.to === 'string' && isIsoDate(query.to) ? query.to : from;
  // сбой показателей не прячет сами филиалы: карточки остаются, над ними одна строка о причине
  const overview = await branchesApi.overview(from, to).then(
    (value) => value,
    (error: unknown) => {
      unstable_rethrow(error);
      return null;
    },
  );
  const byBranch = new Map(overview?.rows.map((row) => [row.branch.id, row.stats]));
  const totals = overview ? summarizeBranches(overview.rows) : null;

  return (
    <section className="org-own" aria-labelledby="own-organization-title">
      <div className="org-own__head">
        <div>
          <h2 id="own-organization-title" className="org-own__title">
            {organization.name}
          </h2>
          <p className="org-note">
            Ваша организация, филиалов: {items.length}
          </p>
        </div>
        <form className="org-period">
          {selected && <input type="hidden" name="org" value={selected} />}
          <label>
            С даты
            <input className="inp" type="date" name="from" defaultValue={from} required />
          </label>
          <label>
            По дату
            <input className="inp" type="date" name="to" defaultValue={to} required min={from} />
          </label>
          <button className="btn" type="submit">
            Показать
          </button>
        </form>
      </div>

      {canCreate && (
        <details className="org-add">
          <summary className="btn">Добавить филиал</summary>
          <BranchForm id={randomUUID()} />
        </details>
      )}

      {overview === null && (
        <p role="status" className="org-note">
          Показатели за период не загрузились. Обновите страницу.
        </p>
      )}

      {totals && (
        <Stats min={170} aria-label="Итоги по филиалам">
          <Stat
            label="Загрузка"
            value={`${totals.percent}%`}
            hint={`гостиничных филиалов: ${overview?.rows.length ?? 0}`}
          />
          <Stat label="Гости в заездах" value={totals.guests} />
          {[...totals.currencies].flatMap(([currency, total]) => [
            <Stat
              key={`${currency}-revenue`}
              label={`Начислено, ${currency}`}
              value={formatMoney(total.revenue, currency)}
            />,
            <Stat
              key={`${currency}-paid`}
              label={`Поступило, ${currency}`}
              value={formatMoney(total.paid, currency)}
              hint={`возвраты ${formatMoney(total.refunded, currency)}`}
            />,
          ])}
        </Stats>
      )}

      <div className="org-branches">
        {items.map((item) => {
          const stats = byBranch.get(item.id);
          return (
            <Panel key={item.id}>
              <div className="org-branch__top">
                <h3 className="org-branch__name">{item.name}</h3>
                <Badge>{KIND[item.vertical]}</Badge>
              </div>
              <p>{item.address || 'Адрес не указан'}</p>
              <p className="org-note">{fundLine(item)}</p>
              {stats && (
                <Grid min={110} gap="sm" className="org-branch__stats">
                  <Fact label="Загрузка" value={`${stats.occupancy.percent}%`} />
                  <Fact label="Гости в заездах" value={stats.arrivals.guests} />
                  <Fact
                    label="Начислено"
                    value={formatMoney(stats.revenue.totalMinor, item.currency)}
                  />
                  <Fact
                    label="Поступило"
                    value={formatMoney(stats.payments.totalMinor, item.currency)}
                  />
                </Grid>
              )}
              <form action={selectBranch} className="org-branch__action">
                <input type="hidden" name="id" value={item.id} />
                <button className="btn" type="submit">
                  {openLabel(item)}
                </button>
              </form>
            </Panel>
          );
        })}
      </div>

      <p className="org-note">
        Показатели есть у гостиничных филиалов. Даты считаются по часовому поясу каждого филиала,
        валюты не пересчитываются, начисления не равны прибыли.
      </p>
    </section>
  );
}

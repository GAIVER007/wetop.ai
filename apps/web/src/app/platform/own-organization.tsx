import '../branches/branches.css';
import './organizations.css';
import { randomUUID } from 'node:crypto';
import { unstable_rethrow } from 'next/navigation';
import { isIsoDate, todayAt } from '@pms/domain';
import { Badge, Fact, Grid, Panel, Stat, Stats, Input } from '../../components/ui';
import { branchesApi, type BranchItem } from '../../lib/api';
import { summarizeBranches } from '../../lib/branch-summary';
import { formatMoney } from '../../lib/money';
import type { WebVertical } from '../../lib/vertical-landing';
import { selectBranch } from '../branches/actions';
import { BranchForm } from '../branches/form';
import { msg, type Translate } from '../../i18n';
import { serverT } from '../../i18n/server';

type BranchList = Awaited<ReturnType<typeof branchesApi.list>>;
type Query = Record<string, string | string[] | undefined>;

const KIND: Record<WebVertical, string> = {
  HOSPITALITY: msg('Гостиница'),
  BEAUTY: msg('Салон'),
  FOOD_SERVICE: msg('Ресторан'),
};

function fundLine(item: BranchItem, t: Translate): string {
  // у салона и ресторана номеров и коек нет вовсе (DATA_MODEL §19): состав фонда им не показывается
  if (item.vertical === 'FOOD_SERVICE') return t('Залы, столы и бронирования');
  if (item.vertical === 'BEAUTY') return t('Клиенты, услуги и мастера');
  return t('{units} номеров и коек, {types} категорий', {
    units: item._count.inventoryUnits,
    types: item._count.accommodationTypes,
  });
}

function openLabel(item: BranchItem, t: Translate): string {
  if (item.vertical === 'FOOD_SERVICE') return t('Открыть ресторан');
  if (item.vertical === 'BEAUTY') return t('Открыть салон');
  return item._count.inventoryUnits ? t('Открыть филиал') : t('Настроить номера');
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
  const t = await serverT();

  return (
    <section className="org-own" aria-labelledby="own-organization-title">
      <div className="org-own__head">
        <div>
          <h2 id="own-organization-title" className="org-own__title">
            {organization.name}
          </h2>
          <p className="org-note">
            {t('Ваша организация, филиалов: {n}', { n: items.length })}
          </p>
        </div>
        <form className="org-period">
          {selected && <input type="hidden" name="org" value={selected} />}
          <label>
            {t('С даты')}
            <Input type="date" name="from" defaultValue={from} required />
          </label>
          <label>
            {t('По дату')}
            <Input type="date" name="to" defaultValue={to} required min={from} />
          </label>
          <button className="btn" type="submit">
            {t('Показать')}
          </button>
        </form>
      </div>

      {canCreate && (
        <details className="org-add">
          <summary className="btn">{t('Добавить филиал')}</summary>
          <BranchForm id={randomUUID()} />
        </details>
      )}

      {overview === null && (
        <p role="status" className="org-note">
          {t('Показатели за период не загрузились. Обновите страницу.')}
        </p>
      )}

      {totals && (
        <Stats min={170} aria-label={t('Итоги по филиалам')}>
          <Stat
            label={t('Загрузка')}
            value={`${totals.percent}%`}
            hint={t('гостиничных филиалов: {n}', { n: overview?.rows.length ?? 0 })}
          />
          <Stat label={t('Гости в заездах')} value={totals.guests} />
          {[...totals.currencies].flatMap(([currency, total]) => [
            <Stat
              key={`${currency}-revenue`}
              label={t('Начислено, {currency}', { currency })}
              value={formatMoney(total.revenue, currency)}
            />,
            <Stat
              key={`${currency}-paid`}
              label={t('Поступило, {currency}', { currency })}
              value={formatMoney(total.paid, currency)}
              hint={t('возвраты {sum}', { sum: formatMoney(total.refunded, currency) })}
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
                <Badge>{t(KIND[item.vertical])}</Badge>
              </div>
              <p>{item.address || t('Адрес не указан')}</p>
              <p className="org-note">{fundLine(item, t)}</p>
              {stats && (
                <Grid min={110} gap="sm" className="org-branch__stats">
                  <Fact label={t('Загрузка')} value={`${stats.occupancy.percent}%`} />
                  <Fact label={t('Гости в заездах')} value={stats.arrivals.guests} />
                  <Fact
                    label={t('Начислено')}
                    value={formatMoney(stats.revenue.totalMinor, item.currency)}
                  />
                  <Fact
                    label={t('Поступило')}
                    value={formatMoney(stats.payments.totalMinor, item.currency)}
                  />
                </Grid>
              )}
              <form action={selectBranch} className="org-branch__action">
                <input type="hidden" name="id" value={item.id} />
                <button className="btn" type="submit">
                  {openLabel(item, t)}
                </button>
              </form>
            </Panel>
          );
        })}
      </div>

      <p className="org-note">
        {t(
          'Показатели есть у гостиничных филиалов. Даты считаются по часовому поясу каждого филиала, валюты не пересчитываются, начисления не равны прибыли.',
        )}
      </p>
    </section>
  );
}

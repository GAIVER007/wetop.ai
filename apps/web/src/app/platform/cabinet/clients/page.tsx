import Link from 'next/link';
import { Suspense } from 'react';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { Badge, EmptyState, Input, LoadingState, Panel, Select, Table } from '../../../../components/ui';
import { ApiError, platformApi, type PlatformCabinet, type PlatformGrowth } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { formatInt } from '../../../../lib/dashboard-format';
import { currentLocale, serverT } from '../../../../i18n/server';
import type { Translate } from '../../../../i18n';
import { unstable_rethrow } from 'next/navigation';
import { KpiStrip } from '../kpi-strip';
import { CabinetShell, usd } from '../shell';
import { ClientStatus } from '../growth-parts';
import { countryName, flag } from '../country';
import { PLATFORM_VERTICAL_LABEL } from '../../../../lib/platform';


type Filter = 'all' | 'risk' | 'trial' | 'paying' | 'unpaid' | 'left';
const FILTERS: Filter[] = ['all', 'risk', 'trial', 'paying', 'unpaid', 'left'];
const FILTER_STATUS: Record<Exclude<Filter, 'all' | 'risk'>, PlatformGrowth['clients'][number]['status']> = {
  trial: 'TRIAL',
  paying: 'ACTIVE',
  unpaid: 'READ_ONLY',
  left: 'SUSPENDED',
};

/**
 * Клиенты WETOP (владелец 29.10.2026, вариант «Б» вкладкой): строка на клиента: статус, «оплачено до», LTV, сколько
 * с нами, вход и работа за 30 дней. Вариант C (30.10.2026): «под риском» (пробный, работал меньше 3 дней из 7), дни работы
 * за 7 дней, партнёр под именем, сверху те, с кем говорить сейчас. Имя клиента ведёт к карточке организации («Доступ») (там пробный, оплата, расширения).
 */
export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await serverT();
  const q = await searchParams;
  const filter = (FILTERS as string[]).includes(String(q['show'])) ? (q['show'] as Filter) : 'all';
  const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v.trim().slice(0, 100) : '');
  const country = /^[A-Z]{2}$|^none$/.test(one(q['country'])) ? one(q['country']) : '';
  const vertical = one(q['vertical']) in PLATFORM_VERTICAL_LABEL ? one(q['vertical']) : '';
  return (
    <Page width="full" title={t('Клиенты WETOP')}>
      <Suspense fallback={<LoadingState label={t('Считаем клиентов…')} />}>
        <Clients filter={filter} country={country} vertical={vertical} search={one(q['q'])} />
      </Suspense>
    </Page>
  );
}

async function Clients({ filter, country, vertical, search }: { filter: Filter; country: string; vertical: string; search: string }) {
  const t = await serverT();
  const locale = await currentLocale();
  let view: PlatformCabinet;
  let growth: PlatformGrowth;
  try {
    [view, growth] = await Promise.all([platformApi.cabinet(), platformApi.growth(new Date().toISOString().slice(0, 7))]);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 403)
      return <EmptyState title={t('Кабинет компании видит только главный администратор.')} data-testid="cabinet-forbidden" />;
    return <LoadError testId="cabinet-error" {...loadErrorProps(error)} />;
  }
  const work = new Map(view.clients.map((c) => [c.id, c]));
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);
  const dayPlus = (n: number) => new Date(now + n * 86_400_000).toISOString().slice(0, 10);
  const idleDays = (iso: string | null) => (iso ? Math.floor((now - new Date(iso).getTime()) / 86_400_000) : 999);
  // фильтры страны, направления и поиск (владелец 30.10.2026: «страны добавь в раздел клиенты»)
  const needle = search.toLocaleLowerCase();
  const picked = growth.clients.filter(
    (c) =>
      (!country || (country === 'none' ? !c.country : c.country === country)) &&
      (!vertical || (work.get(c.id)?.verticals ?? []).includes(vertical as never)) &&
      (!needle || c.name.toLocaleLowerCase().includes(needle) || (work.get(c.id)?.owner ?? '').toLocaleLowerCase().includes(needle)),
  );
  const shown = (f: Filter) =>
    picked.filter((c) =>
      f === 'all' ? c.status !== 'SUSPENDED' : f === 'risk' ? c.atRisk === true : c.status === FILTER_STATUS[f],
    );
  const countries = [...new Set(growth.clients.map((c) => c.country ?? 'none'))].sort();
  const verticals = [...new Set(view.clients.flatMap((c) => c.verticals))];
  const keep = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ show: filter === 'all' ? '' : filter, country, vertical, q: search, ...extra })) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/platform/cabinet/clients?${qs}` : '/platform/cabinet/clients';
  };
  // плашки «с кем говорить» (вариант C): по всем клиентам, без фильтров
  const all = growth.clients;
  const in14 = (d: string | null) => d !== null && d >= today && d <= dayPlus(14);
  const tasks = {
    ending: all.filter((c) => c.status === 'TRIAL' && (c.trialDaysLeft ?? 99) <= 7).length,
    risk: all.filter((c) => c.atRisk === true).length,
    idle: all.filter((c) => c.status !== 'SUSPENDED' && idleDays(work.get(c.id)?.lastLoginAt ?? null) > 7).length,
    payment: all.filter((c) => c.status === 'ACTIVE' && in14(c.paidUntil)).length,
  };
  // «Клиенты» C (владелец 30.10.2026): сверху те, с кем надо говорить сейчас: под риском и пробный кончается за 3 дня
  const urgent = (c: PlatformGrowth['clients'][number]) =>
    c.atRisk ? 0 : c.status === 'TRIAL' && (c.trialDaysLeft ?? 99) <= 3 ? 1 : c.status === 'READ_ONLY' ? 2 : 3;
  const rows = shown(filter)
    .map((c, i) => ({ c, i }))
    .sort((a, b) => urgent(a.c) - urgent(b.c) || a.i - b.i)
    .map((x) => x.c);
  const label: Record<Filter, string> = {
    all: t('Все'),
    risk: t('Под риском'),
    trial: t('Пробный'),
    paying: t('Платят'),
    unpaid: t('Не оплатили'),
    left: t('Ушли'),
  };
  return (
    <CabinetShell active="clients" t={t} clients={view.totals.clients}>
      {/* полоса цифр как «Сайт wetop.ai» (владелец 01.11.2026): 4 «с кем говорить», нажатие открывает список */}
      <KpiStrip
        testId="clients-strip"
        items={[
          { id: 'ending', label: t('Кончается пробный'), value: formatInt(tasks.ending), hint: t('за 7 дней'), tone: tasks.ending ? 'warning' : undefined, href: keep({ show: 'trial' }) },
          { id: 'risk', label: t('Под риском'), value: formatInt(tasks.risk), hint: t('меньше 3 дн. из 7'), tone: tasks.risk ? 'danger' : undefined, href: keep({ show: 'risk' }) },
          { id: 'idle', label: t('Долго не входили'), value: formatInt(tasks.idle), hint: t('больше 7 дней') },
          { id: 'payment', label: t('Скоро оплата'), value: formatInt(tasks.payment), hint: t('за 14 дней'), tone: tasks.payment ? 'success' : undefined, href: keep({ show: 'paying' }) },
        ]}
      />
      <Panel title={t('Клиенты')} className="cabinet__clients">
        <nav className="cabinet__filters" aria-label={t('Показать')}>
          {FILTERS.map((f) => (
            <Link
              key={f}
              href={keep({ show: f === 'all' ? '' : f })}
              aria-current={f === filter ? 'page' : undefined}
              prefetch={false}
              data-testid={`clients-filter-${f}`}
            >
              {label[f]} <span className="cabinet__count">{formatInt(shown(f).length)}</span>
            </Link>
          ))}
        </nav>
        <form className="cabinet__pick" action="/platform/cabinet/clients" data-testid="clients-pick">
          {filter !== 'all' && <input type="hidden" name="show" value={filter} />}
          <label>
            <span className="sr-only">{t('Страна')}</span>
            <Select name="country" defaultValue={country} data-testid="clients-country">
              <option value="">{t('Страна: все')}</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c === 'none' ? t('Страна не указана') : `${flag(c)} ${countryName(c, locale, t)}`}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">{t('Направление')}</span>
            <Select name="vertical" defaultValue={vertical} data-testid="clients-vertical">
              <option value="">{t('Направление: все')}</option>
              {verticals.map((v) => (
                <option key={v} value={v}>
                  {t(PLATFORM_VERTICAL_LABEL[v])}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">{t('Поиск клиента')}</span>
            <Input type="search" name="q" defaultValue={search} placeholder={t('Поиск клиента')} data-testid="clients-search" />
          </label>
          <button type="submit" className="btn btn--secondary">
            {t('Показать')}
          </button>
        </form>
        {/* отток месяца остаётся в «Клиентах» (Главная «B» без него) */}
        <p className="muted cabinet__sub" data-testid="clients-churn">
          {t('ушли за месяц: {n}, в прошлом: {p}', {
            n: formatInt(growth.churn?.count ?? 0),
            p: formatInt(growth.churn?.previous ?? 0),
          })}
        </p>
        {rows.length === 0 ? (
          <EmptyState title={t('Здесь пока никого нет.')} />
        ) : (
          <Table aria-label={t('Клиенты')} data-testid="cabinet-clients-table">
            <thead>
              <tr>
                <th>{t('Клиент')}</th>
                <th>{t('Страна')}</th>
                <th>{t('Город')}</th>
                <th>{t('Вид')}</th>
                <th>{t('Статус')}</th>
                <th title={t('Сколько дней из последних 7 работали в системе')}>{t('Работа 7 дн.')}</th>
                <th>{t('Входили')}</th>
                <th title={t('Брони и записи за 30 дней')}>{t('За 30 дней')}</th>
                <th title={t('Сколько клиент заплатил WETOP за всё время')}>{t('Принёс денег')}</th>
                <th>{t('Тариф')}</th>
                <th title={t('Оплачено до')}>{t('Платёж')}</th>
                <th>
                  <span className="sr-only">{t('Действия')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const w = work.get(c.id);
                return (
                  <tr key={c.id} data-testid="cabinet-client-row" data-risk={c.atRisk || undefined}>
                    <td>
                      <Link
                        className="cabinet__client-name"
                        href={`/platform/cabinet/clients/${c.id}`}
                        prefetch={false}
                        aria-label={t('Карточка клиента: {name}', { name: c.name })}
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td title={c.country ? countryName(c.country, locale, t) : t('Страна не указана')}>
                      {c.country ? flag(c.country) : t('нет')}
                    </td>
                    <td data-testid="client-city">{w?.city ?? ''}</td>
                    <td className="cabinet__wrap">{(w?.verticals ?? []).map((v) => t(PLATFORM_VERTICAL_LABEL[v])).join(', ') || t('нет')}</td>
                    <td className="cabinet__status-cell">
                      <ClientStatus client={c} t={t} />
                      {c.atRisk && (
                        <Badge tone="danger" data-testid="client-risk">
                          {t('под риском')}
                        </Badge>
                      )}
                    </td>
                    <td className="cabinet__num">{formatInt(c.activeDays7 ?? 0)}/7</td>
                    <td>{loginText(w?.lastLoginAt ?? null, now, t)}</td>
                    <td className="cabinet__num">{formatInt(w?.records30d ?? 0)}</td>
                    <td className="cabinet__num" data-testid="client-brought">
                      <b>{usd(c.ltvCents)}</b>
                    </td>
                    <td data-testid="client-plan">{w?.plan ?? ''}</td>
                    <td className="cabinet__num" data-testid="client-next-payment">
                      {w?.nextPaymentOn ? `${w.nextPaymentOn.slice(8, 10)}.${w.nextPaymentOn.slice(5, 7)}` : ''}
                    </td>
                    <td>
                      {w?.owner ? (
                        <a
                          className="btn btn--secondary btn--sm"
                          href={`mailto:${w.owner}?subject=${encodeURIComponent(t('WETOP: как у вас дела?'))}`}
                          aria-label={t('Написать: {name}', { name: c.name })}
                          title={w.owner}
                        >
                          {t('Написать')}
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Panel>
    </CabinetShell>
  );
}

function loginText(iso: string | null, now: number, t: Translate): string {
  if (!iso) return t('не входили');
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return t('сегодня');
  if (days === 1) return t('вчера');
  return t('{n} дн. назад', { n: formatInt(days) });
}

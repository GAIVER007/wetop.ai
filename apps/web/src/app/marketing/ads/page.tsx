import { unstable_rethrow } from 'next/navigation';
import { campaignMetrics, can } from '@pms/domain';
import {
  ApiError,
  marketingCampaignsApi,
  metaConnectionApi,
  type MarketingCampaignsView,
  type MetaConnectionView,
} from '../../../lib/api';
import { deskShell } from '../../../lib/desk-shell';
import { loadErrorProps } from '../../../lib/load-error';
import { formatMoney } from '../../../lib/money';
import { normalizeSearchParams, type SearchParams } from '../../../lib/search-params';
import { requireFeature } from '../../../lib/vertical-guard';
import { verticalCopy, type VerticalCopy } from '../../../lib/vertical-copy';
import '../marketing.css';
import '../budget/budget.css';
import { LoadError } from '../../../components/load-error';
import { Page } from '../../../components/page';
import { Tabs } from '../../../components/tabs';
import { Alert, Badge, EmptyState, Stat, Stats, Table } from '../../../components/ui';
import { BackToModules, ModuleSoon } from '../parts';
import { ChooseLocation, MonthNav, platformLabel } from '../budget/parts';
import { CampaignButton, StatsButton } from './campaigns';
import { CAMPAIGN_STATUS } from './labels';
import { cookies } from 'next/headers';
import { MetaCabinet, MetaChoose } from './meta';
import { CampaignStatusButton } from './launch/status-button';
import Link from 'next/link';
import { META_ACCOUNTS_COOKIE } from './meta-cookies';
import { AdLaunches, loadLaunches } from './launches';
import { propertyClock } from '../../../lib/property-time';
import { workspaceTimezone } from '../../../lib/workspace-context';

/**
 * Модуль «Реклама» (макет Marketing 2.0 владельца 09.10.2026, экран 2; MKT10.4–10.6). Вкладка «Кампании» живая с
 * МКТ-В3 (DATA_MODEL §53, ADR-MKT-B3): кампании филиала за месяц, расход из журнала «Бюджета», показы, клики и лиды
 * площадки вручную или CSV, CTR, CPC, CPM и CPL площадки. Кабинеты (Meta и другие) ещё не подключаются: кнопка
 * «Подключить кабинет» и прочие вкладки остаются пустыми состояниями. Право `marketing`, филиал строго из scope.
 */
const SOON = 'marketing-ads-soon';
const dash = '–';

type Loaded = { view: MarketingCampaignsView } | { chooseLocation: true } | { error: ReturnType<typeof loadErrorProps> };

async function loadCampaigns(month: string | undefined): Promise<Loaded> {
  try {
    return { view: await marketingCampaignsApi.list(month) };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ApiError && e.status === 409) return { chooseLocation: true };
    return { error: loadErrorProps(e) };
  }
}

const ctrText = (bp: number | null) => (bp === null ? dash : `${(bp / 100).toFixed(2).replace('.', ',')} %`);

function Campaigns({
  view,
  editable,
  launchable,
  today,
}: {
  view: MarketingCampaignsView;
  editable: boolean;
  /** право `ads_launch` и подключённый кабинет: «Остановить» и «Включить» у кампаний кабинета (§57) */
  launchable: boolean;
  today: string;
}) {
  const rc = view.reportingCurrency;
  const money = (v: bigint | null) => (v === null ? dash : formatMoney(v, rc));
  // у кампании из кабинета показатели считает расход кабинета (ADR-MKT-META), у ручной её расходы из журнала
  const rows = view.campaigns.map((c) => {
    const cabinet = c.fromCabinet === true && c.cabinetSpend != null;
    const spend = cabinet ? BigInt(c.cabinetSpend!) : BigInt(c.spend);
    const currency = cabinet ? (c.cabinetCurrency ?? rc) : rc;
    return {
      c,
      cabinet,
      spend,
      currency,
      m: campaignMetrics({ spendMinor: spend, impressions: c.impressions, clicks: c.clicks, leads: c.leads }),
    };
  });
  // плитки в валюте отчётности: кабинет в другой валюте в сумму не входит, его числа в таблице
  const foreign = rows.some((r) => r.currency !== rc);
  const total = rows.reduce(
    (t, r) => ({
      spend: t.spend + (r.currency === rc ? r.spend : 0n),
      impressions: t.impressions + r.c.impressions,
      clicks: t.clicks + r.c.clicks,
      leads: t.leads + r.c.leads,
    }),
    { spend: 0n, impressions: 0, clicks: 0, leads: 0 },
  );
  const tm = campaignMetrics({ spendMinor: total.spend, ...total });
  return (
    <div className="marketing-screen__stack">
      <Stats min={160} data-testid="marketing-ads-metrics">
        <Stat
          label="Расход кампаний"
          value={formatMoney(total.spend, rc)}
          hint={foreign ? 'без кабинетов в другой валюте: они в таблице' : undefined}
          testId="ads-spend"
        />
        <Stat label="Показы" value={total.impressions.toLocaleString('ru-RU')} hint={`CPM ${money(tm.cpmMinor)}`} testId="ads-impressions" />
        <Stat label="Клики" value={total.clicks.toLocaleString('ru-RU')} hint={`CTR ${ctrText(tm.ctrBp)}`} testId="ads-clicks" />
        <Stat label="Лиды площадки" value={String(total.leads)} hint={`CPL ${money(tm.cplMinor)}`} testId="ads-leads" />
      </Stats>
      <div className="budget-head">
        {editable ? <CampaignButton /> : <span />}
        <MonthNav base="/marketing/ads" month={view.month} />
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Кампаний пока нет" data-testid="ads-empty">
          Создайте кампанию, привяжите к ней расходы в «Бюджете» и вносите показы, клики и лиды из кабинета площадки
          по дням или файлом CSV.
        </EmptyState>
      ) : (
        <div className="tbl-wrap" role="region" aria-label="Кампании" tabIndex={0}>
          <Table density="normal" aria-label="Кампании месяца" data-testid="marketing-ads-campaigns">
            <thead>
              <tr>
                <th scope="col">Кампания</th>
                <th scope="col">Статус</th>
                <th scope="col" className="budget-td-num">Расход</th>
                <th scope="col" className="budget-td-num">Показы</th>
                <th scope="col" className="budget-td-num">Клики</th>
                <th scope="col" className="budget-td-num">CTR</th>
                <th scope="col" className="budget-td-num">CPC</th>
                <th scope="col" className="budget-td-num">CPM</th>
                <th scope="col" className="budget-td-num">Лиды</th>
                <th scope="col" className="budget-td-num">CPL</th>
                {(editable || launchable) && (
                  <th scope="col">
                    <span className="sr-only">Действия</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, cabinet, spend, currency, m }) => (
                <tr key={c.id} data-testid={`campaign-row-${c.id}`}>
                  <td>
                    <span className="budget-cell-main">{c.name}</span>
                    <span className="budget-cell-sub">
                      {platformLabel(c.platform)}
                      {cabinet && <Badge tone="info">Кабинет</Badge>}
                    </span>
                  </td>
                  <td>
                    <Badge tone={c.status === 'ACTIVE' ? 'ok' : undefined}>{CAMPAIGN_STATUS[c.status]}</Badge>
                  </td>
                  <td className="budget-td-num">
                    {formatMoney(spend, currency)}
                    {cabinet && <span className="budget-cell-sub">в журнале {formatMoney(c.spend, rc)}</span>}
                  </td>
                  <td className="budget-td-num">{c.impressions.toLocaleString('ru-RU')}</td>
                  <td className="budget-td-num">{c.clicks.toLocaleString('ru-RU')}</td>
                  <td className="budget-td-num">{ctrText(m.ctrBp)}</td>
                  <td className="budget-td-num">{m.cpcMinor === null ? dash : formatMoney(m.cpcMinor, currency)}</td>
                  <td className="budget-td-num">{m.cpmMinor === null ? dash : formatMoney(m.cpmMinor, currency)}</td>
                  <td className="budget-td-num">{c.leads}</td>
                  <td className="budget-td-num">{m.cplMinor === null ? dash : formatMoney(m.cplMinor, currency)}</td>
                  {(editable || launchable) && (
                    <td>
                      {c.fromCabinet ? (
                        launchable && c.status !== 'FINISHED' ? (
                          <CampaignStatusButton campaignId={c.id} name={c.name} active={c.status === 'ACTIVE'} />
                        ) : (
                          <span className="budget-cell-sub">обновляет кабинет</span>
                        )
                      ) : editable && (
                        <>
                          <StatsButton campaign={c} today={today} />
                          <CampaignButton campaign={c} />
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
      <p className="settings-note" data-testid="ads-note">
        Расход ручной кампании это её расходы из «Бюджета» за месяц; у кампании из кабинета расход по кабинету, а «в
        журнале» показывает привязанные списания. Лиды площадки это заявки по данным площадки, а не наши обращения из
        «Аналитики маркетинга».
      </p>
    </div>
  );
}

const empty = (text: string) => <EmptyState title="Пока пусто">{text}</EmptyState>;

export default async function MarketingAdsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const me = await requireFeature('/marketing/ads');
  const copy: VerticalCopy = verticalCopy(me.context?.vertical);
  const q = normalizeSearchParams(await searchParams);
  const month = /^\d{4}-\d{2}$/.test(q['month'] ?? '') ? q['month'] : undefined;
  const [loaded, shell, cabinet, launches, timezone] = await Promise.all([
    loadCampaigns(month),
    deskShell(),
    // не загрузилось: плашки кабинета нет, кампании от этого не зависят
    metaConnectionApi.view().catch((): MetaConnectionView | null => null),
    // запуски читаются независимо от кабинета и кампаний: отказ этого источника не ломает остальной экран
    loadLaunches(),
    workspaceTimezone(),
  ]);
  const metaResult = q['meta'];
  // выбор из нескольких кабинетов: список из закрытой cookie адреса возврата (заготовка входа живёт 10 минут)
  let choices: Array<{ adAccountId: string; name: string; currency: string }> = [];
  if (metaResult === 'choose') {
    try {
      choices = JSON.parse((await cookies()).get(META_ACCOUNTS_COOKIE)?.value ?? '[]') as typeof choices;
    } catch {
      choices = [];
    }
  }
  const role = shell.access.role;
  const editable = !shell.readOnly && (role === null || can(role, 'marketing'));
  // запуск и остановка тратят деньги: своё право (§57) и подключённый кабинет
  const launchable =
    !shell.readOnly && (role === null || can(role, 'ads_launch')) && cabinet?.connection?.status === 'ACTIVE';
  const campaigns =
    'view' in loaded ? (
      <Campaigns view={loaded.view} editable={editable} launchable={launchable} today={loaded.view.today} />
    ) : 'chooseLocation' in loaded ? (
      <ChooseLocation />
    ) : (
      <LoadError testId="ads-error" {...loaded.error} />
    );
  return (
    <Page
      crumbs={<BackToModules />}
      title="ИИ-таргетолог"
      subtitle="Кампании, кабинет Meta, запуск с ИИ и статистика площадок."
      actions={
        launchable ? (
          <Link className="btn" href="/marketing/ads/launch" data-testid="ad-new">
            Новая кампания с ИИ
          </Link>
        ) : undefined
      }
    >
      <div className="marketing-screen" data-testid="marketing-ads-screen">
        <ModuleSoon id={SOON} testId={SOON}>
          Кампания с ИИ запускается кнопкой в мастере после вашей проверки текста, аудитории и бюджета; остановить её
          можно здесь же. Аудитории и библиотека креативов в следующих этапах, другие площадки ведутся вручную.
        </ModuleSoon>
        {metaResult === 'connected' && (
          <Alert tone="success" data-testid="meta-result">
            Кабинет Meta подключён: кампании и дни за последние 28 дней загружены.
          </Alert>
        )}
        {metaResult === 'failed' && (
          <Alert boxed data-testid="meta-result">
            Кабинет не подключён: {q['reason'] ?? 'попробуйте ещё раз'}
          </Alert>
        )}
        {metaResult === 'cancelled' && (
          <p className="settings-note" data-testid="meta-result">
            Вход в Facebook отменён: кабинет не подключён.
          </p>
        )}
        {metaResult === 'choose' && editable && choices.length > 0 && <MetaChoose accounts={choices} />}
        {metaResult === 'choose' && choices.length === 0 && (
          <p className="settings-note" data-testid="meta-result">
            Выбор кабинета устарел: подключите заново.
          </p>
        )}
        {cabinet && !(metaResult === 'choose' && choices.length > 0) && <MetaCabinet view={cabinet} editable={editable} />}
        <AdLaunches loaded={launches} clock={propertyClock(timezone)} />
        <Tabs
          label="Разделы рекламы"
          panels={[
            { id: 'campaigns', label: 'Кампании', content: campaigns },
            { id: 'audiences', label: 'Аудитории', content: empty(`Аудитории ИИ соберёт из ${copy.clientsOf} и посетителей сайта.`) },
            { id: 'creatives', label: 'Креативы', content: empty('Картинки и тексты объявлений придут из модуля «Контент».') },
            { id: 'analytics', label: 'Аналитика', content: empty(`Расходы, заявки и ${copy.conversionTo === 'в бронь' ? 'брони' : copy.conversionTo === 'в запись' ? 'записи' : 'заказы'} по кампаниям появятся после первых запусков.`) },
            { id: 'settings', label: 'Настройки', content: empty('Рекламный кабинет, лимиты бюджета и уведомления.') },
          ]}
        />
      </div>
    </Page>
  );
}

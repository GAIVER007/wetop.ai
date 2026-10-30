import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { RefreshButton } from '../../../../components/refresh-button';
import { EmptyState, LoadingState, Panel, Stat, Stats, Table } from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import { ApiError, platformApi, type PlatformSite } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { formatInt } from '../../../../lib/dashboard-format';
import { serverT } from '../../../../i18n/server';
import type { Translate } from '../../../../i18n';
import { CabinetShell } from '../shell';
import { MonthPicker } from '../money/month-picker';
import { percentText } from '../growth-parts';
import { countryName, flag } from '../country';
import { currentLocale } from '../../../../i18n/server';

/**
 * «Сайт wetop.ai» в кабинете руководителя (владелец 29.10.2026): посетители месяца по дням, путь к регистрации
 * (окно регистрации, форма отправлена, почта подтверждена), откуда пришли и какие страницы смотрят. Счёт
 * счётчика WETOP на главной, без cookies и персональных данных. Месяц стрелками, как в «Деньгах».
 */
export default async function SitePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await serverT();
  const q = await searchParams;
  const raw = typeof q['month'] === 'string' ? q['month'] : '';
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw) ? raw : new Date().toISOString().slice(0, 7);
  return (
    <Page width="full" title={t('Сайт wetop.ai')} actions={<RefreshButton />}>
      <Suspense fallback={<LoadingState label={t('Считаем посетителей…')} />}>
        <Site month={month} />
      </Suspense>
    </Page>
  );
}

function sourceName(s: NonNullable<PlatformSite['report']>['sources'][number], t: Translate): string {
  if (s.kind === 'DIRECT') return t('Напрямую');
  const name = s.source ?? t('другой сайт');
  if (s.kind === 'PAID') return t('{name}, реклама', { name });
  return name;
}

async function Site({ month }: { month: string }) {
  const t = await serverT();
  const locale = await currentLocale();
  let view: PlatformSite;
  try {
    view = await platformApi.site(month);
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 403)
      return (
        <EmptyState icon={<Icon name="shield" width={32} height={32} />} title={t('Раздел главного администратора платформы')} data-testid="cabinet-forbidden">
          {t('Кабинет компании видит только главный администратор.')}
        </EmptyState>
      );
    return <LoadError testId="cabinet-error" {...loadErrorProps(error)} />;
  }
  const r = view.report;
  const head = (
    <div className="cabinet__head">
      <MonthPicker month={month} locale={locale} base="/platform/cabinet/site" />
    </div>
  );
  if (!r)
    return (
      <CabinetShell active="site" t={t}>
        {head}
        <EmptyState title={t('Счётчик на wetop.ai не подключён.')} data-testid="site-no-counter" />
      </CabinetShell>
    );
  const p = r.path;
  const steps = [
    { key: 'visitors', label: t('Зашли на сайт'), value: p.visitors },
    { key: 'open', label: t('Открыли регистрацию'), value: p.signupOpen },
    { key: 'sent', label: t('Отправили форму'), value: p.signupSent },
    { key: 'done', label: t('Подтвердили почту'), value: p.signupDone },
  ];
  const top = Math.max(p.visitors, 1);
  const maxDay = r.daily.reduce((n, d) => Math.max(n, d.visitors), 0);
  return (
    <CabinetShell active="site" t={t}>
      {head}
      <Stats min={180}>
        <Stat label={t('Посетители')} value={formatInt(r.visitors)} hint={t('визитов {n}', { n: formatInt(r.sessions) })} icon={<Icon name="guests" />} tone="success" testId="site-visitors" />
        <Stat label={t('Открыли регистрацию')} value={formatInt(p.signupOpen)} hint={percentText(r.visitors ? Math.floor((p.signupOpen * 1000) / r.visitors) : null)} icon={<Icon name="booking" />} testId="site-signup-open" />
        <Stat label={t('Зарегистрировались')} value={formatInt(p.signupDone)} hint={t('почта подтверждена')} icon={<Icon name="person" />} testId="site-signup-done" />
        <Stat label={t('С телефона')} value={percentText(r.mobileShare) || '0%'} hint={t('входили в стойку: {n}', { n: formatInt(p.loginOpen) })} icon={<Icon name="chart" />} testId="site-mobile" />
      </Stats>

      <Panel title={t('Путь посетителя за месяц')}>
        <ol className="cabinet__funnel cabinet__funnel--flow cabinet__funnel--four" data-testid="site-path">
          {steps.map((s, i) => (
            <li key={s.key} className="cabinet__step" data-testid={`site-path-${s.key}`}>
              <span>{s.label}</span>
              <b className="cabinet__step-value">{formatInt(s.value)}</b>
              {i > 0 && steps[i - 1]!.value > 0 && (
                <span className="cabinet__conv" title={t('переход с прошлого шага')}>
                  {percentText(Math.floor((s.value * 1000) / steps[i - 1]!.value))}
                </span>
              )}
              <span className="cabinet__meter" aria-hidden="true">
                <span style={{ inlineSize: `${Math.round((s.value * 100) / top)}%` }} /* slop-allow: inline-style ширина полосы из доли шага */ />
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title={t('Посетители по дням')}>
        <ol className="cabinet__bars cabinet__bars--days" aria-label={t('Посетители по дням')} data-testid="site-daily">
          {r.daily.map((d) => (
            <li key={d.date} title={`${d.date}: ${formatInt(d.visitors)}`} data-busy={d.visitors > 0 || undefined}>
              <span className="cabinet__bar-value">{d.visitors ? formatInt(d.visitors) : ''}</span>
              <span className="cabinet__bar" style={{ blockSize: `${maxDay ? Math.max(Math.round((d.visitors * 100) / maxDay), 2) : 2}%` }} /* slop-allow: inline-style высота столбика из доли дня */ />
              <span className="cabinet__bar-label">{Number(d.date.slice(8))}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title={t('Страны посетителей')}>
        <Table aria-label={t('Страны посетителей')} data-testid="site-countries">
          <thead>
            <tr>
              <th>{t('Страна')}</th>
              <th className="num">{t('Посетители')}</th>
              <th className="num">{t('Зарегистрировались')}</th>
            </tr>
          </thead>
          <tbody>
            {r.countries.slice(0, 8).map((c) => (
              <tr key={c.country ?? 'none'}>
                <td>
                  {c.country && <span aria-hidden="true">{flag(c.country)} </span>}
                  {c.country ? countryName(c.country, locale, t) : t('Не определена')}
                </td>
                <td className="num">{formatInt(c.visitors)}</td>
                <td className="num">{formatInt(c.signupDone)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>

      <div className="cabinet__pair">
        <Panel title={t('Откуда пришли')}>
          {r.sources.length === 0 ? (
            <EmptyState title={t('Посетителей пока нет.')} />
          ) : (
            <Table aria-label={t('Откуда пришли')} data-testid="site-sources">
              <thead>
                <tr>
                  <th>{t('Источник')}</th>
                  <th className="num">{t('Посетители')}</th>
                </tr>
              </thead>
              <tbody>
                {r.sources.map((s) => (
                  <tr key={`${s.kind}:${s.source ?? ''}`}>
                    <td>{sourceName(s, t)}</td>
                    <td className="num">
                      {formatInt(s.visitors)}
                      <small className="muted cabinet__sub">{percentText(s.share) || '0%'}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
        <Panel title={t('Страницы')}>
          {r.pages.length === 0 ? (
            <EmptyState title={t('Просмотров пока нет.')} />
          ) : (
            <Table aria-label={t('Страницы')} data-testid="site-pages">
              <thead>
                <tr>
                  <th>{t('Адрес')}</th>
                  <th className="num">{t('Просмотры')}</th>
                </tr>
              </thead>
              <tbody>
                {r.pages.map((pg) => (
                  <tr key={pg.path}>
                    <td>{pg.path}</td>
                    <td className="num">
                      {formatInt(pg.views)}
                      <small className="muted cabinet__sub">{percentText(pg.share) || '0%'}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Panel>
      </div>
    </CabinetShell>
  );
}

import Link from 'next/link';
import { Suspense } from 'react';
import { unstable_rethrow } from 'next/navigation';
import { Page } from '../../../../components/page';
import { LoadError } from '../../../../components/load-error';
import { RefreshButton } from '../../../../components/refresh-button';
import { EmptyState, LoadingState, Panel, Table } from '../../../../components/ui';
import { Icon } from '../../../../components/icon';
import { ApiError, platformApi, type PlatformSite } from '../../../../lib/api';
import { loadErrorProps } from '../../../../lib/load-error';
import { formatInt } from '../../../../lib/dashboard-format';
import { serverT } from '../../../../i18n/server';
import type { Translate } from '../../../../i18n';
import { CabinetShell } from '../shell';
import { KpiStrip } from '../kpi-strip';
import { MonthPicker } from '../money/month-picker';
import { percentText } from '../growth-parts';
import { countryName, flag } from '../country';
import { currentLocale } from '../../../../i18n/server';

/**
 * Вид «Б» (владелец 01.11.2026): полоса цифр и таблица по дням, сегодня сверху, итог месяца внизу.
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
  const busyOnly = q['days'] === 'busy';
  return (
    <Page width="full" title={t('Сайт wetop.ai')} actions={<RefreshButton />}>
      <Suspense fallback={<LoadingState label={t('Считаем посетителей…')} />}>
        <Site month={month} busyOnly={busyOnly} />
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

/** Число ячейкой: ноль бледным, чтобы глаз цеплялся за дни с событиями */
function Num({ v }: { v: number }) {
  return <td className={v ? 'num' : 'num cabinet__zero'}>{formatInt(v)}</td>;
}

async function Site({ month, busyOnly }: { month: string; busyOnly: boolean }) {
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
  const conv = (part: number, whole: number) => (whole ? percentText(Math.floor((part * 1000) / whole)) : '');
  const today = new Date().toISOString().slice(0, 10);
  // вариант Б (владелец 01.11.2026): сегодня первой строкой, будущих дней нет; «Только с посетителями» прячет пустые
  const days = r.daily.filter((d) => (d.date <= today || d.visitors > 0) && (!busyOnly || d.visitors > 0)).reverse();
  const base = `/platform/cabinet/site?month=${month}`;
  const sum = (k: 'sessions' | 'signupOpen' | 'signupSent' | 'signupDone') => r.daily.reduce((n, d) => n + (d[k] ?? 0), 0);
  const sourcesTotal = r.sources.slice(0, 2).map((x) => `${sourceName(x, t)} ${formatInt(x.visitors)}`).join(', ');
  return (
    <CabinetShell active="site" t={t}>
      {head}
      <KpiStrip
        testId="site-strip"
        items={[
          { id: 'visitors', label: t('Посетители'), value: formatInt(r.visitors), hint: t('визитов {n}', { n: formatInt(r.sessions) }) },
          { id: 'path-open', label: t('Открыли регистрацию'), value: formatInt(p.signupOpen), hint: conv(p.signupOpen, p.visitors) },
          { id: 'path-sent', label: t('Отправили форму'), value: formatInt(p.signupSent), hint: conv(p.signupSent, p.signupOpen) },
          { id: 'path-done', label: t('Новые клиенты'), value: formatInt(p.signupDone), hint: p.visitors ? t('{p} от посетителей', { p: conv(p.signupDone, p.visitors) }) : undefined, tone: 'success' },
          { id: 'mobile', label: t('С телефона'), value: percentText(r.mobileShare) || '0%' },
        ]}
      />

      <Panel data-testid="site-days">
        <div className="cabinet__panel-head">
          <b className="panel__title">{t('По дням')}</b>
          <nav className="glass-tabs" aria-label={t('Какие дни показать')}>
            <Link href={base} aria-current={busyOnly ? undefined : 'page'} prefetch={false} data-testid="site-days-all">
              {t('Все дни')}
            </Link>
            <Link href={`${base}&days=busy`} aria-current={busyOnly ? 'page' : undefined} prefetch={false} data-testid="site-days-busy">
              {t('Только с посетителями')}
            </Link>
          </nav>
        </div>
        <Table aria-label={t('Посетители по дням')} data-testid="site-daily" className="cabinet__days">
          <thead>
            <tr>
              <th>{t('День')}</th>
              <th className="num">{t('Посетители')}</th>
              <th className="num">{t('Визиты')}</th>
              <th className="num">{t('Открыли регистрацию')}</th>
              <th className="num">{t('Отправили форму')}</th>
              <th className="num">{t('Подтвердили')}</th>
              <th>{t('Откуда')}</th>
            </tr>
          </thead>
          <tbody>
            {days.map((d) => (
              <tr key={d.date} data-testid="site-day" data-today={d.date === today || undefined}>
                <td>
                  {`${d.date.slice(8, 10)}.${d.date.slice(5, 7)}`}
                  {d.date === today && <span className="cabinet__sub muted">{t('сегодня')}</span>}
                </td>
                <Num v={d.visitors} />
                <Num v={d.sessions ?? 0} />
                <Num v={d.signupOpen ?? 0} />
                <Num v={d.signupSent ?? 0} />
                <Num v={d.signupDone ?? 0} />
                <td className={(d.sources ?? []).length ? undefined : 'cabinet__zero'}>
                  {(d.sources ?? []).length ? (d.sources ?? []).slice(0, 2).map((x) => (x === 'DIRECT' ? t('Напрямую') : x === 'OTHER' ? t('другой сайт') : x)).join(', ') : t('нет')}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr data-testid="site-total">
              <th>{t('Итого за месяц')}</th>
              <td className="num">{formatInt(r.visitors)}</td>
              <td className="num">{formatInt(sum('sessions') || r.sessions)}</td>
              <td className="num">{formatInt(sum('signupOpen'))}</td>
              <td className="num">{formatInt(sum('signupSent'))}</td>
              <td className="num">{formatInt(sum('signupDone'))}</td>
              <td>{sourcesTotal}</td>
            </tr>
          </tfoot>
        </Table>
      </Panel>

      <div className="cabinet__trio">
      <Panel title={t('Страны посетителей')}>
        <Table aria-label={t('Страны посетителей')} data-testid="site-countries">
          <thead>
            <tr>
              <th>{t('Страна')}</th>
              <th className="num">{t('Люди')}</th>
              <th className="num">{t('Клиенты')}</th>
            </tr>
          </thead>
          <tbody>
            {r.countries.slice(0, 6).map((c) => (
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

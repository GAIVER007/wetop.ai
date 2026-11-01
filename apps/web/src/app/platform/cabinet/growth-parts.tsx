import type { CSSProperties } from 'react';
import { Badge } from '../../../components/ui';
import { formatInt } from '../../../lib/dashboard-format';
import type { PlatformGrowth } from '../../../lib/api';
import type { Translate } from '../../../i18n';
import { usd } from './shell';

/**
 * Кабинет руководителя (владелец 29.10.2026, вариант «А»): путь клиента месяца с конверсиями и доход по месяцам.
 * Проценты приходят целыми десятыми (`500` это 50,0%); деньги центами строкой.
 */
export function percentText(tenths: number | null): string {
  if (tenths === null) return '';
  const whole = Math.floor(tenths / 10);
  const rest = tenths % 10;
  return `${formatInt(whole)}${rest ? `,${rest}` : ''}%`;
}

export function GrowthFunnel({ growth, t }: { growth: PlatformGrowth; t: Translate }) {
  const f = growth.funnel;
  const top = Math.max(f.visitors ?? 0, f.registrations, f.trials, f.firstPayments, f.renewals, 1);
  const steps: Array<{ key: string; label: string; value: number | null; conv: number | null; hint?: string | undefined }> = [
    { key: 'visitors', label: t('Посетители wetop.ai'), value: f.visitors, conv: null, hint: f.visitors === null ? t('счётчик не подключён') : undefined },
    { key: 'registrations', label: t('Регистрации'), value: f.registrations, conv: f.conversion.visitorToRegistration },
    { key: 'trials', label: t('Начали пробный'), value: f.trials, conv: f.conversion.registrationToTrial },
    { key: 'paid', label: t('Первая оплата'), value: f.firstPayments, conv: f.conversion.trialToPaid },
    { key: 'renewals', label: t('Продлили'), value: f.renewals, conv: f.conversion.renewal },
  ];
  return (
    <ol className="cabinet__funnel cabinet__funnel--flow" data-testid="growth-funnel">
      {steps.map((s) => (
        <li key={s.key} className="cabinet__step" data-testid={`growth-${s.key}`}>
          <span>{s.label}</span>
          <b className="cabinet__step-value">{s.value === null ? '—' : formatInt(s.value)}</b>
          {s.conv !== null && (
            <span className="cabinet__conv" title={t('переход с прошлого шага')}>
              {percentText(s.conv)}
            </span>
          )}
          {s.hint && <span className="muted cabinet__sub">{s.hint}</span>}
          <span className="cabinet__meter" aria-hidden="true">
            <span style={{ inlineSize: `${Math.round(((s.value ?? 0) * 100) / top)}%` }} /* slop-allow: inline-style ширина полосы из доли шага */ />
          </span>
        </li>
      ))}
    </ol>
  );
}

export function IncomeChart({ growth, t, monthName }: { growth: PlatformGrowth; t: Translate; monthName: (m: string) => string }) {
  const max = growth.income.reduce((n, m) => (BigInt(m.cents) > n ? BigInt(m.cents) : n), 0n);
  return (
    <ol className="cabinet__bars" aria-label={t('Доход по месяцам')} data-testid="growth-income">
      {growth.income.map((m) => {
        const share = max > 0n ? Number((BigInt(m.cents) * 100n) / max) : 0;
        return (
          <li key={m.month} data-current={m.month === growth.month || undefined}>
            <span className="cabinet__bar-value">{usd(m.cents)}</span>
            <span className="cabinet__bar" style={{ blockSize: `${Math.max(share, 2)}%` }} /* slop-allow: inline-style высота столбика из доли дохода */ />
            <span className="cabinet__bar-label">{monthName(m.month)}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ClientStatus({ client, t }: { client: PlatformGrowth['clients'][number]; t: Translate }) {
  if (client.status === 'ACTIVE') return <Badge tone="ok">{t('платит')}</Badge>;
  if (client.status === 'READ_ONLY') return <Badge tone="danger">{t('только чтение')}</Badge>;
  if (client.status === 'SUSPENDED') return <Badge tone="neutral">{t('приостановлен')}</Badge>;
  return (
    <Badge tone="warn">
      {client.trialDaysLeft === 0
        ? t('пробный закончился')
        : t('пробный, {n} дн.', { n: formatInt(client.trialDaysLeft ?? 0) })}
    </Badge>
  );
}

/** Сколько клиент с нами: «6 дн.» до месяца, дальше «4 мес.» */
export function withUsText(days: number, t: Translate): string {
  if (days < 30) return t('{n} дн.', { n: formatInt(days) });
  return t('{n} мес.', { n: formatInt(Math.floor(days / 30)) });
}

/** Десятые доли дня «31» в «3,1» */
export function tenthsText(tenths: number | null): string {
  if (tenths === null) return '';
  const rest = tenths % 10;
  return `${formatInt(Math.floor(tenths / 10))}${rest ? `,${rest}` : ''}`;
}

/**
 * Воронка продаж конусом (главная «B», владелец 30.10.2026): шесть шагов от посетителей сайта до продления; полоса
 * сужается по шагу, справа переход с прошлого шага и доля от входа. Шаги 1 до 4 синие, оплаты зелёные.
 */
export function SalesFunnel({ growth, t }: { growth: PlatformGrowth; t: Translate }) {
  const f = growth.funnel;
  const steps: Array<{ key: string; label: string; value: number | null; conv: number | null; tone: 'lead' | 'paid' }> = [
    { key: 'visitors', label: t('Посетили сайт'), value: f.visitors, conv: null, tone: 'lead' },
    { key: 'registrations', label: t('Оставили заявку'), value: f.registrations, conv: f.conversion.visitorToRegistration, tone: 'lead' },
    { key: 'trials', label: t('Подключили пробный'), value: f.trials, conv: f.conversion.registrationToTrial, tone: 'lead' },
    { key: 'active', label: t('Активны на пробном'), value: f.activeTrials ?? null, conv: f.conversion.trialToActive ?? null, tone: 'paid' },
    { key: 'paid', label: t('Оплатили'), value: f.firstPayments, conv: f.conversion.trialToPaid, tone: 'paid' },
    { key: 'renewals', label: t('Продлили'), value: f.renewals, conv: f.conversion.renewal, tone: 'paid' },
  ];
  const entry = f.visitors ?? f.registrations;
  return (
    <ol className="cabinet-cone" data-testid="growth-funnel">
      {steps.map((s, i) => {
        const fromEntry = s.value !== null && entry > 0 ? Math.floor((s.value * 1000) / entry) : null;
        return (
          <li key={s.key} className="cabinet-cone__row" data-testid={`growth-${s.key}`}>
            <span
              className="cabinet-cone__bar"
              data-tone={s.tone}
              style={{ '--cone-width': `${100 - i * 5}%` } as CSSProperties} /* slop-allow: inline-style ширина ступени конуса по номеру шага */
            >
              <span className="cabinet-cone__label">
                {formatInt(i + 1)}. {s.label}
              </span>
              <b className="cabinet-cone__value">{s.value === null ? '—' : formatInt(s.value)}</b>
            </span>
            <span className="cabinet-cone__conv">
              {i === 0 ? (
                <span className="cabinet__conv cabinet__conv--start">{t('старт')}</span>
              ) : (
                s.conv !== null && <span className="cabinet__conv">{percentText(s.conv)}</span>
              )}
              {i > 0 && fromEntry !== null && (
                <span className="cabinet__sub muted">{t('{p} от входа', { p: percentText(fromEntry) })}</span>
              )}
              {i === 0 && s.value === null && <span className="cabinet__sub muted">{t('счётчик не подключён')}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Воронка продаж одной строкой (главная «C», владелец 01.11.2026): шесть шагов рядом, под числом переход с прошлого
 * шага и полоска доли от входа. Шаги 1 до 3 синие, с активных на пробном зелёные.
 */
export function SalesFunnelRow({ growth, t }: { growth: PlatformGrowth; t: Translate }) {
  const f = growth.funnel;
  const steps: Array<{ key: string; label: string; value: number | null; conv: number | null; tone: 'lead' | 'paid' }> = [
    { key: 'visitors', label: t('Посетили сайт'), value: f.visitors, conv: null, tone: 'lead' },
    { key: 'registrations', label: t('Оставили заявку'), value: f.registrations, conv: f.conversion.visitorToRegistration, tone: 'lead' },
    { key: 'trials', label: t('Подключили пробный'), value: f.trials, conv: f.conversion.registrationToTrial, tone: 'lead' },
    { key: 'active', label: t('Активны на пробном'), value: f.activeTrials ?? null, conv: f.conversion.trialToActive ?? null, tone: 'paid' },
    { key: 'paid', label: t('Оплатили'), value: f.firstPayments, conv: f.conversion.trialToPaid, tone: 'paid' },
    { key: 'renewals', label: t('Продлили'), value: f.renewals, conv: f.conversion.renewal, tone: 'paid' },
  ];
  const entry = f.visitors ?? f.registrations;
  return (
    <ol className="cabinet-steps" data-testid="growth-funnel">
      {steps.map((s, i) => {
        const share = s.value !== null && entry > 0 ? Math.min(100, Math.max(2, Math.round((s.value * 100) / entry))) : 2;
        return (
          <li key={s.key} className="cabinet-steps__step" data-tone={s.tone} data-testid={`growth-${s.key}`}>
            <span className="cabinet-steps__label">
              {formatInt(i + 1)}. {s.label}
            </span>
            <span className="cabinet-steps__line">
              <b className="cabinet-steps__value">{s.value === null ? '—' : formatInt(s.value)}</b>
              {i === 0 ? (
                <span className="cabinet__conv cabinet__conv--start">{s.value === null ? t('счётчик не подключён') : t('старт')}</span>
              ) : (
                s.conv !== null && <span className="cabinet__conv">{percentText(s.conv)}</span>
              )}
            </span>
            <span className="cabinet__meter" aria-hidden="true">
              <span style={{ inlineSize: `${share}%` }} /* slop-allow: inline-style ширина полосы из доли от входа */ />
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** «Пробный в оплату и продления» по месяцам: две линии, проценты 0 до 100, выбранный месяц последним */
export function RatesChart({ growth, t, monthName }: { growth: PlatformGrowth; t: Translate; monthName: (m: string) => string }) {
  const rates = growth.rates ?? [];
  const W = 560;
  const H = 170;
  const x = (i: number) => 44 + (i * (W - 64)) / Math.max(rates.length - 1, 1);
  const y = (tenths: number) => H - 30 - (Math.min(tenths, 1000) / 1000) * (H - 50);
  const line = (pick: (r: (typeof rates)[number]) => number | null) =>
    rates.flatMap((r, i) => {
      const v = pick(r);
      return v === null ? [] : [`${x(i)},${y(v)}`];
    });
  const last = rates.at(-1);
  return (
    <figure className="cabinet-rates" data-testid="growth-rates">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={t('Пробный в оплату и продления по месяцам')}>
        {[0, 500, 1000].map((g) => (
          <g key={g}>
            <line className="cabinet-rates__grid" x1={36} x2={W - 10} y1={y(g)} y2={y(g)} />
            <text className="cabinet-rates__axis" x={0} y={y(g) + 4}>
              {percentText(g)}
            </text>
          </g>
        ))}
        <polyline className="cabinet-rates__line" data-tone="renewal" points={line((r) => r.renewal).join(' ')} />
        <polyline className="cabinet-rates__line" data-tone="trial" points={line((r) => r.trialToPaid).join(' ')} />
        {rates.map((r, i) => (
          <g key={r.month}>
            {r.renewal !== null && <circle className="cabinet-rates__dot" data-tone="renewal" cx={x(i)} cy={y(r.renewal)} r={4} />}
            {r.trialToPaid !== null && <circle className="cabinet-rates__dot" data-tone="trial" cx={x(i)} cy={y(r.trialToPaid)} r={4} />}
            <text className="cabinet-rates__axis" x={x(i)} y={H - 8} textAnchor="middle">
              {monthName(r.month)}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="cabinet-rates__legend">
        <span data-tone="trial">
          {t('пробный в оплату')}
          {last?.trialToPaid !== null && last?.trialToPaid !== undefined ? `: ${percentText(last.trialToPaid)}` : ''}
        </span>
        <span data-tone="renewal">
          {t('продлили после оплаты')}
          {last?.renewal !== null && last?.renewal !== undefined ? `: ${percentText(last.renewal)}` : ''}
        </span>
      </figcaption>
    </figure>
  );
}

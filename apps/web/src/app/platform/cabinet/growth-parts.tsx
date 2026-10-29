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

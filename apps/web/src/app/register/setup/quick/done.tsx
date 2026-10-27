'use client';
import Link from 'next/link';
import { formatMoney } from '../../../../lib/money';
import { msg } from '../../../../i18n';
import { useT } from '../../../../i18n/locale-provider';
import type { DoneSummary } from './model';

/** «Салон готов», вариант А (владелец 27.10.2026): весь экран занят созданным, одна главная кнопка в журнал */
const PAYMENT: Record<string, string> = {
  CASH: msg('Наличные'),
  CARD_TERMINAL: msg('Карта'),
  BANK_TRANSFER_LEGAL: msg('Перевод на счёт компании'),
  BANK_TRANSFER_PERSON: msg('Перевод на личный счёт'),
  OTHER: msg('Другое'),
};
const ROLE: Record<DoneSummary['team'][number]['role'], string> = {
  master: msg('мастер'),
  both: msg('мастер и администратор'),
  STAFF: msg('администратор'),
  MANAGER: msg('управляющий'),
};
const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase())
    .join('');

export function QuickDone({ summary, warnings }: { summary: DoneSummary; warnings: string[] }) {
  const t = useT();
  const money = (minor: string) => formatMoney(minor, summary.line.currency);
  const minutes = (m: number) =>
    m >= 60 ? (m % 60 ? t('{h} ч {m} мин', { h: Math.floor(m / 60), m: m % 60 }) : t('{h} ч', { h: m / 60 })) : t('{m} мин', { m });
  const SHOWN = 9;
  const kpis = [
    [summary.counts.services, msg('услуги')],
    [summary.counts.masters, msg('мастера')],
    [summary.counts.staff, msg('сотрудники')],
    [summary.counts.products, msg('товары бара')],
    [summary.counts.invites, msg('приглашения')],
  ] as const;
  return (
    <section className="quick-done" data-testid="quick-done" aria-labelledby="quick-done-title">
      <header className="quick-done__hero">
        <h2 id="quick-done-title">{t('{name} готов к работе', { name: summary.title })}</h2>
        <p>
          {[
            summary.line.address,
            summary.line.days === 7
              ? t('ежедневно {hours}', { hours: summary.line.hours })
              : t('{days} дн. в неделю, {hours}', { days: summary.line.days, hours: summary.line.hours }),
            summary.line.currency,
          ]
            .filter(Boolean)
            .join(', ')}
        </p>
      </header>
      <dl className="quick-done__kpis">
        {kpis.map(([n, label]) => (
          <div key={label} className="quick-done__kpi">
            <dd>{n}</dd>
            <dt>{t(label)}</dt>
          </div>
        ))}
      </dl>
      <div className="quick-done__grid">
        <section className="quick-done__card" aria-labelledby="quick-done-team">
          <h3 id="quick-done-team">{t('Команда')}</h3>
          <table>
            <tbody>
              {summary.team.map((m) => (
                <tr key={`${m.role}:${m.name}`}>
                  <td>
                    <span className="quick-done__person">
                      <span className="quick-done__avatar" aria-hidden="true">
                        {initials(m.name)}
                      </span>
                      {m.name}
                    </span>
                  </td>
                  <td className="quick-done__muted">
                    {m.services ? t('{role}, услуг: {n}', { role: t(ROLE[m.role]), n: m.services }) : t(ROLE[m.role])}
                  </td>
                  <td className="quick-done__num">
                    {m.pay?.kind === 'PERCENT'
                      ? `${m.pay.percent}%`
                      : m.pay?.kind === 'FIXED'
                        ? money(m.pay.fixedMinor)
                        : m.pay
                          ? `${money(m.pay.fixedMinor)} + ${m.pay.percent}%`
                          : ''}
                  </td>
                  <td className="quick-done__num">
                    <span className={`quick-done__pill is-${m.invite}`}>
                      {m.invite === 'sent' ? t('письмо ушло') : m.invite === 'failed' ? t('не отправлено') : t('без входа')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="quick-done__card" aria-labelledby="quick-done-services">
          <h3 id="quick-done-services">{t('Услуги')}</h3>
          <table>
            <tbody>
              {summary.services.slice(0, SHOWN).map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td className="quick-done__num quick-done__muted">{minutes(s.minutes)}</td>
                  <td className="quick-done__num">{money(s.priceMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary.services.length > SHOWN && (
            <Link className="quick-done__more" href="/services">
              {t('и ещё {n}', { n: summary.services.length - SHOWN })}
            </Link>
          )}
        </section>
        <section className="quick-done__card" aria-labelledby="quick-done-bar">
          <h3 id="quick-done-bar">{t('Бар и оплата')}</h3>
          <table>
            <tbody>
              {summary.bar.paid.map((p) => (
                <tr key={p.name}>
                  <td>{p.name}</td>
                  <td className="quick-done__num">{money(p.priceMinor)}</td>
                </tr>
              ))}
              {summary.bar.free.length > 0 && (
                <tr>
                  <td>{summary.bar.free.join(', ')}</td>
                  <td className="quick-done__num quick-done__ok">{t('бесплатно')}</td>
                </tr>
              )}
              {summary.payments.map((m) => (
                <tr key={m}>
                  <td>{t(PAYMENT[m] ?? m)}</td>
                  <td className="quick-done__num quick-done__ok">{t('включено')}</td>
                </tr>
              ))}
              <tr>
                <td>{t('Часы работы')}</td>
                <td className="quick-done__num">{summary.line.hours}</td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
      {warnings.length > 0 && (
        <p className="quick-done__warn" role="status">
          {warnings.join('; ')}
        </p>
      )}
      <div className="quick-done__actions">
        <Link className="btn btn--secondary" href="/team">
          {t('Пригласить ещё')}
        </Link>
        <Link className="btn btn--secondary" href="/beauty-settings">
          {t('Настройки салона')}
        </Link>
        <Link className="btn quick-go" href="/calendar">
          {t('Открыть журнал')}
        </Link>
      </div>
    </section>
  );
}

import Link from 'next/link';
import { redirect, unstable_rethrow } from 'next/navigation';
import { Badge, EmptyState, Panel, Stat, Stats, Table, type BadgeTone } from '../../components/ui';
import { Icon } from '../../components/icon';
import { ApiError } from '../../lib/api-error';
import { partnerApi, type PartnerCabinetView, type PartnerClientStatus, type PartnerLevel } from '../../lib/api';
import { publicAuthUrl } from '../../lib/auth-entry';
import { formatInt } from '../../lib/dashboard-format';
import { msg, type Translate } from '../../i18n';
import { serverT } from '../../i18n/server';
import { usd } from '../platform/cabinet/shell';
import { signOut } from '../login/actions';
import { CopyLink } from './copy-link';
import { PartnerProfileForm } from './profile-form';
import '../platform/cabinet/cabinet.css';
import './partner.css';

export const dynamic = 'force-dynamic';

type Tab = 'home' | 'clients' | 'link' | 'money' | 'profile';
const TABS: Array<{ key: Tab; label: string; icon: 'today' | 'guests' | 'link' | 'money' | 'person' }> = [
  { key: 'home', label: msg('Главная'), icon: 'today' },
  { key: 'clients', label: msg('Клиенты'), icon: 'guests' },
  { key: 'link', label: msg('Ссылка'), icon: 'link' },
  { key: 'money', label: msg('Деньги'), icon: 'money' },
  { key: 'profile', label: msg('Профиль'), icon: 'person' },
];
const LEVEL: Record<PartnerLevel, { label: string; tone: BadgeTone }> = {
  NEW: { label: msg('Новый'), tone: 'neutral' },
  ACTIVE: { label: msg('Активный'), tone: 'info' },
  TOP: { label: msg('Топ'), tone: 'ok' },
};
const STATUS: Record<PartnerClientStatus, { label: string; tone: BadgeTone }> = {
  TRIAL: { label: msg('Пробный'), tone: 'info' },
  TRIAL_ENDED: { label: msg('Пробный закончился'), tone: 'warn' },
  ACTIVE: { label: msg('Работает'), tone: 'neutral' },
  PAID: { label: msg('Оплачен'), tone: 'ok' },
  LOST: { label: msg('Ушёл'), tone: 'danger' },
};

/**
 * Кабинет партнёра WETOP (владелец 31.10.2026; ТЗ VTOP 01.11.2026; DATA_MODEL §63.3). Только свои клиенты (имя и
 * статус, без контактов), своя ссылка, начисления по правилу первого чека, баланс и история выплат, место в рейтинге.
 */
export default async function PartnerPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const t = await serverT();
  const asked = (await searchParams).tab;
  const tab: Tab = TABS.find((x) => x.key === asked)?.key ?? 'home';
  let cab: PartnerCabinetView;
  try {
    cab = await partnerApi.me();
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ApiError && e.status === 401) redirect(publicAuthUrl('login', '/partner'));
    return (
      <main className="partner" data-testid="partner-denied">
        <EmptyState title={e instanceof ApiError && e.status === 403 ? t(e.message) : t('Кабинет не загрузился. Обновите страницу.')} />
      </main>
    );
  }
  return (
    <main className="partner" data-testid="partner-cabinet">
      <header className="partner__head">
        <div>
          <h1>{t('Кабинет партнёра')}</h1>
          <p className="muted">
            {cab.partner.name}, {t('ID партнёра')} <b data-testid="partner-code">{cab.partner.code}</b>
          </p>
        </div>
        <form action={signOut}>
          <button className="btn btn--secondary" type="submit">{t('Выйти')}</button>
        </form>
      </header>
      <nav className="glass-tabs" aria-label={t('Разделы кабинета партнёра')}>
        {TABS.map((x) => (
          <Link key={x.key} href={x.key === 'home' ? '/partner' : `/partner?tab=${x.key}`} aria-current={x.key === tab ? 'page' : undefined}>
            <Icon name={x.icon} /> {t(x.label)}
          </Link>
        ))}
      </nav>
      {tab === 'home' && <Home cab={cab} t={t} />}
      {tab === 'clients' && <Clients cab={cab} t={t} />}
      {tab === 'link' && <LinkTab cab={cab} t={t} />}
      {tab === 'money' && <Money cab={cab} t={t} />}
      {tab === 'profile' && <Profile cab={cab} t={t} />}
    </main>
  );
}

function Home({ cab, t }: { cab: PartnerCabinetView; t: Translate }) {
  const v = cab.view;
  const soon = v.clients.filter((c) => c.status === 'TRIAL' && c.trialEndsAt && Date.parse(c.trialEndsAt) - Date.now() < 5 * 86_400_000);
  const ended = v.clients.filter((c) => c.status === 'TRIAL_ENDED');
  return (
    <>
      <Stats min={180}>
        <Stat label={t('Клиентов')} value={formatInt(v.stats.clients)} icon={<Icon name="guests" />} testId="partner-clients-count" />
        <Stat label={t('На пробном')} value={formatInt(v.stats.trial)} icon={<Icon name="today" />} testId="partner-trial-count" />
        <Stat
          label={t('Оплатили')}
          value={formatInt(v.stats.paid)}
          hint={v.stats.conversion === null ? undefined : t('конверсия {p}%', { p: (v.stats.conversion / 10).toFixed(1).replace('.', ',') })}
          icon={<Icon name="chart" />}
          tone="success"
          testId="partner-paid-count"
        />
        <Stat label={t('Баланс')} value={usd(v.money.balanceCents)} hint={t('начислено {a}', { a: usd(v.money.accruedCents) })} icon={<Icon name="money" />} testId="partner-balance" />
        <Stat label={t('Рейтинг')} value={`${v.rating.place} / ${v.rating.of}`} icon={<Icon name="analytics" />} testId="partner-rating" />
      </Stats>
      <Panel title={t('Требует действия')} data-testid="partner-actions">
        {soon.length + ended.length === 0 ? (
          <EmptyState title={t('Срочного нет. Пригласите новых клиентов по своей ссылке.')} />
        ) : (
          <ul className="partner__todo">
            {soon.map((c) => (
              <li key={c.organizationId}>
                <b>{c.name}</b>: {t('пробный до {d}, помогите подключить и оплатить', { d: c.trialEndsAt ?? '' })}
              </li>
            ))}
            {ended.map((c) => (
              <li key={c.organizationId}>
                <b>{c.name}</b>: {t('пробный закончился, предложите тариф')}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}

function Clients({ cab, t }: { cab: PartnerCabinetView; t: Translate }) {
  const rows = cab.view.clients;
  return (
    <Panel title={t('Мои клиенты')} data-testid="partner-clients">
      {rows.length === 0 ? (
        <EmptyState title={t('Клиентов пока нет. Отправьте свою ссылку: клиент зарегистрируется и сразу станет вашим.')} />
      ) : (
        <Table aria-label={t('Мои клиенты')}>
          <thead>
            <tr>
              <th>{t('Клиент')}</th>
              <th>{t('Статус')}</th>
              <th>{t('С нами с')}</th>
              <th>{t('Откуда')}</th>
              <th className="num">{t('Ваша комиссия')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.organizationId} data-testid="partner-client-row">
                <td><b>{c.name}</b></td>
                <td>
                  <Badge tone={STATUS[c.status].tone}>{t(STATUS[c.status].label)}</Badge>
                  {c.trialEndsAt && <span className="muted"> {t('до {d}', { d: c.trialEndsAt })}</span>}
                </td>
                <td>{c.since}</td>
                <td>{c.source === 'LINK' ? [t('по ссылке'), c.channel].filter(Boolean).join(', ') : t('добавлен WETOP')}</td>
                <td className="num">{usd(c.commissionCents)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Panel>
  );
}

function LinkTab({ cab, t }: { cab: PartnerCabinetView; t: Translate }) {
  const wa = `https://wa.me/?text=${encodeURIComponent(`${t('Попробуйте WETOP 30 дней бесплатно: запись, клиенты, касса и продвижение в одном месте.')} ${cab.links.client}`)}`;
  return (
    <Panel title={t('Ваша ссылка для клиентов')} data-testid="partner-link">
      <p className="muted">{t('Клиент регистрируется по ссылке, получает 30 дней бесплатно и сразу становится вашим. Метку канала можно добавить в конце: &ch=instagram.')}</p>
      <CopyLink value={cab.links.client} />
      <div className="row">
        <a className="btn btn--secondary" href={wa} target="_blank" rel="noreferrer">
          <Icon name="chat" /> {t('Отправить в WhatsApp')}
        </a>
      </div>
    </Panel>
  );
}

function Money({ cab, t }: { cab: PartnerCabinetView; t: Translate }) {
  const v = cab.view;
  return (
    <>
      <Stats min={200}>
        <Stat label={t('Начислено')} value={usd(v.money.accruedCents)} icon={<Icon name="chart" />} testId="partner-accrued" />
        <Stat label={t('Выплачено')} value={usd(v.money.paidCents)} icon={<Icon name="receipt" />} testId="partner-paid" />
        <Stat label={t('Баланс к выплате')} value={usd(v.money.balanceCents)} icon={<Icon name="money" />} tone="success" testId="partner-due" />
      </Stats>
      <Panel title={t('Как считается')}>
        <p className="muted">
          {t('За клиента на месячном тарифе $10, на годовом $100, разово с первой оплаты. С допов (продвижение, ИИ-продавец, контент) {p}% с первой оплаты допа. Повторные оплаты не начисляются.', {
            p: String(Math.floor(cab.partner.percentBp / 100)),
          })}
        </p>
      </Panel>
      <Panel title={t('История выплат')} data-testid="partner-payouts">
        {v.payouts.length === 0 ? (
          <EmptyState title={t('Выплат пока не было.')} />
        ) : (
          <Table aria-label={t('История выплат')}>
            <thead>
              <tr>
                <th>{t('Дата')}</th>
                <th className="num">{t('Сумма')}</th>
                <th>{t('Заметка')}</th>
              </tr>
            </thead>
            <tbody>
              {v.payouts.map((p, i) => (
                <tr key={`${p.spentOn}-${i}`} data-testid="partner-payout-row">
                  <td>{p.spentOn}</td>
                  <td className="num">{usd(p.amountCents)}</td>
                  <td>{p.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>
    </>
  );
}

/** «Профиль»: карточка партнёра VTOP и «Мой профиль» (ТЗ 01.11.2026 п. 5, 7, 8; DATA_MODEL §63.4) */
function Profile({ cab, t }: { cab: PartnerCabinetView; t: Translate }) {
  const p = cab.profile;
  if (!p) return <EmptyState title={t('Профиль скоро появится: сервер обновится сам.')} />;
  const initials = cab.partner.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  const facts = [p.specialization, p.city, p.experienceYears === null ? null : t('опыт {n} лет', { n: String(p.experienceYears) })].filter(Boolean);
  return (
    <div className="partner__profile">
      <Panel title={t('Карточка партнёра VTOP')} data-testid="partner-card">
        <div className="partner__card-head">
          <span className="partner__avatar" aria-hidden="true">{initials}</span>
          <div>
            <b className="partner__card-name">{cab.partner.name}</b>
            <div className="muted">
              {t('ID партнёра')} {cab.partner.code}
              {facts.length > 0 && `, ${facts.join(', ')}`}
            </div>
          </div>
          <Badge tone={LEVEL[p.level].tone}>{t(LEVEL[p.level].label)}</Badge>
        </div>
        {p.about && <p className="partner__card-about">{p.about}</p>}
        <Stats min={140}>
          <Stat label={t('Partner Score')} value={`${p.score} / 100`} icon={<Icon name="analytics" />} testId="partner-score" />
          <Stat label={t('Рейтинг')} value={`${cab.view.rating.place} / ${cab.view.rating.of}`} icon={<Icon name="chart" />} />
          <Stat label={t('Клиентов')} value={formatInt(cab.view.stats.clients)} icon={<Icon name="guests" />} />
          <Stat label={t('Успешных подключений')} value={formatInt(cab.view.stats.paid)} tone="success" icon={<Icon name="money" />} testId="partner-success" />
          <Stat label={t('С нами с')} value={p.since} icon={<Icon name="today" />} />
        </Stats>
      </Panel>
      <Panel title={t('Мой профиль')}>
        <PartnerProfileForm profile={p} />
      </Panel>
    </div>
  );
}

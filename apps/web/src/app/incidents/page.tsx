import { guardApi, type Incident } from '../../lib/api';
import { Page } from '../../components/page';
import { Alert, Badge, SectionTitle, Stat, Stats, Table } from '../../components/ui';
import { GuardTickButton, IncidentButtons } from './buttons';

/**
 * Неисправности системы — одно место (срез 11, ADR-028). Сторож проверяет систему раз в минуту и пишет сюда
 * всё, что сломалось. Технику он чинит сам; брони, места и деньги — только человек; ошибки кода — дежурный агент.
 */
const CLASS_RU: Record<Incident['class'], string> = {
  A: 'техника — сторож чинит сам',
  B: 'данные — решает человек',
  C: 'код — исправляет дежурный агент',
};
const STATUS_RU: Record<Incident['status'], string> = {
  OPEN: 'замечена',
  FIXING: 'сторож чинит',
  ESCALATED: 'ждёт человека',
  ACKNOWLEDGED: 'принято',
  RESOLVED: 'закрыта',
};
const STATUS_TONE: Record<Incident['status'], 'info' | 'warn' | 'danger' | 'ok' | 'neutral'> = {
  OPEN: 'info',
  FIXING: 'info',
  ESCALATED: 'danger',
  ACKNOWLEDGED: 'warn',
  RESOLVED: 'ok',
};
const RESOLVED_BY_RU = { GUARD: 'сторож', AGENT: 'дежурный агент', STAFF: 'вручную' } as const;

/** Время по часам объекта: страница рендерится на сервере, у которого может быть другой пояс */
const at = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString('ru-RU', {
        timeZone: 'Asia/Almaty',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export default async function IncidentsPage() {
  const [status, open, all] = await Promise.all([
    guardApi.status().catch(() => null),
    guardApi.incidents('open').catch(() => null),
    guardApi.incidents('all', 60).catch(() => []),
  ]);
  const dayAgo = Date.now() - 24 * 3_600_000;
  const closed = all.filter(
    (i) => i.status === 'RESOLVED' && Date.parse(i.resolvedAt ?? '') > dayAgo,
  );
  const tick = status?.lastTick ?? null;
  return (
    <Page title="Неисправности" subtitle="сторож системы" actions={<GuardTickButton />}>
      {!status && (
        <Alert boxed>
          API не отвечает — сторож работает внутри API, поэтому сейчас не проверяет ничего.
          Поднимите API (<span className="mono">npm run start -w apps/api</span>).
        </Alert>
      )}
      {status && !status.notifier.configured && (
        <Alert boxed tone="warning" data-testid="notifier-missing">
          Будильник не настроен: сторож записывает неисправности, но никого не будит. Владельцу —
          вписать в <span className="mono">.env</span> TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID
          (docs/telegram/README.md) и перезапустить API.
        </Alert>
      )}
      <Stats min={150}>
        <Stat label="Открыто" value={String(status?.open.total ?? '—')} testId="incidents-open" />
        <Stat
          label="Срочных"
          value={
            <span className={status && status.open.critical > 0 ? 'danger-text' : undefined}>
              {String(status?.open.critical ?? '—')}
            </span>
          }
        />
        <Stat
          label="Ждут человека"
          value={
            <span className={status && status.open.escalated > 0 ? 'danger-text' : undefined}>
              {String(status?.open.escalated ?? '—')}
            </span>
          }
        />
      </Stats>
      {status && (
        <div className="facts facts--card">
          <div>
            <div className="fact__label">Сторож</div>
            <div className="fact__value" data-testid="guard-running">
              {status.running ? 'работает, проход раз в минуту' : 'выключен (GUARD=off)'}
            </div>
          </div>
          <div>
            <div className="fact__label">Починка техники</div>
            <div className="fact__value">
              {status.autofix ? 'включена' : 'выключена (GUARD_AUTOFIX=off)'}
            </div>
          </div>
          <div>
            <div className="fact__label">Последний проход</div>
            <div className="fact__value">{tick ? at(tick.at) : 'ещё не было'}</div>
            {tick && (
              <div className="cell-sub">
                проверок {tick.checked.length}
                {tick.checkErrors.length > 0 && (
                  <span className="danger-text">
                    , не отработали: {tick.checkErrors.map((e) => e.check).join(', ')}
                  </span>
                )}
              </div>
            )}
          </div>
          <div>
            <div className="fact__label">Будильник</div>
            <div className="fact__value">
              {status.notifier.configured
                ? `Telegram, чатов: ${status.notifier.recipients}`
                : 'не настроен'}
            </div>
            {tick?.alertError && status.notifier.configured && (
              <div className="cell-sub danger-text">{tick.alertError}</div>
            )}
          </div>
        </div>
      )}

      <SectionTitle>Открытые</SectionTitle>
      <Table size="sm" data-testid="incidents-table">
        <thead>
          <tr>
            {['Что случилось', 'Статус', 'Замечена', 'Что делал сторож', ''].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {open?.length === 0 && (
            <tr>
              <td colSpan={5} className="muted">
                неисправностей нет
              </td>
            </tr>
          )}
          {open?.map((i) => (
            <tr key={i.id} data-testid="incident-row" data-kind={i.kind} data-id={i.id}>
              <td>
                <Badge tone={i.severity === 'CRITICAL' ? 'danger' : 'warn'}>
                  {i.severity === 'CRITICAL' ? 'срочно' : 'не срочно'}
                </Badge>{' '}
                {i.title}
                <div className="cell-sub">{CLASS_RU[i.class]}</div>
              </td>
              <td>
                <Badge tone={STATUS_TONE[i.status]} data-testid="incident-status">
                  {STATUS_RU[i.status]}
                </Badge>
                {i.alertedAt && <div className="cell-sub">разбудил {at(i.alertedAt)}</div>}
              </td>
              <td className="nowrap">
                {at(i.firstSeenAt)}
                {i.occurrences > 1 && <div className="cell-sub">замечена {i.occurrences} раз</div>}
              </td>
              <td>
                {i.fixAttempts > 0 ? `${i.fixAttempts} попыт. — ` : ''}
                {i.lastFixResult ?? (i.class === 'A' ? 'ждёт' : 'не чинит — не его класс')}
              </td>
              <td>
                <IncidentButtons id={i.id} canAcknowledge={i.status !== 'ACKNOWLEDGED'} />
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      <SectionTitle>Закрыты за сутки</SectionTitle>
      <Table size="sm" data-testid="incidents-closed">
        <thead>
          <tr>
            {['Что случилось', 'Замечена', 'Закрыта', 'Кем'].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {closed.length === 0 && (
            <tr>
              <td colSpan={4} className="muted">
                за сутки ничего не закрывалось
              </td>
            </tr>
          )}
          {closed.map((i) => (
            <tr key={i.id}>
              <td>
                {i.title}
                {i.lastFixResult && <div className="cell-sub">{i.lastFixResult}</div>}
              </td>
              <td className="nowrap">{at(i.firstSeenAt)}</td>
              <td className="nowrap">{at(i.resolvedAt)}</td>
              <td>{i.resolvedBy ? RESOLVED_BY_RU[i.resolvedBy] : '—'}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Page>
  );
}

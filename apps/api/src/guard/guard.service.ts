import 'reflect-metadata';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import {
  POLICY,
  REALERT_MS,
  alertDue,
  classifyError,
  decideAction,
  fingerprintOf,
  formatAlert,
  overbookedNights,
  reconcileIncidents,
  redactText,
  type IncidentKind,
  type Observation,
  type OpenIncident,
} from '@pms/domain';
import {
  INCIDENTS_REPOSITORY,
  type IncidentRow,
  type IncidentsRepository,
} from './incidents.repository';
import {
  ALERT_NOTIFIER,
  GUARD_FIXES,
  GUARD_PROBES,
  type AlertNotifier,
  type FixOutcome,
  type GuardFixes,
  type GuardProbes,
  type GuardTickSummary,
} from './guard.ports';

/** Раз в минуту — как сторож webhook; первый проход через 30 с, когда остальные фоновые задачи уже поднялись */
export const GUARD_TICK_MS = 60_000;
const FIRST_TICK_MS = 30_000;
const MIN = 60_000;
/** Лента читается раз в 5 минут; три пропуска подряд — неисправность */
const FEED_STALE_MS = 15 * MIN;
/** Дельта ждёт отправки дольше — воркер не работает или Channex не принимает */
const OUTBOX_STUCK_MS = 15 * MIN;
/** Полная выгрузка раз в сутки после 03:00; 26 часов — сутки плюс запас на час выгрузки */
const SYNC_MISSING_MS = 26 * 60 * MIN;
const RETENTION_MS = 90 * 24 * 60 * MIN;
/** Ошибка на этих маршрутах может означать потерянную бронь — срочно */
const BOOKING_ROUTES = /^\/(?:w\/book|channels\/channex\/webhook)\b/;

const almatyDay = (d: Date) => new Date(d.getTime() + 5 * 60 * MIN).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const x = new Date(`${day}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
const ddmm = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}`;
const hhmm = (d: Date) => new Date(d.getTime() + 5 * 60 * MIN).toISOString().slice(11, 16);
const minutes = (ms: number) => Math.round(ms / MIN);
const errText = (e: unknown) => redactText(e instanceof Error ? e.message : String(e));

function toOpen(r: IncidentRow): OpenIncident {
  return {
    id: r.id,
    kind: r.kind,
    fingerprint: r.fingerprint,
    status: r.status,
    firstSeenAt: r.firstSeenAt,
    lastSeenAt: r.lastSeenAt,
    fixAttempts: r.fixAttempts,
    lastFixAt: r.lastFixAt,
    alertedAt: r.alertedAt,
    acknowledgedAt: r.acknowledgedAt,
  };
}

/**
 * Сторож системы (ADR-028, `plans/slice-11-guardian.md`). Раз в минуту:
 * 1) проверки → наблюдения; 2) сверка с открытыми неисправностями — новые записать, исчезнувшие закрыть
 *    (только если проверка отработала); 3) по каждой открытой — чинить (только техника, с лимитом),
 *    ждать или эскалировать; 4) будильник по правилам домена.
 * Брони, гостей, счета, цены и ячейки сторож не меняет. Починка — те же пути, что кнопки на /channels.
 */
@Injectable()
export class GuardService implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(GuardService.name);
  private timer: NodeJS.Timeout | null = null;
  private first: NodeJS.Timeout | null = null;
  private ticking = false;
  private last: GuardTickSummary | null = null;
  private dbDown: { since: Date; alertedAt: Date | null; error: string } | null = null;
  private purgedDay: string | null = null;
  /** GUARD_AUTOFIX=off — только запись и будильник */
  autofix = process.env.GUARD_AUTOFIX !== 'off';
  /**
   * GUARD_PROPERTY_LIVE=true — объект работает в этой PMS. До переключения данные броней приходят из Exely,
   * и овербукинг в них — не авария этой системы: предупреждение днём, а не звонок в 3 часа ночи.
   */
  propertyLive = process.env.GUARD_PROPERTY_LIVE === 'true';

  constructor(
    @Inject(INCIDENTS_REPOSITORY) private readonly repo: IncidentsRepository,
    @Inject(GUARD_PROBES) private readonly probes: GuardProbes,
    @Inject(GUARD_FIXES) private readonly fixes: GuardFixes,
    @Inject(ALERT_NOTIFIER) private readonly notifier: AlertNotifier,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test' || process.env.GUARD === 'off') return;
    const run = () =>
      void this.tick().catch((e: unknown) => this.log.warn(`сторож: ${errText(e)}`));
    this.first = setTimeout(run, FIRST_TICK_MS);
    this.first.unref();
    this.timer = setInterval(run, GUARD_TICK_MS);
    this.timer.unref();
    this.log.log(
      `сторож системы запущен: проход раз в минуту, починка ${this.autofix ? 'включена' : 'ВЫКЛЮЧЕНА'}, будильник ${this.notifier.configured ? `на ${this.notifier.recipients} чат(а)` : 'не настроен'}`,
    );
  }
  onModuleDestroy(): void {
    if (this.first) clearTimeout(this.first);
    if (this.timer) clearInterval(this.timer);
  }

  status() {
    return {
      running: this.timer !== null,
      autofix: this.autofix,
      propertyLive: this.propertyLive,
      notifier: { configured: this.notifier.configured, recipients: this.notifier.recipients },
      dbDownSince: this.dbDown?.since.toISOString() ?? null,
      lastTick: this.last,
    };
  }

  async tick(now = new Date()): Promise<GuardTickSummary> {
    if (this.ticking && this.last) return this.last;
    this.ticking = true;
    const started = Date.now();
    const summary: GuardTickSummary = {
      at: now.toISOString(),
      durationMs: 0,
      dbOk: true,
      checked: [],
      checkErrors: [],
      observed: [],
      resolved: 0,
      fixes: [],
      escalated: 0,
      alerted: 0,
      alertError: this.notifier.configured
        ? null
        : 'будильник не настроен: TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в .env (docs/telegram/README.md)',
    };
    try {
      try {
        await this.probes.dbPing();
      } catch (e) {
        summary.dbOk = false;
        await this.onDbDown(now, e, summary);
        return summary;
      }
      if (this.dbDown) await this.onDbBack(now);

      const open = await this.repo.open();
      const { observed, checked, errors } = await this.collect(now);
      summary.observed = observed;
      summary.checked = checked;
      summary.checkErrors = errors;
      const plan = reconcileIncidents({ open: open.map(toOpen), observed, checked, now });
      for (const o of plan.record) await this.repo.record(o, now);
      summary.resolved = await this.repo.resolve(plan.resolve, 'GUARD', now);

      const ran = new Map<string, Promise<FixOutcome>>();
      for (const inc of await this.repo.open()) {
        const action = decideAction(toOpen(inc), now, this.autofix);
        if (action === 'fix') {
          const fix = this.fixFor(inc);
          if (!fix) {
            await this.repo.escalate(inc.id, 'починки для этого вида нет');
            summary.escalated++;
            continue;
          }
          // Две неисправности с одной починкой (выгрузка) в одном проходе — один вызов Channex
          if (!ran.has(fix.key)) ran.set(fix.key, fix.run());
          const outcome = await ran.get(fix.key)!;
          await this.repo.markFixAttempt(inc.id, outcome.text, now);
          summary.fixes.push({
            kind: inc.kind,
            subjectId: inc.subjectId,
            ok: outcome.ok,
            text: outcome.text,
          });
        } else if (action === 'escalate') {
          const reason =
            inc.fixAttempts > 0
              ? null
              : POLICY[inc.kind].fix && !this.autofix
                ? 'починка выключена (GUARD_AUTOFIX=off)'
                : null;
          await this.repo.escalate(inc.id, reason);
          summary.escalated++;
        }
      }

      await this.alert(now, summary);
      await this.purge(now);
      return summary;
    } finally {
      summary.durationMs = Date.now() - started;
      this.last = summary;
      this.ticking = false;
    }
  }

  /** Ответ 500 от кода (перехватчик ошибок) — сразу в одно место; эскалирует ближайший проход. */
  async recordApiError(
    input: { method: string; route: string; status: number; error: unknown },
    now = new Date(),
  ): Promise<void> {
    const subjectId = `${input.method} ${input.route}`;
    const e = input.error;
    const o: Observation = {
      kind: 'api.error',
      title: `Ошибка программы (HTTP ${input.status}) на ${subjectId}`,
      subjectType: 'route',
      subjectId,
      severity: BOOKING_ROUTES.test(input.route) ? 'CRITICAL' : 'WARNING',
      details: {
        status: input.status,
        error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
        at:
          e instanceof Error
            ? (e.stack
                ?.split('\n')
                .slice(1, 4)
                .map((l) => l.trim()) ?? [])
            : [],
      },
    };
    await this.repo.record({ ...o, fingerprint: fingerprintOf(o) }, now);
  }

  // ───────────────────────── проверки ─────────────────────────

  private async collect(now: Date) {
    const observed: Observation[] = [];
    const checked: IncidentKind[] = [];
    const errors: Array<{ check: string; error: string }> = [];
    const run = async (
      name: string,
      kinds: IncidentKind[],
      fn: () => Promise<Observation[]> | Observation[],
    ) => {
      try {
        observed.push(...(await fn()));
        checked.push(...kinds);
      } catch (e) {
        errors.push({ check: name, error: errText(e) });
      }
    };
    const channex = this.probes.channexEnabled();

    if (channex && this.probes.enabled('webhookHealth')) {
      const w = this.probes.webhook();
      if (w.checkedAt)
        await run(
          'channex.webhook',
          w.callbackCheckedAt ? ['webhook.suspect', 'webhook.unreachable'] : ['webhook.suspect'],
          () => {
            const out: Observation[] = [];
            if (w.suspect)
              out.push({
                kind: 'webhook.suspect',
                title: `Webhook Channex под подозрением: ${w.suspectReason ?? 'причина не записана'}`,
                details: { since: w.suspectSince },
              });
            if (w.callbackReachable === false)
              out.push({
                kind: 'webhook.unreachable',
                title: 'Адрес webhook Channex не отвечает — брони доходят только опросом ленты',
                details: { url: w.callbackUrl, checkedAt: w.callbackCheckedAt },
              });
            return out;
          },
        );
    }

    if (channex && this.probes.enabled('pull'))
      await run('channex.feed', ['feed.stale'], () => {
        const h = this.probes.pullHealth();
        const since = h.okAt ?? h.startedAt;
        const waited = now.getTime() - since.getTime();
        return waited < FEED_STALE_MS
          ? []
          : [
              {
                kind: 'feed.stale',
                title: `Лента броней Channex не читается ${minutes(waited)} мин`,
                details: { lastOkAt: h.okAt?.toISOString() ?? null, error: h.error },
              },
            ];
      });

    if (channex)
      await run('channex.outbox', ['outbox.failed', 'outbox.stuck'], async () => {
        const o = await this.probes.outbox();
        const out: Observation[] = [];
        if (o.failedSinceSync > 0)
          out.push({
            kind: 'outbox.failed',
            title: `В Channex не ушли изменения остатков или ограничений: ${o.failedSinceSync} после последней полной выгрузки`,
            details: {
              lastFullSyncAt: o.lastFullSyncAt?.toISOString() ?? null,
              lastError: o.lastFailedError,
            },
          });
        if (o.oldestPendingAt && now.getTime() - o.oldestPendingAt.getTime() >= OUTBOX_STUCK_MS)
          out.push({
            kind: 'outbox.stuck',
            title: `Очередь в Channex стоит: изменение ждёт отправки ${minutes(now.getTime() - o.oldestPendingAt.getTime())} мин`,
            details: { oldestPendingAt: o.oldestPendingAt.toISOString() },
          });
        return out;
      });

    await run('channex.events', ['event.failed', 'event.rejected'], async () =>
      (await this.probes.failedEvents()).map((ev): Observation => {
        const transient = classifyError(ev.lastError) === 'transient';
        return {
          kind: transient ? 'event.failed' : 'event.rejected',
          title: transient
            ? `Входящая бронь Channex не обработалась из-за сбоя связи (ревизия ${ev.externalEventId})`
            : `Бронь канала отклонена и не попала в PMS (ревизия ${ev.externalEventId})`,
          subjectType: 'external_event',
          subjectId: ev.externalEventId,
          details: {
            type: ev.type,
            attempts: ev.attempts,
            receivedAt: ev.receivedAt.toISOString(),
            lastError: ev.lastError,
          },
        };
      }),
    );

    if (channex && this.probes.enabled('fullSync'))
      await run('channex.sync', ['sync.missing'], async () => {
        const { lastFullSyncAt } = await this.probes.outbox();
        if (lastFullSyncAt && now.getTime() - lastFullSyncAt.getTime() < SYNC_MISSING_MS) return [];
        return [
          {
            kind: 'sync.missing',
            title: lastFullSyncAt
              ? `Полной выгрузки в Channex не было ${Math.floor((now.getTime() - lastFullSyncAt.getTime()) / (60 * MIN))} ч`
              : 'Полной выгрузки в Channex не было ни разу',
            details: { lastFullSyncAt: lastFullSyncAt?.toISOString() ?? null },
          },
        ];
      });

    await run('stays', ['stay.overbooked', 'stay.unassigned'], async () => {
      const today = almatyDay(now);
      const s = await this.probes.stays(today, addDays(today, 2));
      const name = (code: string) => s.categoryNames[code] ?? code;
      const out: Observation[] = overbookedNights({
        from: today,
        to: addDays(today, 1),
        units: s.units,
        blocks: s.blocks,
        items: s.items,
      }).map((n) => ({
        kind: 'stay.overbooked',
        title: `Продано сверх вместимости: ${name(n.code)}, ночь ${ddmm(n.date)} — ${n.sold} на ${n.capacity}${this.propertyLive ? '' : ' (объект пока работает в Exely)'}`,
        subjectType: 'category_night',
        subjectId: `${n.code}:${n.date}`,
        severity: this.propertyLive && n.date === today ? 'CRITICAL' : 'WARNING',
        details: { category: n.code, date: n.date, sold: n.sold, capacity: n.capacity },
      }));
      const seen = new Set<string>();
      for (const u of s.unassigned) {
        if (seen.has(u.confirmationNumber)) continue;
        seen.add(u.confirmationNumber);
        out.push({
          kind: 'stay.unassigned',
          title: `Проживание без ячейки: бронь ${u.confirmationNumber}, ${name(u.categoryCode)}, заезд ${ddmm(u.arrivalDate)}`,
          subjectType: 'reservation',
          subjectId: u.confirmationNumber,
          details: { category: u.categoryCode, arrivalDate: u.arrivalDate },
        });
      }
      return out;
    });

    const reports = this.probes.reports();
    if (reports)
      await run('reports', ['reconciliation.fail'], () =>
        reports
          .filter((r) => r.result === 'FAIL')
          .map((r) => ({
            kind: 'reconciliation.fail' as const,
            title: `Сверка «${r.kind}» дала FAIL: reports/${r.file}`,
            subjectType: 'report',
            subjectId: r.kind,
            details: { file: r.file, line: r.line },
          })),
      );

    const suites = this.probes.failingSuites();
    if (suites)
      await run('tests', ['tests.failing'], () =>
        suites.map((t) => ({
          kind: 'tests.failing' as const,
          title: `Падает набор тестов «${t.suite}»: упавших ${t.failures}${t.first ? ` — ${t.first}` : ''}`,
          subjectType: 'suite',
          subjectId: t.suite,
          details: { startedAt: t.startedAt },
        })),
      );

    return { observed, checked, errors };
  }

  // ───────────────────────── починка ─────────────────────────

  private fixFor(inc: IncidentRow): { key: string; run: () => Promise<FixOutcome> } | null {
    const safe = (fn: () => Promise<FixOutcome>) => async (): Promise<FixOutcome> => {
      try {
        return await fn();
      } catch (e) {
        return { ok: false, text: `ошибка: ${errText(e)}` };
      }
    };
    switch (inc.kind) {
      case 'feed.stale':
        // Под подозрением сторож webhook сам опрашивает ленту каждую минуту — второй опрос поверх не нужен
        // (лимит Channex, замечание сессии pms-lux-1a 13.09.2026); попытка засчитывается, чтобы дойти до эскалации
        return {
          key: 'pull',
          run: safe(async () =>
            this.probes.channexEnabled() &&
            this.probes.enabled('webhookHealth') &&
            this.probes.webhook().suspect
              ? {
                  ok: false,
                  text: 'опрос не запускал: сторож webhook уже опрашивает ленту каждую минуту',
                }
              : this.fixes.pull(),
          ),
        };
      case 'outbox.failed':
      case 'sync.missing':
        // Не повтор старой дельты, а полная выгрузка: свежий остаток нельзя перезаписать устаревшим (ADR-028)
        return { key: 'fullSync', run: safe(() => this.fixes.fullSync()) };
      case 'outbox.stuck':
        return { key: 'flush', run: safe(() => this.fixes.flushOutbox()) };
      case 'event.failed':
        return inc.subjectId
          ? {
              key: `retry:${inc.subjectId}`,
              run: safe(() => this.fixes.retryEvent(inc.subjectId!)),
            }
          : null;
      default:
        return null;
    }
  }

  // ───────────────────────── будильник ─────────────────────────

  private async alert(now: Date, summary: GuardTickSummary): Promise<void> {
    const due = (await this.repo.open()).filter((i) => alertDue(i, now));
    if (due.length === 0 || !this.notifier.configured) return;
    try {
      const r = await this.notifier.send(formatAlert(due, now));
      if (r.delivered > 0) {
        await this.repo.markAlerted(
          due.map((i) => i.id),
          now,
        );
        summary.alerted = due.length;
      }
      if (r.failed.length > 0)
        summary.alertError = r.failed.map((f) => `чат ${f.chatId}: ${f.error}`).join('; ');
    } catch (e) {
      summary.alertError = errText(e);
    }
  }

  /** Базы нет — писать некуда: будим напрямую, из памяти процесса, по той же политике db.down */
  private async onDbDown(now: Date, e: unknown, summary: GuardTickSummary): Promise<void> {
    if (!this.dbDown) {
      this.dbDown = { since: now, alertedAt: null, error: errText(e) };
      this.log.error(`база данных не отвечает: ${this.dbDown.error}`);
    }
    const waited = now.getTime() - this.dbDown.since.getTime();
    const last = this.dbDown.alertedAt;
    const due =
      waited >= (POLICY['db.down'].escalateAfterMs ?? 0) &&
      (!last || now.getTime() - last.getTime() >= REALERT_MS);
    if (!due || !this.notifier.configured) return;
    try {
      const r = await this.notifier.send(
        formatAlert(
          [
            {
              id: 'db.down',
              kind: 'db.down',
              severity: 'CRITICAL',
              status: 'ESCALATED',
              title: `Не отвечает база данных PMS с ${hhmm(this.dbDown.since)} Алматы: ${this.dbDown.error}`,
              alertedAt: null,
              acknowledgedAt: null,
              fixAttempts: 0,
              lastFixResult: null,
            },
          ],
          now,
        ),
      );
      if (r.delivered > 0) {
        this.dbDown.alertedAt = now;
        summary.alerted = 1;
      }
    } catch (err) {
      summary.alertError = errText(err);
    }
  }

  /** База вернулась — в историю ложится закрытая запись «не отвечала с … до …» */
  private async onDbBack(now: Date): Promise<void> {
    const down = this.dbDown!;
    this.dbDown = null;
    this.log.log(`база данных снова отвечает (не отвечала с ${hhmm(down.since)} Алматы)`);
    const o: Observation = {
      kind: 'db.down',
      title: `База данных PMS не отвечала с ${hhmm(down.since)} до ${hhmm(now)} Алматы`,
      details: {
        since: down.since.toISOString(),
        until: now.toISOString(),
        error: down.error,
        alerted: !!down.alertedAt,
      },
    };
    const row = await this.repo.record({ ...o, fingerprint: fingerprintOf(o) }, now);
    await this.repo.resolve([row.id], 'GUARD', now);
  }

  private async purge(now: Date): Promise<void> {
    const day = almatyDay(now);
    if (this.purgedDay === day) return;
    this.purgedDay = day;
    await this.repo.purgeResolvedBefore(new Date(now.getTime() - RETENTION_MS));
  }
}

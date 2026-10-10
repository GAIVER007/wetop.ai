import { DayBars, type DayBar } from '../../components/day-bars';
import { DonutShare } from '../../components/donut-share';
import { Icon } from '../../components/icon';
import { Grid, Notice, Panel, SectionTitle, Stat, Stats } from '../../components/ui';
import type { PlatformOverview } from '../../lib/api';
import { formatInt } from '../../lib/dashboard-format';
import { PLATFORM_STATUS_LABEL, PLATFORM_VERTICAL_LABEL } from '../../lib/platform';

/**
 * Обзор платформы (срез P1, `plans/platform-superadmin-2026-10-10.md`, макет владельца от 10.10.2026): итоги,
 * рост подключений, направления и статусы. Чисел о деньгах нет: платежи платформе в системе не ведутся (ADR-102),
 * и обзор их не выдумывает (Q-PA-1, Q-PA-2). Показатели чужих организаций (брони, выручка гостей) сюда не
 * попадают по построению (Q-285, ADR-083).
 */
const MONTH_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTH_FULL = [
  'январь',
  'февраль',
  'март',
  'апрель',
  'май',
  'июнь',
  'июль',
  'август',
  'сентябрь',
  'октябрь',
  'ноябрь',
  'декабрь',
];

const lastDay = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);

function growthBars(growth: PlatformOverview['growth']): DayBar[] {
  const top = Math.max(1, ...growth.map((g) => g.total));
  return growth.map((g) => {
    const monthIndex = Number(g.month.slice(5, 7)) - 1;
    return {
      date: `${g.month}-01`,
      to: lastDay(g.month),
      label: MONTH_RU[monthIndex] ?? g.month,
      height: Math.round((g.total / top) * 100),
      facts: `${MONTH_FULL[monthIndex] ?? g.month} ${g.month.slice(0, 4)}: подключений ${formatInt(g.added)}, всего организаций ${formatInt(g.total)}`,
    };
  });
}

export function PlatformOverviewSection({ view, today }: { view: PlatformOverview; today: string }) {
  const t = view.totals;
  const count = (v: string) => formatInt(Number(v));
  return (
    <section className="stack" aria-labelledby="platform-overview-title" data-testid="platform-overview">
      <SectionTitle first id="platform-overview-title">
        Обзор платформы
      </SectionTitle>
      <Stats min={180}>
        <Stat
          label="Всего клиентов"
          value={formatInt(t.organizations)}
          hint={t.suspended > 0 ? `и ещё в архиве: ${formatInt(t.suspended)}` : 'организации без архива'}
          icon={<Icon name="guests" />}
          testId="platform-kpi-organizations"
        />
        <Stat
          label="Работают"
          value={formatInt(t.active)}
          hint="оплата получена"
          icon={<Icon name="check" />}
          testId="platform-kpi-active"
        />
        <Stat
          label="Пробный период"
          value={formatInt(t.trial)}
          icon={<Icon name="clock" />}
          testId="platform-kpi-trial"
        />
        <Stat
          label="Только чтение"
          value={formatInt(t.readOnly)}
          hint="ждут оплаты"
          icon={<Icon name="lock" />}
          testId="platform-kpi-read-only"
        />
        <Stat
          label="Активные пользователи"
          value={formatInt(t.activeUsers)}
          hint={`из ${formatInt(t.usersTotal)}, входили за 30 дней`}
          icon={<Icon name="person" />}
          testId="platform-kpi-active-users"
        />
        <Stat
          label="Новые подключения"
          value={formatInt(t.newLast30d)}
          hint="за 30 дней"
          icon={<Icon name="plus" />}
          testId="platform-kpi-new"
        />
      </Stats>
      <Grid min={320}>
        <Panel title="Рост количества клиентов">
          <DayBars testId="platform-growth" today={today} days={growthBars(view.growth)} />
          <p className="muted">Подключения по месяцам за год, столбик — всего организаций к концу месяца.</p>
        </Panel>
        {view.verticals.length > 0 && (
          <Panel title="Клиенты по направлениям">
            <DonutShare
              testId="platform-verticals"
              items={view.verticals.map((v) => ({
                label: PLATFORM_VERTICAL_LABEL[v.vertical],
                valueMinor: String(v.organizations),
              }))}
              centerValue={formatInt(view.verticals.reduce((n, v) => n + v.organizations, 0))}
              centerLabel="клиентов"
              amount={count}
            />
            <p className="muted">Действующие организации по направлению их первого бизнеса.</p>
          </Panel>
        )}
        {view.statuses.length > 0 && (
          <Panel title="Статус клиентов">
            <DonutShare
              testId="platform-statuses"
              items={view.statuses.map((s) => ({
                label: PLATFORM_STATUS_LABEL[s.status] ?? s.status,
                valueMinor: String(s.organizations),
              }))}
              centerValue={formatInt(view.statuses.reduce((n, s) => n + s.organizations, 0))}
              centerLabel="всего"
              amount={count}
            />
          </Panel>
        )}
      </Grid>
      <Notice tone="muted" data-testid="platform-no-billing">
        Подписки и выручка платформы здесь не считаются: платежи принимаются счётом, оплату
        подтверждает главный администратор в карточке организации (ADR-102). MRR, пакеты и просрочки
        появятся после решения о биллинге (Q-PA-1, Q-PA-2 в QUESTIONS.md).
      </Notice>
    </section>
  );
}

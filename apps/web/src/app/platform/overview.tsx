import { DayBars, type DayBar } from '../../components/day-bars';
import { DonutShare } from '../../components/donut-share';
import { Icon } from '../../components/icon';
import { Grid, Notice, Panel, SectionTitle, Stat, Stats } from '../../components/ui';
import type { PlatformOverview } from '../../lib/api';
import { formatInt } from '../../lib/dashboard-format';
import { PLATFORM_STATUS_LABEL, PLATFORM_VERTICAL_LABEL } from '../../lib/platform';
import { intlLocale, type DeskLocale, type Translate } from '../../i18n';
import { dateFormat } from '../../i18n/dates';
import { currentLocale, serverT } from '../../i18n/server';

/**
 * Обзор платформы (срез P1, `plans/platform-superadmin-2026-10-10.md`, макет владельца от 10.10.2026): итоги,
 * рост подключений, направления и статусы. Чисел о деньгах нет: платежи платформе в системе не ведутся (ADR-102),
 * и обзор их не выдумывает (Q-PA-1, Q-PA-2). Показатели чужих организаций (брони, выручка гостей) сюда не
 * попадают по построению (Q-285, ADR-083).
 */
const MONTH_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']; // kk-allow: русские подписи остаются как были, другие языки берут месяц из dateFormat
const MONTH_FULL = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']; // kk-allow: русские подписи остаются как были, другие языки берут месяц из dateFormat

/** Месяц словом: русский как прежде (без точки в «янв»), казахский и английский из `dateFormat` */
function monthWord(index: number, style: 'short' | 'long', locale: DeskLocale): string | undefined {
  if (locale === 'ru') return (style === 'short' ? MONTH_RU : MONTH_FULL)[index];
  if (index < 0 || index > 11) return undefined;
  return dateFormat(intlLocale(locale), { month: style, timeZone: 'UTC' }).format(new Date(Date.UTC(2026, index, 1)));
}

const lastDay = (month: string) =>
  new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);

function growthBars(growth: PlatformOverview['growth'], t: Translate, locale: DeskLocale): DayBar[] {
  const top = Math.max(1, ...growth.map((g) => g.total));
  return growth.map((g) => {
    const monthIndex = Number(g.month.slice(5, 7)) - 1;
    return {
      date: `${g.month}-01`,
      to: lastDay(g.month),
      label: monthWord(monthIndex, 'short', locale) ?? g.month,
      height: Math.round((g.total / top) * 100),
      facts: t('{month} {year}: подключений {added}, всего организаций {total}', {
        month: monthWord(monthIndex, 'long', locale) ?? g.month,
        year: g.month.slice(0, 4),
        added: formatInt(g.added),
        total: formatInt(g.total),
      }),
    };
  });
}

export async function PlatformOverviewSection({ view, today }: { view: PlatformOverview; today: string }) {
  const sum = view.totals;
  const t = await serverT();
  const locale = await currentLocale();
  const count = (v: string) => formatInt(Number(v));
  return (
    <section className="stack" aria-labelledby="platform-overview-title" data-testid="platform-overview">
      <SectionTitle first id="platform-overview-title">
        {t('Обзор платформы')}
      </SectionTitle>
      <Stats min={180}>
        <Stat
          label={t('Всего клиентов')}
          value={formatInt(sum.organizations)}
          hint={sum.suspended > 0 ? t('и ещё в архиве: {n}', { n: formatInt(sum.suspended) }) : t('организации без архива')}
          icon={<Icon name="guests" />}
          testId="platform-kpi-organizations"
        />
        <Stat
          label={t('Работают')}
          value={formatInt(sum.active)}
          hint={t('оплата получена')}
          icon={<Icon name="check" />}
          testId="platform-kpi-active"
        />
        <Stat
          label={t('Пробный период')}
          value={formatInt(sum.trial)}
          icon={<Icon name="clock" />}
          testId="platform-kpi-trial"
        />
        <Stat
          label={t('Только чтение')}
          value={formatInt(sum.readOnly)}
          hint={t('ждут оплаты')}
          icon={<Icon name="lock" />}
          testId="platform-kpi-read-only"
        />
        <Stat
          label={t('Активные пользователи')}
          value={formatInt(sum.activeUsers)}
          hint={t('из {n}, входили за 30 дней', { n: formatInt(sum.usersTotal) })}
          icon={<Icon name="person" />}
          testId="platform-kpi-active-users"
        />
        <Stat
          label={t('Новые подключения')}
          value={formatInt(sum.newLast30d)}
          hint={t('за 30 дней')}
          icon={<Icon name="plus" />}
          testId="platform-kpi-new"
        />
      </Stats>
      <Panel title={t('Рост количества клиентов')}>
        <DayBars testId="platform-growth" today={today} days={growthBars(view.growth, t, locale)} />
        <p className="muted">{t('Подключения по месяцам за год; высота столбика: всего организаций к концу месяца.')}</p>
      </Panel>
      {/* кольцу с легендой нужно около 400 px: при трёх панелях в ряд рядом с левой колонкой подписи обрезались */}
      <Grid min={400}>
        {view.verticals.length > 0 && (
          <Panel title={t('Клиенты по направлениям')}>
            <DonutShare
              testId="platform-verticals"
              items={view.verticals.map((v) => ({
                label: t(PLATFORM_VERTICAL_LABEL[v.vertical]),
                valueMinor: String(v.organizations),
              }))}
              centerValue={formatInt(view.verticals.reduce((n, v) => n + v.organizations, 0))}
              centerLabel={t('клиентов')}
              amount={count}
            />
            <p className="muted">{t('Действующие организации по направлению их первого бизнеса.')}</p>
          </Panel>
        )}
        {view.statuses.length > 0 && (
          <Panel title={t('Статус клиентов')}>
            <DonutShare
              testId="platform-statuses"
              items={view.statuses.map((s) => ({
                label: t(PLATFORM_STATUS_LABEL[s.status] ?? s.status),
                valueMinor: String(s.organizations),
              }))}
              centerValue={formatInt(view.statuses.reduce((n, s) => n + s.organizations, 0))}
              centerLabel={t('всего')}
              amount={count}
            />
          </Panel>
        )}
      </Grid>
      <Notice tone="muted" data-testid="platform-no-billing">
        {t(
          'Подписки и выручка платформы здесь не считаются: платежи принимаются счётом, оплату подтверждает главный администратор в карточке организации. MRR, пакеты и просрочки появятся вместе с биллингом.',
        )}
      </Notice>
    </section>
  );
}

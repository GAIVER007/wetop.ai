import { unstable_rethrow } from 'next/navigation';
import { can } from '@pms/domain';
import { businessMarketApi, type BusinessAvailability, type BusinessMarketView } from '../../../lib/api';
import { requireFeature } from '../../../lib/vertical-guard';
import { deskShell } from '../../../lib/desk-shell';
import { loadErrorProps } from '../../../lib/load-error';
import { displayDate, displayDay } from '../../../lib/display-date';
import { countLabel, intlLocale, msg } from '../../../i18n';
import { dateFormat } from '../../../i18n/dates';
import { currentLocale, serverT } from '../../../i18n/server';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { Icon } from '../../../components/icon';
import { Badge, EmptyState, Grid as AutoGrid, SectionTitle, Stat, Table, cx } from '../../../components/ui';
import { BusinessCompetitorButton, SnapshotCell } from './parts';
import '../../directory.css';
import '../market.css';

const LEVEL: Record<BusinessAvailability, { word: string; tone: 'high' | 'mid' | 'low' }> = {
  SOLD_OUT: { word: msg('Нет мест'), tone: 'high' },
  FEW_LEFT: { word: msg('Мало мест'), tone: 'mid' },
  AVAILABLE: { word: msg('Есть места'), tone: 'low' },
};

/** Фразы по направлению целиком: падеж «ресторана» или «салона» внутри фразы, перевод у каждой своей */
const WORDS = {
  FOOD_SERVICE: {
    nameLabel: msg('Название ресторана'),
    linkLabel: msg('Ссылка на онлайн-бронь столов'),
    subtitle: msg('Смотрите, когда у соседних ресторанов всё занято: тогда можно поднять цену, а когда пусто, пора акция.'),
    step: msg('название и ссылку на его онлайн-бронь столов'),
    slots: msg('вручную или сборщиком: свободные столы на каждый день'),
    intro: msg('Три-пять ресторанов рядом с вами.'),
  },
  BEAUTY: {
    nameLabel: msg('Название салона'),
    linkLabel: msg('Ссылка на онлайн-запись'),
    subtitle: msg('Смотрите, когда у соседних салонов всё занято: тогда можно поднять цену, а когда пусто, пора акция.'),
    step: msg('название и ссылку на его онлайн-запись'),
    slots: msg('вручную или сборщиком: свободные окна записи на каждый день'),
    intro: msg('Три-пять салонов рядом с вами.'),
  },
} as const;

/**
 * «Конкуренты» салона и ресторана (DATA_MODEL §60, план `plans/2026-10-23-competitors-business-manual.md`): загрузка
 * соседей по дням, как «Анализ конкурентов» гостиницы, но по свободным окнам записи или столам. Чисел не придумываем:
 * нет снимка, клетка «нет данных». Сборщик пишет снимки сам после подключения; до тех пор их вносит человек.
 */
export default async function BusinessMarketPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const me = await requireFeature('/market/business');
  const vertical = me.context?.vertical === 'FOOD_SERVICE' ? 'FOOD_SERVICE' : 'BEAUTY';
  const t = await serverT();
  const locale = await currentLocale();
  const il = intlLocale(locale);
  const weekday = dateFormat(il, { timeZone: 'UTC', weekday: 'short' });
  const w = WORDS[vertical];
  const words = { nameLabel: w.nameLabel, linkLabel: w.linkLabel };
  const sp = await searchParams;
  const days = sp.days === '14' ? 14 : 7;
  const shell = await deskShell();
  const role = shell.access.role;
  const editable = !shell.readOnly && (role === null || can(role, 'rates'));
  const subtitle = t(w.subtitle);
  let view: BusinessMarketView;
  try {
    view = await businessMarketApi.board({ days });
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page width="wide" title={t('Конкуренты')} subtitle={subtitle}>
        <LoadError testId="bm-error" {...loadErrorProps(error)} />
      </Page>
    );
  }
  const { board } = view;
  const empty = board.competitors.length === 0;
  const archived = view.competitors.filter((c) => !c.active);
  return (
    <Page
      width="wide"
      title={t('Конкуренты')}
      subtitle={subtitle}
      actions={editable && !empty ? <BusinessCompetitorButton words={words} /> : undefined}
    >
      {empty ? (
        <EmptyState
          icon={<Icon name="analytics" />}
          title={t('Добавьте ближайших конкурентов')}
          data-testid="bm-empty"
          details={
            <AutoGrid min={180} role="list" className="market-steps">
              <div role="listitem">
                <strong>{t('Добавьте соседа')}</strong>
                {t(w.step)}
              </div>
              <div role="listitem">
                <strong>{t('Загрузка обновляется')}</strong>
                {t(w.slots)}
              </div>
              <div role="listitem">
                <strong>{t('WETOP подсказывает')}</strong>
                {t('где у соседей всё занято, цену можно поднять')}
              </div>
            </AutoGrid>
          }
          actions={editable ? <BusinessCompetitorButton primary words={words} /> : undefined}
        >
          {t(w.intro)}{' '}
          {!editable && t('Добавлять конкурентов могут владелец и управляющий.')}
        </EmptyState>
      ) : (
        <>
          <div className="market-tiles" data-testid="bm-tiles">
            <Stat
              label={t('Конкурентов')}
              value={String(board.summary.competitors)}
              hint={t('с данными {n}', { n: board.summary.withData })}
            />
            <Stat
              label={t('Дней, когда рынок почти полон')}
              value={String(board.summary.fullDays)}
              hint={t('из {days}', {
                days: countLabel(locale, t, board.days.length, [msg('дня'), msg('дней'), msg('дней')]),
              })}
              tone={board.summary.fullDays > 0 ? 'warning' : 'neutral'}
            />
            <Stat
              label={t('Данные от')}
              value={board.summary.lastObservedOn ? displayDay(board.summary.lastObservedOn) : '–'}
              hint={board.summary.lastObservedOn ? t('последний снимок') : t('снимков пока нет')}
            />
          </div>
          <section className="market-grid" aria-labelledby="bm-grid-title">
            <SectionTitle id="bm-grid-title">
              {t('Загрузка соседей по дням ({days})', {
                days: countLabel(locale, t, board.days.length, [msg('день'), msg('дня'), msg('дней')]),
              })}
            </SectionTitle>
            <Table size="sm" density="normal" sticky="column" className="market-table" aria-label={t('Загрузка соседей по дням')} data-testid="bm-table">
              <thead>
                <tr>
                  <th scope="col" className="market-table__name">
                    {t('Конкурент')}
                  </th>
                  {board.days.map((d) => (
                    <th key={d} scope="col" className="market-table__day">
                      <span>{weekday.format(new Date(`${d}T00:00:00Z`))}</span>
                      {displayDate(d, 'short', il)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {board.competitors.map((c) => {
                  const full = view.competitors.find((x) => x.id === c.id);
                  return (
                    <tr key={c.id} data-testid={`bm-row-${c.id}`}>
                      <th scope="row" className="market-table__name">
                        <span className="market-name">
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noreferrer noopener">
                              {c.name}
                            </a>
                          ) : (
                            c.name
                          )}
                          <Badge tone="neutral">{c.platform ?? t('вручную')}</Badge>
                          {editable && full && <BusinessCompetitorButton competitor={full} words={words} />}
                        </span>
                        <span className="market-sub">
                          {[
                            c.distanceM !== null ? t('{n} м', { n: c.distanceM }) : null,
                            c.lastObservedOn
                              ? t('данные от {date}', { date: displayDay(c.lastObservedOn) })
                              : t('данных нет'),
                          ]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </th>
                      {c.cells.map((cell) => {
                        const l = cell.level ? LEVEL[cell.level] : null;
                        return (
                          <SnapshotCell
                            key={cell.day}
                            competitor={c}
                            day={cell.day}
                            level={cell.level}
                            freeSlots={cell.freeSlots}
                            collected={cell.source === 'AI_AGENT'}
                            label={l ? t(l.word) : t('нет данных')}
                            editable={editable}
                            className={cx('market-cell', l && `market-cell--${l.tone}`)}
                          />
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="market-row--market" data-testid="bm-row-market">
                  <th scope="row" className="market-table__name">
                    {t('Рынок')}
                  </th>
                  {board.market.map((m) => (
                    <td key={m.day} className={cx('market-cell', m.full && 'market-cell--high')}>
                      <span className="market-cell__value">{m.withData ? (m.full ? t('почти полон') : t('есть места')) : '–'}</span>
                      {m.withData > 0 && <span className="market-cell__delta">{t('занято {tight} из {total}', { tight: m.tight, total: m.withData })}</span>}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </Table>
          </section>
        </>
      )}
      <p className="market-note" data-testid="bm-source-note">
        {t('Если у соседа в ссылке страница записи Dikidi или брони Restoplace, свободные окна и столы собираются автоматически раз в день (метка «ИИ»). Остальных соседей, в том числе YCLIENTS, вносите вы: нажмите на клетку дня; ваш ввод за сегодня главнее сборщика. Капчи и защиту площадок мы не обходим.')}
        {archived.length > 0 && ` ${t('Убрано из списка: {n}.', { n: archived.length })}`}
      </p>
    </Page>
  );
}

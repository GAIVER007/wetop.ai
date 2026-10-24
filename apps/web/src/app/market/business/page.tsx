import { unstable_rethrow } from 'next/navigation';
import { can } from '@pms/domain';
import { businessMarketApi, type BusinessAvailability, type BusinessMarketView } from '../../../lib/api';
import { requireFeature } from '../../../lib/vertical-guard';
import { deskShell } from '../../../lib/desk-shell';
import { loadErrorProps } from '../../../lib/load-error';
import { displayDate, displayDay } from '../../../lib/display-date';
import { pluralRu } from '../../../lib/plural';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { Icon } from '../../../components/icon';
import { Badge, EmptyState, Grid as AutoGrid, SectionTitle, Stat, Table, cx } from '../../../components/ui';
import { BusinessCompetitorButton, SnapshotCell } from './parts';
import '../../directory.css';
import '../market.css';

const LEVEL: Record<BusinessAvailability, { word: string; tone: 'high' | 'mid' | 'low' }> = {
  SOLD_OUT: { word: 'Нет мест', tone: 'high' },
  FEW_LEFT: { word: 'Мало мест', tone: 'mid' },
  AVAILABLE: { word: 'Есть места', tone: 'low' },
};
const weekday = new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', weekday: 'short' });

/**
 * «Конкуренты» салона и ресторана (DATA_MODEL §60, план `plans/2026-10-23-competitors-business-manual.md`): загрузка
 * соседей по дням, как «Анализ конкурентов» гостиницы, но по свободным окнам записи или столам. Чисел не придумываем:
 * нет снимка, клетка «нет данных». Сборщик пишет снимки сам после подключения; до тех пор их вносит человек.
 */
export default async function BusinessMarketPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const me = await requireFeature('/market/business');
  const vertical = me.context?.vertical === 'FOOD_SERVICE' ? 'FOOD_SERVICE' : 'BEAUTY';
  const words =
    vertical === 'FOOD_SERVICE'
      ? { place: 'ресторана', link: 'онлайн-бронь столов', slots: 'свободные столы', neighbours: 'ресторанов' }
      : { place: 'салона', link: 'онлайн-запись', slots: 'свободные окна записи', neighbours: 'салонов' };
  const sp = await searchParams;
  const days = sp.days === '14' ? 14 : 7;
  const shell = await deskShell();
  const role = shell.access.role;
  const editable = !shell.readOnly && (role === null || can(role, 'rates'));
  const subtitle = `Смотрите, когда у соседних ${words.neighbours} всё занято: тогда можно поднять цену, а когда пусто, пора акция.`;
  let view: BusinessMarketView;
  try {
    view = await businessMarketApi.board({ days });
  } catch (error) {
    unstable_rethrow(error);
    return (
      <Page width="wide" title="Конкуренты" subtitle={subtitle}>
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
      title="Конкуренты"
      subtitle={subtitle}
      actions={editable && !empty ? <BusinessCompetitorButton words={words} /> : undefined}
    >
      {empty ? (
        <EmptyState
          icon={<Icon name="analytics" />}
          title="Добавьте ближайших конкурентов"
          data-testid="bm-empty"
          details={
            <AutoGrid min={180} role="list" className="market-steps">
              <div role="listitem">
                <strong>Добавьте соседа</strong>
                название и ссылку на его {words.link}
              </div>
              <div role="listitem">
                <strong>Загрузка обновляется</strong>
                вручную или сборщиком: {words.slots} на каждый день
              </div>
              <div role="listitem">
                <strong>WETOP подсказывает</strong>
                где у соседей всё занято, цену можно поднять
              </div>
            </AutoGrid>
          }
          actions={editable ? <BusinessCompetitorButton primary words={words} /> : undefined}
        >
          Три-пять {words.neighbours} рядом с вами.{' '}
          {!editable && 'Добавлять конкурентов могут владелец и управляющий.'}
        </EmptyState>
      ) : (
        <>
          <div className="market-tiles" data-testid="bm-tiles">
            <Stat label="Конкурентов" value={String(board.summary.competitors)} hint={`с данными ${board.summary.withData}`} />
            <Stat
              label="Дней, когда рынок почти полон"
              value={String(board.summary.fullDays)}
              hint={`из ${pluralRu(board.days.length, ['дня', 'дней', 'дней'])}`}
              tone={board.summary.fullDays > 0 ? 'warning' : 'neutral'}
            />
            <Stat
              label="Данные от"
              value={board.summary.lastObservedOn ? displayDay(board.summary.lastObservedOn) : '–'}
              hint={board.summary.lastObservedOn ? 'последний снимок' : 'снимков пока нет'}
            />
          </div>
          <section className="market-grid" aria-labelledby="bm-grid-title">
            <SectionTitle id="bm-grid-title">
              Загрузка соседей по дням ({pluralRu(board.days.length, ['день', 'дня', 'дней'])})
            </SectionTitle>
            <Table size="sm" density="normal" sticky="column" className="market-table" aria-label="Загрузка соседей по дням" data-testid="bm-table">
              <thead>
                <tr>
                  <th scope="col" className="market-table__name">
                    Конкурент
                  </th>
                  {board.days.map((d) => (
                    <th key={d} scope="col" className="market-table__day">
                      <span>{weekday.format(new Date(`${d}T00:00:00Z`))}</span>
                      {displayDate(d)}
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
                          <Badge tone="neutral">{c.platform ?? 'вручную'}</Badge>
                          {editable && full && <BusinessCompetitorButton competitor={full} words={words} />}
                        </span>
                        <span className="market-sub">
                          {[c.distanceM !== null ? `${c.distanceM} м` : null, c.lastObservedOn ? `данные от ${displayDay(c.lastObservedOn)}` : 'данных нет']
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
                            label={l ? l.word : 'нет данных'}
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
                    Рынок
                  </th>
                  {board.market.map((m) => (
                    <td key={m.day} className={cx('market-cell', m.full && 'market-cell--high')}>
                      <span className="market-cell__value">{m.withData ? (m.full ? 'почти полон' : 'есть места') : '–'}</span>
                      {m.withData > 0 && <span className="market-cell__delta">занято {m.tight} из {m.withData}</span>}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </Table>
          </section>
        </>
      )}
      <p className="market-note" data-testid="bm-source-note">
        Если у соседа в ссылке страница записи Dikidi или брони Restoplace, свободные окна и столы собираются
        автоматически раз в день (метка «ИИ»). Остальных соседей, в том числе YCLIENTS, вносите вы: нажмите на клетку
        дня; ваш ввод за сегодня главнее сборщика. Капчи и защиту площадок мы не обходим.
        {archived.length > 0 && ` Убрано из списка: ${archived.length}.`}
      </p>
    </Page>
  );
}

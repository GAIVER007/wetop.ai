import Link from 'next/link';
import { HOUSEKEEPING_RU } from '@pms/domain';
import { type Chessboard, type DeskDay } from '../../lib/api';
import { blockTypeLabel } from '../../lib/block-types';
import { pluralRu } from '../../lib/plural';
import { Icon } from '../../components/icon';
import { Alert, Fact, Grid, Panel } from '../../components/ui';

/** Блокировки, которые означают «с ячейкой что-то не так», а не решение управляющего (план A2 §3.3) */
const REPAIR = ['MAINTENANCE', 'OUT_OF_ORDER'];
const REPAIR_ROWS = 3;

/*
 * Уборка — текущее состояние ячейки, а не история по датам: на завтра или вчера числа «не готово»
 * не существует, и выдумывать его нельзя (план A2 §3.2). Поэтому на другой день — только подпись.
 */
const TODAY_ONLY = 'уборка — только на сегодня';

/** Слова домена пишутся со строчной — в подписи факта первая буква заглавная, как у соседних */
const capital = (word: string) => word.charAt(0).toLocaleUpperCase('ru') + word.slice(1);

function BoardFailed({ testId }: { testId: string }) {
  return (
    <Alert tone="warning" boxed data-testid={testId}>
      Календарь дня не загрузился. Обновите страницу.
    </Alert>
  );
}

/** Номерной фонд дня (A2, план `plans/today-a2-2026-09-28.md` §3.2): уже загруженная шахматка, новых вызовов нет */
export function FundPanel({
  day,
  board,
  isToday,
}: {
  day: DeskDay;
  board: Chessboard | null;
  isToday: boolean;
}) {
  const s = board?.summary[day.date];
  if (!board || !s)
    return (
      <Panel title="Номерной фонд" aria-label="Номерной фонд">
        <BoardFailed testId="fund-error" />
      </Panel>
    );
  const notReady = board.rows.filter(
    (r) => r.unit.housekeepingStatus && r.unit.housekeepingStatus !== 'INSPECTED',
  );
  // Ячейки, куда сегодня заезжают, а уборка ещё не «проверено»
  const arrivingUnits = new Set(
    day.arrivals
      .filter((r) => r.status === 'CONFIRMED' || r.status === 'TENTATIVE')
      .map((r) => r.unitCode)
      .filter((code): code is string => code !== null),
  );
  const prepare = notReady.filter((r) => arrivingUnits.has(r.unit.code)).length;
  // Имена категорий — из строк шахматки, в её порядке
  const names = new Map<string, string>();
  for (const r of board.rows) names.set(r.unit.accommodationTypeCode, r.unit.accommodationTypeName);
  const byCategory = board.byCategory[day.date] ?? {};
  return (
    <Panel title="Номерной фонд" aria-label="Номерной фонд" className="fund-panel">
      <Grid min={96} gap="sm">
        <Fact label="Занято" value={s.occupied} testId="fund-occupied" />
        <Fact label="Свободно" value={s.free} testId="fund-free" />
        <Fact label="Заблокировано" value={s.blocked} testId="fund-blocked" />
        {isToday && <Fact label="Не готово" value={notReady.length} testId="fund-not-ready" />}
      </Grid>
      {isToday && prepare > 0 && (
        <p className="fund-prepare" data-testid="fund-prepare">
          {pluralRu(prepare, ['ячейку', 'ячейки', 'ячеек'])} нужно подготовить до заезда
        </p>
      )}
      <ul className="fund-categories" data-testid="fund-categories">
        {[...names].map(([code, name]) => {
          const c = byCategory[code];
          if (!c) return null;
          return (
            <li key={code}>
              {name} {c.occupied}/{c.units}
            </li>
          );
        })}
      </ul>
      <div className="fund-footer">
        {!isToday && <span>{TODAY_ONLY}</span>}
        <Link className="card-heading__link" href={`/chessboard?from=${day.date}&to=${day.date}`}>
          Календарь
          <Icon name="chevron" width={14} />
        </Link>
      </div>
    </Panel>
  );
}

/** Уборка и ремонт (A2, план §3.3): три числа уборки словами домена и блокировки ремонта дня */
export function CarePanel({
  date,
  board,
  isToday,
}: {
  date: string;
  board: Chessboard | null;
  isToday: boolean;
}) {
  if (!board)
    return (
      <Panel title="Уборка и неисправности" aria-label="Уборка и неисправности">
        <BoardFailed testId="care-error" />
      </Panel>
    );
  const count = (status: keyof typeof HOUSEKEEPING_RU) =>
    board.rows.filter((r) => r.unit.housekeepingStatus === status).length;
  const repairs = board.rows.flatMap((r) => {
    const cell = r.cells.find((c) => c.date === date);
    return cell?.blockType && REPAIR.includes(cell.blockType)
      ? [{ code: r.unit.code, type: cell.blockType, reason: cell.blockReason ?? null }]
      : [];
  });
  return (
    <Panel title="Уборка и неисправности" aria-label="Уборка и неисправности" className="fund-panel">
      {isToday ? (
        <Grid min={96} gap="sm">
          <Fact label={capital(HOUSEKEEPING_RU.DIRTY)} value={count('DIRTY')} testId="housekeeping-dirty" />
          <Fact label={capital(HOUSEKEEPING_RU.CLEAN)} value={count('CLEAN')} testId="housekeeping-clean" />
          {/* «проверено, доступна» домена — о ячейке; у числа ячеек хватает первого слова */}
          <Fact label="Проверено" value={count('INSPECTED')} testId="housekeeping-inspected" />
        </Grid>
      ) : (
        <p className="fund-note">{TODAY_ONLY}</p>
      )}
      <div className="fund-repairs">
        <span className="fund-repairs__head">
          Ремонт и снятые с продажи: <strong data-testid="repair-count">{repairs.length}</strong>
        </span>
        {repairs.length > 0 && (
          <ul>
            {repairs.slice(0, REPAIR_ROWS).map((r) => (
              <li key={r.code}>
                <span className="day-event__unit">{r.code}</span>
                <span>{blockTypeLabel(r.type)}</span>
                {r.reason && <span className="fund-repairs__reason">{r.reason}</span>}
              </li>
            ))}
            {repairs.length > REPAIR_ROWS && <li>ещё {repairs.length - REPAIR_ROWS}</li>}
          </ul>
        )}
      </div>
      <div className="fund-footer">
        <Link className="card-heading__link" href={`/chessboard?from=${date}&to=${date}`}>
          Календарь
          <Icon name="chevron" width={14} />
        </Link>
      </div>
    </Panel>
  );
}


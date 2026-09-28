import Link from 'next/link';
import { guardApi, sellerApi, type GuardStatus, type SellerStatus } from '../../lib/api';
import { Panel, type BadgeTone } from '../../components/ui';
import { ChannexSystemRow } from './systems-channex';
import { SystemRow } from './systems-row';

/** Строка, которая не ответила или закрыта для роли, просто не рисуется: остальные на месте */
const quiet = <T,>(p: Promise<T>): Promise<T | null> => p.catch(() => null);

/**
 * Системы (A2, план `plans/today-a2-2026-09-28.md` §3.5): по строке на систему, состояние словом.
 * Подробности — в разделах по ссылкам. Channex — из опроса свежести оболочки (своего запроса нет, бюджет
 * экрана — десять рейсов). Строки «Сайт» нет: данных о здоровье сайта у стойки нет (пробел плана).
 */
export async function SystemsToday() {
  const [seller, guard] = await Promise.all([quiet(sellerApi.status()), quiet(guardApi.status())]);
  return (
    <Panel title="Системы" aria-label="Системы" className="fund-panel">
      <ul className="systems-list">
        <ChannexSystemRow />
        {seller && (
          <SystemRow name="ИИ-продавец" testId="systems-seller" href="/ai-seller" {...sellerState(seller)} />
        )}
        {guard && (
          <SystemRow
            name="Копии базы и сторож"
            testId="systems-guard"
            {...guardState(guard)}
            details={[
              guard.lastTick?.checked.includes('backup.stale')
                ? 'копии под наблюдением сторожа'
                : 'проверка копий не настроена',
              <Link key="incidents" href="/incidents">
                открытых инцидентов: {guard.open.total}
              </Link>,
            ]}
          />
        )}
      </ul>
    </Panel>
  );
}

function sellerState(s: SellerStatus): { word: string; tone: BadgeTone } {
  if (s.state === 'extension-off') return { word: 'расширение не подключено', tone: 'neutral' };
  if (s.state === 'extension-expired') return { word: 'срок расширения вышел', tone: 'warn' };
  if (s.state === 'not-configured') return { word: 'не подключён', tone: 'neutral' };
  if (s.lastError) return { word: 'ошибка', tone: 'warn' };
  return { word: 'работает', tone: 'ok' };
}

function guardState(g: GuardStatus): { word: string; tone: BadgeTone } {
  if (!g.running) return { word: 'сторож не запущен', tone: 'warn' };
  if (g.open.critical > 0) return { word: 'есть критичные', tone: 'warn' };
  return { word: 'работает', tone: 'ok' };
}

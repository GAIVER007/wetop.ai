import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { ApiError, marketingAdsApi, type MarketingAdLaunchView } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { formatMoney } from '../../../lib/money';
import type { PropertyClock } from '../../../lib/property-time';
import { LoadError } from '../../../components/load-error';
import { Badge, EmptyState, Table, type BadgeTone } from '../../../components/ui';
import { ChooseLocation } from '../budget/parts';

/**
 * Последние запуски ИИ-таргетолога филиала (DATA_MODEL §57): только чтение существующего `GET /marketing/ads/launches`
 * (последние 20, новые сверху), чтобы вернуться к незавершённому или неудачному запуску после ухода с его адреса.
 * Не зависит от подключения кабинета: история нужна и после отключения. Новых запусков и повторов здесь нет.
 */
export type LaunchesLoaded =
  | { launches: MarketingAdLaunchView[] }
  | { chooseLocation: true }
  | { error: ReturnType<typeof loadErrorProps> };

export async function loadLaunches(): Promise<LaunchesLoaded> {
  try {
    return { launches: await marketingAdsApi.launches() };
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ApiError && e.status === 409) return { chooseLocation: true };
    return { error: loadErrorProps(e) };
  }
}

const OUTCOME: Record<MarketingAdLaunchView['status'], { label: string; tone: BadgeTone }> = {
  RUNNING: { label: 'Идёт', tone: 'info' },
  SUCCEEDED: { label: 'Запущена', tone: 'ok' },
  FAILED: { label: 'Не удался', tone: 'danger' },
};

export function AdLaunches({ loaded, clock }: { loaded: LaunchesLoaded; clock: PropertyClock }) {
  return (
    <section className="panel" aria-labelledby="ad-launches-title" data-testid="ad-launches">
      <h2 id="ad-launches-title" className="budget-files__title">
        Последние запуски с ИИ
      </h2>
      {'chooseLocation' in loaded ? (
        <ChooseLocation />
      ) : 'error' in loaded ? (
        <LoadError testId="ad-launches-error" {...loaded.error} />
      ) : loaded.launches.length === 0 ? (
        <EmptyState title="Запусков пока нет" data-testid="ad-launches-empty">
          Здесь появятся кампании, запущенные мастером «Новая кампания с ИИ», с их итогом.
        </EmptyState>
      ) : (
        <div className="tbl-wrap" role="region" aria-label="Запуски с ИИ" tabIndex={0}>
          <Table density="normal" aria-label="Последние 20 запусков филиала">
            <thead>
              <tr>
                <th scope="col">Объявление</th>
                <th scope="col">Итог</th>
                <th scope="col" className="budget-td-num">Бюджет в день</th>
                <th scope="col">Начат</th>
              </tr>
            </thead>
            <tbody>
              {loaded.launches.map((l) => (
                <tr key={l.id} data-testid={`ad-launch-row-${l.id}`}>
                  <td>
                    <Link href={`/marketing/ads/launch/${l.id}`} aria-label={`Открыть запуск ${l.headline}`}>
                      {l.headline}
                    </Link>
                  </td>
                  <td>
                    <Badge tone={OUTCOME[l.status].tone}>{OUTCOME[l.status].label}</Badge>
                  </td>
                  <td className="budget-td-num">{formatMoney(l.dailyBudgetMinor, l.currency)}</td>
                  <td>{clock.moment(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      )}
    </section>
  );
}

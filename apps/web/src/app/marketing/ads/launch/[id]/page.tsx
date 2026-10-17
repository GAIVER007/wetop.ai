import Link from 'next/link';
import { notFound, unstable_rethrow } from 'next/navigation';
import { ApiError, marketingAdsApi, type MarketingAdLaunchView } from '../../../../../lib/api';
import { loadErrorProps } from '../../../../../lib/load-error';
import { formatMoney } from '../../../../../lib/money';
import { requireFeature } from '../../../../../lib/vertical-guard';
import '../../../marketing.css';
import '../launch.css';
import { Icon } from '../../../../../components/icon';
import { LoadError } from '../../../../../components/load-error';
import { Page } from '../../../../../components/page';
import { Alert, Badge } from '../../../../../components/ui';
import { RefreshWhileRunning } from './refresh';

/**
 * Шаги запуска кампании в Meta (DATA_MODEL §57): что создано, на каком шаге остановилось и почему. Пока запуск идёт,
 * страница обновляется сама раз в 2 секунды.
 */
const STEPS: Array<{ step: MarketingAdLaunchView['step']; label: string }> = [
  { step: 'MEDIA', label: 'Фото загружено в Meta' },
  { step: 'CAMPAIGN', label: 'Кампания создана' },
  { step: 'ADSET', label: 'Аудитория и бюджет заданы' },
  { step: 'CREATIVE', label: 'Объявление собрано' },
  { step: 'AD', label: 'Объявление отправлено на проверку Meta' },
];
const ORDER = ['MEDIA', 'CAMPAIGN', 'ADSET', 'CREATIVE', 'AD', 'DONE'];

export default async function AdLaunchStatusPage({ params }: { params: Promise<{ id: string }> }) {
  await requireFeature('/marketing/ads/launch');
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let launch: MarketingAdLaunchView | null = null;
  let failure: ReturnType<typeof loadErrorProps> | null = null;
  try {
    launch = await marketingAdsApi.launch(id);
  } catch (e) {
    unstable_rethrow(e);
    if (e instanceof ApiError && e.status === 404) notFound();
    failure = loadErrorProps(e);
  }
  const at = launch ? ORDER.indexOf(launch.step) : 0;
  return (
    <Page
      crumbs={
        <Link href="/marketing/ads" className="marketing-back">
          <Icon name="back" width={16} aria-hidden="true" />
          Назад к рекламе
        </Link>
      }
      title="Запуск кампании"
      subtitle={launch ? `${launch.headline}, до ${formatMoney(launch.dailyBudgetMinor, launch.currency)} в день` : undefined}
    >
      <div className="marketing-screen" data-testid="ad-launch-status">
        {failure && <LoadError testId="ad-status-error" {...failure} />}
        {launch && (
          <section className="panel" aria-labelledby="ad-steps-title">
            <h2 id="ad-steps-title" className="budget-files__title">
              {launch.status === 'SUCCEEDED' ? 'Кампания запущена' : launch.status === 'FAILED' ? 'Запуск не удался' : 'Запускаю…'}
            </h2>
            <ol className="ad-steps" data-testid="ad-steps">
              {STEPS.map((s, i) => {
                const done = launch.status === 'SUCCEEDED' || i < at;
                return (
                  <li key={s.step} className="ad-steps__item" data-state={done ? 'done' : 'wait'}>
                    <Badge tone={done ? 'ok' : undefined}>{done ? 'Готово' : launch.status === 'FAILED' && i === at ? 'Ошибка' : 'Ждёт'}</Badge>
                    {s.label}
                  </li>
                );
              })}
            </ol>
            {launch.status === 'SUCCEEDED' && (
              <p className="settings-note" data-testid="ad-launch-done">
                Meta проверит объявление, обычно до суток, и начнёт показы. Статистика придёт ночной сверкой на «Рекламу»;
                остановить кампанию можно там же.
              </p>
            )}
            {launch.status === 'FAILED' && (
              <Alert boxed data-testid="ad-launch-failed">
                {launch.error}
              </Alert>
            )}
            {launch.status === 'RUNNING' && <RefreshWhileRunning />}
          </section>
        )}
      </div>
    </Page>
  );
}

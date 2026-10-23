import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { can } from '@pms/domain';
import { ApiError, marketingAdsApi, type MarketingAdAssets, type MarketingAudienceSettings } from '../../../../lib/api';
import { normalizeSearchParams, type SearchParams } from '../../../../lib/search-params';
import { deskShell } from '../../../../lib/desk-shell';
import { loadErrorProps } from '../../../../lib/load-error';
import { requireFeature } from '../../../../lib/vertical-guard';
import '../../marketing.css';
import '../../budget/budget.css';
import './launch.css';
import { Icon } from '../../../../components/icon';
import { LoadError } from '../../../../components/load-error';
import { Page } from '../../../../components/page';
import { EmptyState } from '../../../../components/ui';
import { ChooseLocation } from '../../budget/parts';
import { LaunchWizard } from './wizard';

/**
 * «Реклама → Новая кампания с ИИ» (DATA_MODEL §57, ADR-MKT-LAUNCH): мастер запуска в подключённом кабинете Meta.
 * Право `ads_launch`; без кабинета мастер ведёт на подключение. Страна показа: Казахстан, как у филиалов WETOP.
 */
const COUNTRY = 'KZ';

function Back() {
  return (
    <Link href="/marketing/ads" className="marketing-back">
      <Icon name="back" width={16} aria-hidden="true" />
      Назад к рекламе
    </Link>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AdLaunchPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireFeature('/marketing/ads/launch');
  const q = normalizeSearchParams(await searchParams);
  const shell = await deskShell();
  const role = shell.access.role;
  const allowed = !shell.readOnly && (role === null || can(role, 'ads_launch'));
  let content;
  if (!allowed) {
    content = (
      <EmptyState title="Запуск рекламы недоступен" data-testid="ad-launch-denied">
        Запускать и останавливать рекламу могут владелец и управляющий.
      </EmptyState>
    );
  } else {
    let assets: MarketingAdAssets | null = null;
    let failure: ReturnType<typeof loadErrorProps> | null = null;
    let chooseLocation = false;
    // «Запустить снова» из «Аудиторий»: аудитория прошлого запуска; не нашлась, мастер просто пустой
    let audience: MarketingAudienceSettings | null = null;
    try {
      assets = await marketingAdsApi.assets();
      const id = q['audience'];
      if (id && UUID.test(id)) audience = await marketingAdsApi.audienceOf(id).catch(() => null);
    } catch (e) {
      unstable_rethrow(e);
      if (e instanceof ApiError && e.status === 409) chooseLocation = true;
      else failure = loadErrorProps(e);
    }
    content = chooseLocation ? (
      <ChooseLocation />
    ) : failure ? (
      <LoadError testId="ad-launch-error" {...failure} />
    ) : !assets?.connected ? (
      <EmptyState title="Кабинет Meta не подключён" data-testid="ad-launch-no-cabinet">
        Подключите рекламный кабинет через Facebook на странице «Реклама», затем возвращайтесь к запуску.
      </EmptyState>
    ) : (
      <LaunchWizard assets={assets} country={COUNTRY} audience={audience} />
    );
  }
  return (
    <Page
      crumbs={<Back />}
      title="Новая кампания с ИИ"
      subtitle="Фото и пара фраз: ИИ предложит текст и аудиторию, вы проверите и запустите в Meta."
    >
      <div className="marketing-screen" data-testid="ad-launch-screen">
        {content}
      </div>
    </Page>
  );
}

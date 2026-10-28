import { unstable_rethrow } from 'next/navigation';
import { LoadError } from '../../../components/load-error';
import { Icon } from '../../../components/icon';
import { EmptyState } from '../../../components/ui';
import { ApiError, platformApi } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import type { Translate } from '../../../i18n';

/** Деньги компании за месяц для страниц кабинета; отказ 403 и сбой связи готовым блоком */
export async function loadMoney(month: string, t: Translate) {
  try {
    return { view: await platformApi.money(month), error: null };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ApiError && error.status === 403)
      return {
        view: null,
        error: (
          <EmptyState
            icon={<Icon name="shield" width={32} height={32} />}
            title={t('Раздел главного администратора платформы')}
            data-testid="cabinet-forbidden"
          >
            {t('Кабинет компании видит только главный администратор.')}
          </EmptyState>
        ),
      };
    return { view: null, error: <LoadError testId="cabinet-error" {...loadErrorProps(error)} /> };
  }
}

export function NotReady({ t }: { t: Translate }) {
  return (
    <EmptyState
      icon={<Icon name="settings" width={32} height={32} />}
      title={t('Деньги компании ещё не подключены')}
      data-testid="money-not-ready"
    >
      {t(
        'Нужно применить обновление базы. После этого здесь появятся доход, расходы, подписки и команда.',
      )}
    </EmptyState>
  );
}

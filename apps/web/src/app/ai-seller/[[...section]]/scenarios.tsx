import Link from 'next/link';
import { Badge, Panel, SectionTitle, Table } from '../../../components/ui';
import { sellerBanner, sellerVerticalUiCopy } from '../../../lib/ai-seller';
import type { SellerStatus } from '../../../lib/api';
import type { WebVertical } from '../../../lib/vertical-landing';
import { translator, type Translate } from '../../../i18n';

/**
 * «Сценарии» ИИ-продавца (макет владельца 09.10.2026). Работает один сценарий, «Продажи»: его инструкция и знания
 * правятся на соседних вкладках. Остальные показаны как готовящиеся и не включаются; конструктор поведения (свои
 * сценарии, шаги, условия) ждёт отдельного решения владельца (SA3), поэтому здесь его нет.
 */
export function ScenariosView({
  status,
  vertical = 'HOSPITALITY',
  t = translator('ru'),
}: {
  status: SellerStatus;
  vertical?: WebVertical;
  /** Перевод страницы (серверный компонент без своего `serverT`: его рендерит и unit-тест) */
  t?: Translate;
}) {
  const banner = sellerBanner(status);
  const copy = sellerVerticalUiCopy(vertical);
  const salesTone = banner.tone === 'calm' ? 'ok' : banner.tone === 'alarm' ? 'danger' : 'warn';
  return (
    <Panel aria-labelledby="seller-scenarios-title" data-testid="seller-scenarios">
      <SectionTitle first id="seller-scenarios-title">
        {t('Что умеет продавец')}
      </SectionTitle>
      <Table size="sm" aria-label={t('Сценарии продавца')} data-testid="seller-scenarios-table">
        <thead>
          <tr>
            <th scope="col">{t('Сценарий')}</th>
            <th scope="col">{t('Состояние')}</th>
            <th scope="col">{t('Что делает')}</th>
            <th scope="col">{t('Где настроить')}</th>
          </tr>
        </thead>
        <tbody>
          <tr data-testid="seller-scenario-sales">
            <th scope="row">{t('Продажи')}</th>
            <td>
              <Badge tone={salesTone}>{t(banner.value)}</Badge>
            </td>
            <td>
              {t(copy.scenarioSales)}
            </td>
            <td>
              <Link href="/ai-seller">{t('Инструкция')}</Link>, <Link href="/ai-seller/knowledge">{t('знания')}</Link>
            </td>
          </tr>
          <tr data-testid="seller-scenario-support">
            <th scope="row">{t('Поддержка сайта')}</th>
            <td>
              <Badge tone="neutral">{t('скоро')}</Badge>
            </td>
            <td>{t(copy.scenarioSupport)}</td>
            <td>{t('Пока недоступно')}</td>
          </tr>
        </tbody>
      </Table>
      <p className="settings-note">
        {t('Свои сценарии, шаги и условия пока собрать нельзя: конструктор поведения готовится и включится после отдельного решения.')}
      </p>
    </Panel>
  );
}

import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { ApiError, marketingAdsApi, type MarketingAdLibrary } from '../../../lib/api';
import { loadErrorProps } from '../../../lib/load-error';
import { formatMoney } from '../../../lib/money';
import { LoadError } from '../../../components/load-error';
import { Badge, EmptyState, Table } from '../../../components/ui';
import { msg } from '../../../i18n';
import { serverT } from '../../../i18n/server';

/**
 * «Аудитории» и «Креативы» ИИ-таргетолога (23.10.2026, вместо плашки «Скоро»): что уже давало заявки у этого филиала.
 * Только успешные запуски мастера; заявки и расход по дням кабинета Meta. Лучшие сверху по цене заявки. Аудиторию
 * можно взять в новую кампанию: мастер откроется с её городами, возрастом и полом, текст ИИ предложит заново.
 */
export type LibraryLoaded = { library: MarketingAdLibrary } | { error: ReturnType<typeof loadErrorProps> } | { none: true };

export async function loadLibrary(): Promise<LibraryLoaded> {
  try {
    return { library: await marketingAdsApi.library() };
  } catch (e) {
    unstable_rethrow(e);
    // филиал не выбран: о нём уже говорит блок кампаний ниже, второй раз не повторяем
    if (e instanceof ApiError && e.status === 409) return { none: true };
    return { error: loadErrorProps(e) };
  }
}

const money = (minor: string | null, currency: string) => (minor === null ? '–' : formatMoney(minor, currency));
const KIND = { IMAGE: msg('Фото'), VIDEO: msg('Видео') } as const;

export async function AdLibrary({ loaded, launchable }: { loaded: LibraryLoaded; launchable: boolean }) {
  const t = await serverT();
  if ('none' in loaded) return null;
  if ('error' in loaded) return <LoadError testId="ad-library-error" {...loaded.error} />;
  const { audiences, creatives } = loaded.library;
  const empty = (
    <EmptyState title={t('Пока пусто')} data-testid="ad-library-empty">
      {t('Появится после первой кампании, запущенной с ИИ: какие аудитории и креативы дали заявки и по какой цене.')}
    </EmptyState>
  );
  return (
    <div className="ad-library" data-testid="ad-library">
      <section className="panel" aria-labelledby="ad-audiences-title" data-testid="ad-audiences">
        <h2 id="ad-audiences-title" className="budget-files__title">
          {t('Аудитории')}
        </h2>
        {audiences.length === 0 ? (
          empty
        ) : (
          <div className="tbl-wrap" role="region" aria-label={t('Аудитории запусков')} tabIndex={0}>
            <Table density="normal" stack aria-label={t('Аудитории: лучшие сверху по цене заявки')}>
              <thead>
                <tr>
                  <th scope="col">{t('Кому показывали')}</th>
                  <th scope="col" className="budget-td-num">{t('Запусков')}</th>
                  <th scope="col" className="budget-td-num">{t('Заявки')}</th>
                  <th scope="col" className="budget-td-num">{t('Цена заявки')}</th>
                  {launchable && (
                    <th scope="col">
                      <span className="sr-only">{t('Действие')}</span>
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {audiences.map((a, i) => (
                  <tr key={a.key} data-testid="ad-audience-row">
                    <td>
                      <span>
                        {a.label}
                        {i === 0 && a.cplMinor !== null && (
                          <>
                            {' '}
                            <Badge tone="ok">{t('лучшая')}</Badge>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="budget-td-num" data-label={t('Запусков')}>{a.launches}</td>
                    <td className="budget-td-num" data-label={t('Заявки')}>{a.leads}</td>
                    <td className="budget-td-num" data-label={t('Цена заявки')}>{money(a.cplMinor, a.currency)}</td>
                    {launchable && (
                      <td>
                        <Link
                          href={`/marketing/ads/launch?audience=${a.lastLaunchId}`}
                          aria-label={t('Новая кампания на аудиторию: {name}', { name: a.label })}
                          data-testid="ad-audience-use"
                        >
                          {t('Запустить снова')}
                        </Link>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>
      <section className="panel" aria-labelledby="ad-creatives-title" data-testid="ad-creatives">
        <h2 id="ad-creatives-title" className="budget-files__title">
          {t('Креативы')}
        </h2>
        {creatives.length === 0 ? (
          empty
        ) : (
          <div className="tbl-wrap" role="region" aria-label={t('Креативы запусков')} tabIndex={0}>
            <Table density="normal" stack aria-label={t('Креативы: лучшие сверху по цене заявки')}>
              <thead>
                <tr>
                  <th scope="col">{t('Файл')}</th>
                  <th scope="col">{t('Лучший заголовок')}</th>
                  <th scope="col" className="budget-td-num">{t('Заявки')}</th>
                  <th scope="col" className="budget-td-num">{t('Цена заявки')}</th>
                </tr>
              </thead>
              <tbody>
                {creatives.map((c) => (
                  <tr key={`${c.currency}-${c.creativeId}`} data-testid="ad-creative-row">
                    <td>
                      <span>
                        <Badge tone="neutral">{t(KIND[c.kind])}</Badge> {c.fileName}
                      </span>
                    </td>
                    <td data-label={t('Заголовок')}>{c.bestHeadline}</td>
                    <td className="budget-td-num" data-label={t('Заявки')}>{c.leads}</td>
                    <td className="budget-td-num" data-label={t('Цена заявки')}>{money(c.cplMinor, c.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}

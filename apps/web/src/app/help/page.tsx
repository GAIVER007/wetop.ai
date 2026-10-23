import { deskShell } from '../../lib/desk-shell';
import Link from 'next/link';
import { Page } from '../../components/page';
import { hotelApi } from '../../lib/hotel-api';
import { helpSteps, menuSectionsFor } from '../../lib/navigation';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { verticalCopy } from '../../lib/vertical-copy';
import { SupportBlock } from './support-block';
import { serverT } from '../../i18n/server';
import './help.css';

/** Название филиала для начала сообщения в поддержку; оба запроса уже сделал макет (`cache`), новых рейсов нет */
async function branchName(vertical: string): Promise<string | null> {
  if (vertical === 'HOSPITALITY') return (await hotelApi.settings().catch(() => null))?.property.name ?? null;
  return (await selectedWorkspaceBranch().catch(() => null))?.name ?? null;
}

/**
 * «Помощь» одна у всех направлений (решение владельца 19.10.2026): первые шаги строятся из меню направления
 * (`helpSteps`), поэтому совпадают с ним по словам и ссылкам и сами появляются у нового направления. Справка другого
 * направления не показывается: ссылки ведут на экраны своего (F5 плана DS2).
 */
export default async function HelpPage() {
  const { vertical, scopeKey, access } = await deskShell();
  const t = await serverT();
  if (!scopeKey) return (
    <Page title={t('Помощь')} subtitle={t('Выберите филиал')}>
      <p>{t('Выберите филиал, чтобы открыть инструкции для его направления.')}</p>
      <Link href="/branches">{t('Выбрать филиал')}</Link>
      <p>{t('Вход и выход доступны через меню профиля.')}</p>
      <SupportBlock t={t} />
    </Page>
  );
  // Шаг «Персонал» словами направления (P2-7): общий текст меню «тех, кто оказывает услуги» салонный
  const staffHelp = verticalCopy(vertical).staffHelp;
  // шаги строятся по русскому меню (пункт ищется по слову), путь и текст переводятся готовыми (KK1)
  const steps = helpSteps(menuSectionsFor(access, vertical), vertical, t).map((step) => ({
    ...step,
    text: t(step.href === '/employees' ? staffHelp : step.text),
  }));
  const [accessBefore, accessAfter] = t('Доступ сотрудников к WETOP настраивается в разделе {section}.').split('{section}');
  // аудит 21.10.2026 пп. 13, 39: заголовок блока без дубля в подзаголовке, шаги и поддержка в две колонки
  return (
    <Page title={t('Помощь')}>
      <div className="help-columns">
        <section className="panel" aria-labelledby="help-steps-title">
          <h2 id="help-steps-title" className="panel__title">{t('Начало работы')}</h2>
          <ol data-testid="help-steps">
            {steps.map((step) => (
              <li key={step.href}>
                <Link href={step.href}>«{step.path}»</Link>: {step.text}
              </li>
            ))}
          </ol>
          <p>
            {t('Время показывается в часовом поясе филиала.')} {accessBefore}
            <Link href="/team">«{t('Персонал')} → {t(verticalCopy(vertical).menu.team)}»</Link>
            {accessAfter}
          </p>
          <p>
            {t('Если доступ открыт только для просмотра, данные видны, а изменения закрыты. Обратитесь к владельцу организации.')}
          </p>
        </section>
        <SupportBlock branch={await branchName(vertical)} t={t} />
      </div>
    </Page>
  );
}

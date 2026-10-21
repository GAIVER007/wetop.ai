import { deskShell } from '../../lib/desk-shell';
import Link from 'next/link';
import { Page } from '../../components/page';
import { hotelApi } from '../../lib/hotel-api';
import { helpSteps, menuSectionsFor } from '../../lib/navigation';
import { selectedWorkspaceBranch } from '../../lib/workspace-context';
import { SupportBlock } from './support-block';
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
  if (!scopeKey) return (
    <Page title="Помощь" subtitle="Выберите филиал">
      <p>Выберите филиал, чтобы открыть инструкции для его направления.</p>
      <Link href="/branches">Выбрать филиал</Link>
      <p>Вход и выход доступны через меню профиля.</p>
      <SupportBlock />
    </Page>
  );
  const steps = helpSteps(menuSectionsFor(access, vertical), vertical);
  // аудит 21.10.2026 пп. 13, 39: заголовок блока без дубля в подзаголовке, шаги и поддержка в две колонки
  return (
    <Page title="Помощь">
      <div className="help-columns">
        <section className="panel" aria-labelledby="help-steps-title">
          <h2 id="help-steps-title" className="panel__title">Начало работы</h2>
          <ol data-testid="help-steps">
            {steps.map((step) => (
              <li key={step.href}>
                <Link href={step.href}>«{step.path}»</Link>: {step.text}
              </li>
            ))}
          </ol>
          <p>
            Время показывается в часовом поясе филиала. Доступ сотрудников к WETOP настраивается в разделе{' '}
            <Link href="/team">«Персонал → Сотрудники»</Link>.
          </p>
          <p>
            Если доступ открыт только для просмотра, данные видны, а изменения закрыты. Обратитесь к владельцу
            организации.
          </p>
        </section>
        <SupportBlock branch={await branchName(vertical)} />
      </div>
    </Page>
  );
}

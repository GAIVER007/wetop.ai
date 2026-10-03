import Link from 'next/link';
import './beauty.css';
import { Page } from '../../components/page';
import { Panel } from '../../components/ui';
import { branchesApi } from '../../lib/api';
import { currentMe } from '../../lib/desk-shell';

/**
 * Рабочее место салона (DATA_MODEL §19, срез B2, ADR-140). Экран честный: он показывает подключённый филиал
 * и прямо говорит, чего в салоне пока нет. Записи, мастера и услуги появятся срезами B3...B6; обещать их
 * ссылкой, которая никуда не ведёт, нельзя (DESIGN.md §19.9).
 *
 * Ссылки стоят отдельными строками, а не внутри фраз: внутри текста они различались бы только цветом
 * (axe `link-in-text-block`), а подчёркивать их в списке незачем.
 */
const WORKS: Array<{ href: string; label: string; note: string }> = [
  { href: '/team', label: 'Сотрудники', note: 'приглашения, роли, отключение' },
  { href: '/branches', label: 'Организация и филиалы', note: 'все филиалы и переключение между ними' },
  { href: '/journal', label: 'Журнал действий', note: 'кто и что менял' },
];

export default async function BeautyPage() {
  const [me, branches] = await Promise.all([
    currentMe().catch(() => null),
    branchesApi.list().catch(() => null),
  ]);
  const locationId = me?.context?.locationId ?? null;
  const salon =
    branches?.items.find((item) => item.vertical === 'BEAUTY' && item.locationId === locationId) ??
    branches?.items.find((item) => item.vertical === 'BEAUTY') ??
    null;

  return (
    <Page
      className="beauty-page"
      title={salon ? salon.name : 'Салон'}
      subtitle={
        salon
          ? `Филиал подключён. Валюта ${salon.currency}, часовой пояс ${salon.timezone}.`
          : 'Филиал салона в этой организации не найден.'
      }
    >
      <div className="beauty-grid">
        <Panel title="Что уже работает">
          <p className="beauty-text">
            Филиал салона заведён: он живёт в организации рядом с другими направлениями.
          </p>
          <ul className="beauty-list">
            {WORKS.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
                <span className="beauty-note">{item.note}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Чего пока нет">
          <p className="beauty-text">
            Записи клиентов, мастера, услуги и их расписание в салоне ещё не сделаны. Данные под них в базе
            уже есть, экранов нет: они идут следующими срезами. Пока салон не умеет принимать записи, не
            раздавайте ссылку клиентам.
          </p>
          <p className="beauty-text">
            Деньги записи считаются её собственной ценой, а касса салона появится вместе с записями: счёт
            гостиницы к записи не прикладывается (решение по Q-252).
          </p>
        </Panel>
      </div>
    </Page>
  );
}

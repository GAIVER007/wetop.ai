import { normalizeSearchParams, type SearchParams } from '../../lib/search-params';
import Link from 'next/link';
import { api } from '../../lib/api';
import { Page } from '../../components/page';
import { SectionTitle, Stat, Stats, Table } from '../../components/ui';

/** Slice 1, шаг 7: номерной фонд объекта. Только чтение. Контроль Gate 1: 88 = 16 ROOM + 72 BED, 92 гостя. */
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { category } = normalizeSearchParams(await searchParams);
  const [summary, units] = await Promise.all([
    api.inventorySummary(),
    api.inventoryUnits(category),
  ]);
  const activeCategory = summary.byCategory.find((c) => c.code === category);

  return (
    <Page
      title="Номерной фонд"
      subtitle={`${summary.property.name} · ${summary.property.timezone} · ${summary.property.currency}`}
    >
      <Stats data-testid="inventory-summary">
        <Stat label="Единиц продажи" value={summary.totalUnits} testId="total-units" size="big" />
        <Stat label="Отдельных номеров" value={summary.rooms} testId="rooms" size="big" />
        <Stat label="Койко-мест" value={summary.beds} testId="beds" size="big" />
        <Stat label="Максимум гостей" value={summary.maxGuests} testId="max-guests" size="big" />
        <Stat label="Блокировок" value={summary.blocks} testId="blocks" size="big" />
      </Stats>

      <section>
        <SectionTitle first>По категориям</SectionTitle>
        <Table>
          <thead>
            <tr>
              <th>Категория</th>
              <th className="num">Единиц</th>
              <th className="num">Гостей макс.</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {summary.byCategory.map((c) => (
              <tr
                key={c.code}
                data-testid="category-row"
                className={c.code === category ? 'is-active' : undefined}
              >
                <td>{c.name}</td>
                <td className="num">{c.units}</td>
                <td className="num">{c.maxGuests}</td>
                <td>
                  {c.code === category ? (
                    <Link href="/inventory">сбросить фильтр</Link>
                  ) : (
                    <Link href={`/inventory?category=${encodeURIComponent(c.code)}`}>показать</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>

      <section>
        <SectionTitle>
          Единицы{activeCategory ? `: ${activeCategory.name}` : ''}{' '}
          <span className="muted" style={{ fontWeight: 400 }}>
            ({units.length})
          </span>
        </SectionTitle>
        <Table>
          <thead>
            <tr>
              <th>Код</th>
              <th>Тип</th>
              <th>Категория</th>
              <th>Комната</th>
              <th className="num">Вместимость</th>
              <th>№ в Exely</th>
            </tr>
          </thead>
          <tbody>
            {units.map((u) => (
              <tr key={u.code} data-testid="unit-row">
                <td className="mono">
                  <Link href={`/units/${encodeURIComponent(u.code)}`} className="unit">
                    {u.code}
                  </Link>
                </td>
                <td>{u.kind === 'ROOM' ? 'номер' : 'койка'}</td>
                <td>{u.accommodationTypeName}</td>
                <td className="mono">{u.roomNumber}</td>
                <td className="num">{u.roomCapacity}</td>
                <td className="mono">{u.exelyRoomNumber ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
    </Page>
  );
}

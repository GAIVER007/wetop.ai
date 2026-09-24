'use client';
import { useState } from 'react';
import Link from 'next/link';
import type { InventoryCategory, InventoryUnit } from '../../lib/api';
import { Input } from '../../components/ui';
import { FundEditor } from './fund-editor';
import { pluralRu } from '../../lib/plural';
export function CategoryCatalog({
  categories,
  units,
}: {
  categories: InventoryCategory[];
  units: InventoryUnit[];
}) {
  const [q, setQ] = useState('');
  const filtered = categories.filter((c) =>
    c.name.toLocaleLowerCase('ru').includes(q.trim().toLocaleLowerCase('ru')),
  );
  return (
    <>
      <div className="fund-toolbar">
        <Input
          aria-label="Поиск категории"
          placeholder="Найти категорию"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <span className="muted">{categories.length} категорий</span>
        <FundEditor categories={categories} mode="category" />
      </div>
      {!categories.length ? (
        <section className="fund-empty">
          <h2>Начните с категории размещения</h2>
          <p>
            Например, «Двухместный номер» или «Койка в общей комнате». Затем добавьте конкретные
            номера и койки.
          </p>
          <FundEditor categories={categories} mode="category" />
        </section>
      ) : !filtered.length ? (
        <p role="status">Категории не найдены. Измените поиск.</p>
      ) : (
        <div className="fund-category-list">
          {filtered.map((c) => {
            const members = units.filter((u) => u.accommodationTypeCode === c.code),
              bed = c.kind === 'DORM_BED';
            return (
              <article className="fund-category" key={c.code}>
                <div className="fund-category-top">
                  <div>
                    <span className="fund-type">
                      {bed
                        ? 'Койко-место'
                        : c.kind === 'APARTMENT'
                          ? 'Апартаменты целиком'
                          : 'Номер целиком'}
                    </span>
                    <h2>{c.name}</h2>
                  </div>
                  <FundEditor categories={categories} mode="category" category={c} />
                </div>
                <dl className="fund-facts">
                  <div>
                    <dt>{bed ? 'На одно койко-место' : 'На один номер'}</dt>
                    <dd>{pluralRu(c.capacityAdults, ['гость', 'гостя', 'гостей'])}</dd>
                  </div>
                  <div>
                    <dt>В составе категории</dt>
                    <dd>
                      {pluralRu(
                        members.length,
                        bed ? ['койка', 'койки', 'коек'] : ['номер', 'номера', 'номеров'],
                      )}
                    </dd>
                  </div>
                </dl>
                <details>
                  <summary>Показать состав · {members.length}</summary>
                  <div className="fund-members">
                    {members.length ? (
                      members.map((u) => (
                        <Link
                          key={u.code}
                          href={`/units/${encodeURIComponent(u.code)}`}
                          prefetch={false}
                        >
                          {bed ? 'Койка' : 'Номер'} {u.code}
                        </Link>
                      ))
                    ) : (
                      <span className="muted">Размещение ещё не добавлено</span>
                    )}
                  </div>
                </details>
                <div className="fund-category-actions">
                  <FundEditor categories={categories} category={c} />
                  <Link
                    className="btn btn--secondary"
                    href={`/rates?category=${encodeURIComponent(c.code)}`}
                  >
                    Настроить тарифы
                  </Link>
                  <Link href={`/chessboard?category=${encodeURIComponent(c.code)}`}>
                    В шахматке →
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}

import type { ReactNode } from 'react';
import Link from 'next/link';
import { channelsApi, ratesApi } from '../../../lib/api';
import { Page } from '../../../components/page';
import { LoadError } from '../../../components/load-error';
import { loadErrorProps } from '../../../lib/load-error';
import { Alert, Badge, EmptyState, Help, SectionTitle, Table } from '../../../components/ui';
import { Icon } from '../../../components/icon';
import { ChannelTabs } from '../tabs';
import '../../directory.css';

/** Ответ API как есть или причина отказа: экран остаётся, вместо данных — сбой со следующим шагом (D4) */
const settle = <T,>(p: Promise<T>) =>
  p.then(
    (r) => ({ ok: true as const, r }),
    (e: unknown) => ({ ok: false as const, e }),
  );

/**
 * «Каналы продаж → Сопоставление» (CH2, ADR-107, `plans/ch2-channels-mapping-2026-09-28.md`): какие
 * категории и тарифы WETOP связаны с Channex — по названиям, без идентификаторов (они на `/channels`).
 * Сопоставления пишет только `setup` на экране «Синхронизация»: все категории объекта с одним тарифом,
 * поэтому тариф без сопоставлений — не ошибка, а «в каналы не выгружается». Категория без сопоставления —
 * ошибка: остатки и цены по ней в каналы не уходят (`ari-publisher` берёт только сопоставленные).
 */
export default async function ChannelMappingPage() {
  const [loadedMapping, loadedOptions, loadedNames] = await Promise.all([
    settle(channelsApi.mapping()),
    settle(ratesApi.options()),
    settle(channelsApi.channexNames()),
  ]);
  const names = loadedNames.ok ? loadedNames.r : { roomTypes: {}, ratePlans: {} };
  const page = (children: ReactNode) => (
    <Page title="Каналы продаж" subtitle="Какие категории и тарифы WETOP связаны с Channex.">
      <ChannelTabs current="mapping" />
      {children}
    </Page>
  );

  if (!loadedMapping.ok)
    return page(<LoadError testId="mapping-error" {...loadErrorProps(loadedMapping.e)} />);
  const mapping = loadedMapping.r;
  const property = mapping.find((m) => !m.providerRoomTypeId);
  if (!property)
    return page(
      <EmptyState
        icon={<Icon name="channels" />}
        title="Объект в Channex не создан"
        data-testid="mapping-no-property"
        actions={
          <Link href="/channels" className="btn btn--secondary">
            Открыть синхронизацию
          </Link>
        }
      >
        Пока объекта нет, сопоставлять не с чем: цены и остатки в каналы не уходят. Объект,
        категории и тарифы в Channex создаёт кнопка «Создать объект в Channex» на экране
        «Синхронизация».
      </EmptyState>,
    );
  if (!loadedOptions.ok)
    return page(<LoadError testId="mapping-options-error" {...loadErrorProps(loadedOptions.e)} />);

  const { categories, ratePlans } = loadedOptions.r;
  const categoryRows = categories.map((c) => {
    const m = mapping.find((x) => x.localAccommodationTypeCode === c.code && x.providerRoomTypeId);
    return {
      code: c.code,
      name: c.name,
      mapped: !!m,
      channexName: m ? (names.roomTypes[m.providerRoomTypeId!] ?? null) : null,
    };
  });
  const unmapped = categoryRows.filter((c) => !c.mapped);
  const planRows = ratePlans.map((p) => {
    const mappedCategories = categories.filter((c) =>
      mapping.some(
        (x) =>
          x.localAccommodationTypeCode === c.code &&
          x.localRatePlanCode === p.code &&
          x.providerRatePlanId,
      ),
    ).length;
    return { ...p, mappedCategories };
  });

  return page(
    <>
      {unmapped.length > 0 && (
        <Alert boxed tone="warning" className="overview-trouble" data-testid="mapping-warning">
          <span>
            Без сопоставления: {unmapped.map((c) => c.name).join(', ')}. Остатки и цены по{' '}
            {unmapped.length === 1 ? 'этой категории' : 'этим категориям'} в каналы не уходят.
            Недостающее создаёт «Создать объект в Channex» на экране «Синхронизация», уже
            сопоставленное повтор не трогает.
          </span>
          <Link href="/channels" className="btn btn--secondary btn--sm">
            Открыть синхронизацию
          </Link>
        </Alert>
      )}
      <section className="stack stack--sm" aria-labelledby="mapping-categories-title">
        <SectionTitle id="mapping-categories-title">Категории</SectionTitle>
        <Table
          size="sm"
          className="dir-table dir-table--mapping"
          data-testid="mapping-categories"
          aria-label="Сопоставление категорий"
        >
          <thead>
            <tr>
              <th>Категория WETOP</th>
              <th>Номер в Channex</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {categoryRows.map((c) => (
              <tr key={c.code}>
                <td>
                  <strong>{c.name}</strong>
                </td>
                <td>
                  {c.mapped ? (
                    (c.channexName ?? (
                      <span className="cell-sub">название в Channex недоступно</span>
                    ))
                  ) : (
                    <span className="cell-sub">—</span>
                  )}
                </td>
                <td>
                  <Badge tone={c.mapped ? 'ok' : 'warn'}>
                    {c.mapped ? 'Сопоставлена' : 'Не сопоставлена'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </section>
      <section className="stack stack--sm" aria-labelledby="mapping-rate-plans-title">
        <SectionTitle id="mapping-rate-plans-title">Тарифы</SectionTitle>
        <Table
          size="sm"
          className="dir-table dir-table--mapping"
          data-testid="mapping-rate-plans"
          aria-label="Сопоставление тарифов"
        >
          <thead>
            <tr>
              <th>Тариф WETOP</th>
              <th>Сопоставлен в категориях</th>
              <th>Статус</th>
            </tr>
          </thead>
          <tbody>
            {planRows.map((p) => {
              const full = categories.length > 0 && p.mappedCategories === categories.length;
              const none = p.mappedCategories === 0;
              return (
                <tr key={p.code}>
                  <td>
                    <strong>{p.name}</strong>
                    <div className="cell-sub">
                      {p.currency}
                      {p.active ? '' : ', не действует'}
                    </div>
                  </td>
                  <td className="num">
                    {p.mappedCategories} из {categories.length}
                  </td>
                  <td>
                    <Badge tone={none ? 'neutral' : full ? 'ok' : 'warn'}>
                      {none
                        ? 'В каналы не выгружается'
                        : full
                          ? 'Выгружается'
                          : 'Не во всех категориях'}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </section>
      <Help title="Как устроено сопоставление">
        Сейчас в каналы уходит один тариф: он сопоставлен с каждой категорией объекта, у каждой
        категории — свой тариф в Channex. Остальные тарифы работают только в WETOP, это не ошибка.
        Сопоставления создаёт «Создать объект в Channex» на экране «Синхронизация»; сами каналы
        (Booking.com, Agoda и другие) связываются с Channex в его кабинете.
      </Help>
    </>,
  );
}

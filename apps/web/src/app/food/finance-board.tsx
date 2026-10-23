'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Input, Table } from '../../components/ui';
import { Icon } from '../../components/icon';
import { METHOD_RU, wholeTenge } from '../../lib/dashboard-format';
import type { FoodCashView } from '../../lib/food-types';
import { localInput } from '../beauty/time';

type Tab = 'revenue' | 'refunds' | 'expenses' | 'income';
interface Row {
  id: string;
  at: string;
  kind: string;
  minor: bigint;
  note: string;
}

/**
 * «Финансы» ресторана (макет, экран 12): вкладки «Выручка», «Расходы», «Поступления», «Отчёты», период,
 * экспорт и таблица «Дата, Тип, Сумма, Описание». Выручка это оплаты заказов, возвраты гостям своей вкладкой (§56, как ADR-176), расходы и поступления это
 * операции кассы (§35); аннулированное не показывается. Отчёты живут в «Аналитике».
 */
export function FinanceBoard({
  cash,
  timezone,
  from,
  to,
}: {
  cash: FoodCashView;
  timezone: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('revenue');
  // период грузит сервер целиком (ADR-181): смена даты перечитывает страницу с новыми параметрами
  const setPeriod = (nextFrom: string, nextTo: string) => {
    if (!nextFrom || !nextTo) return;
    router.push(`?from=${nextFrom}&to=${nextTo}`);
  };
  const day = (iso: string) => localInput(iso, timezone).slice(0, 10);
  const method = (m: string) => METHOD_RU[m] ?? m;
  const rows: Record<Tab, Row[]> = {
    revenue: cash.payments
      .filter((p) => p.status === 'COMPLETED')
      .map((p) => ({
        id: p.id,
        at: p.paidAt,
        kind: 'Выручка',
        minor: BigInt(p.amountMinor),
        note: `Оплата заказа №${p.orderNumber}, ${method(p.method)}`,
      })),
    // возвраты гостям отдельной вкладкой, не в расходах (как ADR-176 у гостиницы)
    refunds: cash.operations
      .filter((o) => o.status === 'COMPLETED' && o.kind === 'EXPENSE' && o.refund)
      .map((o) => ({ id: o.id, at: o.occurredAt, kind: 'Возврат', minor: -BigInt(o.amountMinor), note: o.note || method(o.method) })),
    expenses: cash.operations
      .filter((o) => o.status === 'COMPLETED' && o.kind === 'EXPENSE' && !o.refund)
      .map((o) => ({
        id: o.id,
        at: o.occurredAt,
        kind: 'Расход',
        minor: -BigInt(o.amountMinor),
        note:
          [o.employee && `Выплата: ${o.employee}${o.period ? `, ${o.period}` : ''}`, o.note]
            .filter(Boolean)
            .join(', ') || method(o.method),
      })),
    income: cash.operations
      .filter((o) => o.status === 'COMPLETED' && o.kind === 'INCOME')
      .map((o) => ({
        id: o.id,
        at: o.occurredAt,
        kind: 'Поступление',
        minor: BigInt(o.amountMinor),
        note: o.note || method(o.method),
      })),
  };
  const shown = rows[tab]
    .filter((r) => day(r.at) >= from && day(r.at) <= to)
    .sort((a, b) => b.at.localeCompare(a.at));
  const total = shown.reduce((acc, r) => acc + r.minor, 0n);
  const money = (minor: bigint) => wholeTenge(minor.toString(), cash.currency);
  const date = (iso: string) => {
    const d = day(iso);
    return `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  };
  function exportCsv() {
    const lines = [
      ['Дата', 'Тип', 'Сумма', 'Описание'],
      ...shown.map((r) => [date(r.at), r.kind, (Number(r.minor) / 100).toFixed(2), r.note]),
    ].map((line) => line.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';'));
    const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `finance-${tab}-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
  const TABS: Array<[Tab, string]> = [
    ['revenue', 'Выручка'],
    ['refunds', 'Возвраты'],
    ['expenses', 'Расходы'],
    ['income', 'Поступления'],
  ];
  return (
    <div className="food-workspace rest-ws" data-testid="finance-board">
      <div className="rest-bar">
        <nav className="tabs" aria-label="Финансы">
          {TABS.map(([id, label]) => (
            <button className="tabs__item"
              key={id}
              type="button"
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
          <Link className="tabs__item" href="/management/analytics">Отчёты</Link>
        </nav>
        <Button onClick={exportCsv} disabled={shown.length === 0}>
          <Icon name="file" />
          Экспорт
        </Button>
      </div>
      <div className="rest-card">
        <div className="rest-card__tools">
          <Field label={<span className="sr-only">С даты</span>}>
            <Input type="date" value={from} max={to} onChange={(e) => setPeriod(e.target.value, to)} />
          </Field>
          <span aria-hidden="true">–</span>
          <Field label={<span className="sr-only">По дату</span>}>
            <Input type="date" value={to} min={from} onChange={(e) => setPeriod(from, e.target.value)} />
          </Field>
          <span className="rest-finance-total" data-testid="finance-total">
            Итого: <strong>{money(total)}</strong>
          </span>
        </div>
        {shown.length === 0 ? (
          <p className="muted">За выбранный период записей нет</p>
        ) : (
          <Table density="compact" caption="Операции за период" captionHidden>
            <thead>
              <tr>
                <th scope="col">Дата</th>
                <th scope="col">Тип</th>
                <th scope="col" className="num">
                  Сумма
                </th>
                <th scope="col">Описание</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td>
                    <time dateTime={r.at}>{date(r.at)}</time>
                  </td>
                  <td>{r.kind}</td>
                  <td className="num" data-negative={r.minor < 0n || undefined}>
                    {money(r.minor)}
                  </td>
                  <td>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}

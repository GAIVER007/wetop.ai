import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AuthMember } from '../../lib/api';

// «Сколько принёс» гостиницы в «Персонал → Сотрудники» (решение владельца 20.10.2026): по создавшему бронь
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('./actions', () => ({}));
vi.mock('../../components/use-confirm', () => ({ useConfirm: () => ({ ask: vi.fn(), dialog: null }) }));

import { MembersTable } from './team-board';

const member = (id: string, name: string): AuthMember =>
  ({
    userId: `33333333-3333-4333-8333-33333333333${id}`,
    name,
    email: `${id}@example.invalid`,
    phone: null,
    position: null,
    role: 'STAFF',
    you: false,
    suspended: false,
    roleEditable: false,
    detailsEditable: false,
    scopes: [],
    joinedAt: '2026-10-01T00:00:00.000Z',
    lastLoginAt: null,
  }) as unknown as AuthMember;
const members = [member('1', 'Айжан Администратор'), member('2', 'Берик Управляющий')];
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('/team: колонка «Принёс» гостиницы', () => {
  it('сумма у создавшего брони, без денег прочерк, брони из каналов строкой', () => {
    const html = renderToStaticMarkup(
      createElement(MembersTable, {
        members,
        revenue: {
          period: 'day', fromDate: '2026-10-20', toDate: '2026-10-20',
          items: [
            { employeeId: members[0]!.userId, currency: 'KZT', paidMinor: '3000000', refundedMinor: '500000', netMinor: '2500000' },
            { employeeId: null, currency: 'KZT', paidMinor: '1200000', refundedMinor: '0', netMinor: '1200000' },
          ],
        },
        revenueNav: createElement('nav', null, 'период') as ReactNode,
      }),
    );
    expect(html).toContain('Принёс сегодня');
    const rows = html.split('data-testid="member-row"').slice(1).map(text);
    expect(rows[0]).toContain('25 000 ₸');
    expect(rows[1]).toContain('—');
    expect(text(html)).toContain('Брони из каналов и сайта: 12 000 ₸');
  });
  it('без свода (салон, ресторан или нет права на отчёты) колонки нет', () => {
    expect(renderToStaticMarkup(createElement(MembersTable, { members }))).not.toContain('Принёс');
  });
});

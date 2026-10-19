import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { BeautyPositionsWorkspace } from '../../../lib/api';
import { POSITION_TEMPLATES, PositionsBoard } from './positions-board';

vi.mock('../../../components/use-confirm', () => ({
  useConfirm: () => ({ ask: vi.fn(), dialog: null }),
}));

const businessId = '11111111-1111-4111-8111-111111111111';
const locationId = '21111111-1111-4111-8111-111111111111';
const masterId = '31111111-1111-4111-8111-111111111111';
const administratorId = '41111111-1111-4111-8111-111111111111';
const activeAssignmentId = '51111111-1111-4111-8111-111111111111';
const revokedAssignmentId = '61111111-1111-4111-8111-111111111111';

const initial: BeautyPositionsWorkspace = {
  businessId,
  positions: [
    {
      id: masterId,
      name: 'Мастер',
      revision: 3,
      archivedAt: null,
      permissions: [
        { section: 'journal', action: 'view', scope: 'OWN' },
        { section: 'appointments', action: 'view', scope: 'OWN' },
        { section: 'payroll', action: 'view', scope: 'OWN' },
        { section: 'reviews', action: 'view', scope: 'OWN' },
      ],
    },
    {
      id: administratorId,
      name: 'Администратор',
      revision: 5,
      archivedAt: null,
      permissions: [
        { section: 'appointments', action: 'view', scope: 'BUSINESS' },
        { section: 'appointments', action: 'create', scope: 'BUSINESS' },
        { section: 'finance', action: 'refund', scope: 'BUSINESS' },
      ],
    },
  ],
  assignments: [
    {
      id: activeAssignmentId,
      userId: '71111111-1111-4111-8111-111111111111',
      locationId,
      positionId: masterId,
      revision: 2,
      revokedAt: null,
    },
    {
      id: revokedAssignmentId,
      userId: '81111111-1111-4111-8111-111111111111',
      locationId: null,
      positionId: administratorId,
      revision: 4,
      revokedAt: '2026-10-18T08:00:00.000Z',
    },
  ],
  members: [
    {
      userId: '71111111-1111-4111-8111-111111111111',
      name: 'Елена Мастер',
      email: 'master@example.test',
      businessWide: false,
      locationIds: [locationId],
    },
    {
      userId: '81111111-1111-4111-8111-111111111111',
      name: 'Анна Администратор',
      email: 'admin@example.test',
      businessWide: true,
      locationIds: [locationId],
    },
  ],
  locations: [{ id: locationId, name: 'Салон на Абая' }],
};

const scopeKey = JSON.stringify({
  organizationId: '91111111-1111-4111-8111-111111111111',
  businessId,
  locationId,
});

describe('Beauty positions board', () => {
  it('renders the zapis-style editable CRUD matrix with one explicit refund permission', () => {
    const html = renderToStaticMarkup(
      createElement(PositionsBoard, { initial, scopeKey, canEdit: true }),
    );

    expect(html).toContain('Должности салона');
    expect(html).toContain('Выбрать должность');
    for (const label of ['Раздел', 'Просмотр', 'Создание', 'Изменение', 'Удаление'])
      expect(html).toContain(label);
    for (const label of ['Календарь и график', 'Записи', 'Клиенты', 'Сотрудники', 'Услуги и техкарты', 'Финансы', 'Склад', 'Настройки салона', 'Зарплата', 'Отзывы'])
      expect(html).toContain(label);

    expect(html.match(/name="permission:finance:refund"/g)).toHaveLength(1);
    expect(html).toContain('Возврат оплаты');
    expect(html).not.toContain('name="permission:appointments:refund"');
    expect(html).toContain('name="scope:journal:view"');
    expect(html).toContain('value="OWN"');
    expect(html).toContain('value="BUSINESS"');
  });

  it('offers named staff, positions and allowed branches without an ID paste field', () => {
    const html = renderToStaticMarkup(
      createElement(PositionsBoard, { initial, scopeKey, canEdit: true }),
    );

    expect(html).toContain('Елена Мастер');
    expect(html).toContain('master@example.test');
    expect(html).toContain('Салон на Абая');
    expect(html).toContain('Весь салон');
    expect(html).not.toMatch(/<input[^>]+name="(?:userId|positionId|locationId)"/);
    expect(html).toContain('name="assignmentUserId"');
    expect(html).toContain('name="assignmentPositionId"');
    expect(html).toContain('name="assignmentLocationId"');
  });

  it('keeps revoked assignments visible and explains that the old role does not return', () => {
    const html = renderToStaticMarkup(
      createElement(PositionsBoard, { initial, scopeKey, canEdit: true }),
    );

    expect(html).toContain('Отозвано');
    expect(html).toContain('Старая роль не вернёт доступ');
    expect(html).toContain('Анна Администратор');
  });

  it('shows the matrix and assignment history in read-only mode without mutation controls', () => {
    const html = renderToStaticMarkup(
      createElement(PositionsBoard, { initial, scopeKey, canEdit: false }),
    );

    expect(html).toContain('Мастер');
    expect(html).toContain('Календарь и график');
    expect(html).toContain('Отозвано');
    expect(html).toContain('Только просмотр');
    expect(html).not.toMatch(/type="submit"/);
    expect(html).not.toContain('Создать должность');
    expect(html).not.toContain('Отозвать доступ');
  });

  it('lets an update-only supervisor edit and assign without offering create or archive', () => {
    const html = renderToStaticMarkup(
      createElement(PositionsBoard, {
        initial,
        scopeKey,
        canEdit: false,
        canCreate: false,
        canUpdate: true,
        canArchive: false,
      }),
    );

    expect(html).toContain('Сохранить должность');
    expect(html).toContain('Сохранить назначение');
    expect(html).toContain('Отозвать доступ');
    expect(html).not.toContain('Новая должность мастера');
    expect(html).not.toContain('Новая должность администратора');
    expect(html).not.toContain('Архивировать');
    expect(html).not.toContain('Только просмотр');
  });

  it('defines reviewable templates without creating or assigning anything automatically', () => {
    expect(POSITION_TEMPLATES.master.permissions).toEqual([
      { section: 'journal', action: 'view', scope: 'OWN' },
      { section: 'appointments', action: 'view', scope: 'OWN' },
      { section: 'payroll', action: 'view', scope: 'OWN' },
      { section: 'reviews', action: 'view', scope: 'OWN' },
    ]);
    expect(POSITION_TEMPLATES.administrator.permissions).toContainEqual({
      section: 'finance',
      action: 'refund',
      scope: 'BUSINESS',
    });
    expect(POSITION_TEMPLATES.administrator.permissions).not.toContainEqual(
      expect.objectContaining({ section: 'payroll' }),
    );
  });
});

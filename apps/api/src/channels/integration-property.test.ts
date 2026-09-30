import { describe, expect, it, vi } from 'vitest';
import { integrationBindingNotice, resolveIntegrationProperty } from './integration-property';

/**
 * SEC-2 (аудит 29.09.2026): «чей объект подключён к Channex» определялось по названию «Luxx Aparts» — самому раннему
 * объекту с этим именем. Пока запись Luxx есть, она выигрывает; если её нет или переименовали, первый
 * зарегистрировавшийся с таким названием стал бы оператором интеграции: общий ключ Channex и экран неисправностей всех
 * арендаторов. Теперь объект интеграции — по стабильному идентификатору `INTEGRATION_PROPERTY_ID`, дальше — по
 * сопоставлениям Channex, и только потом (пока идентификатор не задан) по названию.
 */
const ID = '67646baa-d066-4977-8afc-67f48398842f';
const MAPPED = { id: '22222222-2222-4222-8222-222222222222', organizationId: 'org-mapped' };
const NAMESAKE = { id: '33333333-3333-4333-8333-333333333333', organizationId: 'org-namesake' };
const OWN = { id: ID, organizationId: 'org-luxx' };

function fakeDb(rows: {
  byId?: typeof OWN | null;
  mapping?: typeof MAPPED | null;
  byName?: typeof OWN | null;
}) {
  const findUnique = vi.fn(async () => rows.byId ?? null);
  const mappingFirst = vi.fn(async () => (rows.mapping ? { property: rows.mapping } : null));
  const nameFirst = vi.fn(async () => rows.byName ?? null);
  return {
    db: {
      property: { findUnique, findFirst: nameFirst },
      channelMapping: { findFirst: mappingFirst },
    } as never,
    findUnique,
    mappingFirst,
    nameFirst,
  };
}

describe('объект интеграции: выбор', () => {
  it('задан INTEGRATION_PROPERTY_ID — берётся он; сопоставления и название не спрашиваются', async () => {
    const f = fakeDb({ byId: OWN, mapping: MAPPED, byName: NAMESAKE as never });
    const found = await resolveIntegrationProperty(f.db, { INTEGRATION_PROPERTY_ID: ID });
    expect(found).toEqual({ id: ID, organizationId: 'org-luxx', source: 'env' });
    expect(f.mappingFirst).not.toHaveBeenCalled();
    expect(f.nameFirst).not.toHaveBeenCalled();
    expect(f.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ID } }));
  });

  it('одноимённый объект чужой организации оператором не становится: идентификатор сильнее названия', async () => {
    const f = fakeDb({ byId: OWN, byName: NAMESAKE as never });
    const found = await resolveIntegrationProperty(f.db, { INTEGRATION_PROPERTY_ID: ` ${ID} ` });
    expect(found?.organizationId).toBe('org-luxx');
  });

  it('идентификатор задан, а объекта нет — объект ничей, к названию не откатываемся (закрыто, а не «первый попавшийся»)', async () => {
    const f = fakeDb({ byId: null, mapping: MAPPED, byName: NAMESAKE as never });
    await expect(
      resolveIntegrationProperty(f.db, { INTEGRATION_PROPERTY_ID: ID }),
    ).resolves.toBeNull();
    expect(f.mappingFirst).not.toHaveBeenCalled();
    expect(f.nameFirst).not.toHaveBeenCalled();
  });

  it('идентификатор задан не UUID — объект ничей, в базу не ходим', async () => {
    const f = fakeDb({ byId: OWN });
    await expect(
      resolveIntegrationProperty(f.db, { INTEGRATION_PROPERTY_ID: 'luxx' }),
    ).resolves.toBeNull();
    expect(f.findUnique).not.toHaveBeenCalled();
    expect(f.nameFirst).not.toHaveBeenCalled();
  });

  it('идентификатора нет, сопоставления Channex есть — объект по ним, название не спрашивается', async () => {
    for (const env of [{}, { INTEGRATION_PROPERTY_ID: '' }, { INTEGRATION_PROPERTY_ID: '   ' }]) {
      const f = fakeDb({ mapping: MAPPED, byName: NAMESAKE as never });
      const found = await resolveIntegrationProperty(f.db, env);
      expect(found).toEqual({ ...MAPPED, source: 'mapping' });
      expect(f.nameFirst).not.toHaveBeenCalled();
      expect(f.mappingFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { provider: 'channex' }, orderBy: { createdAt: 'asc' } }),
      );
    }
  });

  it('ни идентификатора, ни сопоставлений — прежний путь: самый ранний объект с названием установки', async () => {
    const f = fakeDb({ byName: OWN });
    const found = await resolveIntegrationProperty(f.db, {});
    expect(found).toEqual({ ...OWN, source: 'name' });
    expect(f.nameFirst).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'asc' } }),
    );
  });

  it('ничего не нашлось — объект ничей', async () => {
    const f = fakeDb({});
    await expect(resolveIntegrationProperty(f.db, {})).resolves.toBeNull();
  });
});

describe('объект интеграции: предупреждение при старте', () => {
  it('не production — тихо', () => {
    expect(integrationBindingNotice({})).toBeNull();
    expect(integrationBindingNotice({ NODE_ENV: 'development' })).toBeNull();
    expect(
      integrationBindingNotice({ NODE_ENV: 'test', INTEGRATION_PROPERTY_ID: 'bad' }),
    ).toBeNull();
  });

  it('production, идентификатор не задан — предупреждение: объект определяется по сопоставлениям или названию', () => {
    for (const INTEGRATION_PROPERTY_ID of [undefined, '', '  ']) {
      const notice = integrationBindingNotice({ NODE_ENV: 'production', INTEGRATION_PROPERTY_ID });
      expect(notice?.level).toBe('warn');
      expect(notice?.message).toMatch(/INTEGRATION_PROPERTY_ID/);
      expect(notice?.message).toMatch(/названию/);
    }
  });

  it('production, идентификатор не UUID — ошибка: настройка неверна, запуск стоит остановить', () => {
    const notice = integrationBindingNotice({
      NODE_ENV: 'production',
      INTEGRATION_PROPERTY_ID: 'luxx',
    });
    expect(notice?.level).toBe('error');
    expect(notice?.message).toMatch(/UUID/);
  });

  it('production, идентификатор верный — тихо', () => {
    expect(
      integrationBindingNotice({ NODE_ENV: 'production', INTEGRATION_PROPERTY_ID: ID }),
    ).toBeNull();
  });
});

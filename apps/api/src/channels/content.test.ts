import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { channex } from '@pms/integrations';
import { ChannelContentService, type ContentReader } from './content';

const PROPERTY = 'prop-staging-1';
const repo = (propertyId: string | null) =>
  ({
    mappings: async () =>
      propertyId
        ? [{ id: 'm', providerPropertyId: propertyId, providerRoomTypeId: null, providerRatePlanId: null }]
        : [],
  }) as never;

/** Фальшивый Channex: объект с описанием и тремя id удобств (одного нет в справочнике), правила, два фото */
function fakeReader(fail?: Error) {
  const calls = { property: 0 };
  const reader: ContentReader = {
    async getProperty(id) {
      calls.property += 1;
      if (fail) throw fail;
      return {
        id,
        type: 'property',
        attributes: {
          title: 'Luxx Aparts',
          currency: 'KZT',
          phone: '+7 700 000 00 00',
          email: 'hostel@example.test',
          address: 'ул. Вымышленная, 1',
          city: 'Алматы',
          country: 'KZ',
          facilities: ['f-wifi', 'f-laundry', 'f-gone'],
          content: { description: 'Хостел в центре города', important_information: ' ' },
        },
      };
    },
    async listPropertyFacilities() {
      return [
        { id: 'f-laundry', type: 'facility', attributes: { title: 'Laundry', category: 'services' } },
        { id: 'f-wifi', type: 'facility', attributes: { title: 'WiFi', category: 'general' } },
        { id: 'f-pool', type: 'facility', attributes: { title: 'Pool', category: 'general' } },
      ];
    },
    async listAll<A>(path: string) {
      const rows: Record<string, unknown[]> = {
        '/hotel_policies': [
          {
            id: 'hp-1',
            type: 'hotel_policy',
            attributes: {
              checkin_time: '14:00',
              checkout_time: '12:00',
              max_count_of_guests: 92,
              pets_policy: 'not_allowed',
              smoking_policy: 'no_smoking',
              internet_access_type: 'wifi',
              parking_type: 'none',
            },
          },
        ],
        '/photos': [
          { id: 'ph-2', type: 'photo', attributes: { url: 'https://img.channex.io/b/', position: 1, description: 'Кухня', room_type_id: null } },
          { id: 'ph-1', type: 'photo', attributes: { url: 'https://img.channex.io/a/', position: 0, description: 'Фасад', room_type_id: 'rt-1' } },
        ],
      };
      return (rows[path] ?? []) as channex.ChannexResource<A>[];
    },
  };
  return { reader, calls };
}

describe('ChannelContentService (ADR-033)', () => {
  it('описание, контакты, правила, выбранные удобства и фото по порядку — без id провайдера', async () => {
    const { reader } = fakeReader();
    const c = await new ChannelContentService(repo(PROPERTY), reader).content();
    expect(c).toMatchObject({
      source: 'channex',
      state: 'READY',
      property: {
        title: 'Luxx Aparts',
        description: 'Хостел в центре города',
        importantInformation: null,
        phone: '+7 700 000 00 00',
        city: 'Алматы',
      },
      policy: { checkInTime: '14:00', checkOutTime: '12:00', maxGuests: 92, pets: 'not_allowed' },
      facilities: [
        { title: 'WiFi', category: 'general' },
        { title: 'Laundry', category: 'services' },
      ],
      photos: [
        { url: 'https://img.channex.io/a/', description: 'Фасад', forRoomType: true },
        { url: 'https://img.channex.io/b/', description: 'Кухня', forRoomType: false },
      ],
    });
    const json = JSON.stringify(c);
    for (const id of [PROPERTY, 'f-wifi', 'hp-1', 'ph-1', 'rt-1']) expect(json).not.toContain(id);
  });

  it('кэш на 10 минут; ?refresh читает заново', async () => {
    const { reader, calls } = fakeReader();
    const s = new ChannelContentService(repo(PROPERTY), reader);
    const t0 = Date.parse('2026-09-13T18:00:00Z');
    await s.content(false, t0);
    await s.content(false, t0 + 9 * 60_000);
    expect(calls.property).toBe(1);
    await s.content(true, t0 + 9 * 60_000);
    expect(calls.property).toBe(2);
    await s.content(false, t0 + 20 * 60_000);
    expect(calls.property).toBe(3);
  });

  it('нет ключа, нет сопоставления, 404 и отказ сети — понятное состояние; ошибки не кэшируются', async () => {
    expect((await new ChannelContentService(repo(PROPERTY), null).content()).state).toBe('NO_KEY');
    expect((await new ChannelContentService(repo(null), fakeReader().reader).content()).state).toBe(
      'NO_MAPPING',
    );
    const notFound = fakeReader(new channex.ChannexApiError('not found', 404, '/properties'));
    const s = new ChannelContentService(repo(PROPERTY), notFound.reader);
    expect(await s.content()).toMatchObject({ state: 'NOT_FOUND', property: null, photos: [] });
    await s.content();
    expect(notFound.calls.property).toBe(2);
    const down = fakeReader(new TypeError('fetch failed'));
    expect((await new ChannelContentService(repo(PROPERTY), down.reader).content()).state).toBe(
      'UNREACHABLE',
    );
  });
});

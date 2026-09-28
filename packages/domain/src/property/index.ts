/**
 * Реквизиты объекта — OBJECT.md §1 (аудит 07.09.2026). Single-property MVP (ADR-001).
 *
 * Жило в `scripts/imports/src/exely/property.ts` с первого импорта и осталось там по недосмотру: имя
 * объекта — не часть импорта из Exely, а то, чем вся система опознаёт свою гостиницу. Тринадцать
 * репозиториев API начинают запрос с `property.findFirst({ where: { name: LUXX_APARTS_PROPERTY.name } })`,
 * то есть зависели от папки импорта чужой системы. После ADR-052 (Exely больше не источник) это стало
 * прямым препятствием: удалить код импорта нельзя, не уронив API. Перенесено сюда 20.09.2026;
 * прежний путь оставлен реэкспортом, чтобы импортёры и их тесты не переписывать разом.
 */
export const LUXX_APARTS_PROPERTY = {
  name: 'Luxx Aparts',
  legalName: 'ИП «L.A»',
  // ИИН/БИН здесь не держим: это ИИН физлица-ИП, персональные данные (проверка SECURITY.md 24.09.2026, Н12).
  // Он в записи объекта (`properties.bin`), печатные формы берут его из `/hotel/settings`.
  address: 'Казахстан, Алматы, ул. Толе би, 286/8, 050005',
  timezone: 'Asia/Almaty',
  currency: 'KZT',
  checkInTime: '14:00',
  checkOutTime: '12:00',
} as const;

export type PropertySpec = { -readonly [K in keyof typeof LUXX_APARTS_PROPERTY]: string };
export * from './settings';
export * from './services';

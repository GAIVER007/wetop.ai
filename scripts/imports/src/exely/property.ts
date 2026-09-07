/** Реквизиты объекта — OBJECT.md §1 (аудит Exely 07.09.2026). Single-property MVP (ADR-001). */
export const LUXX_APARTS_PROPERTY = {
  name: 'Luxx Aparts',
  legalName: 'ИП «L.A»',
  bin: '851101300781',
  address: 'Казахстан, Алматы, ул. Толе би, 286/8, 050005',
  timezone: 'Asia/Almaty',
  currency: 'KZT',
  checkInTime: '14:00',
  checkOutTime: '12:00',
} as const;

export type PropertySpec = { -readonly [K in keyof typeof LUXX_APARTS_PROPERTY]: string };

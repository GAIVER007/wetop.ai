/** Типовые услуги салона: подставляют название, группу и обычную длительность. Цену человек вводит сам */
export type ServicePreset = { name: string; category: string; minutes: number };

export const PRESETS: ServicePreset[] = [
  { name: 'Стрижка мужская', category: 'Волосы', minutes: 45 },
  { name: 'Стрижка женская', category: 'Волосы', minutes: 60 },
  { name: 'Стрижка детская', category: 'Волосы', minutes: 30 },
  { name: 'Окрашивание волос', category: 'Волосы', minutes: 120 },
  { name: 'Укладка', category: 'Волосы', minutes: 45 },
  { name: 'Маникюр', category: 'Ногти', minutes: 60 },
  { name: 'Маникюр с покрытием', category: 'Ногти', minutes: 90 },
  { name: 'Педикюр', category: 'Ногти', minutes: 90 },
  { name: 'Коррекция бровей', category: 'Брови и ресницы', minutes: 30 },
  { name: 'Окрашивание бровей', category: 'Брови и ресницы', minutes: 30 },
  { name: 'Наращивание ресниц', category: 'Брови и ресницы', minutes: 120 },
  { name: 'Макияж', category: 'Макияж', minutes: 60 },
  { name: 'Чистка лица', category: 'Уход за лицом', minutes: 60 },
  { name: 'Массаж', category: 'Массаж', minutes: 60 },
];

import type { ReservationFinance } from '../../../../lib/api';

/**
 * Заготовки печатных форм «Договор» и «Счёт» (SPEC §9, CLAUDE §7): словари RU/KZ и чистые расчёты.
 * Содержание — типовое, заменяется образцом владельца (project-input/forms/); плашка об этом печатается.
 * Деньги — integer minor units строками, суммируются через BigInt (ADR-008).
 */
export type Lang = 'ru' | 'kz';
export const pickLang = (lang: string | undefined): Lang => (lang === 'kz' ? 'kz' : 'ru');

/**
 * Чего нет в записи объекта: плейсхолдеры банка и подписанта для образца владельца. Всё остальное — название,
 * юрлицо, ИИН/БИН, адрес, часы, а с v1.7 (ADR-082) и телефон с почтой — из записи объекта, `propertyParty`:
 * зашитые сюда контакты напечатались бы в договоре любой организации. Значения Luxx перенесены в запись
 * миграцией 20260925000021.
 */
export const PROPERTY = {
  bank: '___',
  iban: '___',
  bic: '___',
  signer: '___',
} as const;

/** Что форма знает об объекте из `/hotel/settings`: у старого API полей `bin`, `phone` и `email` нет */
export interface StoredProperty {
  name: string;
  legalName: string | null;
  bin?: string | null;
  address: string | null;
  /** v1.7 (ADR-082): контакты объекта для печатных форм */
  phone?: string | null;
  email?: string | null;
  /** ADR-158: «Публичное имя для документов» из настроек объекта; пусто — печатается название */
  publicName?: string | null;
  checkInTime: string;
  checkOutTime: string;
}

/**
 * Реквизиты объекта для печати — из записи объекта, пустое — прочерком. До 24.09.2026 они были зашиты сюда, и ИИН/БИН
 * (ИИН физлица-ИП — персональные данные) напечатался бы в договоре любой организации (проверка SECURITY.md, Н12).
 */
export function propertyParty(
  p: StoredProperty,
): Required<{ [K in keyof Omit<StoredProperty, 'publicName'>]: string }> {
  const or = (v: string | null | undefined) => (v && v.trim() ? v : '___');
  return {
    name: p.publicName?.trim() || p.name,
    legalName: or(p.legalName),
    bin: or(p.bin),
    address: or(p.address),
    phone: or(p.phone),
    email: or(p.email),
    checkInTime: p.checkInTime,
    checkOutTime: p.checkOutTime,
  };
}

export const DRAFT_BANNER = 'ЗАГОТОВКА: содержание заменяется формой объекта';

export const CONTRACT_T = {
  ru: {
    title: 'Договор на оказание услуг по временному проживанию',
    number: 'Договор №',
    date: 'Дата',
    city: 'г. Алматы',
    parties: 'Стороны',
    propertyParty: 'Исполнитель',
    guestParty: 'Заказчик (гость)',
    bin: 'ИИН/БИН',
    address: 'Адрес',
    phone: 'Телефон',
    email: 'Почта',
    bank: 'Банк',
    iban: 'IBAN',
    bic: 'БИК',
    citizenship: 'Гражданство',
    document: 'Документ',
    subject: 'Предмет договора',
    subjectText:
      'Исполнитель предоставляет Заказчику место для временного проживания, а Заказчик оплачивает его по цене, указанной ниже.',
    stay: 'Проживание',
    category: 'Категория',
    unit: 'Номер / место',
    arrival: 'Заезд',
    departure: 'Выезд',
    nights: 'Ночей',
    checkInTime: 'Время заезда',
    checkOutTime: 'Время выезда',
    price: 'Стоимость',
    total: 'Итого по договору',
    tariff: 'Тариф',
    cancellation: 'Правила отмены',
    signatures: 'Подписи сторон',
    propertySign: 'Исполнитель',
    guestSign: 'Заказчик',
    printedAt: 'Сформировано',
  },
  kz: {
    title: 'Уақытша тұру қызметтерін көрсету шарты',
    number: 'Шарт №',
    date: 'Күні',
    city: 'Алматы қ.',
    parties: 'Тараптар',
    propertyParty: 'Орындаушы',
    guestParty: 'Тапсырыс беруші (қонақ)',
    bin: 'ЖСН/БСН',
    address: 'Мекенжайы',
    phone: 'Телефон',
    email: 'Пошта',
    bank: 'Банк',
    iban: 'IBAN',
    bic: 'БСК',
    citizenship: 'Азаматтығы',
    document: 'Құжат',
    subject: 'Шарттың мәні',
    subjectText:
      'Орындаушы Тапсырыс берушіге уақытша тұру орнын береді, ал Тапсырыс беруші оны төменде көрсетілген баға бойынша төлейді.',
    stay: 'Тұру',
    category: 'Санат',
    unit: 'Нөмір / орын',
    arrival: 'Келу',
    departure: 'Кету',
    nights: 'Түн саны',
    checkInTime: 'Келу уақыты',
    checkOutTime: 'Кету уақыты',
    price: 'Құны',
    total: 'Шарт бойынша барлығы',
    tariff: 'Тариф',
    cancellation: 'Бас тарту ережелері',
    signatures: 'Тараптардың қолдары',
    propertySign: 'Орындаушы',
    guestSign: 'Тапсырыс беруші',
    printedAt: 'Қалыптастырылды',
  },
} as const;

/** status-hint: подписи полей печатного счёта на двух языках, а не статусы оплаты */
export const INVOICE_T = {
  ru: {
    title: 'Счёт на оплату',
    number: 'Счёт №',
    date: 'Дата',
    property: 'Поставщик',
    payer: 'Плательщик',
    bin: 'ИИН/БИН',
    address: 'Адрес',
    phone: 'Телефон',
    bank: 'Банк',
    iban: 'IBAN',
    bic: 'БИК',
    booking: 'Бронь №',
    stay: 'Проживание',
    lineNo: '№',
    description: 'Наименование',
    serviceDate: 'Дата',
    quantity: 'Кол-во',
    unitPrice: 'Цена',
    amount: 'Сумма',
    total: 'Итого начислено',
    paid: 'Оплачено',
    refunded: 'Возвращено',
    due: 'К оплате',
    overpaid: 'Переплата',
    settled: 'Оплачено полностью',
    noLines: 'Начислений нет',
    signature: 'Администратор',
    printedAt: 'Сформировано',
  },
  // status-hint: подписи полей печатного счёта на казахском
  kz: {
    title: 'Төлем шоты',
    number: 'Шот №',
    date: 'Күні',
    property: 'Жеткізуші',
    payer: 'Төлеуші',
    bin: 'ЖСН/БСН',
    address: 'Мекенжайы',
    phone: 'Телефон',
    bank: 'Банк',
    iban: 'IBAN',
    bic: 'БСК',
    booking: 'Брондау №',
    stay: 'Тұру',
    lineNo: '№',
    description: 'Атауы',
    serviceDate: 'Күні',
    quantity: 'Саны',
    unitPrice: 'Бағасы',
    amount: 'Сомасы',
    total: 'Барлығы есептелді',
    paid: 'Төленді',
    refunded: 'Қайтарылды',
    due: 'Төлеуге',
    overpaid: 'Артық төлем',
    settled: 'Толық төленді',
    noLines: 'Есептеулер жоқ',
    signature: 'Әкімші',
    printedAt: 'Қалыптастырылды',
  },
} as const;

/**
 * Правило отмены объекта (Q-103, ответ управляющего 10.09.2026). Политика конкретного тарифа
 * (стойка — без штрафа, ОТА — первые сутки, невозвратный — всё проживание) на карточке брони API не
 * отдаёт, поэтому в договоре печатается общее правило, а строка тарифа — плейсхолдер под образец.
 */
export function cancellationRule(lang: Lang): string {
  return lang === 'kz'
    ? 'Келу күніне дейін бас тарту — барлық арналарда тегін. Келу күні және одан кейін бас тартқанда, сондай-ақ келмеген жағдайда тұру тарифі бойынша айыппұл ұсталады: тіркеу тарифі бойынша — айыппұлсыз, ОТА тарифтері бойынша — алғашқы тәуліктің құны, қайтарылмайтын тариф бойынша — тұрудың толық құны.'
    : 'Отмена до дня заезда — бесплатно на всех каналах. При отмене в день заезда и позже, а также при незаезде удерживается штраф по тарифу проживания: по тарифу стойки — без штрафа, по тарифам ОТА — стоимость первых суток, по невозвратному тарифу — полная стоимость проживания.';
}

/** Ночей между датами проживания (YYYY-MM-DD по Алматы), без часов и часовых поясов. */
export function nightsBetween(arrival: string, departure: string): number {
  return Math.round(
    (Date.parse(`${departure}T00:00:00Z`) - Date.parse(`${arrival}T00:00:00Z`)) / 86_400_000,
  );
}

export interface InvoiceLine {
  id: string;
  folioId: string;
  kind: string;
  description: string;
  serviceDate: string | null;
  quantity: number;
  unitPriceMinor: string;
  amountMinor: string;
}

/** Строки счёта: начисления всех счетов брони, кроме сторнированных. */
export function invoiceLines(finance: ReservationFinance): InvoiceLine[] {
  return finance.folios.flatMap((f) =>
    f.charges
      .filter((c) => !c.voidedAt)
      .map((c) => ({
        id: c.id,
        folioId: f.id,
        kind: c.kind,
        description: c.description,
        serviceDate: c.serviceDate,
        quantity: c.quantity,
        unitPriceMinor: c.unitPriceMinor,
        amountMinor: c.amountMinor,
      })),
  );
}

/** Сумма minor units строками — только BigInt, никакого float (ADR-008). */
export function sumMinor(values: string[]): string {
  return values.reduce((s, v) => s + BigInt(v), 0n).toString();
}

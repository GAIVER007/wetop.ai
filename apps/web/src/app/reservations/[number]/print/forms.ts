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

export const DRAFT_BANNER = 'ЗАГОТОВКА: содержание заменяется формой объекта'; // kk-allow: печатная форма, язык выбирает ссылка RU/KZ

export const CONTRACT_T = {
  ru: {
    title: 'Договор на оказание услуг по временному проживанию', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    number: 'Договор №', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    date: 'Дата', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    city: 'г. Алматы', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    parties: 'Стороны', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    propertyParty: 'Исполнитель', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    guestParty: 'Заказчик (гость)', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    bin: 'ИИН/БИН', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    address: 'Адрес', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    phone: 'Телефон', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    email: 'Почта', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    bank: 'Банк', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    iban: 'IBAN',
    bic: 'БИК', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    citizenship: 'Гражданство', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    document: 'Документ', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    subject: 'Предмет договора', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    subjectText:
      'Исполнитель предоставляет Заказчику место для временного проживания, а Заказчик оплачивает его по цене, указанной ниже.', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    stay: 'Проживание', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    category: 'Категория', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    unit: 'Номер / место', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    arrival: 'Заезд', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    departure: 'Выезд', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    nights: 'Ночей', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    checkInTime: 'Время заезда', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    checkOutTime: 'Время выезда', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    price: 'Стоимость', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    total: 'Итого по договору', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    tariff: 'Тариф', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    cancellation: 'Правила отмены', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    signatures: 'Подписи сторон', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    propertySign: 'Исполнитель', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    guestSign: 'Заказчик', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    printedAt: 'Сформировано', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
  },
  kz: {
    title: 'Уақытша тұру қызметтерін көрсету шарты', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    number: 'Шарт №', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    date: 'Күні', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    city: 'Алматы қ.', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    parties: 'Тараптар', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    propertyParty: 'Орындаушы', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    guestParty: 'Тапсырыс беруші (қонақ)', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    bin: 'ЖСН/БСН', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    address: 'Мекенжайы', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    phone: 'Телефон', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    email: 'Пошта', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    bank: 'Банк', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    iban: 'IBAN',
    bic: 'БСК', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    citizenship: 'Азаматтығы', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    document: 'Құжат', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    subject: 'Шарттың мәні', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    subjectText:
      'Орындаушы Тапсырыс берушіге уақытша тұру орнын береді, ал Тапсырыс беруші оны төменде көрсетілген баға бойынша төлейді.', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    stay: 'Тұру', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    category: 'Санат', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    unit: 'Нөмір / орын', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    arrival: 'Келу', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    departure: 'Кету', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    nights: 'Түн саны', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    checkInTime: 'Келу уақыты', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    checkOutTime: 'Кету уақыты', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    price: 'Құны', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    total: 'Шарт бойынша барлығы', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    tariff: 'Тариф', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    cancellation: 'Бас тарту ережелері', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    signatures: 'Тараптардың қолдары', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    propertySign: 'Орындаушы', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    guestSign: 'Тапсырыс беруші', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    printedAt: 'Қалыптастырылды', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
  },
} as const;

/** status-hint: подписи полей печатного счёта на двух языках, а не статусы оплаты */
export const INVOICE_T = {
  ru: {
    title: 'Счёт на оплату', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    number: 'Счёт №', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    date: 'Дата', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    property: 'Поставщик', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    payer: 'Плательщик', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    bin: 'ИИН/БИН', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    address: 'Адрес', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    phone: 'Телефон', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    bank: 'Банк', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    iban: 'IBAN',
    bic: 'БИК', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    booking: 'Бронь №', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    stay: 'Проживание', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    lineNo: '№',
    description: 'Наименование', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    serviceDate: 'Дата', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    quantity: 'Кол-во', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    unitPrice: 'Цена', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    amount: 'Сумма', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    total: 'Итого начислено', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    paid: 'Оплачено', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    refunded: 'Возвращено', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    due: 'К оплате', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    overpaid: 'Переплата', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    settled: 'Оплачено полностью', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    noLines: 'Начислений нет', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    signature: 'Администратор', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    printedAt: 'Сформировано', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
  },
  // status-hint: подписи полей печатного счёта на казахском
  kz: {
    title: 'Төлем шоты', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    number: 'Шот №', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    date: 'Күні', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    property: 'Жеткізуші', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    payer: 'Төлеуші', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    bin: 'ЖСН/БСН', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    address: 'Мекенжайы', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    phone: 'Телефон', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    bank: 'Банк', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    iban: 'IBAN',
    bic: 'БСК', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    booking: 'Брондау №', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    stay: 'Тұру', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    lineNo: '№',
    description: 'Атауы', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    serviceDate: 'Күні', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    quantity: 'Саны', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    unitPrice: 'Бағасы', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    amount: 'Сомасы', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    total: 'Барлығы есептелді', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    paid: 'Төленді', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    refunded: 'Қайтарылды', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    due: 'Төлеуге', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    overpaid: 'Артық төлем', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    settled: 'Толық төленді', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    noLines: 'Есептеулер жоқ', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    signature: 'Әкімші', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    printedAt: 'Қалыптастырылды', // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
  },
} as const;

/**
 * Правило отмены объекта (Q-103, ответ управляющего 10.09.2026). Политика конкретного тарифа
 * (стойка — без штрафа, ОТА — первые сутки, невозвратный — всё проживание) на карточке брони API не
 * отдаёт, поэтому в договоре печатается общее правило, а строка тарифа — плейсхолдер под образец.
 */
export function cancellationRule(lang: Lang): string {
  return lang === 'kz'
    ? 'Келу күніне дейін бас тарту — барлық арналарда тегін. Келу күні және одан кейін бас тартқанда, сондай-ақ келмеген жағдайда тұру тарифі бойынша айыппұл ұсталады: тіркеу тарифі бойынша — айыппұлсыз, ОТА тарифтері бойынша — алғашқы тәуліктің құны, қайтарылмайтын тариф бойынша — тұрудың толық құны.' // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
    : 'Отмена до дня заезда — бесплатно на всех каналах. При отмене в день заезда и позже, а также при незаезде удерживается штраф по тарифу проживания: по тарифу стойки — без штрафа, по тарифам ОТА — стоимость первых суток, по невозвратному тарифу — полная стоимость проживания.'; // kk-allow: печатная форма, язык выбирает ссылка RU/KZ
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

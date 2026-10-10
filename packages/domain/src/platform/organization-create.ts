import { PHONE_COUNTRIES, registrationPhone } from '../accounts/registration-contact';
import { validEmail } from '../accounts/email';
import {
  isOrganizationNameShaped,
  isPersonNameShaped,
  normalizeOrganizationName,
  normalizePersonName,
} from '../accounts/registration';
import { REGION_CURRENCIES, REGION_TIMEZONES, regionCountry } from './regions';

/**
 * Создание организации главным администратором («Платформа → Организации», окно из трёх шагов). Доступ владельцу
 * открывается на ту почту, что введена в форме: человек с такой почтой становится владельцем, если же его ещё нет,
 * заводится учётная запись и ему уходит письмо со ссылкой, где он задаёт пароль. Пробного периода нет: организация
 * начинает работать сразу.
 */
export const CREATE_VERTICALS = ['HOSPITALITY', 'BEAUTY', 'FOOD_SERVICE'] as const;
export type CreateVertical = (typeof CREATE_VERTICALS)[number];

export const CREATE_VERTICAL_LABEL: Record<CreateVertical, string> = {
  HOSPITALITY: 'Гостиничный бизнес',
  BEAUTY: 'Салон красоты',
  FOOD_SERVICE: 'Ресторан',
};

export interface OrganizationCreate {
  /** Ключ повтора: двойное нажатие и обрыв сети не плодят дубль */
  id: string;
  name: string;
  /** Публичное название бизнеса: так называется Business */
  brand: string;
  vertical: CreateVertical;
  owner: { name: string; email: string; phone: string };
  country: string;
  city: string;
  timezone: string;
  currency: string;
  /** БИН/ИИН, необязательно */
  bin: string | null;
  /** Сайт, необязательно */
  website: string | null;
  /** Создать первый филиал сразу; иначе только организация и бизнес */
  firstBranch: { name: string; address: string } | null;
}

export type OrganizationCreateParse =
  | { ok: true; value: OrganizationCreate }
  | { ok: false; errors: string[] };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** БИН и ИИН Казахстана — 12 цифр; в других странах номер другой длины, поэтому проверяем только состав и длину */
const BIN = /^[0-9A-Za-z\-/ ]{5,20}$/;

function normalizeWebsite(raw: string): string | null {
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(withScheme);
    if (!url.hostname.includes('.')) return null;
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

export function parseOrganizationCreate(raw: unknown): OrganizationCreateParse {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const id = text(body.id);
  if (!UUID.test(id)) errors.push('Запрос без идентификатора: обновите страницу и повторите');

  const name = normalizeOrganizationName(text(body.name));
  if (!isOrganizationNameShaped(name)) errors.push('Название организации: от 1 до 200 знаков');
  const brand = normalizeOrganizationName(text(body.brand));
  if (!isOrganizationNameShaped(brand)) errors.push('Публичное название: от 1 до 200 знаков');

  const vertical = body.vertical as CreateVertical;
  if (!CREATE_VERTICALS.includes(vertical)) errors.push('Выберите направление бизнеса');

  const ownerName = normalizePersonName(text(body.ownerName));
  if (!isPersonNameShaped(ownerName)) errors.push('Имя владельца: от 1 до 200 знаков');
  const email = validEmail(text(body.ownerEmail));
  if (!email) errors.push('Почта владельца: на неё откроется доступ');
  const phoneCountry = PHONE_COUNTRIES.some((c) => c.code === text(body.phoneCountry))
    ? text(body.phoneCountry)
    : 'KZ';
  const phone = registrationPhone(phoneCountry, text(body.ownerPhone));
  if (!phone) errors.push('Телефон: номер целиком, с кодом страны');

  const country = text(body.country);
  const region = regionCountry(country);
  if (!region) errors.push('Выберите страну');
  const city = text(body.city);
  if (region && !region.cities.some((c) => c.name === city)) errors.push('Выберите город из списка');
  const timezone = text(body.timezone);
  if (!REGION_TIMEZONES.includes(timezone)) errors.push('Выберите часовой пояс');
  const currency = text(body.currency);
  if (!REGION_CURRENCIES.includes(currency)) errors.push('Выберите валюту');

  const binRaw = text(body.bin);
  if (binRaw && !BIN.test(binRaw)) errors.push('БИН / ИИН: от 5 до 20 знаков, цифры и буквы');
  const websiteRaw = text(body.website);
  const website = normalizeWebsite(websiteRaw);
  if (websiteRaw && !website) errors.push('Сайт: адрес вида https://example.kz');

  let firstBranch: OrganizationCreate['firstBranch'] = null;
  if (body.createFirstBranch !== false) {
    const branchName = normalizeOrganizationName(text(body.branchName) || brand);
    const address = text(body.branchAddress);
    if (!isOrganizationNameShaped(branchName)) errors.push('Название филиала: от 1 до 200 знаков');
    if (address.length > 500) errors.push('Адрес филиала: до 500 знаков');
    firstBranch = { name: branchName, address };
  }

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      id,
      name,
      brand,
      vertical,
      owner: { name: ownerName, email: email!, phone: phone! },
      country,
      city,
      timezone,
      currency,
      bin: binRaw || null,
      website,
      firstBranch,
    },
  };
}

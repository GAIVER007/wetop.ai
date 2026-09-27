/**
 * Регистрация организации (срез 13, ADR-053; было ADR-046).
 *
 * До 20.09.2026 регистрация была запросом кода на почту с побочным действием. Владелец выбрал
 * вход по паролю (Q-146 закрыт), и регистрация стала обычной формой: почта, имя, пароль. Человек
 * получает организацию с пробным периодом, членство и сессию сразу — письма в этом пути нет,
 * а значит нет и зависимости от настроенной почтовой службы.
 *
 * Плата за это названа вслух: форма регистрации отвечает «адрес занят» и тем самым говорит, есть ли
 * у нас такой клиент. Иначе человеку нечего ответить на попытку зарегистрироваться дважды. Форма
 * входа по-прежнему молчит: там ответ один на неверную почту и неверный пароль.
 *
 * Форма собирает почту, имя, название отеля и пароль (SaaS-онбординг, решение владельца 21.09.2026):
 * `organizations.name` — это название отеля, введённое человеком, а не производное от его имени.
 * Переименовать объект можно потом в настройках.
 */

/** Как в колонке `organizations.name` — `varchar(200)`. */
export const ORGANIZATION_NAME_MAX = 200;
/** Как в колонке `users.name` — `varchar(200)`. */
export const PERSON_NAME_MAX = 200;

/** Название приводится к одному виду: обрезка по краям, один пробел вместо любой пачки пробелов. */
export function normalizeOrganizationName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

/** Пустое название и название длиннее колонки не принимаем. Остальное — дело человека. */
export function isOrganizationNameShaped(raw: string): boolean {
  const name = normalizeOrganizationName(raw);
  return name.length >= 1 && name.length <= ORGANIZATION_NAME_MAX;
}

/** Имя человека — та же обработка пробелов, что у названия организации. */
export function normalizePersonName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

export function isPersonNameShaped(raw: string): boolean {
  const name = normalizePersonName(raw);
  return name.length >= 1 && name.length <= PERSON_NAME_MAX;
}

/**
 * Прежнее название рабочего пространства — по имени человека. Оставлено на случай пути без поля отеля;
 * основной путь регистрации теперь берёт название отеля из формы (см. модульный комментарий выше).
 */
export function workspaceNameFor(personName: string): string {
  return normalizePersonName(personName).slice(0, ORGANIZATION_NAME_MAX);
}

/** Тексты для формы. Про почту, имя и пароль говорим прямо: это ошибки ввода, не секрет. */
export const REGISTRATION_EMAIL_MESSAGE = 'Укажите почту — ею же вы будете входить.';
export const REGISTRATION_NAME_MESSAGE = `Укажите название организации, до ${ORGANIZATION_NAME_MAX} знаков.`;
/**
 * Название занято объектом другой организации (план tenant-isolation-2026-09-26 п. 1): служебные пути и скрипты
 * владельца ищут объект по названию, тёзка перехватил бы чужие брони. Совет — как отличить свой объект.
 */
export const REGISTRATION_NAME_TAKEN_MESSAGE =
  'Объект с таким названием уже есть в WETOP. Добавьте город или уточнение — например, «Хостел на Абая, Астана».';
export const REGISTRATION_PERSON_NAME_MESSAGE = `Укажите имя, до ${PERSON_NAME_MAX} знаков.`;
/**
 * Занятый адрес называется прямо — без этого человек не понимает, почему форма не работает.
 * Текст сразу уводит туда, где он себе поможет сам.
 */
export const REGISTRATION_TAKEN_MESSAGE =
  'Этот адрес уже зарегистрирован. Войдите по паролю или восстановите его на экране входа.';

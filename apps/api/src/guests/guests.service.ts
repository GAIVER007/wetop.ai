import 'reflect-metadata';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { normalizeCitizenship, upcomingBirthday } from '@pms/domain';
import {
  PiiKeyMissingError,
  blankToNull,
  decryptPii,
  encryptPii,
  maskNumber,
  realPiiAllowed,
} from '@pms/shared';
import {
  GUESTS_REPOSITORY,
  type GuestDirectoryFilter,
  type GuestDirectorySort,
  type GuestLastVisitWindow,
  type GuestPatch,
  type GuestVisitsFilter,
  type GuestProfile,
  type GuestsRepository,
} from './guests.repository';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ALPHA3 = /^[A-Z]{3}$/;
const DOC_TYPES = ['PASSPORT', 'ID_CARD', 'RESIDENCE_PERMIT', 'BIRTH_CERTIFICATE', 'OTHER'];

/**
 * ADR-072: пока база не в Казахстане (`PII_STORAGE` не `real`), личные поля гостя не принимают нового значения —
 * только прежнее (форма присылает профиль целиком) или пустое (стереть можно). Гражданство и пол — как всегда.
 */
const PERSONAL: Array<[keyof GuestPatch & keyof GuestProfile, string]> = [
  ['firstName', 'имя'],
  ['lastName', 'фамилию'],
  ['middleName', 'отчество'],
  ['phone', 'телефон'],
  ['email', 'почту'],
  ['birthDate', 'дату рождения'],
  ['notes', 'заметки'],
];
const OUTSIDE_KZ = 'Пока база WETOP не в Казахстане, данные гостей в ней не хранятся (ADR-072)';

export interface GuestDocumentView {
  id: string;
  type: string;
  /** Маска: ****1234; «недоступно» если ключ шифрования не задан */
  numberMasked: string;
  issueCountry: string | null;
  issuedAt: string | null;
  expiresAt: string | null;
}

/** Карточка гостя: профиль, история, документы (номер только шифрованный, наружу — маска). */
const isDay = (v: string) =>
  ISO.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

/** G7 (ТЗ §28): «Последний визит» — сегодня, 7 или 30 дней, либо период с–по (обе даты включительно) */
function lastVisitWindow(
  last: string | undefined,
  from: string | undefined,
  to: string | undefined,
): GuestLastVisitWindow | null {
  if (!last) return null;
  if (last === 'today') return { days: 0 };
  if (last === '7d') return { days: 7 };
  if (last === '30d') return { days: 30 };
  if (last !== 'period') throw new BadRequestException('last — today, 7d, 30d или period');
  if (!from || !to || !isDay(from) || !isDay(to) || from > to)
    throw new BadRequestException('Период последнего визита: даты YYYY-MM-DD, «с» не позже «по»');
  return { from, to };
}

@Injectable()
export class GuestsService {
  constructor(@Inject(GUESTS_REPOSITORY) private readonly repo: GuestsRepository) {}

  /** «Дни рождения» (Q-249 T0): гости с днём рождения в окне [from, from + days), по порядку дат */
  async birthdays(from?: string, days?: string) {
    if (!from || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !Number.isFinite(Date.parse(from)))
      throw new BadRequestException('from — дата в виде ГГГГ-ММ-ДД');
    const window = Number(days ?? 1);
    if (!Number.isInteger(window) || window < 1 || window > 31)
      throw new BadRequestException('days — от 1 до 31');
    const rows = await this.repo.withBirthDates();
    return rows
      .flatMap((g) => {
        const next = upcomingBirthday(g.birthDate, from, window);
        return next
          ? [{ id: g.id, firstName: g.firstName, lastName: g.lastName, date: next.date, age: next.age }]
          : [];
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.lastName.localeCompare(b.lastName, 'ru'));
  }

  async search(q?: string) {
    const query = (q ?? '').trim();
    if (query.length < 2)
      throw new BadRequestException('q — минимум 2 символа (фамилия, имя, телефон или email)');
    const rows = await this.repo.search(query, 50);
    return rows.map((g) => ({ ...g, citizenship: normalizeCitizenship(g.citizenship) }));
  }

  /**
   * Справочник «Гости v2»: раздел, поиск, отборы G7 (последний визит, число визитов), порядок,
   * страница. Пустой q — просто список, порог не нужен. Неизвестное значение — 400 словами, а не
   * молча весь список: ссылку с опечаткой в адресе видно сразу.
   */
  async directory(query: {
    state?: string;
    q?: string;
    page?: string;
    pageSize?: string;
    last?: string;
    from?: string;
    to?: string;
    visits?: string;
    sort?: string;
  }) {
    for (const key of [
      'state',
      'q',
      'page',
      'pageSize',
      'last',
      'from',
      'to',
      'visits',
      'sort',
    ] as const) {
      if (query[key] !== undefined && typeof query[key] !== 'string')
        throw new BadRequestException('Параметры списка должны быть строками');
    }
    const state = query.state || 'ALL';
    if (!['ALL', 'INHOUSE', 'EXPECTED', 'RECENT', 'NONE'].includes(state))
      throw new BadRequestException('state — ALL, INHOUSE, EXPECTED, RECENT или NONE');
    const q = (query.q || '').trim();
    if (q.length > 120) throw new BadRequestException('Слишком длинный запрос');
    const page = Number(query.page || 1);
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new BadRequestException('Некорректная страница');
    const pageSize = query.pageSize === undefined ? 25 : Number(query.pageSize);
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
      throw new BadRequestException('Размер страницы — целое число от 1 до 100');
    const lastVisit = lastVisitWindow(query.last, query.from, query.to);
    const visits = query.visits || null;
    if (visits !== null && !['1', '2-5', '6+'].includes(visits))
      throw new BadRequestException('visits — 1, 2-5 или 6+');
    const sort = query.sort || 'name';
    if (!['name', 'next', 'last', 'visits'].includes(sort))
      throw new BadRequestException('sort — name, next, last или visits');
    return this.repo.directory({
      state: state as GuestDirectoryFilter,
      q,
      page,
      pageSize,
      lastVisit,
      visits: visits as GuestVisitsFilter | null,
      sort: sort as GuestDirectorySort,
    });
  }

  /** Предпросмотр панелью (G3): контакты, «сейчас», история, долг из Folio; документов здесь нет */
  async preview(id: string) {
    const p = await this.repo.preview(id);
    if (!p) throw new NotFoundException(`Гость ${id} не найден`);
    return p;
  }

  async card(id: string) {
    const g = await this.repo.byId(id);
    if (!g) throw new NotFoundException(`Гость ${id} не найден`);
    const documents: GuestDocumentView[] = g.documents.map((d) => {
      let numberMasked = 'недоступно';
      try {
        numberMasked = maskNumber(decryptPii(d.numberEncrypted));
      } catch {
        /* нет ключа или чужой ключ — не показываем ничего */
      }
      // v1.7 (ADR-082): даты в базе шифртекстом; нет ключа — null, как «недоступно» у номера
      const date = (token: string | null): string | null => {
        if (!token) return null;
        try {
          return decryptPii(token);
        } catch {
          return null;
        }
      };
      return {
        id: d.id,
        type: d.type,
        numberMasked,
        issueCountry: d.issueCountry,
        issuedAt: date(d.issuedAtEncrypted),
        expiresAt: date(d.expiresAtEncrypted),
      };
    });
    // SECURITY.md §1, §5: каждый просмотр документа — событие журнала (кто и какой документ, без номера)
    if (documents.length)
      await this.repo.audit(id, 'guest.document.view', [], {
        documentIds: documents.map((d) => d.id),
      });
    const { documents: _raw, ...profile } = g;
    void _raw;
    // CHAR(3) в базе: пустое гражданство приходит как '   ' — наружу только null или код
    return { ...profile, citizenship: normalizeCitizenship(profile.citizenship), documents };
  }

  async update(id: string, dto: Record<string, unknown>) {
    const patch: GuestPatch = {};
    const str = (k: keyof GuestPatch, required = false) => {
      const v = dto[k];
      if (v === undefined) return;
      if (v !== null && typeof v !== 'string') throw new BadRequestException(`${k} — строка`);
      // Пустоту проверяем ПОСЛЕ обрезки: иначе имя '   ' обходило «обязательно» и сохранялось пустым,
      // а необязательное поле ложилось пустой строкой вместо NULL
      const value = blankToNull(v);
      if (value === null && required) throw new BadRequestException(`${k} обязательно`);
      (patch as Record<string, unknown>)[k] = value;
    };
    str('firstName', true);
    str('lastName', true);
    str('middleName');
    str('phone');
    str('email');
    str('notes');
    if (dto.birthDate !== undefined) {
      if (dto.birthDate !== null && dto.birthDate !== '' && !ISO.test(String(dto.birthDate)))
        throw new BadRequestException('birthDate — YYYY-MM-DD');
      patch.birthDate = dto.birthDate ? String(dto.birthDate) : null;
    }
    if (dto.citizenship !== undefined) {
      // trim, пустое → null: иначе '   ' ушло бы в CHAR(3) и читалось бы как «гражданство есть»
      const c = dto.citizenship === null ? null : normalizeCitizenship(String(dto.citizenship));
      if (c !== null && !ALPHA3.test(c))
        throw new BadRequestException('citizenship — код страны ISO 3166-1 alpha-3, например KAZ');
      patch.citizenship = c;
    }
    if (dto.gender !== undefined) {
      if (!['MALE', 'FEMALE', 'UNKNOWN'].includes(String(dto.gender)))
        throw new BadRequestException('gender — MALE | FEMALE | UNKNOWN');
      patch.gender = dto.gender as 'MALE' | 'FEMALE' | 'UNKNOWN';
    }
    if (Object.keys(patch).length === 0) throw new BadRequestException('Нечего менять');
    const current = await this.repo.byId(id);
    if (!current) throw new NotFoundException(`Гость ${id} не найден`);
    if (!realPiiAllowed()) {
      const changed = PERSONAL.filter(([k]) => {
        const v = patch[k];
        return v !== undefined && v !== null && v !== current[k];
      });
      if (changed.length > 0)
        throw new UnprocessableEntityException(
          `${OUTSIDE_KZ}: ${changed.map(([, label]) => label).join(', ')} не сохранено. Гражданство и пол менять можно.`,
        );
    }
    await this.repo.update(id, patch);
    await this.repo.audit(id, 'guest.update', Object.keys(patch));
    return this.card(id);
  }

  async addDocument(
    id: string,
    dto: {
      type?: string;
      number?: string;
      issueCountry?: string | null;
      issuedAt?: string | null;
      expiresAt?: string | null;
    },
  ) {
    if (!realPiiAllowed())
      throw new UnprocessableEntityException(
        `${OUTSIDE_KZ}: документ не сохранён. Сверьте его на заселении.`,
      );
    if (!dto.type || !DOC_TYPES.includes(dto.type))
      throw new BadRequestException(`type — один из ${DOC_TYPES.join(', ')}`);
    const number = (dto.number ?? '').trim();
    if (number.length < 3) throw new BadRequestException('number — номер документа');
    for (const k of ['issuedAt', 'expiresAt'] as const)
      if (dto[k] && !ISO.test(dto[k]!)) throw new BadRequestException(`${k} — YYYY-MM-DD`);
    const country = dto.issueCountry ? dto.issueCountry.toUpperCase() : null;
    if (country && !ALPHA3.test(country))
      throw new BadRequestException('issueCountry — ISO 3166-1 alpha-3');
    if (!(await this.repo.byId(id))) throw new NotFoundException(`Гость ${id} не найден`);
    let numberEncrypted: string;
    let issuedAtEncrypted: string | null;
    let expiresAtEncrypted: string | null;
    try {
      numberEncrypted = encryptPii(number);
      // v1.7 (ADR-082): даты — особо чувствительные (SECURITY.md §1), шифруются тем же ключом
      issuedAtEncrypted = dto.issuedAt ? encryptPii(dto.issuedAt) : null;
      expiresAtEncrypted = dto.expiresAt ? encryptPii(dto.expiresAt) : null;
    } catch (e) {
      if (e instanceof PiiKeyMissingError) throw new ServiceUnavailableException(e.message);
      throw e;
    }
    const documentId = await this.repo.addDocument(id, {
      type: dto.type,
      numberEncrypted,
      issueCountry: country,
      issuedAtEncrypted,
      expiresAtEncrypted,
    });
    // какой документ добавлен — идентификатором и типом, номер в журнал не пишется (SECURITY.md §6)
    await this.repo.audit(id, 'guest.document.add', ['type', 'number'], {
      documentId,
      type: dto.type,
    });
    return this.card(id);
  }

  async deleteDocument(id: string, documentId: string) {
    // гость своего объекта (замок организаций, Q-152) — иначе 404, как у правки и добавления документа
    if (!(await this.repo.byId(id))) throw new NotFoundException(`Гость ${id} не найден`);
    const removed = await this.repo.deleteDocument(id, documentId);
    if (!removed) throw new NotFoundException(`Документ ${documentId} не найден у гостя ${id}`);
    await this.repo.audit(id, 'guest.document.delete', ['id'], { documentId, type: removed.type });
    return this.card(id);
  }
}

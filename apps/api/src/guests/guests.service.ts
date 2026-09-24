import 'reflect-metadata';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { normalizeCitizenship } from '@pms/domain';
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
  type GuestPatch,
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
@Injectable()
export class GuestsService {
  constructor(@Inject(GUESTS_REPOSITORY) private readonly repo: GuestsRepository) {}

  async search(q?: string) {
    const query = (q ?? '').trim();
    if (query.length < 2)
      throw new BadRequestException('q — минимум 2 символа (фамилия, имя, телефон или email)');
    const rows = await this.repo.search(query, 50);
    return rows.map((g) => ({ ...g, citizenship: normalizeCitizenship(g.citizenship) }));
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
      return {
        id: d.id,
        type: d.type,
        numberMasked,
        issueCountry: d.issueCountry,
        issuedAt: d.issuedAt,
        expiresAt: d.expiresAt,
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
    try {
      numberEncrypted = encryptPii(number);
    } catch (e) {
      if (e instanceof PiiKeyMissingError) throw new ServiceUnavailableException(e.message);
      throw e;
    }
    const documentId = await this.repo.addDocument(id, {
      type: dto.type,
      numberEncrypted,
      issueCountry: country,
      issuedAt: dto.issuedAt || null,
      expiresAt: dto.expiresAt || null,
    });
    // какой документ добавлен — идентификатором и типом, номер в журнал не пишется (SECURITY.md §6)
    await this.repo.audit(id, 'guest.document.add', ['type', 'number'], {
      documentId,
      type: dto.type,
    });
    return this.card(id);
  }

  async deleteDocument(id: string, documentId: string) {
    const removed = await this.repo.deleteDocument(id, documentId);
    if (!removed) throw new NotFoundException(`Документ ${documentId} не найден у гостя ${id}`);
    await this.repo.audit(id, 'guest.document.delete', ['id'], { documentId, type: removed.type });
    return this.card(id);
  }
}

import 'reflect-metadata';
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { normalizeCitizenship } from '@pms/domain';
import { PiiKeyMissingError, decryptPii, encryptPii, maskNumber } from '@pms/shared';
import { GUESTS_REPOSITORY, type GuestPatch, type GuestsRepository } from './guests.repository';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const ALPHA3 = /^[A-Z]{3}$/;
const DOC_TYPES = ['PASSPORT', 'ID_CARD', 'RESIDENCE_PERMIT', 'BIRTH_CERTIFICATE', 'OTHER'];

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
      if (v === null || v === '') {
        if (required) throw new BadRequestException(`${k} обязательно`);
        (patch as Record<string, unknown>)[k] = null;
        return;
      }
      if (typeof v !== 'string') throw new BadRequestException(`${k} — строка`);
      (patch as Record<string, unknown>)[k] = v.trim();
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
    if (!(await this.repo.byId(id))) throw new NotFoundException(`Гость ${id} не найден`);
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
    await this.repo.addDocument(id, {
      type: dto.type,
      numberEncrypted,
      issueCountry: country,
      issuedAt: dto.issuedAt || null,
      expiresAt: dto.expiresAt || null,
    });
    await this.repo.audit(id, 'guest.document.add', ['type', 'number']);
    return this.card(id);
  }

  async deleteDocument(id: string, documentId: string) {
    if (!(await this.repo.deleteDocument(id, documentId)))
      throw new NotFoundException(`Документ ${documentId} не найден у гостя ${id}`);
    await this.repo.audit(id, 'guest.document.delete', ['id']);
    return this.card(id);
  }
}

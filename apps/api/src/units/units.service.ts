import 'reflect-metadata';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { housekeepingRefusal } from '@pms/domain';
import { freeTextForStorage } from '@pms/shared';
import { ARI_PUBLISHER, publishAfterCommit, type AriPublisher } from '../channels/ari-publisher';
import {
  UNITS_REPOSITORY,
  type BlockType,
  type HousekeepingStatus,
  type UnitCard,
  type UnitsRepository,
} from './units.repository';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const BLOCK_TYPES: BlockType[] = ['MAINTENANCE', 'MANAGEMENT', 'OUT_OF_ORDER', 'OTHER'];
const HK: HousekeepingStatus[] = ['DIRTY', 'CLEAN', 'INSPECTED'];
const plusDays = (iso: string, n: number) => {
  const x = new Date(`${iso}T00:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** Ячейка: блокировки (единственный источник «единица недоступна», DATA_MODEL §4) и статус уборки. */
@Injectable()
export class UnitsService {
  constructor(
    @Inject(UNITS_REPOSITORY) private readonly repo: UnitsRepository,
    @Inject(ARI_PUBLISHER) private readonly publisher: AriPublisher,
  ) {}

  /**
   * Код ячейки с управляющим символом не существует, а Postgres на NUL в тексте падает («invalid byte sequence»),
   * и вместо «не найдена» стойка получала 500. Отсекаем до запроса к базе (найдено сторожем системы 13.09.2026).
   */
  private assertCode(code: string): void {
    if ([...code].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127))
      throw new NotFoundException('Ячейка не найдена: в коде недопустимый символ');
  }

  async card(code: string): Promise<UnitCard> {
    this.assertCode(code);
    const today = await this.repo.today();
    const card = await this.repo.card(code, today, plusDays(today, 60));
    if (!card) throw new NotFoundException(`Ячейка ${code} не найдена`);
    return card;
  }

  /** Блокировка [dateFrom, dateTo): нельзя, если в ячейке в эти ночи есть проживание. */
  async block(
    code: string,
    dto: { dateFrom?: string; dateTo?: string; type?: string; reason?: string | null },
  ): Promise<UnitCard> {
    if (
      !ISO.test(dto.dateFrom ?? '') ||
      !ISO.test(dto.dateTo ?? '') ||
      dto.dateTo! <= dto.dateFrom!
    )
      throw new BadRequestException(
        'dateFrom/dateTo — даты YYYY-MM-DD, dateTo > dateFrom (ночь выезда не блокируется)',
      );
    if (!dto.type || !BLOCK_TYPES.includes(dto.type as BlockType))
      throw new BadRequestException(`type — один из ${BLOCK_TYPES.join(', ')}`);
    this.assertCode(code);
    const unit = await this.repo.unitByCode(code);
    if (!unit) throw new NotFoundException(`Ячейка ${code} не найдена`);
    const busy = await this.repo.staysOverlapping(unit.id, dto.dateFrom!, dto.dateTo!);
    if (busy.length)
      throw new ConflictException(
        `В ячейке ${code} есть проживание: ${busy.map((b) => `${b.confirmationNumber} (${b.startDate} → ${b.endDate})`).join(', ')} — сначала переселите`,
      );
    const before = await this.repo.card(code, dto.dateFrom!, dto.dateTo!);
    const block = {
      dateFrom: dto.dateFrom!,
      dateTo: dto.dateTo!,
      type: dto.type as BlockType,
      // Q-169: пока база не в РК, почта и телефоны в причине маскируются — и в журнале тоже
      reason: freeTextForStorage(dto.reason?.trim() || null),
    };
    // SECURITY.md §6: ручное изменение доступности — блокировка и журнал одной транзакцией
    await this.repo.createBlock(unit, block, { before: before?.blocks ?? [], after: block });
    const after = await this.card(code);
    await publishAfterCommit(this.publisher, {
      categoryCodes: [unit.accommodationTypeCode],
      from: dto.dateFrom!,
      toExclusive: dto.dateTo!,
    });
    return after;
  }

  async unblock(code: string, blockId: string): Promise<UnitCard> {
    this.assertCode(code);
    const unit = await this.repo.unitByCode(code);
    if (!unit) throw new NotFoundException(`Ячейка ${code} не найдена`);
    const b = await this.repo.blockById(blockId);
    if (!b || b.unitId !== unit.id)
      throw new NotFoundException(`Блокировка ${blockId} не найдена у ячейки ${code}`);
    await this.repo.deleteBlock(blockId, { unitId: unit.id, before: b });
    await publishAfterCommit(this.publisher, {
      categoryCodes: [unit.accommodationTypeCode],
      from: b.dateFrom,
      toExclusive: b.dateTo,
    });
    return this.card(code);
  }

  /**
   * Статус уборки — по циклу «требует уборки → убрано → проверено» (`@pms/domain`, 22.09.2026, поручение
   * владельца): вперёд на шаг, назад — только в «требует уборки»; перепрыгнуть проверку нельзя (409 словами).
   * Тот же статус повторно — не переход: ничего не пишется. Блокировки заселения по уборке нет — DATA_MODEL §4.
   */
  async housekeeping(code: string, dto: { status?: string }): Promise<UnitCard> {
    if (!dto.status || !HK.includes(dto.status as HousekeepingStatus))
      throw new BadRequestException(`status — один из ${HK.join(', ')}`);
    this.assertCode(code);
    const unit = await this.repo.unitByCode(code);
    if (!unit) throw new NotFoundException(`Ячейка ${code} не найдена`);
    const refusal = housekeepingRefusal(unit.housekeepingStatus, dto.status as HousekeepingStatus);
    if (refusal) throw new ConflictException(refusal);
    if (unit.housekeepingStatus !== dto.status) {
      await this.repo.setHousekeeping(
        unit.id,
        unit.housekeepingStatus,
        dto.status as HousekeepingStatus,
      );
      await this.repo.audit(
        unit.id,
        'unit.housekeeping',
        { status: unit.housekeepingStatus },
        { status: dto.status },
      );
    }
    return this.card(code);
  }
}

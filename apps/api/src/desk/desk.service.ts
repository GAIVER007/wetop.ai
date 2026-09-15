import 'reflect-metadata';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { hasCitizenship, normalizeCitizenship } from '@pms/domain';
import { DESK_REPOSITORY, type DeskRepository, type DeskStay } from './desk.repository';

export interface DeskRow {
  itemId: string;
  confirmationNumber: string;
  guestLabel: string;
  guestPhone: string | null;
  unitCode: string | null;
  accommodationTypeName: string;
  arrivalDate: string;
  departureDate: string;
  status: string;
  balanceMinor: string;
  citizenship: string | null;
  adults: number;
  guestsRecorded: number;
  /** Чего не хватает, чтобы заселить: ячейки, гражданства или карточек гостей */
  blockedReason: string | null;
}
export interface DeskDay {
  date: string;
  arrivals: DeskRow[];
  departures: DeskRow[];
  inHouse: DeskRow[];
  /** Заезд был раньше этого дня, гость так и не заселён и не отмечен незаездом: ни заезд дня, ни живущий */
  overdue: DeskRow[];
  counts: {
    arrivals: number;
    departures: number;
    inHouse: number;
    toCheckIn: number;
    toCheckOut: number;
    overdue: number;
  };
  debtMinor: string;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Рабочий день стойки: заезды, выезды и живущие на дату, с тем, что мешает заселить. */
@Injectable()
export class DeskService {
  constructor(@Inject(DESK_REPOSITORY) private readonly repo: DeskRepository) {}

  async today(date?: string): Promise<DeskDay> {
    const day = date ?? new Date(Date.now() + 5 * 3600 * 1000).toISOString().slice(0, 10);
    if (!ISO.test(day)) throw new BadRequestException('date — дата YYYY-MM-DD');
    const stays = await this.repo.stays(day);
    const row = (s: DeskStay): DeskRow => ({
      itemId: s.itemId,
      confirmationNumber: s.confirmationNumber,
      guestLabel: s.guestLabel,
      guestPhone: s.guestPhone,
      unitCode: s.unitCode,
      accommodationTypeName: s.accommodationTypeName,
      arrivalDate: s.arrivalDate,
      departureDate: s.departureDate,
      status: s.status,
      balanceMinor: s.balanceMinor.toString(),
      citizenship: normalizeCitizenship(s.citizenship),
      adults: s.adults,
      guestsRecorded: s.guestsRecorded,
      // Порядок важен: сначала то, без чего вообще нельзя заселить, потом то, что нужно для eQonaq
      blockedReason:
        s.status === 'CONFIRMED' || s.status === 'TENTATIVE'
          ? !s.unitCode
            ? 'нет ячейки'
            : !hasCitizenship(s.citizenship)
              ? 'нет гражданства'
              : s.guestsRecorded < s.adults
                ? `карточек ${s.guestsRecorded} из ${s.adults}`
                : null
          : null,
    });
    const arrivals = stays.filter((s) => s.arrivalDate === day).map(row);
    const departures = stays.filter((s) => s.departureDate === day).map(row);
    const inHouse = stays
      .filter((s) => s.status === 'CHECKED_IN' && s.departureDate !== day)
      .map(row);
    // Просроченные заезды (волна 3): раньше такие проживания на экране дня не появлялись вовсе
    const overdue = stays
      .filter(
        (s) =>
          s.arrivalDate < day &&
          s.departureDate !== day &&
          (s.status === 'CONFIRMED' || s.status === 'TENTATIVE'),
      )
      .map(row);
    return {
      date: day,
      arrivals,
      departures,
      inHouse,
      overdue,
      counts: {
        arrivals: arrivals.length,
        departures: departures.length,
        inHouse: inHouse.length,
        toCheckIn: arrivals.filter((a) => a.status === 'CONFIRMED' || a.status === 'TENTATIVE')
          .length,
        toCheckOut: departures.filter((d) => d.status === 'CHECKED_IN').length,
        overdue: overdue.length,
      },
      // Только долги: переплата одного гостя не должна прятать долг другого
      debtMinor: departures
        .filter((d) => d.status === 'CHECKED_IN')
        .reduce((s, d) => s + (BigInt(d.balanceMinor) > 0n ? BigInt(d.balanceMinor) : 0n), 0n)
        .toString(),
    };
  }
}

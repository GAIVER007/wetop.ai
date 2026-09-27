import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@pms/database';
import {
  GUEST_RECENT_DAYS,
  LUXX_APARTS_PROPERTY,
  shiftDate,
  summarizeGuestStays,
  type GuestStaySummary,
} from '@pms/domain';
import { PrismaService } from '../database/prisma.provider';
import { auditUserId } from '../accounts/actor';
import { actsForOrganization } from '../auth/request-context';
import { propertyIdRef, propertyToday } from '../database/property-ref';

export interface GuestSummary {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  email: string | null;
  citizenship: string | null;
  staysCount: number;
  lastStay: string | null;
}
export interface GuestProfile {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  birthDate: string | null;
  citizenship: string | null;
  gender: 'MALE' | 'FEMALE' | 'UNKNOWN';
  phone: string | null;
  email: string | null;
  notes: string | null;
  documents: Array<{
    id: string;
    type: string;
    numberEncrypted: string;
    issueCountry: string | null;
    /// v1.7 (ADR-082): даты — шифртекстом, как номер; расшифровывает guests.service
    issuedAtEncrypted: string | null;
    expiresAtEncrypted: string | null;
  }>;
  stays: Array<{
    confirmationNumber: string;
    accommodationTypeName: string;
    arrivalDate: string;
    departureDate: string;
    status: string;
    unitCode: string | null;
  }>;
}
/** Разделы справочника «Гости v2»: бейдж строки равен фильтру, суммы чипов сходятся с «Все» */
export type GuestDirectoryFilter = 'ALL' | 'INHOUSE' | 'EXPECTED' | 'RECENT';
export interface GuestDirectoryRow extends GuestStaySummary {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  email: string | null;
}
export interface GuestDirectoryResult {
  total: number;
  page: number;
  pageSize: number;
  counts: Record<GuestDirectoryFilter, number>;
  rows: GuestDirectoryRow[];
}
export interface GuestPatch {
  firstName?: string;
  lastName?: string;
  middleName?: string | null;
  birthDate?: string | null;
  citizenship?: string | null;
  gender?: 'MALE' | 'FEMALE' | 'UNKNOWN';
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}
export interface GuestsRepository {
  search(q: string, limit: number): Promise<GuestSummary[]>;
  /** Справочник «Гости v2»: одна строка — один гость, состояние вычисляется из его проживаний */
  directory(query: {
    state: GuestDirectoryFilter;
    q: string;
    page: number;
    pageSize: number;
  }): Promise<GuestDirectoryResult>;
  byId(id: string): Promise<GuestProfile | null>;
  update(id: string, patch: GuestPatch): Promise<void>;
  addDocument(
    guestId: string,
    d: {
      type: string;
      numberEncrypted: string;
      issueCountry: string | null;
      issuedAtEncrypted: string | null;
      expiresAtEncrypted: string | null;
    },
  ): Promise<string>;
  /** Удалённый документ (его тип — для журнала) или null, если такого нет */
  deleteDocument(guestId: string, documentId: string): Promise<{ type: string } | null>;
  /** Без ПД: только имена изменённых полей */
  /** Журнал: имена полей без значений; `details` — идентификаторы (какой документ), не данные гостя */
  audit(
    guestId: string,
    action: string,
    fields: string[],
    details?: Record<string, unknown>,
  ): Promise<void>;
}
export const GUESTS_REPOSITORY = Symbol('GUESTS_REPOSITORY');

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);

@Injectable()
export class PrismaGuestsRepository implements GuestsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  /**
   * Замок организаций (ADR-061, Q-152). У гостя нет своего объекта: вошедший видит гостя, если у того есть бронь
   * объекта его организации — основным гостем или на проживании. Служебный ходок (сторож, скрипты) — как раньше.
   */
  private async visible(): Promise<Prisma.GuestWhereInput> {
    if (!actsForOrganization()) return {};
    const propertyId = await propertyIdRef(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    return {
      OR: [
        { primaryReservations: { some: { propertyId } } },
        { stays: { some: { reservationItem: { reservation: { propertyId } } } } },
      ],
    };
  }
  async search(q: string, limit: number): Promise<GuestSummary[]> {
    const digits = q.replace(/\D/g, '');
    const rows = await this.prisma.db.guest.findMany({
      where: {
        AND: [
          await this.visible(),
          {
            OR: [
              { lastName: { contains: q, mode: 'insensitive' } },
              { firstName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
            ],
          },
        ],
      },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
      take: limit,
      include: { stays: { include: { reservationItem: { select: { arrivalDate: true } } } } },
    });
    return rows.map((g) => ({
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      middleName: g.middleName,
      phone: g.phone,
      email: g.email,
      citizenship: g.citizenship,
      staysCount: g.stays.length,
      lastStay:
        g.stays
          .map((s) => iso(s.reservationItem.arrivalDate)!)
          .sort()
          .at(-1) ?? null,
    }));
  }
  /**
   * Справочник «Гости v2» (ТЗ 27.09.2026, план plans/guests-v2-2026-09-27.md). SQL-условия разделов
   * повторяют определения summarizeGuestStays: живёт — есть CHECKED_IN; ожидается — не живёт и есть
   * CONFIRMED/TENTATIVE с выездом не раньше сегодня; недавние — не первые два и выехал за 30 дней.
   * Числа чипов считаются тем же отбором без раздела — видно до нажатия, как на «Бронях».
   */
  async directory(query: {
    state: GuestDirectoryFilter;
    q: string;
    page: number;
    pageSize: number;
  }): Promise<GuestDirectoryResult> {
    const today = await propertyToday(this.prisma.db, LUXX_APARTS_PROPERTY.name);
    const inhouse: Prisma.GuestWhereInput = {
      stays: { some: { reservationItem: { status: 'CHECKED_IN' } } },
    };
    const expectedSome: Prisma.GuestWhereInput = {
      stays: {
        some: {
          reservationItem: {
            status: { in: ['CONFIRMED', 'TENTATIVE'] },
            departureDate: { gte: asDate(today) },
          },
        },
      },
    };
    const recentSome: Prisma.GuestWhereInput = {
      stays: {
        some: {
          reservationItem: {
            status: 'CHECKED_OUT',
            departureDate: { gte: asDate(shiftDate(today, -GUEST_RECENT_DAYS)) },
          },
        },
      },
    };
    const byState: Record<Exclude<GuestDirectoryFilter, 'ALL'>, Prisma.GuestWhereInput> = {
      INHOUSE: inhouse,
      EXPECTED: { AND: [expectedSome, { NOT: inhouse }] },
      RECENT: { AND: [recentSome, { NOT: inhouse }, { NOT: expectedSome }] },
    };
    const q = query.q;
    const digits = q.replace(/\D/g, '');
    const search: Prisma.GuestWhereInput = q
      ? {
          OR: [
            { lastName: { contains: q, mode: 'insensitive' } },
            { firstName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
            // человека можно найти и по номеру его брони (ТЗ §6)
            {
              stays: {
                some: {
                  reservationItem: {
                    reservation: { confirmationNumber: { contains: q, mode: 'insensitive' } },
                  },
                },
              },
            },
          ],
        }
      : {};
    const base: Prisma.GuestWhereInput = { AND: [await this.visible(), search] };
    const whereFor = (f: GuestDirectoryFilter): Prisma.GuestWhereInput =>
      f === 'ALL' ? base : { AND: [base, byState[f]] };
    const [all, inh, exp, rec] = await Promise.all([
      this.prisma.db.guest.count({ where: whereFor('ALL') }),
      this.prisma.db.guest.count({ where: whereFor('INHOUSE') }),
      this.prisma.db.guest.count({ where: whereFor('EXPECTED') }),
      this.prisma.db.guest.count({ where: whereFor('RECENT') }),
    ]);
    const counts = { ALL: all, INHOUSE: inh, EXPECTED: exp, RECENT: rec };
    const rows = await this.prisma.db.guest.findMany({
      where: whereFor(query.state),
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        middleName: true,
        phone: true,
        email: true,
        // одним запросом на страницу, без рейса на каждого гостя (ТЗ §45)
        stays: {
          select: {
            reservationItem: {
              select: {
                status: true,
                arrivalDate: true,
                departureDate: true,
                accommodationType: { select: { name: true } },
                allocations: {
                  orderBy: { startDate: 'desc' },
                  take: 1,
                  select: { inventoryUnit: { select: { code: true } } },
                },
              },
            },
          },
        },
      },
    });
    return {
      total: counts[query.state],
      page: query.page,
      pageSize: query.pageSize,
      counts,
      rows: rows.map((g) => ({
        id: g.id,
        firstName: g.firstName,
        lastName: g.lastName,
        middleName: g.middleName,
        phone: g.phone,
        email: g.email,
        ...summarizeGuestStays(
          g.stays.map((s) => ({
            status: s.reservationItem.status,
            arrivalDate: iso(s.reservationItem.arrivalDate)!,
            departureDate: iso(s.reservationItem.departureDate)!,
            unitCode: s.reservationItem.allocations[0]?.inventoryUnit.code ?? null,
            accommodationTypeName: s.reservationItem.accommodationType.name,
          })),
          today,
        ),
      })),
    };
  }
  async byId(id: string): Promise<GuestProfile | null> {
    const g = await this.prisma.db.guest.findFirst({
      where: { AND: [{ id }, await this.visible()] },
      include: {
        documents: { orderBy: { createdAt: 'asc' } },
        stays: {
          include: {
            reservationItem: {
              include: {
                reservation: { select: { confirmationNumber: true } },
                accommodationType: { select: { name: true } },
                allocations: {
                  orderBy: { startDate: 'desc' },
                  take: 1,
                  include: { inventoryUnit: { select: { code: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!g) return null;
    return {
      id: g.id,
      firstName: g.firstName,
      lastName: g.lastName,
      middleName: g.middleName,
      birthDate: iso(g.birthDate),
      citizenship: g.citizenship,
      gender: g.gender,
      phone: g.phone,
      email: g.email,
      notes: g.notes,
      documents: g.documents.map((d) => ({
        id: d.id,
        type: d.type,
        numberEncrypted: d.numberEncrypted,
        issueCountry: d.issueCountry,
        issuedAtEncrypted: d.issuedAtEncrypted,
        expiresAtEncrypted: d.expiresAtEncrypted,
      })),
      stays: g.stays
        .map((s) => ({
          confirmationNumber: s.reservationItem.reservation.confirmationNumber,
          accommodationTypeName: s.reservationItem.accommodationType.name,
          arrivalDate: iso(s.reservationItem.arrivalDate)!,
          departureDate: iso(s.reservationItem.departureDate)!,
          status: s.reservationItem.status,
          unitCode: s.reservationItem.allocations[0]?.inventoryUnit.code ?? null,
        }))
        .sort((a, b) => (a.arrivalDate < b.arrivalDate ? 1 : -1)),
    };
  }
  async update(id: string, p: GuestPatch): Promise<void> {
    await this.prisma.db.guest.update({
      where: { id },
      data: {
        ...(p.firstName !== undefined ? { firstName: p.firstName } : {}),
        ...(p.lastName !== undefined ? { lastName: p.lastName } : {}),
        ...(p.middleName !== undefined ? { middleName: p.middleName } : {}),
        ...(p.birthDate !== undefined
          ? { birthDate: p.birthDate ? asDate(p.birthDate) : null }
          : {}),
        ...(p.citizenship !== undefined ? { citizenship: p.citizenship } : {}),
        ...(p.gender !== undefined ? { gender: p.gender } : {}),
        ...(p.phone !== undefined ? { phone: p.phone } : {}),
        ...(p.email !== undefined ? { email: p.email } : {}),
        ...(p.notes !== undefined ? { notes: p.notes } : {}),
      },
    });
  }
  async addDocument(
    guestId: string,
    d: {
      type: string;
      numberEncrypted: string;
      issueCountry: string | null;
      issuedAtEncrypted: string | null;
      expiresAtEncrypted: string | null;
    },
  ): Promise<string> {
    const row = await this.prisma.db.guestDocument.create({
      data: {
        guestId,
        type: d.type,
        numberEncrypted: d.numberEncrypted,
        issueCountry: d.issueCountry,
        // v1.7 (ADR-082): в базе только шифртекст — дат открытым текстом в строке нет
        issuedAtEncrypted: d.issuedAtEncrypted,
        expiresAtEncrypted: d.expiresAtEncrypted,
      },
      select: { id: true },
    });
    return row.id;
  }
  async deleteDocument(guestId: string, documentId: string): Promise<{ type: string } | null> {
    const doc = await this.prisma.db.guestDocument.findFirst({
      where: { id: documentId, guestId },
      select: { type: true },
    });
    if (!doc) return null;
    const res = await this.prisma.db.guestDocument.deleteMany({
      where: { id: documentId, guestId },
    });
    return res.count > 0 ? doc : null;
  }
  async audit(
    guestId: string,
    action: string,
    fields: string[],
    details?: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.db.auditLog.create({
      data: {
        userId: auditUserId(),
        entityType: 'Guest',
        entityId: guestId,
        action,
        after: { ...(fields.length ? { fields } : {}), ...(details ?? {}) },
      },
    });
  }
}

import 'reflect-metadata';
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.provider';

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
    issuedAt: string | null;
    expiresAt: string | null;
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
  byId(id: string): Promise<GuestProfile | null>;
  update(id: string, patch: GuestPatch): Promise<void>;
  addDocument(
    guestId: string,
    d: {
      type: string;
      numberEncrypted: string;
      issueCountry: string | null;
      issuedAt: string | null;
      expiresAt: string | null;
    },
  ): Promise<string>;
  deleteDocument(guestId: string, documentId: string): Promise<boolean>;
  /** Без ПД: только имена изменённых полей */
  audit(guestId: string, action: string, fields: string[]): Promise<void>;
}
export const GUESTS_REPOSITORY = Symbol('GUESTS_REPOSITORY');

const asDate = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : null);

@Injectable()
export class PrismaGuestsRepository implements GuestsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}
  async search(q: string, limit: number): Promise<GuestSummary[]> {
    const digits = q.replace(/\D/g, '');
    const rows = await this.prisma.db.guest.findMany({
      where: {
        OR: [
          { lastName: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
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
  async byId(id: string): Promise<GuestProfile | null> {
    const g = await this.prisma.db.guest.findUnique({
      where: { id },
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
        issuedAt: iso(d.issuedAt),
        expiresAt: iso(d.expiresAt),
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
      issuedAt: string | null;
      expiresAt: string | null;
    },
  ): Promise<string> {
    const row = await this.prisma.db.guestDocument.create({
      data: {
        guestId,
        type: d.type,
        numberEncrypted: d.numberEncrypted,
        issueCountry: d.issueCountry,
        issuedAt: d.issuedAt ? asDate(d.issuedAt) : null,
        expiresAt: d.expiresAt ? asDate(d.expiresAt) : null,
      },
      select: { id: true },
    });
    return row.id;
  }
  async deleteDocument(guestId: string, documentId: string): Promise<boolean> {
    const res = await this.prisma.db.guestDocument.deleteMany({
      where: { id: documentId, guestId },
    });
    return res.count > 0;
  }
  async audit(guestId: string, action: string, fields: string[]): Promise<void> {
    await this.prisma.db.auditLog.create({
      data: { entityType: 'Guest', entityId: guestId, action, after: { fields } },
    });
  }
}

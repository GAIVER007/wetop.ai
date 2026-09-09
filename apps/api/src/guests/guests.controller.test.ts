import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { decryptPii } from '@pms/shared';
import { PrismaService } from '../database/prisma.provider';
import { GuestsModule } from './guests.module';
import { GUESTS_REPOSITORY, type GuestProfile, type GuestsRepository } from './guests.repository';

const KEY = 'c'.repeat(64);
function makeFakes() {
  const guests = new Map<string, GuestProfile>([
    [
      'g1',
      {
        id: 'g1',
        firstName: 'Гость',
        lastName: 'Тестовый',
        middleName: null,
        birthDate: null,
        citizenship: null,
        gender: 'UNKNOWN',
        phone: '+70000000000',
        email: null,
        notes: null,
        documents: [],
        stays: [
          {
            confirmationNumber: 'B-1',
            accommodationTypeName: 'Одиночная',
            arrivalDate: '2026-10-01',
            departureDate: '2026-10-02',
            status: 'CONFIRMED',
            unitCode: '9001',
          },
        ],
      },
    ],
  ]);
  const audits: string[] = [];
  const repo: GuestsRepository = {
    async search(q) {
      return [...guests.values()]
        .filter(
          (g) =>
            g.lastName.toLowerCase().includes(q.toLowerCase()) ||
            (g.phone ?? '').includes(q.replace(/\D/g, '')),
        )
        .map((g) => ({
          id: g.id,
          firstName: g.firstName,
          lastName: g.lastName,
          middleName: g.middleName,
          phone: g.phone,
          email: g.email,
          citizenship: g.citizenship,
          staysCount: g.stays.length,
          lastStay: g.stays[0]?.arrivalDate ?? null,
        }));
    },
    async byId(id) {
      const g = guests.get(id);
      return g ? structuredClone(g) : null;
    },
    async update(id, patch) {
      Object.assign(guests.get(id)!, patch);
    },
    async addDocument(id, d) {
      const g = guests.get(id)!;
      g.documents.push({ id: `d${g.documents.length + 1}`, ...d });
      return `d${g.documents.length}`;
    },
    async deleteDocument(id, docId) {
      const g = guests.get(id)!;
      const n = g.documents.length;
      g.documents = g.documents.filter((d) => d.id !== docId);
      return g.documents.length < n;
    },
    async audit(_id, action) {
      audits.push(action);
    },
  };
  return { repo, guests, audits };
}

describe('guests API', () => {
  let app: INestApplication;
  let fakes = makeFakes();
  beforeEach(() => {
    fakes = makeFakes();
    process.env.PII_ENCRYPTION_KEY = KEY;
  });
  afterEach(() => {
    delete process.env.PII_ENCRYPTION_KEY;
  });
  beforeAll(async () => {
    const proxy = (get: () => object) =>
      new Proxy({}, { get: (_t, k) => (get() as Record<string, unknown>)[k as string] });
    const m = await Test.createTestingModule({ imports: [GuestsModule] })
      .overrideProvider(GUESTS_REPOSITORY)
      .useFactory({ factory: () => proxy(() => fakes.repo) })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();
    app = m.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });

  it('search by last name or phone digits; too short query → 400', async () => {
    expect(
      (await request(app.getHttpServer()).get('/guests?q=тест').expect(200)).body,
    ).toHaveLength(1);
    expect(
      (await request(app.getHttpServer()).get('/guests?q=%2B7 000').expect(200)).body,
    ).toHaveLength(1);
    await request(app.getHttpServer()).get('/guests?q=т').expect(400);
  });
  it('update validates citizenship as alpha-3, audits field names only', async () => {
    await request(app.getHttpServer())
      .patch('/guests/g1')
      .send({ citizenship: 'Казахстан' })
      .expect(400);
    const r = await request(app.getHttpServer())
      .patch('/guests/g1')
      .send({ citizenship: 'kaz', phone: '+70000000001' })
      .expect(200);
    expect(r.body).toMatchObject({
      citizenship: 'KAZ',
      phone: '+70000000001',
      stays: [{ confirmationNumber: 'B-1' }],
    });
    expect(fakes.audits).toEqual(['guest.update']);
    await request(app.getHttpServer()).patch('/guests/nope').send({ phone: '1' }).expect(404);
  });
  it('documents: stored encrypted, shown masked; 503 without the encryption key; delete', async () => {
    const r = await request(app.getHttpServer())
      .post('/guests/g1/documents')
      .send({ type: 'PASSPORT', number: 'N 1234567', issueCountry: 'kaz', expiresAt: '2030-01-01' })
      .expect(201);
    expect(r.body.documents).toEqual([
      {
        id: 'd1',
        type: 'PASSPORT',
        numberMasked: '****4567',
        issueCountry: 'KAZ',
        issuedAt: null,
        expiresAt: '2030-01-01',
      },
    ]);
    const stored = fakes.guests.get('g1')!.documents[0]!.numberEncrypted;
    expect(stored).not.toContain('1234567');
    expect(decryptPii(stored, KEY)).toBe('N 1234567');
    await request(app.getHttpServer())
      .post('/guests/g1/documents')
      .send({ type: 'DRIVER', number: 'x' })
      .expect(400);
    delete process.env.PII_ENCRYPTION_KEY;
    await request(app.getHttpServer())
      .post('/guests/g1/documents')
      .send({ type: 'PASSPORT', number: 'N 7654321' })
      .expect(503);
    process.env.PII_ENCRYPTION_KEY = KEY;
    await request(app.getHttpServer()).delete('/guests/g1/documents/d1').expect(200);
    await request(app.getHttpServer()).delete('/guests/g1/documents/d1').expect(404);
    expect(fakes.audits).toEqual(['guest.document.add', 'guest.document.delete']);
  });
});

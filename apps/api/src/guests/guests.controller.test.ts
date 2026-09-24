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
  /** Записи журнала целиком: какой документ добавлен, удалён, показан (SECURITY.md §1, §6) */
  const auditDetails: Array<{ action: string; details?: Record<string, unknown> }> = [];
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
      const doc = guests.get(id)?.documents.find((d) => d.id === docId);
      if (!doc) return null;
      const g = guests.get(id)!;
      g.documents = g.documents.filter((d) => d.id !== docId);
      return { type: doc.type };
    },
    async audit(_id, action, _fields, details) {
      audits.push(action);
      auditDetails.push({ action, ...(details ? { details } : {}) });
    },
  };
  return { repo, guests, audits, auditDetails };
}

describe('guests API', () => {
  let app: INestApplication;
  let fakes = makeFakes();
  beforeEach(() => {
    fakes = makeFakes();
    process.env.PII_ENCRYPTION_KEY = KEY;
    // Тесты ниже — поведение базы в Казахстане (A1). Режим до переезда — отдельный блок в конце (ADR-072)
    process.env.PII_STORAGE = 'real';
  });
  afterEach(() => {
    delete process.env.PII_ENCRYPTION_KEY;
    delete process.env.PII_STORAGE;
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
  it('citizenship is trimmed: spaces around the code are dropped, blank-only is null on save and on read', async () => {
    const padded = await request(app.getHttpServer())
      .patch('/guests/g1')
      .send({ citizenship: ' kaz ' })
      .expect(200);
    expect(padded.body.citizenship).toBe('KAZ');
    // Postgres CHAR(3) дополняет '' до '   '; такое значение — «нет гражданства», а не код страны
    const blank = await request(app.getHttpServer())
      .patch('/guests/g1')
      .send({ citizenship: '   ' })
      .expect(200);
    expect(blank.body.citizenship).toBeNull();
    expect(fakes.guests.get('g1')!.citizenship).toBeNull();
    // и то, что уже лежит в базе пробелами, наружу уходит как null — карточка, список, печать
    fakes.guests.get('g1')!.citizenship = '   ';
    expect(
      (await request(app.getHttpServer()).get('/guests/g1').expect(200)).body.citizenship,
    ).toBeNull();
    expect(
      (await request(app.getHttpServer()).get('/guests?q=тест').expect(200)).body[0].citizenship,
    ).toBeNull();
  });
  it('text fields: blank-only is null for optional ones and 400 for required names — never an empty string', async () => {
    // пробелы проверялись до обрезки: имя '   ' обходило «обязательно» и сохранялось пустым
    await request(app.getHttpServer()).patch('/guests/g1').send({ firstName: '   ' }).expect(400);
    await request(app.getHttpServer()).patch('/guests/g1').send({ lastName: ' ' }).expect(400);
    expect(fakes.guests.get('g1')!.firstName).toBe('Гость');
    const r = await request(app.getHttpServer())
      .patch('/guests/g1')
      .send({ phone: '   ', email: ' ', middleName: '\t', notes: '  ' })
      .expect(200);
    expect(r.body).toMatchObject({ phone: null, email: null, middleName: null, notes: null });
    const g = fakes.guests.get('g1')!;
    expect([g.phone, g.email, g.middleName, g.notes]).toEqual([null, null, null, null]);
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
    // SECURITY.md §1, §6: какой документ добавлен и удалён; карточка с документом — просмотр, тоже в журнале
    expect(fakes.audits).toEqual(['guest.document.add', 'guest.document.view', 'guest.document.delete']);
    expect(fakes.auditDetails).toEqual([
      { action: 'guest.document.add', details: { documentId: 'd1', type: 'PASSPORT' } },
      { action: 'guest.document.view', details: { documentIds: ['d1'] } },
      { action: 'guest.document.delete', details: { documentId: 'd1', type: 'PASSPORT' } },
    ]);
  });

  it('SECURITY.md §1: каждый просмотр карточки с документом пишется в журнал; без документов — нет', async () => {
    await request(app.getHttpServer()).get('/guests/g1').expect(200);
    expect(fakes.audits).toEqual([]);
    fakes.guests.get('g1')!.documents.push({
      id: 'dv',
      type: 'PASSPORT',
      numberEncrypted: 'не расшифруется — маска «недоступно»',
      issueCountry: 'KAZ',
      issuedAt: null,
      expiresAt: null,
    });
    await request(app.getHttpServer()).get('/guests/g1').expect(200);
    await request(app.getHttpServer()).get('/guests/g1').expect(200);
    expect(fakes.auditDetails).toEqual([
      { action: 'guest.document.view', details: { documentIds: ['dv'] } },
      { action: 'guest.document.view', details: { documentIds: ['dv'] } },
    ]);
  });

  describe('пока база не в Казахстане (PII_STORAGE не real, ADR-072)', () => {
    beforeEach(() => {
      delete process.env.PII_STORAGE;
    });

    it('новое имя, телефон, почта, дата рождения и заметки — 422 с объяснением; ничего не записано', async () => {
      for (const patch of [
        { firstName: 'Иван' },
        { lastName: 'Петров' },
        { middleName: 'Сергеевич' },
        { phone: '+70000000001' },
        { email: 'guest@example.invalid' },
        { birthDate: '1990-01-01' },
        { notes: 'позвонить' },
        { citizenship: 'KAZ', phone: '+70000000001' },
      ]) {
        const r = await request(app.getHttpServer()).patch('/guests/g1').send(patch).expect(422);
        expect(r.body.message).toContain('не в Казахстане');
      }
      expect(fakes.guests.get('g1')).toMatchObject({ phone: '+70000000000', citizenship: null });
      expect(fakes.audits).toEqual([]);
    });

    it('гражданство и пол меняются; тот же профиль целиком и стирание контакта — тоже', async () => {
      const r = await request(app.getHttpServer())
        .patch('/guests/g1')
        .send({
          firstName: 'Гость',
          lastName: 'Тестовый',
          phone: '+70000000000',
          citizenship: 'kaz',
          gender: 'FEMALE',
        })
        .expect(200);
      expect(r.body).toMatchObject({ citizenship: 'KAZ', gender: 'FEMALE' });
      const erased = await request(app.getHttpServer())
        .patch('/guests/g1')
        .send({ phone: null })
        .expect(200);
      expect(erased.body.phone).toBeNull();
    });

    it('документ не принимается — 422, номер никуда не записан; удалить старый можно', async () => {
      const r = await request(app.getHttpServer())
        .post('/guests/g1/documents')
        .send({ type: 'PASSPORT', number: 'N 1234567' })
        .expect(422);
      expect(r.body.message).toContain('не в Казахстане');
      expect(fakes.guests.get('g1')!.documents).toEqual([]);
    });

    it('GET /system/pii-storage говорит стойке режим заранее', async () => {
      expect(
        (await request(app.getHttpServer()).get('/system/pii-storage').expect(200)).body,
      ).toEqual({ storage: 'pseudonymized' });
      process.env.PII_STORAGE = 'real';
      expect(
        (await request(app.getHttpServer()).get('/system/pii-storage').expect(200)).body,
      ).toEqual({ storage: 'real' });
    });
  });
});

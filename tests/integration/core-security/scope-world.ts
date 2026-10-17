/**
 * CORE-SECURITY-FIX-01, часть 2 (O2=A, O3=A, O4=A, A3/F6): стенд границы филиала для ОГРАНИЧЕННЫХ сотрудников.
 *
 * Настоящий `AppModule` Nest на личной пустой PostgreSQL, роль `wetop_app` под RLS (как в production), вход по HTTP.
 * Данные вымышленные (ADR-010). Метки `S2…` в названиях позволяют по тексту ответа понять, чьи данные вернулись.
 *
 * Организация A: гостиница H1 (объект P1, «Luxx Aparts»), H2 (объект P2) в одном бизнесе `hot`; вторая гостиница
 * `hot2` (объект P3, свой бизнес); салон (бизнес `bea`, филиал LB); ресторан (бизнес `foo`, филиал LF).
 * Организация B: чужая гостиница. У организации A включено платное расширение «ИИ-продавец».
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import {
  createPrismaClient,
  createPropertyInChain,
  NEW_PROPERTY_DEFAULTS,
  type Db,
} from '@pms/database';
import { hashPassword, onboardingFlow } from '@pms/domain';
import { AppModule } from '../../../apps/api/src/app.module';
import { ARI_PUBLISHER, NoopAriPublisher } from '../../../apps/api/src/channels/ari-publisher';
import { forgetPropertyRef } from '../../../apps/api/src/database/property-ref';
import { isLocalDatabase } from '../../tools/seed-local';
import { deleteOrganizationChain } from '../../tools/property-owner';
import { purgeAuditRows } from '../../tools/audit-purge';

export type UserKey =
  | 'OWNER' // OWNER без назначений
  | 'ORG_MGR' // MANAGER без назначений (вся организация)
  | 'ORG_STAFF' // STAFF без назначений
  | 'BEA_MGR' // MANAGER, назначение на весь бизнес салона
  | 'BEA_LOC_STAFF' // STAFF, назначение на филиал салона LB
  | 'FOO_MGR' // MANAGER, назначение на филиал ресторана LF
  | 'H1_STAFF' // STAFF, назначение только на филиал H1
  | 'H1_MGR' // MANAGER, назначение только на филиал H1
  | 'H2_MGR' // MANAGER, назначение только на филиал H2
  | 'H2_STAFF' // STAFF, назначение только на филиал H2
  | 'HOT_MGR' // MANAGER, назначение на весь бизнес гостиницы hot
  | 'HOT2_MGR' // MANAGER, назначение на филиал P3 второй гостиницы hot2
  | 'FOREIGN'; // OWNER организации B

/** Ограниченные: у них есть назначения (MembershipScope) */
export const RESTRICTED: readonly UserKey[] = [
  'BEA_MGR',
  'BEA_LOC_STAFF',
  'FOO_MGR',
  'H1_STAFF',
  'H1_MGR',
  'H2_MGR',
  'H2_STAFF',
  'HOT_MGR',
  'HOT2_MGR',
];
/** Без ограничений: прежнее поведение обязано сохраниться */
export const UNRESTRICTED: readonly UserKey[] = ['OWNER', 'ORG_MGR', 'ORG_STAFF'];

export const SCOPES = [
  'NONE',
  'BEA',
  'BEA+LB',
  'FOO+LF',
  'HOT',
  'HOT+H1',
  'HOT+H2',
  'HOT2+H3',
] as const;
export type ScopeKey = (typeof SCOPES)[number];

export interface ScopeWorld {
  db: Db;
  app: INestApplication;
  ids: Record<string, string>;
  tokens: Record<UserKey, string>;
  call(
    user: UserKey,
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    opts?: { scope?: ScopeKey | string; body?: unknown; headers?: Record<string, string> },
  ): Promise<{ status: number; text: string; tokens: string[]; json: unknown }>;
  close(): Promise<void>;
}

/** Указатель, который ограниченный человек отправляет сам: его собственное место */
export const OWN_SCOPE: Partial<Record<UserKey, ScopeKey>> = {
  BEA_MGR: 'BEA',
  BEA_LOC_STAFF: 'BEA+LB',
  FOO_MGR: 'FOO+LF',
  H1_STAFF: 'HOT+H1',
  H1_MGR: 'HOT+H1',
  H2_MGR: 'HOT+H2',
  H2_STAFF: 'HOT+H2',
  HOT_MGR: 'HOT',
  HOT2_MGR: 'HOT2+H3',
};

/** Метки, по которым в тексте ответа узнают, чьи данные вернулись */
const TOKENS = [
  'S2P1',
  'S2P2',
  'S2P3',
  'S2BEA',
  'S2FOO',
  'S2ORGB',
  'S2GH1',
  'S2GH2',
  'S2GH3',
  'S2GORGB',
] as const;
export const tokensIn = (text: string): string[] => [
  ...new Set([
    ...TOKENS.filter((t) => text.includes(t)),
    ...(text.includes('Luxx Aparts') ? ['S2P1'] : []),
  ]),
];

export async function buildScopeWorld(
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<ScopeWorld> {
  if (!isLocalDatabase(process.env.DATABASE_URL ?? ''))
    throw new Error('Isolated local DB required');
  const saved = { ...process.env };
  for (const key of Object.keys(process.env))
    if (
      /^(CHANNEX|EQONAQ|FISCAL|TELEGRAM|SMTP|MAIL|RESEND|OPENAI|ASSISTANT|GUARD|SERVICE_API_KEY)/.test(
        key,
      )
    )
      delete process.env[key];
  process.env.AUTH_REQUIRED = '1';
  process.env.NODE_ENV = 'test';
  // как в production: запросы организации идут ролью wetop_app под RLS
  const appUrl = new URL(process.env.DATABASE_URL!);
  appUrl.username = 'wetop_app';
  appUrl.password = '';
  process.env.DATABASE_APP_URL = appUrl.toString();

  const db = createPrismaClient(process.env.DATABASE_URL!, 'pms_test');
  const m = randomUUID().slice(0, 8);
  const base = { ...NEW_PROPERTY_DEFAULTS };
  const orgA = await db.organization.create({ data: { name: `TEST s2 A ${m}`, status: 'ACTIVE' } });
  const orgB = await db.organization.create({ data: { name: `TEST s2 B ${m}`, status: 'ACTIVE' } });
  const p1 = await createPropertyInChain(db, orgA.id, { name: 'Luxx Aparts', ...base });
  const loc = (id: string) => db.location.findUniqueOrThrow({ where: { id } });
  const h1 = await loc(p1.locationId);
  // H2 в том же бизнесе, что и H1 (businessId указан явно)
  const p2 = await createPropertyInChain(
    db,
    orgA.id,
    { name: `S2P2 hotel ${m}`, ...base },
    h1.businessId,
  );
  const h2 = await loc(p2.locationId);
  // вторая гостиница организации: свой бизнес
  const hot2 = await db.business.create({
    data: { organizationId: orgA.id, name: `S2P3 biz ${m}`, vertical: 'HOSPITALITY' },
  });
  const p3 = await createPropertyInChain(
    db,
    orgA.id,
    { name: `S2P3 hotel ${m}`, ...base },
    hot2.id,
  );
  const h3 = await loc(p3.locationId);
  await db.business.update({ where: { id: h1.businessId }, data: { name: `S2P1 biz ${m}` } });
  const pB = await createPropertyInChain(db, orgB.id, { name: `S2ORGB hotel ${m}`, ...base });
  const hB = await loc(pB.locationId);
  const bea = await db.business.create({
    data: { organizationId: orgA.id, name: `S2BEA biz ${m}`, vertical: 'BEAUTY' },
  });
  const foo = await db.business.create({
    data: { organizationId: orgA.id, name: `S2FOO biz ${m}`, vertical: 'FOOD_SERVICE' },
  });
  const lb = await db.location.create({
    data: {
      businessId: bea.id,
      name: `S2BEA salon ${m}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
    },
  });
  const lf = await db.location.create({
    data: {
      businessId: foo.id,
      name: `S2FOO resto ${m}`,
      timezone: 'Asia/Almaty',
      currency: 'KZT',
    },
  });

  // данные гостиниц с метками
  for (const [prop, tok] of [
    [p1, 'S2P1'],
    [p2, 'S2P2'],
    [p3, 'S2P3'],
    [pB, 'S2ORGB'],
  ] as const)
    await db.deskTask.create({
      data: { propertyId: prop.id, title: `${tok} task`, dueDate: new Date('2030-01-01') },
    });

  // гости организации A (по одному на H1, H2, hot2) и чужой организации; у Guest ключа филиала нет (ADR-100 §17.2)
  const guestOf = async (
    organizationId: string,
    last: string,
    extra: Record<string, string> = {},
  ) =>
    db.guest.create({
      data: {
        organizationId,
        firstName: 'Test',
        lastName: `${last}x${m}`,
        phone: `+7700${Math.floor(1000000 + Math.random() * 8999999)}`,
        email: `${last.toLowerCase()}-${m}@example.invalid`,
        notes: `secret note ${last}`,
        ...extra,
      },
    });
  const gH1 = await guestOf(orgA.id, 'S2GH1');
  const gH2 = await guestOf(orgA.id, 'S2GH2');
  const gH3 = await guestOf(orgA.id, 'S2GH3');
  const gForeign = await guestOf(orgB.id, 'S2GORGB');

  // черновик первичной настройки чужого (для ограниченных) филиала H2: по нему видно, ушёл ли он в ответ
  const flow = onboardingFlow('HOSPITALITY');
  await db.onboardingProgress.create({
    data: {
      locationId: h2.id,
      flowVersion: flow.version,
      currentStep: flow.steps[0]!.id,
      draft: {
        rows: [
          {
            name: 'S2SECRETDRAFT',
            kind: 'PRIVATE_ROOM',
            capacityAdults: '2',
            units: '1',
            price: '1',
          },
        ],
      },
    },
  });

  // платное расширение продавца: без него маршруты продавца отвечают «не подключено» и граница не видна
  await db.organizationExtension.create({
    data: {
      organizationId: orgA.id,
      extension: 'AI_SELLER',
      status: 'ACTIVE',
      updatedAt: new Date(),
    },
  });

  // люди
  const password = randomBytes(24).toString('base64url') + 'aA1!';
  const passwordHash = await hashPassword(password);
  type Spec = [
    UserKey,
    string,
    'OWNER' | 'MANAGER' | 'STAFF',
    string,
    Array<{ role: 'MANAGER' | 'STAFF'; businessId: string; locationId: string | null }>,
  ];
  const spec: Spec[] = [
    ['OWNER', orgA.id, 'OWNER', 'owner', []],
    ['ORG_MGR', orgA.id, 'MANAGER', 'orgmgr', []],
    ['ORG_STAFF', orgA.id, 'STAFF', 'orgstaff', []],
    [
      'BEA_MGR',
      orgA.id,
      'MANAGER',
      'beamgr',
      [{ role: 'MANAGER', businessId: bea.id, locationId: null }],
    ],
    [
      'BEA_LOC_STAFF',
      orgA.id,
      'STAFF',
      'bealoc',
      [{ role: 'STAFF', businessId: bea.id, locationId: lb.id }],
    ],
    [
      'FOO_MGR',
      orgA.id,
      'MANAGER',
      'foomgr',
      [{ role: 'MANAGER', businessId: foo.id, locationId: lf.id }],
    ],
    [
      'H1_STAFF',
      orgA.id,
      'STAFF',
      'h1staff',
      [{ role: 'STAFF', businessId: h1.businessId, locationId: h1.id }],
    ],
    [
      'H1_MGR',
      orgA.id,
      'MANAGER',
      'h1mgr',
      [{ role: 'MANAGER', businessId: h1.businessId, locationId: h1.id }],
    ],
    [
      'H2_MGR',
      orgA.id,
      'MANAGER',
      'h2mgr',
      [{ role: 'MANAGER', businessId: h1.businessId, locationId: h2.id }],
    ],
    [
      'H2_STAFF',
      orgA.id,
      'STAFF',
      'h2staff',
      [{ role: 'STAFF', businessId: h1.businessId, locationId: h2.id }],
    ],
    [
      'HOT_MGR',
      orgA.id,
      'MANAGER',
      'hotmgr',
      [{ role: 'MANAGER', businessId: h1.businessId, locationId: null }],
    ],
    [
      'HOT2_MGR',
      orgA.id,
      'MANAGER',
      'hot2mgr',
      [{ role: 'MANAGER', businessId: hot2.id, locationId: h3.id }],
    ],
    ['FOREIGN', orgB.id, 'OWNER', 'foreign', []],
  ];
  const userIds: string[] = [];
  const emails: Record<string, string> = {};
  for (const [key, org, role, name, scopes] of spec) {
    const user = await db.user.create({
      data: { email: `s2-${name}-${m}@example.invalid`, emailVerifiedAt: new Date(), passwordHash },
    });
    userIds.push(user.id);
    emails[key] = user.email;
    await db.membership.create({ data: { organizationId: org, userId: user.id, role } });
    for (const s of scopes)
      await db.membershipScope.create({
        data: {
          organizationId: org,
          userId: user.id,
          role: s.role,
          businessId: s.businessId,
          locationId: s.locationId,
        },
      });
  }

  forgetPropertyRef();
  const module = await configure(
    Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ARI_PUBLISHER)
      .useClass(NoopAriPublisher),
  ).compile();
  const app = module.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');

  const tokens = {} as Record<UserKey, string>;
  for (const [key] of spec) {
    // единичный «socket hang up» на первом соединении супертеста: вход безопасно повторить
    const attempt = () =>
      request(app.getHttpServer()).post('/auth/login').send({ email: emails[key], password });
    const login = await attempt().catch((error: Error) => {
      if (!/socket hang up|ECONNRESET/.test(error.message)) throw error;
      return attempt();
    });
    if (login.status !== 201)
      throw new Error(`login ${key} -> ${login.status} ${JSON.stringify(login.body)}`);
    tokens[key] = login.body.token as string;
  }

  const ids = {
    orgA: orgA.id,
    orgB: orgB.id,
    p1: p1.id,
    p2: p2.id,
    p3: p3.id,
    pB: pB.id,
    h1: h1.id,
    h2: h2.id,
    h3: h3.id,
    hB: hB.id,
    hot: h1.businessId,
    hot2: hot2.id,
    hotB: hB.businessId,
    bea: bea.id,
    foo: foo.id,
    lb: lb.id,
    lf: lf.id,
    gH1: gH1.id,
    gH2: gH2.id,
    gH3: gH3.id,
    gForeign: gForeign.id,
    m,
  };
  const pointer = (scope: ScopeKey): string | undefined => {
    switch (scope) {
      case 'NONE':
        return undefined;
      case 'BEA':
        return `business=${bea.id}`;
      case 'BEA+LB':
        return `business=${bea.id};location=${lb.id}`;
      case 'FOO+LF':
        return `business=${foo.id};location=${lf.id}`;
      case 'HOT':
        return `business=${h1.businessId}`;
      case 'HOT+H1':
        return `business=${h1.businessId};location=${h1.id}`;
      case 'HOT+H2':
        return `business=${h1.businessId};location=${h2.id}`;
      case 'HOT2+H3':
        return `business=${hot2.id};location=${h3.id}`;
    }
  };

  const world: ScopeWorld = {
    db,
    app,
    ids,
    tokens,
    async call(user, method, path, opts = {}) {
      const header =
        opts.scope === undefined
          ? undefined
          : (SCOPES as readonly string[]).includes(opts.scope)
            ? pointer(opts.scope as ScopeKey)
            : opts.scope;
      const send = async () => {
        const agent = request(app.getHttpServer());
        let req = agent[method](path).set('Authorization', `Bearer ${tokens[user]}`);
        if (header) req = req.set('X-Wetop-Scope', header);
        for (const [k, v] of Object.entries(opts.headers ?? {})) req = req.set(k, v);
        if (opts.body !== undefined) req = req.send(opts.body as object);
        return req;
      };
      // единичные «socket hang up» на keep-alive соединении супертеста (сервер ответил 403 и закрыл соединение до
      // конца чтения тела): одна повторная отправка. В тестах границы повтор записи не мешает: они проверяют отсутствие записи
      const res = await send().catch((error: Error) => {
        if (!/socket hang up|ECONNRESET/.test(error.message)) throw error;
        return send();
      });
      const text = res.text ?? '';
      return { status: res.status, text, tokens: tokensIn(text), json: res.body as unknown };
    },
    async close() {
      await app.close();
      try {
        const orgs = [orgA.id, orgB.id];
        const props = [p1.id, p2.id, p3.id, pB.id];
        await db.organizationExtension.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.deskTask.deleteMany({ where: { propertyId: { in: props } } });
        await db.onboardingProgress.deleteMany({
          where: { locationId: { in: [h1.id, h2.id, h3.id, hB.id, lb.id, lf.id] } },
        });
        await purgeAuditRows(db, { organizationId: { in: orgs } });
        await db.guestDocument.deleteMany({ where: { guest: { organizationId: { in: orgs } } } });
        await db.guest.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.sellerPromptVersion
          .deleteMany({ where: { organizationId: { in: orgs } } })
          .catch(() => undefined);
        await db.sellerProfile.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.sellerAgent.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.session.deleteMany({ where: { userId: { in: userIds } } });
        await db.membershipScope.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.membership.deleteMany({ where: { organizationId: { in: orgs } } });
        await db.property.deleteMany({ where: { organizationId: { in: orgs } } });
        await deleteOrganizationChain(db, orgs);
        await db.organization.deleteMany({ where: { id: { in: orgs } } });
        await db.user.deleteMany({ where: { id: { in: userIds } } });
      } catch (error) {
        console.error(
          '[s2 cleanup] неполная очистка (тестовая схема pms_test):',
          (error as Error).message,
        );
      }
      forgetPropertyRef();
      await db.$disconnect();
      for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
      Object.assign(process.env, saved);
    },
  };
  return world;
}

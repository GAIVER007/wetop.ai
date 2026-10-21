/** Synthetic authentication only; onboarding uses the real service and isolated local database. */
import 'reflect-metadata';
import { cleanupOnboardingFixture } from './cleanup';
import { HotelService } from '../../apps/api/src/hotel/hotel.module';
import type { BusinessVertical } from '@pms/domain';
import { createServer } from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { AuthService } from '../../apps/api/src/auth/auth.service';
import { hashPassword } from '@pms/domain';
const restore = JSON.parse(readFileSync('qa-evidence/runtime-state.json','utf8'));
import { resolveScope, parseScopePointer } from '../../apps/api/src/auth/scope';
import { createPrismaClient } from '@pms/database';
import { SharedOnboardingService } from '../../apps/api/src/onboarding/onboarding.module';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { isLocalDatabase } from '../tools/seed-local';
import { OnboardingService } from '../../apps/api/src/hotel/onboarding';
import { createPropertyInChain, NEW_PROPERTY_DEFAULTS } from '@pms/database';
if (!process.env.DATABASE_URL || !isLocalDatabase(process.env.DATABASE_URL))
  throw new Error('Local isolated database required');
const db = createPrismaClient(process.env.DATABASE_URL, 'pms_test');
const service = new SharedOnboardingService({ db } as never);
const hotelSettings = new HotelService({db} as never);
const hotel = new OnboardingService({ db } as never, hotelSettings as never);
const userId = restore.contexts.A.userId;
const organizationId = restore.contexts.A.organizationId;
let actor = {
  userId,
  organizationId,
  role: 'OWNER' as const,
  vertical: 'BEAUTY' as BusinessVertical,
  scope: 'LOCATION' as const,
  businessId: '',
  locationId: '',
};
let vertical = 'BEAUTY';
let calls: string[] = [];
let signedIn = true;
let fault: 'before' | 'after' | null = null;
const contexts: Record<string, typeof actor> = restore.contexts;
async function makeContext(key: string, org: string, user: string) {
 if(contexts[key]) return;
 const business = await db.business.create({data:{organizationId:org,name:`QA-${key}`,vertical:'BEAUTY'}});
 const location = await db.location.create({data:{businessId:business.id,name:`QA-${key}`,timezone:'Asia/Almaty',currency:'KZT'}});
 contexts[key] = {...actor,organizationId:org,userId:user,businessId:business.id,locationId:location.id};
}
await makeContext('A',organizationId,userId);
await makeContext('A2',organizationId,userId);
const orgB = contexts.B.organizationId, userB = contexts.B.userId;
await makeContext('B',orgB,userB);
actor = {...restore.actor};
vertical = actor.vertical;
let requireRealAuth = false;
let lastToken = '';
const auth = new AuthService({db} as never,{ } as never);
const testPassword = randomBytes(24).toString('base64url')+'aA1!';
const passwordHash = await hashPassword(testPassword);
const loginEmail = `mv3-${userId}@example.invalid`;
await db.user.update({where:{id:userId},data:{passwordHash,emailVerifiedAt:new Date(),status:'ACTIVE'}});
await db.membership.upsert({where:{userId_organizationId:{userId,organizationId}},create:{userId,organizationId,role:'OWNER'},update:{role:'OWNER'}});
writeFileSync('qa-evidence/temporary-credential.json',JSON.stringify({email:loginEmail,password:testPassword}),{mode:0o600});


const server = createServer(async (req, res) => {
  res.setHeader('content-type', 'application/json');
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try {
    const body = raw ? JSON.parse(raw) : {};
    const path = req.url?.split('?')[0];
    if (path === '/__qa/control') {
      if(body.context) {actor={...contexts[body.context]};vertical=actor.vertical;}
      if(body.role) actor={...actor,role:body.role};
      if(typeof body.signedIn==='boolean') signedIn=body.signedIn;
      if(body.status) await db.organization.update({where:{id:actor.organizationId},data:{status:body.status}});
      if(body.fault) fault=body.fault;
      if(typeof body.requireRealAuth==='boolean')requireRealAuth=body.requireRealAuth;
      if(body.revoke)await auth.logout(lastToken);

      res.end(JSON.stringify({actor,signedIn}));return;
    }
    if (path === '/__qa/snapshot') {
      const rows=await db.onboardingProgress.findMany({orderBy:{locationId:'asc'}});
      const counts = {organizations:await db.organization.count(),businesses:await db.business.count(),locations:await db.location.count(),users:await db.user.count(),properties:await db.property.count(),units:await db.inventoryUnit.count(),categories:await db.accommodationType.count(),rates:await db.ratePlan.count(),progress:rows.length,audits:await db.auditLog.count()};
      res.end(JSON.stringify({contexts,actor,counts,rows}));return;
    }
    if(path === '/auth/login' && req.method==='POST'){
      const result=await auth.login(body);lastToken=result.token;res.end(JSON.stringify(result));return;
    }
    if(path === '/auth/logout' && req.method==='POST'){
      await auth.logout(String(req.headers['x-wetop-session']||lastToken));res.end('{}');return;
    }
    if(path === '/auth/registration-context'){res.end('null');return;}
    if(requireRealAuth){
      const token=String(req.headers['x-wetop-session']||'');
      const identity=token ? await auth.whoami(token) : null;
      signedIn=!!identity;
      if(identity)actor={...actor,userId:identity.user.id,organizationId:identity.user.organizationId,role:identity.user.role as 'OWNER'};
    }
    if(path === '/auth/options'){res.end(JSON.stringify({registrationEnabled:false}));return;}

    if (path === '/__test/health') {
      res.end('{}');
      return;
    }
    if (path === '/__test/cleanup') {
      await cleanupOnboardingFixture(db, organizationId, userId);
      res.end('{}');
      return;
    }
    if (path === '/__test/reset') {
      vertical = body.vertical ?? 'BEAUTY';
      calls = [];
      await db.organization.update({
        where: { id: organizationId },
        data: { status: body.readOnly ? 'READ_ONLY' : 'ACTIVE' },
      });
      if (vertical === 'HOSPITALITY') {
        const property = await db.$transaction((tx) =>
          createPropertyInChain(tx, organizationId, {
            name: 'Тестовый отель',
            ...NEW_PROPERTY_DEFAULTS,
          }),
        );
        const location = await db.location.findUniqueOrThrow({
          where: { id: property.locationId },
        });
        actor = { ...actor, locationId: location.id, businessId: location.businessId };
      } else {
        const business = await db.business.create({
          data: {
            organizationId,
            name: 'Тестовый бизнес',
            vertical: vertical as 'BEAUTY' | 'FOOD_SERVICE',
          },
        });
        const location = await db.location.create({
          data: {
            businessId: business.id,
            name: 'Первый филиал',
            timezone: NEW_PROPERTY_DEFAULTS.timezone,
            currency: NEW_PROPERTY_DEFAULTS.currency,
          },
        });
        actor = { ...actor, businessId: business.id, locationId: location.id };
      }
      actor = { ...actor, vertical: vertical as BusinessVertical };
      res.end(JSON.stringify(actor));
      return;
    }
    if (path === '/__test/calls') {
      res.end(JSON.stringify(calls));
      return;
    }
    calls.push(path ?? '');
    if (path === '/auth/me') {
      res.end(
        JSON.stringify({
          user: signedIn ? {
            ...actor,
            id: actor.userId,
            name: 'Тестовый владелец',
            email: 'owner@example.invalid',
            platformAdmin: false,
          } : null,
          context: { ...actor, vertical },
        }),
      );
      return;
    }
    if(!signedIn){res.statusCode=401;res.end(JSON.stringify({message:'QA session signed out'}));return;}
    if(path==='/onboarding' && req.method==='POST' && fault==='before'){fault=null;res.statusCode=503;res.end(JSON.stringify({message:'QA interrupted before commit'}));return;}
    let requestActor = {...actor};
    if(req.headers['x-wetop-scope']) {
      const scope = await resolveScope(db,actor.organizationId,parseScopePointer(req.headers['x-wetop-scope']));
      requestActor={...actor,businessId:undefined,locationId:undefined,...scope} as typeof actor;
    }
    const result = await withSignedInUser(requestActor, async () => {
      if (path === '/onboarding')
        return req.method === 'POST' ? service.save(body) : service.status();
      if (path === '/hotel/settings') {
         return hotelSettings.settings();
      }
      if (path === '/hotel/onboarding')
        return req.method === 'POST' ? hotel.provision(body) : hotel.status();
      return null;
    });
    if(path==='/onboarding' && req.method==='POST' && fault==='after'){fault=null;res.statusCode=503;res.end(JSON.stringify({message:'QA response lost after commit'}));return;}
    if (result === null) res.statusCode = 404;
    res.end(JSON.stringify(result));
  } catch (error) {
    res.statusCode =
      typeof (error as { getStatus?: () => number }).getStatus === 'function'
        ? (error as { getStatus: () => number }).getStatus()
        : 500;
    res.end(JSON.stringify({ message: error instanceof Error ? error.message : 'Fixture error' }));
  }
});
server.listen(55804, '127.0.0.1');
// Fixtures are confined to the disposable local pms_test database, identified by MV3-browser prefix.
for (const signal of ['SIGTERM', 'SIGINT'] as const)
  process.on(signal, () => {
    server.close();
    void db.$disconnect().finally(() => process.exit(0));
  });

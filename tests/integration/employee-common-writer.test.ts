import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { databaseTenant, withSignedInUser } from '../../apps/api/src/auth/request-context';
import { BeautyCatalogService } from '../../apps/api/src/beauty/beauty.module';
import { EmployeePortalService } from '../../apps/api/src/employee-portal/employee-portal.service';
import { RestaurantService } from '../../apps/api/src/food-service/restaurant.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';

const url = process.env.DATABASE_URL!;
if (new URL(url).hostname !== '127.0.0.1') throw new Error('Owned local database required');
const admin = createPrismaClient(url, 'pms_test');
const app = createPrismaClient(url, 'pms_test', { of: databaseTenant, appConnectionString: process.env.DATABASE_APP_URL! });
const prisma = { db: app } as PrismaService;
const beauty = new BeautyCatalogService(prisma);
const portal = new EmployeePortalService(prisma, null);
const food = new RestaurantService(prisma, null, null as never);
async function fixture(vertical: 'BEAUTY'|'FOOD_SERVICE') {
  const org=randomUUID(), business=randomUUID(), location=randomUUID(), user=randomUUID(), employee=randomUUID();
  await admin.organization.create({data:{id:org,name:'TZ21 synthetic',status:'ACTIVE'}});
  await admin.business.create({data:{id:business,organizationId:org,name:'Synthetic business',vertical}});
  await admin.location.create({data:{id:location,businessId:business,name:'Synthetic branch',timezone:'UTC',currency:'KZT'}});
  await admin.user.create({data:{id:user,name:'Synthetic owner',email:`${user}@example.invalid`,emailVerifiedAt:new Date()}});
  await admin.membership.create({data:{userId:user,organizationId:org,role:'OWNER'}});
  await admin.employee.create({data:{id:employee,businessId:business,userId:user,name:'Original',phone:'original'}});
  await admin.employeeLocation.create({data:{employeeId:employee,locationId:location}});
  await admin.employeePublicProfile.create({data:{employeeId:employee,slug:randomUUID(),publicationConsent:true,published:true}});
  return {org,business,location,user,employee,vertical};
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
const as = <T>(f: Fixture, fn:()=>Promise<T>) => withSignedInUser({userId:f.user,organizationId:f.org,businessId:f.business,locationId:f.location,vertical:f.vertical,role:'OWNER',scope:'LOCATION'},fn);
async function snapshot(f:Fixture) {
  return {
    employee:await admin.employee.findUniqueOrThrow({where:{id:f.employee}}),
    profile:await admin.employeePublicProfile.findUniqueOrThrow({where:{employeeId:f.employee}}),
    links:await admin.employeeLocation.findMany({where:{employeeId:f.employee}}),
    audit:await admin.auditLog.count({where:{entityId:f.employee}}),
  };
}
const status = (e: unknown) => (e as { getStatus():number }).getStatus();
const outcome = (p:Promise<unknown>) => p.then(()=>200,e=>status(e));
const dto = (f:Fixture) => as(f,()=>portal.get(f.employee,{}));
function basic(f:Fixture, body:Record<string,unknown>) {
  return as<unknown>(f,()=>f.vertical==='BEAUTY'?beauty.updateEmployee(f.employee,body):food.updateEmployee(f.employee,body));
}
function profile(f:Fixture, d:Awaited<ReturnType<typeof dto>>, body:Record<string,unknown>) {
  return as(f,()=>portal.mutate(f.employee,'profile',{expectedRevision:d.profile.revision,expectedProfileRevision:d.employee.profileRevision,...body}));
}
describe('TZ2.1 common Employee original-version writer, PostgreSQL RLS',()=>{
  beforeAll(async()=>{ expect(process.env.DATABASE_APP_URL).toBeTruthy(); });
  afterAll(async()=>{await app.$disconnect();await admin.$disconnect();});
  it('runs as wetop_app without bypass or ownership',async()=>{
    const f=await fixture('BEAUTY');
    const r=await as(f,()=>app.$queryRaw<Array<{role:string;superuser:boolean;bypass:boolean;owns:boolean}>>`SELECT current_user::text role,r.rolsuper superuser,r.rolbypassrls bypass,c.relowner=r.oid owns FROM pg_roles r,pg_class c,pg_namespace n WHERE r.rolname=current_user AND c.relnamespace=n.oid AND n.nspname='pms_test' AND c.relname='employees'`);
    expect(r).toEqual([{role:'wetop_app',superuser:false,bypass:false,owns:false}]);
  });
  for(const vertical of ['BEAUTY','FOOD_SERVICE'] as const) {
    it(`${vertical}: basic winner then stale portal must conflict`,async()=>{
      const f=await fixture(vertical), d=await dto(f);
      await basic(f,{name:'Basic winner',expectedProfileRevision:d.employee.profileRevision});
      const before=await snapshot(f);
      expect(await outcome(profile(f,d,{name:'Stale portal',headline:'Must roll back'}))).toBe(409);
      expect(await snapshot(f)).toEqual(before);
      expect(before.employee.name).toBe('Basic winner');
    });
    it(`${vertical}: portal winner then stale basic must conflict`,async()=>{
      const f=await fixture(vertical), d=await dto(f);
      await profile(f,d,{name:'Portal winner'});
      const before=await snapshot(f);
      expect(await outcome(basic(f,{name:'Stale basic',expectedProfileRevision:d.employee.profileRevision}))).toBe(409);
      expect(await snapshot(f)).toEqual(before);
      expect(before.employee.name).toBe('Portal winner');
    });
    it(`${vertical}: simultaneous basic and portal saves have one winner`,async()=>{
      const f=await fixture(vertical), d=await dto(f);
      const results=await Promise.all([
        outcome(basic(f,{name:'Basic winner',expectedProfileRevision:d.employee.profileRevision})),
        outcome(profile(f,d,{name:'Portal winner',headline:'Portal headline'})),
      ]);
      expect([...results].sort()).toEqual([200,409]);
      const saved=await snapshot(f);
      expect(saved.employee.name).toBe(results[0]===200?'Basic winner':'Portal winner');
      expect(saved.profile.headline).toBe(saved.employee.name==='Portal winner'?'Portal headline':'');
    });
    it(`${vertical}: both original revisions are checked, including a profile-only competing change`,async()=>{
      const f=await fixture(vertical), d=await dto(f);
      await profile(f,d,{headline:'New headline'});
      const fresh=await dto(f), before=await snapshot(f);
      expect(fresh.employee.profileRevision).toBe(d.employee.profileRevision);
      expect(await outcome(profile(f,d,{name:'Must roll back',headline:'Stale headline'}))).toBe(409);
      expect(await snapshot(f)).toEqual(before);
    });
    it(`${vertical}: simultaneous portal saves cannot lose public profile edits`,async()=>{
      const f=await fixture(vertical), d=await dto(f);
      expect((await Promise.all(['A','B'].map(headline=>outcome(profile(f,d,{headline}))))).sort()).toEqual([200,409]);
      expect((await dto(f)).profile.revision).toBe(String(Number(d.profile.revision)+1));
    });
    it(`${vertical}: missing, malformed and millisecond-only versions fail closed for both writers`,async()=>{
      const f=await fixture(vertical), d=await dto(f), before=await snapshot(f);
      for(const version of [undefined,'',new Date(d.employee.profileRevision).toISOString(),'invalid']) {
        expect(await outcome(basic(f,{name:'Rejected',expectedProfileRevision:version}))).toBe(400);
        expect(await outcome(profile(f,d,{name:'Rejected',expectedProfileRevision:version}))).toBe(400);
        expect(await snapshot(f)).toEqual(before);
      }
    });
    it(`${vertical}: forbidden fields and foreign employee cannot alter either source`,async()=>{
      const f=await fixture(vertical), foreign=await fixture(vertical), d=await dto(f), before=await snapshot(f), other=await snapshot(foreign);
      for(const field of ['id','businessId','userId','organizationId','published','publicationConsent','revision','updatedAt','paySettings']) {
        expect(await outcome(basic(f,{name:'Rejected',expectedProfileRevision:d.employee.profileRevision,[field]:foreign.employee}))).toBe(400);
        expect(await outcome(profile(f,d,{name:'Rejected',[field]:foreign.employee}))).toBe(400);
      }
      expect(await outcome(as(f,()=>portal.mutate(foreign.employee,'profile',{name:'Foreign',expectedRevision:'0',expectedProfileRevision:d.employee.profileRevision})))).toBe(404);
      expect(await outcome(as<unknown>(f,()=>vertical==='BEAUTY'?beauty.updateEmployee(foreign.employee,{name:'Foreign',expectedProfileRevision:d.employee.profileRevision}):food.updateEmployee(foreign.employee,{name:'Foreign',expectedProfileRevision:d.employee.profileRevision})))).toBe(404);
      expect(await snapshot(f)).toEqual(before); expect(await snapshot(foreign)).toEqual(other);
    });
    it(`${vertical}: source microseconds survive reads and rapid saves; identity and consent survive`,async()=>{
      const f=await fixture(vertical);
      await admin.$executeRaw`UPDATE employees SET updated_at='2026-01-01T00:00:00.123456Z'::timestamptz WHERE id=${f.employee}::uuid`;
      let d=await dto(f);
      expect(d.employee.profileRevision).toBe('2026-01-01T00:00:00.123456Z');
      for(const name of ['One','Two','Three']) {
        const old=d.employee.profileRevision;
        await basic(f,{name,expectedProfileRevision:old}); d=await dto(f);
        expect(d.employee.profileRevision).not.toBe(old);
        expect(d.employee.profileRevision).toMatch(/\.\d{6}Z$/);
      }
      const saved=await snapshot(f);
      expect(saved.employee.id).toBe(f.employee); expect(saved.employee.userId).toBe(f.user);
      expect(saved.profile.publicationConsent).toBe(true); expect(saved.profile.published).toBe(true);
    });
    it(`${vertical}: SELF profile edits retain the existing unpublish policy`,async()=>{
      const f=await fixture(vertical), d=await dto(f);
      const saved=await as(f,()=>portal.mutate(null,'profile',{name:'Self draft',expectedRevision:d.profile.revision,expectedProfileRevision:d.employee.profileRevision}));
      expect(saved.profile.published).toBe(false);expect(saved.profile.publicationConsent).toBe(true);
      expect(saved.employee.id).toBe(f.employee);expect(saved.employee.accountLinked).toBe(true);
    });
  }
});

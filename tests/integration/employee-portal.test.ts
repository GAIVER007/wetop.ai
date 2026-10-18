import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '@pms/database';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { EmployeePortalService } from '../../apps/api/src/employee-portal/employee-portal.service';
import { assertPortalDatabase, seedPortalFixture } from '../employee-portal-ui/fixture-support';
import { DiskPortalStorage } from '../employee-portal-ui/disk-storage';
import { PrismaService } from '../../apps/api/src/database/prisma.provider';

// No fallback: the shared guard allows only owned local clusters or the dedicated GitHub job DB.
const db = createPrismaClient(assertPortalDatabase(),'pms_test');
const storage = new DiskPortalStorage();
const service = new EmployeePortalService({ db } as PrismaService, storage);
let f: Awaited<ReturnType<typeof seedPortalFixture>>;
const as = <T>(actor: 'ownerA'|'staffA'|'staffB'|'ownerB', fn:()=>Promise<T>) => withSignedInUser({...f.actors[actor],...(actor==='ownerB'?{}:{scope:'LOCATION' as const,locationId:f.locationA})},fn);

describe('employee portal real persistence and authorization',()=>{
  beforeAll(async()=>{ f=await seedPortalFixture(db); });
  afterAll(async()=>{await db.$disconnect();});
  it('resolves self from verified account, rejects other staff and manager route',async()=>{
    const dto=await as('staffA',()=>service.get(null,{}));
    expect(dto.access).toBe('SELF'); expect(dto.employee.id).toBe(f.employeeA);
    expect((dto as typeof dto & {canUpload?:boolean}).canUpload).toBe(true);
    const off=new EmployeePortalService({db} as PrismaService,null);
    const unavailable=await as('staffA',()=>off.get(null,{}));
    expect((unavailable as typeof unavailable & {canUpload?:boolean}).canUpload).toBe(false);
    expect(dto.pay.earnedMinor).toBeNull(); expect(dto.pay.status).toBe('NOT_CONFIGURED');
    await expect(as('staffA',()=>service.get(f.employeeB,{}))).rejects.toThrow();
    await expect(as('ownerB',()=>service.get(f.employeeA,{}))).rejects.toThrow();
  });
  it('persists private profile and requires manager reapproval after self edits',async()=>{
    let dto=await as('ownerA',()=>service.get(f.employeeA,{}));
    dto=await as('ownerA',()=>service.mutate(f.employeeA,'profile',{headline:'Specialist',expectedRevision:dto.profile.revision,expectedProfileRevision:dto.employee.profileRevision}));
    dto=await as('ownerA',()=>service.mutate(f.employeeA,'publication',{published:true,publicationConsent:true,expectedRevision:dto.profile.revision}));
    const pub=await service.publicProfile(dto.profile.slug);
    expect(pub.headline).toBe('Specialist'); expect(pub.locationId).toBeNull(); expect(pub.services).toEqual([]); expect(pub.locations).toHaveLength(2);
    expect(Object.keys(pub)).not.toContain('pay'); expect(JSON.stringify(pub)).not.toContain('private@example.invalid');
    const branch=await service.publicProfile(dto.profile.slug,f.locationA);
    expect(branch.services[0]?.priceMinor).toBe('6500');
    dto=await as('staffA',()=>service.mutate(null,'profile',{biography:'Updated by employee',expectedRevision:dto.profile.revision,expectedProfileRevision:dto.employee.profileRevision}));
    expect(dto.profile.published).toBe(false); await expect(service.publicProfile(dto.profile.slug)).rejects.toThrow();
    await expect(as('staffA',()=>service.mutate(null,'publication',{published:true,publicationConsent:true,expectedRevision:dto.profile.revision}))).rejects.toThrow();
    await expect(as('ownerA',()=>service.mutate(f.employeeA,'profile',{name:'Stale',expectedRevision:'0',expectedProfileRevision:dto.employee.profileRevision}))).rejects.toThrow();
  });
  it('persists own skills; week and absence are read-only for the employee, set by the manager',async()=>{
    let dto=await as('staffA',()=>service.get(null,{}));
    dto=await as('staffA',()=>service.mutate(null,'services',{serviceIds:[f.serviceId],expectedRevision:dto.servicesRevision}));
    expect(dto.services.find(s=>s.id===f.serviceId)?.assigned).toBe(true);
    // владелец 17.10.2026: сотрудник свой график только видит
    await expect(as('staffA',()=>service.mutate(null,'week',{intervals:[{weekday:1,timeFrom:'10:00',timeTo:'18:00'}],expectedRevision:dto.weekRevision}))).rejects.toThrow('График меняет руководитель');
    await expect(as('staffA',()=>service.mutate(null,'time-off',{dateFrom:'2026-11-01',dateTo:'2026-11-02'}))).rejects.toThrow('График меняет руководитель');
    dto=await as('ownerA',()=>service.mutate(f.employeeA,'week',{intervals:[{weekday:1,timeFrom:'10:00',timeTo:'18:00'}],expectedRevision:dto.weekRevision}));
    expect(dto.week.find(d=>d.weekday===1)?.intervals).toEqual([{timeFrom:'10:00',timeTo:'18:00'}]);
    dto=await as('ownerA',()=>service.mutate(f.employeeA,'time-off',{dateFrom:'2026-11-01',dateTo:'2026-11-02',reason:'Private reason'}));
    expect(dto.timeOffs.some(t=>t.reason==='Private reason')).toBe(true);
    await expect(as('staffB',()=>service.mutate(f.employeeA,'time-off',{dateFrom:'2026-11-01',dateTo:'2026-11-02'}))).rejects.toThrow();
    await expect(as('staffA',()=>service.mutate(null,'delete-time-off',{},dto.timeOffs[0]!.id))).rejects.toThrow('График меняет руководитель');
    expect((await as('staffA',()=>service.get(null,{}))).week.find(d=>d.weekday===1)?.intervals).toEqual([{timeFrom:'10:00',timeTo:'18:00'}]);
    dto=await as('ownerA',()=>service.mutate(f.employeeA,'delete-time-off',{},dto.timeOffs[0]!.id));
    expect(dto.timeOffs).toHaveLength(0);
  });
  it('exposes real pay settings and adjustments but never fabricates Beauty salary',async()=>{
    let dto=await as('ownerA',()=>service.mutate(f.employeeA,'pay-settings',{model:'FIXED_PLUS_PERCENT',fixedMinor:'150000',percent:15}));
    expect(dto.pay.fixedMinor).toBe('150000'); expect(dto.pay.earnedMinor).toBeNull();
    await as('ownerA',()=>service.setPolicy({percentBasis:'PAID_COMPLETED_SERVICES'}));
    dto=await as('staffA',()=>service.get(null,{}));
    expect(dto.pay.status).toBe('UNSUPPORTED_POLICY'); expect(dto.pay.percentBasis).toBe('PAID_COMPLETED_SERVICES');
    expect(dto.pay.remainingMinor).toBeNull();
    await expect(as('staffA',()=>service.mutate(null,'pay-settings',{model:'FIXED',fixedMinor:'999',percent:0}))).rejects.toThrow();
    await expect(as('staffA',()=>service.setPolicy({percentBasis:'COMPLETED_SERVICES'}))).rejects.toThrow();
  });
  it('account binding cannot hijack another user or overwrite existing link',async()=>{
    await expect(as('ownerA',()=>service.mutate(f.employeeA,'account',{userId:f.actors.staffB.userId}))).rejects.toThrow();
    await expect(as('staffA',()=>service.mutate(null,'unlink-account',{}))).rejects.toThrow();
    await as('ownerA',()=>service.mutate(f.employeeA,'unlink-account',{}));
    await expect(as('staffA',()=>service.get(null,{}))).rejects.toThrow();
    await as('ownerA',()=>service.mutate(f.employeeA,'account',{userId:f.actors.staffA.userId}));
    expect((await as('staffA',()=>service.get(null,{}))).employee.accountLinked).toBe(true);
  });
  it('persists actual processed bytes, enforces work ownership and truthful storage off',async()=>{
    // Owned valid PNG, actual processSiteImage conversion and durable binary persistence.
    const buffer=readFileSync(new URL('../employee-portal-ui/fixtures/avatar.png',import.meta.url));
    let dto=await as('staffA',()=>service.upload(null,'AVATAR',{buffer},{}));
    expect(dto.avatar?.url).toContain('127.0.0.1'); expect(await storage.existsByUrl(dto.avatar!.url)).toBe(true);
    const bytes=await storage.readByUrl(dto.avatar!.url);
    const saved=await as('staffA',()=>db.employeeMedia.findUniqueOrThrow({where:{id:dto.avatar!.id}}));
    expect(bytes.toString('ascii',0,4)).toBe('RIFF');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(saved.sha256);
    const originalAvatar=dto.avatar!.id;
    await expect(as('staffA',()=>service.upload(null,'AVATAR',{buffer:Buffer.from('not an image')},{}))).rejects.toThrow();
    expect((await as('staffA',()=>service.get(null,{}))).avatar!.id).toBe(originalAvatar);
    dto=await as('staffA',()=>service.upload(null,'PORTFOLIO',{buffer},{title:'Work',publicationConsent:true,published:true}));
    expect(dto.portfolio[0]?.published).toBe(false);
    const work=dto.portfolio[0]!;
    await expect(as('ownerA',()=>service.mutate(f.employeeB,'delete-work',{},work.id))).rejects.toThrow();
    expect(await storage.existsByUrl(work.image.url)).toBe(true);
    const off=new EmployeePortalService({db} as PrismaService,null);
    await expect(as('staffA',()=>off.upload(null,'AVATAR',{buffer},{}))).rejects.toThrow('storage');
    dto=await as('staffA',()=>service.mutate(null,'delete-work',{},work.id));
    expect(dto.portfolio).toHaveLength(0);
  });
});

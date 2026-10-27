import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createPrismaClient} from '@pms/database';
import {PrismaFinanceRepository} from '../../apps/api/src/finance/finance.repository';
import {withSignedInUser} from '../../apps/api/src/auth/request-context';
import {enableKzPropertyMethods} from './kz-methods-on';
const db=createPrismaClient('postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home','pms_test');
const repo=new PrismaFinanceRepository({db} as never);
import {FinanceService} from '../../apps/api/src/finance/finance.service';
import {FinanceController} from '../../apps/api/src/finance/finance.controller';
const controller=new FinanceController(new FinanceService(repo,{} as never));
it('actual controller returns original CashView after void and subsequent reconciliation',async()=>{
 const p={kind:'INCOME',method:'CASH',amount:'12.34',idempotencyKey:randomUUID()};
 const first=await scoped(()=>controller.createCashOperation(p));
 const row=await db.cashOperation.findFirstOrThrow({where:{propertyId},orderBy:{createdAt:'desc'}});
 await db.cashOperation.update({where:{id:row.id},data:{status:'VOIDED'}});
 expect(await scoped(()=>controller.createCashOperation(p))).toEqual(first);
 const transfer={from:'CASH',to:'KASPI',amount:'1',idempotencyKey:randomUUID()};
 const transferred=await scoped(()=>controller.createCashTransfer(transfer));
 const check={method:'CASH',counted:'3',adjust:true,idempotencyKey:randomUUID()};
 const reconciled=await scoped(()=>controller.createCashReconciliation(check));
 await scoped(()=>controller.createCashOperation({...p,idempotencyKey:randomUUID()}));
 expect(await scoped(()=>controller.createCashReconciliation(check))).toEqual(reconciled);
 expect(await scoped(()=>controller.createCashTransfer(transfer))).toEqual(transferred);
 await expect(withSignedInUser({userId:user,organizationId:randomUUID(),businessId:randomUUID(),locationId,role:'OWNER',scope:'LOCATION',vertical:'HOSPITALITY'},()=>controller.createCashOperation(p))).rejects.toThrow();
});
const user=randomUUID();let organizationId:string,businessId:string,locationId:string,propertyId:string;
const scoped=<T>(fn:()=>Promise<T>)=>withSignedInUser({userId:user,organizationId,businessId,locationId,role:'OWNER',scope:'LOCATION',vertical:'HOSPITALITY'},fn);
const body=()=>({kind:'INCOME' as const,method:'CASH' as const,methodTo:null,amountMinor:100n,categoryId:null,note:null,occurredAt:null,commission:null,idempotencyKey:randomUUID()});
beforeAll(async()=>{
 organizationId=(await db.organization.create({data:{name:'Synthetic hotel intents',status:'ACTIVE'}})).id;
 await db.user.create({data:{id:user,name:'Synthetic owner',email:`hotel-${user}@example.invalid`}});
 businessId=(await db.business.create({data:{organizationId,name:'Synthetic hotel',vertical:'HOSPITALITY'}})).id;
 locationId=(await db.location.create({data:{businessId,name:'Synthetic hotel',timezone:'Asia/Almaty',currency:'KZT'}})).id;
 propertyId=(await db.property.create({data:{organizationId,locationId,name:'Synthetic hotel',timezone:'Asia/Almaty',currency:'KZT',checkInTime:'14:00',checkOutTime:'12:00'}})).id;
 await enableKzPropertyMethods(db,propertyId); // объект сам включил Kaspi
 vi.stubEnv('EXPENSE_LINKS_ENABLED','1');
});
afterAll(async()=>{vi.unstubAllEnvs();await db.$disconnect();});
it('repository direct guard replays, rejects changes and missing key, concurrent fee once, transfer remains transfer',async()=>{
 const initial=await db.cashOperation.count({where:{propertyId}});
 const initialExpenses=await db.cashOperation.count({where:{propertyId,kind:'EXPENSE'}});
 const p=body();const first=await scoped(()=>repo.createCashOperation(p));
 expect(await scoped(()=>repo.createCashOperation(p))).toBe(first);
 await expect(scoped(()=>repo.createCashOperation({...p,amountMinor:101n}))).rejects.toMatchObject({status:409});
 await expect(scoped(()=>repo.createCashOperation({...p,idempotencyKey:undefined} as never))).rejects.toMatchObject({status:400});
 const fee={...body(),commission:{amountMinor:5n,categoryId:null}};
 const pair=await Promise.all([scoped(()=>repo.createCashOperation(fee)),scoped(()=>repo.createCashOperation(fee))]);expect(pair[0]).toBe(pair[1]);
 expect(await db.cashOperation.count({where:{propertyId}})).toBe(initial+3);
 const transfer={...body(),kind:'TRANSFER' as const,methodTo:'KASPI' as const};await scoped(()=>repo.createCashOperation(transfer));
 expect(await db.cashOperation.count({where:{propertyId,kind:'EXPENSE'}})).toBe(initialExpenses+1);
});
it('audit failure rolls back main fee and intent, same key can retry',async()=>{
 const p={...body(),commission:{amountMinor:7n,categoryId:null}};
 await expect(scoped(()=>repo.createCashOperation(p,{entityType:'CashOperation',action:null as never,after:{}}))).rejects.toThrow();
 const rows=await db.$queryRaw<Array<{n:bigint}>>`SELECT count(*) AS n FROM payment_write_intents WHERE location_id=${locationId}::uuid AND intent_key=${p.idempotencyKey}`;expect(rows[0]?.n).toBe(0n);
 const id=await scoped(()=>repo.createCashOperation(p));expect(await db.cashOperation.count({where:{relatedId:id}})).toBe(1);
});
it('reconciliation adjustment replays once despite changed derived balance',async()=>{
 const p={method:'CASH' as const,expectedMinor:100n,countedMinor:80n,note:null,adjustment:{kind:'EXPENSE' as const,amountMinor:20n,categoryName:'Synthetic shortage'},intentAdjust:true,idempotencyKey:randomUUID()};
 const id=await scoped(()=>repo.createCashReconciliation(p));expect(await scoped(()=>repo.createCashReconciliation({...p,expectedMinor:80n,adjustment:null}))).toBe(id);
 await expect(scoped(()=>repo.createCashReconciliation({...p,countedMinor:79n}))).rejects.toMatchObject({status:409});
});
it('feature off accepts missing key and bypasses held SQL in legacy adapter',async()=>{
 vi.stubEnv('EXPENSE_LINKS_ENABLED','0');
 const legacy={cashOperation:{create:async()=>({id:'legacy',occurredAt:new Date()})}};
 const fake=new PrismaFinanceRepository({db:{...legacy,property:db.property,$transaction:async(fn:(tx:unknown)=>unknown)=>fn(legacy)}} as never);
 expect(await scoped(()=>fake.createCashOperation({...body(),idempotencyKey:undefined} as never))).toBe('legacy');
 vi.stubEnv('EXPENSE_LINKS_ENABLED','1');
});

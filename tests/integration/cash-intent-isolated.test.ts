import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {createPrismaClient} from '@pms/database';
import {withSignedInUser} from '../../apps/api/src/auth/request-context';
import type {PrismaService} from '../../apps/api/src/database/prisma.provider';
import {RestaurantService} from '../../apps/api/src/food-service/restaurant.service';
import type {StockService} from '../../apps/api/src/food-service/stock.service';
const db=createPrismaClient('postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home','pms_test');
const user=randomUUID();let organizationId:string,businessId:string,locationId:string;
const writer=new RestaurantService({db} as PrismaService,null,{} as StockService);
const write=(body:unknown)=>withSignedInUser({userId:user,organizationId,role:'OWNER',scope:'LOCATION',businessId,locationId,vertical:'FOOD_SERVICE'},()=>writer.cashOperation(body));
beforeAll(async()=>{
 organizationId=(await db.organization.create({data:{name:'Synthetic cash intent',status:'ACTIVE'}})).id;
 await db.user.create({data:{id:user,name:'Synthetic owner',email:`cash-${user}@example.invalid`}});
 businessId=(await db.business.create({data:{organizationId,name:'Synthetic cash',vertical:'FOOD_SERVICE'}})).id;
 locationId=(await db.location.create({data:{businessId,name:'Synthetic cash',timezone:'Asia/Almaty',currency:'KZT'}})).id;
 vi.stubEnv('EXPENSE_LINKS_ENABLED','1');
});
afterAll(async()=>{vi.unstubAllEnvs();await db.$disconnect();});
it('real branch writer replays exact intent, conflicts on change, serializes concurrency and preserves transfers',async()=>{
 const body={kind:'INCOME',method:'CASH',amount:10000,idempotencyKey:randomUUID()};
 const first=await write(body);expect(await write(body)).toEqual(first);
 await expect(write({...body,amount:10001})).rejects.toMatchObject({status:409});
 const next={...body,idempotencyKey:randomUUID()};const pair=await Promise.all([write(next),write(next)]);expect(pair[0]).toEqual(pair[1]);
 expect(await db.restaurantCashOperation.count({where:{locationId}})).toBe(2);
 const transfer={kind:'TRANSFER',method:'CASH',methodTo:'KASPI',amount:100,idempotencyKey:randomUUID()};
 expect(await write(transfer)).toEqual(await write(transfer));
 expect(await db.restaurantCashOperation.count({where:{locationId,kind:'EXPENSE'}})).toBe(0);
 await expect(write({kind:'INCOME',method:'CASH',amount:1})).rejects.toMatchObject({status:400});
 await db.restaurantCashOperation.update({where:{id:first.id},data:{status:'VOIDED',voidedAt:new Date(),voidedById:user}});expect(await write(body)).toEqual(first);
});
it('feature off retains legacy contract without intent rows',async()=>{
 vi.stubEnv('EXPENSE_LINKS_ENABLED','0');
 const before=await db.$queryRaw<Array<{n:bigint}>>`SELECT count(*) AS n FROM payment_write_intents WHERE location_id=${locationId}::uuid`;
 await write({kind:'INCOME',method:'CASH',amount:1});
 const after=await db.$queryRaw<Array<{n:bigint}>>`SELECT count(*) AS n FROM payment_write_intents WHERE location_id=${locationId}::uuid`;
 expect(after).toEqual(before);vi.stubEnv('EXPENSE_LINKS_ENABLED','1');
});

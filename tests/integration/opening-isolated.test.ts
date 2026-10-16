import { afterAll, expect, it } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import { readRestaurantWorkload } from '../../apps/api/src/food-service/workload';
import { RestaurantOpeningService } from '../../apps/api/src/food-service/opening';
import { FoodService } from '../../apps/api/src/food-service/food.service';
import { OwnerSummaryService } from '../../apps/api/src/finance/owner-summary';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
const url='postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home';
const pool=new pg.Pool({connectionString:url,options:'-c search_path=pms_test,public',max:1});
afterAll(()=>pool.end());
it('rejects nonexistent and ambiguous local times rather than choosing offsets',async()=>{
 await expect(pool.query("select restaurant_local_instant('2026-03-08 02:30','America/New_York')")).rejects.toThrow('LOCAL_TIME_NONEXISTENT_OR_AMBIGUOUS');
 await expect(pool.query("select restaurant_local_instant('2026-11-01 01:30','America/New_York')")).rejects.toThrow('LOCAL_TIME_NONEXISTENT_OR_AMBIGUOUS');
});
it('confirmed writer materializes observed capacity; sessions project complete and earlier partial; edits preserve history',async()=>{
 const org=(await pool.query('select id from organizations limit 1')).rows[0].id;
 const business=randomUUID(),location=randomUUID(),area=randomUUID(),table=randomUUID();
 await pool.query("insert into businesses(id,organization_id,name,vertical,updated_at) values($1,$2,'Synthetic opening','FOOD_SERVICE',now())",[business,org]);
 await pool.query("insert into locations(id,business_id,name,timezone,currency,updated_at) values($1,$2,'Synthetic','UTC','KZT',now())",[location,business]);
 await pool.query("insert into dining_areas(id,location_id,name,updated_at) values($1,$2,'Synthetic',now())",[area,location]);
 await pool.query("insert into dining_tables(id,area_id,name,capacity,updated_at) values($1,$2,'Synthetic',4,now())",[table,area]);
 const day=new Date().toISOString().slice(0,10), weekday=new Date().getUTCDay();
 const input={effectiveFrom:day,effectiveTo:day,intervals:[{weekday,localStart:'00:00',localEnd:'00:00',endsNextDay:true}],closures:[]};
 const db=createPrismaClient(url,'pms_test');
 process.env.RESTAURANT_CAPACITY_CAPTURE='true';process.env.RESTAURANT_OCCUPANCY_CAPTURE='true';
 const user=randomUUID();await pool.query('insert into users(id,email) values($1,$2)',[user,`${user}@example.invalid`]);
 const actor={userId:user,organizationId:org,role:'OWNER' as const,businessId:business,locationId:location,vertical:'FOOD_SERVICE' as const};
 await withSignedInUser(actor,()=>new RestaurantOpeningService({db} as never).confirm(input));
 const revision=(await pool.query('select * from resource_capacity_revisions where table_id=$1 and valid_to is null',[table])).rows[0];
 const start=revision.valid_from;
 await withSignedInUser(actor,()=>new FoodService({db} as never).occupancy(randomUUID(),{tableId:table},'SEAT'));
 await new Promise(r=>setTimeout(r,30));
 const end=(await pool.query('select clock_timestamp() as t')).rows[0].t;
 process.env.RESTAURANT_CAPACITY_CAPTURE='true';process.env.RESTAURANT_OCCUPANCY_CAPTURE='true';
 try{
 const summary=await withSignedInUser(actor,()=>new OwnerSummaryService({db} as never).report('month',end));
 expect(summary.workload.state).toBe('PARTIAL');expect('percent' in summary.workload && summary.workload.percent).toBeNull();
 const result=await readRestaurantWorkload(db,location,start,end);
 expect(result.state).toBe('COMPLETE');expect(Number(result.numerator)).toBeGreaterThan(0);expect(result.percent).not.toBeNull();
 expect((await readRestaurantWorkload(db,location,new Date(+start-86400000),end)).state).toBe('PARTIAL');
 await pool.query('update dining_tables set active=false where id=$1',[table]);
 expect((await readRestaurantWorkload(db,location,start,end)).denominator).toBe(result.denominator);
 await pool.query('select confirm_restaurant_opening($1,$2::jsonb,null)',[location,JSON.stringify({...input,closures:[{day,reason:'Technical closure'}]})]);
 expect((await pool.query('select count(*) from resource_capacity_intervals where revision_id in (select id from resource_capacity_revisions where location_id=$1 and valid_to is null)',[location])).rows[0].count).toBe('0');
 const coverage=(await pool.query("select to_utc from workload_coverage_segments where location_id=$1 and state='COMPLETE' order by from_utc desc limit 1",[location])).rows[0];
 expect(coverage.to_utc.toISOString()).toBe(new Date(+new Date(day)+86400000).toISOString());
 }finally{await db.$disconnect();delete process.env.RESTAURANT_CAPACITY_CAPTURE;delete process.env.RESTAURANT_OCCUPANCY_CAPTURE;}
});
it('runtime tenant can confirm its schedule and materialize; foreign tenant cannot read or confirm',async()=>{
 const client=await pool.connect();
 try{
 const row=(await client.query('select s.location_id,b.organization_id from restaurant_opening_schedules s join locations l on l.id=s.location_id join businesses b on b.id=l.business_id order by s.recorded_at desc limit 1')).rows[0];
 const day=new Date().toISOString().slice(0,10);
 const payload={effectiveFrom:day,effectiveTo:day,intervals:[{weekday:new Date().getUTCDay(),localStart:'00:00',localEnd:'00:00',endsNextDay:true}],closures:[]};
 await client.query('begin');await client.query('set local role wetop_app');await client.query("select set_config('app.org_id',$1,true)",[row.organization_id]);
 await client.query('select confirm_restaurant_opening($1,$2::jsonb,null)',[row.location_id,JSON.stringify(payload)]);
 expect((await client.query('select * from restaurant_opening_schedules where location_id=$1',[row.location_id])).rows.length).toBeGreaterThan(0);
 await client.query('rollback');
 await client.query('begin');await client.query('set local role wetop_app');await client.query("select set_config('app.org_id',$1,true)",[randomUUID()]);
 expect((await client.query('select * from restaurant_opening_schedules where location_id=$1',[row.location_id])).rows).toHaveLength(0);
 await expect(client.query('select confirm_restaurant_opening($1,$2::jsonb,null)',[row.location_id,JSON.stringify(payload)])).rejects.toThrow();
 }finally{await client.query('rollback');client.release();}
});

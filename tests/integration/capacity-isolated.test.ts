import { beforeAll, afterAll, expect, it } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import { readRestaurantWorkload } from '../../apps/api/src/food-service/workload';
const pool=new pg.Pool({connectionString:'postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home',options:'-c search_path=pms_test,public',max:3});
const location=randomUUID(),business=randomUUID(),area=randomUUID(),table=randomUUID();
beforeAll(async()=>{
 const org=(await pool.query('select id from organizations limit 1')).rows[0].id;
 await pool.query("insert into businesses(id,organization_id,name,vertical,updated_at) values($1,$2,'Synthetic capacity','FOOD_SERVICE',now())",[business,org]);
 await pool.query("insert into locations(id,business_id,name,timezone,currency,updated_at) values($1,$2,'Synthetic','UTC','KZT',now())",[location,business]);
 await pool.query("insert into dining_areas(id,location_id,name,updated_at) values($1,$2,'Synthetic',now())",[area,location]);
 await pool.query("insert into dining_tables(id,area_id,name,capacity,updated_at) values($1,$2,'Synthetic',4,now())",[table,area]);
});
afterAll(()=>pool.end());
it('starts only at observation, snapshots table edits atomically without inventing schedule',async()=>{
 await pool.query('select capture_restaurant_capacity($1)',[location]);
 const old=(await pool.query('select * from resource_capacity_revisions where location_id=$1',[location])).rows[0];
 expect(old.table_id).toBe(table);expect(old.active).toBe(true);expect(old.valid_from).toEqual(old.observed_at);
 expect((await pool.query('select reason from workload_coverage_segments where location_id=$1',[location])).rows[0].reason).toBe('OPENING_SCHEDULE_NOT_CONFIRMED');
 await pool.query('update dining_tables set active=false where id=$1',[table]);
 const rows=(await pool.query('select * from resource_capacity_revisions where location_id=$1 order by valid_from',[location])).rows;
 expect(rows).toHaveLength(2);expect(rows[0].valid_to).toEqual(rows[1].valid_from);expect(rows[0].active).toBe(true);expect(rows[1].active).toBe(false);
 expect((await pool.query('select count(*) from resource_capacity_intervals where location_id=$1',[location])).rows[0].count).toBe('0');
});
it('rolls revision writes back with actual setting edit',async()=>{
 const client=await pool.connect();try{
 await client.query('begin');await client.query('update dining_tables set active=true where id=$1',[table]);await client.query('rollback');
 expect((await pool.query('select count(*) from resource_capacity_revisions where location_id=$1',[location])).rows[0].count).toBe('2');
 }finally{client.release();}
});
it('reads persisted intervals and physical sessions only with explicit synthetic coverage',async()=>{
 const db=createPrismaClient('postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home','pms_test');
 process.env.RESTAURANT_CAPACITY_CAPTURE='true';process.env.RESTAURANT_OCCUPANCY_CAPTURE='true';
 try {
  const missing=await readRestaurantWorkload(db,location,new Date('2026-01-01'),new Date());
  expect(missing.reason).toBe('OPENING_SCHEDULE_NOT_CONFIRMED');expect(missing.percent).toBeNull();
  await pool.query('update dining_tables set active=true where id=$1',[table]);
  const revision=(await pool.query('select * from resource_capacity_revisions where table_id=$1 and valid_to is null',[table])).rows[0];
  const start=new Date(Math.ceil(+revision.valid_from/1000)*1000),end=new Date(+start+3600000);
  await pool.query(`insert into resource_capacity_intervals(revision_id,location_id,table_id,local_date,timezone,starts_at,ends_at,source_revision) values($1,$2,$3,$4::timestamptz::date,'UTC',$4,$5,$6)`,[revision.id,location,table,start,end,revision.source_revision]);
  await pool.query('update workload_coverage_segments set to_utc=$2 where location_id=$1 and to_utc is null',[location,start]);
  await pool.query("insert into workload_coverage_segments(location_id,from_utc,to_utc,state,source_revision) values($1,$2,$3,'COMPLETE','synthetic-confirmed-only')",[location,start,end]);
  await pool.query('insert into table_occupancy_sessions(location_id,table_id,started_at,ended_at,idempotency_key) values($1,$2,$3,$4,$5)',[location,table,start,new Date(+start+1800000),randomUUID()]);
  const result=await readRestaurantWorkload(db,location,start,end);
  expect(result.state).toBe('COMPLETE');expect(result.percent).toBe(50);expect(result.denominator).toBe('3600000');
  expect((await readRestaurantWorkload(db,location,new Date(+start-86400000),end)).state).toBe('PARTIAL');
 }finally{delete process.env.RESTAURANT_CAPACITY_CAPTURE;delete process.env.RESTAURANT_OCCUPANCY_CAPTURE;await db.$disconnect();}
});

import { afterAll, beforeAll, expect, it } from 'vitest';
import pg from 'pg';
import { createPrismaClient } from '@pms/database';
import { FoodService } from '../../apps/api/src/food-service/food.service';
import type { PrismaService } from '../../apps/api/src/database/prisma.provider';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
import { randomUUID } from 'node:crypto';
const pool = new pg.Pool({connectionString:'postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home',max:3,options:'-c search_path=pms_test,public'});
const location=randomUUID(), business=randomUUID(), area=randomUUID(), a=randomUUID(), b=randomUUID();
beforeAll(async()=>{
 const org=(await pool.query('select id from organizations limit 1')).rows[0].id;
 await pool.query(`insert into businesses(id,organization_id,name,vertical,updated_at) values($1,$2,'Synthetic occupancy','FOOD_SERVICE',now())`,[business,org]);
 await pool.query(`insert into locations(id,business_id,name,timezone,currency,updated_at) values($1,$2,'Synthetic occupancy','Asia/Almaty','KZT',now())`,[location,business]);
 await pool.query(`insert into dining_areas(id,location_id,name,updated_at) values($1,$2,'Synthetic hall',now())`,[area,location]);
 await pool.query(`insert into dining_tables(id,area_id,name,capacity,updated_at) values($1,$3,'A',4,now()),($2,$3,'B',4,now())`,[a,b,area]);
});
afterAll(()=>pool.end());
it('real FoodService commands synchronize reservation, assignment and legacy hooks atomically',async()=>{
 const org=(await pool.query('select organization_id from businesses where id=$1',[business])).rows[0].organization_id;
 const customer=randomUUID(), period=randomUUID(), reservation=randomUUID();
 const c=randomUUID(),d=randomUUID();
 await pool.query(`insert into dining_tables(id,area_id,name,capacity,updated_at) values($1,$3,'C',4,now()),($2,$3,'D',4,now())`,[c,d,area]);
 await pool.query(`insert into customers(id,organization_id,first_name,updated_at) values($1,$2,'Synthetic',now())`,[customer,org]);
 await pool.query(`insert into service_periods(id,location_id,name,weekday,time_from,time_to,default_duration_minutes,updated_at) values($1,$2,'Synthetic',1,'00:00','23:59',60,now())`,[period,location]);
 await pool.query(`insert into restaurant_reservations(id,location_id,customer_id,service_period_id,starts_at,ends_at,party_size,creation_key,creation_fingerprint,updated_at) values($1::uuid,$2,$3,$4,now(),now()+interval '1 hour',2,$1::text,repeat('a',64),now())`,[reservation,location,customer,period]);
 const db=createPrismaClient('postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home','pms_test');
 const service=new FoodService({db} as PrismaService);
 process.env.RESTAURANT_OCCUPANCY_CAPTURE='true';
 const user=randomUUID(); await pool.query('insert into users(id,email) values($1,$2)',[user,`${user}@example.invalid`]);
 try {await withSignedInUser({userId:user,organizationId:org,role:'OWNER',businessId:business,locationId:location,vertical:'FOOD_SERVICE'},async()=>{
  const seated=await service.occupancy('service-seat',{tableId:c,reservationId:reservation},'SEAT');
  const row=await db.restaurantReservation.findUniqueOrThrow({where:{id:reservation},include:{tableAssignment:true}});
  expect(row.status).toBe('SEATED'); expect(row.tableAssignment?.tableId).toBe(c);
  expect(await service.occupancy('service-seat',{tableId:c,reservationId:reservation},'SEAT')).toEqual(seated);
  await service.occupancy('service-move',{tableId:d},'MOVE',seated.id);
  const moved=await db.restaurantReservation.findUniqueOrThrow({where:{id:reservation},include:{tableAssignment:true}});
  expect(moved.tableAssignment?.tableId).toBe(d);
  await service.assign(reservation,{expectedStatus:moved.status,expectedUpdatedAt:moved.updatedAt.toISOString(),tableId:d});
  const live=(await pool.query('select id from table_occupancy_sessions where reservation_id=$1 and ended_at is null',[reservation])).rows[0].id;
  await service.occupancy('service-release',{},'RELEASE',live);
  expect((await db.restaurantReservation.findUniqueOrThrow({where:{id:reservation}})).status).toBe('COMPLETED');
  expect(await service.occupancy('service-release',{},'RELEASE',live)).toEqual({id:live});
  expect((await pool.query('select count(*) from table_occupancy_sessions where reservation_id=$1',[reservation])).rows[0].count).toBe('2');
  expect((await pool.query('select count(*) from table_occupancy_sessions where reservation_id=$1 and ended_at is null',[reservation])).rows[0].count).toBe('0');
 });}finally{delete process.env.RESTAURANT_OCCUPANCY_CAPTURE;await db.$disconnect();}
});
async function command(key:string,action:string,table:string|null,session:string|null=null){return (await pool.query('select occupancy_command($1::uuid,$2,$3,$4::uuid,$5::uuid,NULL,NULL,NULL) as id',[location,key,action,table,session])).rows[0].id;}
it('runtime role successfully seats, moves and releases its own tenant',async()=>{
 const client=await pool.connect();
 const org=(await pool.query('select organization_id from businesses where id=$1',[business])).rows[0].organization_id;
 const c=randomUUID(),d=randomUUID();
 await pool.query(`insert into dining_tables(id,area_id,name,capacity,updated_at) values($1,$3,'runtime C',4,now()),($2,$3,'runtime D',4,now())`,[c,d,area]);
 try {await client.query('BEGIN');await client.query('SET LOCAL ROLE wetop_app');await client.query("select set_config('app.org_id',$1,true)",[org]);
 const seat=(await client.query('select occupancy_command($1,$2,$3,$4,NULL,NULL,NULL,NULL) id',[location,'runtime-seat','SEAT',c])).rows[0].id;
 const move=(await client.query('select occupancy_command($1,$2,$3,$4,$5,NULL,NULL,NULL) id',[location,'runtime-move','MOVE',d,seat])).rows[0].id;
 await client.query('select occupancy_command($1,$2,$3,NULL,$4,NULL,NULL,NULL)',[location,'runtime-release','RELEASE',move]);
 expect((await client.query('select ended_at from table_occupancy_sessions where id=$1',[move])).rows[0].ended_at).not.toBeNull();
 await client.query('COMMIT');
 }finally{await client.query('ROLLBACK');client.release();}
});
it('runtime tenant isolation hides other branches and rejects writes',async()=>{
 const client=await pool.connect();
 try {
  await client.query('BEGIN'); await client.query('SET LOCAL ROLE wetop_app');
  await client.query("select set_config('app.org_id',$1,true)",[randomUUID()]);
  expect((await client.query('select id from table_occupancy_sessions where location_id=$1',[location])).rows).toHaveLength(0);
  await expect(client.query('select occupancy_command($1,$2,$3,$4,NULL,NULL,NULL,NULL)',[location,'foreign','SEAT',a])).rejects.toThrow();
 } finally {await client.query('ROLLBACK');client.release();}
});
it('walk-in persists one actual session, retries replay, competing seats fail, move and release are atomic',async()=>{
 const results=await Promise.allSettled([command('seat-a','SEAT',a),command('seat-race','SEAT',a)]);
 expect(results.filter(x=>x.status==='fulfilled')).toHaveLength(1);
 const winner=results.find(x=>x.status==='fulfilled') as PromiseFulfilledResult<string>;
 const key=results[0].status==='fulfilled'?'seat-a':'seat-race';
 expect(await command(key,'SEAT',a)).toBe(winner.value);
 await expect(command(key,'SEAT',b)).rejects.toThrow();
 const moved=await command('move','MOVE',b,winner.value);
 expect(await command('move','MOVE',b,winner.value)).toBe(moved);
 const rows=(await pool.query('select * from table_occupancy_sessions where location_id=$1 and table_id in ($2,$3) order by started_at',[location,a,b])).rows;
 expect(rows).toHaveLength(2); expect(rows[0].ended_at).toEqual(rows[1].started_at); expect(rows[1].reservation_id).toBeNull();
 await expect(command('bad-move','MOVE',randomUUID(),moved)).rejects.toThrow();
 expect((await pool.query('select ended_at from table_occupancy_sessions where id=$1',[moved])).rows[0].ended_at).toBeNull();
 await command('release','RELEASE',null,moved);
 expect(await command('release','RELEASE',null,moved)).toBe(moved);
 expect((await pool.query('select count(*) from table_occupancy_sessions where location_id=$1 and ended_at is null',[location])).rows[0].count).toBe('0');
});

it('retained history rejects parent scope changes and session relinking but permits business edits',async()=>{
 const t=randomUUID(), other=randomUUID(), otherArea=randomUUID();
 await pool.query("insert into locations(id,business_id,name,timezone,currency,updated_at) values($1,$2,'Other','UTC','KZT',now())",[other,business]);
 await pool.query("insert into dining_areas(id,location_id,name,updated_at) values($1,$2,'Other',now())",[otherArea,other]);
 await pool.query("insert into dining_tables(id,area_id,name,capacity,updated_at) values($1,$2,'History',4,now())",[t,area]);
 const id=await command('history-seat','SEAT',t); await command('history-release','RELEASE',null,id);
 await expect(pool.query('update dining_tables set area_id=$2 where id=$1',[t,otherArea])).rejects.toThrow();
 await expect(pool.query('update table_occupancy_sessions set table_id=$2 where id=$1',[id,b])).rejects.toThrow();
 await expect(pool.query('update dining_areas set location_id=$2 where id=$1',[area,other])).rejects.toThrow();
 await expect(pool.query('update locations set business_id=$2 where id=$1',[location,(await pool.query('select id from businesses where id<>$1 limit 1',[business])).rows[0].id])).rejects.toThrow();
 await pool.query("update dining_tables set name='Renamed',capacity=5 where id=$1",[t]);
});
it('history pages equal timestamps without duplicates and validates cursor scope',async()=>{
 const db=createPrismaClient('postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home','pms_test');
 const org=(await pool.query('select organization_id from businesses where id=$1',[business])).rows[0].organization_id;
 const ids=[randomUUID(),randomUUID(),randomUUID()];
 for(const id of ids) await pool.query("insert into table_occupancy_sessions(id,location_id,table_id,started_at,ended_at,idempotency_key) values($1::uuid,$2,$3,'2020-01-01T00:00:00Z','2020-01-01T00:00:00Z',$1::text)",[id,location,a]);
 process.env.RESTAURANT_OCCUPANCY_CAPTURE='true';
 try{await withSignedInUser({userId:randomUUID(),organizationId:org,role:'OWNER',businessId:business,locationId:location,vertical:'FOOD_SERVICE'},async()=>{
 const service=new FoodService({db} as PrismaService), q={from:'2019-12-31T00:00:00Z',to:'2020-01-02T00:00:00Z',limit:'2'};
 const first=await service.occupancySessions(q);
 if (!('nextCursor' in first) || typeof first.nextCursor !== 'string') throw new Error('Expected captured first page with cursor');
 expect(first.sessions).toHaveLength(2); expect(first.hasMore).toBe(true); expect(first.nextCursor).toBeTypeOf('string');
 const second=await service.occupancySessions({...q,cursor:first.nextCursor});
 expect(second.sessions).toHaveLength(1); expect(second.hasMore).toBe(false);
 expect(new Set([...first.sessions,...second.sessions].map(r=>r.id)).size).toBe(3);
 await expect(service.occupancySessions({...q,to:'2020-01-03T00:00:00Z',cursor:first.nextCursor})).rejects.toThrow();
 await expect(service.occupancySessions({...q,cursor:'invalid'})).rejects.toThrow();
 });}finally{delete process.env.RESTAURANT_OCCUPANCY_CAPTURE;await db.$disconnect();}
});

it('two connections serialize retained linking against parent scope update (observed blocker)',async()=>{
 const writer=await pool.connect(), mover=await pool.connect(), observer=await pool.connect();
 const t=randomUUID(), target=randomUUID(), targetArea=randomUUID();
 try{
 await observer.query("insert into locations(id,business_id,name,timezone,currency,updated_at) values($1,$2,'Race target','UTC','KZT',now())",[target,business]);
 await observer.query("insert into dining_areas(id,location_id,name,updated_at) values($1,$2,'Race target',now())",[targetArea,target]);
 await observer.query("insert into dining_tables(id,area_id,name,capacity,updated_at) values($1,$2,'Race',4,now())",[t,area]);
 await writer.query('BEGIN');
 await writer.query("insert into table_occupancy_sessions(location_id,table_id,idempotency_key) values($1,$2,'race-link')",[location,t]);
 const pid=(await mover.query('select pg_backend_pid() pid')).rows[0].pid;
 const pending=mover.query('update dining_tables set area_id=$2 where id=$1',[t,targetArea]).then(()=>false,()=>true);
 let blocked=false; const deadline=Date.now()+3000;
 while(Date.now()<deadline){const r=await observer.query('select cardinality(pg_blocking_pids($1))>0 blocked',[pid]);if(r.rows[0].blocked){blocked=true;break;}}
 expect(blocked).toBe(true);
 await writer.query('COMMIT'); expect(await pending).toBe(true);
 // Existing food model forbids area reassignment even within one location; ordinary edits remain allowed.
 await observer.query("update dining_tables set name='Race renamed',capacity=5 where id=$1",[t]);
 const res=(await observer.query('select reservation_id from table_occupancy_sessions where location_id=$1 and reservation_id is not null limit 1',[location])).rows[0].reservation_id;
 await expect(observer.query('update restaurant_reservations set location_id=$2 where id=$1',[res,target])).rejects.toThrow();
 }finally{await writer.query('ROLLBACK');writer.release();mover.release();observer.release();}
});

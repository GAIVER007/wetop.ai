import { afterAll, expect, it } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import { BeautyAppointmentsService } from '../../apps/api/src/beauty/appointments';
import { OwnerSummaryService } from '../../apps/api/src/finance/owner-summary';
import { BeautyScheduleService } from '../../apps/api/src/beauty/schedule';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
const url='postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home';
const pool=new pg.Pool({connectionString:url,options:'-c search_path=pms_test,public',max:1});
afterAll(()=>pool.end());
it('real schedule writer captures normalized historical capacity atomically, never backdates observation',async()=>{
 const org=(await pool.query('select id from organizations limit 1')).rows[0].id;
 const business=randomUUID(),location=randomUUID(),employee=randomUUID(),user=randomUUID();
 await pool.query("insert into businesses(id,organization_id,name,vertical,updated_at) values($1,$2,'Synthetic beauty','BEAUTY',now())",[business,org]);
 await pool.query("insert into locations(id,business_id,name,timezone,currency,updated_at) values($1,$2,'Synthetic','UTC','KZT',now())",[location,business]);
 await pool.query("insert into employees(id,business_id,name,updated_at) values($1,$2,'Synthetic',now())",[employee,business]);
 await pool.query('insert into employee_locations(employee_id,location_id) values($1,$2)',[employee,location]);
 await pool.query('insert into users(id,email) values($1,$2)',[user,`${user}@example.invalid`]);
 const db=createPrismaClient(url,'pms_test');process.env.BEAUTY_WORKLOAD_CAPTURE='true';
 try{
 const actor={userId:user,organizationId:org,role:'OWNER' as const,businessId:business,locationId:location,vertical:'BEAUTY' as const};
 const schedule=new BeautyScheduleService({db} as never);
 await withSignedInUser(actor,async()=>schedule.setWorkingHours(employee,{expectedRevision:(await schedule.overview(employee)).weekRevision,intervals:[{weekday:new Date().getUTCDay(),timeFrom:'09:00',timeTo:'18:00'}]}));
 const rows=(await pool.query('select * from beauty_schedule_versions where location_id=$1',[location])).rows;
 expect(rows.length).toBeGreaterThan(0);
 expect((await pool.query('select * from beauty_capacity_intervals where location_id=$1',[location])).rows.length).toBeGreaterThan(0);
 expect(rows[0].observed_at.getTime()).toBeGreaterThan(Date.now()-30000);
 const service=randomUUID(),customer=randomUUID();
 await pool.query("insert into beauty_services(id,business_id,name,duration_minutes,price,currency,updated_at) values($1,$2,'Synthetic',60,100,'KZT',now())",[service,business]);
 await pool.query('insert into location_services(location_id,service_id,updated_at) values($1,$2,now())',[location,service]);
 await pool.query('insert into employee_services(employee_id,service_id) values($1,$2)',[employee,service]);
 await pool.query("insert into customers(id,organization_id,first_name,updated_at) values($1,$2,'Synthetic',now())",[customer,org]);
 const start=new Date().toISOString().slice(0,10)+'T10:00:00Z';
 await withSignedInUser(actor,()=>new BeautyAppointmentsService({db} as never).create({employeeId:employee,serviceId:service,startsAt:start,customerId:customer}));
 const appointment=(await pool.query('select id from appointments where location_id=$1',[location])).rows[0].id;
 const summary=await withSignedInUser(actor,()=>new OwnerSummaryService({db} as never).report('today'));
 expect('basis' in summary.workload && summary.workload.basis).toBe('BOOKED_SCHEDULE');
 expect(summary.workload.numerator).toBe('3600000');
 expect(summary.workload.denominator).toBe('32400000');
 expect(summary.workload.state).toBe('PARTIAL');
 expect('percent' in summary.workload && summary.workload.percent).toBeNull();
 // Explicit synthetic next-day event: must not erase today's booked history.
 const tomorrow=new Date();tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
 await pool.query("insert into appointment_workload_revisions(appointment_id,location_id,employee_id,starts_at,ends_at,status,recorded_at,effective_at) select id,location_id,employee_id,starts_at,ends_at,'CANCELLED',$2,$2 from appointments where id=$1",[appointment,tomorrow]);
 const historical=await withSignedInUser(actor,()=>new OwnerSummaryService({db} as never).report('week',tomorrow));
 expect(historical.workload.numerator).toBe('3600000');
 await withSignedInUser(actor,()=>new BeautyAppointmentsService({db} as never).setStatus(appointment,{status:'CANCELLED'}));
 const cancelled=await withSignedInUser(actor,()=>new OwnerSummaryService({db} as never).report('today'));
 expect(cancelled.workload.numerator).toBe('0');
 expect((await pool.query('select count(*) from appointment_workload_revisions where appointment_id=$1',[appointment])).rows[0].count).toBe('3');
 const client=await pool.connect();
 try {
  await client.query('BEGIN');await client.query('SET LOCAL ROLE wetop_app');
  await client.query("select set_config('app.org_id',$1,true)",[org]);
  for(const table of ['beauty_schedule_versions','beauty_capacity_intervals','appointment_workload_revisions']) {
   expect((await client.query(`select count(*) from ${table} where location_id=$1`,[location])).rows[0].count).not.toBe('0');
  }
  await client.query("select set_config('app.org_id',$1,true)",[randomUUID()]);
  for(const table of ['beauty_schedule_versions','beauty_capacity_intervals','appointment_workload_revisions']) {
   expect((await client.query(`select count(*) from ${table} where location_id=$1`,[location])).rows[0].count).toBe('0');
  }
 }finally {await client.query('ROLLBACK');client.release();}
 }finally{delete process.env.BEAUTY_WORKLOAD_CAPTURE;await db.$disconnect();}
});

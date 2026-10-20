import { afterAll, expect, it } from 'vitest';
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { createPrismaClient } from '@pms/database';
import { OwnerSummaryService } from '../../apps/api/src/finance/owner-summary';
import { withSignedInUser } from '../../apps/api/src/auth/request-context';
const url='postgresql://owner_home_test@127.0.0.1:55516/wetop_owner_home';
const pool=new pg.Pool({connectionString:url,options:'-c search_path=pms_test,public',max:1});
afterAll(()=>pool.end());
it('existing inventory controller initializes capture and retains isolated ROOM/BED history transactionally',async()=>{
 const { InventoryEditor, InventoryEditorController }=await import('../../apps/api/src/inventory/inventory-editor');
 const org=(await pool.query('select id from organizations limit 1')).rows[0].id;
 const [business,location,property,building,floor,room,category,unit,bed]=Array.from({length:9},()=>randomUUID()) as [string,string,string,string,string,string,string,string,string];
 await pool.query("insert into businesses(id,organization_id,name,vertical,updated_at) values($1,$2,'Synthetic hotel','HOSPITALITY',now())",[business,org]);
 await pool.query("insert into locations(id,business_id,name,timezone,currency,updated_at) values($1,$2,'Synthetic','Asia/Almaty','KZT',now())",[location,business]);
 await pool.query("insert into properties(id,organization_id,location_id,name,timezone,currency,check_in_time,check_out_time,updated_at) values($1,$2,$3,'Synthetic hotel','Asia/Almaty','KZT','14:00','12:00',now())",[property,org,location]);
 await pool.query("insert into buildings(id,property_id,name) values($1,$2,'Synthetic')",[building,property]);
 await pool.query("insert into floors(id,building_id,name) values($1,$2,'Synthetic')",[floor,building]);
 await pool.query("insert into physical_rooms(id,floor_id,room_number,capacity,is_dorm,updated_at) values($1,$2,'Synthetic',2,false,now())",[room,floor]);
 await pool.query("insert into accommodation_types(id,property_id,code,name,kind,capacity_adults,updated_at) values($1,$2,'SYN','Synthetic','PRIVATE_ROOM',2,now())",[category,property]);
 for(const [id,kind] of [[unit,'ROOM'],[bed,'BED']]) await pool.query('insert into inventory_units(id,property_id,physical_room_id,accommodation_type_id,code,kind,updated_at) values($1,$2,$3,$4,$5,$6,now())',[id,property,room,category,id,kind]);
 const db=createPrismaClient(url,'pms_test');process.env.HOSPITALITY_WORKLOAD_CAPTURE='true';
 const actor={userId:(await pool.query('select id from users limit 1')).rows[0].id,organizationId:org,role:'OWNER' as const,scope:'LOCATION' as const,businessId:business,locationId:location,vertical:'HOSPITALITY' as const};
 const controller=new InventoryEditorController(new InventoryEditor({db} as never,{} as never,{reservationChanged:async()=>{}} as never,{} as never));
 try {
 await withSignedInUser(actor,()=>controller.renameRoom(unit,{roomNumber:'Synthetic renamed'}));
 const summary=await withSignedInUser(actor,()=>new OwnerSummaryService({db} as never).report('today'));
 expect(summary.workload.state).toBe('PARTIAL');
 expect(summary.workload).toMatchObject({basis:'SELLABLE_NIGHTS',percent:null,funds:[{unit:'ROOM_NIGHT',denominator:'1'},{unit:'BED_NIGHT',denominator:'1'}]});
 await withSignedInUser(actor,()=>controller.removeCategory('SYN'));
 const after=await withSignedInUser(actor,()=>new OwnerSummaryService({db} as never).report('today'));
 expect(after.workload).toMatchObject({funds:[{unit:'ROOM_NIGHT',state:'UNAVAILABLE',percent:null},{unit:'BED_NIGHT',state:'UNAVAILABLE'}]});
 expect((await pool.query('select count(*) from hospitality_workload_versions where property_id=$1',[property])).rows[0].count).not.toBe('1');
 const client=await pool.connect();
 try {
 await client.query('BEGIN');await client.query('SET LOCAL ROLE wetop_app');
 await client.query("select set_config('app.org_id',$1,true)",[org]);
 expect((await client.query('select count(*) from hospitality_workload_versions where property_id=$1',[property])).rows[0].count).not.toBe('0');
 await client.query("select set_config('app.org_id',$1,true)",[randomUUID()]);
 expect((await client.query('select count(*) from hospitality_workload_versions where property_id=$1',[property])).rows[0].count).toBe('0');
 }finally{await client.query('ROLLBACK');client.release();}
 await expect(withSignedInUser({...actor,locationId:randomUUID()},()=>controller.renameRoom(bed,{roomNumber:'Forbidden'}))).rejects.toThrow();
 const location2=randomUUID(), property2=randomUUID(), category2=randomUUID();
 await pool.query("insert into locations(id,business_id,name,timezone,currency,updated_at) values($1,$2,'Synthetic second','Asia/Almaty','KZT',now())",[location2,business]);
 await pool.query("insert into properties(id,organization_id,location_id,name,timezone,currency,check_in_time,check_out_time,updated_at) values($1,$2,$3,'Synthetic second','Asia/Almaty','KZT','14:00','12:00',now())",[property2,org,location2]);
 await pool.query("insert into accommodation_types(id,property_id,code,name,kind,capacity_adults,updated_at) values($1,$2,'SECOND','Synthetic beds','DORM_BED',1,now())",[category2,property2]);
 const actor2={...actor,locationId:location2};
 const body={categoryCode:'SECOND',building:'Synthetic',floor:'1',roomNumber:'2',codes:['BED_A','BED_B']};
 const count=async(p:string)=>(await pool.query('select count(*) from hospitality_workload_versions where property_id=$1',[p])).rows[0].count;
 await expect(withSignedInUser(actor,()=>controller.createRoom(body))).rejects.toThrow('Категория не найдена');
 expect(await count(property2)).toBe('0');
 await expect(withSignedInUser({...actor2,role:'STAFF'},()=>controller.createRoom(body))).rejects.toThrow();
 expect(await count(property2)).toBe('0');
 await expect(withSignedInUser({...actor2,organizationId:randomUUID()},()=>controller.createRoom(body))).rejects.toThrow();
 expect(await count(property2)).toBe('0');
 const firstCount=await count(property);
 await withSignedInUser(actor2,()=>controller.createRoom(body));
 expect(await count(property)).toBe(firstCount);
 const second=await withSignedInUser(actor2,()=>new OwnerSummaryService({db} as never).report('today'));
 expect(second.workload).toMatchObject({funds:[{unit:'ROOM_NIGHT',state:'UNAVAILABLE'},{unit:'BED_NIGHT',denominator:'2'}]});
 await expect(withSignedInUser(actor,()=>controller.renameRoom('BED_A',{roomNumber:'Foreign'}))).rejects.toThrow();
 // Duplicate input still uses the old validator/DB constraint; history rolls back with the rejected edit.
 const beforeFailure=await count(property2);
 await expect(withSignedInUser(actor2,()=>controller.createRoom(body))).rejects.toThrow();
 expect(await count(property2)).toBe(beforeFailure);
 const versions=(await pool.query('select observed_at from hospitality_workload_versions where property_id=$1 order by revision',[property2])).rows;
 const baseline=(await pool.query('select count(*) from hospitality_workload_sources where version_id=(select id from hospitality_workload_versions where property_id=$1 order by revision limit 1)',[property2])).rows[0].count;
 expect(baseline).toBe('0'); // authoritative pre-write empty fund retained, not merely post-edit state
 expect(versions.length).toBeGreaterThanOrEqual(3); // baseline + both newly created beds
 expect(versions[0].observed_at.getTime()).toBeLessThanOrEqual(versions.at(-1).observed_at.getTime());
 const pretracking=await import('../../apps/api/src/hospitality/workload');
 const old=await pretracking.readHospitalityWorkload(db,{propertyId:property2!,locationId:location2!,organizationId:org},'2000-01-01','2000-01-01',new Date());
 expect(old.state).toBe('UNAVAILABLE');expect(old.coverage).toEqual([]);
 delete process.env.HOSPITALITY_WORKLOAD_CAPTURE;
 const disabledBefore=await count(property2);
 await withSignedInUser(actor2,()=>controller.renameRoom('BED_A',{roomNumber:'Renamed without capture'}));
 expect(await count(property2)).toBe(disabledBefore);

 }finally {delete process.env.HOSPITALITY_WORKLOAD_CAPTURE;await db.$disconnect();}
});

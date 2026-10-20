import type { DbTx } from '@pms/database';
import { buildChessboard, dateRange, dayOffsetUtc, localDate, zonedStartOfDay } from '@pms/domain';

type Source={source_kind:string;source_id:string;unit_id:string;kind:'ROOM'|'BED';active:boolean;date_from:Date|null;date_to:Date|null;status:string};
/** Retained source only. Initial observation never proves the preceding part of a stay date. */
export async function readHospitalityWorkload(db:Pick<DbTx,'$queryRaw'>,scope:{propertyId:string|null;locationId:string;organizationId:string},fromDate:string,toDate:string,now:Date){
 const base={basis:'SELLABLE_NIGHTS',calculationVersion:'hospitality-observed-v1',requestedFromDate:fromDate,requestedToDate:toDate,numerator:null,denominator:null,percent:null};
 if(process.env.HOSPITALITY_WORKLOAD_CAPTURE!=='true'||!scope.propertyId) return {...base,state:'UNAVAILABLE',reason:'CAPTURE_DISABLED_OR_NO_PROPERTY',funds:[],coverage:[]};
 const versions=await db.$queryRaw<{id:string;observed:Date;timezone:string}[]>`SELECT v.id,v.observed_at AS observed,v.timezone FROM hospitality_workload_versions v JOIN properties p ON p.id=v.property_id WHERE v.property_id=${scope.propertyId}::uuid AND v.location_id=${scope.locationId}::uuid AND p.location_id=v.location_id AND p.organization_id=${scope.organizationId}::uuid AND v.observed_at<=${now} ORDER BY v.observed_at,v.revision`;
 const totals={ROOM:{n:0,d:0},BED:{n:0,d:0}};
 const coverage:{localDate:string;sourceRevision:string;observedAt:string;timezone:string}[]=[];
 for(const date of dateRange(fromDate,toDate)){
  const v=versions.filter(v=>localDate(v.observed,v.timezone)<=date).at(-1);
  if(!v) continue;
  const rows=await db.$queryRaw<Source[]>`SELECT source_kind,source_id,unit_id,kind,active,date_from,date_to,status FROM hospitality_workload_sources WHERE version_id=${v.id}::uuid AND property_id=${scope.propertyId}::uuid AND location_id=${scope.locationId}::uuid`;
  const fmt=(d:Date)=>d.toISOString().slice(0,10);
  const board=buildChessboard({from:date,to:date,units:rows.filter(r=>r.source_kind==='UNIT'&&r.active).map(r=>({id:r.unit_id,code:r.unit_id,kind:r.kind,accommodationTypeCode:r.kind,accommodationTypeName:r.kind})),allocations:rows.filter(r=>r.source_kind==='ALLOCATION'&&!['CANCELLED','NO_SHOW'].includes(r.status)).map(r=>({unitId:r.unit_id,itemId:r.source_id,itemStatus:r.status as 'CONFIRMED',startDate:fmt(r.date_from!),endDate:fmt(r.date_to!),confirmationNumber:r.source_id,guestLabel:''})),blocks:rows.filter(r=>r.source_kind==='BLOCK').map(r=>({unitId:r.unit_id,dateFrom:fmt(r.date_from!),dateTo:fmt(r.date_to!),type:r.status}))});
  for(const row of board.rows){const t=totals[row.unit.kind];t.d+=row.cells[0]!.state==='BLOCKED'?0:1;t.n+=row.cells[0]!.state==='OCCUPIED'?1:0;}
  coverage.push({localDate:date,sourceRevision:v.id,observedAt:v.observed.toISOString(),timezone:v.timezone});
 }
 const funds=(['ROOM','BED'] as const).map(kind=>({unit:`${kind}_NIGHT`,state:totals[kind].d?'PARTIAL':'UNAVAILABLE',numerator:totals[kind].d?String(totals[kind].n):null,denominator:totals[kind].d?String(totals[kind].d):null,percent:null}));
 return {...base,state:coverage.length&&funds.some(f=>f.state==='PARTIAL')?'PARTIAL':'UNAVAILABLE',reason:coverage.length?'OBSERVED_SOURCE_NOT_COMPLETE_HISTORY':'HISTORY_NOT_CAPTURED',funds,coverage,requestedToUtc:versions.length?zonedStartOfDay(dayOffsetUtc(toDate,1),versions.at(-1)!.timezone).toISOString():null};
}

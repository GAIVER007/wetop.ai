import type { DbTx } from '@pms/database';
import { dayOffsetUtc, localDate, zonedStartOfDay } from '@pms/domain';
import { union, intersect, duration, type Range } from '../../../../packages/domain/src/owner-summary/intervals';
type Span={employeeId:string;from:Date;to:Date};
/** Planned resource-time, not restaurant observed occupancy. Never consult mutable employees/hours. */
export async function readBeautyWorkload(db:Pick<DbTx,'$queryRaw'>,locationId:string,from:Date,now:Date,timezone:string){
 const end=zonedStartOfDay(dayOffsetUtc(localDate(now,timezone),1),timezone);
 const base={basis:'BOOKED_SCHEDULE' as const,unit:'EMPLOYEE_MILLISECOND' as const,calculationVersion:'beauty-saved-capacity-v1',requestedFromUtc:from.toISOString(),requestedToUtc:end.toISOString()};
 if(process.env.BEAUTY_WORKLOAD_CAPTURE!=='true') return {...base,state:'UNAVAILABLE',reason:'CAPTURE_DISABLED',numerator:null,denominator:null,percent:null,coverage:[],sourceRevisions:[]};
 const versions=await db.$queryRaw<{id:string;day:Date;observed:Date}[]>`SELECT DISTINCT ON (d.day) s.id,d.day,s.observed_at AS observed FROM generate_series(${localDate(from,timezone)}::date,${localDate(now,timezone)}::date,'1 day') d(day) JOIN beauty_schedule_versions s ON s.location_id=${locationId}::uuid AND d.day::date BETWEEN s.effective_from AND s.effective_to AND (s.observed_at AT TIME ZONE s.timezone)::date<=d.day::date AND s.observed_at<=${now} ORDER BY d.day,s.observed_at DESC`;
 let numerator=0n,denominator=0n;
 const coverage:{fromUtc:string;toUtc:string;state:string;sourceRevision:string}[]=[];
 for(const version of versions){
  const day=version.day.toISOString().slice(0,10);
  const start=zonedStartOfDay(day,timezone),stop=zonedStartOfDay(dayOffsetUtc(day,1),timezone);
  // A later cancellation/move cannot rewrite a closed local date.
  const occupied=await db.$queryRaw<Span[]>`SELECT employee_id AS "employeeId",starts_at AS "from",ends_at AS "to" FROM (SELECT DISTINCT ON(appointment_id) * FROM appointment_workload_revisions WHERE location_id=${locationId}::uuid AND recorded_at<=${now} AND recorded_at<${stop} ORDER BY appointment_id,recorded_at DESC,revision DESC) a WHERE status IN ('BOOKED','CONFIRMED','IN_PROGRESS','DONE') AND starts_at<${stop} AND ends_at>${start}`;
  const intervals=await db.$queryRaw<Span[]>`SELECT employee_id AS "employeeId",starts_at AS "from",ends_at AS "to" FROM beauty_capacity_intervals WHERE version_id=${version.id}::uuid AND local_date=${day}::date AND location_id=${locationId}::uuid`;
  for(const employee of new Set(intervals.map(i=>i.employeeId))){
   const capacity=union(intervals.filter(i=>i.employeeId===employee).map(i=>[+i.from,+i.to] as Range));
   denominator+=duration(capacity);
   numerator+=duration(intersect(capacity,union(occupied.filter(i=>i.employeeId===employee).map(i=>[+i.from,+i.to] as Range))));
  }
  coverage.push({fromUtc:new Date(Math.max(+start,+version.observed)).toISOString(),toUtc:stop.toISOString(),state:+version.observed>+start?'PARTIAL':'COMPLETE',sourceRevision:version.id});
 }
 const measured=duration(union(coverage.map(c=>[+new Date(c.fromUtc),+new Date(c.toUtc)])));
 const complete=measured===BigInt(+end-+from);
 return {...base,state:!versions.length?'UNAVAILABLE':complete?'COMPLETE':'PARTIAL',reason:!versions.length?'HISTORY_NOT_CAPTURED':denominator===0n?'NO_SCHEDULE':complete?null:'INCOMPLETE_PERIOD_COVERAGE',numerator:versions.length?numerator.toString():null,denominator:versions.length?denominator.toString():null,percent:complete&&denominator>0n?Number(numerator*1000000n/denominator)/10000:null,coverage,sourceRevisions:versions.map(v=>v.id)};
}

import type { DbTx } from '@pms/database';
type Span = { from: Date; to: Date };
type ResourceSpan = Span & { tableId: string };
type Coverage = Span & { state: string; sourceRevision: string; reason?: string | null };
import { union, intersect, subtract, duration, type Range } from '../../../../packages/domain/src/owner-summary/intervals';
export function projectRestaurantWorkload(from:Date, now:Date, available:ResourceSpan[], occupied:ResourceSpan[], coverage:Coverage[]) {
 const window:Range[]=[[+from,+now]];
 const measured=subtract(intersect(window,union(coverage.filter(c=>c.state==='COMPLETE').map(c=>[+c.from,+c.to]))),union(coverage.filter(c=>c.state!=='COMPLETE').map(c=>[+c.from,+c.to])));
 let numerator=0n,denominator=0n;
 for(const table of new Set(available.map(a=>a.tableId))) {
  const capacity=intersect(measured,union(available.filter(a=>a.tableId===table).map(a=>[+a.from,+a.to])));
  denominator+=duration(capacity);
  numerator+=duration(intersect(capacity,union(occupied.filter(a=>a.tableId===table).map(a=>[+a.from,+a.to]))));
 }
 const complete=duration(measured)===BigInt(+now-+from),hasCoverage=duration(measured)>0n;
 const ratio=denominator>0n?Number(numerator*1000000n/denominator)/10000:null;
 return {state: denominator===0n?'UNAVAILABLE' as const:complete?'COMPLETE' as const:'PARTIAL' as const,
  reason:!hasCoverage?(coverage.find(c=>c.reason)?.reason ?? 'HISTORY_NOT_CAPTURED'):denominator===0n?'NO_AVAILABLE_CAPACITY_OR_SCHEDULE':complete?null:'INCOMPLETE_PERIOD_COVERAGE',
  basis:'ACTUAL_TABLE_OCCUPANCY' as const,unit:'TABLE_MILLISECOND' as const,calculationVersion:'restaurant-capacity-v1',
  numerator:denominator>0n?numerator.toString():null,denominator:denominator>0n?denominator.toString():null,
  percent:complete?ratio:null,coveredPercent:ratio,coverage:measured.map(r=>({fromUtc:new Date(r[0]).toISOString(),toUtc:new Date(r[1]).toISOString()})),
  requestedFromUtc:from.toISOString(),requestedToUtc:now.toISOString(),sourceRevisions:[...new Set(coverage.map(c=>c.sourceRevision))]};
}
export async function readRestaurantWorkload(db:Pick<DbTx,'$queryRaw'>,locationId:string,from:Date,now:Date){
 if(process.env.RESTAURANT_CAPACITY_CAPTURE!=='true'||process.env.RESTAURANT_OCCUPANCY_CAPTURE!=='true') return {...projectRestaurantWorkload(from,now,[],[],[]),reason:'CAPTURE_DISABLED'};
 const capacity=await db.$queryRaw<ResourceSpan[]>`SELECT i.table_id AS "tableId", greatest(i.starts_at,r.valid_from) AS "from", least(i.ends_at,coalesce(r.valid_to,${now})) AS "to" FROM resource_capacity_intervals i JOIN resource_capacity_revisions r ON r.id=i.revision_id AND r.location_id=i.location_id AND r.table_id=i.table_id WHERE r.active AND i.location_id=${locationId}::uuid AND i.starts_at<${now} AND i.ends_at>${from}`;
 const sessions=await db.$queryRaw<ResourceSpan[]>`SELECT table_id AS "tableId",started_at AS "from",coalesce(ended_at,${now}) AS "to" FROM table_occupancy_sessions WHERE location_id=${locationId}::uuid AND started_at<${now} AND (ended_at IS NULL OR ended_at>${from})`;
 const coverage=await db.$queryRaw<Coverage[]>`SELECT from_utc AS "from",coalesce(to_utc,${now}) AS "to",state,reason,source_revision AS "sourceRevision" FROM workload_coverage_segments WHERE location_id=${locationId}::uuid AND basis='ACTUAL_TABLE_OCCUPANCY' AND unit='TABLE_MILLISECOND' AND from_utc<${now} AND (to_utc IS NULL OR to_utc>${from})`;
 return projectRestaurantWorkload(from,now,capacity,sessions,coverage);
}

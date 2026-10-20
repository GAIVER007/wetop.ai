import { ConflictException, ServiceUnavailableException } from '@nestjs/common';
import type { DbTx } from '@pms/database';
export const occupancyEnabled = () => process.env.RESTAURANT_OCCUPANCY_CAPTURE === 'true';
export async function occupancyCommand(tx: DbTx, locationId: string, key: string, action: 'SEAT'|'MOVE'|'RELEASE', tableId: string|null, sessionId: string|null, reservationId: string|null, orderId: string|null, actor: string|null|undefined) {
 if (!occupancyEnabled()) throw new ServiceUnavailableException('История посадки ещё не включена');
 try {
  const rows=await tx.$queryRaw<{id:string}[]>`SELECT occupancy_command(${locationId}::uuid,${key}::text,${action}::text,${tableId}::uuid,${sessionId}::uuid,${reservationId}::uuid,${orderId}::uuid,${actor ?? null}::uuid) AS id`;
  const row=rows[0];
  if (!row) throw new ServiceUnavailableException('Не удалось получить результат команды посадки');
  return {id:row.id};
 } catch (error) { if (error instanceof ServiceUnavailableException) throw error; throw new ConflictException('Стол или сеанс уже изменён, либо ключ использован повторно с другими данными'); }
}
export async function reservationOccupancy(tx: DbTx, locationId:string,reservationId:string,tableId:string|null, action:'SEAT'|'MOVE'|'RELEASE',key:string,actor:string|null|undefined) {
 if (!occupancyEnabled()) return;
 const rows=await tx.$queryRaw<{id:string;table_id:string}[]>`SELECT id,table_id FROM table_occupancy_sessions WHERE location_id=${locationId}::uuid AND reservation_id=${reservationId}::uuid AND ended_at IS NULL`;
 if (action==='SEAT' && rows.length) return;
 if (action==='RELEASE' && !rows.length) return;
 if (action==='MOVE' && rows[0]?.table_id===tableId) return;
 return occupancyCommand(tx,locationId,key,rows.length?action:'SEAT',tableId,rows[0]?.id ?? null,reservationId,null,actor);
}

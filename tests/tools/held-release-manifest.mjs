// Offline only: print a verified six-file package. There is intentionally no execute mode.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';
const root='packages/database/prisma/migrations-hold/';
const ordered=[
 '20261016000114_expense_links/migration.sql',
 '20261016000115_table_occupancy/migration.sql',
 '20261016000116_restaurant_capacity/migration.sql',
 '20261016000116_restaurant_capacity/opening.sql',
 '20261016000117_beauty_workload/migration.sql',
 '20261016000118_hospitality_workload/migration.sql',
];
assert(process.argv.slice(2).every(a=>a==='--dry-run'),'offline --dry-run only');
const runner=readFileSync(root+'owner-home-release.sql','utf8');
assert.deepEqual([...runner.matchAll(/^\\ir (.+)$/gm)].map(x=>x[1]),ordered);
const sha256=p=>createHash('sha256').update(readFileSync(root+p)).digest('hex');
console.log(JSON.stringify({mode:'OFFLINE_DRY_RUN_NO_DATABASE',runner:{path:root+'owner-home-release.sql',sha256:sha256('owner-home-release.sql')},apply:ordered.map((p,i)=>({order:i+1,path:root+p,sha256:sha256(p)})),rollback:[...new Set(ordered.map(x=>x.split('/')[0]))].reverse().map(d=>({path:root+d+'/down.sql',sha256:sha256(d+'/down.sql')}))},null,2));

import { Buffer } from 'node:buffer';
import console from 'node:console';
import { readFileSync, statSync } from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { stripVTControlCharacters } from 'node:util';

const MAX_BYTES = 16 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Bounded, fail-closed acceptance of emitted JSON, not echoed source or test summaries. */
export function validateSettingsObservation(text) {
  const fail = reason => ({ ok: false, reason });
  if (Buffer.byteLength(text) > MAX_BYTES) return fail('log exceeds 16 MiB');
  const incoming = new Map();
  const transports = [];
  let events = 0;
  for (const raw of text.split('\n')) {
    const line = stripVTControlCharacters(raw);
    const start = line.indexOf('{"event":"settings-diag-');
    if (start < 0) continue;
    if (++events > 50000 || line.length > 65536) return fail('event bounds exceeded');
    let event;
    try { event = JSON.parse(line.slice(start).trim()); }
    catch { return fail('malformed diagnostic JSON'); }
    if (!UUID.test(event.id)) return fail('unresolved diagnostic ID');
    if (event.event === 'settings-diag-incoming') {
      if (incoming.has(event.id)) return fail('duplicate incoming ID');
      incoming.set(event.id, event);
    } else if (event.event === 'settings-diag-transport') transports.push(event);
    else return fail('unknown diagnostic event');
  }
  const groups = [...incoming.values()].filter(event => event.route === 'today');
  if (groups.length < 3) return fail('need at least three resolved today incoming groups');
  for (const event of transports) {
    if (!incoming.has(event.id)) return fail('transport lacks incoming correlation');
  }
  const byId = new Map();
  for (const event of transports) {
    const group = byId.get(event.id) || [];
    group.push(event);
    byId.set(event.id, group);
  }
  for (const incomingEvent of groups) {
    const group = byId.get(incomingEvent.id) || [];
    if (group.length !== 2 || group[0].phase !== 'start' || group[1].phase !== 'end' || group[1].status !== 200)
      return fail('today group must have exactly one ordered start/end with status 200');
  }
  return { ok: true, groups: groups.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const path = process.argv[2];
    if (!path || statSync(path).size > MAX_BYTES) throw new Error('missing or oversized log');
    const result = validateSettingsObservation(readFileSync(path, 'utf8'));
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
  } catch {
    console.error('settings observation check: unreadable, missing or oversized log');
    process.exitCode = 1;
  }
}

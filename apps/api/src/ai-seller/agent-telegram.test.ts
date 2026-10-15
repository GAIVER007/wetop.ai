import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import { AgentTelegramService } from './agent-telegram.service';
const ORG = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';
const owner = (fn: () => Promise<unknown>, role: 'OWNER' | 'STAFF' = 'OWNER') => withSignedInUser({ userId: ID, organizationId: ORG, role }, fn);
function setup() {
 const agents = { get: vi.fn(async () => ({id: ID, lifecycle:'active'})) };
 const extensions = { aiSeller: vi.fn(async () => ({access:'active'})) };
 const client = { telegram: vi.fn(async () => ({set:true, state:'CONNECTED', username:'test_bot', token:'must-not-leak'})) };
 const connection = { client: vi.fn(() => client) };
 return { agents, extensions, client, connection, service: new AgentTelegramService(agents as never, extensions as never, connection as never) };
}
describe('Telegram selected agent', () => {
 it('uses both scopes and filters secret fields', async () => {
  const s = setup(); const result = await owner(() => s.service.run(ID,'status'));
  expect(s.connection.client).toHaveBeenCalledWith(ORG, ID);
  expect(JSON.stringify(result)).not.toContain('must-not-leak');
 });
 it('rejects foreign agent before service access', async () => {
  const s = setup(); s.agents.get.mockRejectedValue(new Error('Not found'));
  await expect(owner(() => s.service.run(ID,'status'))).rejects.toThrow();
  expect(s.connection.client).not.toHaveBeenCalled();
 });
 it('rejects staff writes', async () => {
  const s = setup(); await expect(owner(() => s.service.run(ID,'connect',{}),'STAFF')).rejects.toThrow();
  expect(s.client.telegram).not.toHaveBeenCalled();
 });
});
it('resolves the migrated working seller on the server', async () => {
 const s = setup(); await owner(() => s.service.run('working','status'));
 expect(s.connection.client).toHaveBeenCalledWith(ORG, ORG);
 expect(s.agents.get).not.toHaveBeenCalled();
});

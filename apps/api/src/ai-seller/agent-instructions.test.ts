import 'reflect-metadata';
import { describe, it, expect, vi } from 'vitest';
import { withSignedInUser } from '../auth/request-context';
import { AgentInstructionsService } from './agent-instructions.service';

const ORG = '11111111-1111-4111-8111-111111111111';
const ID = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const owner = (fn: () => Promise<unknown>, role: 'OWNER' | 'STAFF' = 'OWNER') => withSignedInUser({ userId: USER, organizationId: ORG, role }, fn);
function setup() {
  const rows = new Map<string, { promptText: string; updatedAt: Date }>();
  const profiles = {
    get: vi.fn(async (id: string) => rows.get(id) ?? null),
    savePrompt: vi.fn(async (scope: {agentId: string}, text: string, _user: string, at: Date) => { rows.set(scope.agentId, {promptText: text, updatedAt: at}); }),
  };
  const agents = {get: vi.fn(async () => ({id: ID, name: 'Тестовый агент', lifecycle: 'draft', location: {name: 'Тестовый объект'}}))};
  const extensions = {aiSeller: vi.fn(async () => ({access: 'active'}))};
  const client = {generateInstruction: vi.fn(async () => ({text: 'Ты Ася. Отвечай коротко и по делу.', warnings: []}))};
  const connection = {client: vi.fn(() => client)};
  const service = new AgentInstructionsService(agents as never, profiles as never, extensions as never, connection as never);
  return {service, profiles, rows, agents, extensions, client, connection};
}
describe('инструкция конкретного агента', () => {
  it('сохраняет и читает по agentId, не по организации', async () => {
    const s = setup();
    await owner(() => s.service.save(ID, 'Отвечай коротко и по делу.'));
    expect(s.rows.has(ORG)).toBe(false);
    expect(await owner(() => s.service.get(ID))).toMatchObject({text:'Отвечай коротко и по делу.', saved:true});
  });
  it('чужой агент отсекается до чтения профиля и платного запроса', async () => {
    const s = setup(); s.agents.get.mockRejectedValue(new Error('Агент не найден'));
    await expect(owner(() => s.service.generate(ID, 'Расскажите о нашем тестовом отеле.'))).rejects.toThrow('Агент не найден');
    expect(s.profiles.get).not.toHaveBeenCalled(); expect(s.client.generateInstruction).not.toHaveBeenCalled();
  });
  it('сотрудник и истёкшее расширение не могут писать', async () => {
    const s = setup();
    await expect(owner(() => s.service.save(ID, 'Инструкция для агента.'), 'STAFF')).rejects.toThrow();
    s.extensions.aiSeller.mockResolvedValue({access:'expired'});
    await expect(owner(() => s.service.save(ID, 'Инструкция для агента.'))).rejects.toThrow();
    expect(s.profiles.savePrompt).not.toHaveBeenCalled();
  });
  it('генерация предлагает текст, не затирая сохранённую инструкцию', async () => {
    const s = setup(); s.rows.set(ID, {promptText:'Старая редакция', updatedAt:new Date()});
    const result = await owner(() => s.service.generate(ID, 'Мы тестовый отель, попроси бота отвечать вежливо.'));
    expect(result).toMatchObject({text:expect.stringContaining('Ася')});
    expect(s.rows.get(ID)?.promptText).toBe('Старая редакция');
    expect(s.profiles.savePrompt).not.toHaveBeenCalled();
  });
  it('пустой/слишком длинный ввод и повторные платные вызовы ограничены', async () => {
    const s = setup();
    await expect(owner(() => s.service.save(ID, ' '))).rejects.toThrow();
    await expect(owner(() => s.service.save(ID, 'x'.repeat(20001)))).rejects.toThrow();
    for (let i=0;i<10;i++) await owner(() => s.service.generate(ID, 'Тестовый отель без выдуманных цен.'));
    await expect(owner(() => s.service.generate(ID, 'Тестовый отель без выдуманных цен.'))).rejects.toThrow();
    expect(s.client.generateInstruction).toHaveBeenCalledTimes(10);
  });
});

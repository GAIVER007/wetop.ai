import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { customers, deskShell, exportBeautyCustomersXlsx, ApiError } = vi.hoisted(() => ({
  customers: vi.fn(),
  deskShell: vi.fn(),
  exportBeautyCustomersXlsx: vi.fn(() => new Uint8Array([0x50, 0x4b, 0x03, 0x04])),
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) {
      super(message);
    }
  },
}));

vi.mock('../../../lib/api', () => ({ ApiError, beautyApi: { customers } }));
vi.mock('../../../lib/desk-shell', () => ({ deskShell }));
vi.mock('../xlsx', () => ({ exportBeautyCustomersXlsx }));

describe('D2: защищённая XLSX выгрузка клиентов', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deskShell.mockResolvedValue({
      scopeKey: 'business-test:location-test',
      access: { desk: 'read' },
      readOnly: false,
    });
    customers.mockResolvedValue({ items: [] });
  });

  it('отклоняет устаревший scope до чтения клиентов', async () => {
    const response = await POST(
      new Request('http://wetop.test/customers/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scopeKey: 'other-business:other-location', query: '', segment: 'all' }),
      }),
    );
    expect(response.status).toBe(409);
    expect(customers).not.toHaveBeenCalled();
  });

  it('разрешает выгрузку с правом чтения и не передаёт поиск с PII в URL', async () => {
    const request = new Request('http://wetop.test/customers/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scopeKey: 'business-test:location-test', query: '+77000000001', segment: 'all' }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(response.headers.get('content-disposition')).toContain('.xlsx');
    expect(customers).toHaveBeenCalledOnce();
    expect(request.url).not.toContain('77000000001');
  });

  it('не маскирует отказ API в праве чтения', async () => {
    customers.mockRejectedValue(new ApiError(403, 'Нет доступа'));
    const response = await POST(
      new Request('http://wetop.test/customers/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scopeKey: 'business-test:location-test', query: '', segment: 'all' }),
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.text()).toContain('Нет доступа');
  });
});

describe('аудит 21.10.2026 п.6: адрес выгрузки, открытый ссылкой', () => {
  it('GET уводит на список клиентов, а не отдаёт пустую страницу 405', async () => {
    const { GET } = await import('./route');
    const response = GET();
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe('/customers');
  });
});

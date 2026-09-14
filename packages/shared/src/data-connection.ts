/** Read-only PMS connection contract. No credentials, guest data or database addresses. */
export interface DataConnection {
  source: 'database' | 'demo' | 'synthetic';
  state: 'READY' | 'PROPERTY_MISSING' | 'DATABASE_UNAVAILABLE';
  message: string;
  checkedAt: string;
  database: {
    connected: boolean;
    provider: 'supabase' | 'postgresql' | 'unknown';
    /** Схема, в которой работает API: public — рабочие данные, pms_test — автотесты (ADR-040) */
    schema?: string;
  };
  property: { name: string; timezone: string; currency: string } | null;
  counts: {
    units: number;
    categories: number;
    reservations: number;
    ratePlans: number;
    services: number;
    sites: number;
  } | null;
}

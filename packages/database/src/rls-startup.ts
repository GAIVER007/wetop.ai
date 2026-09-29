import pg from 'pg';

/**
 * Проверка при старте API (аудит 29.09.2026, SEC-1a). Без `DATABASE_APP_URL` запросы организации молча шли служебной
 * ролью, для которой политики RLS не действуют (`createPrismaClient`); то же случалось, если в адрес попала строка не
 * той роли. В production такой процесс теперь не стартует. Вне production проверки нет: разработка и тесты работают
 * на одной роли, как и раньше.
 */

/** Роль, под которой идут запросы организации. Её создаёт миграция `…026_rls_roles` */
const APP_ROLE = 'wetop_app';

export interface RlsProbe {
  /** `current_user` соединения по `DATABASE_APP_URL`: имя роли в базе, а не пользователь из адреса пулера */
  user: string;
  bypassRls: boolean;
  superuser: boolean;
}

/** Что не так с ролью соединения организации; `null` — всё так */
export function rlsRoleProblem(probe: RlsProbe): string | null {
  if (probe.user !== APP_ROLE)
    return `соединение организации идёт ролью «${probe.user}», а не «${APP_ROLE}»: политики RLS на неё не действуют`;
  if (probe.bypassRls) return `у роли «${APP_ROLE}» включён BYPASSRLS: политики RLS не действуют`;
  if (probe.superuser) return `роль «${APP_ROLE}» — суперпользователь: политики RLS не действуют`;
  return null;
}

/** Разовое соединение по адресу роли организации: кто мы в базе и действуют ли на нас политики */
async function probeAppRole(connectionString: string): Promise<RlsProbe> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    const { rows } = await client.query<RlsProbe>(
      `SELECT current_user AS "user", r.rolbypassrls AS "bypassRls", r.rolsuper AS "superuser"
       FROM pg_roles r WHERE r.rolname = current_user`,
    );
    const row = rows[0];
    if (!row) throw new Error('роль соединения не найдена в pg_roles');
    return row;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/**
 * Отказать в старте, если production не может доказать, что запросы организации идут ролью с политиками RLS.
 * `RLS_DISABLED=1` — явный выход на время разбора: старт с предупреждением.
 */
export async function assertRlsAtStartup(
  env: NodeJS.ProcessEnv,
  probe: (connectionString: string) => Promise<RlsProbe> = probeAppRole,
): Promise<void> {
  if (env.NODE_ENV !== 'production') return;
  if (env.RLS_DISABLED === '1') {
    console.warn(
      'RLS_DISABLED=1: проверка роли с политиками RLS выключена, изоляция организаций держится только на фильтрах кода',
    );
    return;
  }
  const url = env.DATABASE_APP_URL?.trim();
  if (!url)
    throw new Error(
      `DATABASE_APP_URL не задан: запросы организации пошли бы ролью без политик RLS (docs/ops/rls.md). ` +
        'Задайте адрес роли wetop_app; на время разбора — RLS_DISABLED=1.',
    );
  let found: RlsProbe;
  try {
    found = await probe(url);
  } catch (e) {
    // В текст идёт только код ошибки: сообщение драйвера может содержать адрес базы
    const code = (e as { code?: unknown }).code;
    throw new Error(
      `не удалось проверить роль соединения организации (${typeof code === 'string' ? code : 'ошибка соединения'})`,
      // причина сохранена для отладки; `main.ts` печатает только `message`
      { cause: e },
    );
  }
  const problem = rlsRoleProblem(found);
  if (problem) throw new Error(`RLS: ${problem} (docs/ops/rls.md)`);
}

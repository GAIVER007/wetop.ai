import pg from 'pg';

const SEARCH_PATH_AMBIGUOUS = 'Database startup options contain an ambiguous search_path setting';

function optionTokens(options: string): string[] {
  const tokens: string[] = [];
  let token = '';
  let quote: "'" | '"' | null = null;
  let escaped = false;
  for (const character of options) {
    if (escaped) {
      token += character;
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (quote) {
      if (character === quote) quote = null;
      else token += character;
    } else if (character === "'" || character === '"') {
      quote = character;
    } else if (/\s/.test(character)) {
      if (token) tokens.push(token);
      token = '';
    } else {
      token += character;
    }
  }
  if (quote || escaped) throw new Error(SEARCH_PATH_AMBIGUOUS);
  if (token) tokens.push(token);
  return tokens;
}

function normalizeSearchPath(value: string): string {
  return value
    .split(',')
    .map((part) => part.trim())
    .join(',');
}

function searchPathValue(setting: string): string | undefined {
  const equals = setting.indexOf('=');
  const name = (equals < 0 ? setting : setting.slice(0, equals))
    .trim()
    .toLowerCase()
    .replaceAll('-', '_');
  if (name !== 'search_path') return undefined;
  if (equals < 0 || !setting.slice(equals + 1).trim()) throw new Error(SEARCH_PATH_AMBIGUOUS);
  return normalizeSearchPath(setting.slice(equals + 1));
}

const searchPaths = (options: string | undefined): string[] => {
  if (!options || !/search[_-]path/i.test(options)) return [];
  if (/['"]/.test(options)) throw new Error(SEARCH_PATH_AMBIGUOUS);
  const tokens = optionTokens(options);
  const paths: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    let setting: string | undefined;
    if (token === '-c') setting = tokens[++index];
    else if (token.startsWith('-c')) setting = token.slice(2);
    else if (token.startsWith('--')) setting = token.slice(2);
    if (setting === undefined) {
      if (token === '-c') throw new Error(SEARCH_PATH_AMBIGUOUS);
      continue;
    }
    const value = searchPathValue(setting);
    if (value !== undefined) paths.push(value);
  }
  return paths;
};

/** PostgreSQL startup options apply before the first query on every new pool connection. */
export function utcConnectionString(
  connectionString: string,
  schemaOptions: string | undefined,
  environmentOptions = process.env.PGOPTIONS,
): string {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // Do not include credentials from a malformed connection string in errors.
    throw new Error('Database connection must use a PostgreSQL URL');
  }
  const options = url.searchParams.getAll('options');
  // pg parses URL options after PoolConfig. Keep that priority for additional options, but merge the selected
  // schema into the effective value because direct SQL depends on the physical connection search_path.
  const inherited = options.length ? options.at(-1) || environmentOptions : environmentOptions;
  const selectedSearchPath = searchPaths(schemaOptions).at(-1);
  if (
    selectedSearchPath &&
    searchPaths(inherited).some((searchPath) => searchPath !== selectedSearchPath)
  ) {
    throw new Error('Database startup options contain conflicting search_path values');
  }
  const startup = [schemaOptions, inherited, '-c timezone=UTC'].filter(Boolean).join(' ');
  url.searchParams.set('options', startup);
  return url.toString();
}

type ConnectCallback = (
  error: Error | undefined,
  client: pg.PoolClient | undefined,
  done: (release?: unknown) => void,
) => void;
type QueryCallback = (error: Error | undefined, result?: unknown) => void;

/** Fails before an application query if PostgreSQL skipped the selected schema in search_path. */
export class SchemaCheckedPool extends pg.Pool {
  private readonly forwardPoolError = (error: Error, client: pg.PoolClient) => {
    this.emit('error', error, client);
  };

  constructor(
    private readonly pool: pg.Pool,
    private readonly schema: string,
  ) {
    super({ max: 1 });
    this.pool.on('error', this.forwardPoolError);
  }

  private async checkout(): Promise<pg.PoolClient> {
    const client = await this.pool.connect();
    try {
      const result = await client.query<{
        exists: boolean;
        usable: boolean;
        currentSchema: string | null;
      }>(
        `SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = $1) AS exists,
                CASE WHEN EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = $1)
                     THEN pg_catalog.has_schema_privilege(current_user, $1, 'USAGE')
                     ELSE false END AS usable,
                current_schema() AS "currentSchema"`,
        [this.schema],
      );
      const row = result.rows[0];
      if (!row?.exists || !row.usable || row.currentSchema !== this.schema)
        throw new Error(`Database schema "${this.schema}" is unavailable to the connection role`);
      return client;
    } catch (error) {
      client.release(error as Error);
      throw error;
    }
  }

  override connect(): Promise<pg.PoolClient>;
  override connect(callback: ConnectCallback): void;
  override connect(callback?: ConnectCallback): Promise<pg.PoolClient> | void {
    const promise = this.checkout();
    if (!callback) return promise;
    promise.then(
      (client) =>
        callback(undefined, client, (release?: unknown) => client.release(release as Error)),
      (error: Error) => callback(error, undefined, () => undefined),
    );
  }

  override query(...args: unknown[]): never {
    const callback = typeof args.at(-1) === 'function' ? (args.pop() as QueryCallback) : undefined;
    if (callback) {
      this.checkout().then(
        (client) => {
          const query = client.query.bind(client) as (...parameters: unknown[]) => unknown;
          let settled = false;
          const finish = (error: Error | undefined, result?: unknown) => {
            if (settled) return;
            settled = true;
            client.release(error);
            callback(error, result);
          };
          try {
            query(...args, finish);
          } catch (error) {
            if (settled) throw error;
            finish(error as Error);
          }
        },
        (error: Error) => callback(error),
      );
      return undefined as never;
    }
    const run = async () => {
      const client = await this.checkout();
      let failure: Error | undefined;
      try {
        const query = client.query.bind(client) as (...parameters: unknown[]) => Promise<unknown>;
        return await query(...args);
      } catch (error) {
        failure = error as Error;
        throw error;
      } finally {
        client.release(failure);
      }
    };
    return run() as never;
  }

  override async end(): Promise<void> {
    try {
      await this.pool.end();
    } finally {
      this.pool.off('error', this.forwardPoolError);
    }
  }
}

export function connectionPool(config: pg.PoolConfig, schema: string | undefined): pg.Pool {
  const pool = new pg.Pool(config);
  return schema ? new SchemaCheckedPool(pool, schema) : pool;
}

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
  // pg parses URL options after PoolConfig and uses PGOPTIONS for an empty value.
  const inherited = options.length
    ? options.at(-1) || environmentOptions
    : schemaOptions || environmentOptions;
  url.searchParams.set('options', `${inherited ? `${inherited} ` : ''}-c timezone=UTC`);
  return url.toString();
}

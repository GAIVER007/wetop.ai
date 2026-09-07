/** Ошибка разбора выгрузки Exely: всегда с указанием строки/сущности, без догадок. */
export class ExelyImportError extends Error {
  override readonly name = 'ExelyImportError';
}

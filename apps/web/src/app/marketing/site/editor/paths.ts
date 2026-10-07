/**
 * Путь в документе SiteSpec для редактора (MKT9): массив ключей и индексов. Строка пути та же, что у валидатора
 * (`pages[0].sections[2].heading.ru`), поэтому ошибка сервера находит своё поле.
 */
export type Path = ReadonlyArray<string | number>;
type Rec = Record<string, unknown>;

export function pathString(path: Path): string {
  return path.reduce<string>((out, key) => (typeof key === 'number' ? `${out}[${key}]` : out ? `${out}.${key}` : key), '');
}

/** Безопасный id элемента формы из пути */
export function pathId(path: Path): string {
  return `ed-${pathString(path).replace(/[^a-zA-Z0-9]+/g, '-')}`;
}

export function getAt(root: unknown, path: Path): unknown {
  let value = root;
  for (const key of path) {
    if (value === null || typeof value !== 'object') return undefined;
    value = (value as Rec)[key as string];
  }
  return value;
}

/** Запись по пути в копию документа; `undefined` снимает поле объекта. Промежуточные объекты создаются */
export function setAt<T extends Rec>(root: T, path: Path, value: unknown): T {
  const copy = structuredClone(root);
  let node: Rec = copy;
  path.slice(0, -1).forEach((key, i) => {
    const next = node[key as string];
    if (next === null || typeof next !== 'object') node[key as string] = typeof path[i + 1] === 'number' ? [] : {};
    node = node[key as string] as Rec;
  });
  const last = path[path.length - 1]!;
  if (value === undefined && !Array.isArray(node)) delete node[last as string];
  else node[last as string] = value;
  return copy;
}

/**
 * Editable list rows need a React key that survives edits and removals, and
 * the rows are rebuilt on every keystroke, so identity cannot supply one.
 * Each row carries a local `_k` that is stripped again before it is saved.
 */
export type Keyed<T> = T & { _k: number };

let counter = 0;

export function rowKey() {
  return ++counter;
}

export function withKeys<T>(rows: T[]): Keyed<T>[] {
  return rows.map((row) => ({ ...row, _k: rowKey() }));
}

export function stripKeys<T>(rows: Keyed<T>[]): T[] {
  return rows.map(({ _k, ...row }) => row as T);
}

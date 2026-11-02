// A date input may be incomplete during editing. Keep invalid values available for
// boundary validation rather than throwing a RangeError during a React render.
export function toIsoDateTime(value: string): string | null {
  if (!value) return null;
  if (
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(
      value,
    )
  )
    return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : value;
}

export function toLocalDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

// API records include IDs, ownership and timestamps that strict write schemas
// intentionally reject. Populate only the fields declared by the form.
export function formValuesFromRecord<T extends object>(defaults: T, record: Partial<T>): T {
  const values = { ...defaults };
  for (const key of Object.keys(defaults) as Array<keyof T>) {
    if (record[key] !== undefined) values[key] = record[key] as T[keyof T];
  }
  return values;
}

import { paginationPageSizes } from "@ipo-mania/validation";

export const defaultPageSize = paginationPageSizes[0];

export function parsePageSize(value: string | null): number {
  const parsed = Number(value);
  return (paginationPageSizes as readonly number[]).includes(parsed) ? parsed : defaultPageSize;
}

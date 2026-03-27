const DEFAULT_EXCHANGE_RATE = 26000.0;

/**
 * Parse and clamp pagination parameters.
 */
export function parsePagination(
  pageStr: string | undefined,
  perPageStr: string | undefined,
  defaultPerPage = 50,
): { page: number; perPage: number } {
  let page = parseInt(pageStr || '1', 10);
  let perPage = parseInt(perPageStr || String(defaultPerPage), 10);
  if (page < 1) page = 1;
  if (perPage > 100) perPage = 100;
  return { page, perPage };
}

/**
 * Parse exchange rate from a setting's plain value.
 */
export function parseExchangeRate(valuePlain: string | null | undefined): number {
  if (!valuePlain) return DEFAULT_EXCHANGE_RATE;
  const r = parseFloat(valuePlain);
  return r > 0 ? r : DEFAULT_EXCHANGE_RATE;
}

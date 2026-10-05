/**
 * Pure helpers that bound Health Connect database requests.
 * No I/O: the caller owns Supabase access and identity rechecks.
 */

/** Maximum external IDs in one `.in()` lookup. */
export const HC_LOOKUP_MAX_IDS = 100;

/**
 * Conservative budget for the fully encoded `in.(...)` filter value of one
 * lookup (framing, quotes and separators included).
 * Leaves room for the path, user/source filters and select list. This is a
 * conservative client budget, not a measured server/proxy URL limit.
 */
export const HC_LOOKUP_MAX_FILTER_CHARS = 4000;

/** Maximum rows in one insert request. */
export const HC_INSERT_MAX_ROWS = 50;

/** Encoded length of the fixed `in.(` + `)` framing: `in.%28` + `%29`. */
const FILTER_FRAMING_CHARS = 9;

/** UTF-8 byte length; a lone surrogate counts as 3 (URLSearchParams emits U+FFFD). */
function utf8Length(value: string): number {
  let bytes = 0;
  for (const ch of value) {
    const cp = ch.codePointAt(0) as number;
    bytes += cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }
  return bytes;
}

/**
 * Worst-case encoded cost of one ID inside `in.("id1","id2")` as serialized by
 * PostgrestClient through URLSearchParams. That encoder percent-encodes every
 * UTF-8 byte except letters, digits and `*-._` (so `! ' ( ) ~` and `"` cost
 * 3 chars each). Assume 3 chars per byte, plus an encoded quote pair (%22 x2)
 * and an encoded separator (%2C). Over-estimating is deliberate.
 */
export function encodedFilterCost(id: string): number {
  return utf8Length(id) * 3 + 6 + 3;
}

function assertPositiveInt(name: string, value: number): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new RangeError(`${name} must be a positive integer`);
  }
}

export class HealthConnectIdTooLongError extends Error {
  constructor() {
    super('Health Connect external ID exceeds the lookup filter limit');
    this.name = 'HealthConnectIdTooLongError';
  }
}

/**
 * Splits IDs into lookup batches bounded by count and encoded filter length.
 * Throws on a single ID that cannot fit in any batch: dropping it would let
 * the caller advance the cursor past an unchecked record.
 */
export function planLookupBatches(
  ids: readonly string[],
  maxIds = HC_LOOKUP_MAX_IDS,
  maxChars = HC_LOOKUP_MAX_FILTER_CHARS,
): string[][] {
  assertPositiveInt('maxIds', maxIds);
  assertPositiveInt('maxChars', maxChars);
  const batches: string[][] = [];
  let current: string[] = [];
  let used = FILTER_FRAMING_CHARS;
  for (const id of ids) {
    const cost = encodedFilterCost(id);
    if (FILTER_FRAMING_CHARS + cost > maxChars) throw new HealthConnectIdTooLongError();
    if (current.length >= maxIds || used + cost > maxChars) {
      batches.push(current);
      current = [];
      used = FILTER_FRAMING_CHARS;
    }
    current.push(id);
    used += cost;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

export function chunk<T>(items: readonly T[], size = HC_INSERT_MAX_ROWS): T[][] {
  assertPositiveInt('size', size);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * One completed session per distinct valid ID, in first-seen order.
 * Missing/non-string/empty IDs and unfinished sessions (no endTime) are
 * ignored; a completed record wins over an earlier unfinished duplicate.
 */
export function completedSessionsById<T extends { endTime?: unknown; metadata?: { id?: unknown } }>(
  sessions: readonly T[],
): Map<string, T> {
  const byId = new Map<string, T>();
  for (const s of sessions) {
    const id = s?.metadata?.id;
    if (typeof id !== 'string' || id.length === 0 || !s.endTime) continue;
    if (!byId.has(id)) byId.set(id, s);
  }
  return byId;
}

/** Returns a Date as a local YYYY-MM-DD string, avoiding UTC offset drift. */
export function toLocalDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

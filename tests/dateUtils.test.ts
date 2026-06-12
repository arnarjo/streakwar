import { toLocalDate } from '../src/lib/dateUtils';

/**
 * All Date inputs are built with the local-time constructor
 * (new Date(year, monthIndex, day, ...)) so assertions hold in ANY timezone.
 */
describe('toLocalDate', () => {
  describe('Date input', () => {
    it('formats a date as YYYY-MM-DD', () => {
      expect(toLocalDate(new Date(2026, 5, 12, 14, 30))).toBe('2026-06-12');
    });

    it('zero-pads single-digit month and day', () => {
      expect(toLocalDate(new Date(2026, 0, 5))).toBe('2026-01-05');
      expect(toLocalDate(new Date(2026, 8, 9))).toBe('2026-09-09');
    });

    it('keeps two-digit month and day intact', () => {
      expect(toLocalDate(new Date(2026, 11, 25))).toBe('2026-12-25');
      expect(toLocalDate(new Date(2026, 9, 10))).toBe('2026-10-10');
    });

    it('handles local midnight (start of day)', () => {
      expect(toLocalDate(new Date(2026, 5, 12, 0, 0, 0, 0))).toBe('2026-06-12');
    });

    it('handles one millisecond before local midnight', () => {
      expect(toLocalDate(new Date(2026, 5, 12, 23, 59, 59, 999))).toBe('2026-06-12');
    });

    it('does not drift across the UTC boundary for early-morning local times', () => {
      // A naive toISOString().slice(0, 10) drifts to the previous day in UTC+ zones.
      expect(toLocalDate(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
    });

    it('does not drift across the UTC boundary for late-evening local times', () => {
      // A naive toISOString().slice(0, 10) drifts to the next day in UTC- zones.
      expect(toLocalDate(new Date(2025, 11, 31, 23, 30))).toBe('2025-12-31');
    });

    it('handles month boundaries', () => {
      expect(toLocalDate(new Date(2026, 0, 31, 23, 59, 59))).toBe('2026-01-31');
      expect(toLocalDate(new Date(2026, 1, 1, 0, 0, 0))).toBe('2026-02-01');
    });

    it('handles year boundaries', () => {
      expect(toLocalDate(new Date(2025, 11, 31, 23, 59, 59, 999))).toBe('2025-12-31');
      expect(toLocalDate(new Date(2026, 0, 1, 0, 0, 0, 0))).toBe('2026-01-01');
    });

    it('handles the leap day', () => {
      expect(toLocalDate(new Date(2024, 1, 29))).toBe('2024-02-29');
      expect(toLocalDate(new Date(2024, 1, 29, 23, 59, 59))).toBe('2024-02-29');
    });

    it('handles non-leap-year end of February', () => {
      expect(toLocalDate(new Date(2026, 1, 28, 23, 59, 59))).toBe('2026-02-28');
      expect(toLocalDate(new Date(2026, 2, 1, 0, 0, 0))).toBe('2026-03-01');
    });

    it('normalizes the Date constructor rollover (Feb 30 -> Mar 2 in 2026)', () => {
      expect(toLocalDate(new Date(2026, 1, 30))).toBe('2026-03-02');
    });
  });

  describe('string input', () => {
    it('parses a local datetime string (no timezone suffix)', () => {
      expect(toLocalDate('2026-03-10T15:30:00')).toBe('2026-03-10');
    });

    it('parses a local midnight datetime string', () => {
      expect(toLocalDate('2026-03-10T00:00:00')).toBe('2026-03-10');
    });

    it('parses a local end-of-day datetime string', () => {
      expect(toLocalDate('2026-03-10T23:59:59')).toBe('2026-03-10');
    });

    it('matches Date-object behavior for the same instant', () => {
      const iso = '2026-07-04T12:00:00';
      expect(toLocalDate(iso)).toBe(toLocalDate(new Date(iso)));
    });

    it('is consistent with new Date() parsing for date-only strings', () => {
      // Date-only strings parse as UTC midnight; toLocalDate must agree with
      // the local components of that same instant (TZ-independent assertion).
      const dateOnly = '2026-07-04';
      expect(toLocalDate(dateOnly)).toBe(toLocalDate(new Date(dateOnly)));
    });
  });

  describe('output shape', () => {
    it('always returns a YYYY-MM-DD shaped string', () => {
      const samples = [
        new Date(2026, 0, 1),
        new Date(1999, 11, 31, 23, 59),
        new Date(2024, 1, 29, 12),
        '2026-06-12T08:00:00',
      ];
      for (const sample of samples) {
        expect(toLocalDate(sample)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    });
  });
});

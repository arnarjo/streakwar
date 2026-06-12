import {
  ACHIEVEMENT_META,
  ACTIVITY_LABELS,
  ACTIVITY_OPTIONS,
  LEAGUE_TIER_META,
  REACTIONS,
  SCORING_MODE_LABELS,
  SOURCE_LABELS,
  TIE_BREAK_LABELS,
} from '../src/types/database';

describe('database type constants', () => {
  describe('ACTIVITY_OPTIONS', () => {
    it('excludes the deprecated "ganga" activity from user-facing options', () => {
      expect(ACTIVITY_OPTIONS).not.toContain('ganga');
    });

    it('has no duplicates', () => {
      expect(new Set(ACTIVITY_OPTIONS).size).toBe(ACTIVITY_OPTIONS.length);
    });

    it('only contains activities that have a label', () => {
      for (const activity of ACTIVITY_OPTIONS) {
        expect(ACTIVITY_LABELS[activity]).toBeTruthy();
      }
    });
  });

  describe('ACHIEVEMENT_META', () => {
    it('provides non-empty icon, title, and desc for every achievement', () => {
      for (const [key, meta] of Object.entries(ACHIEVEMENT_META)) {
        expect(meta.icon.length).toBeGreaterThan(0);
        expect(meta.title.length).toBeGreaterThan(0);
        expect(meta.desc.length).toBeGreaterThan(0);
        expect(key.length).toBeGreaterThan(0);
      }
    });

    it('has unique titles', () => {
      const titles = Object.values(ACHIEVEMENT_META).map((m) => m.title);
      expect(new Set(titles).size).toBe(titles.length);
    });
  });

  describe('REACTIONS', () => {
    it('contains unique reactions', () => {
      expect(new Set(REACTIONS).size).toBe(REACTIONS.length);
    });

    it('is non-empty', () => {
      expect(REACTIONS.length).toBeGreaterThan(0);
    });
  });

  describe('LEAGUE_TIER_META', () => {
    it('uses valid 6-digit hex colors for all tiers', () => {
      for (const meta of Object.values(LEAGUE_TIER_META)) {
        expect(meta.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('has a label and emoji for all tiers', () => {
      for (const meta of Object.values(LEAGUE_TIER_META)) {
        expect(meta.label.length).toBeGreaterThan(0);
        expect(meta.emoji.length).toBeGreaterThan(0);
      }
    });
  });

  describe('label maps', () => {
    it('all scoring mode labels are non-empty', () => {
      for (const label of Object.values(SCORING_MODE_LABELS)) {
        expect(label.length).toBeGreaterThan(0);
      }
    });

    it('all tie-break labels are non-empty', () => {
      for (const label of Object.values(TIE_BREAK_LABELS)) {
        expect(label.length).toBeGreaterThan(0);
      }
    });

    it('all workout source labels are non-empty', () => {
      for (const label of Object.values(SOURCE_LABELS)) {
        expect(label.length).toBeGreaterThan(0);
      }
    });
  });
});

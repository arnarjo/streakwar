import {
  HealthSyncIncompleteError, formatConnectedSyncNote, formatSyncError, formatSyncSuccess,
  isHealthSyncIncompleteError, STALE_SYNC_ALERT, LAST_FULL_SYNC_LABEL,
} from '../src/lib/healthSyncFeedback';
import type { HealthPollResult } from '../src/lib/healthConnect';

type Status = 'ok' | 'skipped' | 'failed';
const poll = (
  exercise: [Status, number, boolean?] | null,
  steps: [Status, number?, boolean?] | null,
  extra: Partial<HealthPollResult> = {},
): HealthPollResult => ({
  synced: 0, ranWithPermissions: true, completed: false,
  ...(exercise ? { exercise: { status: exercise[0], written: exercise[1], cursorAdvanced: exercise[2] ?? exercise[0] === 'ok' } } : {}),
  ...(steps ? { steps: { status: steps[0], written: steps[1] ?? 0, updated: steps[2] ?? false } } : {}),
  ...extra,
});
const fail = (r: HealthPollResult) => formatSyncError(new HealthSyncIncompleteError(r));
const GENERIC = {
  title: 'Sync incomplete',
  message: 'Some activities may have imported. Please check your connection and permissions, then retry.',
};

describe('formatSyncSuccess', () => {
  it('zero: a completed sync is never "Nothing new"', () => {
    expect(formatSyncSuccess(0)).toEqual({ title: 'Sync complete', message: 'Health data checked. No new workouts imported.' });
  });
  it.each([[1, '1 new workout imported.'], [3, '3 new workouts imported.']])('count %i', (n, message) => {
    expect(formatSyncSuccess(n)).toEqual({ title: 'Sync complete', message });
  });
  it.each([-1, 1.5, NaN])('an invalid count never becomes a success message (%s)', n => {
    expect(formatSyncSuccess(n)).toEqual(GENERIC);
  });
});

describe('formatSyncError truth table', () => {
  it('malformed marked errors with null results remain safe generic feedback', () => {
    const malformed = { isHealthSyncIncomplete: true, result: null };
    expect(formatSyncError(malformed)).toEqual(GENERIC);
    expect(formatConnectedSyncNote(malformed)).toBe('Connected, but the first sync did not complete. Please try Sync now.');
  });
  it('does not claim exercise completion without a confirmed cursor save', () => {
    expect(fail(poll(['ok', 2, false], ['failed']))).toEqual(GENERIC);
  });
  it('exercise ok + Steps read permission missing: workouts completed, enable access', () => {
    expect(fail(poll(['ok', 2], ['skipped'], { missingPermissions: ['Steps'] }))).toEqual({
      title: 'Workouts synced, steps incomplete',
      message: 'Workout sync completed: 2 new workouts imported. Steps were not synced because Health Connect step access is not enabled. Enable it in Health Connect settings.',
    });
  });
  it('exercise ok with zero workouts keeps the zero count', () => {
    expect(fail(poll(['ok', 0], ['skipped'], { missingPermissions: ['Steps'] })).message)
      .toContain('Workout sync completed: 0 new workouts imported.');
  });
  it('exercise ok + actual Steps failure: retry, no permission wording', () => {
    const feedback = fail(poll(['ok', 1], ['failed']));
    expect(feedback.message).toBe('Workout sync completed: 1 new workout imported. Steps could not be synced. Please retry.');
    expect(feedback.message).not.toContain('Enable');
  });
  it('exercise ok + Steps skipped without a permission reason: retry', () => {
    expect(fail(poll(['ok', 1], ['skipped'])).message).toContain('Steps were not synced. Please retry.');
  });
  it('partial exercise failure with committed rows: states the saved count and retry', () => {
    expect(fail(poll(['failed', 50, false], ['ok', 1]))).toEqual({
      title: 'Sync incomplete',
      message: '50 workouts were saved before a problem occurred. Please retry to import the rest.',
    });
    expect(fail(poll(['failed', 1, false], ['failed'])).message).toBe('1 workout was saved before a problem occurred. Please retry to import the rest.');
  });
  it('exercise failure with nothing saved never claims saved workouts or success', () => {
    const feedback = fail(poll(['failed', 0, false], ['skipped']));
    expect(feedback.title).toBe('Sync incomplete');
    expect(feedback.message).toBe('No workouts were saved. Please check your connection and permissions, then retry.');
  });
  it('entirely skipped without permission: not completed, no empty-scan claim', () => {
    const feedback = fail(poll(['skipped', 0, false], ['skipped'], { ranWithPermissions: false, missingPermissions: ['ExerciseSession'] }));
    expect(feedback.title).toBe('Sync not completed');
    expect(feedback.message).toBe('Health Connect workout access is not enabled. Enable it in Health Connect settings, then retry.');
  });
  it('entirely skipped for another reason (unavailable or already running): not checked', () => {
    const feedback = fail(poll(['skipped', 0, false], ['skipped'], { ranWithPermissions: false }));
    expect(feedback.title).toBe('Sync not completed');
    expect(feedback.message).toMatch(/was not checked/);
    expect(`${feedback.title} ${feedback.message}`).not.toMatch(/No new workouts|Nothing new|complete\b.*checked/);
  });
  it('never claims Steps changed or counts Steps as workouts', () => {
    const feedback = fail(poll(['ok', 2], ['failed'], { synced: 3 }));
    expect(feedback.message).not.toMatch(/steps (were )?(updated|imported)/i);
    expect(feedback.message).toContain('2 new workouts');
  });
  it.each([
    ['missing exercise outcome', poll(null, ['ok'])],
    ['missing steps outcome', poll(['ok', 1], null)],
    ['legacy result with neither', poll(null, null)],
    ['negative count', poll(['ok', -1], ['failed'])],
    ['fractional count', poll(['failed', 1.5, false], ['ok'])],
    ['both ok but incomplete (inconsistent)', poll(['ok', 1], ['ok'])],
  ])('%s fails safe to the generic guidance, with no invented count', (_n, result) => {
    expect(fail(result)).toEqual(GENERIC);
  });
  it('unknown errors stay generic and never leak their text', () => {
    expect(formatSyncError(new Error('relation "workout_posts" permission denied'))).toEqual(GENERIC);
    expect(formatSyncError('boom')).toEqual(GENERIC);
    expect(formatSyncError(undefined)).toEqual(GENERIC);
    expect(formatSyncError({ result: poll(['ok', 1], ['failed']) })).toEqual(GENERIC);   // not the typed error
  });
});

describe('typed incomplete error', () => {
  it('keeps the recognizable prefix, the result and instanceof', () => {
    const result = poll(['ok', 1], ['failed']);
    const error = new HealthSyncIncompleteError(result);
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(HealthSyncIncompleteError);
    expect(error.message.startsWith('Sync did not complete')).toBe(true);
    expect(error.result).toBe(result);
    expect(isHealthSyncIncompleteError(error)).toBe(true);
    expect(isHealthSyncIncompleteError(new Error('Sync did not complete'))).toBe(false);
  });
});

describe('connected note', () => {
  it('uses the generic wording for unknown or uninterpretable results', () => {
    const generic = 'Connected, but the first sync did not complete. Please try Sync now.';
    expect(formatConnectedSyncNote(new Error('x'))).toBe(generic);
    expect(formatConnectedSyncNote(new HealthSyncIncompleteError(poll(null, null)))).toBe(generic);
  });
  it('reuses the detailed partial wording and never claims everything synced', () => {
    const note = formatConnectedSyncNote(new HealthSyncIncompleteError(poll(['ok', 1], ['skipped'], { missingPermissions: ['Steps'] })));
    expect(note.startsWith('Connected. Workout sync completed: 1 new workout imported.')).toBe(true);
    expect(note).not.toMatch(/recent workouts have been synced/);
  });
});

describe('stale and timestamp wording', () => {
  it('never blames battery optimization and says some data may still have imported', () => {
    expect(STALE_SYNC_ALERT.message).not.toMatch(/battery/i);
    expect(STALE_SYNC_ALERT.message).toMatch(/Some data may still have imported/);
    expect(STALE_SYNC_ALERT.message).toMatch(/permissions, connectivity and system background restrictions/);
    expect(LAST_FULL_SYNC_LABEL).toBe('Last full sync');
  });
});

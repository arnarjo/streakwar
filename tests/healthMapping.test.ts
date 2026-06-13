import {
  mapHCExerciseType,
  mapAppleWorkoutType,
  milesToKm,
  MILES_TO_KM,
} from '../src/lib/healthMapping';

describe('mapHCExerciseType (Health Connect exercise codes)', () => {
  const cases: [number, string][] = [
    [56, 'run'], [57, 'run'],
    [79, 'walk'], [37, 'walk'],
    [8, 'cycle'], [9, 'cycle'],
    [74, 'swim'], [75, 'swim'],
    [62, 'lift'], [44, 'lift'],
    [83, 'yoga'],
    [27, 'hiit'], [38, 'hiit'],
  ];

  it.each(cases)('maps code %i to %s', (code, expected) => {
    expect(mapHCExerciseType(code)).toBe(expected);
  });

  it('falls back to "other" for unknown codes', () => {
    expect(mapHCExerciseType(0)).toBe('other');
    expect(mapHCExerciseType(999)).toBe('other');
    expect(mapHCExerciseType(-1)).toBe('other');
  });
});

describe('mapAppleWorkoutType (HKWorkoutActivityType raw values)', () => {
  const cases: [number, string][] = [
    [37, 'run'],
    [52, 'walk'], [24, 'walk'],
    [13, 'cycle'],
    [46, 'swim'],
    [50, 'lift'], [20, 'lift'],
    [57, 'yoga'],
    [63, 'hiit'],
  ];

  it.each(cases)('maps activityId %i to %s', (id, expected) => {
    expect(mapAppleWorkoutType(id)).toBe(expected);
  });

  it('falls back to "other" for unknown activity ids', () => {
    expect(mapAppleWorkoutType(0)).toBe('other');
    expect(mapAppleWorkoutType(9999)).toBe('other');
  });

  it('does not collide: HC code 57 is run, HK activityId 57 is yoga', () => {
    // Guards against accidentally sharing one table between the two platforms.
    expect(mapHCExerciseType(57)).toBe('run');
    expect(mapAppleWorkoutType(57)).toBe('yoga');
  });
});

describe('milesToKm', () => {
  it('uses the documented conversion factor', () => {
    expect(MILES_TO_KM).toBeCloseTo(1.60934, 5);
  });

  it('converts miles to kilometres', () => {
    expect(milesToKm(0)).toBe(0);
    expect(milesToKm(1)).toBeCloseTo(1.60934, 5);
    expect(milesToKm(5)).toBeCloseTo(8.0467, 3);
    expect(milesToKm(26.2)).toBeCloseTo(42.165, 2); // marathon
  });
});

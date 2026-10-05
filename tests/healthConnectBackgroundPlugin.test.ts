import { patchApplication, patchGradle } from '../plugins/withHealthConnectBackground';

it('registers the native module exactly once across repeated prebuilds', () => {
  const original = 'PackageList(this).packages.apply {\n}';
  const patched = patchApplication(original);
  expect(patched).toContain('add(com.streakwar.health.HealthConnectBackgroundPackage())');
  expect(patchApplication(patched)).toBe(patched);
});

it('adds the matching HC dependency once', () => {
  const patched = patchGradle('dependencies {\n}');
  expect(patched).toContain('androidx.health.connect:connect-client:1.1.0-alpha11');
  expect(patchGradle(patched)).toBe(patched);
});

it('fails visibly when Expo templates change', () => {
  expect(() => patchApplication('changed template')).toThrow('anchor missing');
  expect(() => patchGradle('changed template')).toThrow('anchor missing');
});

import { NativeModules, Platform } from 'react-native';
import { initialize, getGrantedPermissions, requestPermission } from 'react-native-health-connect';
import { getHealthConnectBackgroundState, requestHealthConnectBackground } from '../src/lib/healthConnectBackground';

jest.mock('react-native', () => ({
  Platform: { OS: 'android' }, NativeModules: { StreakWarHealthConnectBackground: { isBackgroundReadSupported: jest.fn() } },
}));
jest.mock('react-native-health-connect', () => ({ initialize: jest.fn(), getGrantedPermissions: jest.fn(), requestPermission: jest.fn() }));
const bridge = NativeModules.StreakWarHealthConnectBackground;
const exercise = { accessType: 'read', recordType: 'ExerciseSession' } as const;
const background = { accessType: 'read', recordType: 'BackgroundAccessPermission' } as const;

beforeEach(() => {
  jest.resetAllMocks();
  Platform.OS = 'android';
  NativeModules.StreakWarHealthConnectBackground = bridge;
  bridge.isBackgroundReadSupported.mockResolvedValue(true);
  jest.mocked(initialize).mockResolvedValue(true);
  jest.mocked(getGrantedPermissions).mockResolvedValue([exercise]);
});

it('does not prompt while checking status', async () => {
  await expect(getHealthConnectBackgroundState()).resolves.toBe('permission_required');
  expect(requestPermission).not.toHaveBeenCalled();
});

it.each(['ios', 'web'] as const)('never loads Android capability on %s', async os => {
  Platform.OS = os;
  await expect(requestHealthConnectBackground()).resolves.toBe('unavailable');
  expect(initialize).not.toHaveBeenCalled();
});

it('fails closed for an old native build without the bridge', async () => {
  delete NativeModules.StreakWarHealthConnectBackground;
  await expect(requestHealthConnectBackground()).resolves.toBe('unavailable');
  expect(requestPermission).not.toHaveBeenCalled();
});

it('does not request optional access when HC is unavailable', async () => {
  jest.mocked(initialize).mockResolvedValue(false);
  await expect(requestHealthConnectBackground()).resolves.toBe('unavailable');
  expect(bridge.isBackgroundReadSupported).not.toHaveBeenCalled();
  expect(requestPermission).not.toHaveBeenCalled();
});

it.each([false, undefined, 1])('requires exact positive native capability (%s)', async supported => {
  bridge.isBackgroundReadSupported.mockResolvedValue(supported);
  await expect(requestHealthConnectBackground()).resolves.toBe(supported === false ? 'unsupported' : 'error');
  expect(requestPermission).not.toHaveBeenCalled();
});

it('requires exercise read access even if background permission exists', async () => {
  jest.mocked(getGrantedPermissions).mockResolvedValue([background, { accessType: 'write', recordType: 'ExerciseSession' }]);
  await expect(requestHealthConnectBackground()).resolves.toBe('foreground_permission_required');
  expect(requestPermission).not.toHaveBeenCalled();
});

it('does not re-request existing background access', async () => {
  jest.mocked(getGrantedPermissions).mockResolvedValue([exercise, background]);
  await expect(requestHealthConnectBackground()).resolves.toBe('granted');
  expect(requestPermission).not.toHaveBeenCalled();
});

it('requests only background read access and rechecks the actual grant', async () => {
  jest.mocked(getGrantedPermissions).mockResolvedValueOnce([exercise]).mockResolvedValue([exercise, background]);
  jest.mocked(requestPermission).mockResolvedValue([]);
  await expect(requestHealthConnectBackground()).resolves.toBe('granted');
  expect(requestPermission).toHaveBeenCalledWith([background]);
});

it('does not treat a request return value as evidence of permission', async () => {
  jest.mocked(requestPermission).mockResolvedValue([background]);
  await expect(requestHealthConnectBackground()).resolves.toBe('permission_required');
});

it('rechecks revoked grants on subsequent calls', async () => {
  jest.mocked(getGrantedPermissions).mockResolvedValueOnce([exercise, background]).mockResolvedValue([exercise]);
  await expect(getHealthConnectBackgroundState()).resolves.toBe('granted');
  await expect(getHealthConnectBackgroundState()).resolves.toBe('permission_required');
});

it('fails closed when native capability throws', async () => {
  bridge.isBackgroundReadSupported.mockRejectedValue(new Error('Native unavailable'));
  await expect(requestHealthConnectBackground()).resolves.toBe('error');
  expect(requestPermission).not.toHaveBeenCalled();
});

it('reports a permission dialog failure', async () => {
  jest.mocked(requestPermission).mockRejectedValue(new Error('Activity unavailable'));
  await expect(requestHealthConnectBackground()).resolves.toBe('error');
});

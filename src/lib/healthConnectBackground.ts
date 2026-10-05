import { NativeModules, Platform } from 'react-native';

export type HealthConnectBackgroundState =
  | 'unavailable' | 'unsupported' | 'foreground_permission_required'
  | 'permission_required' | 'granted' | 'error';

const backgroundPermission = { accessType: 'read', recordType: 'BackgroundAccessPermission' } as const;

function loadHealthConnect(): typeof import('react-native-health-connect') {
  // Keep native loading inside the Android/availability guards, as in healthConnect.ts.
  return require('react-native-health-connect');
}

// Old binaries/Expo Go must fail closed, never guess capability from Android version.
export async function getHealthConnectBackgroundState(): Promise<HealthConnectBackgroundState> {
  if (Platform.OS !== 'android') return 'unavailable';
  try {
    const bridge = NativeModules?.StreakWarHealthConnectBackground;
    if (!bridge?.isBackgroundReadSupported) return 'unavailable';
    const hc = loadHealthConnect();
    if (!await hc.initialize()) return 'unavailable';
    const supported = await bridge.isBackgroundReadSupported();
    if (supported === false) return 'unsupported';
    if (supported !== true) return 'error';
    const grants = await hc.getGrantedPermissions();
    if (!grants.some(p => p.accessType === 'read' && p.recordType === 'ExerciseSession')) {
      return 'foreground_permission_required';
    }
    return grants.some(p => p.accessType === 'read' && p.recordType === 'BackgroundAccessPermission')
      ? 'granted' : 'permission_required';
  } catch {
    return 'error';
  }
}

/** Only call after an explicit foreground user action, never from the worker. */
export async function requestHealthConnectBackground(): Promise<HealthConnectBackgroundState> {
  const state = await getHealthConnectBackgroundState();
  if (state !== 'permission_required') return state;
  try {
    const hc = loadHealthConnect();
    await hc.requestPermission([backgroundPermission]);
    // The request result can be empty for already granted permissions: re-read truth.
    return await getHealthConnectBackgroundState();
  } catch {
    return 'error';
  }
}

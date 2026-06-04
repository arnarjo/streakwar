// StreakWar — app entry. Loads the Saira font family, then renders the navigator.
import React from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Saira_300Light, Saira_400Regular, Saira_500Medium, Saira_600SemiBold, Saira_700Bold,
} from '@expo-google-fonts/saira';
import {
  SairaCondensed_500Medium, SairaCondensed_600SemiBold, SairaCondensed_700Bold, SairaCondensed_800ExtraBold,
} from '@expo-google-fonts/saira-condensed';
import AppNavigator from './src/navigation/AppNavigator';
import { C } from './src/theme';

export default function App() {
  const [fontsLoaded] = useFonts({
    Saira_300Light, Saira_400Regular, Saira_500Medium, Saira_600SemiBold, Saira_700Bold,
    SairaCondensed_500Medium, SairaCondensed_600SemiBold, SairaCondensed_700Bold, SairaCondensed_800ExtraBold,
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: C.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <AppNavigator />
      </View>
    </SafeAreaProvider>
  );
}

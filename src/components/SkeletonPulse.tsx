import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue, withRepeat, withSequence, withTiming, useAnimatedStyle,
} from 'react-native-reanimated';

interface PulseProps {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function SkeletonPulse({ width = '100%', height = 16, radius = 6, style }: PulseProps) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 800 }),
        withTiming(1,   { duration: 800 }),
      ),
      -1,
      false,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width: width as any, height, borderRadius: radius, backgroundColor: '#1A2332' },
        animStyle,
        style,
      ]}
      accessibilityElementsHidden={true}
      importantForAccessibility="no"
    />
  );
}

export function WorkoutPostSkeleton() {
  return (
    <View style={sk.card}>
      <View style={sk.header}>
        <SkeletonPulse width={42} height={42} radius={21} />
        <View style={{ flex: 1, gap: 7 }}>
          <SkeletonPulse width="45%" height={14} />
          <SkeletonPulse width="28%" height={11} />
        </View>
      </View>
      <View style={{ gap: 7, marginTop: 13 }}>
        <SkeletonPulse height={14} />
        <SkeletonPulse width="75%" height={14} />
      </View>
      <SkeletonPulse height={38} radius={10} style={{ marginTop: 14 }} />
    </View>
  );
}

const sk = StyleSheet.create({
  card: {
    backgroundColor: '#151C24',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    padding: 15,
    marginBottom: 12,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});

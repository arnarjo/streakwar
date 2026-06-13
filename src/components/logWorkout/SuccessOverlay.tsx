import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';

interface SuccessOverlayProps {
  successOpacity: Animated.Value;
  successScale: Animated.Value;
}

export default function SuccessOverlay({ successOpacity, successScale }: SuccessOverlayProps) {
  return (
    <Animated.View style={[s.successOverlay, { opacity: successOpacity }]}>
      <Animated.View style={[s.successCard, { transform: [{ scale: successScale }] }]}>
        <View style={s.successIconCircle}>
          <Text style={s.successIconText}>✓</Text>
        </View>
        <Text style={s.successTitle}>Workout logged! 💪</Text>
        <Text style={s.successSub}>Keep that streak going!</Text>
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  successCard: {
    backgroundColor: '#151C24',
    borderRadius: 24,
    padding: 36,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: '#22C55E40',
    width: 260,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#22C55E20',
    borderWidth: 2,
    borderColor: '#22C55E60',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  successIconText: { fontSize: 36, color: '#22C55E', fontWeight: '900', lineHeight: 40 },
  successTitle: { fontSize: 20, fontWeight: '900', color: '#EEF4F8' },
  successSub: { fontSize: 14, color: '#637C8F' },
});

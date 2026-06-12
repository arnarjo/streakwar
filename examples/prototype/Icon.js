// StreakWar — Celebration overlay (used after logging a workout)
import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, Easing, Dimensions } from 'react-native';
import Icon from './Icon';
import { Btn } from './ui';
import { C, a, f } from '../theme';

const COLS = [C.primary, C.amber, C.green, C.blue, C.primaryBri, '#fff'];
const { width: SW } = Dimensions.get('window');

function Confetti() {
  const pieces = useRef(
    Array.from({ length: 26 }, (_, i) => ({
      v: new Animated.Value(0),
      left: Math.random() * SW,
      color: COLS[i % COLS.length],
      size: 6 + Math.random() * 7,
      round: Math.random() > 0.6,
      rot: Math.random() * 360,
      dur: 1500 + Math.random() * 1100,
    }))
  ).current;

  useEffect(() => {
    const anims = pieces.map((p) =>
      Animated.timing(p.v, { toValue: 1, duration: p.dur, delay: Math.random() * 400, easing: Easing.in(Easing.quad), useNativeDriver: true })
    );
    Animated.parallel(anims).start();
  }, []);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute', top: -20, left: p.left,
            width: p.size, height: p.round ? p.size : p.size * 0.5,
            backgroundColor: p.color, borderRadius: p.round ? p.size : 2,
            opacity: p.v.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, 520] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: [`${p.rot}deg`, `${p.rot + 540}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}

export default function Celebration({ streak, milestone, onDone }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 80, useNativeDriver: true }).start();
  }, []);
  return (
    <View style={{
      position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 80,
      backgroundColor: 'rgba(4,7,12,0.86)', alignItems: 'center', justifyContent: 'center', padding: 30,
    }}>
      <Confetti />
      <Animated.View style={{ alignItems: 'center', opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }] }}>
        <View style={{
          width: 148, height: 148, borderRadius: 74, marginBottom: 24,
          backgroundColor: a(C.primary, 0.18), borderWidth: 2, borderColor: a(C.primary, 0.6),
          alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon name="flame" size={74} color={C.primary} stroke={1.7} />
        </View>
        <Text style={f('disp', 800, 80, { color: C.primary, letterSpacing: -3, lineHeight: 80, textShadowColor: a(C.primary, 0.6), textShadowRadius: 30, textShadowOffset: { width: 0, height: 6 } })}>{streak}</Text>
        <Text style={f('disp', 700, 22, { color: C.text, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 4 })}>
          {milestone ? `${streak}-day milestone!` : 'Day streak'}
        </Text>
        <Text style={f('ui', 400, 15, { color: C.text2, marginTop: 8, maxWidth: 260, textAlign: 'center' })}>
          {milestone ? 'Legendary. Your peers just got notified — flex it.' : 'Workout logged. Streak alive. Keep the fire going.'}
        </Text>
        <Btn size="lg" onPress={onDone} style={{ marginTop: 26, minWidth: 200 }} icon={milestone ? 'share' : 'check'}>
          {milestone ? 'Share milestone' : 'Nice'}
        </Btn>
      </Animated.View>
    </View>
  );
}

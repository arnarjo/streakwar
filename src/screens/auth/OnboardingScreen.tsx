import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Dimensions, TouchableOpacity,
  FlatList, Animated, StatusBar, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { C } from '../../theme';

const { width } = Dimensions.get('window');

const slides = [
  {
    id: '1',
    emoji: '🔥',
    title: 'Compete with friends',
    subtitle: 'Create group challenges with friends, family or coworkers. Everyone competes on a live leaderboard.',
    accent: '#F97316',
  },
  {
    id: '2',
    emoji: '💪',
    title: 'Any workout counts',
    subtitle: 'Running, lifting, cycling, yoga — all activities earn points. You choose how the challenge is scored.',
    accent: '#FBBF24',
  },
  {
    id: '3',
    emoji: '⚡',
    title: 'Auto-synced, no manual entry',
    subtitle: 'Connect Apple Health, Google Health Connect, or Strava. Your workouts are credited automatically — even when the app is closed.',
    accent: '#38BDF8',
  },
  {
    id: '4',
    emoji: '🏆',
    title: 'Build your streak',
    subtitle: 'Stay active every day. Earn streak points. Win the challenge.',
    accent: '#22C55E',
  },
];

type Props = { navigation: NativeStackNavigationProp<any> };

export default function OnboardingScreen({ navigation }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  function goNext() {
    if (currentIndex < slides.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      navigation.navigate('Signup');
    }
  }

  const accent = slides[currentIndex]?.accent ?? C.primary;

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      <View style={s.topBar}>
        <View />
        <TouchableOpacity onPress={() => navigation.navigate('Signup')}>
          <Text style={s.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      <Animated.FlatList
        ref={flatListRef}
        data={slides}
        keyExtractor={item => item.id}
        horizontal pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEnabled={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        renderItem={({ item }) => (
          <View style={[s.slide, { width }]}>
            <View style={[s.emojiCircle, { borderColor: item.accent + '40', backgroundColor: item.accent + '15' }]}>
              <Text style={s.emoji}>{item.emoji}</Text>
            </View>
            <View style={[s.accentLine, { backgroundColor: item.accent }]} />
            <Text style={s.title}>{item.title}</Text>
            <Text style={s.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      <View style={s.dotsRow}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              s.dot,
              i === currentIndex
                ? { width: 24, backgroundColor: accent }
                : { width: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
            ]}
          />
        ))}
      </View>

      <View style={s.bottomArea}>
        <TouchableOpacity style={[s.nextBtn, { backgroundColor: accent }]} onPress={goNext} activeOpacity={0.85}>
          <Text style={s.nextBtnText}>
            {currentIndex === slides.length - 1 ? "Let's go 🚀" : 'Next →'}
          </Text>
        </TouchableOpacity>
        {currentIndex === slides.length - 1 && (
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.loginLink}>
            <Text style={s.loginLinkText}>Already have an account? Sign in</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 4 },
  skipText: { color: C.muted2, fontSize: 14, fontWeight: '600' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emojiCircle: { width: 140, height: 140, borderRadius: 70, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  emoji: { fontSize: 64 },
  accentLine: { width: 40, height: 3, borderRadius: 2, marginBottom: 20 },
  title: { fontSize: 30, fontWeight: '800', color: C.text, textAlign: 'center', marginBottom: 14, letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: C.muted2, textAlign: 'center', lineHeight: 24 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingBottom: 20 },
  dot: { height: 8, borderRadius: 4 },
  bottomArea: { paddingHorizontal: 24, paddingBottom: Platform.OS === 'ios' ? 24 : 32, gap: 12 },
  nextBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  nextBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  loginLink: { alignItems: 'center', paddingVertical: 4 },
  loginLinkText: { color: C.muted2, fontSize: 14, fontWeight: '500' },
});

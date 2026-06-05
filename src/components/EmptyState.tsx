import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../theme';

interface Props {
  emoji: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({ emoji, title, subtitle, ctaLabel, onCta }: Props) {
  return (
    <View style={s.container}>
      <Text style={s.emoji}>{emoji}</Text>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      {ctaLabel && onCta ? (
        <TouchableOpacity style={s.cta} onPress={onCta} activeOpacity={0.7}>
          <Text style={s.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 64, gap: 12, paddingHorizontal: 32 },
  emoji:     { fontSize: 48 },
  title:     { fontSize: 16, fontWeight: '700', color: C.muted, textAlign: 'center' },
  subtitle:  { fontSize: 14, color: C.muted, textAlign: 'center', lineHeight: 20 },
  cta:       { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12, marginTop: 4 },
  ctaText:   { color: '#000', fontWeight: '800', fontSize: 14 },
});

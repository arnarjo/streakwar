import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { C } from '../theme';

export function ProBadge() {
  return (
    <View style={s.badge}>
      <Text style={s.text}>PRO</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { backgroundColor: C.gold + '20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  text:  { fontSize: 9, fontWeight: '800', color: C.gold, letterSpacing: 0.5 },
});

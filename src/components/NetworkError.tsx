import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { C } from '../theme';

export function NetworkError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={s.container}>
      <Text style={s.emoji}>📡</Text>
      <Text style={s.title}>No connection</Text>
      <Text style={s.msg}>Check your internet connection and try again.</Text>
      <TouchableOpacity style={s.btn} onPress={onRetry}>
        <Text style={s.btnText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: C.text, marginBottom: 8 },
  msg: { fontSize: 14, color: C.dimmed, textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: C.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: '#000', fontWeight: '800', fontSize: 15 },
});

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function NetworkError({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={s.container}>
      <Text style={s.emoji}>📡</Text>
      <Text style={s.title}>Engin nettenging</Text>
      <Text style={s.msg}>Athugaðu nettenginguna þína og reyndu aftur.</Text>
      <TouchableOpacity style={s.btn} onPress={onRetry}>
        <Text style={s.btnText}>Reyna aftur</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C1117', alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#EEF4F8', marginBottom: 8 },
  msg: { fontSize: 14, color: '#4A6070', textAlign: 'center', marginBottom: 24 },
  btn: { backgroundColor: '#F97316', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: '#000', fontWeight: '800', fontSize: 15 },
});

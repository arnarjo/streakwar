import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface State { hasError: boolean; error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={s.container}>
        <Text style={s.emoji}>⚡</Text>
        <Text style={s.title}>Eitthvað fór úrskeiðis</Text>
        <Text style={s.errorMsg} selectable>
          {this.state.error?.message ?? 'Unknown error'}
        </Text>
        {__DEV__ && (
          <Text style={s.errorStack} selectable>
            {this.state.error?.stack?.slice(0, 600) ?? ''}
          </Text>
        )}
        <TouchableOpacity style={s.btn} onPress={() => this.setState({ hasError: false, error: null })}>
          <Text style={s.btnText}>Reyna aftur</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0C1117', alignItems: 'center', justifyContent: 'center', padding: 32 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', color: '#EEF4F8', marginBottom: 8 },
  msg: { fontSize: 14, color: '#4A6070', textAlign: 'center', marginBottom: 24 },
  errorMsg: { fontSize: 13, color: '#F97316', textAlign: 'center', marginBottom: 8, fontWeight: '700' },
  errorStack: { fontSize: 10, color: '#4A6070', textAlign: 'left', marginBottom: 16, fontFamily: 'monospace' },
  btn: { backgroundColor: '#F97316', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  btnText: { color: '#000', fontWeight: '800', fontSize: 15 },
});

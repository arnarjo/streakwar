import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { C } from '../../theme';


export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleReset() {
    const pwErrors: string[] = [];
    if (password.length < 8) pwErrors.push('at least 8 characters');
    if (!/[A-Z]/.test(password)) pwErrors.push('one uppercase letter');
    if (!/[a-z]/.test(password)) pwErrors.push('one lowercase letter');
    if (!/[0-9]/.test(password)) pwErrors.push('one number');
    if (!/[^A-Za-z0-9]/.test(password)) pwErrors.push('one special character (!@#$...)');
    if (pwErrors.length > 0) {
      setError('Must include: ' + pwErrors.join(', '));
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message || 'Failed to update password. Please try again.');
      return;
    }

    Alert.alert(
      'Password updated',
      'Your password has been changed. Please sign in with your new password.',
      [{ text: 'Sign in', onPress: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) Alert.alert('Error', 'Could not sign out. Please restart the app.');
      }}],
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={s.inner}>
          <Text style={s.logo}>STREAKWAR</Text>
          <Text style={s.title}>Set new password</Text>
          <Text style={s.subtitle}>Choose a strong password for your account.</Text>

          <View style={s.inputGroup}>
            <Text style={s.label}>NEW PASSWORD</Text>
            <View style={s.passwordRow}>
              <TextInput
                style={[s.input, s.passwordInput]}
                placeholder="8+ characters"
                placeholderTextColor={C.dimmed}
                value={password}
                onChangeText={t => { setPassword(t); setError(''); }}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                returnKeyType="next"
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.inputGroup}>
            <Text style={s.label}>CONFIRM PASSWORD</Text>
            <TextInput
              style={s.input}
              placeholder="Repeat your password"
              placeholderTextColor={C.dimmed}
              value={confirm}
              onChangeText={t => { setConfirm(t); setError(''); }}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleReset}
            />
          </View>

          {error ? <Text style={s.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[s.btn, loading && { opacity: 0.6 }]}
            onPress={handleReset}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color="#000" />
              : <Text style={s.btnText}>Update password</Text>
            }
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 48 },
  logo: { fontSize: 24, fontWeight: '900', color: C.primary, letterSpacing: 4, marginBottom: 28 },
  title: { fontSize: 26, fontWeight: '800', color: C.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: C.muted, marginBottom: 32, lineHeight: 20 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 8 },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, color: C.text, fontSize: 15, flex: 1,
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: {
    backgroundColor: C.bg, borderWidth: 1, borderLeftWidth: 0, borderColor: C.border,
    borderTopRightRadius: 12, borderBottomRightRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center',
  },
  eyeIcon: { fontSize: 16 },
  errorText: { color: C.error, fontSize: 13, marginBottom: 16, marginLeft: 4 },
  btn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#000', fontSize: 16, fontWeight: '800' },
});

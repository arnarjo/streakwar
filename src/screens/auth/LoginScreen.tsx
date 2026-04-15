import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  Animated, ActivityIndicator, StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';

const C = {
  bg: '#0C1117', border: 'rgba(255,255,255,0.08)', text: '#EEF4F8',
  muted: '#4A6070', dimmed: '#1E2A35', primary: '#F97316', error: '#EF4444',
};

type Props = { navigation: NativeStackNavigationProp<any> };

export default function LoginScreen({ navigation }: Props) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const shakeAnim = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) e.email = 'Invalid email address';
    if (!password) e.password = 'Password is required';
    setErrors(e);
    if (Object.keys(e).length > 0) { shake(); return false; }
    return true;
  }

  async function handleLogin() {
    if (!validate()) return;
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) { shake(); setErrors({ email: 'Incorrect email or password' }); }
  }

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={s.logoArea}>
            <Text style={s.logo}>STREAKWAR</Text>
            <View style={[s.logoLine, { backgroundColor: C.primary }]} />
          </View>

          <Text style={s.title}>Welcome back</Text>
          <Text style={s.subtitle}>Sign in to continue</Text>

          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            <View style={s.inputGroup}>
              <Text style={s.label}>EMAIL</Text>
              <TextInput
                style={[s.input, errors.email && s.inputError]}
                placeholder="you@example.com"
                placeholderTextColor={C.dimmed}
                value={email}
                onChangeText={t => { setEmail(t); setErrors(e => ({ ...e, email: undefined })); }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
              {errors.email && <Text style={s.errorText}>{errors.email}</Text>}
            </View>

            <View style={s.inputGroup}>
              <Text style={s.label}>PASSWORD</Text>
              <View style={s.passwordRow}>
                <TextInput
                  style={[s.input, s.passwordInput, errors.password && s.inputError]}
                  placeholder="••••••••"
                  placeholderTextColor={C.dimmed}
                  value={password}
                  onChangeText={t => { setPassword(t); setErrors(e => ({ ...e, password: undefined })); }}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                  <Text style={s.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
                </TouchableOpacity>
              </View>
              {errors.password && <Text style={s.errorText}>{errors.password}</Text>}
            </View>

            <TouchableOpacity
              style={s.forgotBtn}
              onPress={() => Alert.alert('Reset password', "We'll send you a reset email.")}
            >
              <Text style={s.forgotText}>Forgot password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.loginBtn, loading && s.btnDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? <ActivityIndicator color="#000" /> : <Text style={s.loginBtnText}>Sign in</Text>}
            </TouchableOpacity>
          </Animated.View>

          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>or</Text>
            <View style={s.dividerLine} />
          </View>

          <TouchableOpacity style={s.signupBtn} onPress={() => navigation.navigate('Signup')}>
            <Text style={s.signupBtnText}>Create a new account</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  backBtn: { paddingTop: 8, paddingBottom: 16, alignSelf: 'flex-start' },
  backText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  logoArea: { alignItems: 'center', marginBottom: 32, marginTop: 8 },
  logo: { fontSize: 28, fontWeight: '900', color: C.primary, letterSpacing: 5 },
  logoLine: { width: 40, height: 3, borderRadius: 2, marginTop: 6 },
  title: { fontSize: 28, fontWeight: '800', color: C.text, marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 15, color: C.muted, marginBottom: 28 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 8 },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, color: C.text, fontSize: 15, flex: 1,
  },
  inputError: { borderColor: C.error },
  errorText: { color: C.error, fontSize: 12, marginTop: 5, marginLeft: 4 },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: {
    backgroundColor: C.bg, borderWidth: 1, borderLeftWidth: 0, borderColor: C.border,
    borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center',
  },
  eyeIcon: { fontSize: 16 },
  forgotBtn: { alignSelf: 'flex-end', marginBottom: 20, marginTop: -4 },
  forgotText: { color: C.primary, fontSize: 13, fontWeight: '600' },
  loginBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  dividerText: { color: C.dimmed, fontSize: 13 },
  signupBtn: { borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  signupBtnText: { color: C.text, fontSize: 15, fontWeight: '700' },
});

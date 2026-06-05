import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  Animated, ActivityIndicator, StatusBar, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../hooks/useAuth';
import { C } from '../../theme';


type Props = { navigation: NativeStackNavigationProp<any> };
type FormErrors = { fullName?: string; username?: string; email?: string; password?: string; confirm?: string };
const USERNAME_REGEX = /^[a-zA-Z0-9_.]{3,20}$/;

export default function SignupScreen({ navigation }: Props) {
  const { signUp, signInWithGoogle, signInWithFacebook } = useAuth();
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [step, setStep] = useState<1 | 2>(1);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  async function handleSocialSignIn(provider: 'google' | 'facebook') {
    setSocialLoading(provider);
    const fn = provider === 'google' ? signInWithGoogle : signInWithFacebook;
    const { error } = await fn();
    setSocialLoading(null);
    if (error) Alert.alert('Sign up failed', error.message || 'Something went wrong. Please try again.');
  }

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 55, useNativeDriver: true }),
    ]).start();
  }

  function validateStep1(): boolean {
    const e: FormErrors = {};
    if (!fullName.trim()) e.fullName = 'Full name is required';
    else if (fullName.trim().length < 2) e.fullName = 'Name is too short';
    if (!username.trim()) e.username = 'Username is required';
    else if (!USERNAME_REGEX.test(username)) e.username = '3–20 chars, letters, numbers, . and _';
    setErrors(e);
    if (Object.keys(e).length > 0) { shake(); return false; }
    return true;
  }

  function validateStep2(): boolean {
    const e: FormErrors = {};
    if (!email.trim()) e.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) e.email = 'Invalid email address';
    if (!password) {
      e.password = 'Password is required';
    } else {
      const pwErrors: string[] = [];
      if (password.length < 8) pwErrors.push('at least 8 characters');
      if (!/[A-Z]/.test(password)) pwErrors.push('one uppercase letter');
      if (!/[a-z]/.test(password)) pwErrors.push('one lowercase letter');
      if (!/[0-9]/.test(password)) pwErrors.push('one number');
      if (!/[^A-Za-z0-9]/.test(password)) pwErrors.push('one special character (!@#$...)');
      if (pwErrors.length > 0) e.password = 'Must include: ' + pwErrors.join(', ');
    }
    if (!confirm) e.confirm = 'Please confirm your password';
    else if (password !== confirm) e.confirm = 'Passwords do not match';
    setErrors(e);
    if (Object.keys(e).length > 0) { shake(); return false; }
    return true;
  }

  async function handleSignUp() {
    if (!validateStep2()) return;
    setLoading(true);
    const { error } = await signUp(email.trim(), password, username.trim(), fullName.trim());
    setLoading(false);
    if (error) {
      shake();
      if (error.message.includes('already registered')) setErrors({ email: 'This email is already registered' });
      else Alert.alert('Error', error.message || 'Something went wrong. Please try again.');
    } else {
      Alert.alert('Check your email', "We've sent a confirmation link to " + email.trim() + ". Tap the link and you'll be signed in automatically.", [
        { text: 'OK', onPress: () => navigation.replace('Login') },
      ]);
    }
  }

  function passwordStrength() {
    if (!password) return { label: '', color: 'transparent', width: '0%' };
    let score = 0;
    if (password.length >= 8)  score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { label: 'Weak',   color: C.error,   width: '20%' };
    if (score === 2) return { label: 'Fair',   color: '#FBBF24', width: '40%' };
    if (score === 3) return { label: 'Good',   color: '#38BDF8', width: '65%' };
    if (score === 4) return { label: 'Strong', color: C.success, width: '85%' };
    return { label: 'Excellent 💪', color: C.success, width: '100%' };
  }
  const strength = passwordStrength();

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={s.backBtn} onPress={() => step === 2 ? setStep(1) : navigation.goBack()}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>

          <View style={s.progressBar}>
            <View style={[s.progressFill, { width: step === 1 ? '50%' : '100%' }]} />
          </View>
          <Text style={s.progressLabel}>Step {step} of 2</Text>

          <Text style={s.logo}>STREAKWAR</Text>
          <Text style={s.title}>{step === 1 ? "What's your name?" : 'Set up your account'}</Text>
          <Text style={s.subtitle}>
            {step === 1 ? "This is how you'll appear on leaderboards" : 'Set up your login credentials'}
          </Text>

          {step === 1 && (
            <>
              <TouchableOpacity
                style={s.socialBtn}
                onPress={() => handleSocialSignIn('google')}
                disabled={!!socialLoading}
                activeOpacity={0.8}
              >
                {socialLoading === 'google'
                  ? <ActivityIndicator color={C.text} size="small" />
                  : <><Text style={s.socialIcon}>G</Text><Text style={s.socialBtnText}>Sign up with Google</Text></>
                }
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.socialBtn, s.facebookBtn]}
                onPress={() => handleSocialSignIn('facebook')}
                disabled={!!socialLoading}
                activeOpacity={0.8}
              >
                {socialLoading === 'facebook'
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <><Text style={[s.socialIcon, { color: '#fff' }]}>f</Text><Text style={[s.socialBtnText, { color: '#fff' }]}>Sign up with Facebook</Text></>
                }
              </TouchableOpacity>
              <View style={s.divider}>
                <View style={s.dividerLine} />
                <Text style={s.dividerText}>or continue with email</Text>
                <View style={s.dividerLine} />
              </View>
            </>
          )}

          <Animated.View style={{ transform: [{ translateX: shakeAnim }] }}>
            {step === 1 ? (
              <>
                <View style={s.inputGroup}>
                  <Text style={s.label}>FULL NAME</Text>
                  <TextInput
                    style={[s.input, errors.fullName && s.inputError]}
                    placeholder="Jane Smith"
                    placeholderTextColor={C.muted}
                    value={fullName}
                    onChangeText={t => { setFullName(t); setErrors(e => ({ ...e, fullName: undefined })); }}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                  {errors.fullName && <Text style={s.errorText}>{errors.fullName}</Text>}
                </View>

                <View style={s.inputGroup}>
                  <Text style={s.label}>USERNAME</Text>
                  <View style={s.prefixRow}>
                    <View style={s.prefixBox}><Text style={s.prefixText}>@</Text></View>
                    <TextInput
                      style={[s.input, s.prefixInput, errors.username && s.inputError]}
                      placeholder="jane.smith"
                      placeholderTextColor={C.muted}
                      value={username}
                      onChangeText={t => { setUsername(t.toLowerCase().replace(/\s/g, '')); setErrors(e => ({ ...e, username: undefined })); }}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={() => validateStep1() && setStep(2)}
                    />
                  </View>
                  {errors.username && <Text style={s.errorText}>{errors.username}</Text>}
                </View>

                <TouchableOpacity style={s.primaryBtn} onPress={() => validateStep1() && setStep(2)} activeOpacity={0.85}>
                  <Text style={s.primaryBtnText}>Next →</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={s.inputGroup}>
                  <Text style={s.label}>EMAIL</Text>
                  <TextInput
                    style={[s.input, errors.email && s.inputError]}
                    placeholder="you@example.com"
                    placeholderTextColor={C.muted}
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
                      placeholder="8+ chars, A-Z, 0-9, !@#..."
                      placeholderTextColor={C.muted}
                      value={password}
                      onChangeText={t => { setPassword(t); setErrors(e => ({ ...e, password: undefined })); }}
                      secureTextEntry={!showPassword}
                      returnKeyType="next"
                    />
                    <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                      <Text>{showPassword ? '🙈' : '👁'}</Text>
                    </TouchableOpacity>
                  </View>
                  {errors.password && <Text style={s.errorText}>{errors.password}</Text>}
                  {password.length > 0 && (
                    <View style={s.strengthRow}>
                      <View style={s.strengthTrack}>
                        <View style={[s.strengthFill, { width: strength.width as any, backgroundColor: strength.color }]} />
                      </View>
                      <Text style={[s.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
                    </View>
                  )}
                </View>

                <View style={s.inputGroup}>
                  <Text style={s.label}>CONFIRM PASSWORD</Text>
                  <TextInput
                    style={[s.input, errors.confirm && s.inputError, confirm.length > 0 && password === confirm && s.inputSuccess]}
                    placeholder="Repeat your password"
                    placeholderTextColor={C.muted}
                    value={confirm}
                    onChangeText={t => { setConfirm(t); setErrors(e => ({ ...e, confirm: undefined })); }}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleSignUp}
                  />
                  {errors.confirm && <Text style={s.errorText}>{errors.confirm}</Text>}
                  {confirm.length > 0 && password === confirm && <Text style={s.successText}>✓ Passwords match</Text>}
                </View>

                <TouchableOpacity style={[s.primaryBtn, loading && s.btnDisabled]} onPress={handleSignUp} disabled={loading} activeOpacity={0.85}>
                  {loading ? <ActivityIndicator color="#000" /> : <Text style={s.primaryBtnText}>Create account 🚀</Text>}
                </TouchableOpacity>
              </>
            )}
          </Animated.View>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={s.loginLink}>
            <Text style={s.loginLinkText}>
              Already have an account? <Text style={{ color: C.primary, fontWeight: '700' }}>Sign in</Text>
            </Text>
          </TouchableOpacity>

          <Text style={s.legalText}>
            By creating an account you agree to our{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL('https://arnarjo.github.io/streakwar/terms-of-service.html')}>Terms of Service</Text>
            {' '}and{' '}
            <Text style={s.legalLink} onPress={() => Linking.openURL('https://arnarjo.github.io/streakwar/privacy-policy.html')}>Privacy Policy</Text>
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 48 },
  backBtn: { paddingTop: 8, paddingBottom: 12, alignSelf: 'flex-start' },
  backText: { color: C.muted, fontSize: 14, fontWeight: '600' },
  progressBar: { height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 6, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: C.primary, borderRadius: 2 },
  progressLabel: { fontSize: 11, color: C.muted, marginBottom: 24, fontWeight: '600', letterSpacing: 0.5 },
  logo: { fontSize: 24, fontWeight: '900', color: C.primary, letterSpacing: 4, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '800', color: C.text, marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: 14, color: C.muted, marginBottom: 28, lineHeight: 20 },
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 8 },
  input: { backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, color: C.text, fontSize: 15, flex: 1 },
  inputError: { borderColor: C.error },
  inputSuccess: { borderColor: C.success },
  errorText: { color: C.error, fontSize: 12, marginTop: 5, marginLeft: 4 },
  successText: { color: C.success, fontSize: 12, marginTop: 5, marginLeft: 4 },
  prefixRow: { flexDirection: 'row', alignItems: 'center' },
  prefixBox: { backgroundColor: C.bg, borderWidth: 1, borderRightWidth: 0, borderColor: C.border, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center' },
  prefixText: { color: C.muted, fontSize: 16, fontWeight: '600' },
  prefixInput: { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: { backgroundColor: C.bg, borderWidth: 1, borderLeftWidth: 0, borderColor: C.border, borderTopRightRadius: 12, borderBottomRightRadius: 12, paddingHorizontal: 14, paddingVertical: 14, justifyContent: 'center' },
  strengthRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  strengthTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  strengthFill: { height: '100%', borderRadius: 2 },
  strengthLabel: { fontSize: 11, fontWeight: '700', minWidth: 60, textAlign: 'right' },
  primaryBtn: { backgroundColor: C.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.2 },
  loginLink: { alignItems: 'center', marginTop: 24 },
  loginLinkText: { color: C.muted, fontSize: 14 },
  legalText: { color: C.muted, fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 17, paddingHorizontal: 16 },
  legalLink: { color: C.primary, fontWeight: '600' },
  socialBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', borderRadius: 14,
    paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.06)', marginBottom: 10,
  },
  facebookBtn: { backgroundColor: '#1877F2', borderColor: '#1877F2' },
  socialIcon: { fontSize: 17, fontWeight: '800', color: C.text, width: 20, textAlign: 'center' },
  socialBtnText: { fontSize: 15, fontWeight: '700', color: C.text },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  dividerText: { color: C.muted, fontSize: 12 },
});

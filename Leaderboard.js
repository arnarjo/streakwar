// StreakWar — Auth screens: Onboarding, Login, Signup, Reset
import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Icon from '../components/Icon';
import { Screen, Btn, Field, Wordmark } from '../components/ui';
import { C, a, f } from '../theme';
import { DB } from '../data';

// ── Onboarding ──
export function Onboarding({ nav }) {
  const [i, setI] = useState(0);
  const slides = DB.onboard;
  const s = slides[i];
  const last = i === slides.length - 1;
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 10 }}>
        <Wordmark size={20} />
        <TouchableOpacity activeOpacity={0.7} onPress={() => nav('signup')} style={{ padding: 8 }}>
          <Text style={f('ui', 600, 14, { color: C.text2 })}>Skip</Text>
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <View style={{ marginBottom: 34, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{
            width: 150, height: 150, borderRadius: 75,
            backgroundColor: a(C.primary, 0.12), borderWidth: 1.5, borderColor: a(C.primary, 0.35),
            alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name={s.icon} size={66} color={C.primary} stroke={1.6} />
          </View>
        </View>
        <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: C.primary, marginBottom: 22 }} />
        <Text style={f('disp', 700, 33, { color: C.text, letterSpacing: -0.5, textTransform: 'uppercase', lineHeight: 37, textAlign: 'center', marginBottom: 18 })}>{s.title}</Text>
        <Text style={f('ui', 400, 16, { color: C.text2, lineHeight: 24, textAlign: 'center', maxWidth: 300 })}>{s.body}</Text>
      </View>
      <View style={{ paddingHorizontal: 24, paddingBottom: 22 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 22 }}>
          {slides.map((_, k) => (
            <TouchableOpacity key={k} activeOpacity={0.7} onPress={() => setI(k)} style={{
              height: 7, borderRadius: 4, width: k === i ? 26 : 7,
              backgroundColor: k === i ? C.primary : 'rgba(255,255,255,0.18)',
            }} />
          ))}
        </View>
        <Btn full size="lg" onPress={() => (last ? nav('signup') : setI(i + 1))} iconR={last ? undefined : 'arrowR'}>
          {last ? 'Create your account' : 'Next'}
        </Btn>
        {last ? (
          <TouchableOpacity activeOpacity={0.7} onPress={() => nav('login')} style={{ marginTop: 14, padding: 6 }}>
            <Text style={f('ui', 500, 14, { color: C.text2, textAlign: 'center' })}>
              Already have an account? <Text style={f('ui', 700, 14, { color: C.primary })}>Sign in</Text>
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function Social({ brand, label, onPress }) {
  return (
    <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={{
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 11,
      minHeight: 50, borderRadius: 14, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line,
    }}>
      <Icon name={brand} size={20} />
      <Text style={f('ui', 700, 15, { color: C.text })}>{label}</Text>
    </TouchableOpacity>
  );
}

function AuthShell({ children, onBack }) {
  return (
    <Screen contentStyle={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 30 }}>
      {onBack ? (
        <TouchableOpacity activeOpacity={0.7} onPress={onBack} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8, marginBottom: 4 }}>
          <Icon name="chevL" size={18} color={C.text2} />
          <Text style={f('ui', 600, 14, { color: C.text2 })}>Back</Text>
        </TouchableOpacity>
      ) : null}
      <View style={{ alignItems: 'center', marginTop: 14, marginBottom: 26 }}><Wordmark size={24} /></View>
      {children}
    </Screen>
  );
}

const Divider = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 22 }}>
    <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
    <Text style={f('ui', 500, 12.5, { color: C.text3 })}>or continue with</Text>
    <View style={{ flex: 1, height: 1, backgroundColor: C.line }} />
  </View>
);

// ── Login ──
export function Login({ nav, signIn }) {
  const [email, setEmail] = useState('arnar@streakwar.app');
  const [pw, setPw] = useState('streakwar1');
  const [show, setShow] = useState(false);
  return (
    <AuthShell onBack={() => nav('onboarding')}>
      <Text style={f('disp', 700, 32, { color: C.text, letterSpacing: -0.4, textTransform: 'uppercase', marginBottom: 6 })}>Welcome back</Text>
      <Text style={f('ui', 400, 15, { color: C.text2, marginBottom: 26 })}>Sign in to keep your streak alive.</Text>
      <Field label="Email" value={email} onChange={setEmail} icon="mail" placeholder="you@example.com" keyboardType="email-address" style={{ marginBottom: 16 }} />
      <Field label="Password" value={pw} onChange={setPw} icon="lock" secure={!show} placeholder="••••••••"
        right={<TouchableOpacity activeOpacity={0.7} onPress={() => setShow(!show)} style={{ padding: 6 }}><Icon name={show ? 'eyeOff' : 'eye'} size={18} color={C.text3} /></TouchableOpacity>} />
      <TouchableOpacity activeOpacity={0.7} onPress={() => nav('reset')} style={{ alignSelf: 'flex-end', paddingTop: 10, paddingBottom: 18, paddingHorizontal: 2 }}>
        <Text style={f('ui', 600, 13, { color: C.primary })}>Forgot password?</Text>
      </TouchableOpacity>
      <Btn full size="lg" onPress={signIn}>Sign in</Btn>
      <Divider />
      <View style={{ gap: 10 }}>
        <Social brand="google" label="Continue with Google" onPress={signIn} />
        <Social brand="apple" label="Continue with Apple" onPress={signIn} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 24 }}>
        <Text style={f('ui', 500, 14, { color: C.text2 })}>New here? </Text>
        <TouchableOpacity activeOpacity={0.7} onPress={() => nav('signup')}>
          <Text style={f('ui', 700, 14, { color: C.primary })}>Create account</Text>
        </TouchableOpacity>
      </View>
    </AuthShell>
  );
}

// ── Signup ──
export function Signup({ nav, signIn }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const strong = pw.length >= 8;
  return (
    <AuthShell onBack={() => nav('onboarding')}>
      <Text style={f('disp', 700, 32, { color: C.text, letterSpacing: -0.4, textTransform: 'uppercase', marginBottom: 6 })}>Join the war</Text>
      <Text style={f('ui', 400, 15, { color: C.text2, marginBottom: 24 })}>Start a streak. Challenge your friends.</Text>
      <View style={{ gap: 16 }}>
        <Field label="Full name" value={name} onChange={setName} icon="user" placeholder="Arnar Jónsson" />
        <Field label="Email" value={email} onChange={setEmail} icon="mail" placeholder="you@example.com" keyboardType="email-address" />
        <Field label="Password" value={pw} onChange={setPw} icon="lock" secure={!show} placeholder="At least 8 characters"
          right={<TouchableOpacity activeOpacity={0.7} onPress={() => setShow(!show)} style={{ padding: 6 }}><Icon name={show ? 'eyeOff' : 'eye'} size={18} color={C.text3} /></TouchableOpacity>} />
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, marginHorizontal: 2 }}>
        {[0, 1, 2].map((k) => (
          <View key={k} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: pw.length > k * 3 ? (strong ? C.green : C.amber) : C.surface3 }} />
        ))}
      </View>
      <Text style={f('ui', 500, 12, { color: strong ? C.green : C.text3, marginTop: 8 })}>{strong ? 'Strong password' : 'Use 8+ characters'}</Text>
      <Btn full size="lg" onPress={signIn} style={{ marginTop: 20 }}>Create account</Btn>
      <Text style={f('ui', 400, 11.5, { color: C.text3, textAlign: 'center', lineHeight: 17, marginTop: 16 })}>
        By continuing you agree to our <Text style={{ color: C.text2 }}>Terms</Text> & <Text style={{ color: C.text2 }}>Privacy Policy</Text>.
      </Text>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 18 }}>
        <Text style={f('ui', 500, 14, { color: C.text2 })}>Have an account? </Text>
        <TouchableOpacity activeOpacity={0.7} onPress={() => nav('login')}>
          <Text style={f('ui', 700, 14, { color: C.primary })}>Sign in</Text>
        </TouchableOpacity>
      </View>
    </AuthShell>
  );
}

// ── Reset password ──
export function Reset({ nav }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  return (
    <AuthShell onBack={() => nav('login')}>
      {sent ? (
        <View style={{ alignItems: 'center', paddingTop: 20 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, marginBottom: 20, backgroundColor: a(C.green, 0.14), borderWidth: 1.5, borderColor: a(C.green, 0.4), alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="mail" size={36} color={C.green} stroke={1.8} />
          </View>
          <Text style={f('disp', 700, 28, { color: C.text, textTransform: 'uppercase', marginBottom: 10 })}>Check your inbox</Text>
          <Text style={f('ui', 400, 15, { color: C.text2, lineHeight: 22, maxWidth: 280, textAlign: 'center', marginBottom: 26 })}>
            We sent a reset link to <Text style={f('ui', 600, 15, { color: C.text })}>{email || 'your email'}</Text>. Follow it to set a new password.
          </Text>
          <Btn full size="lg" variant="outline" onPress={() => nav('login')}>Back to sign in</Btn>
        </View>
      ) : (
        <View>
          <Text style={f('disp', 700, 32, { color: C.text, letterSpacing: -0.4, textTransform: 'uppercase', marginBottom: 6 })}>Reset password</Text>
          <Text style={f('ui', 400, 15, { color: C.text2, marginBottom: 24 })}>Enter your email and we’ll send a reset link.</Text>
          <Field label="Email" value={email} onChange={setEmail} icon="mail" placeholder="you@example.com" keyboardType="email-address" style={{ marginBottom: 20 }} />
          <Btn full size="lg" onPress={() => setSent(true)} disabled={!email.includes('@')}>Send reset link</Btn>
        </View>
      )}
    </AuthShell>
  );
}

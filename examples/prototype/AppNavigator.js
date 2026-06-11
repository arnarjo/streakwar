// StreakWar — shared UI primitives (React Native port)
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal as RNModal, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from './Icon';
import { C, a, f } from '../theme';
import { DB, ACT_ICON } from '../data';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });

// ── Gradient wrapper (replaces CSS linear-gradient) ──
export function Grad({ colors, start, end, style, children, pointerEvents }) {
  return (
    <LinearGradient
      colors={colors}
      start={start || { x: 0, y: 0 }}
      end={end || { x: 0, y: 1 }}
      style={style}
      pointerEvents={pointerEvents}
    >
      {children}
    </LinearGradient>
  );
}
const DIAG = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };

// ── Press (tap with feedback) ──
export function Press({ onPress, style, children, disabled, activeOpacity = 0.7 }) {
  return (
    <TouchableOpacity activeOpacity={activeOpacity} onPress={onPress} disabled={disabled} style={style}>
      {children}
    </TouchableOpacity>
  );
}

// ── Screen body (scrollable) ──
export function Screen({ children, style, contentStyle }) {
  return (
    <ScrollView
      style={[{ flex: 1 }, style]}
      contentContainerStyle={contentStyle}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

// ── Header (fixed top bar; render outside Screen) ──
export function Header({ title, subtitle, left, right, big, onBack, style }) {
  return (
    <View style={[{
      backgroundColor: a(C.bg, 0.92),
      paddingHorizontal: big ? 20 : 16,
      paddingVertical: big ? 14 : 12,
      borderBottomWidth: 1, borderBottomColor: C.line2,
    }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        {onBack ? <IconBtn name="arrowL" onPress={onBack} /> : null}
        {left}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={f('disp', 700, big ? 28 : 21, {
            color: C.text, letterSpacing: big ? -0.5 : -0.2,
            textTransform: big ? 'uppercase' : 'none',
          })}>{title}</Text>
          {subtitle ? <Text style={f('ui', 500, 12.5, { color: C.text2, marginTop: 2 })}>{subtitle}</Text> : null}
        </View>
        {right ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{right}</View> : null}
      </View>
    </View>
  );
}

// ── Button ──
export function Btn({ children, onPress, variant = 'primary', size = 'md', icon, iconR, full, disabled, style }) {
  const padV = { sm: 9, md: 13, lg: 15 }[size];
  const padH = { sm: 14, md: 18, lg: 22 }[size];
  const fs = { sm: 14, md: 15.5, lg: 17 }[size];
  const minH = size === 'sm' ? 40 : 48;
  const iconSize = size === 'lg' ? 20 : 18;

  const variants = {
    primary: { color: C.onPrimary },
    solidDark: { bg: C.surface2, color: C.text, border: C.line },
    outline: { bg: 'transparent', color: C.text, border: C.line },
    ghost: { bg: 'transparent', color: C.text2, border: 'transparent' },
    danger: { bg: a(C.red, 0.12), color: C.red, border: a(C.red, 0.35) },
    success: { bg: a(C.green, 0.14), color: C.green, border: a(C.green, 0.4) },
  };
  const v = variants[variant] || variants.primary;
  const txtColor = v.color;

  const inner = (
    <>
      {icon ? <Icon name={icon} size={iconSize} color={txtColor} stroke={2.1} /> : null}
      {typeof children === 'string'
        ? <Text style={f('ui', 700, fs, { color: txtColor, letterSpacing: 0.2 })}>{children}</Text>
        : children}
      {iconR ? <Icon name={iconR} size={iconSize} color={txtColor} stroke={2.1} /> : null}
    </>
  );

  const rowStyle = {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: padV, paddingHorizontal: padH, borderRadius: 14,
    minHeight: minH, alignSelf: full ? 'stretch' : 'flex-start', width: full ? '100%' : undefined,
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      disabled={disabled}
      style={[{ opacity: disabled ? 0.45 : 1, alignSelf: full ? 'stretch' : 'flex-start' }, full ? { width: '100%' } : null, style]}
    >
      {variant === 'primary' ? (
        <Grad colors={[C.primaryBri, C.primary]} style={rowStyle}>{inner}</Grad>
      ) : (
        <View style={[rowStyle, { backgroundColor: v.bg, borderWidth: 1, borderColor: v.border }]}>{inner}</View>
      )}
    </TouchableOpacity>
  );
}

// ── Icon button (square) ──
export function IconBtn({ name, onPress, color = C.text, bg = C.surface2, size = 42, ic = 20, active, style }) {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[{
        width: size, height: size, borderRadius: 13,
        backgroundColor: active ? a(C.primary, 0.16) : bg,
        borderWidth: 1, borderColor: active ? a(C.primary, 0.4) : C.line,
        alignItems: 'center', justifyContent: 'center',
      }, style]}
    >
      <Icon name={name} size={ic} color={active ? C.primary : color} stroke={2} />
    </TouchableOpacity>
  );
}

// ── Card ──
export function Card({ children, onPress, style, pad = 16, glow }) {
  const s = [{
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: pad,
    ...(glow ? { shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 6 } : null),
  }, style];
  if (onPress) {
    return <TouchableOpacity activeOpacity={0.85} onPress={onPress} style={s}>{children}</TouchableOpacity>;
  }
  return <View style={s}>{children}</View>;
}

// ── Avatar ──
export function Avatar({ user, size = 44, ring, onPress, style }) {
  const u = typeof user === 'string' ? (DB.U[user] || {}) : (user || {});
  const accent = u.accent || C.primary;
  const init = u.initials || (u.full_name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2);
  const body = (
    <Grad colors={[a(accent, 0.32), a(accent, 0.12)]} start={DIAG.start} end={DIAG.end} style={[{
      width: size, height: size, borderRadius: size,
      borderWidth: ring ? 2 : 1, borderColor: ring ? accent : a(accent, 0.4),
      alignItems: 'center', justifyContent: 'center',
    }, style]}>
      <Text style={f('disp', 700, size * 0.4, { color: accent, letterSpacing: 0.5 })}>{init}</Text>
    </Grad>
  );
  return onPress ? <TouchableOpacity activeOpacity={0.7} onPress={onPress}>{body}</TouchableOpacity> : body;
}

// ── Tag / chip ──
export function Tag({ children, icon, color = C.text2, bg, style }) {
  return (
    <View style={[{
      flexDirection: 'row', alignItems: 'center', gap: 5,
      paddingVertical: 4, paddingHorizontal: 9, borderRadius: 8,
      backgroundColor: bg || a('#FFFFFF', 0.05), borderWidth: 1, borderColor: C.line,
    }, style]}>
      {icon ? <Icon name={icon} size={13} color={color} stroke={2.1} /> : null}
      <Text style={f('ui', 600, 11.5, { color, letterSpacing: 0.2 })}>{children}</Text>
    </View>
  );
}

// ── Segmented tabs ──
export function SegTabs({ tabs, value, onChange, style }) {
  return (
    <View style={[{
      flexDirection: 'row', gap: 4, padding: 4,
      backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 14,
    }, style]}>
      {tabs.map((t) => {
        const on = t.key === value;
        const content = (
          <>
            {t.icon ? <Icon name={t.icon} size={15} color={on ? C.onPrimary : C.text2} stroke={2.1} /> : null}
            <Text style={f('ui', 700, 13, { color: on ? C.onPrimary : C.text2 })}>{t.label}</Text>
          </>
        );
        const rs = { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 9, borderRadius: 10, minHeight: 40 };
        return (
          <TouchableOpacity key={t.key} activeOpacity={0.85} onPress={() => onChange(t.key)} style={{ flex: 1 }}>
            {on
              ? <Grad colors={[C.primaryBri, C.primary]} style={rs}>{content}</Grad>
              : <View style={rs}>{content}</View>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ── Horizontal scroll chips ──
export function ChipRow({ items, value, onChange, style }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={style} contentContainerStyle={{ gap: 8 }}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <TouchableOpacity key={it.key} activeOpacity={0.7} onPress={() => onChange(it.key)} style={{
            flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 14,
            borderRadius: 11, minHeight: 40,
            backgroundColor: on ? a(C.primary, 0.16) : C.surface,
            borderWidth: 1, borderColor: on ? a(C.primary, 0.45) : C.line,
          }}>
            {it.icon ? <Icon name={it.icon} size={15} color={on ? C.primary : C.text2} stroke={2.1} /> : null}
            <Text style={f('ui', 600, 13.5, { color: on ? C.primary : C.text2 })}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

// ── Progress bar ──
export function Bar({ value, color = C.primary, h = 6, track, glow, style }) {
  const pct = Math.max(0, Math.min(100, value * 100));
  return (
    <View style={[{ height: h, borderRadius: h, backgroundColor: track || a('#FFFFFF', 0.08), overflow: 'hidden' }, style]}>
      <Grad
        colors={[a(color, 0.85), color]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ height: '100%', width: `${pct}%`, borderRadius: h }}
      />
    </View>
  );
}

// ── Toggle switch ──
export function Toggle({ on, onChange }) {
  return (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onChange(!on)} style={{
      width: 48, height: 28, borderRadius: 14, padding: 3,
      backgroundColor: on ? C.primary : C.surface3, justifyContent: 'center',
    }}>
      <View style={{
        width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff',
        transform: [{ translateX: on ? 20 : 0 }],
        shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2,
      }} />
    </TouchableOpacity>
  );
}

// ── Field (label + input) ──
export function Field({ label, value, onChange, placeholder, secure, icon, right, error, multiline, onFocus, style, keyboardType }) {
  const [foc, setFoc] = useState(false);
  return (
    <View style={style}>
      {label ? <Text style={f('ui', 700, 10.5, { letterSpacing: 1.4, color: C.text2, marginBottom: 8, textTransform: 'uppercase' })}>{label}</Text> : null}
      <View style={{
        flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 10,
        paddingHorizontal: 14, paddingVertical: multiline ? 13 : 0, minHeight: 50,
        backgroundColor: C.surface2, borderRadius: 13,
        borderWidth: 1.5, borderColor: error ? C.red : foc ? a(C.primary, 0.6) : C.line,
      }}>
        {icon ? <Icon name={icon} size={18} color={foc ? C.primary : C.text3} stroke={2} style={{ marginTop: multiline ? 2 : 0 }} /> : null}
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={C.text3}
          secureTextEntry={secure}
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          keyboardType={keyboardType}
          onFocus={() => { setFoc(true); onFocus && onFocus(); }}
          onBlur={() => setFoc(false)}
          style={[f('ui', 500, 15.5, {
            flex: 1, color: C.text, paddingVertical: multiline ? 0 : 14,
            textAlignVertical: multiline ? 'top' : 'center',
            minHeight: multiline ? 66 : undefined,
          })]}
        />
        {right}
      </View>
      {error ? <Text style={f('ui', 500, 12, { color: C.red, marginTop: 6 })}>{error}</Text> : null}
    </View>
  );
}

// ── Skeleton (static placeholder) ──
export function Skel({ w = '100%', h = 14, r = 7, style }) {
  return <View style={[{ width: w, height: h, borderRadius: r, backgroundColor: a('#FFFFFF', 0.05) }, style]} />;
}

// ── Bottom sheet ──
export function Sheet({ open, onClose, children, title }) {
  return (
    <RNModal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(2,5,10,0.62)', justifyContent: 'flex-end' }}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ maxHeight: '88%' }}>
          <Grad colors={[C.surface, C.bg]} style={{
            borderTopLeftRadius: 26, borderTopRightRadius: 26, borderTopWidth: 1, borderColor: C.line,
            paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30,
          }}>
            <View style={{ width: 40, height: 5, borderRadius: 3, backgroundColor: C.surface3, alignSelf: 'center', marginBottom: 16 }} />
            {title ? <Text style={f('disp', 700, 22, { color: C.text, letterSpacing: -0.3, marginBottom: 14, textTransform: 'uppercase' })}>{title}</Text> : null}
            <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>
          </Grad>
        </TouchableOpacity>
      </TouchableOpacity>
    </RNModal>
  );
}

// ── Center modal ──
export function Modal({ open, onClose, children, w = 320 }) {
  return (
    <RNModal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity activeOpacity={1} onPress={onClose} style={{ flex: 1, backgroundColor: 'rgba(2,5,10,0.66)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <TouchableOpacity activeOpacity={1} onPress={() => {}} style={{ width: w, maxWidth: '100%' }}>
          <Grad colors={[C.surface2, C.surface]} style={{ borderWidth: 1, borderColor: C.line, borderRadius: 24, padding: 24 }}>
            {children}
          </Grad>
        </TouchableOpacity>
      </TouchableOpacity>
    </RNModal>
  );
}

// ── Activity badge ──
export function ActIcon({ act, size = 44, color = C.primary, style }) {
  return (
    <View style={[{
      width: size, height: size, borderRadius: 14,
      backgroundColor: a(color, 0.14), borderWidth: 1, borderColor: a(color, 0.28),
      alignItems: 'center', justifyContent: 'center',
    }, style]}>
      <Icon name={ACT_ICON[act] || 'other'} size={size * 0.5} color={color} stroke={2} />
    </View>
  );
}

// ── Stat tile ──
export function Stat({ icon, value, label, color = C.text, style }) {
  return (
    <View style={[{
      flex: 1, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, borderRadius: 16,
      paddingVertical: 14, paddingHorizontal: 12, gap: 5,
    }, style]}>
      {icon ? <Icon name={icon} size={18} color={color} stroke={2} /> : null}
      <Text style={f('disp', 700, 26, { color: C.text, letterSpacing: -0.3 })}>{value}</Text>
      <Text style={f('ui', 600, 11.5, { color: C.text2 })}>{label}</Text>
    </View>
  );
}

// ── Section label ──
export function SLabel({ children, style }) {
  return <Text style={[f('ui', 700, 11, { letterSpacing: 1.6, color: C.text2, textTransform: 'uppercase' }), style]}>{children}</Text>;
}

// ── Empty state ──
export function Empty({ icon, title, sub, cta }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 60, paddingHorizontal: 30, gap: 8 }}>
      <View style={{ width: 72, height: 72, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
        <Icon name={icon} size={34} color={C.text3} stroke={1.7} />
      </View>
      <Text style={f('ui', 700, 18, { color: C.text })}>{title}</Text>
      {sub ? <Text style={f('ui', 400, 14, { color: C.text2, maxWidth: 240, textAlign: 'center', lineHeight: 20 })}>{sub}</Text> : null}
      {cta ? <View style={{ marginTop: 10 }}>{cta}</View> : null}
    </View>
  );
}

// ── Photo placeholder (no fake imagery) ──
export function PhotoSlot({ label = 'workout photo', h = 200 }) {
  return (
    <View style={{
      height: h, borderRadius: 14, overflow: 'hidden',
      backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line,
      alignItems: 'center', justifyContent: 'center',
    }}>
      <Icon name="image" size={26} color={C.text3} stroke={1.7} style={{ marginBottom: 8 }} />
      <Text style={{ fontFamily: MONO, fontSize: 11, color: C.text3, letterSpacing: 0.5, backgroundColor: a(C.bg, 0.5), paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6 }}>{label}</Text>
    </View>
  );
}

// ── Wordmark ──
export function Wordmark({ size = 26 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      <Grad colors={[C.primaryBri, C.primaryDeep]} start={DIAG.start} end={DIAG.end} style={{
        width: size * 1.3, height: size * 1.3, borderRadius: size * 0.38,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: C.primary, shadowOpacity: 0.7, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6,
      }}>
        <Icon name="flame" size={size * 0.82} color="#fff" stroke={2.2} />
      </Grad>
      <Text style={f('disp', 800, size, { color: C.text, letterSpacing: 1.5 })}>
        STREAK<Text style={{ color: C.primary }}>WAR</Text>
      </Text>
    </View>
  );
}

// ── Setting row (icon + title/sub + toggle) ──
export function SettingRow({ icon, title, sub, on, set }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 13, padding: 14 }}>
      <View style={{ width: 38, height: 38, borderRadius: 11, backgroundColor: C.surface2, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={C.text2} stroke={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={f('ui', 700, 14, { color: C.text })}>{title}</Text>
        <Text style={f('ui', 500, 12, { color: C.text2, marginTop: 1 })}>{sub}</Text>
      </View>
      <Toggle on={on} onChange={set} />
    </View>
  );
}

import React from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Switch,
} from 'react-native';
import { TIE_BREAK_LABELS } from '../../types/database';
import type { TieBreakRule, RenewalType } from '../../types/database';
import UpgradeModal from '../../components/UpgradeModal';
import { C } from '../../theme';

const TIE_BREAK_OPTIONS: TieBreakRule[] = ['first_to_score', 'most_recent_activity', 'most_workouts'];
const MAX_PARTICIPANT_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: '5', value: 5 },
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '50', value: 50 },
  { label: '∞', value: null },
];

export interface Step3Props {
  isPro: boolean;
  backlogDays: string;
  setBacklogDays: (v: string) => void;
  requirePhoto: boolean;
  setRequirePhoto: (v: boolean) => void;
  teamsMode: boolean;
  setTeamsMode: (v: boolean) => void;
  tieBreak: TieBreakRule;
  setTieBreak: (v: TieBreakRule) => void;
  isPublic: boolean;
  setIsPublic: (v: boolean) => void;
  maxParticipants: number | null;
  setMaxParticipants: (v: number | null) => void;
  renewalType: RenewalType;
  setRenewalType: (v: RenewalType) => void;
  upgradeVisible: boolean;
  setUpgradeVisible: (v: boolean) => void;
  offering: any;
  purchase: () => void;
  restore: () => void;
}

export default function Step3Rules({
  isPro, backlogDays, setBacklogDays,
  requirePhoto, setRequirePhoto,
  teamsMode, setTeamsMode,
  tieBreak, setTieBreak,
  isPublic, setIsPublic,
  maxParticipants, setMaxParticipants,
  renewalType, setRenewalType,
  upgradeVisible, setUpgradeVisible,
  offering, purchase, restore,
}: Step3Props) {
  return (
    <>
      <View style={s.inputGroup}>
        <Text style={s.label}>BACKLOG (days)</Text>
        <TextInput
          style={s.input}
          value={backlogDays}
          onChangeText={setBacklogDays}
          keyboardType="number-pad"
          placeholder="7"
          placeholderTextColor={C.dimmed}
        />
        <Text style={s.hint}>How many days back can workouts be logged?</Text>
      </View>

      <TouchableOpacity
        style={s.switchRow}
        activeOpacity={isPro ? 1 : 0.75}
        onPress={!isPro ? () => setUpgradeVisible(true) : undefined}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.switchLabel}>Require photo proof?</Text>
            {!isPro && (
              <View style={{ backgroundColor: '#FBBF2420', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#FBBF24', letterSpacing: 0.5 }}>PRO</Text>
              </View>
            )}
          </View>
          <Text style={s.switchHint}>Participants must upload a photo</Text>
        </View>
        <Switch
          value={requirePhoto}
          onValueChange={v => { if (!isPro) { setUpgradeVisible(true); return; } setRequirePhoto(v); }}
          trackColor={{ false: C.dimmed, true: C.primary }}
          thumbColor="#fff"
          disabled={!isPro}
        />
      </TouchableOpacity>

      <UpgradeModal
        visible={upgradeVisible}
        onClose={() => setUpgradeVisible(false)}
        offering={offering}
        onPurchase={purchase}
        onRestore={restore}
        reason="Photo proof requires a Pro subscription."
      />

      <View style={s.switchRow}>
        <View>
          <Text style={s.switchLabel}>Teams mode?</Text>
          <Text style={s.switchHint}>Divide participants into teams</Text>
        </View>
        <Switch
          value={teamsMode}
          onValueChange={setTeamsMode}
          trackColor={{ false: C.dimmed, true: C.primary }}
          thumbColor="#fff"
        />
      </View>

      <TouchableOpacity
        style={s.switchRow}
        activeOpacity={isPro ? 1 : 0.75}
        onPress={!isPro ? () => setUpgradeVisible(true) : undefined}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.switchLabel}>Open to everyone?</Text>
            {!isPro && (
              <View style={{ backgroundColor: '#FBBF2420', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: '#FBBF24', letterSpacing: 0.5 }}>PRO</Text>
              </View>
            )}
          </View>
          <Text style={s.switchHint}>Appears in the Discover tab</Text>
        </View>
        <Switch
          value={isPublic}
          onValueChange={v => {
            if (!isPro) { setUpgradeVisible(true); return; }
            setIsPublic(v);
            if (!v) setRenewalType('none');
          }}
          trackColor={{ false: C.dimmed, true: C.primary }}
          thumbColor="#fff"
          disabled={!isPro}
        />
      </TouchableOpacity>

      {isPublic && (
        <View style={s.inputGroup}>
          <Text style={s.label}>AUTO-RENEW?</Text>
          <Text style={s.hint}>A new challenge starts immediately when this one ends</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            {([
              { value: 'none', label: 'No' },
              { value: 'weekly', label: '🔥 Weekly' },
              { value: 'monthly', label: '🏆 Monthly' },
            ] as Array<{ value: RenewalType; label: string }>).map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[s.presetBtn, renewalType === opt.value && s.presetBtnActive, { flex: 1 }]}
                onPress={() => setRenewalType(opt.value)}
              >
                <Text style={[s.presetBtnText, renewalType === opt.value && s.presetBtnTextActive, { textAlign: 'center' }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={s.formRow}>
        <Text style={s.formLabel}>Max participants</Text>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          {MAX_PARTICIPANT_OPTIONS.map(opt => {
            const needsPro = opt.value === null && !isPro;
            return (
              <TouchableOpacity
                key={String(opt.value)}
                style={[s.maxBtn, maxParticipants === opt.value && s.maxBtnActive]}
                onPress={() => { if (needsPro) { setUpgradeVisible(true); return; } setMaxParticipants(opt.value); }}
              >
                <Text style={[s.maxBtnText, maxParticipants === opt.value && s.maxBtnTextActive]}>
                  {opt.label}{needsPro ? ' ⚡' : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Text style={[s.label, { marginTop: 20 }]}>TIEBREAKER *</Text>
      <Text style={s.hint}>This will be shown to participants in advance</Text>
      {TIE_BREAK_OPTIONS.map(rule => (
        <TouchableOpacity
          key={rule}
          style={[s.toggleRow, tieBreak === rule && s.toggleRowActive]}
          onPress={() => setTieBreak(rule)}
        >
          <Text style={s.toggleLabel}>{TIE_BREAK_LABELS[rule]}</Text>
          <View style={[s.radio, tieBreak === rule && s.radioActive]}>
            {tieBreak === rule && <View style={s.radioDot} />}
          </View>
        </TouchableOpacity>
      ))}
    </>
  );
}

const s = StyleSheet.create({
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.5, marginBottom: 8 },
  hint: { fontSize: 12, color: C.muted, marginTop: 5 },
  input: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13,
    color: C.text, fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 8,
  },
  switchLabel: { fontSize: 14, color: C.text, fontWeight: '600' },
  switchHint: { fontSize: 11, color: C.muted, marginTop: 2 },
  formRow: { marginBottom: 16 },
  formLabel: { fontSize: 12, fontWeight: '700', color: C.muted, letterSpacing: 1, marginBottom: 10 },
  maxBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  maxBtnActive: { borderColor: C.primary, backgroundColor: C.primary + '18' },
  maxBtnText: { fontSize: 13, fontWeight: '700', color: C.muted },
  maxBtnTextActive: { color: C.primary },
  presetBtn: {
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)', backgroundColor: 'rgba(255,255,255,0.04)',
  },
  presetBtnActive: { borderColor: C.primary, backgroundColor: C.primary + '18' },
  presetBtnText: { fontSize: 13, fontWeight: '700', color: C.muted },
  presetBtnTextActive: { color: C.primary },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 8,
  },
  toggleRowActive: { borderColor: C.primary + '50', backgroundColor: C.primary + '10' },
  toggleLabel: { fontSize: 14, color: C.text, fontWeight: '600', flex: 1 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: C.muted,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: C.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.primary },
});

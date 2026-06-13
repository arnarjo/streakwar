import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ACHIEVEMENT_META } from '../../types/database';
import type { UserAchievement } from '../../types/database';
import { C } from '../../theme';

/** "Achievements" section on the profile — a wrapped grid of earned badges. */
export default function AchievementsGrid({ achievements }: { achievements: UserAchievement[] }) {
  if (achievements.length === 0) return null;

  return (
    <>
      <Text style={s.sectionLabel}>Achievements</Text>
      <View style={s.achievementsGrid}>
        {achievements.map(a => {
          const meta = ACHIEVEMENT_META[a.achievement];
          if (!meta) return null;
          return (
            <View key={a.id} style={s.achievementCard}>
              <Text style={s.achievementIcon}>{meta.icon}</Text>
              <Text style={s.achievementTitle}>{meta.title}</Text>
              <Text style={s.achievementDesc}>{meta.desc}</Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

const s = StyleSheet.create({
  sectionLabel: { fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 11 },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  achievementCard: { width: '47%', backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  achievementIcon: { fontSize: 28 },
  achievementTitle: { fontSize: 13, fontWeight: '800', color: C.text, textAlign: 'center' },
  achievementDesc: { fontSize: 11, color: C.muted, textAlign: 'center', lineHeight: 15 },
});
